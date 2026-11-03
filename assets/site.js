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
// Charts are drawn at the width they are shown at, so their labels stay at the page's text size.
function frame(host, { w, h = 230, l = 52, r = 14, t = 14, b = 28 } = {}) {
  host.textContent = '';
  w = w || Math.max(300, Math.round(host.clientWidth || 560));
  const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img' }, host);
  return { svg, w, h, l, r, t, b, iw: w - l - r, ih: h - t - b };
}
const stepFor = (f, xs) => Math.ceil(xs.length / Math.max(3, Math.floor(f.iw / 46)));   // year labels that fit
function axes(f, xs, ymax, { every = 1, yfmt = fmt, ticks = 4 } = {}) {
  const band = f.iw / xs.length;
  for (let i = 0; i <= ticks; i++) {
    const v = ymax * i / ticks, y = f.t + f.ih - f.ih * i / ticks;
    el('line', { x1: f.l, x2: f.w - f.r, y1: y, y2: y, class: i ? 'gl' : 'ax' }, f.svg);
    txt(f.svg, f.l - 6, y + 4, yfmt(v), { 'text-anchor': 'end' });
  }
  const last = xs.length - 1;
  xs.forEach((x, i) => { if ((i % every === 0 && last - i >= every * .7) || i === last) txt(f.svg, f.l + band * (i + .5), f.h - 8, x, { 'text-anchor': 'middle' }); });
  return band;
}
function bars(host, xs, ys, { color = css('--chart-1'), every, label } = {}) {
  const f = frame(host), ymax = niceMax(Math.max(...ys)), band = axes(f, xs, ymax, { every: every || stepFor(f, xs) });
  ys.forEach((v, i) => {
    const hgt = f.ih * v / ymax, r = el('rect', { x: f.l + band * i + band * .15, y: f.t + f.ih - hgt, width: band * .7, height: Math.max(0, hgt), fill: color, rx: 1.5 }, f.svg);
    el('title', {}, r).textContent = `${xs[i]}: ${fmt(v)}${label ? ' ' + label : ''}`;
  });
}
function line(host, xs, ys, { color = css('--chart-2'), every, unit = '' } = {}) {
  const f = frame(host), ymax = niceMax(Math.max(...ys)), band = axes(f, xs, ymax, { every: every || stepFor(f, xs) });
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
  const f = frame(host), ymax = niceMax(Math.max(...tot)), band = axes(f, xs, ymax, { every: every || stepFor(f, xs), yfmt: short });
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
  const w = Math.max(300, Math.round(host.clientWidth || 560)), rowH = 30, l = Math.min(250, Math.round(w * .46));
  const f = frame(host, { w, h: rows.length * rowH + 8, l, r: 56, t: 4, b: 4 }), fit = Math.floor(l / 7.4);
  const max = Math.max(...rows.map(r => r[1]));
  rows.forEach(([name, v], i) => {
    const y = f.t + i * rowH;
    txt(f.svg, l - 8, y + 19, name.length > fit ? name.slice(0, fit - 1) + '…' : name, { 'text-anchor': 'end', style: `fill:${css('--ink-2')}` });
    el('rect', { x: l, y: y + 7, width: Math.max(2, f.iw * v / max), height: rowH - 13, fill: color, rx: 1.5 }, f.svg);
    txt(f.svg, l + f.iw * v / max + 6, y + 19, fmt(v), { style: `fill:${css('--ink-2')}` });
  });
}
const legend = (host, items) => { if (host.nextElementSibling?.classList.contains('legend')) host.nextElementSibling.remove(); const d = document.createElement('div'); d.className = 'legend'; d.innerHTML = items.map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join(''); host.after(d); };

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
window.PrioraCharts = { onResize: (...a) => onResize(...a), el, txt, frame, axes, stepFor, bars, line, stack, hbars, legend, fmt, short, niceMax, css };
// redraw charts at their new width when the window is resized
const onResize = fn => { let w = innerWidth, t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (innerWidth !== w) { w = innerWidth; fn(); } }, 200); }); };
if (document.querySelector('[data-k]')) fetch('data/pitch.json').then(r => r.json()).then(D => { fill(D); onResize(() => fill(D)); }).catch(() => {});

/* ---- contact form: not connected yet, says so ---- */
const form = $('#ask');
if (form) form.addEventListener('submit', ev => {
  ev.preventDefault();
  const note = $('#ask-note');
  if (!form.checkValidity()) { note.textContent = 'Please add your name and a work email.'; form.reportValidity(); return; }
  note.className = 'formnote ok';
  note.textContent = 'Thank you. This preview site is not connected yet, so nothing was sent.';
});

/* ---- architecture diagram: hover shows connections, click explains, steps filter (no motion) ---- */
const arch = document.getElementById('arch');
if (arch) {
  const X = {
    q: ['Research question', 'A plain question from the client, which the analyst turns into eight specific research questions.', 'The quality of the answer starts with the quality of the question.', 'Written by the analyst'],
    web: ['Open web', 'Public pages: manufacturer documents, journal articles, regulator notices and standards summaries.', 'Where new and specialised information appears first.', 'Searched privately through SearXNG, an open-source metasearch engine'],
    lit: ['Scientific literature', '38 million citations and abstracts from PubMed, the US National Library of Medicine index, held on the server.', 'Primary evidence: a finding can cite the paper behind it by its PubMed ID.', 'NLM PubMed baseline, loaded into PostgreSQL'],
    fda: ['FDA device records', 'FDA 510(k) clearances, PMA approvals and recalls, and 5.2 million device identifiers.', 'Shows what is already on the market, who makes it, how long FDA review took and what was recalled.', 'openFDA and AccessGUDID downloads'],
    mdr: ['Adverse-event reports', '26.6 million reports of device malfunctions, injuries and deaths filed with FDA, with their narratives.', 'The field record of how devices fail in real use.', 'FDA MAUDE files'],
    cfr: ['Regulations', 'Title 21 of the Code of Federal Regulations, Parts 800 to 898: the classification and controls for every device type.', 'Ties each device type to its rule, its class and its route to market.', 'eCFR'],
    cpc: ['Patent classification', 'The Cooperative Patent Classification: 254,314 codes used by the US and European patent offices.', 'Locates the inventions in a field and connects them to device types.', 'CPC scheme, 2026.08 release'],
    search: ['Private web search', 'Turns each research question into web searches, ranks the results and drafts an answer with numbered sources.', 'A fast first pass over the open web, without any cloud AI service seeing the question.', 'Vane (Perplexica) with SearXNG'],
    reader: ['Document reader', 'Downloads every source the search cited and keeps its full text, including PDFs and tables.', 'Search snippets are too short to check a claim against. The full text is not.', 'trafilatura and Docling'],
    libr: ['Research librarian', 'Looks the question up in an offline encyclopedia and the expert knowledge base, then follows their reference lists to the original papers.', 'Encyclopedias are never cited. The papers behind them are.', 'Daemon, with an offline copy of Wikipedia (Kiwix)'],
    expert: ['Expert knowledge', 'Curated, sourced notes on regulation, standards, patent law and device types, reviewed before they are added.', 'Gives the system an expert’s map: which rule applies, which standard, which product code.', 'Priora knowledge base, synced into the graph'],
    graph: ['Connected knowledge graph', 'One database that links device types, regulations, makers, recalls, field reports, patent classes, papers and expert notes.', 'Questions that cross sources (who makes this device type, what was recalled, which patents cover it) become a single query.', 'PostgreSQL with Apache AGE and pgvector'],
    meaning: ['Meaning search', 'Finds the passages that say the same thing as a claim, even when the wording differs.', 'Brings the right evidence to the fact checker out of thousands of pages.', 'Open-source text embeddings, computed on the server'],
    lm: ['Language model', 'An open-weight AI model that runs on the server’s own processor and does the reading and writing for every AI step.', 'No data goes to an outside AI provider, and there are no per-use fees.', 'Ollama serving open-weight models'],
    check: ['Fact checker', 'Splits each draft into single claims and tests every one against the source passages. A claim stands only if its exact quote is in the source and every number matches.', 'Catches the errors AI drafts make: wrong units, misattributed figures, invented limits.', 'Priora verifier, on the language model'],
    writer: ['Report writer', 'Writes the findings and the methods table from checked claims only, each tied to its sources.', 'Nothing reaches the report that has not passed the check.', 'Priora report step, on the language model'],
    o1: ['Checked findings', 'The main conclusions, each listing the claims and the sources behind it.', 'Every statement can be traced to its evidence.', ''],
    o2: ['Methods compared', 'How each method works, its stated performance, where it is used and its limits.', 'A side-by-side view for technical decisions.', ''],
    o3: ['Device and patent landscape', 'Clearances, makers, recalls, field reports and patent classes for the device types involved.', 'Shows the competition and the known failure modes before design starts.', ''],
    o4: ['Regulatory roadmap', 'The rule that applies, the route to market and the evidence plan.', 'Turns the research into the next regulatory steps.', ''],
    review: ['Expert review', 'A subject expert reads the checked claims and the corrections, and approves the report.', 'The AI does the reading. A person signs off.', ''],
    report: ['Client report', 'Published with a citation beside every finding and a log of every claim checked.', 'The client can see exactly how each conclusion was reached.', ''],
  };
  const STEPS = [
    ['The whole system.', 'Open data sets on the left, the AI tools and knowledge base in the middle, what the client receives on the right. Hover over a box to see what it connects to; click it for an explanation.'],
    ['1 · Ask.', 'A research question goes to a private web search, which finds and ranks sources. The question is never sent to a cloud AI service.'],
    ['2 · Read.', 'A document reader reads every source in full. A research librarian follows the references in an offline encyclopedia back to the original papers.'],
    ['3 · Connect.', 'Open data sets are held on the server and linked in one knowledge graph, guided by curated expert knowledge.'],
    ['4 · Check.', 'Every claim in the draft is matched to the source passages that bear on it. It stands only if the exact words and every number are in the source.'],
    ['5 · Deliver.', 'Only checked claims are written up. An expert reviews the result, and the client receives it with a citation beside every finding.'],
  ];
  const svg = arch.querySelector('.arch-svg'), text = arch.querySelector('.arch-text'), box = arch.querySelector('.arch-scroll');
  const btns = [...arch.querySelectorAll('.arch-steps [data-s]')];
  const nodes = [...svg.querySelectorAll('.node[data-id]')], links = [...svg.querySelectorAll('[data-n]')];
  const show = n => {
    arch.dataset.step = n;
    btns.forEach(b => +b.dataset.s === n ? b.setAttribute('aria-pressed', 'true') : b.setAttribute('aria-pressed', 'false'));
    text.innerHTML = `<b>${STEPS[n][0]}</b> ${STEPS[n][1]}`;
  };
  btns.forEach(b => b.addEventListener('click', () => show(arch.dataset.step === b.dataset.s ? 0 : +b.dataset.s)));

  const lit = id => {                             // highlight a box, its links and its neighbours
    arch.classList.toggle('hovering', !!id);
    const near = new Set([id]);
    links.forEach(l => { const on = !!id && l.dataset.n.split(' ').includes(id); l.classList.toggle('hl', on); if (on) l.dataset.n.split(' ').forEach(x => near.add(x)); });
    nodes.forEach(nd => { nd.classList.toggle('hl', !!id && near.has(nd.dataset.id)); nd.classList.toggle('self', nd.dataset.id === id); });
  };
  let open = null;
  const pop = document.createElement('div');
  pop.className = 'arch-pop'; pop.setAttribute('role', 'dialog'); pop.hidden = true;
  arch.append(pop);
  const close = () => { if (!open) return; const g = open; open = null; pop.hidden = true; g.setAttribute('aria-expanded', 'false'); lit(null); g.focus({ preventScroll: true }); };
  const explain = g => {
    const [t, what, why, built] = X[g.dataset.id] || [];
    if (!t) return;
    if (open) open.setAttribute('aria-expanded', 'false');
    open = g; g.setAttribute('aria-expanded', 'true'); lit(g.dataset.id);
    pop.setAttribute('aria-label', t);
    pop.innerHTML = `<button type="button" class="x" aria-label="Close">×</button><h3>${t}</h3><p>${what}</p><p><b>Why it matters.</b> ${why}</p>${built ? `<p class="built">Built with ${built}</p>` : ''}`;
    pop.hidden = false;
    pop.querySelector('.x').addEventListener('click', close);
    if (innerWidth < 700) { pop.style.left = pop.style.top = ''; pop.classList.add('sheet'); return; }
    pop.classList.remove('sheet');
    const r = g.getBoundingClientRect(), c = arch.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    let x = r.right - c.left + 12, y = r.top - c.top + r.height / 2 - h / 2;
    if (x + w > c.width - 4) x = r.left - c.left - w - 12;
    pop.style.left = Math.max(4, x) + 'px';
    pop.style.top = Math.max(4, y) + 'px';
  };
  nodes.forEach(g => {
    g.setAttribute('aria-expanded', 'false');
    g.addEventListener('mouseenter', () => { if (!open) lit(g.dataset.id); });
    g.addEventListener('mouseleave', () => { if (!open) lit(null); });
    g.addEventListener('focus', () => { if (!open) lit(g.dataset.id); });
    g.addEventListener('blur', () => { if (!open) lit(null); });
    g.addEventListener('click', ev => { ev.stopPropagation(); open === g ? close() : explain(g); });
    g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open === g ? close() : explain(g); } });
  });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') close(); });
  document.addEventListener('click', ev => { if (open && !pop.contains(ev.target)) close(); });
}

/* ---- report contents: highlight the section in view ---- */
const toc = document.querySelectorAll('.toc a');
if (toc.length && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) toc.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-30% 0px -60% 0px' });
  document.querySelectorAll('.finding[id]').forEach(s => io.observe(s));
}
})();
