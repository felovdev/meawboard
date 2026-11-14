/* meaw board — бесконечная онлайн-доска (SVG, без зависимостей) */
(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const FONT = 'Roboto, "Segoe UI", system-ui, -apple-system, sans-serif';
  const STORE = 'meaw-board-v1';
  const LH = 1.3;
  const MIN_K = 0.02, MAX_K = 8;   // масштаб от 2% до 800%

  const FILL = ['#FFF59D', '#FFCC80', '#F48FB1', '#CE93D8', '#90CAF9', '#80DEEA', '#A5D6A7', '#E6EE9C', '#FFFFFF', '#CFD8DC'];
  const INK = ['auto', '#D32F2F', '#F57C00', '#FBC02D', '#388E3C', '#1976D2', '#7B1FA2', '#E91E63'];
  const SIZES = [['S', 14], ['M', 18], ['L', 28], ['XL', 44]];
  const WIDTHS = [['Тонко', 2], ['Средне', 4], ['Толсто', 8]];

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
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h3"/>',
    grid: '<path d="M4 4h16v16H4zM4 10h16M4 15h16M10 4v16M15 4v16"/>',
    moon: '<path d="M20 14A8 8 0 0110 4a8 8 0 1010 10z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>',
    download: '<path d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14"/>',
    upload: '<path d="M12 16V4m0 0L8 8m4-4l4 4M5 20h14"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5-5 4 4 3-3 4 4"/>',
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
    logout: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    edit: '<path d="M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17z"/><path d="M14 7l3 3"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
    board: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M8 9h4M8 13h8"/>'
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
    { sep: true },
    { id: 'arrow', label: 'Стрелка', key: 'A', code: 'KeyA' },
    { id: 'pen', label: 'Карандаш', key: 'P', code: 'KeyP' },
    { id: 'eraser', label: 'Ластик', key: 'E', code: 'KeyE' }
  ];

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const stage = $('#stage'), svg = $('#svg'), world = $('#world'), layer = $('#layer'), overlay = $('#overlay');
  const editor = $('#editor');

  /* ---------- Состояние ---------- */
  let items = [];
  let sel = new Set();
  let tool = 'select';
  let view = { x: 0, y: 0, k: 1 };
  let boardName = 'meaw board';
  let theme = 'light';
  let grid = true;
  let defaults = { sticky: '#FFF59D', shape: '#90CAF9', ink: 'auto', sw: 4 };
  let hist = [], hi = -1;
  let editing = null;
  let drag = null;
  let clip = [];
  let pasteCount = 0;
  let spaceDown = false;
  let exporting = false;
  let lastDown = { t: 0, x: 0, y: 0 };
  let curBoard = null;
  // Точки подключения для app.js (синхронизация с сервером)
  const hooks = { change() {}, live() {}, cursor() {}, rename() {}, view() {} };

  const uid = () => Math.random().toString(36).slice(2, 9);
  const byId = id => items.find(i => i.id === id);
  const isBox = it => ['sticky', 'rect', 'ellipse', 'diamond', 'text'].includes(it.type);
  const hasText = it => isBox(it);
  const INKT = new Set(['pen', 'arrow', 'text']);

  /* ---------- Текст ---------- */
  const mctx = document.createElement('canvas').getContext('2d');

  function wrap(text, maxW, fs) {
    mctx.font = `${fs}px ${FONT}`;
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

  function innerW(it) {
    switch (it.type) {
      case 'sticky': return it.w - 28;
      case 'rect': return it.w - 24;
      case 'ellipse': return it.w * 0.72 - 8;
      case 'diamond': return it.w * 0.5;
      default: return it.w;
    }
  }
  const linesOf = it => wrap(it.text, Math.max(10, innerW(it)), it.fs);
  function fitText(it) {
    it.h = Math.max(1, linesOf(it).length) * it.fs * LH;
  }

  /* ---------- Геометрия ---------- */
  function bbox(it) {
    if (it.type === 'pen') {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of it.points) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      const p = it.sw / 2;
      return { x: x0 - p, y: y0 - p, w: x1 - x0 + it.sw, h: y1 - y0 + it.sw };
    }
    if (it.type === 'arrow') {
      const [a, b] = endpoints(it);
      const p = it.sw / 2 + (it.head ? 6 : 0);
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

  function endpoints(a) {
    let p1 = { x: a.x1, y: a.y1 }, p2 = { x: a.x2, y: a.y2 };
    const f = a.from && byId(a.from), t = a.to && byId(a.to);
    const c1 = f ? center(f) : p1, c2 = t ? center(t) : p2;
    if (f) p1 = edge(f, c2);
    if (t) p2 = edge(t, c1);
    return [p1, p2];
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

  /* ---------- Рендер ---------- */
  function el(tag, attrs, style, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (style) for (const k in style) e.style.setProperty(k, style[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const inkC = c => (c === 'auto' ? (exporting ? '#1F1F1F' : 'var(--ink)') : c);

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
    const lines = linesOf(it), lh = it.fs * LH, total = lines.length * lh;
    const isText = it.type === 'text';
    const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
    const y0 = isText ? it.y : cy - total / 2;
    lines.forEach((ln, i) => {
      const t = el('text', {
        x: isText ? it.x : cx,
        y: y0 + i * lh + lh / 2,
        'text-anchor': isText ? 'start' : 'middle',
        'dominant-baseline': 'central',
        'font-size': it.fs,
        'font-family': FONT
      }, { fill: isText ? inkC(it.color) : '#1F1F1F', 'pointer-events': 'none', 'white-space': 'pre' }, g);
      t.textContent = ln || ' ';
    });
  }

  function renderItem(it, parent) {
    const g = el('g', { 'data-id': it.id }, null, parent);
    switch (it.type) {
      case 'sticky':
        el('rect', { x: it.x, y: it.y, width: it.w, height: it.h, rx: 3 }, { fill: it.color, filter: 'url(#shadow)' }, g);
        label(g, it);
        break;
      case 'rect':
        el('rect', { x: it.x, y: it.y, width: it.w, height: it.h, rx: 10 }, { fill: it.color, stroke: '#37474F', 'stroke-width': 2 }, g);
        label(g, it);
        break;
      case 'ellipse':
        el('ellipse', { cx: it.x + it.w / 2, cy: it.y + it.h / 2, rx: it.w / 2, ry: it.h / 2 }, { fill: it.color, stroke: '#37474F', 'stroke-width': 2 }, g);
        label(g, it);
        break;
      case 'diamond': {
        const { x, y, w, h } = it;
        el('polygon', { points: `${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`, 'stroke-linejoin': 'round' },
          { fill: it.color, stroke: '#37474F', 'stroke-width': 2 }, g);
        label(g, it);
        break;
      }
      case 'text':
        el('rect', { x: it.x, y: it.y, width: it.w, height: Math.max(it.h, 8) }, { fill: 'transparent' }, g);
        label(g, it);
        break;
      case 'pen': {
        const d = penPath(it.points);
        el('path', { d }, { fill: 'none', stroke: 'transparent', 'stroke-width': Math.max(it.sw, 14), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'pointer-events': 'stroke' }, g);
        el('path', { d }, { fill: 'none', stroke: inkC(it.color), 'stroke-width': it.sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'pointer-events': 'none' }, g);
        break;
      }
      case 'arrow': {
        const [a, b] = endpoints(it);
        const col = inkC(it.color), sw = it.sw;
        const ang = Math.atan2(b.y - a.y, b.x - a.x), hs = 8 + sw * 2.2;
        const end = it.head ? { x: b.x - Math.cos(ang) * hs * 0.6, y: b.y - Math.sin(ang) * hs * 0.6 } : b;
        el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y }, { stroke: 'transparent', 'stroke-width': Math.max(sw, 16), 'stroke-linecap': 'round', 'pointer-events': 'stroke' }, g);
        el('line', { x1: a.x, y1: a.y, x2: end.x, y2: end.y }, { stroke: col, 'stroke-width': sw, 'stroke-linecap': 'round', 'pointer-events': 'none' }, g);
        if (it.head) {
          const p1 = `${b.x - Math.cos(ang - 0.42) * hs},${b.y - Math.sin(ang - 0.42) * hs}`;
          const p2 = `${b.x - Math.cos(ang + 0.42) * hs},${b.y - Math.sin(ang + 0.42) * hs}`;
          el('polygon', { points: `${b.x},${b.y} ${p1} ${p2}`, 'stroke-linejoin': 'round' }, { fill: col, stroke: col, 'stroke-width': 1, 'pointer-events': 'none' }, g);
        }
        break;
      }
    }
  }

  const HANDLES = [['nw', 0, 0, 'nwse'], ['n', .5, 0, 'ns'], ['ne', 1, 0, 'nesw'], ['e', 1, .5, 'ew'],
                   ['se', 1, 1, 'nwse'], ['s', .5, 1, 'ns'], ['sw', 0, 1, 'nesw'], ['w', 0, .5, 'ew']];

  function renderOverlay() {
    overlay.replaceChildren();
    if (exporting) return;
    const k = view.k, pr = 'var(--primary)';
    const its = [...sel].map(byId).filter(Boolean);

    if (drag && drag.snap) {
      const s = byId(drag.snap);
      if (s) {
        const b = bbox(s), m = 5 / k;
        el('rect', { x: b.x - m, y: b.y - m, width: b.w + m * 2, height: b.h + m * 2, rx: 8 / k },
          { fill: 'none', stroke: pr, 'stroke-width': 2.5 / k, 'pointer-events': 'none' }, overlay);
      }
    }

    if (its.length === 1 && its[0].type === 'arrow') {
      const [a, b] = endpoints(its[0]);
      [[a, '1'], [b, '2']].forEach(([p, n]) => {
        const c = el('circle', { cx: p.x, cy: p.y, r: 7 / k, 'data-end': n }, { fill: 'var(--surface)', stroke: pr, 'stroke-width': 2 / k, cursor: 'crosshair' }, overlay);
        c.dataset.end = n;
      });
    } else if (its.length) {
      const b = union(its), m = 3 / k;
      el('rect', { x: b.x - m, y: b.y - m, width: b.w + m * 2, height: b.h + m * 2, rx: 4 / k },
        { fill: 'none', stroke: pr, 'stroke-width': 1.6 / k, 'stroke-dasharray': `${6 / k} ${4 / k}`, 'pointer-events': 'none' }, overlay);
      if (its.length === 1 && isBox(its[0]) && !drag?.hideHandles) {
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

  const rectOf = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });

  function render() {
    layer.replaceChildren();
    for (const it of items) {
      if (it.type === 'text') fitText(it);
      renderItem(it, layer);
    }
    renderOverlay();
    updateWorld();
    $('#empty').hidden = items.length > 0 || !!editing;
    positionEditor();
  }

  function updateWorld() {
    world.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
    // Сетка подстраивается под масштаб, поэтому не исчезает при любом зуме
    let s = 24 * view.k;
    while (s < 14) s *= 5;
    while (s > 140) s /= 5;
    stage.style.backgroundSize = `${s}px ${s}px`;
    stage.style.backgroundPosition = `${view.x}px ${view.y}px`;
    stage.classList.toggle('nogrid', !grid);
    $('#zoomLabel').textContent = Math.round(view.k * 100) + '%';
    hooks.view();
  }

  /* ---------- Редактор текста ---------- */
  function startEdit(it) {
    if (!it || !hasText(it)) return;
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
    const k = view.k;
    editor.style.fontSize = it.fs * k + 'px';
    editor.style.color = it.type === 'text' ? inkC(it.color) : '#1F1F1F';
    editor.style.caretColor = editor.style.color;
    if (it.type === 'text') {
      editor.style.textAlign = 'left';
      editor.style.width = Math.max(it.w * k, 20) + 'px';
      editor.style.left = it.x * k + view.x + 'px';
      editor.style.height = 'auto';
      editor.style.height = editor.scrollHeight + 'px';
      editor.style.top = it.y * k + view.y + 'px';
    } else {
      const w = Math.max(innerW(it) * k, 20);
      editor.style.textAlign = 'center';
      editor.style.width = w + 'px';
      editor.style.height = 'auto';
      editor.style.height = editor.scrollHeight + 'px';
      editor.style.left = (it.x + it.w / 2) * k + view.x - w / 2 + 'px';
      editor.style.top = (it.y + it.h / 2) * k + view.y - editor.offsetHeight / 2 + 'px';
    }
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
    if (e.key === 'Escape') { endEdit(); }
  });
  editor.addEventListener('pointerdown', e => e.stopPropagation());

  /* ---------- История и сохранение ---------- */
  // Чужие изменения применяем ко всем снимкам истории, чтобы «Отменить» не откатывало чужую работу
  let pendingRemote = [];
  let rebaseTimer = null;
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
  function mergeOps(list, ops, busy) {
    const idx = new Map(list.map(i => [i.id, i]));
    (ops.del || []).forEach(id => { if (!busy.has(id)) idx.delete(id); });
    (ops.set || []).forEach(it => { if (!busy.has(it.id)) idx.set(it.id, it); });
    const out = [], seen = new Set();
    const take = id => { if (idx.has(id) && !seen.has(id)) { seen.add(id); out.push(idx.get(id)); } };
    (ops.order || []).forEach(take);
    list.forEach(i => take(i.id));
    (ops.set || []).forEach(it => take(it.id));
    return out;
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
    if (sel.size) refreshProps(); else if (!$('#props').hidden) refreshProps();
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
    scheduleSave();
  }
  function restore(s) {
    endEdit();
    items = JSON.parse(s);
    sel = new Set([...sel].filter(id => byId(id)));
    render();
    refreshProps();
    updateHistBtns();
    scheduleSave();
    hooks.change();
  }
  function undo() { endEdit(); flushRebase(); if (hi > 0) { hi--; restore(hist[hi]); } }
  function redo() { endEdit(); flushRebase(); if (hi < hist.length - 1) { hi++; restore(hist[hi]); } }
  function updateHistBtns() {
    $('#btnUndo').disabled = hi <= 0;
    $('#btnRedo').disabled = hi >= hist.length - 1;
  }

  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 400);
  }
  // Доски лежат на сервере; в браузере помним только тему, сетку и положение камеры
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ theme, grid }));
      if (curBoard) localStorage.setItem('meaw-view-' + curBoard, JSON.stringify(view));
    } catch (e) { /* хранилище недоступно */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (!raw) return false;
      const d = JSON.parse(raw);
      theme = d.theme || theme;
      grid = d.grid !== false;
      return true;
    } catch (e) { return false; }
  }

  /* ---------- Выделение и действия ---------- */
  function setSel(ids, quiet) {
    sel = new Set(ids);
    if (!quiet) refreshProps();
  }

  function setTool(t, keepSel) {
    if (editing) endEdit();
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
    if (!sel.size) return;
    deleteItems([...sel]);
    commit(); render(); refreshProps();
  }

  function copySel() {
    const ids = new Set(sel);
    clip = items.filter(i => ids.has(i.id)).map(i => {
      const c = JSON.parse(JSON.stringify(i));
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
    if (!clip.length) return;
    pasteCount++;
    const off = 24 * pasteCount, map = {};
    clip.forEach(c => { map[c.id] = uid(); });
    const made = clip.map(c => {
      const n = JSON.parse(JSON.stringify(c));
      n.id = map[c.id];
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
    items = front ? [...rest, ...chosen] : [...chosen, ...rest];
    commit(); render();
  }

  /* ---------- Панель свойств ---------- */
  function mkBtn(cls, html, tip, fn) {
    const b = document.createElement('button');
    b.className = cls;
    b.innerHTML = html;
    if (tip) { b.dataset.tip = tip; b.setAttribute('aria-label', tip); }
    b.onclick = fn;
    return b;
  }
  function seg(opts, cur, cb) {
    const d = document.createElement('div');
    d.className = 'seg';
    opts.forEach(([name, val]) => {
      const b = document.createElement('button');
      b.textContent = name;
      if (val === cur) b.classList.add('on');
      b.onclick = () => cb(val);
      d.appendChild(b);
    });
    return d;
  }
  const vsep = () => { const s = document.createElement('span'); s.className = 'vsep'; return s; };

  function refreshProps() {
    const box = $('#props');
    const its = [...sel].map(byId).filter(Boolean);
    if (!its.length) { box.hidden = true; box.replaceChildren(); return; }
    box.hidden = false;
    box.replaceChildren();
    const f = its[0];
    const inkOnly = its.every(i => INKT.has(i.type));
    const pal = inkOnly ? INK : FILL;

    const sw = document.createElement('div');
    sw.className = 'swatches';
    pal.forEach(c => {
      const b = document.createElement('button');
      b.className = 'swatch' + (f.color === c ? ' on' : '') + (c === 'auto' ? ' auto' : '');
      b.title = 'Цвет';
      if (c !== 'auto') b.style.background = c;
      b.onclick = () => {
        its.forEach(i => { i.color = c; });
        if (f.type === 'sticky') defaults.sticky = c;
        else if (['rect', 'ellipse', 'diamond'].includes(f.type)) defaults.shape = c;
        else defaults.ink = c;
        commit(); render(); refreshProps();
      };
      sw.appendChild(b);
    });
    box.appendChild(sw);

    if (its.some(hasText)) {
      box.appendChild(vsep());
      box.appendChild(seg(SIZES, f.fs, v => { its.filter(hasText).forEach(i => { i.fs = v; }); commit(); render(); refreshProps(); }));
    }
    if (its.some(i => i.type === 'pen' || i.type === 'arrow')) {
      box.appendChild(vsep());
      box.appendChild(seg(WIDTHS, f.sw, v => {
        its.filter(i => i.type === 'pen' || i.type === 'arrow').forEach(i => { i.sw = v; });
        defaults.sw = v;
        commit(); render(); refreshProps();
      }));
    }
    const arrows = its.filter(i => i.type === 'arrow');
    if (arrows.length) {
      const on = arrows[0].head;
      const c = mkBtn('chip' + (on ? ' on' : ''), 'Наконечник', null, () => {
        arrows.forEach(a => { a.head = !on; });
        commit(); render(); refreshProps();
      });
      box.appendChild(c);
    }
    box.appendChild(vsep());
    box.appendChild(mkBtn('icon-btn sm', icon('copy'), 'Дублировать (Ctrl+D)', duplicateSel));
    box.appendChild(mkBtn('icon-btn sm', icon('front'), 'На передний план', () => reorder(true)));
    box.appendChild(mkBtn('icon-btn sm', icon('back'), 'На задний план', () => reorder(false)));
    box.appendChild(mkBtn('icon-btn sm danger', icon('trash'), 'Удалить (Del)', deleteSel));
    box.querySelectorAll('[data-tip]').forEach(b => { b.style.overflow = 'visible'; });
  }

  /* ---------- Указатель ---------- */
  function toWorld(e) {
    const r = stage.getBoundingClientRect();
    return { x: (e.clientX - r.left - view.x) / view.k, y: (e.clientY - r.top - view.y) / view.k };
  }

  function newItem(type, p, extra) {
    const base = { id: uid(), type };
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
    closeMenu();
    if (editing) endEdit();
    try { stage.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }

    // Два пальца — масштаб и перемещение (щипок)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch' });
    if (e.pointerType === 'touch' && pointers.size === 2) { startPinch(); return; }
    if (drag && drag.type === 'pinch') return;

    const p = toWorld(e);
    const now = performance.now();
    const dbl = now - lastDown.t < 350 && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < 6;
    lastDown = { t: now, x: e.clientX, y: e.clientY };

    if (e.button === 1 || tool === 'hand' || spaceDown) {
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
    d.starts = items.filter(i => ids.has(i.id)).map(i => JSON.parse(JSON.stringify(i)));
  }

  stage.addEventListener('pointermove', e => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch' });
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
        const min = it.type === 'text' ? 60 : 40;
        let { x, y, w, h } = o;
        if (d.h.includes('e')) w = Math.max(min, o.w + dx);
        if (d.h.includes('s')) h = Math.max(min, o.h + dy);
        if (d.h.includes('w')) { w = Math.max(min, o.w - dx); x = o.x + o.w - w; }
        if (d.h.includes('n')) { h = Math.max(min, o.h - dy); y = o.y + o.h - h; }
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

  const pointers = new Map();

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

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (drag && drag.type === 'pinch') {
      if (pointers.size < 2) { drag = null; scheduleSave(); }
      return;
    }
    const d = drag;
    drag = null;
    stage.classList.remove('grabbing');
    if (!d) return;
    const p = e && e.clientX !== undefined ? toWorld(e) : null;

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
    void p;
  }
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);
  stage.addEventListener('pointermove', e => hooks.cursor(toWorld(e)));

  /* ---------- Масштаб и вид ---------- */
  function zoomAt(cx, cy, f) {
    const k0 = view.k, k1 = Math.max(MIN_K, Math.min(MAX_K, k0 * f));
    if (k1 === k0) return;
    const wx = (cx - view.x) / k0, wy = (cy - view.y) / k0;
    view.k = k1;
    view.x = cx - wx * k1;
    view.y = cy - wy * k1;
    render();
    scheduleSave();
  }

  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    // Колесо мыши — масштаб; два пальца на трекпаде — перемещение; Ctrl/щипок — масштаб
    const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    const dx = e.deltaMode === 1 ? e.deltaX * 33 : e.deltaX;
    const mouseWheel = e.deltaMode !== 0 || (dx === 0 && Number.isInteger(dy) && Math.abs(dy) >= 50);
    if (e.shiftKey && !e.ctrlKey) {
      view.x -= dx || dy;
      render(); scheduleSave();
      return;
    }
    if (!e.ctrlKey && !e.metaKey && !mouseWheel) {
      view.x -= dx;
      view.y -= dy;
      render(); scheduleSave();
      return;
    }
    const f = Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015));
    zoomAt(e.clientX - r.left, e.clientY - r.top, f);
  }, { passive: false });

  function zoomCenter(f) { zoomAt(innerWidth / 2, innerHeight / 2, f); }
  function resetZoom() {
    const wx = (innerWidth / 2 - view.x) / view.k, wy = (innerHeight / 2 - view.y) / view.k;
    view.k = 1; view.x = innerWidth / 2 - wx; view.y = innerHeight / 2 - wy;
    render(); scheduleSave();
  }
  function fitView() {
    if (!items.length) { view = { x: innerWidth / 2, y: innerHeight / 2, k: 1 }; render(); return; }
    const b = union(items);
    const k = Math.max(MIN_K, Math.min(1.5, Math.min((innerWidth - 200) / Math.max(b.w, 1), (innerHeight - 220) / Math.max(b.h, 1))));
    view.k = k;
    view.x = innerWidth / 2 - (b.x + b.w / 2) * k;
    view.y = innerHeight / 2 - (b.y + b.h / 2) * k;
    render(); scheduleSave();
  }

  /* ---------- Клавиатура ---------- */
  document.addEventListener('keydown', e => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (document.body.classList.contains('modal-open')) return;
    const mod = e.ctrlKey || e.metaKey;

    if (e.code === 'Space') {
      e.preventDefault();
      if (!spaceDown) { spaceDown = true; stage.classList.add('space'); }
      return;
    }
    if (mod) {
      switch (e.code) {
        case 'KeyZ': e.preventDefault(); e.shiftKey ? redo() : undo(); return;
        case 'KeyY': e.preventDefault(); redo(); return;
        case 'KeyC': e.preventDefault(); copySel(); toast('Скопировано'); return;
        case 'KeyX': e.preventDefault(); if (copySel()) deleteSel(); return;
        case 'KeyV': e.preventDefault(); pasteClip(); return;
        case 'KeyD': e.preventDefault(); duplicateSel(); return;
        case 'KeyA': e.preventDefault(); setSel(items.map(i => i.id)); render(); return;
        case 'KeyS': e.preventDefault(); exportJSON(); return;
      }
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSel(); return; }
    if (e.key === 'Escape') { setTool('select'); return; }
    if (e.key === '+' || e.key === '=') { zoomCenter(1.2); return; }
    if (e.key === '-' || e.key === '_') { zoomCenter(1 / 1.2); return; }
    if (e.key === '0') { fitView(); return; }
    if (e.key === '1') { resetZoom(); return; }

    if (e.key.startsWith('Arrow') && !sel.size) {
      e.preventDefault();
      const st = e.shiftKey ? 240 : 60;
      view.x += e.key === 'ArrowLeft' ? st : e.key === 'ArrowRight' ? -st : 0;
      view.y += e.key === 'ArrowUp' ? st : e.key === 'ArrowDown' ? -st : 0;
      render(); scheduleSave();
      return;
    }
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
    if (tl) setTool(tl.id);
  });
  document.addEventListener('keyup', e => {
    if (e.code === 'Space') { spaceDown = false; stage.classList.remove('space'); }
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
    if (withBg) el('rect', { x, y, width: W, height: H }, { fill: '#FFFFFF' }, s);
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
  function exportPNG() {
    const r = buildSVG(true);
    if (!r) return toast('Доска пустая — экспортировать нечего');
    const str = new XMLSerializer().serializeToString(r.svg);
    const img = new Image();
    img.onload = () => {
      const sc = Math.min(2, 8000 / Math.max(r.W, r.H));
      const c = document.createElement('canvas');
      c.width = Math.round(r.W * sc); c.height = Math.round(r.H * sc);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => { download(b, fileBase() + '.png'); toast('PNG сохранён'); }, 'image/png');
    };
    img.onerror = () => toast('Не удалось создать PNG');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str);
  }
  function exportJSON() {
    endEdit();
    const data = { app: 'meaw board', version: 1, name: boardName, items, view };
    download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), fileBase() + '.json');
    toast('Доска сохранена');
  }
  function importJSON(file) {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const d = JSON.parse(rd.result);
        if (!d || !Array.isArray(d.items)) throw new Error('bad');
        endEdit();
        items = d.items;
        if (d.name) { boardName = d.name; $('#boardName').value = boardName; hooks.rename(boardName); }
        if (d.view) view = d.view;
        setSel([]);
        commit(); render(); refreshProps();
        toast('Доска открыта');
      } catch (err) { toast('Не удалось открыть файл'); }
    };
    rd.readAsText(file);
  }
  function clearBoard() {
    if (!items.length) return;
    if (!confirm('Очистить доску? Это действие можно отменить через Ctrl+Z.')) return;
    endEdit();
    items = [];
    setSel([]);
    commit(); render(); refreshProps();
  }

  /* ---------- UI ---------- */
  let toastTimer = null;
  function toast(msg) {
    const s = $('#snack');
    s.textContent = msg;
    s.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => s.classList.remove('show'), 2400);
  }

  const menu = $('#menu');
  function closeMenu() { menu.hidden = true; }
  $('#btnMenu').addEventListener('click', e => { e.stopPropagation(); menu.hidden = !menu.hidden; });
  document.addEventListener('click', e => { if (!menu.contains(e.target)) closeMenu(); });
  menu.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    closeMenu();
    ({ png: exportPNG, svg: exportSVG, json: exportJSON, open: () => $('#fileInput').click(), clear: clearBoard })[b.dataset.act]();
  });
  $('#fileInput').addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) importJSON(f);
    e.target.value = '';
  });

  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    $('#btnTheme').innerHTML = `<span data-icon>${icon(theme === 'dark' ? 'sun' : 'moon')}</span>`;
    $('#btnTheme').dataset.tip = theme === 'dark' ? 'Светлая тема' : 'Тёмная тема';
    document.querySelector('meta[name=theme-color]').content = theme === 'dark' ? '#141218' : '#6750A4';
  }
  $('#btnTheme').addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; applyTheme(); render(); scheduleSave(); });
  $('#btnGrid').addEventListener('click', () => { grid = !grid; $('#btnGrid').classList.toggle('on', grid); updateWorld(); scheduleSave(); });
  $('#btnUndo').addEventListener('click', undo);
  $('#btnRedo').addEventListener('click', redo);
  $('#zoomIn').addEventListener('click', () => zoomCenter(1.25));
  $('#zoomOut').addEventListener('click', () => zoomCenter(1 / 1.25));
  $('#zoomLabel').addEventListener('click', resetZoom);
  $('#zoomFit').addEventListener('click', fitView);

  const nameInput = $('#boardName');
  nameInput.addEventListener('input', () => { boardName = nameInput.value; document.title = (boardName.trim() || 'meaw board'); hooks.rename(boardName); });
  nameInput.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') nameInput.blur(); });

  // Ripple (Material)
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest('.icon-btn, .tool, .btn, .menu-item, .chip, .zoom-label, .seg button, .tab, .board-item');
    if (!b || b.disabled) return;
    const r = b.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const s = document.createElement('span');
    s.className = 'ripple';
    s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    b.appendChild(s);
    s.addEventListener('animationend', () => s.remove());
  });

  window.addEventListener('resize', () => { render(); });
  window.addEventListener('beforeunload', save);

  /* ---------- Запуск ---------- */
  function seedItems() {
    return [
      { id: 's1', type: 'sticky', x: -330, y: -190, w: 200, h: 200, color: '#FFF59D', fs: 20, text: 'Добро пожаловать в meaw board 🐾' },
      { id: 's2', type: 'sticky', x: -60, y: -190, w: 200, h: 200, color: '#F48FB1', fs: 18, text: 'Двойной клик по пустому месту — новый стикер' },
      { id: 's3', type: 'sticky', x: 210, y: -190, w: 200, h: 200, color: '#90CAF9', fs: 18, text: 'Колесо мыши — зум, Shift+колесо или Пробел — двигать доску' },
      { id: 'r1', type: 'rect', x: -60, y: 110, w: 200, h: 100, color: '#A5D6A7', fs: 20, text: 'Идея' },
      { id: 'a1', type: 'arrow', x1: 0, y1: 0, x2: 0, y2: 0, from: 's2', to: 'r1', color: 'auto', sw: 4, head: true },
      { id: 't1', type: 'text', x: -330, y: 110, w: 260, h: 0, color: 'auto', fs: 22, text: 'Рисуйте, соединяйте стрелками и экспортируйте в PNG' }
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
      b.onclick = () => setTool(t.id);
      tb.appendChild(b);
    });

    load();
    view = { x: innerWidth / 2, y: innerHeight / 2 - 20, k: 1 };
    items = [];
    hist = [JSON.stringify(items)];
    hi = 0;
    nameInput.value = boardName;
    document.title = boardName;
    $('#btnGrid').classList.toggle('on', grid);
    applyTheme();
    setTool('select', true);
    render();
    updateHistBtns();
  }

  function resetHistory() {
    clearTimeout(rebaseTimer);
    rebaseTimer = null;
    pendingRemote = [];
    hist = [JSON.stringify(items)];
    hi = 0;
    updateHistBtns();
  }

  // Интерфейс для app.js: аккаунты, список досок, совместная работа
  window.meawBoard = {
    hooks,
    icon,
    toast,
    seed: seedItems,
    getItems: () => items,
    getView: () => view,
    applyRemote,
    open(id, name, list) {
      endEdit();
      drag = null;
      curBoard = id;
      items = list;
      boardName = name;
      nameInput.value = name;
      document.title = name.trim() || 'meaw board';
      resetHistory();
      setSel([]);
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem('meaw-view-' + id)); } catch (e) { /* noop */ }
      if (saved && isFinite(saved.k) && isFinite(saved.x) && isFinite(saved.y)) view = saved;
      else view = { x: innerWidth / 2, y: innerHeight / 2 - 20, k: 1 };
      render();
      refreshProps();
      if (!saved && items.length) fitView();
    },
    replaceItems(list, name) {
      endEdit();
      drag = null;
      items = list;
      if (name != null) { boardName = name; nameInput.value = name; document.title = name.trim() || 'meaw board'; }
      resetHistory();
      sel = new Set([...sel].filter(id => byId(id)));
      render();
      refreshProps();
    },
    setName(name) {
      boardName = name;
      nameInput.value = name;
      document.title = name.trim() || 'meaw board';
    }
  };

  init();
})();
