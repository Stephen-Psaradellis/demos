// Fictional demo data for the video and the tests: "Sam", Crohn's disease, 60 days of logs, all of it a
// 6-pair dairy-free trial (5-day blocks, 2-day washout). Seeded, so every run gives the same numbers. Nothing here is a real person.
import { addDays, planTrial, phaseOn } from './stats.js';

export function seeded(seed = 7) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BREAKFAST = [['oats', 'milk'], ['eggs', 'toast'], ['yogurt', 'berries'], ['oats', 'banana']];
const LUNCH = [['rice', 'chicken'], ['sandwich', 'cheese'], ['soup', 'bread'], ['salad', 'tuna']];
const DINNER = [['pasta', 'tomato'], ['salmon', 'potato'], ['pizza', 'cheese'], ['stir-fry', 'rice'], ['beans', 'rice']];
const DAIRY = new Set(['milk', 'yogurt', 'cheese', 'pizza']);
const SWAP = { milk: 'oat milk', yogurt: 'coconut yogurt', cheese: 'avocado', pizza: 'rice bowl' };

export function demoData({ start = '2026-08-17', seed = 7, dairyEffect = 1.6 } = {}) {
  const rng = seeded(seed);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const trial = planTrial({ start: addDays(start, 0), blockDays: 5, pairs: 6, change: 'dairy-free', measure: 'gi', washoutDays: 2, rng });
  const entries = [];
  let dairyLoad = 0; // carries over a couple of days, which is why the trial has a washout
  for (let i = 0; i < 60; i++) {
    const date = addDays(start, i);
    const phase = phaseOn(trial, date)?.phase;
    const meals = [['08:00', pick(BREAKFAST)], ['12:30', pick(LUNCH)], ['19:00', pick(DINNER)]].map(([time, tags]) => {
      const t = phase === 'B' ? tags.map((x) => SWAP[x] || x) : tags;
      return { time, text: t.join(' + '), tags: t };
    });
    const ateDairy = meals.some((m) => m.tags.some((t) => DAIRY.has(t)));
    dairyLoad = 0.45 * dairyLoad + (ateDairy ? 1 : 0);
    const noise = () => (rng() - 0.5) * 2.4;
    const gi = clampR(2.6 + dairyEffect * dairyLoad + noise());
    const fatigue = clampR(3.2 + 0.4 * dairyEffect * dairyLoad + noise());
    const pain = clampR(2.2 + 0.6 * dairyEffect * dairyLoad + noise());
    const sleep = clampR(6.5 - 0.3 * dairyLoad + noise());
    const mood = clampR(3 + 0.3 * dairyLoad + noise());
    const liquidStools = Math.max(0, Math.round(1 + 0.9 * dairyLoad + (rng() - 0.5) * 2));
    entries.push({
      date,
      meals,
      symptoms: { fatigue, pain, gi, sleep, mood },
      module: {
        condition: 'crohns',
        wellbeing: Math.min(4, Math.round(gi / 3)),
        abdPain: Math.min(3, Math.round(pain / 3)),
        liquidStools,
        complications: [],
      },
      notes: '',
    });
  }
  return { profile: { name: 'Sam (fictional)', condition: 'crohns' }, trial, entries };
}

function clampR(v) { return Math.min(10, Math.max(0, Math.round(v))); }
