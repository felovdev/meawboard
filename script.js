/* meaw board — движок доски: бесконечный холст на SVG, без зависимостей */
(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const UIFONT = 'Roboto, "Segoe UI", system-ui, -apple-system, sans-serif';
  const FAMS = {
    sans: 'Roboto, "Segoe UI", system-ui, sans-serif',
    serif: 'Lora, Georgia, serif',
    mono: '"JetBrains Mono", Consolas, monospace',
    hand: 'Caveat, "Comic Sans MS", cursive'
  };
  const FAM_NAMES = [['sans', 'Обычный'], ['serif', 'С засечками'], ['mono', 'Моно'], ['hand', 'Рукописный']];
  const LH = 1.3;
  const MIN_K = 0.02, MAX_K = 8;
  const MAX_IMG_CHARS = 650000;

  const FILL = ['#FFF59D', '#FFCC80', '#F48FB1', '#CE93D8', '#B39DDB', '#90CAF9', '#80DEEA', '#A5D6A7', '#E6EE9C', '#FFFFFF', '#CFD8DC', '#455A64'];
  const INK = ['auto', '#D32F2F', '#F57C00', '#FBC02D', '#388E3C', '#1976D2', '#7B1FA2', '#E91E63', '#795548', '#FFFFFF'];
  const TEXTC = ['#1F1F1F', '#FFFFFF', '#D32F2F', '#F57C00', '#388E3C', '#1976D2', '#7B1FA2', '#E91E63'];
  const BORDERC = ['#37474F', '#D32F2F', '#F57C00', '#388E3C', '#1976D2', '#7B1FA2', '#E91E63', '#FFFFFF'];
  const SIZES = [['S', 14], ['M', 18], ['L', 28], ['XL', 44]];
  const FL_DEF = { b: 100, c: 100, s: 100, g: 0, sp: 0, h: 0, bl: 0 };
  const FL_PRESETS = [
    ['Оригинал', {}],
    ['Ч/б', { g: 100 }],
    ['Сепия', { sp: 100 }],
    ['Яркий', { c: 115, s: 140 }],
    ['Тёплый', { sp: 25, s: 115, h: -8 }],
    ['Холодный', { h: 18, s: 105, b: 102 }],
    ['Выцветший', { c: 82, b: 110, s: 70 }],
    ['Размытие', { bl: 4 }]
  ];
  const TYPE_NAMES = { sticky: 'Стикер', rect: 'Прямоугольник', ellipse: 'Овал', diamond: 'Ромб', text: 'Текст', pen: 'Рисунок', arrow: 'Стрелка', image: 'Изображение' };

  const ICONS = {
    select: '<path d="M5 3l13 7-6 2-2 6z"/>',
    hand: '<path d="M8 13V5.5a1.5 1.5 0 013 0V11m0-5.5v-1a1.5 1.5 0 013 0V11m0-4.5a1.5 1.5 0 013 0V12m0-3a1.5 1.5 0 013 0v5a7 7 0 01-7 7h-1.5a6 6 0 01-4.7-2.3L4 14.5a1.5 1.5 0 012.2-2L8 14"/>',
    sticky: '<path d="M4 4h16v10l-6 6H4z"/><path d="M14 20v-6h6"/>',
    text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
    rect: '<rect x="4" y="6" width="16" height="12" rx="2"/>',
    ellipse: '<ellipse cx="12" cy="12" rx="9" ry="6.5"/>',
    diamond: '<path d="M12 3l9 9-9 9-9-9z"/>',
    pen: '<path d="M4 20l1-4L16 5a2.1 2.1 0 013 3L8 19z"/><path d="M14 7l3 3"/>',
    arrow: '<path d="M5 19L19 5M10 5h9v9"/>',
    eraser: '<path d="M20 20H9l-5-5a1.5 1.5 0 010-2l8-8a1.5 1.5 0 012 0l5 5a1.5 1.5 0 010 2L11 20"/><path d="M8 11l6 6"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5-5 4 4 3-3 4 4"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h3"/>',
    download: '<path d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14"/>',
    upload: '<path d="M12 16V4m0 0L8 8m4-4l4 4M5 20h14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    trash: '<path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>',
    front: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    back: '<path d="M12 21l9-5-9-5-9 5z"/><path d="M3 11l9-5 9 5"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5M16 4.8a3.5 3.5 0 010 6.4M18 14.8c2.2.6 3.5 2.2 3.5 5.2"/>',
    logout: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    edit: '<path d="M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17z"/><path d="M14 7l3 3"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
    board: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M8 9h4M8 13h8"/>',
    rotateR: '<path d="M20 12a8 8 0 11-2.5-5.8"/><path d="M20 4v5h-5"/>',
    rotateL: '<path d="M4 12a8 8 0 102.5-5.8"/><path d="M4 4v5h5"/>',
    flipH: '<path d="M12 3v18M8 7L3 12l5 5zM16 7l5 5-5 5z"/>',
    flipV: '<path d="M3 12h18M7 8l5-5 5 5zM7 16l5 5 5-5z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
    arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>',
    more: '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
    bold: '<path d="M7 5h6a3.5 3.5 0 010 7H7zM7 12h7a3.5 3.5 0 010 7H7z"/>',
    italic: '<path d="M10 5h8M6 19h8M14 5l-4 14"/>',
    alignL: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
    alignC: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
    alignR: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
    palette: '<path d="M12 3a9 9 0 100 18c1.2 0 1.8-.8 1.4-1.8-.4-1 .2-2.2 1.4-2.2H17a4 4 0 004-4c0-5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    home: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    crop: '<path d="M6 2v14a2 2 0 002 2h14M2 6h14a2 2 0 012 2v14"/>',
    refresh: '<path d="M20 11a8 8 0 00-14.5-4M4 4v4h4M4 13a8 8 0 0014.5 4M20 20v-4h-4"/>'
  };
  const icon = n => `<svg class="ic" viewBox="0 0 24 24">${ICONS[n] || ''}</svg>`;

  const TOOLS = [
    { id: 'select', label: 'Выбор', key: 'V', code: 'KeyV' },
    { id: 'hand', label: 'Рука', key: 'H', code: 'KeyH' },
    { sep: true },
    { id: 'sticky', label: 'Стикер', key: 'N', code: 'KeyN' },
    { id: 'text', label: 'Текст', key: 'T', code: 'KeyT' },
    { id: 'rect', label: 'Прямоугольник', key: 'R', code: 'KeyR' },
    { id: 'ellipse', label: 'Овал', key: 'O', code: 'KeyO' },
    { id: 'diamond', label: 'Ромб', key: 'D', code: 'KeyD' },
    { id: 'image', label: 'Изображение', key: 'I', code: 'KeyI', action: true },
    { sep: true },
    { id: 'arrow', label: 'Стрелка', key: 'A', code: 'KeyA' },
    { id: 'pen', label: 'Карандаш', key: 'P', code: 'KeyP' },
    { id: 'eraser', label: 'Ластик', key: 'E', code: 'KeyE' }
  ];

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const stage = $('#stage'), svg = $('#svg'), world = $('#world'), layer = $('#layer'), overlay = $('#overlay');
  const editor = $('#editor');
  const props = $('#props');

  /* ---------- Состояние ---------- */
  let items = [];
  let sel = new Set();
  let tool = 'select';
  let view = { x: 0, y: 0, k: 1 };
  let boardName = 'meaw board';
  let look = { bg: null, grid: 'dots', size: 24 };
  let defaults = { sticky: '#FFF59D', shape: '#90CAF9', ink: 'auto', sw: 4 };
  let hist = [], hi = -1;
  let editing = null;
  let drag = null;
  let clip = [];
  let pasteCount = 0;
  let spaceDown = false;
  let exporting = false;
  let readOnly = false;
  let lastDown = { t: 0, x: 0, y: 0 };
  let curBoard = null;
  const images = new Map();
  const requested = new Set();
  const pointers = new Map();

  // Точки подключения для app.js (хранилище, участники, настройки)
  const hooks = {
    change() {}, live() {}, cursor() {}, rename() {}, view() {}, menu() {},
    needImage() {}, putImage() { return Promise.resolve(); }
  };

  const uid = () => Math.random().toString(36).slice(2, 9);
  const byId = id => items.find(i => i.id === id);
  const selItems = () => [...sel].map(byId).filter(Boolean);
  const BOXES = ['sticky', 'rect', 'ellipse', 'diamond', 'text', 'image'];
  const isBox = it => BOXES.includes(it.type);
  const hasText = it => isBox(it) && it.type !== 'image';
  const isShape = it => ['rect', 'ellipse', 'diamond'].includes(it.type);
  const byZ = (a, b) => ((a.z || 0) - (b.z || 0)) || (a.id < b.id ? -1 : 1);
  const maxZ = () => items.reduce((m, i) => Math.max(m, i.z || 0), 0);
  const nextZ = () => Math.max(Date.now(), maxZ() + 1);
  const clone = v => JSON.parse(JSON.stringify(v));

  function normalize(list) {
    let n = 0;
    list.forEach(i => { n++; if (typeof i.z !== 'number') i.z = n; });
    return list.sort(byZ);
  }

  // Эффективный стиль элемента (значения по умолчанию)
  function st(it) {
    const t = it.type;
    return {
      op: it.op == null ? 1 : it.op,
      bw: it.bw == null ? (isShape(it) ? 2 : 0) : it.bw,
      bc: it.bc || '#37474F',
      bd: it.bd || 'solid',
      r: it.r == null ? (t === 'rect' ? 10 : t === 'sticky' ? 3 : 0) : it.r,
      sh: it.sh == null ? t === 'sticky' : !!it.sh,
      tc: it.tc || '#1F1F1F',
      ff: it.ff || 'sans',
      fb: !!it.fb,
      fi: !!it.fi,
      ta: it.ta || (t === 'text' ? 'l' : 'c')
    };
  }
  const dashOf = (bd, w) => (bd === 'dash' ? `${Math.max(w, 1) * 3} ${Math.max(w, 1) * 2}` : bd === 'dot' ? `0.1 ${Math.max(w, 1) * 2.2}` : null);

  /* ---------- Цвета ---------- */
  function hexRGB(h) {
    h = String(h || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16);
    return isNaN(n) ? { r: 255, g: 255, b: 255 } : { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255 };
  }
  const isDarkHex = h => { const { r, g, b } = hexRGB(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5; };
  const themeDark = () => document.documentElement.dataset.theme === 'dark';
  const canvasDark = () => (look.bg ? isDarkHex(look.bg) : themeDark());
  const toHex = c => (/^#[0-9a-f]{6}$/i.test(c) ? c : /^#[0-9a-f]{3}$/i.test(c) ? '#' + c.slice(1).split('').map(x => x + x).join('') : '#6750a4');

  /* ---------- Текст ---------- */
  const mctx = document.createElement('canvas').getContext('2d');
  const fontStr = it => { const s = st(it); return `${s.fi ? 'italic ' : ''}${s.fb ? 'bold ' : ''}${it.fs || 18}px ${FAMS[s.ff] || FAMS.sans}`; };

  function wrap(text, maxW, font) {
    mctx.font = font;
    const width = s => mctx.measureText(s).width;
    const out = [];
    for (const para of String(text || '').split('\n')) {
      if (!para) { out.push(''); continue; }
      const words = para.split(' ');
      let line = '';
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const test = line ? line + ' ' + w : w;
        if (width(test) <= maxW) { line = test; continue; }
        if (line) { out.push(line); line = ''; i--; continue; }
        let chunk = '';
        for (const ch of w) {
          if (width(chunk + ch) > maxW && chunk) { out.push(chunk); chunk = ''; }
          chunk += ch;
        }
        line = chunk;
      }
      out.push(line);
    }
    return out;
  }

  function textArea(it) {
    const cx = it.x + it.w / 2;
    switch (it.type) {
      case 'sticky': return { x0: it.x + 14, x1: it.x + it.w - 14 };
      case 'rect': return { x0: it.x + 12, x1: it.x + it.w - 12 };
      case 'ellipse': { const w = Math.max(10, it.w * 0.72 - 8); return { x0: cx - w / 2, x1: cx + w / 2 }; }
      case 'diamond': { const w = Math.max(10, it.w * 0.5); return { x0: cx - w / 2, x1: cx + w / 2 }; }
      default: return { x0: it.x, x1: it.x + it.w };
    }
  }
  const linesOf = it => { const a = textArea(it); return wrap(it.text, Math.max(10, a.x1 - a.x0), fontStr(it)); };
  const fitText = it => { it.h = Math.max(1, linesOf(it).length) * (it.fs || 18) * LH; };

  /* ---------- Геометрия ---------- */
  function endpoints(a) {
    let p1 = { x: a.x1, y: a.y1 }, p2 = { x: a.x2, y: a.y2 };
    const f = a.from && byId(a.from), t = a.to && byId(a.to);
    const c1 = f ? center(f) : p1, c2 = t ? center(t) : p2;
    if (f) p1 = edge(f, c2);
    if (t) p2 = edge(t, c1);
    return [p1, p2];
  }

  function bbox(it) {
    if (it.type === 'pen') {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of it.points) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      const p = it.sw / 2;
      return { x: x0 - p, y: y0 - p, w: x1 - x0 + it.sw, h: y1 - y0 + it.sw };
    }
    if (it.type === 'arrow') {
      const [a, b] = endpoints(it);
      const p = it.sw / 2 + (it.head || it.hs ? 8 + it.sw * 2.2 : 0);
      return { x: Math.min(a.x, b.x) - p, y: Math.min(a.y, b.y) - p, w: Math.abs(a.x - b.x) + p * 2, h: Math.abs(a.y - b.y) + p * 2 };
    }
    return { x: it.x, y: it.y, w: it.w, h: it.h };
  }
  const center = it => { const b = bbox(it); return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; };

  function edge(it, target) {
    const c = center(it);
    const dx = target.x - c.x, dy = target.y - c.y;
    if (!dx && !dy) return c;
    const hw = it.w / 2, hh = it.h / 2;
    let t;
    if (it.type === 'ellipse') t = 1 / Math.sqrt((dx / hw) ** 2 + (dy / hh) ** 2);
    else if (it.type === 'diamond') t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
    else t = 1 / Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh);
    t = Math.min(t, 1);
    return { x: c.x + dx * t, y: c.y + dy * t };
  }

  function distSeg(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
    let t = l ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  function hit(it, p, tol) {
    switch (it.type) {
      case 'pen': {
        const r = it.sw / 2 + tol, pts = it.points;
        if (pts.length === 1) return Math.hypot(p.x - pts[0][0], p.y - pts[0][1]) <= r;
        for (let i = 0; i < pts.length - 1; i++) {
          if (distSeg(p, { x: pts[i][0], y: pts[i][1] }, { x: pts[i + 1][0], y: pts[i + 1][1] }) <= r) return true;
        }
        return false;
      }
      case 'arrow': {
        const [a, b] = endpoints(it);
        return distSeg(p, a, b) <= it.sw / 2 + tol + 2;
      }
      case 'ellipse': {
        const c = center(it);
        const dx = (p.x - c.x) / (it.w / 2 + tol), dy = (p.y - c.y) / (it.h / 2 + tol);
        return dx * dx + dy * dy <= 1;
      }
      case 'diamond': {
        const c = center(it);
        return Math.abs(p.x - c.x) / (it.w / 2 + tol) + Math.abs(p.y - c.y) / (it.h / 2 + tol) <= 1;
      }
      default:
        return p.x >= it.x - tol && p.x <= it.x + it.w + tol && p.y >= it.y - tol && p.y <= it.y + it.h + tol;
    }
  }

  function hitTop(p, filter) {
    const tol = 6 / view.k;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (filter && !filter(it)) continue;
      if (hit(it, p, tol)) return it;
    }
    return null;
  }
  const snapTarget = (p, exclude) => hitTop(p, it => isBox(it) && it.id !== exclude);

  function union(list) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const it of list) {
      const b = bbox(it);
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
      x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /* ---------- Картинки ---------- */
  function getImg(id) {
    if (images.has(id)) return images.get(id);
    if (!requested.has(id)) { requested.add(id); hooks.needImage(id); }
    return null;
  }

  function makeFilter(parent, id, f) {
    const v = k => (f[k] == null ? FL_DEF[k] : f[k]);
    const b = v('b') / 100, c = v('c') / 100, s = v('s') / 100, g = v('g') / 100, sp = v('sp') / 100, h = v('h'), bl = v('bl');
    const flt = el('filter', { id, x: '-10%', y: '-10%', width: '120%', height: '120%', 'color-interpolation-filters': 'sRGB' }, null, parent);
    if (bl > 0) el('feGaussianBlur', { stdDeviation: bl }, null, flt);
    if (b !== 1 || c !== 1) {
      const t = el('feComponentTransfer', {}, null, flt);
      ['feFuncR', 'feFuncG', 'feFuncB'].forEach(n => el(n, { type: 'linear', slope: b * c, intercept: 0.5 - 0.5 * c }, null, t));
    }
    const sat = s * (1 - g);
    if (sat !== 1) el('feColorMatrix', { type: 'saturate', values: sat }, null, flt);
    if (sp > 0) {
      const k = 1 - sp;
      const m = [0.393 + 0.607 * k, 0.769 - 0.769 * k, 0.189 - 0.189 * k, 0, 0,
        0.349 - 0.349 * k, 0.686 + 0.314 * k, 0.168 - 0.168 * k, 0, 0,
        0.272 - 0.272 * k, 0.534 - 0.534 * k, 0.131 + 0.869 * k, 0, 0,
        0, 0, 0, 1, 0];
      el('feColorMatrix', { type: 'matrix', values: m.join(' ') }, null, flt);
    }
    if (h) el('feColorMatrix', { type: 'hueRotate', values: h }, null, flt);
  }

  /* ---------- Рендер ---------- */
  function el(tag, attrs, style, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (style) for (const k in style) e.style.setProperty(k, style[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const inkC = c => (c === 'auto' || !c ? (exporting ? (canvasDark() ? '#F2EEF6' : '#1F1F1F') : 'var(--ink)') : c);

  function penPath(pts) {
    if (pts.length === 1) return `M${pts[0][0]} ${pts[0][1]}h0.01`;
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += `Q${pts[i][0]} ${pts[i][1]} ${mx} ${my}`;
    }
    const l = pts[pts.length - 1];
    return d + `L${l[0]} ${l[1]}`;
  }

  function label(g, it) {
    if (editing === it.id || !it.text) return;
    const s = st(it);
    const lines = linesOf(it), fs = it.fs || 18, lh = fs * LH, total = lines.length * lh;
    const a = textArea(it);
    const isText = it.type === 'text';
    const cy = it.y + it.h / 2;
    const y0 = isText ? it.y : cy - total / 2;
    const ax = s.ta === 'l' ? a.x0 : s.ta === 'r' ? a.x1 : (a.x0 + a.x1) / 2;
    const anchor = s.ta === 'l' ? 'start' : s.ta === 'r' ? 'end' : 'middle';
    lines.forEach((ln, i) => {
      const t = el('text', {
        x: ax, y: y0 + i * lh + lh / 2,
        'text-anchor': anchor, 'dominant-baseline': 'central', 'font-size': fs, 'font-family': FAMS[s.ff] || FAMS.sans
      }, { fill: isText ? inkC(it.color) : s.tc, 'pointer-events': 'none', 'white-space': 'pre' }, g);
      if (s.fb) t.setAttribute('font-weight', 'bold');
      if (s.fi) t.setAttribute('font-style', 'italic');
      t.textContent = ln || ' ';
    });
  }

  function renderItem(it, parent) {
    const g = el('g', { 'data-id': it.id }, null, parent);
    const s = st(it);
    if (s.op < 1) g.style.opacity = s.op;
    if (s.sh && it.type !== 'text' && !isLineType(it)) g.setAttribute('filter', 'url(#shadow)');
    const stroke = s.bw > 0 ? { stroke: s.bc, 'stroke-width': s.bw, 'stroke-dasharray': dashOf(s.bd, s.bw) || 'none', 'stroke-linecap': 'round' } : { stroke: 'none' };
    switch (it.type) {
      case 'sticky':
        el('rect', { x: it.x, y: it.y, width: it.w, height: it.h, rx: s.r }, Object.assign({ fill: it.color }, stroke), g);
        label(g, it);
        break;
      case 'rect':
        el('rect', { x: it.x, y: it.y, width: it.w, height: it.h, rx: s.r }, Object.assign({ fill: it.color }, stroke), g);
        label(g, it);
        break;
      case 'ellipse':
        el('ellipse', { cx: it.x + it.w / 2, cy: it.y + it.h / 2, rx: it.w / 2, ry: it.h / 2 }, Object.assign({ fill: it.color }, stroke), g);
        label(g, it);
        break;
      case 'diamond': {
        const { x, y, w, h } = it;
        el('polygon', { points: `${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`, 'stroke-linejoin': 'round' }, Object.assign({ fill: it.color }, stroke), g);
        label(g, it);
        break;
      }
      case 'text':
        el('rect', { x: it.x, y: it.y, width: it.w, height: Math.max(it.h, 8) }, { fill: 'transparent' }, g);
        label(g, it);
        break;
      case 'image': {
        const defs = el('defs', {}, null, g);
        const cp = el('clipPath', { id: 'clip-' + it.id }, null, defs);
        el('rect', { x: it.x, y: it.y, width: it.w, height: it.h, rx: s.r }, null, cp);
        const hasFl = it.fl && Object.keys(it.fl).length;
        if (hasFl) makeFilter(defs, 'f-' + it.id, it.fl);
        const url = getImg(it.imgId);
        const inner = el('g', { 'clip-path': `url(#clip-${it.id})` }, null, g);
        if (url) {
          const c = it.c || [0, 0, 0, 0];
          const cw = Math.max(0.05, 1 - c[0] - c[2]), ch = Math.max(0.05, 1 - c[1] - c[3]);
          const im = el('image', {
            href: url, x: it.x - c[0] / cw * it.w, y: it.y - c[1] / ch * it.h,
            width: it.w / cw, height: it.h / ch, preserveAspectRatio: 'none'
          }, { 'pointer-events': 'none' }, inner);
          if (hasFl) im.setAttribute('filter', `url(#f-${it.id})`);
        } else {
          el('rect', { x: it.x, y: it.y, width: it.w, height: it.h }, { fill: 'var(--surface-container-high, #ddd)' }, inner);
          const t = el('text', { x: it.x + it.w / 2, y: it.y + it.h / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': Math.min(18, it.w / 8) }, { fill: 'var(--on-surface-variant, #666)', 'pointer-events': 'none' }, inner);
          t.textContent = 'Загрузка…';
        }
        el('rect', { x: it.x, y: it.y, width: it.w, height: it.h, rx: s.r }, Object.assign({ fill: 'transparent' }, stroke), g);
        break;
      }
      case 'pen': {
        const d = penPath(it.points);
        el('path', { d }, { fill: 'none', stroke: 'transparent', 'stroke-width': Math.max(it.sw, 14), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'pointer-events': 'stroke' }, g);
        el('path', { d }, { fill: 'none', stroke: inkC(it.color), 'stroke-width': it.sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': dashOf(s.bd, it.sw) || 'none', 'pointer-events': 'none' }, g);
        break;
      }
      case 'arrow': {
        const [a, b] = endpoints(it);
        const col = inkC(it.color), sw = it.sw;
        const ang = Math.atan2(b.y - a.y, b.x - a.x), hsz = 8 + sw * 2.2;
        const start = it.hs ? { x: a.x + Math.cos(ang) * hsz * 0.6, y: a.y + Math.sin(ang) * hsz * 0.6 } : a;
        const end = it.head ? { x: b.x - Math.cos(ang) * hsz * 0.6, y: b.y - Math.sin(ang) * hsz * 0.6 } : b;
        el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y }, { stroke: 'transparent', 'stroke-width': Math.max(sw, 16), 'stroke-linecap': 'round', 'pointer-events': 'stroke' }, g);
        el('line', { x1: start.x, y1: start.y, x2: end.x, y2: end.y }, { stroke: col, 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-dasharray': dashOf(s.bd, sw) || 'none', 'pointer-events': 'none' }, g);
        const headAt = (p, an) => {
          const p1 = `${p.x - Math.cos(an - 0.42) * hsz},${p.y - Math.sin(an - 0.42) * hsz}`;
          const p2 = `${p.x - Math.cos(an + 0.42) * hsz},${p.y - Math.sin(an + 0.42) * hsz}`;
          el('polygon', { points: `${p.x},${p.y} ${p1} ${p2}`, 'stroke-linejoin': 'round' }, { fill: col, stroke: col, 'stroke-width': 1, 'pointer-events': 'none' }, g);
        };
        if (it.head) headAt(b, ang);
        if (it.hs) headAt(a, ang + Math.PI);
        break;
      }
    }
  }
  const isLineType = it => it.type === 'pen' || it.type === 'arrow';

  const HANDLES = [['nw', 0, 0, 'nwse'], ['n', .5, 0, 'ns'], ['ne', 1, 0, 'nesw'], ['e', 1, .5, 'ew'],
                   ['se', 1, 1, 'nwse'], ['s', .5, 1, 'ns'], ['sw', 0, 1, 'nesw'], ['w', 0, .5, 'ew']];
  const rectOf = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });

  function renderOverlay() {
    overlay.replaceChildren();
    if (exporting) return;
    const k = view.k, pr = 'var(--primary)';
    const its = selItems();

    if (drag && drag.snap) {
      const s = byId(drag.snap);
      if (s) {
        const b = bbox(s), m = 5 / k;
        el('rect', { x: b.x - m, y: b.y - m, width: b.w + m * 2, height: b.h + m * 2, rx: 8 / k },
          { fill: 'none', stroke: pr, 'stroke-width': 2.5 / k, 'pointer-events': 'none' }, overlay);
      }
    }

    if (its.length === 1 && its[0].type === 'arrow' && !readOnly) {
      const [a, b] = endpoints(its[0]);
      [[a, '1'], [b, '2']].forEach(([p, n]) => {
        const c = el('circle', { cx: p.x, cy: p.y, r: 7 / k }, { fill: 'var(--surface)', stroke: pr, 'stroke-width': 2 / k, cursor: 'crosshair' }, overlay);
        c.dataset.end = n;
      });
    } else if (its.length) {
      const b = union(its), m = 3 / k;
      el('rect', { x: b.x - m, y: b.y - m, width: b.w + m * 2, height: b.h + m * 2, rx: 4 / k },
        { fill: 'none', stroke: pr, 'stroke-width': 1.6 / k, 'stroke-dasharray': `${6 / k} ${4 / k}`, 'pointer-events': 'none' }, overlay);
      if (its.length === 1 && isBox(its[0]) && !readOnly) {
        const it = its[0], s = 10 / k;
        const list = it.type === 'text' ? HANDLES.filter(h => h[0] === 'e' || h[0] === 'w') : HANDLES;
        for (const [name, fx, fy, cur] of list) {
          const hd = el('rect', { x: b.x + b.w * fx - s / 2, y: b.y + b.h * fy - s / 2, width: s, height: s, rx: 2 / k },
            { fill: 'var(--surface)', stroke: pr, 'stroke-width': 1.8 / k, cursor: cur + '-resize' }, overlay);
          hd.dataset.h = name;
        }
      }
    }

    if (drag && drag.type === 'marquee') {
      const r = rectOf(drag.p0, drag.p1);
      el('rect', { x: r.x, y: r.y, width: r.w, height: r.h },
        { fill: 'var(--primary)', 'fill-opacity': .1, stroke: pr, 'stroke-width': 1 / k, 'pointer-events': 'none' }, overlay);
    }
  }

  function render() {
    layer.replaceChildren();
    for (const it of items) {
      if (it.type === 'text') fitText(it);
      renderItem(it, layer);
    }
    renderOverlay();
    updateWorld();
    $('#empty').hidden = items.length > 0 || !!editing || !curBoard;
    positionEditor();
  }

  function gridColor() { return canvasDark() ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.2)'; }

  function updateWorld() {
    world.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
    let s = (look.size || 24) * view.k;
    while (s < 14) s *= 5;
    while (s > 140) s /= 5;
    stage.style.backgroundColor = look.bg || '';
    if (look.bg) stage.style.setProperty('--ink', isDarkHex(look.bg) ? '#F2EEF6' : '#1F1F1F');
    else stage.style.removeProperty('--ink');
    const c = gridColor();
    if (look.grid === 'none') stage.style.backgroundImage = 'none';
    else if (look.grid === 'lines') stage.style.backgroundImage = `linear-gradient(to right, ${c} 1px, transparent 1px), linear-gradient(to bottom, ${c} 1px, transparent 1px)`;
    else stage.style.backgroundImage = `radial-gradient(circle, ${c} 1.3px, transparent 1.7px)`;
    stage.style.backgroundSize = `${s}px ${s}px`;
    stage.style.backgroundPosition = `${view.x}px ${view.y}px`;
    $('#zoomLabel').textContent = Math.round(view.k * 100) + '%';
    hooks.view();
  }

  /* ---------- Редактор текста ---------- */
  function startEdit(it) {
    if (readOnly || !it || !hasText(it)) return;
    endEdit();
    editing = it.id;
    editor.value = it.text || '';
    editor.hidden = false;
    render();
    setTimeout(() => {
      if (editing !== it.id) return;
      editor.focus();
      editor.setSelectionRange(editor.value.length, editor.value.length);
    }, 30);
  }

  function positionEditor() {
    if (!editing) return;
    const it = byId(editing);
    if (!it) { editing = null; editor.hidden = true; return; }
    const k = view.k, s = st(it);
    editor.style.fontSize = (it.fs || 18) * k + 'px';
    editor.style.fontFamily = FAMS[s.ff] || FAMS.sans;
    editor.style.fontWeight = s.fb ? 'bold' : 'normal';
    editor.style.fontStyle = s.fi ? 'italic' : 'normal';
    editor.style.color = it.type === 'text' ? inkC(it.color) : s.tc;
    editor.style.caretColor = editor.style.color;
    editor.style.textAlign = s.ta === 'l' ? 'left' : s.ta === 'r' ? 'right' : 'center';
    const a = textArea(it);
    const w = Math.max((a.x1 - a.x0) * k, 20);
    editor.style.width = w + 'px';
    editor.style.height = 'auto';
    editor.style.height = editor.scrollHeight + 'px';
    editor.style.left = a.x0 * k + view.x + 'px';
    editor.style.top = (it.type === 'text' ? it.y * k + view.y : (it.y + it.h / 2) * k + view.y - editor.offsetHeight / 2) + 'px';
  }

  function endEdit() {
    if (!editing) return;
    const id = editing, it = byId(id);
    editing = null;
    editor.hidden = true;
    if (it && it.type === 'text' && !it.text.trim()) {
      items = items.filter(i => i.id !== id);
      sel.delete(id);
    }
    commit();
    render();
    refreshProps();
  }

  editor.addEventListener('input', () => {
    const it = byId(editing);
    if (!it) return;
    it.text = editor.value;
    if (it.type === 'text') fitText(it);
    render();
    hooks.live();
  });
  editor.addEventListener('blur', () => endEdit());
  editor.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') endEdit();
  });
  editor.addEventListener('pointerdown', e => e.stopPropagation());

  /* ---------- История ---------- */
  let pendingRemote = [];
  let rebaseTimer = null;

  function mergeOps(list, ops, busy) {
    const idx = new Map(list.map(i => [i.id, i]));
    (ops.del || []).forEach(id => { if (!busy.has(id)) idx.delete(id); });
    (ops.set || []).forEach(it => { if (!busy.has(it.id)) idx.set(it.id, it); });
    return [...idx.values()].sort(byZ);
  }
  function flushRebase() {
    clearTimeout(rebaseTimer);
    rebaseTimer = null;
    if (!pendingRemote.length) return;
    const list = pendingRemote;
    pendingRemote = [];
    hist = hist.map(s => {
      let arr = JSON.parse(s);
      for (const ops of list) arr = mergeOps(arr, ops, new Set());
      return JSON.stringify(arr);
    });
  }
  function applyRemote(ops) {
    const busy = new Set();
    if (editing) busy.add(editing);
    if (drag && ['move', 'resize', 'arrowend', 'arrowcreate', 'create', 'place', 'pen'].includes(drag.type)) {
      sel.forEach(id => busy.add(id));
      if (drag.id) busy.add(drag.id);
    }
    items = mergeOps(items, ops, busy);
    sel = new Set([...sel].filter(id => byId(id)));
    pendingRemote.push(ops);
    if (!rebaseTimer) rebaseTimer = setTimeout(flushRebase, 300);
    render();
    if (sel.size || !props.hidden) refreshProps();
  }

  function commit() {
    hooks.change();
    flushRebase();
    const s = JSON.stringify(items);
    if (s === hist[hi]) return;
    hist = hist.slice(0, hi + 1);
    hist.push(s);
    if (hist.length > 80) hist.shift();
    hi = hist.length - 1;
    updateHistBtns();
  }
  function restore(s) {
    endEdit();
    items = JSON.parse(s);
    sel = new Set([...sel].filter(id => byId(id)));
    render();
    refreshProps();
    updateHistBtns();
    hooks.change();
  }
  function undo() { if (readOnly) return; endEdit(); flushRebase(); if (hi > 0) { hi--; restore(hist[hi]); } }
  function redo() { if (readOnly) return; endEdit(); flushRebase(); if (hi < hist.length - 1) { hi++; restore(hist[hi]); } }
  function updateHistBtns() {
    $('#btnUndo').disabled = readOnly || hi <= 0;
    $('#btnRedo').disabled = readOnly || hi >= hist.length - 1;
  }
  function resetHistory() {
    clearTimeout(rebaseTimer);
    rebaseTimer = null;
    pendingRemote = [];
    hist = [JSON.stringify(items)];
    hi = 0;
    updateHistBtns();
  }

  /* ---------- Выделение и действия ---------- */
  function setSel(ids, quiet) {
    sel = new Set(ids);
    if (!quiet) refreshProps();
  }

  function setTool(t, keepSel) {
    if (editing) endEdit();
    if (readOnly) t = 'select';
    tool = t;
    stage.dataset.tool = t;
    $$('.tool').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
    if (!keepSel) { setSel([]); render(); }
  }

  function deleteItems(ids) {
    const set = new Set(ids);
    for (const a of items) {
      if (a.type !== 'arrow') continue;
      if ((a.from && set.has(a.from)) || (a.to && set.has(a.to))) {
        const [p1, p2] = endpoints(a);
        a.x1 = p1.x; a.y1 = p1.y; a.x2 = p2.x; a.y2 = p2.y;
        if (set.has(a.from)) a.from = null;
        if (set.has(a.to)) a.to = null;
      }
    }
    items = items.filter(i => !set.has(i.id));
    ids.forEach(id => sel.delete(id));
  }
  function deleteSel() {
    if (readOnly || !sel.size) return;
    deleteItems([...sel]);
    commit(); render(); refreshProps();
  }

  function copySel() {
    const ids = new Set(sel);
    clip = items.filter(i => ids.has(i.id)).map(i => {
      const c = clone(i);
      if (c.type === 'arrow') {
        const [p1, p2] = endpoints(i);
        c.x1 = p1.x; c.y1 = p1.y; c.x2 = p2.x; c.y2 = p2.y;
        if (!ids.has(c.from)) c.from = null;
        if (!ids.has(c.to)) c.to = null;
      }
      return c;
    });
    pasteCount = 0;
    return clip.length;
  }
  function pasteClip() {
    if (readOnly || !clip.length) return;
    pasteCount++;
    const off = 24 * pasteCount, map = {};
    clip.forEach(c => { map[c.id] = uid(); });
    let z = nextZ();
    const made = clip.map(c => {
      const n = clone(c);
      n.id = map[c.id];
      n.z = z++;
      if (n.type === 'pen') n.points = n.points.map(([x, y]) => [x + off, y + off]);
      else if (n.type === 'arrow') {
        n.x1 += off; n.y1 += off; n.x2 += off; n.y2 += off;
        n.from = n.from ? map[n.from] || null : null;
        n.to = n.to ? map[n.to] || null : null;
      } else { n.x += off; n.y += off; }
      return n;
    });
    items.push(...made);
    setSel(made.map(m => m.id));
    commit(); render();
  }
  function duplicateSel() { if (copySel()) pasteClip(); }

  function reorder(front) {
    const ids = new Set(sel);
    const chosen = items.filter(i => ids.has(i.id)), rest = items.filter(i => !ids.has(i.id));
    if (!chosen.length) return;
    const base = front
      ? rest.reduce((m, i) => Math.max(m, i.z || 0), 0)
      : rest.reduce((m, i) => Math.min(m, i.z || 0), 0) - chosen.length - 1;
    chosen.forEach((it, i) => { it.z = base + 1 + i; });
    items.sort(byZ);
    commit(); render();
  }

  /* ---------- Панель свойств ---------- */
  function dom(tag, p, ...kids) {
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

  // Меняет свойство у выбранных элементов. done=false — предпросмотр (ползунок), true — сохранить
  function setProp(key, val, filt, done = true) {
    if (readOnly) return;
    selItems().filter(filt || (() => true)).forEach(i => { if (val === undefined || val === null) delete i[key]; else i[key] = val; });
    render();
    hooks.live();
    if (done) { commit(); refreshProps(); }
  }
  function mutate(fn, filt, done = true) {
    if (readOnly) return;
    selItems().filter(filt || (() => true)).forEach(fn);
    render();
    hooks.live();
    if (done) { commit(); refreshProps(); }
  }

  const sec = (title, ...kids) => dom('div', { class: 'pp-sec' }, title ? dom('div', { class: 'pp-label', text: title }) : null, ...kids);

  function colorRow(colors, cur, onPick, withAuto) {
    const row = dom('div', { class: 'swatches' });
    colors.forEach(c => {
      const b = dom('button', { class: 'swatch' + (cur === c ? ' on' : '') + (c === 'auto' ? ' auto' : ''), title: c === 'auto' ? 'Авто' : c, type: 'button' });
      if (c !== 'auto') b.style.background = c;
      b.onclick = () => onPick(c, true);
      row.append(b);
    });
    const custom = !colors.includes(cur) && cur;
    const wrapC = dom('label', { class: 'swatch custom' + (custom ? ' on' : ''), title: 'Свой цвет' });
    if (custom) wrapC.style.background = cur;
    const inp = dom('input', { type: 'color', value: toHex(custom ? cur : colors.find(c => c !== 'auto') || '#6750a4') });
    inp.oninput = () => onPick(inp.value, false);
    inp.onchange = () => onPick(inp.value, true);
    wrapC.append(inp);
    row.append(wrapC);
    return row;
  }

  function seg(opts, cur, onPick) {
    const d = dom('div', { class: 'seg' });
    opts.forEach(([name, val, html]) => {
      const b = dom('button', { type: 'button', title: typeof name === 'string' ? name : '' });
      if (html) b.innerHTML = html; else b.textContent = name;
      if (val === cur) b.classList.add('on');
      b.onclick = () => onPick(val);
      d.append(b);
    });
    return d;
  }

  function slider(label, min, max, step, value, fmt, onInput, onDone) {
    const out = dom('span', { class: 'pp-val', text: fmt(value) });
    const inp = dom('input', { type: 'range', min, max, step, value });
    inp.oninput = () => { const v = +inp.value; out.textContent = fmt(v); onInput(v); };
    inp.onchange = () => onDone();
    return dom('label', { class: 'pp-slider' }, dom('span', { class: 'pp-sl-label', text: label }), inp, out);
  }

  function toggleRow(label, on, onPick) {
    const b = dom('button', { class: 'pp-toggle' + (on ? ' on' : ''), type: 'button', role: 'switch', 'aria-checked': on ? 'true' : 'false' }, dom('span', { class: 'pp-knob' }));
    b.onclick = () => onPick(!on);
    return dom('div', { class: 'pp-row' }, dom('span', { text: label }), b);
  }

  const pBtn = (ic, tip, fn, cls) => dom('button', { class: 'icon-btn sm ' + (cls || ''), type: 'button', title: tip, 'aria-label': tip, onclick: fn, html: icon(ic) });
  const pChip = (text, fn, ic) => dom('button', { class: 'chip', type: 'button', onclick: fn }, ic ? dom('span', { class: 'ico', html: icon(ic) }) : null, text);

  function refreshProps() {
    const its = selItems();
    if (!its.length || readOnly) { props.hidden = true; props.replaceChildren(); return; }
    props.hidden = false;
    props.replaceChildren();
    const f = its[0];
    const types = new Set(its.map(i => i.type));
    const some = fn => its.some(fn);
    const body = dom('div', { class: 'pp-body' });
    props.append(
      dom('div', { class: 'pp-head' },
        dom('span', { class: 'pp-title', text: types.size === 1 ? TYPE_NAMES[f.type] : 'Выбрано: ' + its.length }),
        pBtn('close', 'Снять выделение', () => { setSel([]); render(); })),
      body);

    const fillable = i => ['sticky', 'rect', 'ellipse', 'diamond'].includes(i.type);
    const lines = i => isLineType(i);

    if (some(fillable)) {
      body.append(sec('Заливка', colorRow(FILL, f.color, (c, done) => { setProp('color', c, fillable, done); defaults[f.type === 'sticky' ? 'sticky' : 'shape'] = c; })));
    }
    if (some(lines) || some(i => i.type === 'text')) {
      const filt = i => lines(i) || i.type === 'text';
      body.append(sec(some(i => i.type === 'text') && !some(lines) ? 'Цвет текста' : 'Цвет', colorRow(INK, f.color || 'auto', (c, done) => { setProp('color', c, filt, done); defaults.ink = c; })));
    }
    if (some(lines)) {
      const l0 = its.find(lines);
      body.append(sec('Линия',
        slider('Толщина', 1, 40, 1, l0.sw || 4, v => v + ' px', v => { setProp('sw', v, lines, false); defaults.sw = v; }, () => { commit(); refreshProps(); }),
        seg([['Сплошная', 'solid', '<b>—</b>'], ['Пунктир', 'dash', '<b>- -</b>'], ['Точки', 'dot', '<b>···</b>']], st(l0).bd, v => setProp('bd', v === 'solid' ? undefined : v, lines)),
        some(i => i.type === 'pen') ? dom('div', { class: 'pp-row wrap' }, pChip('Ручка', () => mutate(i => { i.sw = 4; delete i.op; }, i => i.type === 'pen')), pChip('Маркер', () => mutate(i => { i.sw = 18; i.op = 0.4; }, i => i.type === 'pen'))) : null,
        some(i => i.type === 'arrow') ? [
          toggleRow('Стрелка на конце', !!its.find(i => i.type === 'arrow').head, v => setProp('head', v, i => i.type === 'arrow')),
          toggleRow('Стрелка в начале', !!its.find(i => i.type === 'arrow').hs, v => setProp('hs', v || undefined, i => i.type === 'arrow'))
        ] : null));
    }

    if (some(hasText)) {
      const t0 = its.find(hasText), s0 = st(t0);
      const tfilt = hasText;
      const parts = [];
      if (some(i => hasText(i) && i.type !== 'text')) {
        parts.push(dom('div', { class: 'pp-sublabel', text: 'Цвет текста' }), colorRow(TEXTC, s0.tc, (c, done) => setProp('tc', c, i => hasText(i) && i.type !== 'text', done)));
      }
      parts.push(
        dom('div', { class: 'pp-sublabel', text: 'Шрифт' }),
        seg(FAM_NAMES.map(([k, n]) => [n, k]), s0.ff, v => setProp('ff', v === 'sans' ? undefined : v, tfilt)),
        dom('div', { class: 'pp-sublabel', text: 'Размер' }),
        dom('div', { class: 'pp-row' },
          seg(SIZES, t0.fs || 18, v => setProp('fs', v, tfilt)),
          (() => { const n = dom('input', { class: 'pp-num', type: 'number', min: 8, max: 300, value: t0.fs || 18 }); n.onchange = () => setProp('fs', Math.max(8, Math.min(300, +n.value || 18)), tfilt); return n; })()),
        dom('div', { class: 'pp-row' },
          seg([['Жирный', 'b', icon('bold')]].map(([n, v, h]) => [n, v, h]), s0.fb ? 'b' : '', () => setProp('fb', s0.fb ? undefined : true, tfilt)),
          seg([['Курсив', 'i', icon('italic')]], s0.fi ? 'i' : '', () => setProp('fi', s0.fi ? undefined : true, tfilt)),
          seg([['По левому краю', 'l', icon('alignL')], ['По центру', 'c', icon('alignC')], ['По правому краю', 'r', icon('alignR')]], s0.ta, v => setProp('ta', v, tfilt))));
      body.append(sec('Текст', ...parts));
    }

    const framed = i => isShape(i) || i.type === 'sticky' || i.type === 'image';
    if (some(framed)) {
      const b0 = its.find(framed), sb = st(b0);
      body.append(sec('Обводка',
        seg([['Нет', 0], ['1', 1], ['2', 2], ['4', 4], ['8', 8]], sb.bw, v => setProp('bw', v, framed)),
        sb.bw > 0 ? [
          colorRow(BORDERC, sb.bc, (c, done) => setProp('bc', c, framed, done)),
          seg([['Сплошная', 'solid', '<b>—</b>'], ['Пунктир', 'dash', '<b>- -</b>'], ['Точки', 'dot', '<b>···</b>']], sb.bd, v => setProp('bd', v === 'solid' ? undefined : v, framed))
        ] : null));
    }

    const rounded = i => i.type === 'rect' || i.type === 'sticky' || i.type === 'image';
    const shape = [];
    if (some(rounded)) { const r0 = its.find(rounded); shape.push(slider('Скругление', 0, 80, 1, st(r0).r, v => v + ' px', v => setProp('r', v, rounded, false), () => { commit(); refreshProps(); })); }
    shape.push(slider('Прозрачность', 5, 100, 1, Math.round(st(f).op * 100), v => v + '%', v => setProp('op', v >= 100 ? undefined : v / 100, null, false), () => { commit(); refreshProps(); }));
    if (some(i => isBox(i) && i.type !== 'text')) {
      const bx = its.find(i => isBox(i) && i.type !== 'text');
      shape.push(toggleRow('Тень', st(bx).sh, v => setProp('sh', v, i => isBox(i) && i.type !== 'text')));
    }
    body.append(sec('Вид', ...shape));

    if (some(i => i.type === 'image')) body.append(...imageSections(its.filter(i => i.type === 'image')));

    body.append(dom('div', { class: 'pp-actions' },
      pBtn('copy', 'Дублировать (Ctrl+D)', duplicateSel),
      pBtn('front', 'На передний план', () => reorder(true)),
      pBtn('back', 'На задний план', () => reorder(false)),
      pBtn('trash', 'Удалить (Del)', deleteSel, 'danger')));
  }

  function imageSections(imgs) {
    const im = imgs[0];
    const out = [];
    const c = im.c || [0, 0, 0, 0];
    out.push(sec('Изображение',
      dom('div', { class: 'pp-row wrap' },
        pChip('Заменить', () => pickFiles(files => replaceImage(im, files[0]), false), 'upload'),
        pChip('Скачать', () => downloadImage(im), 'download')),
      dom('div', { class: 'pp-row' },
        pBtn('rotateL', 'Повернуть влево', () => transformImage(imgs, 'rotL')),
        pBtn('rotateR', 'Повернуть вправо', () => transformImage(imgs, 'rotR')),
        pBtn('flipH', 'Отразить по горизонтали', () => transformImage(imgs, 'flipH')),
        pBtn('flipV', 'Отразить по вертикали', () => transformImage(imgs, 'flipV')),
        pBtn('fit', 'Оригинальный размер', () => mutate(i => { const cc = i.c || [0, 0, 0, 0]; i.w = (i.iw || i.w) * (1 - cc[0] - cc[2]); i.h = (i.ih || i.h) * (1 - cc[1] - cc[3]); }, i => i.type === 'image')))));

    const cropSl = (name, idx) => slider(name, 0, 80, 1, Math.round(c[idx] * 100), v => v + '%', v => {
      imgs.forEach(i => {
        const nc = (i.c || [0, 0, 0, 0]).slice();
        nc[idx] = v / 100;
        const opp = idx < 2 ? idx + 2 : idx - 2;
        if (nc[idx] + nc[opp] > 0.9) nc[idx] = 0.9 - nc[opp];
        applyCrop(i, nc);
      });
      render(); hooks.live();
    }, () => { commit(); refreshProps(); });
    out.push(sec('Обрезка', cropSl('Слева', 0), cropSl('Справа', 2), cropSl('Сверху', 1), cropSl('Снизу', 3),
      dom('div', { class: 'pp-row' }, pChip('Сбросить обрезку', () => mutate(i => applyCrop(i, [0, 0, 0, 0]), i => i.type === 'image'), 'refresh'))));

    const fl = im.fl || {};
    const fv = k => (fl[k] == null ? FL_DEF[k] : fl[k]);
    const flSl = (name, k, min, max, fmt) => slider(name, min, max, 1, fv(k), fmt || (v => v + '%'), v => {
      imgs.forEach(i => setFl(i, k, v));
      render(); hooks.live();
    }, () => { commit(); refreshProps(); });
    out.push(sec('Фильтры',
      dom('div', { class: 'pp-row wrap' }, FL_PRESETS.map(([n, p]) => pChip(n, () => mutate(i => { i.fl = Object.keys(p).length ? Object.assign({}, p) : undefined; if (!i.fl) delete i.fl; }, i => i.type === 'image')))),
      flSl('Яркость', 'b', 0, 200), flSl('Контраст', 'c', 0, 200), flSl('Насыщенность', 's', 0, 300),
      flSl('Оттенки серого', 'g', 0, 100), flSl('Сепия', 'sp', 0, 100), flSl('Сдвиг цвета', 'h', -180, 180, v => v + '°'), flSl('Размытие', 'bl', 0, 20, v => v + ' px')));
    return out;
  }

  function setFl(it, k, v) {
    const f = Object.assign({}, it.fl || {});
    if (v === FL_DEF[k]) delete f[k]; else f[k] = v;
    if (Object.keys(f).length) it.fl = f; else delete it.fl;
  }

  // Обрезка без искажений: видимое содержимое остаётся на месте
  function applyCrop(it, nc) {
    const oc = it.c || [0, 0, 0, 0];
    const ow = 1 - oc[0] - oc[2], oh = 1 - oc[1] - oc[3], nw = 1 - nc[0] - nc[2], nh = 1 - nc[1] - nc[3];
    const sx = it.w / ow, sy = it.h / oh;
    it.x += (nc[0] - oc[0]) * sx;
    it.y += (nc[1] - oc[1]) * sy;
    it.w = nw * sx;
    it.h = nh * sy;
    if (nc.every(v => !v)) delete it.c; else it.c = nc;
  }

  /* ---------- Загрузка и обработка картинок ---------- */
  const readDataURL = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Не удалось прочитать файл')); r.readAsDataURL(file); });
  const loadImage = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Не удалось открыть изображение')); i.src = src; });

  // Сжимаем так, чтобы картинка помещалась в базу (≈650 КБ)
  function encode(canvas, alpha) {
    if (alpha) {
      let out = canvas.toDataURL('image/png');
      if (out.length > MAX_IMG_CHARS) out = canvas.toDataURL('image/webp', 0.85);
      return out;
    }
    let q = 0.88, out = canvas.toDataURL('image/jpeg', q);
    while (out.length > MAX_IMG_CHARS && q > 0.5) { q -= 0.1; out = canvas.toDataURL('image/jpeg', q); }
    return out;
  }
  async function compress(source, alpha) {
    const img = await loadImage(source);
    const w = img.naturalWidth || 1200, h = img.naturalHeight || 800;
    let sc = Math.min(1, 1600 / Math.max(w, h));
    for (let n = 0; n < 8; n++) {
      const cw = Math.max(1, Math.round(w * sc)), ch = Math.max(1, Math.round(h * sc));
      const cv = document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      const cx = cv.getContext('2d');
      if (!alpha) { cx.fillStyle = '#fff'; cx.fillRect(0, 0, cw, ch); }
      cx.drawImage(img, 0, 0, cw, ch);
      const url = encode(cv, alpha);
      if (url.length <= MAX_IMG_CHARS) return { url, iw: cw, ih: ch };
      sc *= 0.8;
    }
    throw new Error('Изображение слишком большое — уменьшите его и попробуйте снова');
  }
  async function prepareFile(file) {
    if (!/^image\//.test(file.type)) throw new Error('Это не изображение: ' + file.name);
    const alpha = /png|webp|gif|svg/.test(file.type);
    return compress(await readDataURL(file), alpha);
  }

  const viewCenter = () => ({ x: (innerWidth / 2 - view.x) / view.k, y: (innerHeight / 2 - view.y) / view.k });

  async function addImageFiles(files, at) {
    if (readOnly) return;
    files = [...files].filter(f => /^image\//.test(f.type));
    if (!files.length) { toast('Выберите файл изображения'); return; }
    const p = at || viewCenter();
    toast(files.length > 1 ? 'Загружаю изображения…' : 'Загружаю изображение…');
    const made = [];
    let off = 0;
    for (const f of files) {
      try {
        const { url, iw, ih } = await prepareFile(f);
        const id = uid() + uid();
        images.set(id, url);
        await hooks.putImage(id, url);
        const w = Math.min(iw, 480) / Math.max(view.k, 1) ;
        const wd = Math.max(40, Math.min(iw, 480));
        const hd = wd * ih / iw;
        made.push({ id: uid(), type: 'image', x: p.x - wd / 2 + off, y: p.y - hd / 2 + off, w: wd, h: hd, imgId: id, iw, ih, z: nextZ() + made.length });
        off += 28;
        void w;
      } catch (e) { toast(e.message || 'Не удалось добавить изображение'); }
    }
    if (!made.length) return;
    items.push(...made);
    items.sort(byZ);
    setSel(made.map(m => m.id));
    setTool('select', true);
    commit(); render();
    toast(made.length > 1 ? 'Изображения добавлены' : 'Изображение добавлено');
  }

  async function replaceImage(it, file) {
    if (!file || readOnly) return;
    try {
      const { url, iw, ih } = await prepareFile(file);
      const id = uid() + uid();
      images.set(id, url);
      await hooks.putImage(id, url);
      it.imgId = id; it.iw = iw; it.ih = ih;
      delete it.c;
      it.h = it.w * ih / iw;
      commit(); render(); refreshProps();
    } catch (e) { toast(e.message || 'Не удалось заменить'); }
  }

  async function transformImage(imgs, op) {
    if (readOnly) return;
    try {
      for (const it of imgs) {
        const src = images.get(it.imgId);
        if (!src) continue;
        const img = await loadImage(src);
        const w = img.naturalWidth, h = img.naturalHeight;
        const rot = op === 'rotL' || op === 'rotR';
        const cv = document.createElement('canvas');
        cv.width = rot ? h : w; cv.height = rot ? w : h;
        const cx = cv.getContext('2d');
        cx.translate(cv.width / 2, cv.height / 2);
        if (op === 'rotR') cx.rotate(Math.PI / 2);
        if (op === 'rotL') cx.rotate(-Math.PI / 2);
        if (op === 'flipH') cx.scale(-1, 1);
        if (op === 'flipV') cx.scale(1, -1);
        cx.drawImage(img, -w / 2, -h / 2);
        const url = encode(cv, true);
        const id = uid() + uid();
        images.set(id, url);
        await hooks.putImage(id, url);
        it.imgId = id;
        if (rot) {
          const c = center(it);
          [it.iw, it.ih] = [h, w];
          [it.w, it.h] = [it.h, it.w];
          it.x = c.x - it.w / 2; it.y = c.y - it.h / 2;
        }
        delete it.c;
      }
      commit(); render(); refreshProps();
    } catch (e) { toast(e.message || 'Не удалось изменить изображение'); }
  }

  function downloadImage(it) {
    const url = images.get(it.imgId);
    if (!url) return toast('Изображение ещё загружается');
    const ext = /^data:image\/(\w+)/.exec(url);
    download(dataURLtoBlob(url), 'image.' + (ext ? (ext[1] === 'jpeg' ? 'jpg' : ext[1]) : 'png'));
  }
  function dataURLtoBlob(u) {
    const [h, b] = u.split(',');
    const mime = /:(.*?);/.exec(h)[1];
    const bin = atob(b);
    const a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return new Blob([a], { type: mime });
  }

  function pickFiles(cb, multiple = true) {
    const inp = dom('input', { type: 'file', accept: 'image/*', multiple: multiple || null, style: 'display:none' });
    inp.onchange = () => { if (inp.files.length) cb([...inp.files]); inp.remove(); };
    document.body.appendChild(inp);
    inp.click();
  }

  /* ---------- Указатель ---------- */
  function toWorld(e) {
    const r = stage.getBoundingClientRect();
    return { x: (e.clientX - r.left - view.x) / view.k, y: (e.clientY - r.top - view.y) / view.k };
  }

  function newItem(type, p, extra) {
    const base = { id: uid(), type, z: nextZ() };
    let it;
    switch (type) {
      case 'sticky': it = { ...base, x: p.x - 90, y: p.y - 90, w: 180, h: 180, color: defaults.sticky, text: '', fs: 18 }; break;
      case 'text': it = { ...base, x: p.x, y: p.y, w: 220, h: 24 * LH, color: defaults.ink, text: '', fs: 24 }; break;
      case 'pen': it = { ...base, points: [[p.x, p.y]], color: defaults.ink, sw: defaults.sw }; break;
      case 'arrow': it = { ...base, x1: p.x, y1: p.y, x2: p.x, y2: p.y, from: null, to: null, color: defaults.ink, sw: defaults.sw, head: true }; break;
      default: it = { ...base, x: p.x, y: p.y, w: 0, h: 0, color: defaults.shape, text: '', fs: 18 };
    }
    return Object.assign(it, extra || {});
  }

  stage.addEventListener('contextmenu', e => e.preventDefault());

  stage.addEventListener('pointerdown', e => {
    if (e.target === editor) return;
    e.preventDefault();
    hooks.menu('close');
    if (editing) endEdit();
    try { stage.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }

    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType === 'touch' && pointers.size === 2) { startPinch(); return; }
    if (drag && drag.type === 'pinch') return;

    const p = toWorld(e);
    const now = performance.now();
    const dbl = now - lastDown.t < 350 && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < 6;
    lastDown = { t: now, x: e.clientX, y: e.clientY };

    if (e.button === 1 || tool === 'hand' || spaceDown || readOnly) {
      if (e.button !== 0 && e.button !== 1) return;
      drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
      stage.classList.add('grabbing');
      return;
    }
    if (e.button !== 0) return;

    if (tool === 'select') {
      const hd = e.target.dataset && e.target.dataset.h;
      const en = e.target.dataset && e.target.dataset.end;
      const single = sel.size === 1 ? byId([...sel][0]) : null;
      if (hd && single) {
        drag = { type: 'resize', id: single.id, h: hd, orig: { ...bbox(single) }, p0: p, sx: e.clientX, sy: e.clientY, moved: false };
        return;
      }
      if (en && single) {
        drag = { type: 'arrowend', id: single.id, end: en, moved: false };
        return;
      }
      const g = e.target.closest && e.target.closest('[data-id]');
      if (g) {
        const id = g.dataset.id, it = byId(id);
        if (dbl && it && hasText(it)) {
          lastDown.t = 0;
          setSel([id]); render();
          startEdit(it);
          return;
        }
        if (e.shiftKey) {
          if (sel.has(id)) sel.delete(id); else sel.add(id);
          refreshProps(); render();
        } else if (!sel.has(id)) {
          setSel([id]); render();
        }
        drag = { type: 'move', p0: p, sx: e.clientX, sy: e.clientY, moved: false, starts: null };
        return;
      }
      if (dbl) {
        lastDown.t = 0;
        const it = newItem('sticky', p);
        items.push(it);
        setSel([it.id]); commit(); render();
        startEdit(it);
        return;
      }
      if (!e.shiftKey) setSel([]);
      drag = { type: 'marquee', p0: p, p1: p, base: new Set(sel) };
      render();
      return;
    }

    switch (tool) {
      case 'sticky':
      case 'text': {
        const it = newItem(tool, p);
        items.push(it);
        drag = { type: 'place', id: it.id };
        setSel([it.id], true);
        render();
        break;
      }
      case 'rect':
      case 'ellipse':
      case 'diamond': {
        const it = newItem(tool, p);
        items.push(it);
        drag = { type: 'create', id: it.id, p0: p };
        setSel([it.id], true);
        render();
        break;
      }
      case 'pen': {
        const it = newItem('pen', p);
        items.push(it);
        drag = { type: 'pen', id: it.id };
        render();
        break;
      }
      case 'arrow': {
        const f = snapTarget(p);
        const it = newItem('arrow', p, { from: f ? f.id : null });
        items.push(it);
        drag = { type: 'arrowcreate', id: it.id, snap: null };
        setSel([it.id], true);
        render();
        break;
      }
      case 'eraser':
        drag = { type: 'erase', changed: false };
        eraseAt(p);
        break;
    }
  });

  function eraseAt(p) {
    const it = hitTop(p);
    if (it) {
      deleteItems([it.id]);
      drag.changed = true;
      render();
    }
  }

  function prepMove(d) {
    const ids = new Set(sel);
    for (const a of items) {
      if (!ids.has(a.id) || a.type !== 'arrow') continue;
      const [p1, p2] = endpoints(a);
      a.x1 = p1.x; a.y1 = p1.y; a.x2 = p2.x; a.y2 = p2.y;
      if (a.from && !ids.has(a.from)) a.from = null;
      if (a.to && !ids.has(a.to)) a.to = null;
    }
    d.starts = items.filter(i => ids.has(i.id)).map(i => clone(i));
  }

  function startPinch() {
    if (drag) {
      if (['pen', 'create', 'place', 'arrowcreate'].includes(drag.type) && drag.id) {
        items = items.filter(i => i.id !== drag.id);
        setSel([]);
        render();
      } else if (drag.moved) commit();
    }
    stage.classList.remove('grabbing');
    const [a, b] = [...pointers.values()];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    drag = {
      type: 'pinch',
      d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      k0: view.k,
      w: { x: (mx - view.x) / view.k, y: (my - view.y) / view.k }
    };
  }
  function doPinch(d) {
    const pts = [...pointers.values()];
    if (pts.length < 2) return;
    const [a, b] = pts;
    const k = Math.max(MIN_K, Math.min(MAX_K, d.k0 * Math.hypot(a.x - b.x, a.y - b.y) / d.d0));
    view.k = k;
    view.x = (a.x + b.x) / 2 - d.w.x * k;
    view.y = (a.y + b.y) / 2 - d.w.y * k;
    updateWorld();
    renderOverlay();
    positionEditor();
  }

  stage.addEventListener('pointermove', e => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    hooks.cursor(toWorld(e));
    const d = drag;
    if (!d) return;
    if (d.type === 'pinch') { doPinch(d); return; }
    if (d.type !== 'pan' && d.type !== 'marquee') hooks.live();
    const p = toWorld(e);
    const screenDist = () => Math.hypot(e.clientX - d.sx, e.clientY - d.sy);

    switch (d.type) {
      case 'pan':
        view.x = d.vx + (e.clientX - d.sx);
        view.y = d.vy + (e.clientY - d.sy);
        updateWorld(); positionEditor();
        return;

      case 'move': {
        if (!d.moved) {
          if (screenDist() < 3) return;
          d.moved = true;
          prepMove(d);
        }
        const dx = p.x - d.p0.x, dy = p.y - d.p0.y;
        for (const s of d.starts) {
          const it = byId(s.id);
          if (!it) continue;
          if (it.type === 'pen') it.points = s.points.map(([x, y]) => [x + dx, y + dy]);
          else if (it.type === 'arrow') { it.x1 = s.x1 + dx; it.y1 = s.y1 + dy; it.x2 = s.x2 + dx; it.y2 = s.y2 + dy; }
          else { it.x = s.x + dx; it.y = s.y + dy; }
        }
        render();
        return;
      }

      case 'resize': {
        if (!d.moved) { if (screenDist() < 3) return; d.moved = true; }
        const it = byId(d.id);
        if (!it) return;
        const o = d.orig, dx = p.x - d.p0.x, dy = p.y - d.p0.y;
        const min = it.type === 'text' ? 60 : 24;
        let { x, y, w, h } = o;
        if (it.type === 'image' && !e.altKey) {
          const ar = o.w / o.h;
          let nw = d.h.includes('e') ? o.w + dx : d.h.includes('w') ? o.w - dx : null;
          let nh = d.h.includes('s') ? o.h + dy : d.h.includes('n') ? o.h - dy : null;
          if (nw === null) nw = nh * ar;
          else if (nh === null) nh = nw / ar;
          else if (Math.abs(nw / o.w - 1) >= Math.abs(nh / o.h - 1)) nh = nw / ar;
          else nw = nh * ar;
          w = Math.max(min, nw); h = w / ar;
          x = d.h.includes('w') ? o.x + o.w - w : d.h.includes('e') ? o.x : o.x + (o.w - w) / 2;
          y = d.h.includes('n') ? o.y + o.h - h : d.h.includes('s') ? o.y : o.y + (o.h - h) / 2;
        } else {
          if (d.h.includes('e')) w = Math.max(min, o.w + dx);
          if (d.h.includes('s')) h = Math.max(min, o.h + dy);
          if (d.h.includes('w')) { w = Math.max(min, o.w - dx); x = o.x + o.w - w; }
          if (d.h.includes('n')) { h = Math.max(min, o.h - dy); y = o.y + o.h - h; }
        }
        if (it.type === 'text') { h = o.h; y = o.y; }
        Object.assign(it, { x, y, w, h });
        render();
        return;
      }

      case 'arrowend': {
        d.moved = true;
        const a = byId(d.id);
        if (!a) return;
        const other = d.end === '1' ? a.to : a.from;
        const t = snapTarget(p, other);
        d.snap = t ? t.id : null;
        if (d.end === '1') { a.from = t ? t.id : null; a.x1 = p.x; a.y1 = p.y; }
        else { a.to = t ? t.id : null; a.x2 = p.x; a.y2 = p.y; }
        render();
        return;
      }

      case 'arrowcreate': {
        const a = byId(d.id);
        const t = snapTarget(p, a.from);
        d.snap = t ? t.id : null;
        a.x2 = p.x; a.y2 = p.y; a.to = t ? t.id : null;
        render();
        return;
      }

      case 'marquee': {
        d.p1 = p;
        const r = rectOf(d.p0, p);
        const hits = items.filter(it => {
          const b = bbox(it);
          return b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y;
        }).map(i => i.id);
        setSel([...d.base, ...hits], true);
        render();
        return;
      }

      case 'pen': {
        const it = byId(d.id);
        const last = it.points[it.points.length - 1];
        if (Math.hypot(p.x - last[0], p.y - last[1]) * view.k < 2) return;
        it.points.push([p.x, p.y]);
        render();
        return;
      }

      case 'create': {
        const it = byId(d.id);
        const r = rectOf(d.p0, p);
        Object.assign(it, { x: r.x, y: r.y, w: r.w, h: r.h });
        render();
        return;
      }

      case 'erase':
        eraseAt(p);
        return;
    }
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (drag && drag.type === 'pinch') {
      if (pointers.size < 2) { drag = null; render(); }
      return;
    }
    const d = drag;
    drag = null;
    stage.classList.remove('grabbing');
    if (!d) return;

    switch (d.type) {
      case 'move':
      case 'resize':
      case 'arrowend':
        if (d.moved) commit();
        break;
      case 'marquee':
        refreshProps();
        break;
      case 'pen':
        commit();
        break;
      case 'erase':
        if (d.changed) { commit(); refreshProps(); }
        break;
      case 'place': {
        const it = byId(d.id);
        setTool('select', true);
        setSel([d.id]);
        commit();
        render();
        setTimeout(() => startEdit(it), 30);
        return;
      }
      case 'create': {
        const it = byId(d.id);
        if (it.w < 12 && it.h < 12) {
          const c = d.p0;
          Object.assign(it, { x: c.x - 80, y: c.y - 55, w: 160, h: 110 });
        } else {
          it.w = Math.max(it.w, 24); it.h = Math.max(it.h, 24);
        }
        setTool('select', true);
        setSel([it.id]);
        commit();
        break;
      }
      case 'arrowcreate': {
        const a = byId(d.id);
        const [p1, p2] = endpoints(a);
        if (Math.hypot(p2.x - p1.x, p2.y - p1.y) < 12 / view.k && !a.to) {
          items = items.filter(i => i.id !== a.id);
          setSel([]);
        } else {
          setTool('select', true);
          setSel([a.id]);
          commit();
        }
        break;
      }
    }
    render();
  }
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);

  /* ---------- Масштаб и вид ---------- */
  function zoomAt(cx, cy, f) {
    const k0 = view.k, k1 = Math.max(MIN_K, Math.min(MAX_K, k0 * f));
    if (k1 === k0) return;
    const wx = (cx - view.x) / k0, wy = (cy - view.y) / k0;
    view.k = k1;
    view.x = cx - wx * k1;
    view.y = cy - wy * k1;
    render();
    hooks.view();
  }

  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    // Колесо мыши — масштаб; два пальца на трекпаде — перемещение; Ctrl/щипок — масштаб
    const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    const dx = e.deltaMode === 1 ? e.deltaX * 33 : e.deltaX;
    const mouseWheel = e.deltaMode !== 0 || (dx === 0 && Number.isInteger(dy) && Math.abs(dy) >= 50);
    if (e.shiftKey && !e.ctrlKey) { view.x -= dx || dy; render(); return; }
    if (!e.ctrlKey && !e.metaKey && !mouseWheel) { view.x -= dx; view.y -= dy; render(); return; }
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)));
  }, { passive: false });

  function zoomCenter(f) { zoomAt(innerWidth / 2, innerHeight / 2, f); }
  function resetZoom() {
    const wx = (innerWidth / 2 - view.x) / view.k, wy = (innerHeight / 2 - view.y) / view.k;
    view.k = 1; view.x = innerWidth / 2 - wx; view.y = innerHeight / 2 - wy;
    render();
  }
  function fitView() {
    if (!items.length) { view = { x: innerWidth / 2, y: innerHeight / 2, k: 1 }; render(); return; }
    const b = union(items);
    const k = Math.max(MIN_K, Math.min(1.5, Math.min((innerWidth - 200) / Math.max(b.w, 1), (innerHeight - 220) / Math.max(b.h, 1))));
    view.k = k;
    view.x = innerWidth / 2 - (b.x + b.w / 2) * k;
    view.y = innerHeight / 2 - (b.y + b.h / 2) * k;
    render();
  }

  /* ---------- Клавиатура, вставка, перетаскивание файлов ---------- */
  const modalOpen = () => document.body.classList.contains('modal-open');

  document.addEventListener('keydown', e => {
    if (!curBoard || document.body.dataset.view !== 'board') return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (modalOpen()) return;
    const mod = e.ctrlKey || e.metaKey;

    if (e.code === 'Space') {
      e.preventDefault();
      if (!spaceDown) { spaceDown = true; stage.classList.add('space'); }
      return;
    }
    if (e.key === '+' || e.key === '=') { zoomCenter(1.2); return; }
    if (e.key === '-' || e.key === '_') { zoomCenter(1 / 1.2); return; }
    if (e.key === '0') { fitView(); return; }
    if (e.key === '1') { resetZoom(); return; }
    if (e.key.startsWith('Arrow') && (!sel.size || readOnly)) {
      e.preventDefault();
      const stp = e.shiftKey ? 240 : 60;
      view.x += e.key === 'ArrowLeft' ? stp : e.key === 'ArrowRight' ? -stp : 0;
      view.y += e.key === 'ArrowUp' ? stp : e.key === 'ArrowDown' ? -stp : 0;
      render();
      return;
    }
    if (readOnly) return;

    if (mod) {
      switch (e.code) {
        case 'KeyZ': e.preventDefault(); e.shiftKey ? redo() : undo(); return;
        case 'KeyY': e.preventDefault(); redo(); return;
        case 'KeyC': e.preventDefault(); copySel(); toast('Скопировано'); return;
        case 'KeyX': e.preventDefault(); if (copySel()) deleteSel(); return;
        case 'KeyD': e.preventDefault(); duplicateSel(); return;
        case 'KeyA': e.preventDefault(); setSel(items.map(i => i.id)); render(); return;
        case 'KeyS': e.preventDefault(); exportJSON(); return;
      }
      return; // Ctrl+V обрабатывает событие paste
    }

    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSel(); return; }
    if (e.key === 'Escape') { setTool('select'); return; }

    if (e.key.startsWith('Arrow') && sel.size) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      const ids = new Set(sel);
      for (const it of items) {
        if (!ids.has(it.id)) continue;
        if (it.type === 'pen') it.points = it.points.map(([x, y]) => [x + dx, y + dy]);
        else if (it.type === 'arrow') {
          const [p1, p2] = endpoints(it);
          if (!it.from) { it.x1 = p1.x + dx; it.y1 = p1.y + dy; }
          if (!it.to) { it.x2 = p2.x + dx; it.y2 = p2.y + dy; }
        } else { it.x += dx; it.y += dy; }
      }
      commit(); render();
      return;
    }

    if (e.key === 'Enter' && sel.size === 1) {
      const it = byId([...sel][0]);
      if (it && hasText(it)) { e.preventDefault(); startEdit(it); }
      return;
    }

    const tl = TOOLS.find(x => x.code === e.code);
    if (tl) { if (tl.id === 'image') pickFiles(f => addImageFiles(f)); else setTool(tl.id); }
  });
  document.addEventListener('keyup', e => {
    if (e.code === 'Space') { spaceDown = false; stage.classList.remove('space'); }
  });

  document.addEventListener('paste', e => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (!curBoard || document.body.dataset.view !== 'board' || readOnly || modalOpen()) return;
    const cd = e.clipboardData;
    if (!cd) return;
    const files = [...(cd.files || [])].filter(f => /^image\//.test(f.type));
    if (files.length) { e.preventDefault(); addImageFiles(files); return; }
    if (clip.length) { e.preventDefault(); pasteClip(); return; }
    const text = cd.getData('text/plain');
    if (text && text.trim()) {
      e.preventDefault();
      const it = newItem('text', viewCenter(), { text: text.slice(0, 5000) });
      it.w = Math.min(480, Math.max(160, text.length * 10));
      items.push(it);
      setSel([it.id]);
      commit(); render();
    }
  });

  stage.addEventListener('dragover', e => { if (!readOnly && e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  stage.addEventListener('drop', e => {
    if (readOnly || !e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    addImageFiles(e.dataTransfer.files, toWorld(e));
  });

  /* ---------- Экспорт / импорт ---------- */
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const fileBase = () => (boardName.trim() || 'meaw-board').replace(/[\\/:*?"<>|]+/g, '_');

  function buildSVG(withBg) {
    if (!items.length) return null;
    const keepEditing = editing;
    editing = null;
    exporting = true;
    const b = union(items), pad = 40;
    const x = Math.floor(b.x - pad), y = Math.floor(b.y - pad);
    const W = Math.ceil(b.w + pad * 2), H = Math.ceil(b.h + pad * 2);
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('xmlns', NS);
    s.setAttribute('width', W);
    s.setAttribute('height', H);
    s.setAttribute('viewBox', `${x} ${y} ${W} ${H}`);
    const defs = el('defs', {}, null, s);
    const flt = el('filter', { id: 'shadow', x: '-20%', y: '-20%', width: '150%', height: '150%' }, null, defs);
    el('feDropShadow', { dx: 0, dy: 3, stdDeviation: 4, 'flood-opacity': .25 }, null, flt);
    if (withBg) el('rect', { x, y, width: W, height: H }, { fill: look.bg || '#FFFFFF' }, s);
    for (const it of items) {
      if (it.type === 'text') fitText(it);
      renderItem(it, s);
    }
    exporting = false;
    editing = keepEditing;
    return { svg: s, W, H };
  }

  function exportSVG() {
    const r = buildSVG(true);
    if (!r) return toast('Доска пустая — экспортировать нечего');
    const str = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(r.svg);
    download(new Blob([str], { type: 'image/svg+xml' }), fileBase() + '.svg');
    toast('SVG сохранён');
  }
  function svgToCanvas(r, maxSide, scale) {
    const str = new XMLSerializer().serializeToString(r.svg);
    return loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str)).then(img => {
      const sc = Math.min(scale, maxSide / Math.max(r.W, r.H));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(r.W * sc)); c.height = Math.max(1, Math.round(r.H * sc));
      const ctx = c.getContext('2d');
      ctx.fillStyle = look.bg || '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return c;
    });
  }
  function exportPNG() {
    const r = buildSVG(true);
    if (!r) return toast('Доска пустая — экспортировать нечего');
    svgToCanvas(r, 8000, 2).then(c => c.toBlob(b => { download(b, fileBase() + '.png'); toast('PNG сохранён'); }, 'image/png'))
      .catch(() => toast('Не удалось создать PNG'));
  }
  // Миниатюра для главной страницы
  async function exportThumb() {
    const r = buildSVG(true);
    if (!r) return null;
    try {
      const big = await svgToCanvas(r, 1200, 1);
      const W = 360, H = 240, c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      ctx.fillStyle = look.bg || '#fff';
      ctx.fillRect(0, 0, W, H);
      const sc = Math.min((W - 16) / big.width, (H - 16) / big.height);
      const w = big.width * sc, h = big.height * sc;
      ctx.drawImage(big, (W - w) / 2, (H - h) / 2, w, h);
      return c.toDataURL('image/jpeg', 0.6);
    } catch (e) { return null; }
  }
  function exportJSON() {
    endEdit();
    const used = {};
    items.forEach(i => { if (i.type === 'image' && images.has(i.imgId)) used[i.imgId] = images.get(i.imgId); });
    const data = { app: 'meaw board', version: 2, name: boardName, items, images: used, look };
    download(new Blob([JSON.stringify(data)], { type: 'application/json' }), fileBase() + '.json');
    toast('Доска сохранена');
  }
  function importJSON(file) {
    if (readOnly) return;
    const rd = new FileReader();
    rd.onload = async () => {
      try {
        const d = JSON.parse(rd.result);
        if (!d || !Array.isArray(d.items)) throw new Error('bad');
        endEdit();
        const imgs = d.images || {};
        for (const [id, url] of Object.entries(imgs)) { images.set(id, url); try { await hooks.putImage(id, url); } catch (e) { /* пропускаем */ } }
        items = normalize(d.items);
        if (d.name) { boardName = d.name; $('#boardName').value = boardName; hooks.rename(boardName); }
        setSel([]);
        commit(); render(); fitView(); refreshProps();
        toast('Доска открыта');
      } catch (err) { toast('Не удалось открыть файл'); }
    };
    rd.readAsText(file);
  }
  function clearBoard() {
    if (readOnly || !items.length) return;
    if (!confirm('Очистить доску? Это действие можно отменить через Ctrl+Z.')) return;
    endEdit();
    items = [];
    setSel([]);
    commit(); render(); refreshProps();
  }

  /* ---------- Интерфейс ---------- */
  let toastTimer = null;
  function toast(msg) {
    const s = $('#snack');
    s.textContent = msg;
    s.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => s.classList.remove('show'), 2800);
  }

  const menu = $('#menu');
  function closeMenu() { menu.hidden = true; }
  $('#btnMenu').addEventListener('click', e => { e.stopPropagation(); menu.hidden = !menu.hidden; });
  document.addEventListener('click', e => { if (!menu.contains(e.target)) closeMenu(); });
  menu.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    closeMenu();
    const act = b.dataset.act;
    if (act === 'png') exportPNG();
    else if (act === 'svg') exportSVG();
    else if (act === 'json') exportJSON();
    else if (act === 'open') $('#fileInput').click();
    else if (act === 'clear') clearBoard();
    else hooks.menu(act);
  });
  $('#fileInput').addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) importJSON(f);
    e.target.value = '';
  });

  $('#btnUndo').addEventListener('click', undo);
  $('#btnRedo').addEventListener('click', redo);
  $('#zoomIn').addEventListener('click', () => zoomCenter(1.25));
  $('#zoomOut').addEventListener('click', () => zoomCenter(1 / 1.25));
  $('#zoomLabel').addEventListener('click', resetZoom);
  $('#zoomFit').addEventListener('click', fitView);

  const nameInput = $('#boardName');
  nameInput.addEventListener('input', () => { boardName = nameInput.value; document.title = (boardName.trim() || 'meaw board') + ' — meaw board'; hooks.rename(boardName); });
  nameInput.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') nameInput.blur(); });

  // Волна Material при нажатии
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest('.icon-btn, .tool, .btn, .menu-item, .chip, .zoom-label, .seg button, .tab, .board-item, .card-open');
    if (!b || b.disabled) return;
    const r = b.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const s = document.createElement('span');
    s.className = 'ripple';
    s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    b.appendChild(s);
    s.addEventListener('animationend', () => s.remove());
  });

  window.addEventListener('resize', () => { if (curBoard) render(); });
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => { if (curBoard) render(); });

  function seedItems() {
    const z = Date.now();
    return [
      { id: 's1', type: 'sticky', x: -330, y: -190, w: 200, h: 200, color: '#FFF59D', fs: 20, text: 'Добро пожаловать в meaw board 🐾', z },
      { id: 's2', type: 'sticky', x: -60, y: -190, w: 200, h: 200, color: '#F48FB1', fs: 18, text: 'Двойной клик по пустому месту — новый стикер', z: z + 1 },
      { id: 's3', type: 'sticky', x: 210, y: -190, w: 200, h: 200, color: '#90CAF9', fs: 18, text: 'Колесо мыши — масштаб, Пробел или рука — двигать доску', z: z + 2 },
      { id: 'r1', type: 'rect', x: -60, y: 110, w: 200, h: 100, color: '#A5D6A7', fs: 20, text: 'Идея', z: z + 3 },
      { id: 'a1', type: 'arrow', x1: 0, y1: 0, x2: 0, y2: 0, from: 's2', to: 'r1', color: 'auto', sw: 4, head: true, z: z + 4 },
      { id: 't1', type: 'text', x: -330, y: 110, w: 260, h: 0, color: 'auto', fs: 22, text: 'Вставляйте картинки Ctrl+V или перетаскивайте их сюда', z: z + 5 }
    ];
  }

  function init() {
    $$('[data-icon]').forEach(n => { n.innerHTML = icon(n.dataset.icon); });
    const tb = $('#toolbar');
    TOOLS.forEach(t => {
      if (t.sep) { const d = document.createElement('div'); d.className = 'sep'; tb.appendChild(d); return; }
      const b = document.createElement('button');
      b.className = 'tool';
      b.dataset.tool = t.id;
      b.dataset.tip = `${t.label} (${t.key})`;
      b.setAttribute('aria-label', t.label);
      b.innerHTML = icon(t.id);
      b.onclick = () => { if (t.action) pickFiles(f => addImageFiles(f)); else setTool(t.id); };
      tb.appendChild(b);
    });
    view = { x: innerWidth / 2, y: innerHeight / 2 - 20, k: 1 };
    items = [];
    resetHistory();
    nameInput.value = boardName;
    setTool('select', true);
    render();
  }

  /* ---------- Интерфейс для app.js ---------- */
  window.meawBoard = {
    hooks,
    icon,
    toast,
    seed: seedItems,
    getItems: () => items,
    getView: () => view,
    applyRemote,
    exportThumb,
    addImageFiles,
    open(id, name, list, opts = {}) {
      endEdit();
      drag = null;
      curBoard = id;
      images.clear();
      requested.clear();
      items = normalize(list);
      boardName = name;
      nameInput.value = name;
      document.title = (name.trim() || 'meaw board') + ' — meaw board';
      resetHistory();
      setSel([]);
      this.setReadOnly(!!opts.readOnly);
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem('meaw-view-' + id)); } catch (e) { /* noop */ }
      if (saved && isFinite(saved.k) && isFinite(saved.x) && isFinite(saved.y)) view = saved;
      else view = { x: innerWidth / 2, y: innerHeight / 2 - 20, k: 1 };
      render();
      refreshProps();
      if (!saved && items.length) fitView();
    },
    close() {
      endEdit();
      try { if (curBoard) localStorage.setItem('meaw-view-' + curBoard, JSON.stringify(view)); } catch (e) { /* noop */ }
      curBoard = null;
      drag = null;
      items = [];
      sel = new Set();
      layer.replaceChildren();
      overlay.replaceChildren();
      props.hidden = true;
      props.replaceChildren();
    },
    replaceItems(list, name) {
      endEdit();
      drag = null;
      items = normalize(list);
      if (name != null) { boardName = name; nameInput.value = name; document.title = (name.trim() || 'meaw board') + ' — meaw board'; }
      resetHistory();
      sel = new Set([...sel].filter(id => byId(id)));
      render();
      refreshProps();
    },
    setName(name) {
      boardName = name;
      nameInput.value = name;
      document.title = (name.trim() || 'meaw board') + ' — meaw board';
    },
    setNameEditable(v) { nameInput.readOnly = !v; },
    setImage(id, url) { images.set(id, url); render(); },
    setReadOnly(v) {
      readOnly = !!v;
      document.body.classList.toggle('readonly', readOnly);
      if (readOnly) { setTool('select', true); setSel([]); }
      updateHistBtns();
      render();
      refreshProps();
    },
    setLook(l) { look = Object.assign({ bg: null, grid: 'dots', size: 24 }, l || {}); updateWorld(); renderOverlay(); },
    getLook: () => look,
    refreshLook() { updateWorld(); },
    setCursorCss(css) { if (css) stage.style.setProperty('--cur', css); else stage.style.removeProperty('--cur'); },
    saveView() { try { if (curBoard) localStorage.setItem('meaw-view-' + curBoard, JSON.stringify(view)); } catch (e) { /* noop */ } },
    centerOnContent: fitView,
    isEmpty: () => !items.length
  };

  init();
})();
