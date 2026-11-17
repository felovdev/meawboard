/* meaw board — приложение: главная, вход, доступ по ссылке, синхронизация */
(() => {
  'use strict';
  const B = window.meawBackend, MB = window.meawBoard, icon = MB.icon;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const BASE = location.origin + location.pathname.replace(/[^/]*$/, '');
  const ACCENTS = ['#6750a4', '#1e88e5', '#00897b', '#43a047', '#f4511e', '#d81b60', '#6d4c41', '#455a64'];

  function h(tag, p, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(p || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    const add = c => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else e.append(c.nodeType ? c : document.createTextNode(String(c))); };
    kids.forEach(add);
    return e;
  }
  const ic = n => h('span', { html: icon(n), style: 'display:contents' });
  const toast = m => MB.toast(m);
  const initial = n => (String(n || '?').trim()[0] || '?').toUpperCase();
  const ago = t => {
    if (!t) return '';
    const s = (Date.now() - t) / 1000;
    if (s < 60) return 'только что';
    if (s < 3600) return Math.floor(s / 60) + ' мин назад';
    if (s < 86400) return Math.floor(s / 3600) + ' ч назад';
    return new Date(t).toLocaleDateString('ru-RU');
  };

  /* ---------- Настройки (тема/акцент) ---------- */
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem('meaw-prefs') || '{}'); } catch (e) { /* noop */ }
  function applyPrefs() {
    const dark = prefs.theme === 'dark' || (prefs.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    if (prefs.accent) document.documentElement.style.setProperty('--accent', prefs.accent);
    MB.refreshLook();
  }
  function savePrefs(p) {
    prefs = Object.assign(prefs, p);
    try { localStorage.setItem('meaw-prefs', JSON.stringify(prefs)); } catch (e) { /* noop */ }
    applyPrefs();
    if (user && !user.guest) B.saveProfile({ prefs: { theme: prefs.theme || 'auto', accent: prefs.accent || '#6750a4' } }).catch(() => {});
  }

  /* ---------- Диалоги ---------- */
  let closeDlg = null;
  function dialog(title, body, foot, opts = {}) {
    if (closeDlg) closeDlg();
    const host = $('#dialogHost');
    const scrim = h('div', { class: 'scrim' });
    const dlg = h('div', { class: 'dialog' + (opts.wide ? ' wide' : ''), role: 'dialog' },
      h('div', { class: 'dlg-head' }, h('h2', { text: title }), h('button', { class: 'icon-btn', 'aria-label': 'Закрыть', html: icon('close'), onclick: () => closeDlg && closeDlg() })),
      opts.tabs || null,
      h('div', { class: 'dlg-body' }, body),
      foot ? h('div', { class: 'dlg-foot' }, foot) : null);
    scrim.append(dlg);
    scrim.addEventListener('pointerdown', e => { if (e.target === scrim) closeDlg && closeDlg(); });
    host.append(scrim);
    document.body.classList.add('modal-open');
    const onKey = e => { if (e.key === 'Escape') closeDlg && closeDlg(); };
    document.addEventListener('keydown', onKey);
    closeDlg = () => {
      scrim.remove();
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
      closeDlg = null;
      if (opts.onClose) opts.onClose();
    };
    return { dlg, close: () => closeDlg && closeDlg() };
  }
  const btn = (text, cls, fn, ico) => h('button', { class: 'btn ' + cls, type: 'button', onclick: fn }, ico ? ic(ico) : null, text);
  const field = (label, input) => h('label', { class: 'field' }, h('span', { text: label }), input);

  function confirmDlg(title, text, okText, danger) {
    return new Promise(res => {
      let done = false;
      const fin = v => { if (!done) { done = true; res(v); } };
      const d = dialog(title, h('div', { text }), [btn('Отмена', 'text', () => { fin(false); d.close(); }), btn(okText, 'filled' + (danger ? ' danger' : ''), () => { fin(true); d.close(); })], { onClose: () => fin(false) });
    });
  }

  /* ---------- Состояние ---------- */
  let user = null;
  let profile = null;
  let route = { v: 'home' };
  let session = null;
  let boardStop = [];
  const cardStops = new Map();
  let homeList = [];
  let cards = {};
  let tab = 'all';
  let query = '';
  let pendingAfterAuth = null;

  /* ---------- Вход / регистрация ---------- */
  function authDialog(opts = {}) {
    return new Promise(res => {
      let mode = opts.mode || 'in';
      let finished = false;
      const fin = v => { if (!finished) { finished = true; res(v); } };
      const err = h('div', { class: 'err' });
      const name = h('input', { type: 'text', maxlength: 40, autocomplete: 'name' });
      const email = h('input', { type: 'email', autocomplete: 'email' });
      const pass = h('input', { type: 'password', autocomplete: mode === 'up' ? 'new-password' : 'current-password' });
      const body = h('div', { style: 'display:contents' });
      const foot = h('div', { style: 'display:contents' });
      const run = async fn => {
        err.textContent = '';
        try { const u = await fn(); fin(u || true); d.close(); } catch (e) { err.textContent = e.message || 'Ошибка'; }
      };
      const draw = () => {
        const up = mode === 'up';
        body.replaceChildren(
          opts.note ? h('div', { class: 'dlg-note', text: opts.note }) : null,
          B.providers.google ? btn('Войти через Google', 'outlined block gbtn', () => run(() => B.signInProvider('google')), 'globe') : null,
          B.providers.github ? btn('Войти через GitHub', 'outlined block gbtn', () => run(() => B.signInProvider('github')), 'globe') : null,
          B.providers.google || B.providers.github ? h('div', { class: 'divider', text: 'или по email' }) : null,
          up ? field('Имя', name) : null, field('Email', email), field('Пароль', pass), err);
        foot.replaceChildren(
          !up ? btn('Забыли пароль?', 'text grow', () => run(async () => { if (!email.value.trim()) throw new Error('Введите email'); await B.resetPassword(email.value); toast('Письмо для сброса отправлено'); return null; })) : null,
          btn(up ? 'Есть аккаунт' : 'Создать аккаунт', 'text', () => { mode = up ? 'in' : 'up'; draw(); }),
          btn(up ? 'Зарегистрироваться' : 'Войти', 'filled', () => run(() => up ? B.signUp({ name: name.value, email: email.value, password: pass.value }) : B.signIn({ email: email.value, password: pass.value }))));
      };
      const guestBtn = !opts.noGuest ? btn('Войти гостем', 'text', () => run(() => B.signInGuest())) : null;
      const d = dialog(opts.title || 'Вход в meaw board', [body], [guestBtn, foot], { onClose: () => fin(false) });
      draw();
      d.dlg.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') d.dlg.querySelector('.btn.filled').click(); });
    });
  }

  /* ---------- Аккаунт и настройки ---------- */
  function cursorCssFrom(img) {
    if (!img) return null;
    return `url("${img}") 4 4, auto`;
  }
  async function pickCursor() {
    return new Promise((res, rej) => {
      const inp = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
      inp.onchange = async () => {
        try {
          const f = inp.files[0];
          if (!f) return res(null);
          const src = await new Promise((a, b) => { const r = new FileReader(); r.onload = () => a(r.result); r.onerror = b; r.readAsDataURL(f); });
          const im = await new Promise((a, b) => { const i = new Image(); i.onload = () => a(i); i.onerror = b; i.src = src; });
          const s = Math.min(1, 32 / Math.max(im.naturalWidth, im.naturalHeight));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(im.naturalWidth * s)); c.height = Math.max(1, Math.round(im.naturalHeight * s));
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          res(c.toDataURL('image/png'));
        } catch (e) { rej(new Error('Не удалось открыть картинку')); }
        inp.remove();
      };
      document.body.append(inp);
      inp.click();
    });
  }

  function settingsDialog() {
    if (!user) return authDialog();
    const p = profile || {};
    const cur = p.cursor || {};
    let cursorImg = cur.image || null;
    const nameI = h('input', { type: 'text', maxlength: 40, value: user.name });
    const preview = h('div', { class: 'box' });
    const drawPrev = () => { preview.replaceChildren(cursorImg ? h('img', { src: cursorImg, alt: '' }) : h('span', { html: icon('select'), style: 'color:var(--primary)' })); };
    drawPrev();
    const themeSeg = h('div', { class: 'seg' });
    const drawTheme = () => {
      themeSeg.replaceChildren(...[['Авто', 'auto'], ['Светлая', 'light'], ['Тёмная', 'dark']].map(([n, v]) =>
        h('button', { type: 'button', class: (prefs.theme || 'auto') === v ? 'on' : '', text: n, onclick: () => { savePrefs({ theme: v }); drawTheme(); } })));
    };
    drawTheme();
    const accRow = h('div', { class: 'accent-row' });
    const drawAcc = () => {
      accRow.replaceChildren(...ACCENTS.map(c => h('button', { type: 'button', class: 'swatch' + ((prefs.accent || '#6750a4') === c ? ' on' : ''), style: 'background:' + c, 'aria-label': c, onclick: () => { savePrefs({ accent: c }); drawAcc(); } })));
      const inp = h('input', { type: 'color', value: prefs.accent || '#6750a4' });
      inp.onchange = () => { savePrefs({ accent: inp.value }); drawAcc(); };
      accRow.append(h('label', { class: 'swatch custom', title: 'Свой цвет' }, inp));
    };
    drawAcc();
    const colorI = h('input', { type: 'color', value: p.color || '#1e88e5', style: 'width:48px;height:36px;border:0;background:none' });
    const body = [
      user.guest ? h('div', { class: 'dlg-note', text: 'Вы вошли как гость. Зарегистрируйтесь, чтобы доски не потерялись на другом устройстве.' }) : (user.email ? h('div', { class: 'dlg-note', text: user.email }) : null),
      field('Имя', nameI),
      h('div', { class: 'mini-title', text: 'Оформление сайта' }), themeSeg, accRow,
      h('div', { class: 'mini-title', text: 'Ваш курсор (его видят другие)' }),
      h('div', { class: 'cursor-preview' }, preview, h('div', { style: 'display:flex;flex-direction:column;gap:8px' },
        btn('Загрузить картинку', 'tonal', async () => { try { const u = await pickCursor(); if (u) { cursorImg = u; drawPrev(); } } catch (e) { toast(e.message); } }, 'upload'),
        btn('Убрать', 'text', () => { cursorImg = null; drawPrev(); }))),
      h('div', { class: 'pp-row' }, h('span', { text: 'Цвет метки курсора' }), colorI)
    ];
    const d = dialog('Профиль и настройки', body, [
      user.guest ? btn('Регистрация', 'text', async () => { d.close(); await authDialog({ mode: 'up', title: 'Регистрация', note: 'Ваши доски гостя сохранятся.', noGuest: true }); }) : null,
      btn('Выйти', 'text danger', async () => { d.close(); await B.signOut(); }),
      btn('Сохранить', 'filled', async () => {
        try {
          await B.saveProfile({ name: nameI.value, color: colorI.value, cursor: cursorImg ? { image: cursorImg } : null });
          d.close(); toast('Сохранено');
        } catch (e) { toast(e.message); }
      })]);
  }

  function renderAccountBtns() {
    for (const b of $$('.account-btn')) {
      b.className = 'account-btn' + (user ? '' : ' signin');
      b.style.backgroundImage = '';
      b.textContent = user ? initial(user.name) : 'Войти';
      if (user) b.style.background = (profile && profile.color) || '';
      else b.style.background = '';
      b.title = user ? user.name : 'Войти';
    }
  }
  $$('.account-btn').forEach(b => b.addEventListener('click', () => (user ? settingsDialog() : authDialog())));

  /* ---------- Главная ---------- */
  function stopCards() { cardStops.forEach(f => f()); cardStops.clear(); }
  function drawHome() {
    const grid = $('#homeGrid'), empty = $('#homeEmpty');
    $('#demoBanner').hidden = B.mode !== 'local';
    $('#homeHello').textContent = user ? (user.guest ? 'Доски гостя' : 'Доски: ' + user.name) : 'meaw board';
    $('#homeTabs').hidden = !user;
    $('#homeSearch').closest('.search').style.visibility = user ? '' : 'hidden';
    $('#fabNew').hidden = !user;
    grid.replaceChildren();
    if (!user) {
      empty.hidden = false;
      empty.replaceChildren(h('h2', { text: 'Онлайн-доска для идей' }), h('p', { text: 'Стикеры, фигуры, рисунки и картинки на бесконечном холсте. Работайте вместе по ссылке.' }),
        h('div', { style: 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:18px' },
          btn('Войти или зарегистрироваться', 'filled', () => authDialog()), btn('Попробовать как гость', 'tonal', () => B.signInGuest())));
      return;
    }
    let list = homeList.map(x => cards[x.id] || { id: x.id, name: '…', role: x.role, loading: true });
    if (tab === 'mine') list = list.filter(c => c.role === 'owner');
    if (tab === 'shared') list = list.filter(c => c.role !== 'owner');
    if (query) list = list.filter(c => (c.name || '').toLowerCase().includes(query));
    list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (tab !== 'shared' && !query) grid.append(h('div', { class: 'card new' }, h('button', { class: 'card-open', onclick: () => newBoard() }, ic('plus'), 'Новая доска')));
    for (const c of list) grid.append(cardEl(c));
    empty.hidden = list.length > 0 || tab === 'all' && !query;
    if (!empty.hidden) { empty.replaceChildren(h('h2', { text: query ? 'Ничего не найдено' : tab === 'shared' ? 'Пока нет досок, к которым вам дали доступ' : 'Здесь пусто' }), h('p', { text: tab === 'shared' ? 'Откройте ссылку-приглашение — доска появится здесь.' : '' })); }
  }

  function cardEl(c) {
    const thumb = h('div', { class: 'card-thumb' }, c.thumb ? null : ic('board'));
    if (c.thumb) thumb.style.backgroundImage = `url("${c.thumb}")`;
    const owner = c.role === 'owner';
    const card = h('div', { class: 'card' },
      h('button', { class: 'card-open', onclick: () => go('#/b/' + c.id) }, thumb,
        h('div', { class: 'card-info' }, h('div', { class: 'card-name', text: c.name }),
          h('div', { class: 'card-sub' },
            owner ? h('span', { class: 'badge', html: (c.shared ? icon('users') : icon('lock')) + (c.shared ? 'По ссылке' : 'Приватная') }) : h('span', { class: 'badge', text: (c.role === 'viewer' ? 'Просмотр · ' : 'Редактор · ') + (c.ownerName || '') }),
            h('span', { text: ago(c.updatedAt) })))),
      h('button', { class: 'icon-btn sm card-more', 'aria-label': 'Действия', html: icon('more'), onclick: e => { e.stopPropagation(); cardMenu(c, e.currentTarget); } }));
    return card;
  }

  function cardMenu(c, anchor) {
    $$('.ctx').forEach(x => x.remove());
    const owner = c.role === 'owner';
    const m = h('div', { class: 'menu ctx', style: 'top:44px;right:8px;z-index:9' },
      h('button', { class: 'menu-item', onclick: () => go('#/b/' + c.id) }, ic('board'), 'Открыть'),
      owner ? h('button', { class: 'menu-item', onclick: () => renameDlg(c) }, ic('edit'), 'Переименовать') : null,
      owner ? h('button', { class: 'menu-item', onclick: () => shareDlg(c.id, c.name) }, ic('share'), 'Доступ') : null,
      h('button', { class: 'menu-item', onclick: async () => {
        m.remove();
        const ok = await confirmDlg(owner ? 'Удалить доску?' : 'Убрать доску?', owner ? `«${c.name}» удалится у всех участников без возможности восстановления.` : `«${c.name}» пропадёт из вашего списка. Вернуться можно по ссылке.`, owner ? 'Удалить' : 'Убрать', true);
        if (!ok) return;
        try { owner ? await B.deleteBoard(c.id) : await B.leaveBoard(c.id); toast(owner ? 'Доска удалена' : 'Доска убрана'); } catch (e) { toast(e.message); }
      } }, ic('trash'), owner ? 'Удалить' : 'Убрать из списка'));
    anchor.closest('.card').append(m);
    const off = e => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('pointerdown', off, true); } };
    setTimeout(() => document.addEventListener('pointerdown', off, true), 0);
    m.addEventListener('click', () => m.remove());
  }

  function renameDlg(c) {
    const i = h('input', { type: 'text', maxlength: 80, value: c.name });
    const d = dialog('Переименовать', [field('Название', i)], [btn('Отмена', 'text', () => d.close()), btn('Сохранить', 'filled', async () => { try { await B.renameBoard(c.id, i.value); d.close(); } catch (e) { toast(e.message); } })]);
    setTimeout(() => { i.focus(); i.select(); }, 30);
    i.addEventListener('keydown', e => { if (e.key === 'Enter') d.dlg.querySelector('.btn.filled').click(); });
  }

  async function newBoard() {
    if (!user) { await authDialog(); if (!user) return; }
    try {
      const id = await B.createBoard({ name: 'Новая доска', items: [] });
      go('#/b/' + id);
    } catch (e) { toast(e.message); }
  }
  $('#fabNew').addEventListener('click', newBoard);
  $('#homeSearch').addEventListener('input', e => { query = e.target.value.trim().toLowerCase(); drawHome(); });
  $$('#homeTabs .tab').forEach(t => t.addEventListener('click', () => { tab = t.dataset.tab; $$('#homeTabs .tab').forEach(x => x.classList.toggle('on', x === t)); drawHome(); }));

  let stopBoards = null;
  function watchHome() {
    if (stopBoards) { stopBoards(); stopBoards = null; }
    stopCards(); cards = {}; homeList = [];
    drawHome();
    if (!user) return;
    stopBoards = B.watchBoards(list => {
      homeList = list || [];
      const ids = new Set(homeList.map(x => x.id));
      for (const [id, f] of cardStops) if (!ids.has(id)) { f(); cardStops.delete(id); delete cards[id]; }
      for (const x of homeList) {
        if (cardStops.has(x.id)) continue;
        cardStops.set(x.id, B.watchCard(x.id, c => { if (c) cards[x.id] = c; else delete cards[x.id]; if (route.v === 'home') drawHome(); }));
      }
      drawHome();
    });
  }

  /* ---------- Маршрутизация ---------- */
  function go(hash) { if (location.hash === hash) onRoute(); else location.hash = hash; }
  function parse() {
    const m = /^#\/(b|j)\/([A-Za-z0-9_-]+)/.exec(location.hash);
    return m ? { v: m[1] === 'b' ? 'board' : 'join', id: m[2] } : { v: 'home' };
  }
  window.addEventListener('hashchange', onRoute);

  async function onRoute() {
    const r = parse();
    await leaveBoard();
    route = r;
    document.body.dataset.view = r.v;
    if (r.v === 'home') { document.title = 'meaw board'; watchHome(); }
    else if (r.v === 'join') showJoin(r.id);
    else { if (!user) { document.body.dataset.view = 'home'; route = { v: 'home' }; pendingAfterAuth = location.hash; watchHome(); return; } openBoard(r.id); }
  }

  async function showJoin(token) {
    const card = $('#joinCard');
    card.replaceChildren(h('div', { class: 'logo' }, h('span', { class: 'logo-mark' }), h('span', { text: 'meaw board' })), h('p', { text: 'Проверяю ссылку…' }));
    let inv = null;
    try { inv = await B.resolveInvite(token); } catch (e) { /* noop */ }
    const logo = h('div', { class: 'logo' }, h('span', { class: 'logo-mark' }), h('span', { text: 'meaw board' }));
    if (!inv) {
      card.replaceChildren(logo, h('h1', { text: 'Ссылка не работает' }), h('p', { text: 'Она недействительна или владелец отключил доступ.' }), btn('На главную', 'filled block', () => go('#/')));
      return;
    }
    const join = async () => {
      try { const id = await B.joinInvite(token); toast('Доска добавлена в ваш список'); go('#/b/' + id); } catch (e) { toast(e.message); }
    };
    card.replaceChildren(logo,
      h('h1', { text: inv.name || 'Доска' }),
      h('p', { text: `${inv.ownerName ? inv.ownerName + ' приглашает вас' : 'Вас приглашают'} ${inv.role === 'view' ? 'посмотреть' : 'работать над'} доской. После входа она появится в вашем списке.` }),
      user ? btn('Открыть доску', 'filled block', join) : [btn('Войти и открыть', 'filled block', async () => { await authDialog({ noGuest: true }); if (user) join(); }), btn('Открыть как гость', 'tonal block', async () => { await B.signInGuest(); join(); })]);
  }

  /* ---------- Доска ---------- */
  const remote = new Map();
  const profiles = new Map();
  let sent = new Map();
  let sendTimer = null;
  let curMeta = null;
  let lastCur = 0;
  let thumbTimer = null;

  function setSync(s) { const d = $('#sync'); d.className = 'sync' + (s ? ' ' + s : ''); d.title = s === 'busy' ? 'Сохраняю…' : s === 'off' ? 'Нет связи' : 'Сохранено'; }

  function pushItems() {
    if (!session || session.role === 'viewer') return;
    const items = MB.getItems(), set = [], del = [];
    const now = new Map();
    for (const it of items) {
      const s = JSON.stringify(it);
      now.set(it.id, s);
      if (sent.get(it.id) !== s) set.push(JSON.parse(s));
    }
    for (const id of sent.keys()) if (!now.has(id)) del.push(id);
    if (!set.length && !del.length) { setSync(''); return; }
    try {
      const r = session.writeItems({ set, del });
      sent = now;
      Promise.resolve(r).then(() => setSync(''), () => setSync('off'));
    } catch (e) { setSync('off'); toast(e.message); return; }
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(async () => { if (session) { const t = await MB.exportThumb(); if (t && session) session.setThumb(t); } }, 4000);
  }
  function schedulePush(delay) {
    if (!session || session.role === 'viewer') return;
    setSync('busy');
    if (sendTimer && delay > 0) return;
    clearTimeout(sendTimer);
    sendTimer = setTimeout(() => { sendTimer = null; pushItems(); }, delay);
  }
  MB.hooks.change = () => schedulePush(120);
  MB.hooks.live = () => schedulePush(160);
  MB.hooks.needImage = async id => {
    if (!session) return;
    try { const u = await session.getImage(id); if (u) MB.setImage(id, u); } catch (e) { /* noop */ }
  };
  MB.hooks.putImage = (id, url) => (session ? session.putImage(id, url) : Promise.reject(new Error('Доска закрыта')));
  MB.hooks.rename = name => {
    if (!session || session.role !== 'owner') return;
    clearTimeout(MB.hooks._rt);
    MB.hooks._rt = setTimeout(() => B.renameBoard(session.id, name).catch(() => {}), 500);
  };
  MB.hooks.cursor = p => {
    if (!session) return;
    const n = Date.now();
    if (n - lastCur < 60) return;
    lastCur = n;
    session.setPresence({ x: Math.round(p.x), y: Math.round(p.y) });
  };
  MB.hooks.view = () => drawRemote();
  MB.hooks.menu = act => { if (act === 'close') return; };

  async function openBoard(id) {
    setSync('busy');
    const handlers = {
      onItems: ops => MB.applyRemote(ops),
      onMeta: meta => applyMeta(meta),
      onMembers: list => { members = list; drawPresence(); },
      onPresence: list => { for (const [k] of remote) if (!list.find(x => x.uid === k)) remote.delete(k); list.forEach(x => { if (x.uid !== user.uid) remote.set(x.uid, x); }); loadProfiles(); drawRemote(); drawPresence(); },
      onRevoked: () => { toast('Доступ к доске закрыт'); go('#/'); }
    };
    let s;
    try { s = await B.openBoard(id, handlers); } catch (e) {
      document.body.dataset.view = 'home'; route = { v: 'home' };
      watchHome();
      toast(e.code === 'denied' ? 'Нет доступа к этой доске. Попросите владельца прислать ссылку.' : e.message);
      history.replaceState(null, '', '#/');
      return;
    }
    if (route.id !== id) { s.close(); return; }
    session = s;
    sent = new Map(s.items.map(i => [i.id, JSON.stringify(i)]));
    MB.open(id, s.meta.name, s.items, { readOnly: s.role === 'viewer' });
    MB.setNameEditable(s.role === 'owner');
    applyMeta(s.meta);
    $('#viewerNote').hidden = s.role !== 'viewer';
    $('#btnShare').hidden = s.role !== 'owner';
    $('#btnLook').hidden = s.role !== 'owner';
    $('#menu [data-act="open"]').hidden = $('#menu [data-act="clear"]').hidden = s.role === 'viewer';
    setSync('');
    if (s.role === 'owner' && !s.items.length && !localStorage.getItem('meaw-seeded-' + id)) {
      try { localStorage.setItem('meaw-seeded-' + id, '1'); } catch (e) { /* noop */ }
      MB.replaceItems(MB.seed());
      pushItems();
      MB.centerOnContent();
    }
    if (pendingAfterAuth) pendingAfterAuth = null;
  }
  let members = [];

  function applyMeta(meta) {
    curMeta = meta;
    MB.setName(meta.name);
    MB.setLook({ bg: meta.bg || null, grid: meta.grid || 'dots', size: meta.gridSize || 24 });
  }

  async function leaveBoard() {
    if (!session) return;
    clearTimeout(sendTimer); clearTimeout(thumbTimer);
    sendTimer = null;
    try { pushItems(); } catch (e) { /* noop */ }
    const s = session;
    try { const t = await MB.exportThumb(); if (t) s.setThumb(t); } catch (e) { /* noop */ }
    session = null;
    MB.saveView();
    s.setPresence(null);
    s.close();
    MB.close();
    remote.clear();
    $('#cursors').replaceChildren();
    $('#presence').replaceChildren();
  }
  window.addEventListener('beforeunload', () => { try { if (session) pushItems(); } catch (e) { /* noop */ } });
  $('#btnHome').addEventListener('click', () => go('#/'));

  /* Курсоры и участники */
  function loadProfiles() {
    for (const uid of remote.keys()) {
      if (profiles.has(uid)) continue;
      profiles.set(uid, { name: '…', color: '#888' });
      B.getProfile(uid).then(p => { if (p) { profiles.set(uid, p); drawRemote(); drawPresence(); } }).catch(() => {});
    }
  }
  function drawRemote() {
    const box = $('#cursors');
    if (!session) return;
    const v = MB.getView();
    const seen = new Set();
    for (const [uid, p] of remote) {
      if (typeof p.x !== 'number') continue;
      seen.add(uid);
      const pr = profiles.get(uid) || {};
      let n = box.querySelector(`[data-u="${uid}"]`);
      if (!n) {
        n = h('div', { class: 'rc', 'data-u': uid });
        box.append(n);
      }
      const img = pr.cursor && pr.cursor.image;
      const key = (img || '') + '|' + pr.name + '|' + pr.color;
      if (n.dataset.k !== key) {
        n.dataset.k = key;
        n.replaceChildren(
          img ? h('img', { class: 'rc-pic', src: img, alt: '', style: 'max-width:32px;max-height:32px' })
            : h('span', { class: 'rc-pic', html: `<svg width="20" height="22" viewBox="0 0 20 22"><path d="M2 1l15 9-6.5 1.8L8 19z" fill="${pr.color || '#e53935'}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>` }),
          h('span', { class: 'rc-name', text: pr.name || '…', style: 'background:' + (pr.color || '#e53935') }));
      }
      n.style.transform = `translate(${p.x * v.k + v.x}px, ${p.y * v.k + v.y}px)`;
    }
    $$('.rc', box).forEach(n => { if (!seen.has(n.dataset.u)) n.remove(); });
  }
  function drawPresence() {
    const box = $('#presence');
    box.replaceChildren();
    const list = [...remote.keys()];
    list.slice(0, 4).forEach(uid => {
      const pr = profiles.get(uid) || {};
      const a = h('div', { class: 'avatar', title: pr.name || '', text: initial(pr.name), style: 'background-color:' + (pr.color || '#888') });
      if (pr.cursor && pr.cursor.image) { a.textContent = ''; a.style.backgroundImage = `url("${pr.cursor.image}")`; a.style.backgroundSize = 'contain'; a.style.backgroundRepeat = 'no-repeat'; }
      box.append(a);
    });
    if (list.length > 4) box.append(h('div', { class: 'avatar more', text: '+' + (list.length - 4) }));
  }

  /* ---------- Доступ ---------- */
  function shareDlg(id, name) {
    const cardRole = (cards[id] && cards[id].role) || (session && session.id === id && session.role);
    if (cardRole && cardRole !== 'owner') return toast('Доступом управляет владелец');
    let inv = null;
    const body = h('div', { style: 'display:contents' });
    const draw = async () => {
      try { inv = await B.getInvite(id); } catch (e) { inv = null; }
      const link = inv ? (B.mode === 'local' || location.protocol === 'file:' ? BASE + '#/j/' : BASE) + inv.token : '';
      const priv = !inv;
      body.replaceChildren(
        h('button', { class: 'choice' + (priv ? ' on' : ''), onclick: async () => { if (inv) { try { await B.removeInvite(id); toast('Доска снова приватная'); } catch (e) { toast(e.message); } draw(); } } },
          ic('lock'), h('div', {}, h('b', { text: 'Приватная' }), h('span', { text: 'Войти может только владелец и те, кто уже получил доступ.' }))),
        h('button', { class: 'choice' + (!priv ? ' on' : ''), onclick: async () => { if (!inv) { try { await B.setInvite(id, 'edit'); } catch (e) { toast(e.message); } draw(); } } },
          ic('link'), h('div', {}, h('b', { text: 'Доступ по ссылке' }), h('span', { text: 'Любой, у кого есть ссылка, добавит доску к себе и будет видеть её в своём списке.' }))),
        ...(!priv ? [
          h('div', { class: 'linkbox' }, h('input', { type: 'text', readonly: true, value: link, onclick: e => e.target.select() }),
            btn('Копировать', 'tonal', async () => { try { await navigator.clipboard.writeText(link); toast('Ссылка скопирована'); } catch (e) { toast('Выделите и скопируйте вручную'); } }, 'copy')),
          h('div', { class: 'field' }, h('span', { text: 'Что можно по ссылке' }),
            h('div', { class: 'seg', style: 'align-self:flex-start' }, ...[['Редактировать', 'edit'], ['Только смотреть', 'view']].map(([n, r]) =>
              h('button', { type: 'button', class: inv.role === r ? 'on' : '', text: n, onclick: async () => { if (inv.role === r) return; try { await B.setInvite(id, r); toast('Создана новая ссылка — старая больше не работает'); } catch (e) { toast(e.message); } draw(); } })))),
          btn('Сделать новую ссылку', 'text', async () => { try { await B.setInvite(id, inv.role); toast('Старая ссылка отключена'); } catch (e) { toast(e.message); } draw(); }, 'refresh')
        ] : []),
        h('div', { class: 'mini-title', text: 'Участники' }), h('div', { id: 'memList' }));
      drawMembers();
    };
    const drawMembers = async () => {
      const box = $('#memList');
      if (!box) return;
      const list = (session && session.id === id ? members : []);
      box.replaceChildren(...list.map(m => h('div', { class: 'member' },
        h('div', { class: 'avatar', text: initial(m.name), style: 'background:' + ((profiles.get(m.uid) || {}).color || '#7e57c2') }),
        h('div', { class: 'member-name', text: m.name + (m.uid === user.uid ? ' (вы)' : '') }),
        h('span', { class: 'role-tag', text: m.role === 'owner' ? 'владелец' : m.role === 'editor' ? 'редактор' : 'просмотр' }),
        m.role !== 'owner' ? h('button', { class: 'icon-btn sm danger', 'aria-label': 'Убрать', html: icon('close'), onclick: async () => { try { await B.removeMember(id, m.uid); toast('Участник убран'); } catch (e) { toast(e.message); } } }) : null)));
      if (!list.length) box.append(h('div', { class: 'dlg-note', text: 'Откройте доску, чтобы увидеть участников.' }));
    };
    const d = dialog('Доступ к «' + name + '»', [body], [btn('Готово', 'filled', () => d.close())], { wide: true, onClose: () => { memberRedraw = null; } });
    memberRedraw = drawMembers;
    draw();
  }
  let memberRedraw = null;
  const _om = Object.getOwnPropertyDescriptor;
  void _om;
  const origDrawPresence = drawPresence;
  void origDrawPresence;
  $('#btnShare').addEventListener('click', () => { if (session) shareDlg(session.id, curMeta ? curMeta.name : ''); });
  setInterval(() => { if (memberRedraw) memberRedraw(); }, 1500);

  /* ---------- Оформление доски ---------- */
  const BGS = [null, '#FFFFFF', '#FFF8E1', '#E8F5E9', '#E3F2FD', '#FCE4EC', '#ECEFF1', '#263238', '#121212'];
  $('#btnLook').addEventListener('click', () => {
    if (!session || session.role !== 'owner') return;
    const l = () => MB.getLook();
    const set = p => { MB.setLook(Object.assign({}, l(), p)); const m = {}; if ('bg' in p) m.bg = p.bg || ''; if ('grid' in p) m.grid = p.grid; if ('size' in p) m.gridSize = p.size; try { session.setSettings(m); } catch (e) { toast(e.message); } draw(); };
    const body = h('div', { style: 'display:contents' });
    const draw = () => {
      body.replaceChildren(
        h('div', { class: 'mini-title', text: 'Фон' }),
        h('div', { class: 'accent-row' }, ...BGS.map(c => h('button', { type: 'button', class: 'swatch' + ((l().bg || null) === c ? ' on' : '') + (c ? '' : ' auto'), style: c ? 'background:' + c : '', title: c || 'Как в теме', onclick: () => set({ bg: c }) })),
          h('label', { class: 'swatch custom' }, h('input', { type: 'color', value: l().bg || '#ffffff', onchange: e => set({ bg: e.target.value }) }))),
        h('div', { class: 'mini-title', text: 'Сетка' }),
        h('div', { class: 'seg', style: 'align-self:flex-start' }, ...[['Точки', 'dots'], ['Линии', 'lines'], ['Без сетки', 'none']].map(([n, v]) => h('button', { type: 'button', class: l().grid === v ? 'on' : '', text: n, onclick: () => set({ grid: v }) }))),
        h('label', { class: 'field' }, h('span', { text: 'Шаг сетки: ' + (l().size || 24) }), h('input', { type: 'range', min: 8, max: 80, step: 4, value: l().size || 24, oninput: e => { MB.setLook(Object.assign({}, l(), { size: +e.target.value })); }, onchange: e => set({ size: +e.target.value }) })));
    };
    const d = dialog('Оформление доски', [body], [btn('Готово', 'filled', () => d.close())]);
    draw();
  });

  /* ---------- Авторизация: события ---------- */
  let profStop = null;
  let firstAuth = true;
  B.onAuthChange(async u => {
    const prev = user;
    const first = firstAuth; firstAuth = false;
    user = u;
    if (profStop) { profStop(); profStop = null; }
    profile = null;
    renderAccountBtns();
    if (u) {
      profStop = B.watchProfile(u.uid, p => {
        profile = p;
        renderAccountBtns();
        MB.setCursorCss(p && p.cursor && p.cursor.image ? cursorCssFrom(p.cursor.image) : null);
        if (p && p.prefs && !localStorage.getItem('meaw-prefs')) { prefs = Object.assign({}, p.prefs); applyPrefs(); }
      });
    } else MB.setCursorCss(null);
    if (first || !prev !== !u || (prev && u && prev.uid !== u.uid)) {
      if (!u && session) { await leaveBoard(); }
      const hsh = pendingAfterAuth || location.hash;
      pendingAfterAuth = null;
      if (hsh && hsh !== location.hash) location.hash = hsh; else onRoute();
    }
  });

  window.addEventListener('keydown', e => { if (e.key === 'Escape') { $$('.ctx').forEach(x => x.remove()); } });
  Promise.resolve(B.ready).finally(() => { applyPrefs(); });
})();
