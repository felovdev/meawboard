/* meaw board — демо-хранилище.
   Всё лежит в localStorage этого браузера и повторяет поведение облачного слоя
   (backend-firebase.js): аккаунты, роли, приватность, ссылки-приглашения, реальное время
   между вкладками. Нужен, пока Firebase не подключён (см. SETUP.md). */
(() => {
  'use strict';

  const KEY = 'meaw-local-db-v2';
  const SES = 'meaw-local-uid';
  const COLORS = ['#E53935', '#8E24AA', '#3949AB', '#1E88E5', '#00897B', '#43A047', '#F4511E', '#6D4C41', '#D81B60', '#5E35B1'];
  const ALNUM = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  const rid = n => {
    const a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return Array.from(a, b => ALNUM[b % 62]).join('');
  };
  const colorFor = id => COLORS[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % COLORS.length];
  const fail = (message, code) => Object.assign(new Error(message), { code });
  const clone = v => JSON.parse(JSON.stringify(v));

  /* ---------- Хранилище ---------- */
  const empty = () => ({ users: {}, accounts: {}, boards: {}, invites: {}, userBoards: {} });
  let cacheRaw = null;
  let cache = null;
  function read() {
    const raw = localStorage.getItem(KEY);
    if (raw !== null && raw === cacheRaw && cache) return cache;
    let d = null;
    try { d = JSON.parse(raw); } catch (e) { /* пусто */ }
    cache = d && d.boards ? d : empty();
    cacheRaw = raw;
    return cache;
  }
  const watchers = new Set();
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('meaw-local') : null;
  function fire() { watchers.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }
  function write(d) {
    const raw = JSON.stringify(d);
    try { localStorage.setItem(KEY, raw); }
    catch (e) {
      cache = null; cacheRaw = null;
      throw fail('Хранилище браузера переполнено. Подключите Firebase (SETUP.md) или удалите лишние картинки и доски.', 'quota');
    }
    cache = d; cacheRaw = raw;
    fire();
    if (bc) bc.postMessage(1);
  }
  if (bc) bc.onmessage = () => fire();
  window.addEventListener('storage', e => { if (e.key === KEY) fire(); });

  function watch(compute, cb) {
    let prev;
    const run = () => {
      let v = null;
      try { v = compute(read()); } catch (e) { v = null; }
      const s = JSON.stringify(v === undefined ? null : v);
      if (s !== prev) { prev = s; cb(v === undefined ? null : v); }
    };
    watchers.add(run);
    run();
    return () => watchers.delete(run);
  }

  /* ---------- Аккаунты ---------- */
  let uid = null;
  const authCbs = new Set();
  const sesUid = () => {
    const v = sessionStorage.getItem(SES);
    return v === null ? (localStorage.getItem(SES) || '') : v;
  };
  function setUid(u) {
    uid = u || null;
    sessionStorage.setItem(SES, u || '');
    if (u) localStorage.setItem(SES, u);
    else if (localStorage.getItem(SES) === uid) localStorage.removeItem(SES);
  }
  uid = sesUid() || null;
  if (uid && !read().users[uid]) uid = null;

  function me() {
    if (!uid) return null;
    const u = read().users[uid];
    return u ? { uid, name: u.name, email: u.email || null, photo: null, guest: !!u.guest } : null;
  }
  const emitAuth = () => authCbs.forEach(cb => cb(me()));
  const hashPw = p => 'x' + btoa(unescape(encodeURIComponent(p))); // только для демо, это не защита

  function mergeGuest(d, from, to) {
    for (const b of Object.values(d.boards)) {
      if (b.meta.owner === from) { b.meta.owner = to; b.meta.ownerName = (d.users[to] || {}).name || b.meta.ownerName; }
      if (b.members[from]) {
        const m = b.members[from];
        delete b.members[from];
        if (!b.members[to]) b.members[to] = Object.assign(m, { name: (d.users[to] || {}).name || m.name });
      }
    }
    d.userBoards[to] = Object.assign({}, d.userBoards[from] || {}, d.userBoards[to] || {});
    delete d.userBoards[from];
    delete d.users[from];
  }

  function checkSignUp({ name, email, password }) {
    name = String(name || '').trim();
    email = String(email || '').trim().toLowerCase();
    if (!name) throw fail('Введите имя');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail('Некорректный email');
    if (String(password || '').length < 6) throw fail('Пароль — минимум 6 символов');
    return { name: name.slice(0, 40), email };
  }

  function boardMeta(b, id, role) {
    return Object.assign({ id, role }, clone(b.meta));
  }

  /* ---------- Интерфейс ---------- */
  const B = {
    mode: 'local',
    ready: Promise.resolve(),
    get user() { return me(); },
    providers: { google: false, github: false },

    onAuthChange(cb) {
      authCbs.add(cb);
      Promise.resolve().then(() => { if (authCbs.has(cb)) cb(me()); });
      return () => authCbs.delete(cb);
    },

    async signUp(f) {
      const { name, email } = checkSignUp(f);
      const d = read();
      if (d.accounts[email]) throw fail('Этот email уже зарегистрирован');
      let id = uid;
      if (id && d.users[id] && d.users[id].guest) {
        Object.assign(d.users[id], { name, email, guest: false });
      } else {
        id = rid(14);
        d.users[id] = { name, email, guest: false, color: colorFor(id) };
      }
      d.accounts[email] = { uid: id, pw: hashPw(f.password) };
      write(d);
      setUid(id);
      emitAuth();
      return me();
    },

    async signIn({ email, password }) {
      email = String(email || '').trim().toLowerCase();
      const d = read();
      const acc = d.accounts[email];
      if (!acc || acc.pw !== hashPw(password || '')) throw fail('Неверный email или пароль');
      if (uid && uid !== acc.uid && d.users[uid] && d.users[uid].guest) {
        mergeGuest(d, uid, acc.uid);
        write(d);
      }
      setUid(acc.uid);
      emitAuth();
      return me();
    },

    async signInProvider(name) {
      throw fail('Вход через ' + (name === 'github' ? 'GitHub' : 'Google') + ' заработает после подключения Firebase (см. SETUP.md).');
    },

    async signInGuest() {
      const d = read();
      const id = rid(14);
      d.users[id] = { name: 'Гость ' + (1000 + Math.floor(Math.random() * 9000)), guest: true, color: colorFor(id) };
      write(d);
      setUid(id);
      emitAuth();
      return me();
    },

    async signOut() {
      const old = uid;
      sessionStorage.setItem(SES, '');
      if (localStorage.getItem(SES) === old) localStorage.removeItem(SES);
      uid = null;
      emitAuth();
    },

    async resetPassword() { throw fail('Восстановление пароля доступно после подключения Firebase.'); },

    /* ---------- Профили ---------- */
    async getProfile(u) { const x = read().users[u]; return x ? clone(x) : null; },

    watchProfile(u, cb) {
      return watch(d => {
        const x = d.users[u];
        return x ? { name: x.name, color: x.color, cursor: x.cursor || null, prefs: x.prefs || null, guest: !!x.guest } : null;
      }, cb);
    },

    async saveProfile(patch) {
      if (!uid) throw fail('Нужно войти');
      const d = read();
      const u = d.users[uid];
      if (patch.name != null) u.name = String(patch.name).trim().slice(0, 40) || u.name;
      if (patch.color != null) u.color = patch.color;
      if ('cursor' in patch) u.cursor = patch.cursor || null;
      if ('prefs' in patch) u.prefs = patch.prefs || null;
      write(d);
      if (patch.name != null) emitAuth();
    },

    /* ---------- Список досок ---------- */
    watchBoards(cb) {
      return watch(d => Object.keys(d.userBoards[uid] || {})
        .filter(id => d.boards[id] && d.boards[id].members[uid])
        .map(id => ({ id, role: d.boards[id].members[uid].role })), cb);
    },

    watchCard(id, cb) {
      return watch(d => {
        const b = d.boards[id];
        if (!b || !b.members[uid]) return null;
        return {
          id,
          name: b.meta.name,
          owner: b.meta.owner,
          ownerName: b.meta.ownerName,
          createdAt: b.meta.createdAt,
          updatedAt: b.updatedAt || b.meta.createdAt,
          shared: !!b.meta.shared,
          thumb: b.thumb || null,
          role: b.members[uid].role
        };
      }, cb);
    },

    async createBoard({ name, items } = {}) {
      if (!uid) throw fail('Нужно войти');
      const d = read();
      let id;
      do { id = rid(16); } while (d.boards[id]);
      const u = d.users[uid];
      const map = {};
      (items || []).forEach(it => { map[it.id] = clone(it); });
      d.boards[id] = {
        meta: { name: String(name || '').trim().slice(0, 80) || 'Новая доска', owner: uid, ownerName: u.name, createdAt: Date.now(), shared: false },
        members: { [uid]: { role: 'owner', name: u.name, joinedAt: Date.now() } },
        items: map,
        images: {},
        presence: {},
        updatedAt: Date.now()
      };
      (d.userBoards[uid] = d.userBoards[uid] || {})[id] = { role: 'owner', at: Date.now() };
      write(d);
      return id;
    },

    async renameBoard(id, name) {
      const d = read();
      const b = d.boards[id];
      if (!b || b.members[uid] == null || b.members[uid].role !== 'owner') throw fail('Переименовать может только владелец');
      b.meta.name = String(name || '').trim().slice(0, 80) || b.meta.name;
      if (b.invite && d.invites[b.invite.token]) d.invites[b.invite.token].name = b.meta.name;
      write(d);
    },

    async deleteBoard(id) {
      const d = read();
      const b = d.boards[id];
      if (!b || !b.members[uid] || b.members[uid].role !== 'owner') throw fail('Удалить доску может только владелец');
      if (b.invite) delete d.invites[b.invite.token];
      Object.keys(b.members).forEach(m => { if (d.userBoards[m]) delete d.userBoards[m][id]; });
      delete d.boards[id];
      write(d);
    },

    async leaveBoard(id) {
      const d = read();
      const b = d.boards[id];
      if (b && b.members[uid]) {
        if (b.members[uid].role === 'owner') throw fail('Владелец не может покинуть доску — её можно только удалить');
        delete b.members[uid];
      }
      if (d.userBoards[uid]) delete d.userBoards[uid][id];
      write(d);
    },

    /* ---------- Сеанс редактирования доски ---------- */
    async openBoard(id, h) {
      const d0 = read();
      const b0 = d0.boards[id];
      if (!uid || !b0 || !b0.members[uid]) throw fail('Нет доступа к доске', 'denied');
      const myUid = uid;
      const role = b0.members[myUid].role;
      const canEdit = role !== 'viewer';
      const isOwner = role === 'owner';

      const prevItems = new Map(Object.entries(b0.items).map(([k, v]) => [k, JSON.stringify(v)]));
      let prevMeta = JSON.stringify(b0.meta);
      let prevMembers = JSON.stringify(b0.members);
      let prevPres = '';
      let closed = false;

      const presList = b => Object.entries(b.presence || {})
        .filter(([, p]) => Date.now() - (p.t || 0) < 60000)
        .map(([u, p]) => ({ uid: u, x: p.x, y: p.y, t: p.t }));

      const run = () => {
        if (closed) return;
        const d = read();
        const b = d.boards[id];
        if (!b || !b.members[myUid]) { closed = true; watchers.delete(run); if (h.onRevoked) h.onRevoked(); return; }
        const set = [], del = [], seen = new Set();
        for (const [k, v] of Object.entries(b.items)) {
          const s = JSON.stringify(v);
          seen.add(k);
          if (prevItems.get(k) !== s) { prevItems.set(k, s); set.push(clone(v)); }
        }
        for (const k of [...prevItems.keys()]) if (!seen.has(k)) { prevItems.delete(k); del.push(k); }
        if ((set.length || del.length) && h.onItems) h.onItems({ set, del });
        const m = JSON.stringify(b.meta);
        if (m !== prevMeta) { prevMeta = m; if (h.onMeta) h.onMeta(boardMeta(b, id, b.members[myUid].role)); }
        const mm = JSON.stringify(b.members);
        if (mm !== prevMembers) {
          prevMembers = mm;
          if (h.onMembers) h.onMembers(Object.entries(b.members).map(([u, x]) => ({ uid: u, role: x.role, name: x.name })));
        }
        const pl = presList(b);
        const ps = JSON.stringify(pl);
        if (ps !== prevPres) { prevPres = ps; if (h.onPresence) h.onPresence(pl); }
      };
      watchers.add(run);

      const mutate = fn => {
        const d = read();
        const b = d.boards[id];
        if (!b || !b.members[myUid]) throw fail('Нет доступа к доске', 'denied');
        fn(b, d);
        write(d);
      };
      const beat = () => { if (!closed) try { mutate(b => { b.presence = b.presence || {}; b.presence[myUid] = Object.assign(b.presence[myUid] || {}, { t: Date.now() }); }); } catch (e) { /* noop */ } };
      beat();
      const timer = setInterval(beat, 20000);
      const bye = () => { try { const d = read(); if (d.boards[id] && d.boards[id].presence) { delete d.boards[id].presence[myUid]; write(d); } } catch (e) { /* noop */ } };
      window.addEventListener('beforeunload', bye);

      setTimeout(() => { if (!closed) { if (h.onMembers) h.onMembers(Object.entries(b0.members).map(([u, x]) => ({ uid: u, role: x.role, name: x.name }))); if (h.onPresence) h.onPresence(presList(read().boards[id] || b0)); } }, 0);

      return {
        id,
        role,
        meta: boardMeta(b0, id, role),
        items: Object.values(b0.items).map(clone),

        writeItems({ set = [], del = [] }) {
          if (!canEdit) throw fail('У вас только просмотр');
          mutate(b => {
            set.forEach(it => { b.items[it.id] = clone(it); });
            del.forEach(k => { delete b.items[k]; });
            b.updatedAt = Date.now();
          });
        },
        setPresence(p) {
          try {
            mutate(b => {
              b.presence = b.presence || {};
              if (!p) delete b.presence[myUid];
              else b.presence[myUid] = { x: p.x, y: p.y, t: Date.now() };
            });
          } catch (e) { /* не критично */ }
        },
        setSettings(patch) {
          if (!isOwner) throw fail('Менять оформление доски может владелец');
          mutate(b => { Object.assign(b.meta, patch); });
        },
        putImage(imgId, url) {
          if (!canEdit) throw fail('У вас только просмотр');
          mutate(b => { b.images[imgId] = url; });
          return Promise.resolve();
        },
        getImage(imgId) { const b = read().boards[id]; return Promise.resolve((b && b.images[imgId]) || null); },
        setThumb(url) { if (canEdit) try { mutate(b => { b.thumb = url; }); } catch (e) { /* не критично */ } },
        close() {
          closed = true;
          watchers.delete(run);
          clearInterval(timer);
          window.removeEventListener('beforeunload', bye);
          bye();
        }
      };
    },

    /* ---------- Доступ по ссылке ---------- */
    async getInvite(id) {
      const b = read().boards[id];
      if (!b || !b.members[uid] || b.members[uid].role !== 'owner') return null;
      return b.invite ? clone(b.invite) : null;
    },

    async setInvite(id, role) {
      const d = read();
      const b = d.boards[id];
      if (!b || !b.members[uid] || b.members[uid].role !== 'owner') throw fail('Ссылку создаёт владелец');
      if (b.invite) delete d.invites[b.invite.token];
      let token;
      do { token = rid(22); } while (d.invites[token]);
      role = role === 'view' ? 'view' : 'edit';
      d.invites[token] = { board: id, role, name: b.meta.name, ownerName: b.meta.ownerName };
      b.invite = { token, role };
      b.meta.shared = true;
      write(d);
      return { token, role };
    },

    async removeInvite(id) {
      const d = read();
      const b = d.boards[id];
      if (!b || !b.members[uid] || b.members[uid].role !== 'owner') throw fail('Доступом управляет владелец');
      if (b.invite) delete d.invites[b.invite.token];
      delete b.invite;
      b.meta.shared = false;
      write(d);
    },

    async resolveInvite(token) {
      if (!/^[A-Za-z0-9]{10,64}$/.test(token || '')) return null;
      const inv = read().invites[token];
      return inv ? clone(inv) : null;
    },

    async joinInvite(token) {
      if (!uid) throw fail('Нужно войти');
      const d = read();
      const inv = d.invites[token];
      if (!inv) throw fail('Ссылка недействительна или отключена');
      const b = d.boards[inv.board];
      if (!b) throw fail('Доска удалена');
      const role = inv.role === 'view' ? 'viewer' : 'editor';
      const cur = b.members[uid];
      if (!cur) b.members[uid] = { role, name: d.users[uid].name, via: token, joinedAt: Date.now() };
      else if (cur.role === 'viewer' && role === 'editor') cur.role = 'editor';
      (d.userBoards[uid] = d.userBoards[uid] || {})[inv.board] = { role: b.members[uid].role, at: Date.now() };
      write(d);
      return inv.board;
    },

    async removeMember(id, memberUid) {
      const d = read();
      const b = d.boards[id];
      if (!b || !b.members[uid] || b.members[uid].role !== 'owner') throw fail('Участников убирает владелец');
      if (memberUid === uid) throw fail('Себя убрать нельзя');
      delete b.members[memberUid];
      if (d.userBoards[memberUid]) delete d.userBoards[memberUid][id];
      write(d);
    }
  };

  window.meawBackend = B;
})();
