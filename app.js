/* meaw board — аккаунты, список досок, ссылка для совместной работы, синхронизация */
(() => {
  'use strict';
  const M = window.meawBoard;
  if (!M) return;

  const $ = (s, r = document) => r.querySelector(s);
  const body = document.body;
  const clientId = (Math.random().toString(36).slice(2, 8) + Date.now().toString(36)).slice(0, 20);

  const CAT = '<svg viewBox="0 0 32 32"><path class="cat" d="M6 12V4l7 4.5q3-.5 6 0L26 4v8q2 3 1 7-2 8-11 8T5 19q-1-4 1-7z"/><circle cx="12" cy="16" r="1.9" class="eye"/><circle cx="20" cy="16" r="1.9" class="eye"/><path d="M14 20.4q2 1.9 4 0" class="mouth"/></svg>';
  const ARROW = '<svg viewBox="0 0 24 24"><path d="M4 3l15 8-6.5 1.8L9.5 19z" fill="currentColor" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';

  /* ---------- Помощники ---------- */
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    const add = k => {
      if (k == null || k === false) return;
      if (Array.isArray(k)) k.forEach(add);
      else e.append(k.nodeType ? k : document.createTextNode(String(k)));
    };
    kids.forEach(add);
    return e;
  }
  const ic = name => { const s = h('span', { class: 'ico' }); s.innerHTML = M.icon(name); return s; };
  const initial = n => (Array.from(String(n || '?').trim())[0] || '?').toUpperCase();
  const fmtDate = t => new Date(t).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  /* ---------- Локальный режим (без сервера) ---------- */
  let local = false;
  const LS_KEY = 'meaw-local-v1';
  const lsRead = () => {
    try { const d = JSON.parse(localStorage.getItem(LS_KEY)); if (d && d.boards) return d; } catch (e) { /* noop */ }
    return { boards: {} };
  };
  const lsWrite = d => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(d)); }
    catch (e) { M.toast('Не удалось сохранить: хранилище браузера недоступно или заполнено'); }
  };
  const lerr = (status, message) => Object.assign(new Error(message), { status });
  const lmeta = b => ({ id: b.id, name: b.name, mine: true, owner: me.name, updated: b.updated, count: b.items.length });

  async function localApi(method, url, data) {
    const d = lsRead();
    const path = url.split('?')[0];
    data = data || {};
    if (path === '/api/boards') {
      if (method === 'GET') return { boards: Object.values(d.boards).sort((a, b) => b.updated - a.updated).map(lmeta) };
      if (method === 'POST') {
        let id;
        do { id = Math.random().toString(36).slice(2, 14); } while (d.boards[id]);
        const b = {
          id,
          name: String(data.name || '').trim().slice(0, 60) || 'Новая доска',
          items: Array.isArray(data.items) ? data.items : [],
          updated: Date.now()
        };
        d.boards[id] = b;
        lsWrite(d);
        return { board: lmeta(b) };
      }
    }
    const m = /^\/api\/boards\/([\w-]+)(\/ops)?$/.exec(path);
    const b = m && Object.prototype.hasOwnProperty.call(d.boards, m[1]) ? d.boards[m[1]] : null;
    if (!b) throw lerr(404, 'Доска не найдена');
    if (m[2]) {
      if (method === 'POST' && (data.set || data.del || data.order)) {
        const map = new Map(b.items.map(i => [i.id, i]));
        (data.del || []).forEach(id => map.delete(id));
        (data.set || []).forEach(it => map.set(it.id, it));
        const out = [], seen = new Set();
        const take = id => { const v = map.get(id); if (v && !seen.has(id)) { seen.add(id); out.push(v); } };
        (data.order || []).forEach(take);
        b.items.forEach(i => take(i.id));
        (data.set || []).forEach(i => take(i.id));
        b.items = out;
        b.updated = Date.now();
        lsWrite(d);
      }
      return { ok: true };
    }
    if (method === 'GET') {
      const u = { id: me.id, name: me.name, guest: false, color: me.color };
      return { id: b.id, name: b.name, items: b.items, mine: true, owner: u, members: [u] };
    }
    if (method === 'PATCH') {
      b.name = String(data.name || '').trim().slice(0, 60) || b.name;
      b.updated = Date.now();
      lsWrite(d);
      return { board: lmeta(b) };
    }
    if (method === 'DELETE') {
      delete d.boards[b.id];
      lsWrite(d);
      return { ok: true, deleted: true };
    }
    throw lerr(405, 'Не поддерживается');
  }

  const api = (method, url, data) => (local ? localApi(method, url, data) : netApi(method, url, data));

  async function netApi(method, url, data) {
    let r;
    try {
      // Путь относительный: сайт может лежать в подпапке (например, на GitHub Pages)
      r = await fetch(url.replace(/^\//, ''), {
        method,
        credentials: 'same-origin',
        headers: data ? { 'Content-Type': 'application/json' } : {},
        body: data ? JSON.stringify(data) : undefined
      });
    } catch (e) {
      throw Object.assign(new Error('Нет связи с сервером'), { status: 0 });
    }
    let json = null;
    try { json = await r.json(); } catch (e) { /* пустой ответ */ }
    if (!r.ok) throw Object.assign(new Error((json && json.error) || 'Ошибка ' + r.status), { status: r.status });
    return json;
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* запасной путь */ }
    const t = h('textarea', { style: 'position:fixed;opacity:0' });
    t.value = text;
    document.body.appendChild(t);
    t.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { /* noop */ }
    t.remove();
    return ok;
  }

  const avatar = (u, cls) => {
    const a = h('span', { class: 'avatar ' + (cls || ''), title: u.name, text: initial(u.name) });
    a.style.setProperty('--c', u.color || '#6750A4');
    return a;
  };

  /* ---------- Состояние ---------- */
  let me = null;
  let boards = [];
  let cur = null;
  let es = null;
  let online = [];
  let navSeq = 0;
  let lastSent = Object.create(null);
  let lastOrder = '';
  let chain = Promise.resolve();
  let pending = 0;
  let retryTimer = null;
  let lan = null;
  const cursors = new Map();

  /* ---------- Диалоги ---------- */
  const modals = [];
  const drawer = $('#drawer');
  const drawerScrim = $('#drawerScrim');
  const syncModalClass = () => body.classList.toggle('modal-open', modals.length > 0 || drawer.classList.contains('open'));

  function modal(content, opts = {}) {
    const scrim = h('div', { class: 'scrim' });
    const box = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true' }, content);
    scrim.appendChild(box);
    const m = { dismiss: opts.dismiss !== false, closed: false };
    m.close = () => {
      if (m.closed) return;
      m.closed = true;
      modals.splice(modals.indexOf(m), 1);
      scrim.classList.add('out');
      setTimeout(() => scrim.remove(), 160);
      syncModalClass();
    };
    scrim.addEventListener('pointerdown', e => { if (e.target === scrim && m.dismiss) m.close(); });
    document.body.appendChild(scrim);
    modals.push(m);
    syncModalClass();
    return m;
  }

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const top = modals[modals.length - 1];
    if (top) { if (top.dismiss) top.close(); }
    else if (drawer.classList.contains('open')) closeDrawer();
  }, true);

  function field(label, props = {}) {
    const input = h('input', Object.assign({ class: 'fld-input', placeholder: ' ' }, props));
    const wrap = h('label', { class: 'field' }, input, h('span', { class: 'fld-label', text: label }));
    return { wrap, input };
  }

  function confirmDialog({ title, text, ok, danger }, onOk) {
    const m = modal([
      h('h2', { text: title }),
      h('p', { text }),
      h('div', { class: 'actions' },
        h('button', { class: 'btn text', type: 'button', onclick: () => m.close() }, 'Отмена'),
        h('button', { class: 'btn text' + (danger ? ' danger' : ''), type: 'button', onclick: async () => { m.close(); await onOk(); } }, ok))
    ]);
  }

  function nameDialog({ title, value, ok }, onOk) {
    const f = field('Название', { type: 'text', maxlength: 60, value });
    const m = modal(h('form', {
      class: 'auth-form',
      onsubmit: async e => {
        e.preventDefault();
        const v = f.input.value.trim();
        if (!v) return;
        m.close();
        await onOk(v);
      }
    },
    h('h2', { text: title }),
    f.wrap,
    h('div', { class: 'actions' },
      h('button', { class: 'btn text', type: 'button', onclick: () => m.close() }, 'Отмена'),
      h('button', { class: 'btn text', type: 'submit' }, ok))));
    setTimeout(() => { f.input.focus(); f.input.select(); }, 60);
  }

  /* ---------- Вход / регистрация / гость ---------- */
  function showAuth(opts = {}) {
    let mode = opts.mode || 'login';
    const err = h('div', { class: 'form-err', role: 'alert' });
    const fName = field('Имя', { type: 'text', autocomplete: 'name', maxlength: 40 });
    const fMail = field('Email', { type: 'email', autocomplete: 'email', inputmode: 'email' });
    const fPass = field('Пароль', { type: 'password', autocomplete: 'current-password', maxlength: 200 });
    const submit = h('button', { class: 'btn filled block', type: 'submit' });
    const tabLogin = h('button', { class: 'tab', type: 'button', onclick: () => setMode('login') }, 'Вход');
    const tabReg = h('button', { class: 'tab', type: 'button', onclick: () => setMode('register') }, 'Регистрация');

    function setMode(m) {
      mode = m;
      err.textContent = '';
      tabLogin.classList.toggle('on', m === 'login');
      tabReg.classList.toggle('on', m === 'register');
      fName.wrap.hidden = m === 'login';
      fPass.input.autocomplete = m === 'login' ? 'current-password' : 'new-password';
      submit.textContent = m === 'login' ? 'Войти' : 'Создать аккаунт';
    }

    const form = h('form', {
      class: 'auth-form',
      novalidate: true,
      onsubmit: async e => {
        e.preventDefault();
        err.textContent = '';
        submit.disabled = true;
        try {
          const r = mode === 'login'
            ? await api('POST', '/api/login', { email: fMail.input.value, password: fPass.input.value })
            : await api('POST', '/api/register', { name: fName.input.value, email: fMail.input.value, password: fPass.input.value });
          me = r.user;
          dlg.close();
          afterAuth(false);
        } catch (ex) {
          err.textContent = ex.message;
        } finally {
          submit.disabled = false;
        }
      }
    }, fName.wrap, fMail.wrap, fPass.wrap, err, submit);

    const guestBtn = h('button', {
      class: 'btn outlined block',
      type: 'button',
      onclick: async () => {
        err.textContent = '';
        try {
          me = (await api('POST', '/api/guest')).user;
          dlg.close();
          afterAuth(true);
        } catch (ex) { err.textContent = ex.message; }
      }
    }, ic('user'), 'Продолжить как гость');

    const logo = h('span', { class: 'auth-logo' });
    logo.innerHTML = CAT;
    const title = opts.upgrade ? 'Сохраните свои доски' : 'meaw board';
    const sub = opts.upgrade
      ? 'Зарегистрируйтесь — и ваши доски останутся с вами на любом устройстве. Если аккаунт уже есть, войдите: доски гостя перенесутся в него.'
      : opts.invited
        ? 'Вас пригласили на доску. Войдите, зарегистрируйтесь или зайдите гостем — имя не понадобится.'
        : 'Рисуйте, думайте и работайте над досками вместе.';

    const dlg = modal([
      h('div', { class: 'auth-head' }, logo, h('h2', { text: title }), h('p', { text: sub })),
      h('div', { class: 'tabs' }, tabLogin, tabReg),
      form,
      opts.upgrade ? null : [h('div', { class: 'or', text: 'или' }), guestBtn],
      opts.upgrade ? h('div', { class: 'actions' }, h('button', { class: 'btn text', type: 'button', onclick: () => dlg.close() }, 'Не сейчас')) : null
    ], { dismiss: !!opts.upgrade });

    setMode(mode);
    setTimeout(() => (mode === 'register' ? fName : fMail).input.focus(), 80);
    return dlg;
  }

  async function afterAuth(isGuest) {
    renderDrawer();
    if (isGuest) M.toast('Вы вошли как гость. Зарегистрируйтесь, чтобы доски не потерялись.');
    await loadBoards();
    if (!cur) route();
  }

  async function logout() {
    try { await api('POST', '/api/logout'); } catch (e) { /* noop */ }
    me = null;
    boards = [];
    cur = null;
    closeStream();
    clearCursors();
    online = [];
    renderPresence();
    history.replaceState(null, '', location.pathname);
    M.replaceItems([], 'meaw board');
    closeDrawer();
    showAuth({});
  }

  /* ---------- Меню досок ---------- */
  function openDrawer() { renderDrawer(); drawer.classList.add('open'); drawerScrim.classList.add('open'); syncModalClass(); }
  function closeDrawer() { drawer.classList.remove('open'); drawerScrim.classList.remove('open'); syncModalClass(); }
  drawerScrim.addEventListener('pointerdown', closeDrawer);
  $('#btnBoards').addEventListener('click', openDrawer);

  async function loadBoards() {
    try {
      boards = (await api('GET', '/api/boards')).boards;
      renderDrawer();
    } catch (e) {
      if (e.status === 401) { me = null; showAuth({}); }
    }
  }

  function renderDrawer() {
    drawer.replaceChildren();
    const list = h('div', { class: 'board-list' });
    if (!boards.length) list.append(h('div', { class: 'board-empty', text: 'Пока нет досок' }));
    for (const b of boards) {
      const sub = (b.mine ? 'Моя' : 'Владелец: ' + b.owner) + ' · ' + fmtDate(b.updated);
      list.append(h('div', {
        class: 'board-item' + (cur && cur.id === b.id ? ' active' : ''),
        role: 'button',
        tabindex: 0,
        onclick: () => { closeDrawer(); go(b.id); },
        onkeydown: e => { if (e.key === 'Enter') { closeDrawer(); go(b.id); } }
      },
      h('span', { class: 'board-ico' }, ic('board')),
      h('span', { class: 'board-meta' }, h('span', { class: 'board-name', text: b.name }), h('span', { class: 'board-sub', text: sub })),
      h('button', { class: 'icon-btn sm', title: 'Переименовать', 'aria-label': 'Переименовать', onclick: e => { e.stopPropagation(); renameBoard(b); } }, ic('edit')),
      h('button', { class: 'icon-btn sm danger', title: b.mine ? 'Удалить' : 'Покинуть доску', 'aria-label': b.mine ? 'Удалить' : 'Покинуть доску', onclick: e => { e.stopPropagation(); deleteBoard(b); } }, ic(b.mine ? 'trash' : 'logout'))));
    }

    let acct = null;
    if (me && me.local) {
      acct = h('div', { class: 'drawer-acct' },
        h('div', { class: 'acct-row' },
          avatar(me, 'lg'),
          h('div', { class: 'acct-meta' },
            h('span', { class: 'acct-name', text: 'Локальный режим' }),
            h('span', { class: 'acct-sub', text: 'Доски хранятся только в этом браузере' }))),
        h('p', { class: 'acct-note', text: 'Аккаунты, гостевой вход и общие доски заработают, если запустить server.js («node server.js») и открыть http://localhost:3000.' }));
    } else if (me) {
      acct = h('div', { class: 'drawer-acct' },
        h('div', { class: 'acct-row' },
          avatar(me, 'lg'),
          h('div', { class: 'acct-meta' },
            h('span', { class: 'acct-name', text: me.name }),
            h('span', { class: 'acct-sub', text: me.guest ? 'Гость — доски привязаны к этому браузеру' : me.email }))),
        me.guest
          ? h('div', { class: 'acct-actions' },
            h('button', { class: 'btn filled', onclick: () => { closeDrawer(); showAuth({ mode: 'register', upgrade: true }); } }, 'Регистрация'),
            h('button', { class: 'btn outlined', onclick: () => { closeDrawer(); showAuth({ mode: 'login', upgrade: true }); } }, 'Войти'))
          : h('div', { class: 'acct-actions' },
            h('button', { class: 'btn outlined', onclick: logout }, ic('logout'), 'Выйти')));
    }

    drawer.append(
      h('div', { class: 'drawer-head' },
        h('h2', { text: 'Мои доски' }),
        h('button', { class: 'icon-btn', 'aria-label': 'Закрыть', onclick: closeDrawer }, ic('close'))),
      h('button', { class: 'btn tonal drawer-new', onclick: newBoardDialog }, ic('plus'), 'Новая доска'),
      list,
      acct
    );
  }

  function newBoardDialog() {
    nameDialog({ title: 'Новая доска', value: 'Новая доска', ok: 'Создать' }, async name => {
      try {
        const b = await createBoard(name);
        closeDrawer();
        go(b.id);
      } catch (e) { M.toast(e.message); }
    });
  }

  async function createBoard(name, items) {
    const r = await api('POST', '/api/boards', { name, items: items || [] });
    return r.board;
  }

  function renameBoard(b) {
    nameDialog({ title: 'Переименовать доску', value: b.name, ok: 'Сохранить' }, async name => {
      try {
        await api('PATCH', '/api/boards/' + b.id, { name });
        b.name = name;
        if (cur && cur.id === b.id) { cur.name = name; M.setName(name); }
        renderDrawer();
      } catch (e) { M.toast(e.message); }
    });
  }

  function deleteBoard(b) {
    const mine = b.mine;
    confirmDialog({
      title: mine ? 'Удалить доску?' : 'Покинуть доску?',
      text: mine
        ? `Доска «${b.name}» исчезнет у всех участников. Это нельзя отменить.`
        : `Доска «${b.name}» пропадёт из вашего списка. Вернуться можно по ссылке.`,
      ok: mine ? 'Удалить' : 'Покинуть',
      danger: true
    }, async () => {
      try {
        await api('DELETE', '/api/boards/' + b.id);
        const wasCurrent = cur && cur.id === b.id;
        if (wasCurrent) { await settle(); cur = null; closeStream(); clearCursors(); }
        await loadBoards();
        M.toast(mine ? 'Доска удалена' : 'Вы покинули доску');
        if (wasCurrent) { history.replaceState(null, '', location.pathname); route(); }
      } catch (e) { M.toast(e.message); }
    });
  }

  /* ---------- «Поделиться» ---------- */
  $('#btnShare').addEventListener('click', shareDialog);

  function localShareDialog() {
    const m = modal([
      h('h2', { text: 'Совместная работа' }),
      h('p', { text: 'Сейчас доска работает в локальном режиме: все данные лежат только в этом браузере, поэтому поделиться ссылкой нельзя.' }),
      h('div', { class: 'note' }, 'Чтобы включить аккаунты, гостевой вход и общие доски, запустите сервер: откройте терминал в папке с файлами, выполните «node server.js» и перейдите на http://localhost:3000.'),
      h('p', { text: 'Доски из локального режима останутся здесь; их можно перенести через «Файл → Сохранить доску (.json)» и «Открыть доску».' }),
      h('div', { class: 'actions' }, h('button', { class: 'btn text', type: 'button', onclick: () => m.close() }, 'Понятно'))
    ]);
  }

  async function shareDialog() {
    if (local) return localShareDialog();
    if (!cur) return;
    const link = location.origin + '/#/b/' + cur.id;
    const linkField = field('Ссылка на доску', { type: 'text', readonly: true, value: link });
    const copyBtn = h('button', { class: 'btn filled', type: 'button' }, ic('copy'), 'Копировать');
    copyBtn.addEventListener('click', async () => {
      linkField.input.select();
      const ok = await copyText(link);
      copyBtn.replaceChildren(ic(ok ? 'check' : 'copy'), ok ? 'Скопировано' : 'Выделите и нажмите Ctrl+C');
      setTimeout(() => copyBtn.replaceChildren(ic('copy'), 'Копировать'), 1800);
    });
    linkField.input.addEventListener('focus', () => linkField.input.select());

    const members = h('div', { class: 'member-list' });
    const noteBox = h('div');
    const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

    const m = modal([
      h('h2', { text: 'Поделиться доской' }),
      h('p', { text: 'Любой, у кого есть эта ссылка, сможет открыть доску и редактировать её вместе с вами — даже зайдя гостем.' }),
      h('div', { class: 'copy-row' }, linkField.wrap, copyBtn),
      noteBox,
      h('h3', { text: 'Участники' }),
      members,
      h('div', { class: 'actions' }, h('button', { class: 'btn text', type: 'button', onclick: () => m.close() }, 'Готово'))
    ]);

    const renderMembers = list => {
      members.replaceChildren();
      const onlineIds = new Set(online.map(o => o.id));
      for (const u of list) {
        members.append(h('div', { class: 'member' },
          avatar(u, 'lg'),
          h('span', { class: 'member-name', text: u.name + (me && u.id === me.id ? ' (вы)' : '') }),
          u.id === (cur.owner && cur.owner.id) ? h('span', { class: 'tag', text: 'Владелец' }) : null,
          u.guest ? h('span', { class: 'tag muted', text: 'Гость' }) : null,
          onlineIds.has(u.id) ? h('span', { class: 'dot', title: 'Сейчас на доске' }) : null));
      }
    };
    renderMembers(cur.members || []);
    api('GET', '/api/boards/' + cur.id).then(d => { cur.members = d.members; cur.owner = d.owner; renderMembers(d.members); }).catch(() => {});

    if (isLocal) {
      noteBox.className = 'note';
      noteBox.append('Сейчас сайт открыт как localhost, поэтому эта ссылка работает только на этом компьютере. Чтобы пригласить других, разместите сервер в интернете или отправьте адрес из вашей сети:');
      if (!lan) { try { lan = (await api('GET', '/api/info')).lan; } catch (e) { lan = []; } }
      if (!lan.length) noteBox.append(' (адрес сети не найден).');
      for (const base of lan) {
        const full = base + '/#/b/' + cur.id;
        noteBox.append(h('div', { class: 'lan-link' },
          h('span', { text: full }),
          h('button', { class: 'btn text', type: 'button', onclick: async e => { const ok = await copyText(full); e.currentTarget.textContent = ok ? 'Скопировано' : 'Не вышло'; } }, 'Копировать')));
      }
    } else {
      noteBox.hidden = true;
    }
  }

  /* ---------- Индикатор сохранения и участники ---------- */
  function setSync(state) {
    const el = $('#sync');
    el.dataset.state = state;
    el.title = { ok: 'Сохранено', saving: 'Сохранение…', offline: 'Нет связи — пробуем снова' }[state];
  }

  function renderPresence() {
    const box = $('#presence');
    box.replaceChildren();
    const seen = new Set([me && me.id]);
    const others = [];
    for (const u of online) if (!seen.has(u.id)) { seen.add(u.id); others.push(u); }
    box.hidden = !others.length;
    others.slice(0, 3).forEach(u => box.append(avatar(u)));
    if (others.length > 3) box.append(h('span', { class: 'avatar more', text: '+' + (others.length - 3) }));
  }
  const hasOthers = () => online.some(u => u.cid !== clientId);

  /* ---------- Чужие курсоры ---------- */
  const placeCursor = c => {
    const v = M.getView();
    c.el.style.transform = `translate(${c.x * v.k + v.x}px, ${c.y * v.k + v.y}px)`;
  };
  function dropCursor(cid) {
    const c = cursors.get(cid);
    if (!c) return;
    clearTimeout(c.t);
    c.el.remove();
    cursors.delete(cid);
  }
  function clearCursors() { [...cursors.keys()].forEach(dropCursor); }
  function showCursor(d) {
    let c = cursors.get(d.cid);
    if (!c) {
      const pointer = h('span', { class: 'rcursor-ptr' });
      pointer.innerHTML = ARROW;
      const el = h('div', { class: 'rcursor' }, pointer, h('span', { class: 'rcursor-name', text: d.name }));
      el.style.setProperty('--c', d.color || '#6750A4');
      $('#cursors').appendChild(el);
      c = { el, x: 0, y: 0, t: null };
      cursors.set(d.cid, c);
    }
    c.x = d.x;
    c.y = d.y;
    placeCursor(c);
    clearTimeout(c.t);
    c.t = setTimeout(() => dropCursor(d.cid), 8000);
  }
  M.hooks.view = () => cursors.forEach(placeCursor);

  /* ---------- Синхронизация ---------- */
  function snapshot() {
    const s = Object.create(null);
    for (const it of M.getItems()) s[it.id] = JSON.stringify(it);
    lastSent = s;
    lastOrder = M.getItems().map(i => i.id).join(',');
  }

  function pushDiff() {
    if (!cur) return;
    const items = M.getItems();
    const set = [];
    const now = Object.create(null);
    for (const it of items) {
      const s = JSON.stringify(it);
      now[it.id] = s;
      if (lastSent[it.id] !== s) set.push(it);
    }
    const del = Object.keys(lastSent).filter(id => !(id in now));
    const ids = items.map(i => i.id);
    const ord = ids.join(',');
    const order = ord !== lastOrder ? ids : null;
    if (!set.length && !del.length && !order) return;
    lastSent = now;
    lastOrder = ord;
    post({ cid: clientId, set, del, order });
  }

  function post(payload) {
    const bid = cur.id;
    pending++;
    setSync('saving');
    chain = chain
      .then(() => api('POST', '/api/boards/' + bid + '/ops', payload))
      .then(() => { pending--; if (!pending) setSync('ok'); }, err => {
        pending--;
        if (err.status === 401) { me = null; showAuth({}); return; }
        setSync('offline');
        if (cur && cur.id === bid) {
          lastSent = Object.create(null);
          lastOrder = '';
          clearTimeout(retryTimer);
          retryTimer = setTimeout(pushDiff, 3000);
        }
      });
  }
  const settle = () => { pushDiff(); return chain.catch(() => {}); };

  let liveTimer = null;
  M.hooks.live = () => {
    if (liveTimer) return;
    liveTimer = setTimeout(() => { liveTimer = null; pushDiff(); }, 80);
  };
  M.hooks.change = () => {
    clearTimeout(liveTimer);
    liveTimer = null;
    pushDiff();
  };

  let cursorTimer = null;
  let lastPoint = null;
  M.hooks.cursor = p => {
    if (!cur || !hasOthers()) return;
    lastPoint = p;
    if (cursorTimer) return;
    cursorTimer = setTimeout(() => {
      cursorTimer = null;
      if (cur && lastPoint) api('POST', '/api/boards/' + cur.id + '/ops', { cid: clientId, cursor: lastPoint }).catch(() => {});
    }, 90);
  };

  let renameTimer = null;
  M.hooks.rename = name => {
    if (!cur) return;
    const id = cur.id;
    clearTimeout(renameTimer);
    renameTimer = setTimeout(async () => {
      try {
        const clean = name.trim() || 'Без названия';
        await api('PATCH', '/api/boards/' + id, { name: clean });
        const b = boards.find(x => x.id === id);
        if (b) { b.name = clean; if (drawer.classList.contains('open')) renderDrawer(); }
        if (cur && cur.id === id) cur.name = clean;
      } catch (e) { /* повторится при следующем изменении */ }
    }, 450);
  };

  function closeStream() {
    if (es) { es.close(); es = null; }
    clearTimeout(retryTimer);
  }

  function onRemote(d) {
    M.applyRemote(d);
    const byId = new Map(M.getItems().map(i => [i.id, i]));
    for (const it of d.set || []) if (byId.get(it.id) === it) lastSent[it.id] = JSON.stringify(it);
    for (const id of d.del || []) if (!byId.has(id)) delete lastSent[id];
    lastOrder = M.getItems().map(i => i.id).join(',');
  }

  async function resync() {
    if (!cur) return;
    try {
      const d = await api('GET', '/api/boards/' + cur.id);
      M.replaceItems(d.items, d.name);
      cur.name = d.name;
      cur.members = d.members;
      snapshot();
      setSync('ok');
    } catch (e) {
      if (e.status === 404) boardGone();
    }
  }

  function boardGone() {
    M.toast('Эту доску удалил владелец');
    cur = null;
    closeStream();
    clearCursors();
    online = [];
    renderPresence();
    history.replaceState(null, '', location.pathname);
    loadBoards().then(route);
  }

  function openStream() {
    if (local) return;
    const id = cur.id;
    let wasError = false;
    const src = new EventSource('api/boards/' + id + '/events?cid=' + clientId);
    es = src;
    src.onopen = () => {
      if (wasError) { wasError = false; resync(); } else setSync(pending ? 'saving' : 'ok');
    };
    src.onerror = () => {
      wasError = true;
      setSync('offline');
      if (src.readyState === EventSource.CLOSED) {
        setTimeout(() => { if (cur && cur.id === id && es === src) { closeStream(); openStream(); } }, 3000);
      }
    };
    src.addEventListener('ops', e => onRemote(JSON.parse(e.data)));
    src.addEventListener('cursor', e => showCursor(JSON.parse(e.data)));
    src.addEventListener('presence', e => {
      online = JSON.parse(e.data);
      renderPresence();
      const alive = new Set(online.map(u => u.cid));
      [...cursors.keys()].forEach(cid => { if (!alive.has(cid)) dropCursor(cid); });
    });
    src.addEventListener('rename', e => {
      const d = JSON.parse(e.data);
      if (!cur) return;
      cur.name = d.name;
      M.setName(d.name);
      const b = boards.find(x => x.id === cur.id);
      if (b) b.name = d.name;
    });
    src.addEventListener('deleted', boardGone);
  }

  /* ---------- Переходы между досками ---------- */
  function go(id) {
    const hash = '#/b/' + id;
    if (location.hash === hash) route();
    else location.hash = hash;
  }

  async function openBoard(id) {
    const seq = ++navSeq;
    if (cur) await settle();
    if (seq !== navSeq) return;
    closeStream();
    clearCursors();
    cur = null;
    online = [];
    renderPresence();
    setSync('saving');
    let d;
    try {
      d = await api('GET', '/api/boards/' + id);
    } catch (e) {
      if (seq !== navSeq) return;
      if (e.status === 401) { me = null; showAuth({ invited: true }); return; }
      M.toast(e.status === 404 ? 'Доска не найдена — возможно, её удалили' : e.message);
      setSync('ok');
      history.replaceState(null, '', location.pathname);
      route();
      return;
    }
    if (seq !== navSeq) return;
    cur = { id: d.id, name: d.name, mine: d.mine, owner: d.owner, members: d.members };
    M.open(d.id, d.name, d.items);
    snapshot();
    try { localStorage.setItem('meaw-last', d.id); } catch (e) { /* noop */ }
    openStream();
    setSync('ok');
    loadBoards();
  }

  async function route() {
    if (!me) return;
    const m = location.hash.match(/^#\/b\/([\w-]{1,24})$/);
    if (m) {
      if (cur && cur.id === m[1]) return;
      return openBoard(m[1]);
    }
    await loadBoards();
    let last = null;
    try { last = localStorage.getItem('meaw-last'); } catch (e) { /* noop */ }
    const pick = boards.find(b => b.id === last) || boards[0];
    if (pick) { location.replace('#/b/' + pick.id); return; }
    try {
      const b = await createBoard('Моя первая доска', M.seed());
      location.replace('#/b/' + b.id);
    } catch (e) { M.toast(e.message); }
  }
  window.addEventListener('hashchange', route);

  /* ---------- Запуск ---------- */
  async function start() {
    renderDrawer();
    try {
      me = (await api('GET', '/api/me')).user;
    } catch (e) {
      if (e.status === 0 || e.status === 404 || e.status === 405 || e.status >= 500) {
        // Сервера нет (например, index.html открыт двойным кликом) — работаем локально
        local = true;
        me = { id: 'local', name: 'Вы', guest: false, email: null, color: '#6750A4', local: true };
        renderDrawer();
        M.toast('Локальный режим: доски хранятся в этом браузере. Для аккаунтов и общих досок запустите server.js');
        route();
        return;
      }
      showAuth({ invited: /^#\/b\//.test(location.hash) });
      return;
    }
    renderDrawer();
    route();
  }

  window.addEventListener('online', () => { if (cur) { setSync('saving'); pushDiff(); } });
  start();
})();
