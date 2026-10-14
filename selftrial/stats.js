// SelfTrial - pure scoring and statistics. No DOM, no storage: the app and the tests share it.
//
// Dates are 'YYYY-MM-DD' strings in the user's local calendar. An entry is one day:
//   { date, meals: [{ time, text, tags: [] }], symptoms: { fatigue, pain, gi, sleep, mood },
//     module: { condition: 'crohns' | 'uc' | 'ra' | 'none', ...items }, meds: [], notes }
// Every symptom rating is 0-10 with 10 = worst, except sleep (10 = slept well), which the
// burden score inverts.

export const GENERAL = ['fatigue', 'pain', 'gi', 'sleep', 'mood'];

// Harvey-Bradshaw Index, patient-reportable items only. The abdominal-mass item needs an
// examination, so it is scored 0 and the app says so; this is a tracking aid, not the clinical score.
export function hbiPatient(m) {
  if (!m || m.condition !== 'crohns') return null;
  const { wellbeing, abdPain, liquidStools, complications } = m;
  if ([wellbeing, abdPain, liquidStools].some((v) => typeof v !== 'number')) return null;
  return clamp(wellbeing, 0, 4) + clamp(abdPain, 0, 3) + Math.max(0, Math.round(liquidStools)) +
    (Array.isArray(complications) ? complications.length : 0);
}

// Simple Clinical Colitis Activity Index (Walmsley 1998), all items patient-reportable.
const SCCAI_DAY = (n) => (n <= 3 ? 0 : n <= 6 ? 1 : n <= 9 ? 2 : 3);
const SCCAI_NIGHT = (n) => (n <= 0 ? 0 : n <= 3 ? 1 : 2);
export function sccai(m) {
  if (!m || m.condition !== 'uc') return null;
  const { dayStools, nightStools, urgency, blood, wellbeing, extracolonic } = m;
  if ([dayStools, nightStools, urgency, blood, wellbeing].some((v) => typeof v !== 'number')) return null;
  return SCCAI_DAY(dayStools) + SCCAI_NIGHT(nightStools) + clamp(urgency, 0, 3) + clamp(blood, 0, 3) +
    clamp(wellbeing, 0, 4) + (Array.isArray(extracolonic) ? extracolonic.length : 0);
}

// Rheumatoid arthritis: patient pain + patient global, each 0-10 - two of RAPID3's three parts.
// Named for what it is; the function part (MDHAQ) is not asked.
export function raPatient(m) {
  if (!m || m.condition !== 'ra') return null;
  if (typeof m.pain !== 'number' || typeof m.global !== 'number') return null;
  return round1(Math.min(10, Math.max(0, m.pain)) + Math.min(10, Math.max(0, m.global)));
}

// General symptom burden: mean of the 0-10 ratings present, sleep inverted. null if none logged.
export function burden(s) {
  if (!s) return null;
  const vals = [];
  for (const k of GENERAL) {
    if (typeof s[k] !== 'number') continue;
    vals.push(k === 'sleep' ? 10 - s[k] : s[k]);
  }
  return vals.length ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}

export const MEASURES = {
  burden: { label: 'Symptom burden (0-10)', of: (e) => burden(e.symptoms) },
  fatigue: { label: 'Fatigue (0-10)', of: (e) => num(e.symptoms?.fatigue) },
  pain: { label: 'Pain (0-10)', of: (e) => num(e.symptoms?.pain) },
  gi: { label: 'Gut symptoms (0-10)', of: (e) => num(e.symptoms?.gi) },
  hbi: { label: "Crohn's HBI, patient items", of: (e) => hbiPatient(e.module) },
  sccai: { label: 'Colitis SCCAI', of: (e) => sccai(e.module) },
  ra: { label: 'RA pain + global (0-20)', of: (e) => raPatient(e.module) },
};

export function scoreDay(entry, measure) {
  const m = MEASURES[measure];
  if (!m) throw new Error(`unknown measure ${measure}`);
  return m.of(entry);
}

// ---------- dates ----------
export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

// ---------- n-of-1 trial ----------
// A counterbalanced ABAB-style design: `pairs` pairs of blocks, each pair is AB or BA at random
// (A = usual diet, B = the change). Randomising within pairs is what makes the test below exact.
export function planTrial({ start, blockDays = 5, pairs = 6, change, measure = 'burden', washoutDays = 2, rng = Math.random }) {
  if (!start || !change) throw new Error('planTrial needs start and change');
  if (blockDays < 3 || pairs < 2) throw new Error('need blocks of 3+ days and 2+ pairs');
  if (washoutDays >= blockDays) throw new Error('washout must be shorter than a block');
  const blocks = [];
  let day = start;
  for (let p = 0; p < pairs; p++) {
    const order = rng() < 0.5 ? ['A', 'B'] : ['B', 'A'];
    for (const phase of order) {
      blocks.push({ pair: p, phase, start: day, end: addDays(day, blockDays - 1) });
      day = addDays(day, blockDays);
    }
  }
  return { start, end: addDays(day, -1), blockDays, pairs, change, measure, washoutDays, blocks };
}

export function phaseOn(plan, date) {
  return plan.blocks.find((b) => date >= b.start && date <= b.end) || null;
}

// Block mean of the measure, skipping the washout days at the start of each block.
function blockMean(block, byDate, measure, washoutDays) {
  const vals = [];
  for (let d = addDays(block.start, washoutDays); d <= block.end; d = addDays(d, 1)) {
    const e = byDate.get(d);
    const v = e ? scoreDay(e, measure) : null;
    if (typeof v === 'number') vals.push(v);
  }
  return { mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, n: vals.length };
}

// Exact randomisation test: under "the change does nothing", each pair's B-A difference is equally
// likely to have either sign, so the p-value is the share of the 2^k sign flips whose mean
// difference is at least as far from zero as the observed one. With k pairs the smallest possible
// p is 2/2^k (two-sided) - the app prints it so nobody reads more into 4 pairs than they hold.
export function analyzeTrial(plan, entries, { minDaysPerBlock = 3 } = {}) {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const pairs = [];
  for (let p = 0; p < plan.pairs; p++) {
    const a = plan.blocks.find((b) => b.pair === p && b.phase === 'A');
    const b = plan.blocks.find((x) => x.pair === p && x.phase === 'B');
    const ma = blockMean(a, byDate, plan.measure, plan.washoutDays);
    const mb = blockMean(b, byDate, plan.measure, plan.washoutDays);
    const complete = ma.n >= minDaysPerBlock && mb.n >= minDaysPerBlock;
    pairs.push({ pair: p, a: round2(ma.mean), b: round2(mb.mean), nA: ma.n, nB: mb.n, complete,
      diff: complete ? round2(mb.mean - ma.mean) : null });
  }
  const diffs = pairs.filter((x) => x.complete).map((x) => x.diff);
  const k = diffs.length;
  const out = { measure: plan.measure, change: plan.change, pairs, completePairs: k,
    minP: k ? Math.min(1, 2 / 2 ** k) : null, meanDiff: null, improvedPairs: 0, p: null, verdict: 'not enough data yet' };
  if (k < 2) return out;
  const obs = mean(diffs);
  let extreme = 0;
  for (let mask = 0; mask < 2 ** k; mask++) {
    let s = 0;
    for (let i = 0; i < k; i++) s += mask & (1 << i) ? -diffs[i] : diffs[i];
    if (Math.abs(s / k) >= Math.abs(obs) - 1e-12) extreme++;
  }
  out.meanDiff = round2(obs);
  out.improvedPairs = diffs.filter((d) => d < 0).length; // lower = fewer symptoms
  out.p = round3(extreme / 2 ** k);
  const dir = obs < 0 ? 'lower (better)' : obs > 0 ? 'higher (worse)' : 'unchanged';
  if (k < plan.pairs) out.verdict = `in progress: ${k} of ${plan.pairs} pairs complete, ${dir} so far`;
  else if (out.p > 0.05 && out.improvedPairs % k === 0 && out.p <= round3(out.minP) + 1e-9)
    out.verdict = `symptoms ${dir} on the change in all ${k} pairs, the strongest result ${k} pairs can give (p = ${out.p}); add pairs to confirm`;
  else if (out.p <= 0.05 + 1e-9) out.verdict = `symptoms ${dir} on the change in ${out.improvedPairs} of ${k} pairs (p = ${out.p})`;
  else out.verdict = `no clear difference (p = ${out.p}; the smallest p this design can show is ${round3(out.minP)})`;
  return out;
}

// ---------- food -> symptom hints (hypotheses, not findings) ----------
// For each food tag: mean measure on days 0..maxLag after eating it vs days with no exposure in
// that window. A hint is only shown with enough exposed AND unexposed days; the app then offers to
// test it properly as a trial.
export function foodHints(entries, measure, { maxLag = 2, minDays = 5 } = {}) {
  const tags = new Set();
  for (const e of entries) for (const m of e.meals || []) for (const t of m.tags || []) tags.add(norm(t));
  const out = [];
  for (const tag of tags) {
    const ate = new Set(entries.filter((e) => (e.meals || []).some((m) => (m.tags || []).map(norm).includes(tag))).map((e) => e.date));
    const exposed = [];
    const clear = [];
    for (const e of entries) {
      const v = scoreDay(e, measure);
      if (typeof v !== 'number') continue;
      let hit = false;
      for (let l = 0; l <= maxLag; l++) if (ate.has(addDays(e.date, -l))) hit = true;
      (hit ? exposed : clear).push(v);
    }
    const row = { tag, exposedDays: exposed.length, clearDays: clear.length, enough: exposed.length >= minDays && clear.length >= minDays };
    if (row.enough) {
      row.meanExposed = round2(mean(exposed));
      row.meanClear = round2(mean(clear));
      row.diff = round2(row.meanExposed - row.meanClear);
    }
    out.push(row);
  }
  return out.sort((x, y) => (y.enough - x.enough) || (Math.abs(y.diff ?? 0) - Math.abs(x.diff ?? 0)) || x.tag.localeCompare(y.tag));
}

// ---------- export ----------
// FHIR R4 Bundle of Observations. Codes are this app's own (urn:selftrial:measure) - no standard
// code is claimed for a measure that does not have one.
export function toFHIR(entries, { patient = 'Patient/self' } = {}) {
  const resources = [];
  for (const e of entries) {
    for (const key of Object.keys(MEASURES)) {
      const v = scoreDay(e, key);
      if (typeof v !== 'number') continue;
      resources.push({
        resourceType: 'Observation',
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey' }] }],
        code: { coding: [{ system: 'urn:selftrial:measure', code: key }], text: MEASURES[key].label },
        subject: { reference: patient },
        effectiveDateTime: e.date,
        valueQuantity: { value: v, unit: 'score' },
      });
    }
    for (const m of e.meals || []) {
      resources.push({
        resourceType: 'Observation',
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'social-history' }] }],
        code: { coding: [{ system: 'urn:selftrial:measure', code: 'meal' }], text: 'Meal' },
        subject: { reference: patient },
        effectiveDateTime: m.time ? `${e.date}T${m.time}:00` : e.date,
        valueString: [m.text, (m.tags || []).length ? `[${m.tags.join(', ')}]` : ''].filter(Boolean).join(' '),
      });
    }
  }
  return { resourceType: 'Bundle', type: 'collection', entry: resources.map((resource) => ({ resource })) };
}

export function toCSV(entries) {
  const cols = ['date', ...GENERAL, ...Object.keys(MEASURES).filter((k) => !GENERAL.includes(k)), 'foods', 'notes'];
  const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const rows = [cols.join(',')];
  for (const e of [...entries].sort((a, b) => a.date.localeCompare(b.date))) {
    const foods = (e.meals || []).flatMap((m) => m.tags || []).join('; ');
    rows.push(cols.map((c) => esc(
      c === 'date' ? e.date : c === 'foods' ? foods : c === 'notes' ? e.notes : GENERAL.includes(c) ? e.symptoms?.[c] : scoreDay(e, c),
    )).join(','));
  }
  return rows.join('\n') + '\n';
}

// ---------- helpers ----------
function num(v) { return typeof v === 'number' ? v : null; }
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, Math.round(v))); }
function mean(a) { return a.reduce((x, y) => x + y, 0) / a.length; }
function norm(t) { return String(t).trim().toLowerCase(); }
function round1(v) { return Math.round(v * 10) / 10; }
function round2(v) { return v == null ? null : Math.round(v * 100) / 100; }
function round3(v) { return Math.round(v * 1000) / 1000; }
