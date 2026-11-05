/* Pixel Gridiron - shared utilities */
(function () {
  'use strict';
  const PG = (window.PG = window.PG || {});

  const U = {};
  U.rand = Math.random;
  U.rnd = (a, b) => a + Math.random() * (b - a);
  U.rndi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.chance = (p) => Math.random() < p;
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
  U.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  U.gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  U.norm = (mean, sd) => mean + U.gauss() * sd;
  U.sigmoid = (x) => 1 / (1 + Math.exp(-x));
  U.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  // weighted pick: items array, weight function
  U.wpick = (items, wf) => {
    let total = 0;
    const ws = items.map((it, i) => { const w = Math.max(0, wf(it, i)); total += w; return w; });
    if (total <= 0) return items[Math.floor(Math.random() * items.length)];
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  };
  U.sum = (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x), 0);
  U.avg = (arr, f) => (arr.length ? U.sum(arr, f) / arr.length : 0);
  U.range = (n) => Array.from({ length: n }, (_, i) => i);
  U.deep = (o) => JSON.parse(JSON.stringify(o));
  U.round1 = (v) => Math.round(v * 10) / 10;

  U.money = (n) => {
    const neg = n < 0; n = Math.abs(n);
    let s;
    if (n >= 1e9) s = '$' + (n / 1e9).toFixed(2) + 'B';
    else if (n >= 1e6) s = '$' + (n / 1e6).toFixed(n >= 1e8 ? 0 : 2) + 'M';
    else if (n >= 1e3) s = '$' + Math.round(n / 1e3) + 'K';
    else s = '$' + Math.round(n);
    return (neg ? '-' : '') + s;
  };
  U.num = (n) => Math.round(n).toLocaleString('en-US');
  U.ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  U.clockStr = (sec) => {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  };
  U.heightStr = (inches) => Math.floor(inches / 12) + "'" + (inches % 12) + '"';
  U.pct = (v) => Math.round(v * 100) + '%';

  // color helpers
  U.hexToRgb = (hex) => {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  U.rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => U.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  U.shade = (hex, amt) => {
    const [r, g, b] = U.hexToRgb(hex);
    if (amt >= 0) return U.rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
    return U.rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
  };
  U.luma = (hex) => {
    const [r, g, b] = U.hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  };

  // DOM builder: h('div.cls#id', {attrs}, children...)
  U.h = function (sel, props, ...kids) {
    const m = sel.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
    const el = document.createElement((m && m[1]) || 'div');
    if (m && m[2]) {
      m[2].replace(/([.#])([\w-]+)/g, (_, t, n) => {
        if (t === '.') el.classList.add(n); else el.id = n;
      });
    }
    if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
      kids.unshift(props); props = null;
    }
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'cls') el.className += ' ' + v;
        else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    const add = (k) => {
      if (k == null || k === false) return;
      if (Array.isArray(k)) k.forEach(add);
      else if (k instanceof Node) el.appendChild(k);
      else el.appendChild(document.createTextNode(String(k)));
    };
    kids.forEach(add);
    return el;
  };

  let _uid = 1;
  U.uid = () => _uid++;

  PG.U = U;
})();
