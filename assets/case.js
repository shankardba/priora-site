/* Case-study pages: draws the FDA, field-report, patent-class, literature and research-method sections
   from data/case-<id>.json. Prose on the page is written and checked by hand; this only draws data. */
(() => {
const C = window.PrioraCharts, { fmt, short, css } = C;
const id = document.body.dataset.case;
const $ = s => document.getElementById(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sum = (a, k) => a.reduce((t, x) => t + (k ? x[k] : x), 0);

function lines(host, series, { every } = {}) {         // series: [{name, color, points: [[x, y]]}]
  const xs = [...new Set(series.flatMap(s => s.points.map(p => p[0])))].sort((a, b) => a - b);
  const max = C.niceMax(Math.max(1, ...series.flatMap(s => s.points.map(p => p[1]))));
  const f = C.frame(host), band = C.axes(f, xs, max, { every: every || Math.ceil(xs.length / 9), yfmt: short });
  for (const s of series) {
    const m = new Map(s.points);
    const pts = xs.map((x, i) => [f.l + band * (i + .5), f.t + f.ih - f.ih * (m.get(x) || 0) / max]);
    C.el('path', { d: 'M' + pts.map(p => p.join(',')).join('L'), fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round' }, f.svg);
  }
  C.legend(host, series.map(s => [s.name, s.color]));
}

function fdaTable(D) {
  const rows = D.groups.map((g, i) => {
    const c = g.codes, regs = [...new Set(c.map(x => x.regulation).filter(Boolean))];
    return `<tr><td><b>${esc(g.name)}</b><div class="codes">${c.map(x => `<span class="mono" title="${esc(x.device)}">${esc(x.code)}</span>`).join(' ')}</div></td>
      <td class="mono">${regs.map(r => '§' + esc(r)).join(' ')}</td><td>${[...new Set(c.map(x => x.class))].join(', ')}</td>
      <td class="num">${fmt(sum(c, 'k510'))}</td><td class="num">${fmt(sum(c, 'pma'))}</td><td class="num">${fmt(sum(c, 'recalls'))}</td><td class="num">${fmt(sum(c, 'maude'))}</td></tr>`;
  }).join('');
  $('fda-table').innerHTML = `<div class="tablewrap"><table class="data">
    <tr><th>Device group and FDA product codes</th><th>21 CFR</th><th>Class</th><th class="num">510(k)s</th><th class="num">PMAs</th><th class="num">Recalls</th><th class="num">Adverse-event reports</th></tr>${rows}</table></div>`;
}

function groupView(D, i) {
  const g = D.groups[i];
  document.querySelectorAll('#group-tabs button').forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
  const dec = g.decisions_by_year;
  if (dec.length) C.bars($('g-decisions'), dec.map(r => r[0]), dec.map(r => r[1]), { label: 'decisions' }); else $('g-decisions').innerHTML = '<p class="formnote">No premarket decisions on record.</p>';
  const ys = [...new Set(g.maude_by_year.map(r => r[0]))].sort();
  const kinds = [['Malfunction', css('--chart-3')], ['Injury', css('--chart-2')], ['Death', css('--chart-4')], ['Other', css('--rule-2')]];
  document.querySelectorAll('#g-maude + .legend').forEach(n => n.remove());
  if (ys.length) {
    const series = kinds.map(([k, c]) => ({ name: k, color: c, values: ys.map(y => g.maude_by_year.filter(r => r[0] === y && (r[1] === k || (k === 'Other' && !['Malfunction', 'Injury', 'Death'].includes(r[1])))).reduce((t, r) => t + r[2], 0)) }));
    C.stack($('g-maude'), ys, series); C.legend($('g-maude'), kinds);
  } else $('g-maude').innerHTML = '<p class="formnote">No adverse-event reports on record.</p>';
  if (g.maude_problems.length) C.hbars($('g-problems'), g.maude_problems.slice(0, 8), { color: css('--chart-1') }); else $('g-problems').textContent = '';
  if (g.recall_causes.length) C.hbars($('g-causes'), g.recall_causes.slice(0, 6), { color: css('--chart-4') }); else $('g-causes').innerHTML = '<p class="formnote">No recalls on record.</p>';
  const days = g.review_days_by_year.slice(-8);
  $('g-days').textContent = days.length ? `Median 510(k) review, recent years: ${days.map(d => `${d[0]} ${d[2]} days`).join(' · ')}` : 'Too few recent 510(k) decisions for a review-time trend.';
  const m = sum(g.codes, 'maude'), deaths = g.maude_by_year.filter(r => r[1] === 'Death').reduce((t, r) => t + r[2], 0);
  $('g-summary').textContent = `${g.name}: ${fmt(sum(g.codes, 'k510'))} 510(k)s and ${fmt(sum(g.codes, 'pma'))} PMAs from ${fmt(Math.max(...g.codes.map(c => c.makers)))}+ makers · ${fmt(sum(g.codes, 'recalls'))} recalls · ${fmt(m)} adverse-event reports (${fmt(deaths)} deaths reported).`;
}

function groups(D) {
  $('group-tabs').innerHTML = D.groups.map((g, i) => `<button type="button" class="tab" aria-pressed="false" data-i="${i}">${esc(g.name)}</button>`).join('');
  $('group-tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) groupView(D, +b.dataset.i); });
  const start = Math.max(0, D.groups.findIndex(g => g.codes.some(c => c.maude > 0)));
  groupView(D, D.groups.reduce((best, g, i) => sum(g.codes, 'maude') > sum(D.groups[best].codes, 'maude') ? i : best, start));
}

function textPhrase(D) {
  const g = D.groups.find(g => g.text_by_year);
  if (!g || !$('text-chart')) return;
  const r = g.text_by_year.filter(x => x[0] >= 2000);
  C.bars($('text-chart'), r.map(x => x[0]), r.map(x => x[1]), { color: css('--chart-4'), label: `reports mentioning “${g.text_phrase}”` });
  if ($('text-total')) $('text-total').textContent = fmt(sum(g.text_by_year.map(x => x[1])));
}

function cpc(D) {
  if (!$('cpc-list')) return;
  $('cpc-list').innerHTML = D.cpc.map(c => `<div><span class="mono">${esc(c.symbol)}</span><span>${esc(c.title)}<small>under ${esc(c.parent)} · ${esc(c.parent_title || '')}</small></span><span class="n">${c.beneath ? fmt(c.beneath) + ' sub-groups' : ''}</span></div>`).join('');
}

function pubmed(D) {
  if (!$('lit-chart')) return;
  if (!D.pubmed) { $('lit-chart').innerHTML = '<p class="formnote">The PubMed index is still loading; this chart fills in when it completes.</p>'; return; }
  const cols = [css('--chart-1'), css('--chart-2'), css('--chart-4')];
  lines($('lit-chart'), D.pubmed.map((p, i) => ({ name: p.label, color: cols[i % 3], points: p.by_year.filter(r => r[0] >= 1975 && r[0] <= 2025) })));
  $('lit-top').innerHTML = D.pubmed.map(p => `<h4>${esc(p.label)} <small>${fmt(sum(p.by_year.map(r => r[1])))} papers</small></h4><ul>${p.top.slice(0, 4).map(a => `<li>${esc(a.title)} <span class="cite">${esc(a.journal || '')} ${a.year || ''} · <a href="https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/" target="_blank" rel="noopener">PMID ${a.pmid}</a></span></li>`).join('')}</ul>`).join('');
}

function research(D) {
  const R = D.research; if (!R || !$('r-stats')) return;
  $('r-stats').innerHTML = `
    <div><b>${R.questions.length}</b><span>research questions</span></div>
    <div><b>${fmt(R.sources)}</b><span>web sources read</span></div>
    <div><b>${fmt(R.domains)}</b><span>distinct websites</span></div>
    <div><b>${Math.round(R.seconds / 60)} min</b><span>on the local model</span></div>`;
  $('r-questions').innerHTML = R.questions.map(q => `<li>${esc(q.q)} <span class="cite">${q.sources} sources · ${Math.round(q.seconds / 60 * 10) / 10} min</span></li>`).join('');
  $('r-domains').textContent = R.top_domains.map(d => `${d[0]} (${d[1]})`).join(' · ');
  $('r-model').textContent = R.model;
}

const TIER = { primary: 'Paper', regulatory: 'Regulator or standard', industry: 'Manufacturer', other: 'Other' };
const VERDICT = { supported: 'Supported', partly: 'Corrected', not_found: 'Not found in sources', contradicted: 'Contradicted' };
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const refLink = r => `<a href="${esc(r.url)}" target="_blank" rel="noopener" title="${esc(r.title || r.url)}">${esc(r.url.includes('pubmed.ncbi') ? 'PMID ' + r.url.match(/\d+/)[0] : host(r.url))}</a> <span class="tier">${TIER[r.tier] || r.tier}</span>`;

function report(D) {
  const R = D.research?.report;
  const none = '<p class="formnote">The checked findings appear here once the case has been through verification.</p>';
  if ($('findings-list')) $('findings-list').innerHTML = !R ? none : R.findings.map((f, i) => `<li><span>${String(i + 1).padStart(2, '0')}</span><div>
      <b>${esc(f.headline)}</b><p>${esc(f.detail)}</p><p class="cite">${f.refs.map(refLink).join(' · ')} · claims ${f.claims.join(', ')}</p></div></li>`).join('');
  if ($('methods-table')) $('methods-table').innerHTML = !R ? none : `<div class="tablewrap"><table class="methods">
      <tr><th>Method</th><th>Principle</th><th>Measures</th><th>Stated performance</th><th>Used in</th><th>Limitations</th><th>Evidence</th></tr>
      ${R.methods.map(m => `<tr><td><b>${esc(m.method)}</b></td><td>${esc(m.principle)}</td><td>${esc(m.measures)}</td><td>${esc(m.performance) || '—'}</td>
        <td>${esc(m.setting)}</td><td>${esc(m.limitations)}</td><td class="cite">${m.refs.map(refLink).join('<br>')}</td></tr>`).join('')}</table></div>`;
  if (!R || !$('review-log')) return;
  const t = R.tally, n = t.supported + t.partly + t.not_found + t.contradicted;
  $('review-tally').innerHTML = Object.entries(VERDICT).map(([k, v]) => `<div class="v-${k}"><b>${t[k]}</b><span>${v}</span></div>`).join('') +
    `<div><b>${Math.round(100 * t.supported / Math.max(1, n))}%</b><span>of ${n} draft claims held up as written</span></div>`;
  const show = k => {
    document.querySelectorAll('#review-filter button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === k)));
    const rows = R.claims.filter(c => k === 'all' || c.verdict === k);
    $('review-log').innerHTML = rows.map(c => `<li class="v-${c.verdict}"><span class="badge">${VERDICT[c.verdict]}</span><div>
      <p class="claim">${esc(c.claim)}</p>
      ${c.correction && c.verdict !== 'supported' ? `<p class="fix"><b>Source says:</b> ${esc(c.correction)}</p>` : ''}
      ${c.quote ? `<blockquote>${esc(c.quote)}</blockquote>` : ''}
      <p class="cite">Q${c.question}${c.evidence ? ' · ' + refLink(c.evidence) : ''}${c.flags?.length ? ' · check: ' + esc(c.flags.join('; ')) : ''}</p></div></li>`).join('');
  };
  $('review-filter').innerHTML = [['partly', 'Corrected'], ['contradicted', 'Contradicted'], ['not_found', 'Not found'], ['supported', 'Supported'], ['all', 'All']]
    .map(([k, v]) => `<button type="button" class="tab" data-k="${k}" aria-pressed="false">${v} (${k === 'all' ? R.claims.length : t[k]})</button>`).join('');
  $('review-filter').addEventListener('click', e => { const b = e.target.closest('button'); if (b) show(b.dataset.k); });
  show(t.partly ? 'partly' : 'all');
}

function tiers(D) {
  const F = D.research?.fetched; if (!F || !$('r-tiers')) return;
  $('r-tiers').textContent = `${fmt(F.with_text)} of ${fmt(F.total)} sources read in full · ` +
    Object.entries(F.tiers).map(([k, v]) => `${k === 'secondary' ? 'secondary (never cited)' : (TIER[k] || k).toLowerCase()} ${v}`).join(' · ') +
    (F.papers_via_daemon ? ` · ${F.papers_via_daemon} papers found through Daemon's reference trail` : '');
}

fetch(`data/case-${id}.json`).then(r => r.json()).then(D => {
  fdaTable(D); groups(D); textPhrase(D); cpc(D); pubmed(D); research(D); report(D); tiers(D);
  document.querySelectorAll('[data-c]').forEach(n => { const v = n.dataset.c.split('.').reduce((o, k) => o?.[k], D); if (v != null) n.textContent = typeof v === 'number' ? fmt(v) : v; });
}).catch(e => console.error(e));
})();
