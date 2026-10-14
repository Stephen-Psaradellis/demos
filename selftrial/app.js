// SelfTrial UI. Plain DOM, no framework, no server: everything lives in this device's storage.
import { MEASURES, GENERAL, scoreDay, planTrial, phaseOn, analyzeTrial, foodHints, toFHIR, toCSV, addDays, daysBetween } from './stats.js';
import { demoData } from './demo.js';

const KEY = 'selftrial.v1';
const CONDITIONS = { none: 'Other / not listed', crohns: "Crohn's disease", uc: 'Ulcerative colitis', ra: 'Rheumatoid arthritis' };
const MODULE_MEASURE = { crohns: 'hbi', uc: 'sccai', ra: 'ra' };
const SYMPTOM_LABEL = { fatigue: 'Fatigue', pain: 'Pain', gi: 'Gut symptoms', sleep: 'Sleep quality (10 = slept well)', mood: 'Low mood' };

let db = load();
let tab = 'today';
let day = today();
let prefill = null;

function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch { /* private mode etc. */ }
  return { profile: null, trial: null, entries: [] };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* keep working in memory */ }
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel) => document.querySelector(sel);
const entryFor = (date) => db.entries.find((e) => e.date === date);

function entry(date) {
  let e = entryFor(date);
  if (!e) {
    e = { date, meals: [], symptoms: {}, module: { condition: db.profile?.condition || 'none' }, notes: '' };
    db.entries.push(e);
    db.entries.sort((a, b) => a.date.localeCompare(b.date));
  }
  return e;
}

// ---------------- views ----------------
function render() {
  document.querySelectorAll('nav button').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
  $('#who').textContent = db.profile ? CONDITIONS[db.profile.condition] : '';
  const v = $('#view');
  if (!db.profile) { v.innerHTML = onboarding(); return bindOnboarding(); }
  v.innerHTML = { today: viewToday, trial: viewTrial, insights: viewInsights, share: viewShare }[tab]() + footer();
  ({ today: bindToday, trial: bindTrial, insights: bindInsights, share: bindShare })[tab]();
}

function footer() {
  return `<p class="foot">Prototype for tracking only - not medical advice. Talk to your clinician or dietitian before
  changing your diet. Your data stays on this device. Built with AI assistance (Claude).
  <a href="feedback.html">Give feedback</a></p>`;
}

function onboarding() {
  return `<section class="card"><h2>Welcome</h2>
  <p>SelfTrial helps you log what you eat next to how you feel, then <b>test</b> one diet change at a time
  with a small, fair experiment on yourself - instead of guessing.</p>
  <label for="cond">Your condition</label>
  <select id="cond">${Object.entries(CONDITIONS).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select>
  <button class="btn" id="start">Start</button>
  <button class="btn ghost" id="demo">Explore with fictional demo data</button>
  <p class="mute">No account. Nothing leaves this device unless you export it.</p></section>` + footer();
}
function bindOnboarding() {
  $('#start').onclick = () => { db.profile = { condition: $('#cond').value }; save(); render(); };
  $('#demo').onclick = () => { db = demoData({ start: addDays(today(), -60) }); day = db.entries.at(-1).date; save(); render(); };
}

function phaseBanner(date) {
  if (!db.trial) return '';
  const b = phaseOn(db.trial, date);
  if (!b) return date > db.trial.end ? `<div class="phase A">Trial "${esc(db.trial.change)}" finished - see the Trial tab.</div>` : '';
  const dayIn = daysBetween(b.start, date) + 1;
  const wash = dayIn <= db.trial.washoutDays;
  return `<div class="phase ${b.phase}"><b>${b.phase === 'B' ? esc(db.trial.change) : 'Usual diet'}</b>
    - pair ${b.pair + 1} of ${db.trial.pairs}, day ${dayIn} of ${db.trial.blockDays}${wash ? ' (washout: logged, not scored)' : ''}</div>`;
}

function slider(id, label, val, max = 10) {
  const has = typeof val === 'number';
  return `<div class="slider"><label for="${id}">${esc(label)} <output id="${id}-o">${has ? val : '-'}</output></label>
  <input type="range" id="${id}" min="0" max="${max}" step="1" value="${has ? val : 0}" data-set="${has ? 1 : 0}"></div>`;
}

function moduleFields(m) {
  const c = db.profile.condition;
  if (c === 'crohns') return `<h2>Crohn's check-in <span class="mute">(HBI patient items)</span></h2>
    ${slider('m-wellbeing', 'General well-being (0 very well - 4 terrible)', m.wellbeing, 4)}
    ${slider('m-abdPain', 'Abdominal pain (0 none - 3 severe)', m.abdPain, 3)}
    <label for="m-liquidStools">Liquid or soft stools today</label><input type="number" min="0" id="m-liquidStools" value="${m.liquidStools ?? ''}">
    <p class="mute">The abdominal-mass item needs an exam, so it is left out.</p>`;
  if (c === 'uc') return `<h2>Colitis check-in <span class="mute">(SCCAI)</span></h2>
    <div class="row"><div><label for="m-dayStools">Stools by day</label><input type="number" min="0" id="m-dayStools" value="${m.dayStools ?? ''}"></div>
    <div><label for="m-nightStools">Stools at night</label><input type="number" min="0" id="m-nightStools" value="${m.nightStools ?? ''}"></div></div>
    ${slider('m-urgency', 'Urgency (0 none - 3 incontinence)', m.urgency, 3)}
    ${slider('m-blood', 'Blood in stool (0 none - 3 frank)', m.blood, 3)}
    ${slider('m-wellbeing', 'General well-being (0 very well - 4 terrible)', m.wellbeing, 4)}`;
  if (c === 'ra') return `<h2>RA check-in <span class="mute">(pain + patient global)</span></h2>
    ${slider('m-pain', 'Joint pain', m.pain)}${slider('m-global', 'How is your arthritis overall (10 = very poorly)', m.global)}`;
  return '';
}

function viewToday() {
  const e = entryFor(day) || { meals: [], symptoms: {}, module: {}, notes: '' };
  return `${phaseBanner(day)}
  <section class="card"><div class="row"><div><label for="day">Day</label><input type="date" id="day" value="${day}" max="${today()}"></div></div></section>
  <section class="card"><h2>Food</h2>
    ${e.meals.map((m, i) => `<div class="meal"><span><b>${esc(m.time || '')}</b> ${esc(m.text)}<br>${(m.tags || []).map((t) => `<span class="pill">${esc(t)}</span>`).join('')}</span><button data-del="${i}" aria-label="Remove meal">x</button></div>`).join('') || '<p class="mute">Nothing logged yet.</p>'}
    <div class="row"><div style="flex:0 0 96px"><label for="mt">Time</label><input type="time" id="mt"></div><div><label for="mx">What you ate</label><input id="mx" placeholder="oats with milk"></div></div>
    <label for="mtags">Foods to track (comma separated)</label><input id="mtags" placeholder="oats, milk">
    <button class="btn ghost" id="addmeal">Add food</button></section>
  <section class="card"><h2>How you feel today <span class="mute">(0 none - 10 worst)</span></h2>
    ${GENERAL.map((k) => slider(`s-${k}`, SYMPTOM_LABEL[k], e.symptoms[k])).join('')}</section>
  ${moduleFields(e.module || {}) ? `<section class="card">${moduleFields(e.module || {})}</section>` : ''}
  <section class="card"><label for="notes">Notes (meds, stress, period, travel...)</label><textarea id="notes" rows="2">${esc(e.notes)}</textarea>
  <button class="btn" id="save">Save day</button> <span class="mute" id="saved"></span></section>`;
}
function bindToday() {
  $('#day').onchange = (ev) => { day = ev.target.value || today(); render(); };
  document.querySelectorAll('input[type=range]').forEach((r) => {
    r.oninput = () => { r.dataset.set = 1; $(`#${r.id}-o`).textContent = r.value; };
  });
  $('#addmeal').onclick = () => {
    const text = $('#mx').value.trim();
    if (!text) return;
    const tags = ($('#mtags').value || text).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    entry(day).meals.push({ time: $('#mt').value, text, tags });
    save(); render();
  };
  document.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => { entry(day).meals.splice(+b.dataset.del, 1); save(); render(); }; });
  $('#save').onclick = () => {
    const e = entry(day);
    for (const k of GENERAL) { const r = $(`#s-${k}`); if (r.dataset.set === '1') e.symptoms[k] = +r.value; }
    const m = { condition: db.profile.condition };
    document.querySelectorAll('[id^="m-"]').forEach((el) => {
      if (el.id.endsWith('-o')) return;
      if (el.type === 'range' && el.dataset.set !== '1') return;
      if (el.value !== '') m[el.id.slice(2)] = +el.value;
    });
    if (db.profile.condition === 'crohns') m.complications = e.module?.complications || [];
    if (db.profile.condition === 'uc') m.extracolonic = e.module?.extracolonic || [];
    e.module = m;
    e.notes = $('#notes').value;
    save();
    $('#saved').textContent = 'Saved.';
  };
}

function measureOptions(sel) {
  const mod = MODULE_MEASURE[db.profile.condition];
  return Object.entries(MEASURES).filter(([k]) => !['hbi', 'sccai', 'ra'].includes(k) || k === mod)
    .map(([k, m]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(m.label)}</option>`).join('');
}

function chart(measure, from, to, plan) {
  const W = 600, H = 190, pad = 28;
  const n = daysBetween(from, to) + 1;
  const x = (d) => pad + (daysBetween(from, d) / Math.max(1, n - 1)) * (W - 2 * pad);
  const vals = db.entries.filter((e) => e.date >= from && e.date <= to).map((e) => [e.date, scoreDay(e, measure)]).filter(([, v]) => typeof v === 'number');
  const max = Math.max(10, ...vals.map(([, v]) => v));
  const y = (v) => H - pad - (v / max) * (H - 2 * pad);
  const bands = plan ? plan.blocks.map((b) => `<rect x="${x(b.start) - 3}" y="${pad / 2}" width="${x(b.end) - x(b.start) + 6}" height="${H - 1.5 * pad}" fill="var(--${b.phase.toLowerCase()})" opacity=".28"/>`).join('') : '';
  const path = vals.map(([d, v], i) => `${i ? 'L' : 'M'}${x(d).toFixed(1)},${y(v).toFixed(1)}`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(MEASURES[measure].label)} from ${from} to ${to}">
    ${bands}<line x1="${pad}" x2="${W - pad}" y1="${H - pad}" y2="${H - pad}" stroke="var(--line)"/>
    <path d="${path}" fill="none" stroke="var(--ink)" stroke-width="2"/>
    ${vals.map(([d, v]) => `<circle cx="${x(d).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.5" fill="var(--ink)"/>`).join('')}
    <text x="${pad}" y="${H - 6}" font-size="20" fill="var(--mute)">${from}</text>
    <text x="${W - pad}" y="${H - 6}" font-size="20" fill="var(--mute)" text-anchor="end">${to}</text></svg>`;
}

function viewTrial() {
  if (!db.trial) {
    const p = prefill || {};
    return `<section class="card"><h2>Test one diet change</h2>
    <p class="mute">You alternate between your usual diet (A) and the change (B) in short blocks. The order inside each pair
    is drawn at random, so a good or bad week cannot fake a result. The first days of each block are a washout and are not scored.</p>
    <label for="t-change">The change</label><input id="t-change" value="${esc(p.change || '')}" placeholder="no dairy">
    <label for="t-measure">Judge it by</label><select id="t-measure">${measureOptions(p.measure || 'burden')}</select>
    <div class="row"><div><label for="t-days">Days per block</label><input type="number" id="t-days" min="3" value="5"></div>
    <div><label for="t-pairs">Pairs</label><input type="number" id="t-pairs" min="2" value="6"></div>
    <div><label for="t-wash">Washout days</label><input type="number" id="t-wash" min="0" value="2"></div></div>
    <label for="t-start">Start</label><input type="date" id="t-start" value="${today()}">
    <p class="mute" id="t-len"></p>
    <button class="btn" id="t-go">Plan my trial</button></section>`;
  }
  const t = db.trial;
  const r = analyzeTrial(t, db.entries);
  return `${phaseBanner(today())}<section class="card"><h2>${esc(t.change)} <span class="mute">judged by ${esc(MEASURES[t.measure].label)}</span></h2>
    <p class="mute">${t.start} to ${t.end}: ${t.pairs} pairs of ${t.blockDays}-day blocks, ${t.washoutDays} washout days each.</p>
    ${chart(t.measure, t.start, t.end, t)}
    <p class="mute"><span class="pill" style="background:color-mix(in srgb,var(--a) 40%,transparent)">A usual</span><span class="pill" style="background:color-mix(in srgb,var(--b) 45%,transparent)">B ${esc(t.change)}</span></p>
    <p class="verdict">${esc(r.verdict[0].toUpperCase() + r.verdict.slice(1))}</p>
    <table><tr><th>Pair</th><th class="n">A</th><th class="n">B</th><th class="n">B - A</th></tr>
    ${r.pairs.map((p) => `<tr><td>${p.pair + 1}</td><td class="n">${p.a ?? '-'}</td><td class="n">${p.b ?? '-'}</td><td class="n ${p.diff < 0 ? 'down' : p.diff > 0 ? 'up' : ''}">${p.complete ? (p.diff > 0 ? '+' : '') + p.diff : `${p.nA}/${p.nB} days`}</td></tr>`).join('')}</table>
    <p class="mute">Lower is better. ${r.completePairs ? `p is exact: the share of the ${2 ** r.completePairs} ways the pairs could have fallen
    by chance that look at least this strong.` : 'A p value appears once the first pair is complete.'} A result is a personal one - share it with your care team.</p>
    <button class="btn ghost noprint" id="t-end">End or replace this trial</button></section>`;
}
function bindTrial() {
  if (!db.trial) {
    const len = () => { $('#t-len').textContent = `Takes ${2 * +$('#t-days').value * +$('#t-pairs').value} days. 6 pairs is the fewest that can show p < 0.05.`; };
    ['#t-days', '#t-pairs'].forEach((s) => { $(s).oninput = len; });
    len();
    $('#t-go').onclick = () => {
      const rng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
      try {
        db.trial = planTrial({ start: $('#t-start').value, change: $('#t-change').value.trim(), measure: $('#t-measure').value,
          blockDays: +$('#t-days').value, pairs: +$('#t-pairs').value, washoutDays: +$('#t-wash').value, rng });
      } catch (err) { alert(err.message); return; }
      prefill = null; save(); render();
    };
    return;
  }
  $('#t-end').onclick = () => { if (confirm('End this trial? Your daily logs stay.')) { db.trial = null; save(); render(); } };
}

let insightMeasure = null;
function viewInsights() {
  const m = insightMeasure || (MODULE_MEASURE[db.profile.condition] && db.entries.some((e) => typeof scoreDay(e, MODULE_MEASURE[db.profile.condition]) === 'number') ? MODULE_MEASURE[db.profile.condition] : 'burden');
  insightMeasure = m;
  const last = db.entries.at(-1)?.date || today();
  const from = addDays(last, -59);
  const hints = foodHints(db.entries.filter((e) => e.date >= from), m);
  const shown = hints.filter((h) => h.enough).slice(0, 8);
  return `<section class="card"><label for="i-m">Measure</label><select id="i-m">${measureOptions(m)}</select>
    ${chart(m, from, last, null)}</section>
  <section class="card"><h2>Foods worth testing</h2>
    <p class="mute">Days on or up to 2 days after eating each food, against days without it. These are leads, not
    findings - other things change too. Test one properly with a trial.</p>
    ${shown.length ? `<table><tr><th>Food</th><th class="n">Days</th><th class="n">With</th><th class="n">Without</th><th class="n">Diff</th><th><span class="sr">Action</span></th></tr>
    ${shown.map((h) => `<tr><td>${esc(h.tag)}</td><td class="n">${h.exposedDays}</td><td class="n">${h.meanExposed}</td><td class="n">${h.meanClear}</td>
      <td class="n ${h.diff > 0 ? 'up' : 'down'}">${h.diff > 0 ? '+' : ''}${h.diff}</td><td><button class="btn ghost" style="margin:0;padding:4px 8px" data-test="${esc(h.tag)}">Test</button></td></tr>`).join('')}</table>`
    : '<p class="mute">Log at least 5 days with and 5 without a food to see it here.</p>'}</section>`;
}
function bindInsights() {
  $('#i-m').onchange = (ev) => { insightMeasure = ev.target.value; render(); };
  document.querySelectorAll('[data-test]').forEach((b) => {
    b.onclick = () => {
      if (db.trial && !confirm('Replace the current trial?')) return;
      db.trial = null; prefill = { change: `no ${b.dataset.test}`, measure: insightMeasure }; tab = 'trial'; render();
    };
  });
}

function viewShare() {
  const n = db.entries.length;
  const last = db.entries.at(-1)?.date;
  const r = db.trial ? analyzeTrial(db.trial, db.entries) : null;
  return `<section class="card"><h2>Summary for your care team</h2>
    <p>${esc(CONDITIONS[db.profile.condition])}. ${n} days logged${last ? `, last ${last}` : ''}.</p>
    ${r ? `<p><b>Trial:</b> ${esc(db.trial.change)} (${db.trial.start} to ${db.trial.end}, ${db.trial.pairs} randomised pairs, judged by ${esc(MEASURES[db.trial.measure].label)}): ${esc(r.verdict)}.</p>` : ''}
    ${n ? chart(insightMeasure || 'burden', addDays(last, -59), last, null) : ''}
    <button class="btn noprint" id="print">Print / save as PDF</button></section>
  <section class="card noprint"><h2>Export your data</h2>
    <p class="mute">FHIR R4 (for health-record and research systems) or CSV (for spreadsheets). Files are made on this device.</p>
    <button class="btn" id="fhir">Download FHIR JSON</button> <button class="btn ghost" id="csv">Download CSV</button></section>
  <section class="card noprint"><h2>Your data</h2><p class="mute">Stored only in this browser on this device. No account, no server, no tracking.</p>
    <button class="btn ghost" id="wipe">Delete everything</button></section>`;
}
function download(name, type, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function bindShare() {
  $('#print').onclick = () => window.print();
  $('#fhir').onclick = () => download(`selftrial-${today()}.fhir.json`, 'application/fhir+json', JSON.stringify(toFHIR(db.entries), null, 2));
  $('#csv').onclick = () => download(`selftrial-${today()}.csv`, 'text/csv', toCSV(db.entries));
  $('#wipe').onclick = () => { if (confirm('Delete all your SelfTrial data on this device?')) { db = { profile: null, trial: null, entries: [] }; save(); tab = 'today'; render(); } };
}

document.querySelectorAll('nav button').forEach((b) => { b.onclick = () => { tab = b.dataset.tab; render(); window.scrollTo(0, 0); }; });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
render();
