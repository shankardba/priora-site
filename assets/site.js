/* Priora site: fills figures from data/pitch.json and draws small SVG charts.
   Pages carry the same figures as static text, so they read correctly before (or without) this script. */
(() => {
const $ = s => document.querySelector(s);
const fmt = n => Number(n).toLocaleString('en-US');
const short = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : fmt(n);
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const txt = (parent, x, y, s, attrs = {}) => { const t = el('text', { x, y, ...attrs }, parent); t.textContent = s; return t; };
const niceMax = v => { const p = Math.pow(10, Math.floor(Math.log10(v || 1))); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p; return 10 * p; };

/* ---- charts: one frame, bars / line / stacked bars / horizontal bars ---- */
function frame(host, { w = 560, h = 220, l = 40, r = 12, t = 12, b = 26 } = {}) {
  host.textContent = '';
  const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img' }, host);
  return { svg, w, h, l, r, t, b, iw: w - l - r, ih: h - t - b };
}
function axes(f, xs, ymax, { every = 1, yfmt = fmt, ticks = 4 } = {}) {
  const band = f.iw / xs.length;
  for (let i = 0; i <= ticks; i++) {
    const v = ymax * i / ticks, y = f.t + f.ih - f.ih * i / ticks;
    el('line', { x1: f.l, x2: f.w - f.r, y1: y, y2: y, class: i ? 'gl' : 'ax' }, f.svg);
    txt(f.svg, f.l - 6, y + 4, yfmt(v), { 'text-anchor': 'end' });
  }
  xs.forEach((x, i) => { if (i % every === 0 || i === xs.length - 1) txt(f.svg, f.l + band * (i + .5), f.h - 8, x, { 'text-anchor': 'middle' }); });
  return band;
}
function bars(host, xs, ys, { color = css('--chart-1'), every, label } = {}) {
  const f = frame(host), ymax = niceMax(Math.max(...ys)), band = axes(f, xs, ymax, { every: every || Math.ceil(xs.length / 9) });
  ys.forEach((v, i) => {
    const hgt = f.ih * v / ymax, r = el('rect', { x: f.l + band * i + band * .15, y: f.t + f.ih - hgt, width: band * .7, height: Math.max(0, hgt), fill: color, rx: 1.5 }, f.svg);
    el('title', {}, r).textContent = `${xs[i]}: ${fmt(v)}${label ? ' ' + label : ''}`;
  });
}
function line(host, xs, ys, { color = css('--chart-2'), every, unit = '' } = {}) {
  const f = frame(host), ymax = niceMax(Math.max(...ys)), band = axes(f, xs, ymax, { every: every || Math.ceil(xs.length / 9) });
  const pts = ys.map((v, i) => [f.l + band * (i + .5), f.t + f.ih - f.ih * v / ymax]);
  el('path', { d: `M${pts.map(p => p.join(',')).join('L')}L${pts.at(-1)[0]},${f.t + f.ih}L${pts[0][0]},${f.t + f.ih}Z`, fill: color, opacity: .12 }, f.svg);
  el('path', { d: 'M' + pts.map(p => p.join(',')).join('L'), fill: 'none', stroke: color, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, f.svg);
  pts.forEach((p, i) => {
    const c = el('circle', { cx: p[0], cy: p[1], r: i === pts.length - 1 ? 4.5 : 3, fill: i === pts.length - 1 ? color : css('--surface'), stroke: color, 'stroke-width': 1.8 }, f.svg);
    el('title', {}, c).textContent = `${xs[i]}: ${fmt(ys[i])}${unit}`;
  });
  const last = pts.at(-1); txt(f.svg, last[0] - 8, last[1] - 10, fmt(ys.at(-1)) + unit, { 'text-anchor': 'end', style: `fill:${color};font-weight:600` });
}
function stack(host, xs, series, { every } = {}) {         // series: [{name, color, values}]
  const tot = xs.map((_, i) => series.reduce((t, s) => t + s.values[i], 0));
  const f = frame(host), ymax = niceMax(Math.max(...tot)), band = axes(f, xs, ymax, { every: every || Math.ceil(xs.length / 9), yfmt: short });
  xs.forEach((x, i) => {
    let base = 0;
    for (const s of series) {
      const v = s.values[i]; if (!v) continue;
      const h = f.ih * v / ymax, r = el('rect', { x: f.l + band * i + band * .15, y: f.t + f.ih - base - h, width: band * .7, height: h, fill: s.color }, f.svg);
      el('title', {}, r).textContent = `${x} · ${s.name}: ${fmt(v)}`; base += h;
    }
  });
}
function hbars(host, rows, { color = css('--chart-1') } = {}) {
  const w = 560, rowH = 26, l = 230, f = frame(host, { w, h: rows.length * rowH + 8, l, r: 46, t: 4, b: 4 });
  const max = Math.max(...rows.map(r => r[1]));
  rows.forEach(([name, v], i) => {
    const y = f.t + i * rowH;
    txt(f.svg, l - 8, y + 17, name.length > 36 ? name.slice(0, 35) + '…' : name, { 'text-anchor': 'end', style: `fill:${css('--ink-2')};font-size:12px` });
    el('rect', { x: l, y: y + 5, width: Math.max(2, f.iw * v / max), height: rowH - 10, fill: color, rx: 1.5 }, f.svg);
    txt(f.svg, l + f.iw * v / max + 6, y + 17, fmt(v), { style: `fill:${css('--ink-2')};font-size:12px` });
  });
}
const legend = (host, items) => { const d = document.createElement('div'); d.className = 'legend'; d.innerHTML = items.map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join(''); host.after(d); };

/* ---- data ---- */
function fill(D) {
  const ex = D.example, ky = ex.k510_by_year, full = ky.filter(r => r[1] >= 5);
  const recalls = ex.recalls_by_year.reduce((t, r) => t + r[1], 0);
  const vals = {
    'ex.k510': fmt(ex.k510_total), 'ex.makers': fmt(ex.makers), 'ex.recalls': fmt(recalls),
    'ex.lastYear': full.at(-1)[0], 'ex.lastDays': fmt(full.at(-1)[2]),
    'ex.topCause': (ex.recall_causes[0]?.[0] || '').toLowerCase().replace('/', ' or '),
    'ex.top5': Math.round(ex.top5_share * 100) + '%', 'ex.gudid': fmt(ex.gudid_devices),
    't.k510': fmt(D.totals.k510), 't.maude': ex.maude_complete ? short(D.totals.maude) : '26.6M', 't.gudid': short(D.totals.gudid),
    't.recalls': fmt(D.totals.recalls), 't.product_codes': fmt(D.totals.product_codes), 't.cfr': fmt(D.totals.cfr),
    't.cpc': fmt(D.totals.cpc), 't.pma': fmt(D.totals.pma), 'gen': `Figures as of ${D.generated_at}`,
  };
  document.querySelectorAll('[data-k]').forEach(n => { if (vals[n.dataset.k] != null) n.textContent = vals[n.dataset.k]; });

  const years = ky.map(r => r[0]);
  const h = id => document.getElementById(id);
  if (h('mini-chart')) bars(h('mini-chart'), years, ky.map(r => r[1]), { label: '510(k)s' });
  if (h('days-chart')) line(h('days-chart'), full.map(r => r[0]), full.map(r => r[2]), { unit: ' days' });
  if (h('k-chart')) { bars(h('k-chart'), years, ky.map(r => r[1]), { label: '510(k)s' }); }
  if (h('k-days')) line(h('k-days'), full.map(r => r[0]), full.map(r => r[2]), { unit: ' days' });
  if (h('r-chart')) { const ry = ex.recalls_by_year; bars(h('r-chart'), ry.map(r => r[0]), ry.map(r => r[1]), { color: css('--chart-4'), label: 'recalls' }); }
  if (h('r-causes')) hbars(h('r-causes'), ex.recall_causes, { color: css('--chart-4') });
  if (h('m-chart')) {
    const ys = [...new Set(ex.maude_by_year.map(r => r[0]))].sort();
    const kinds = [['Malfunction', css('--chart-3')], ['Injury', css('--chart-2')], ['Death', css('--chart-4')], ['Other', css('--rule-2')]];
    const series = kinds.map(([k, c]) => ({ name: k, color: c, values: ys.map(y => ex.maude_by_year.filter(r => r[0] === y && (r[1] === k || (k === 'Other' && !['Malfunction', 'Injury', 'Death'].includes(r[1])))).reduce((t, r) => t + r[2], 0)) }));
    stack(h('m-chart'), ys, series); legend(h('m-chart'), kinds);
    const tot = ex.maude_by_year.reduce((t, r) => t + r[2], 0), deaths = ex.maude_by_year.filter(r => r[1] === 'Death').reduce((t, r) => t + r[2], 0);
    if (h('m-tot')) h('m-tot').textContent = fmt(tot);
    if (h('m-deaths')) h('m-deaths').textContent = fmt(deaths);
    if (h('m-note') && !ex.maude_complete) h('m-note').hidden = false;
  }
  if (h('ct-list')) h('ct-list').textContent = ex.clearance_types.map(([t, n]) => `${t} ${fmt(n)}`).join(' · ');
}
fetch('data/pitch.json').then(r => r.json()).then(fill).catch(() => {});

/* ---- contact form: not connected yet, says so ---- */
const form = $('#ask');
if (form) form.addEventListener('submit', ev => {
  ev.preventDefault();
  const note = $('#ask-note');
  if (!form.checkValidity()) { note.textContent = 'Please add your name and a work email.'; form.reportValidity(); return; }
  note.className = 'formnote ok';
  note.textContent = 'Thank you. This preview site is not connected yet, so nothing was sent.';
});

/* ---- report contents: highlight the section in view ---- */
const toc = document.querySelectorAll('.toc a');
if (toc.length && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) toc.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-30% 0px -60% 0px' });
  document.querySelectorAll('.finding[id]').forEach(s => io.observe(s));
}
})();
