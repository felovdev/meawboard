#!/usr/bin/env node
/* meaw board — сервер без внешних зависимостей (только встроенный Node.js).
   Запуск:  node server.js   →   http://localhost:3000
   Хранит всё в data.json рядом с собой. */
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DATA_FILE = process.env.DATA_FILE || path.join(ROOT, 'data.json');
const YEAR = 365 * 24 * 3600;
const MAX_ITEMS = 5000;
const MAX_BODY = 6 * 1024 * 1024;

/* ---------- Хранилище ---------- */
let db = { users: {}, boards: {}, sessions: {} };
try {
  const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  db = { users: d.users || {}, boards: d.boards || {}, sessions: d.sessions || {} };
} catch (e) {
  if (e.code !== 'ENOENT') {
    console.error('Не удалось прочитать ' + DATA_FILE + ': ' + e.message);
    try { fs.renameSync(DATA_FILE, DATA_FILE + '.broken-' + Date.now()); } catch (_) { /* noop */ }
  }
}
let dirty = false;
const touch = () => { dirty = true; };
function flush() {
  if (!dirty) return;
  dirty = false;
  const tmp = DATA_FILE + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DATA_FILE);
  } catch (e) {
    console.error('Не удалось сохранить данные: ' + e.message);
    dirty = true;
  }
}
setInterval(flush, 1000).unref();
process.on('exit', flush);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { flush(); process.exit(0); });

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const getBoard = id => (hasOwn(db.boards, id) ? db.boards[id] : null);
const getUser = id => (hasOwn(db.users, id) ? db.users[id] : null);

/* ---------- Утилиты ---------- */
const bad = (status, message) => Object.assign(new Error(message), { status });
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const rid = (n = 10) => {
  let s = '';
  while (s.length < n) s += crypto.randomBytes(12).toString('base64url').replace(/[-_]/g, '');
  return s.slice(0, n);
};
const COLORS = ['#E53935', '#8E24AA', '#3949AB', '#1E88E5', '#00897B', '#43A047', '#F4511E', '#6D4C41', '#D81B60', '#5E35B1'];
const colorFor = id => COLORS[parseInt(sha(id).slice(0, 6), 16) % COLORS.length];

const pub = u => ({ id: u.id, name: u.name, guest: !!u.guest, email: u.email || null, color: u.color });
const lite = u => ({ id: u.id, name: u.name, guest: !!u.guest, color: u.color });

const hits = new Map();
function bump(key, win) {
  const now = Date.now();
  const a = (hits.get(key) || []).filter(t => now - t < win);
  a.push(now);
  hits.set(key, a);
  return a.length;
}
function count(key, win) {
  const now = Date.now();
  return (hits.get(key) || []).filter(t => now - t < win).length;
}
setInterval(() => hits.clear(), 3600e3).unref();

function send(res, code, obj) {
  const b = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(b);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { reject(bad(413, 'Слишком большой запрос')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(v && typeof v === 'object' ? v : {});
      } catch (e) { reject(bad(400, 'Некорректный JSON')); }
    });
    req.on('error', reject);
  });
}

/* ---------- Пароли и сессии ---------- */
async function hashPw(pw) {
  const salt = crypto.randomBytes(16);
  const h = await scrypt(pw, salt, 64);
  return { salt: salt.toString('hex'), hash: h.toString('hex') };
}
async function checkPw(pw, rec) {
  const h = await scrypt(pw, Buffer.from(rec.salt, 'hex'), 64);
  const a = Buffer.from(rec.hash, 'hex');
  return a.length === h.length && crypto.timingSafeEqual(a, h);
}

function newSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.sessions[sha(token)] = { u: userId, t: Date.now() };
  touch();
  return token;
}
function session(req) {
  const m = /(?:^|;\s*)sid=([\w-]+)/.exec(req.headers.cookie || '');
  if (!m) return null;
  const key = sha(m[1]);
  const s = hasOwn(db.sessions, key) ? db.sessions[key] : null;
  if (!s) return null;
  const user = getUser(s.u);
  if (!user) { delete db.sessions[key]; touch(); return null; }
  return { user, key };
}
function setCookie(res, req, token, maxAge) {
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}
for (const k of Object.keys(db.sessions)) {
  if (Date.now() - db.sessions[k].t > YEAR * 1000) delete db.sessions[k];
}

function newUser(fields) {
  const id = rid(10);
  const u = Object.assign({ id, name: 'Без имени', email: null, guest: false, pass: null, color: colorFor(id), created: Date.now() }, fields);
  db.users[id] = u;
  touch();
  return u;
}
const findByEmail = email => Object.values(db.users).find(u => u.email === email) || null;

function mergeGuest(guestId, userId) {
  for (const b of Object.values(db.boards)) {
    if (b.owner === guestId) b.owner = userId;
    const i = b.members.indexOf(guestId);
    if (i >= 0) {
      b.members.splice(i, 1);
      if (!b.members.includes(userId)) b.members.push(userId);
    }
  }
  for (const k of Object.keys(db.sessions)) if (db.sessions[k].u === guestId) delete db.sessions[k];
  delete db.users[guestId];
  touch();
}

/* ---------- Проверка элементов доски ---------- */
const TYPES = new Set(['sticky', 'rect', 'ellipse', 'diamond', 'text', 'pen', 'arrow']);
const COLOR_RE = /^(auto|#[0-9a-fA-F]{3,8})$/;
const ID_RE = /^[A-Za-z0-9_-]{1,24}$/;
const num = (v, lo = -1e7, hi = 1e7) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const col = (c, def) => (typeof c === 'string' && COLOR_RE.test(c) ? c : def);
const refId = v => (typeof v === 'string' && ID_RE.test(v) ? v : null);

function cleanItem(it) {
  if (!it || typeof it !== 'object' || typeof it.id !== 'string' || !ID_RE.test(it.id) || !TYPES.has(it.type)) return null;
  const o = { id: it.id, type: it.type };
  if (it.type === 'pen') {
    if (!Array.isArray(it.points) || !it.points.length || it.points.length > 20000) return null;
    const pts = [];
    for (const p of it.points) {
      if (!Array.isArray(p) || !num(p[0]) || !num(p[1])) return null;
      pts.push([p[0], p[1]]);
    }
    o.points = pts;
    o.color = col(it.color, 'auto');
    o.sw = num(it.sw, 1, 60) ? it.sw : 4;
  } else if (it.type === 'arrow') {
    for (const k of ['x1', 'y1', 'x2', 'y2']) { if (!num(it[k])) return null; o[k] = it[k]; }
    o.from = refId(it.from);
    o.to = refId(it.to);
    o.color = col(it.color, 'auto');
    o.sw = num(it.sw, 1, 60) ? it.sw : 4;
    o.head = !!it.head;
  } else {
    for (const k of ['x', 'y', 'w', 'h']) { if (!num(it[k])) return null; o[k] = it[k]; }
    o.color = col(it.color, it.type === 'text' ? 'auto' : '#FFFFFF');
    o.text = typeof it.text === 'string' ? it.text.slice(0, 10000) : '';
    o.fs = num(it.fs, 6, 300) ? it.fs : 18;
  }
  return o;
}

function applyOps(board, ops) {
  const del = Array.isArray(ops.del) ? ops.del.filter(x => typeof x === 'string').slice(0, MAX_ITEMS) : [];
  const set = [];
  if (Array.isArray(ops.set)) {
    for (const raw of ops.set.slice(0, 2000)) { const c = cleanItem(raw); if (c) set.push(c); }
  }
  const map = new Map(board.items.map(i => [i.id, i]));
  del.forEach(id => map.delete(id));
  set.forEach(c => map.set(c.id, c));
  if (map.size > MAX_ITEMS) throw bad(413, 'Слишком много объектов на доске');

  const out = [];
  const seen = new Set();
  const take = id => {
    const v = map.get(id);
    if (v && !seen.has(id)) { seen.add(id); out.push(v); }
  };
  const hasOrder = Array.isArray(ops.order);
  if (hasOrder) ops.order.slice(0, MAX_ITEMS * 2).forEach(id => typeof id === 'string' && take(id));
  board.items.forEach(i => take(i.id));
  set.forEach(i => take(i.id));
  board.items = out;
  board.updated = Date.now();
  touch();
  return { set, del, order: hasOrder ? out.map(i => i.id) : null };
}

/* ---------- Комнаты (SSE) ---------- */
const rooms = new Map();
function emit(boardId, event, data, exceptCid) {
  const room = rooms.get(boardId);
  if (!room) return;
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of room) if (c.cid !== exceptCid) c.res.write(msg);
}
const presence = boardId => [...(rooms.get(boardId) || [])].map(c => ({ cid: c.cid, id: c.user.id, name: c.user.name, color: c.user.color, guest: !!c.user.guest }));
setInterval(() => {
  for (const room of rooms.values()) for (const c of room) c.res.write(': ping\n\n');
}, 20000).unref();

/* ---------- Доски ---------- */
const meta = (b, user) => ({
  id: b.id,
  name: b.name,
  mine: b.owner === user.id,
  owner: (getUser(b.owner) || {}).name || '—',
  updated: b.updated,
  count: b.items.length
});
function join(board, user) {
  if (board.owner !== user.id && !board.members.includes(user.id)) {
    board.members.push(user.id);
    touch();
  }
}
const cleanName = (v, def) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 60) || def;

/* ---------- API ---------- */
async function api(req, res, url, p) {
  const m = req.method;
  const ip = req.socket.remoteAddress || '?';

  if (p === '/api/info' && m === 'GET') {
    const lan = [];
    for (const list of Object.values(os.networkInterfaces())) {
      for (const i of list || []) if (i.family === 'IPv4' && !i.internal) lan.push(`http://${i.address}:${PORT}`);
    }
    return send(res, 200, { lan });
  }

  if (p === '/api/me' && m === 'GET') {
    const s = session(req);
    if (!s) throw bad(401, 'Не авторизован');
    return send(res, 200, { user: pub(s.user) });
  }

  if (p === '/api/guest' && m === 'POST') {
    const s = session(req);
    if (s) return send(res, 200, { user: pub(s.user) });
    if (bump('guest:' + ip, 3600e3) > 40) throw bad(429, 'Слишком много запросов, попробуйте позже');
    const u = newUser({ guest: true, name: 'Гость ' + (1000 + crypto.randomInt(9000)) });
    setCookie(res, req, newSession(u.id), YEAR);
    return send(res, 200, { user: pub(u) });
  }

  if (p === '/api/register' && m === 'POST') {
    const b = await readJson(req);
    const name = String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const email = String(b.email || '').trim().toLowerCase().slice(0, 120);
    const pw = String(b.password || '');
    if (!name) throw bad(400, 'Введите имя');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad(400, 'Некорректный email');
    if (pw.length < 6) throw bad(400, 'Пароль — минимум 6 символов');
    if (pw.length > 200) throw bad(400, 'Пароль слишком длинный');
    if (bump('reg:' + ip, 3600e3) > 20) throw bad(429, 'Слишком много запросов, попробуйте позже');
    if (findByEmail(email)) throw bad(409, 'Этот email уже зарегистрирован');
    const pass = await hashPw(pw);
    if (findByEmail(email)) throw bad(409, 'Этот email уже зарегистрирован');
    const s = session(req);
    if (s && s.user.guest) {
      Object.assign(s.user, { name, email, guest: false, pass });
      touch();
      return send(res, 200, { user: pub(s.user) });
    }
    const u = newUser({ name, email, pass });
    setCookie(res, req, newSession(u.id), YEAR);
    return send(res, 200, { user: pub(u) });
  }

  if (p === '/api/login' && m === 'POST') {
    const b = await readJson(req);
    const email = String(b.email || '').trim().toLowerCase();
    const pw = String(b.password || '').slice(0, 200);
    if (count('login:' + ip, 600e3) >= 10) throw bad(429, 'Слишком много попыток входа. Подождите 10 минут.');
    const u = findByEmail(email);
    let ok = false;
    if (u && u.pass) ok = await checkPw(pw, u.pass);
    else await scrypt(pw, 'meaw', 64);
    if (!ok) { bump('login:' + ip, 600e3); throw bad(401, 'Неверный email или пароль'); }
    const cur = session(req);
    if (cur && cur.user.guest && cur.user.id !== u.id) mergeGuest(cur.user.id, u.id);
    else if (cur) { delete db.sessions[cur.key]; touch(); }
    setCookie(res, req, newSession(u.id), YEAR);
    return send(res, 200, { user: pub(u) });
  }

  if (p === '/api/logout' && m === 'POST') {
    const s = session(req);
    if (s) { delete db.sessions[s.key]; touch(); }
    setCookie(res, req, '', 0);
    return send(res, 200, { ok: true });
  }

  /* --- дальше нужна авторизация --- */
  const s = session(req);
  if (!s) throw bad(401, 'Нужно войти');
  const user = s.user;

  if (p === '/api/boards') {
    if (m === 'GET') {
      const list = Object.values(db.boards)
        .filter(b => b.owner === user.id || b.members.includes(user.id))
        .sort((a, b) => b.updated - a.updated)
        .map(b => meta(b, user));
      return send(res, 200, { boards: list });
    }
    if (m === 'POST') {
      const b = await readJson(req);
      if (Object.values(db.boards).filter(x => x.owner === user.id).length >= 100) throw bad(400, 'Достигнут лимит в 100 досок');
      let id;
      do { id = rid(12); } while (getBoard(id));
      const items = Array.isArray(b.items) ? b.items.slice(0, 2000).map(cleanItem).filter(Boolean) : [];
      const board = { id, name: cleanName(b.name, 'Новая доска'), owner: user.id, members: [user.id], items, created: Date.now(), updated: Date.now() };
      db.boards[id] = board;
      touch();
      return send(res, 200, { board: meta(board, user) });
    }
    throw bad(405, 'Метод не поддерживается');
  }

  const mm = /^\/api\/boards\/([\w-]{1,24})(?:\/(events|ops))?$/.exec(p);
  if (!mm) throw bad(404, 'Не найдено');
  const board = getBoard(mm[1]);
  if (!board) throw bad(404, 'Доска не найдена');
  const sub = mm[2];

  if (!sub) {
    if (m === 'GET') {
      join(board, user);
      return send(res, 200, {
        id: board.id,
        name: board.name,
        items: board.items,
        mine: board.owner === user.id,
        owner: lite(getUser(board.owner) || { id: '', name: '—', color: '#999' }),
        members: board.members.map(getUser).filter(Boolean).map(lite)
      });
    }
    if (m === 'PATCH') {
      const b = await readJson(req);
      join(board, user);
      board.name = cleanName(b.name, board.name);
      board.updated = Date.now();
      touch();
      emit(board.id, 'rename', { name: board.name });
      return send(res, 200, { board: meta(board, user) });
    }
    if (m === 'DELETE') {
      if (board.owner === user.id) {
        emit(board.id, 'deleted', {});
        for (const c of rooms.get(board.id) || []) c.res.end();
        rooms.delete(board.id);
        delete db.boards[board.id];
        touch();
        return send(res, 200, { ok: true, deleted: true });
      }
      board.members = board.members.filter(x => x !== user.id);
      touch();
      return send(res, 200, { ok: true, left: true });
    }
    throw bad(405, 'Метод не поддерживается');
  }

  if (sub === 'events' && m === 'GET') {
    const cid = url.searchParams.get('cid') || '';
    if (!/^[\w-]{1,24}$/.test(cid)) throw bad(400, 'Некорректный cid');
    join(board, user);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write('retry: 2000\n\n');
    const client = { res, cid, user };
    if (!rooms.has(board.id)) rooms.set(board.id, new Set());
    rooms.get(board.id).add(client);
    emit(board.id, 'presence', presence(board.id));
    req.on('close', () => {
      const room = rooms.get(board.id);
      if (!room) return;
      room.delete(client);
      if (!room.size) rooms.delete(board.id);
      else emit(board.id, 'presence', presence(board.id));
    });
    return;
  }

  if (sub === 'ops' && m === 'POST') {
    const b = await readJson(req);
    const cid = typeof b.cid === 'string' && /^[\w-]{1,24}$/.test(b.cid) ? b.cid : '';
    join(board, user);
    if (b.cursor && num(b.cursor.x) && num(b.cursor.y)) {
      emit(board.id, 'cursor', { cid, id: user.id, name: user.name, color: user.color, x: b.cursor.x, y: b.cursor.y }, cid);
    }
    if (b.set || b.del || b.order) {
      const out = applyOps(board, b);
      emit(board.id, 'ops', Object.assign({ cid }, out), cid);
    }
    return send(res, 200, { ok: true });
  }

  throw bad(405, 'Метод не поддерживается');
}

/* ---------- Статика ---------- */
const STATIC = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/style.css': 'style.css',
  '/script.js': 'script.js',
  '/app.js': 'app.js'
};
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    if (p.startsWith('/api/')) return await api(req, res, url, p);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }
    if (hasOwn(STATIC, p)) {
      const file = STATIC[p];
      const buf = await fs.promises.readFile(path.join(ROOT, file));
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)], 'Cache-Control': 'no-cache' });
      return res.end(req.method === 'HEAD' ? undefined : buf);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Не найдено');
  } catch (e) {
    if (e && e.status) {
      if (!res.headersSent) return send(res, e.status, { error: e.message });
      return res.end();
    }
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: 'Ошибка сервера' });
    else res.end();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  meaw board запущен\n');
  console.log('  На этом компьютере:  http://localhost:' + PORT);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) console.log('  В локальной сети:    http://' + i.address + ':' + PORT);
  }
  console.log('\n  Данные: ' + DATA_FILE + '\n  Остановить: Ctrl+C\n');
});
