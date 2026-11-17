/* meaw board — облачное хранилище на Firebase (Auth + Realtime Database).
   Включается само, если в firebase-config.js вставлен настоящий конфиг и SDK загрузился.
   Иначе остаётся демо-режим (backend-local.js). Правила доступа — database.rules.json. */
(() => {
  'use strict';

  const cfg = window.MEAW_FIREBASE;
  if (!cfg || !cfg.apiKey || /PASTE/.test(cfg.apiKey + cfg.databaseURL) || typeof firebase === 'undefined') return;

  firebase.initializeApp(cfg);
  const auth = firebase.auth();
  const db = firebase.database();
  const TS = firebase.database.ServerValue.TIMESTAMP;

  const COLORS = ['#E53935', '#8E24AA', '#3949AB', '#1E88E5', '#00897B', '#43A047', '#F4511E', '#6D4C41', '#D81B60', '#5E35B1'];
  const ALNUM = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const rid = n => {
    const a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return Array.from(a, b => ALNUM[b % 62]).join('');
  };
  const colorFor = id => COLORS[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % COLORS.length];
  const fail = (message, code) => Object.assign(new Error(message), { code });
  // Realtime Database не принимает undefined и NaN — чистим через JSON
  const clean = v => JSON.parse(JSON.stringify(v));

  const ERRORS = {
    'auth/email-already-in-use': 'Этот email уже зарегистрирован',
    'auth/invalid-email': 'Некорректный email',
    'auth/weak-password': 'Пароль — минимум 6 символов',
    'auth/wrong-password': 'Неверный email или пароль',
    'auth/user-not-found': 'Неверный email или пароль',
    'auth/invalid-credential': 'Неверный email или пароль',
    'auth/invalid-login-credentials': 'Неверный email или пароль',
    'auth/too-many-requests': 'Слишком много попыток. Подождите немного и попробуйте снова.',
    'auth/network-request-failed': 'Нет связи с интернетом',
    'auth/operation-not-allowed': 'Этот способ входа не включён в консоли Firebase (см. SETUP.md)',
    'auth/unauthorized-domain': 'Домен сайта не добавлен в Authorized domains в консоли Firebase (см. SETUP.md)',
    'auth/popup-blocked': 'Браузер заблокировал всплывающее окно входа — разрешите его и повторите',
    'auth/account-exists-with-different-credential': 'Аккаунт с этим email уже есть — войдите другим способом',
    'auth/credential-already-in-use': 'Эта учётная запись уже занята — войдите в неё',
    'PERMISSION_DENIED': 'Нет доступа'
  };
  function wrap(e) {
    if (!e) return fail('Неизвестная ошибка');
    const code = e.code || '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return Object.assign(new Error(''), { code, silent: true });
    const msg = ERRORS[code] || (/permission_denied/i.test(e.message || '') ? ERRORS.PERMISSION_DENIED : e.message) || 'Ошибка';
    return Object.assign(new Error(msg), { code });
  }
  const guard = async fn => { try { return await fn(); } catch (e) { throw wrap(e); } };

  /* ---------- Аккаунты ---------- */
  const authCbs = new Set();
  let current = null;

  async function ensureProfile(u) {
    const ref = db.ref('users/' + u.uid);
    const snap = await ref.once('value');
    const v = snap.val();
    if (!v) {
      const name = (u.displayName || '').trim().slice(0, 40) || 'Гость ' + (1000 + Math.floor(Math.random() * 9000));
      await ref.set({ name, color: colorFor(u.uid) });
      return { name };
    }
    return v;
  }

  async function buildUser(u) {
    if (!u) return null;
    let prof = {};
    try { prof = await ensureProfile(u); } catch (e) { console.error(e); }
    return { uid: u.uid, name: prof.name || u.displayName || 'Без имени', email: u.email || null, photo: u.photoURL || null, guest: !!u.isAnonymous };
  }

  async function refreshUser() {
    current = await buildUser(auth.currentUser);
    authCbs.forEach(cb => cb(current));
    return current;
  }

  let first = true;
  const ready = new Promise(resolve => {
    auth.onAuthStateChanged(async u => {
      current = await buildUser(u);
      authCbs.forEach(cb => cb(current));
      if (first) { first = false; resolve(); }
    });
  });

  /* ---------- Профили ---------- */
  const profCache = new Map(); // uid -> {count, value, cbs, off}
  function watchProfile(u, cb) {
    let e = profCache.get(u);
    if (!e) {
      e = { cbs: new Set(), value: undefined, ref: db.ref('users/' + u) };
      e.handler = e.ref.on('value', s => {
        const v = s.val();
        e.value = v ? { name: v.name, color: v.color, cursor: v.cursor || null, prefs: v.prefs || null } : null;
        e.cbs.forEach(f => f(e.value));
      }, () => { e.value = null; e.cbs.forEach(f => f(null)); });
      profCache.set(u, e);
    }
    e.cbs.add(cb);
    if (e.value !== undefined) setTimeout(() => { if (e.cbs.has(cb)) cb(e.value); }, 0);
    return () => {
      e.cbs.delete(cb);
      if (!e.cbs.size) { e.ref.off('value', e.handler); profCache.delete(u); }
    };
  }

  const need = () => { if (!auth.currentUser) throw fail('Нужно войти'); return auth.currentUser.uid; };
  const nameOf = () => (current && current.name) || 'Без имени';

  /* ---------- Интерфейс ---------- */
  const B = {
    mode: 'firebase',
    ready,
    get user() { return current; },
    providers: Object.assign({ google: true, github: false }, window.MEAW_PROVIDERS || {}),

    onAuthChange(cb) {
      authCbs.add(cb);
      ready.then(() => { if (authCbs.has(cb)) cb(current); });
      return () => authCbs.delete(cb);
    },

    signUp({ name, email, password }) {
      return guard(async () => {
        name = String(name || '').trim().slice(0, 40);
        email = String(email || '').trim();
        if (!name) throw fail('Введите имя');
        const cu = auth.currentUser;
        if (cu && cu.isAnonymous) {
          const cred = firebase.auth.EmailAuthProvider.credential(email, password);
          const r = await cu.linkWithCredential(cred);
          await r.user.updateProfile({ displayName: name });
          await db.ref('users/' + r.user.uid + '/name').set(name);
        } else {
          const r = await auth.createUserWithEmailAndPassword(email, password);
          await r.user.updateProfile({ displayName: name });
          await db.ref('users/' + r.user.uid).set({ name, color: colorFor(r.user.uid) });
        }
        return refreshUser();
      });
    },

    signIn({ email, password }) {
      return guard(async () => {
        await auth.signInWithEmailAndPassword(String(email || '').trim(), String(password || ''));
        return refreshUser();
      });
    },

    signInProvider(name) {
      return guard(async () => {
        const provider = name === 'github' ? new firebase.auth.GithubAuthProvider() : new firebase.auth.GoogleAuthProvider();
        const cu = auth.currentUser;
        try {
          if (cu && cu.isAnonymous) {
            const r = await cu.linkWithPopup(provider);
            const p = r.user;
            if (p.displayName) await db.ref('users/' + p.uid + '/name').set(p.displayName.slice(0, 40));
          } else {
            await auth.signInWithPopup(provider);
          }
        } catch (e) {
          // аккаунт уже существует — входим в него (гостевые доски останутся у гостя)
          if (e.code === 'auth/credential-already-in-use' && e.credential) await auth.signInWithCredential(e.credential);
          else throw e;
        }
        return refreshUser();
      });
    },

    signInGuest() {
      return guard(async () => { await auth.signInAnonymously(); return refreshUser(); });
    },

    signOut() { return guard(() => auth.signOut()); },

    resetPassword(email) { return guard(() => auth.sendPasswordResetEmail(String(email || '').trim())); },

    /* ---------- Профили ---------- */
    async getProfile(u) { const s = await db.ref('users/' + u).once('value'); return s.val(); },
    watchProfile,

    saveProfile(patch) {
      return guard(async () => {
        const u = need();
        const upd = {};
        if (patch.name != null) upd.name = String(patch.name).trim().slice(0, 40);
        if (patch.color != null) upd.color = patch.color;
        if ('cursor' in patch) upd.cursor = patch.cursor ? clean(patch.cursor) : null;
        if ('prefs' in patch) upd.prefs = patch.prefs ? clean(patch.prefs) : null;
        if (upd.name === '') delete upd.name;
        await db.ref('users/' + u).update(upd);
        if (upd.name) {
          try { await auth.currentUser.updateProfile({ displayName: upd.name }); } catch (e) { /* не критично */ }
          await refreshUser();
        }
      });
    },

    /* ---------- Список досок ---------- */
    watchBoards(cb) {
      const u = need();
      const ref = db.ref('userBoards/' + u);
      const h = ref.on('value', s => {
        const v = s.val() || {};
        cb(Object.keys(v).map(id => ({ id, role: v[id].role })));
      }, () => cb([]));
      return () => ref.off('value', h);
    },

    watchCard(id, cb) {
      const u = need();
      const base = db.ref('boards/' + id);
      const st = { meta: undefined, updatedAt: null, thumb: null, role: undefined };
      const emit = () => {
        if (st.meta === undefined || st.role === undefined) return;
        if (!st.meta || !st.role) { cb(null); return; }
        cb({
          id,
          name: st.meta.name,
          owner: st.meta.owner,
          ownerName: st.meta.ownerName,
          createdAt: st.meta.createdAt,
          updatedAt: st.updatedAt || st.meta.createdAt,
          shared: !!st.meta.shared,
          thumb: st.thumb,
          role: st.role
        });
      };
      const deny = () => { st.meta = null; st.role = null; emit(); };
      const pairs = [
        [base.child('meta'), s => { st.meta = s.val(); emit(); }],
        [base.child('members/' + u + '/role'), s => { st.role = s.val(); emit(); }],
        [base.child('updatedAt'), s => { st.updatedAt = s.val(); emit(); }],
        [base.child('thumb'), s => { st.thumb = s.val(); emit(); }]
      ];
      const hs = pairs.map(([r, f], i) => r.on('value', f, i < 2 ? deny : () => {}));
      return () => pairs.forEach(([r], i) => r.off('value', hs[i]));
    },

    createBoard({ name, items } = {}) {
      return guard(async () => {
        const u = need();
        const id = rid(16);
        const nm = String(name || '').trim().slice(0, 80) || 'Новая доска';
        // Правила проверяют состояние ДО записи, поэтому создаём в два шага
        await db.ref().update({
          ['boards/' + id + '/meta']: { name: nm, owner: u, ownerName: nameOf(), createdAt: TS, shared: false },
          ['boards/' + id + '/members/' + u]: { role: 'owner', name: nameOf(), joinedAt: TS },
          ['userBoards/' + u + '/' + id]: { role: 'owner', at: TS }
        });
        const upd = { ['boards/' + id + '/updatedAt']: TS };
        (items || []).forEach(it => { upd['boards/' + id + '/items/' + it.id] = clean(it); });
        await db.ref().update(upd);
        return id;
      });
    },

    renameBoard(id, name) {
      return guard(async () => {
        const nm = String(name || '').trim().slice(0, 80);
        if (!nm) return;
        const upd = { ['boards/' + id + '/meta/name']: nm };
        const inv = await db.ref('boards/' + id + '/invite').once('value');
        if (inv.exists()) upd['invites/' + inv.val().token + '/name'] = nm;
        await db.ref().update(upd);
      });
    },

    deleteBoard(id) {
      return guard(async () => {
        const [mem, inv] = await Promise.all([db.ref('boards/' + id + '/members').once('value'), db.ref('boards/' + id + '/invite').once('value')]);
        const upd = { ['boards/' + id]: null };
        Object.keys(mem.val() || {}).forEach(m => { upd['userBoards/' + m + '/' + id] = null; });
        if (inv.exists()) upd['invites/' + inv.val().token] = null;
        await db.ref().update(upd);
      });
    },

    leaveBoard(id) {
      return guard(async () => {
        const u = need();
        await db.ref().update({ ['boards/' + id + '/members/' + u]: null, ['userBoards/' + u + '/' + id]: null });
      });
    },

    /* ---------- Сеанс редактирования доски ---------- */
    async openBoard(id, h) {
      const u = need();
      const base = db.ref('boards/' + id);
      let role;
      try { role = (await base.child('members/' + u + '/role').once('value')).val(); }
      catch (e) { role = null; }
      if (!role) throw fail('Нет доступа к доске', 'denied');
      let meta;
      try { meta = (await base.child('meta').once('value')).val(); } catch (e) { meta = null; }
      if (!meta) throw fail('Доска не найдена', 'denied');
      const canEdit = role !== 'viewer';
      const isOwner = role === 'owner';

      const off = [];
      const on = (ref, ev, fn, err) => { const f = ref.on(ev, fn, err || (() => {})); off.push(() => ref.off(ev, f)); };
      const itemsRef = base.child('items');
      const initial = new Map();
      let ready = false;
      const withId = s => { const v = s.val() || {}; v.id = s.key; return v; };
      on(itemsRef, 'child_added', s => { if (!ready) initial.set(s.key, withId(s)); else if (h.onItems) h.onItems({ set: [withId(s)], del: [] }); });
      on(itemsRef, 'child_changed', s => { if (h.onItems) h.onItems({ set: [withId(s)], del: [] }); });
      on(itemsRef, 'child_removed', s => { if (h.onItems) h.onItems({ set: [], del: [s.key] }); });
      await new Promise(res => itemsRef.once('value', () => res(), () => res()));
      ready = true;

      const metaOf = v => Object.assign({ id, role }, v);
      on(base.child('meta'), 'value', s => { const v = s.val(); if (v && h.onMeta) h.onMeta(metaOf(v)); });
      on(base.child('members'), 'value', s => {
        const v = s.val();
        if (!v || !v[u]) { if (h.onRevoked) h.onRevoked(); return; }
        if (h.onMembers) h.onMembers(Object.keys(v).map(k => ({ uid: k, role: v[k].role, name: v[k].name })));
      }, () => { if (h.onRevoked) h.onRevoked(); });
      on(base.child('presence'), 'value', s => {
        const v = s.val() || {};
        if (h.onPresence) h.onPresence(Object.keys(v).map(k => ({ uid: k, x: v[k].x, y: v[k].y, t: v[k].t })));
      });

      const myPres = base.child('presence/' + u);
      myPres.onDisconnect().remove();
      myPres.set({ t: TS }).catch(() => {});

      const imgCache = new Map();
      return {
        id,
        role,
        meta: metaOf(meta),
        items: [...initial.values()],

        writeItems({ set = [], del = [] }) {
          if (!canEdit) throw fail('У вас только просмотр');
          const upd = { updatedAt: TS };
          set.forEach(it => { upd['items/' + it.id] = clean(it); });
          del.forEach(k => { upd['items/' + k] = null; });
          return guard(() => base.update(upd));
        },
        setPresence(p) {
          if (!p) return myPres.remove().catch(() => {});
          return myPres.set({ x: Math.round(p.x), y: Math.round(p.y), t: TS }).catch(() => {});
        },
        setSettings(patch) {
          if (!isOwner) throw fail('Менять оформление доски может владелец');
          return guard(() => base.child('meta').update(clean(patch)));
        },
        putImage(imgId, url) {
          if (!canEdit) throw fail('У вас только просмотр');
          imgCache.set(imgId, url);
          return guard(() => base.child('images/' + imgId).set(url));
        },
        async getImage(imgId) {
          if (imgCache.has(imgId)) return imgCache.get(imgId);
          try {
            const v = (await base.child('images/' + imgId).once('value')).val();
            if (v) imgCache.set(imgId, v);
            return v || null;
          } catch (e) { return null; }
        },
        setThumb(url) { if (canEdit) base.child('thumb').set(url).catch(() => {}); },
        close() {
          off.forEach(f => f());
          myPres.onDisconnect().cancel();
          myPres.remove().catch(() => {});
        }
      };
    },

    /* ---------- Доступ по ссылке ---------- */
    getInvite(id) {
      return guard(async () => {
        try {
          const s = await db.ref('boards/' + id + '/invite').once('value');
          return s.val();
        } catch (e) { return null; }
      });
    },

    setInvite(id, role) {
      return guard(async () => {
        need();
        role = role === 'view' ? 'view' : 'edit';
        const [meta, old] = await Promise.all([db.ref('boards/' + id + '/meta').once('value'), db.ref('boards/' + id + '/invite').once('value')]);
        const m = meta.val();
        if (!m) throw fail('Доска не найдена');
        const token = rid(22);
        const upd = {
          ['invites/' + token]: { board: id, role, name: m.name, ownerName: m.ownerName || '', created: TS },
          ['boards/' + id + '/invite']: { token, role },
          ['boards/' + id + '/meta/shared']: true
        };
        if (old.exists()) upd['invites/' + old.val().token] = null;
        await db.ref().update(upd);
        return { token, role };
      });
    },

    removeInvite(id) {
      return guard(async () => {
        const old = await db.ref('boards/' + id + '/invite').once('value');
        const upd = { ['boards/' + id + '/invite']: null, ['boards/' + id + '/meta/shared']: false };
        if (old.exists()) upd['invites/' + old.val().token] = null;
        await db.ref().update(upd);
      });
    },

    resolveInvite(token) {
      return guard(async () => {
        if (!/^[A-Za-z0-9]{10,64}$/.test(token || '')) return null;
        const s = await db.ref('invites/' + token).once('value');
        return s.val();
      });
    },

    joinInvite(token) {
      return guard(async () => {
        const u = need();
        if (!/^[A-Za-z0-9]{10,64}$/.test(token || '')) throw fail('Ссылка недействительна или отключена');
        const inv = (await db.ref('invites/' + token).once('value')).val();
        if (!inv) throw fail('Ссылка недействительна или отключена');
        const mine = await db.ref('userBoards/' + u + '/' + inv.board).once('value');
        if (mine.exists()) return inv.board;
        const role = inv.role === 'view' ? 'viewer' : 'editor';
        await db.ref().update({
          ['boards/' + inv.board + '/members/' + u]: { role, name: nameOf(), via: token, joinedAt: TS },
          ['userBoards/' + u + '/' + inv.board]: { role, at: TS }
        });
        return inv.board;
      });
    },

    removeMember(id, memberUid) {
      return guard(async () => {
        await db.ref().update({ ['boards/' + id + '/members/' + memberUid]: null, ['userBoards/' + memberUid + '/' + id]: null });
      });
    }
  };

  window.meawBackend = B;
})();
