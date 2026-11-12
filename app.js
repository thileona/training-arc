'use strict';

/* ---------- world data ---------- */
// Treadmill: approximate road distance (km) from Brussels to Rome.
const ROUTE = [
  ['Brussels', 0], ['Namur', 65], ['Luxembourg', 215], ['Metz', 280],
  ['Strasbourg', 445], ['Basel', 580], ['Lucerne', 680], ['Gotthard Pass', 770],
  ['Milan', 930], ['Bologna', 1145], ['Florence', 1250], ['Rome', 1530]
];
// Push-ups: 1 push-up = 1 metre climbed.
const PEAKS = [
  ['Ground level', 0], ['Atomium', 102], ['Eiffel Tower', 330], ['Signal de Botrange', 694],
  ['Burj Khalifa', 828], ['Ben Nevis', 1345], ['Mount Olympus', 2917], ['Mont Blanc', 4806],
  ['Kilimanjaro', 5895], ['Everest', 8849], ['Airliner cruising altitude', 11000],
  ['Stratosphere jump', 38969], ['Edge of space', 100000]
];
const RANKS = [[0, 'Initiate'], [7, 'Apprentice'], [30, 'Adept'], [76, 'Veteran'], [180, 'Master'], [365, 'Legend']];

/* ---------- helpers ---------- */
const KEY = 'training-arc-v1';
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); };
const today = () => fmt(new Date());
const num = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 1 });
const toNum = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };

/* ---------- state ---------- */
const defaults = () => ({ settings: { start: today(), startReps: 25, inc: 1, cap: 100, kcal: 300 }, days: {} });
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.settings && s.days) return s;
  } catch (e) { /* fall through */ }
  return defaults();
}
let S = load();
let tab = 'today';
let undo = [];
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save on this device'); } }

const day = d => S.days[d] || { p: 0, km: 0, kcal: 0 };
const idx = d => Math.round((parse(d) - parse(S.settings.start)) / 864e5);
const target = d => { const s = S.settings; return Math.min(s.cap, s.startReps + s.inc * Math.max(0, idx(d))); };
const pushDone = d => day(d).p >= target(d);
const runDone = d => day(d).kcal >= S.settings.kcal;
const done = d => pushDone(d) && runDone(d);
function totals() {
  const t = { p: 0, km: 0, kcal: 0 };
  for (const k in S.days) { t.p += S.days[k].p; t.km += S.days[k].km; t.kcal += S.days[k].kcal; }
  return t;
}
function streak() {
  let d = today(), n = 0;
  if (!done(d)) d = addDays(d, -1);
  while (done(d)) { n++; d = addDays(d, -1); }
  return n;
}
function bestStreak() {
  const keys = Object.keys(S.days).sort();
  if (!keys.length) return 0;
  let best = 0, run = 0;
  for (let d = keys[0]; d <= today(); d = addDays(d, 1)) { run = done(d) ? run + 1 : 0; best = Math.max(best, run); }
  return best;
}
function mutate(d, fn) {
  const before = totals(), was = done(d);
  const o = { ...day(d) };
  fn(o);
  o.p = Math.max(0, Math.round(o.p));
  o.km = Math.max(0, Math.round(o.km * 100) / 100);
  o.kcal = Math.max(0, Math.round(o.kcal));
  S.days[d] = o;
  save();
  const after = totals(), msgs = [];
  for (const [n, h] of PEAKS) if (before.p < h && after.p >= h) msgs.push(`Summit reached: ${n}`);
  for (const [n, k] of ROUTE) if (before.km < k && after.km >= k) msgs.push(`You arrived in ${n}`);
  if (!was && done(d) && d === today()) msgs.push('Day complete');
  if (msgs.length) { toast(msgs.join('\n')); if (navigator.vibrate) navigator.vibrate([60, 40, 120]); }
  render();
}

/* ---------- toast ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ---------- shared pieces ---------- */
function position(list, value) {
  let i = 0;
  while (i + 1 < list.length && value >= list[i + 1][1]) i++;
  const next = list[i + 1] || null;
  return { i, here: list[i], next, togo: next ? next[1] - value : 0, pct: next ? (value - list[i][1]) / (next[1] - list[i][1]) : 1 };
}
function timeline(list, value, unit, up) {
  const pos = position(list, value);
  const items = list.map(([name, v], i) => {
    const cls = i <= pos.i ? 'reached' : i === pos.i + 1 ? 'next' : '';
    const extra = i === pos.i + 1
      ? `<div class="togo"><div class="meter"><i style="width:${(pos.pct * 100).toFixed(1)}%"></i></div><span><b>${num(pos.togo)} ${unit}</b> to go</span></div>` : '';
    return `<li class="${cls}"><span class="dot"></span><div class="name"><b>${name}</b><span>${num(v)} ${unit}</span></div>${extra}</li>`;
  });
  if (up) items.reverse();
  return `<ol class="tl ${up ? 'up' : ''}">${items.join('')}</ol>`;
}

/* ---------- views ---------- */
function viewToday() {
  const d = today(), o = day(d), tg = target(d), i = idx(d), t = totals(), s = S.settings;
  const rank = RANKS.filter(r => i >= r[0]).pop() || RANKS[0];
  const C = 2 * Math.PI * 84, frac = Math.min(1, o.p / tg);
  const left = Math.max(0, tg - o.p);
  const alt = position(PEAKS, t.p), pos = position(ROUTE, t.km);
  const tomorrow = target(addDays(d, 1));
  return `
  <header class="hero">
    <div><p class="eyebrow">Rank · ${rank[1]}</p><h1>${i < 0 ? `T−${-i}` : `Day ${i + 1}`}</h1></div>
    <div class="streak"><b>${streak()}</b><span>day streak</span></div>
  </header>

  <section class="card push fire ${pushDone(d) ? 'done' : ''}">
    <header><h2>Push-ups</h2><span class="tag ${pushDone(d) ? 'ok' : ''}">${pushDone(d) ? 'Target hit' : `${left} to go`}</span></header>
    <div class="ring">
      <svg viewBox="0 0 190 190"><circle class="track" cx="95" cy="95" r="84"/><circle class="bar" cx="95" cy="95" r="84" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - frac)}"/></svg>
      <div class="mid"><b>${o.p}</b><span>of ${tg}</span></div>
    </div>
    <div class="btns">${[1, 5, 10, 20].map(n => `<button class="add" data-add="${n}">+${n}</button>`).join('')}</div>
    <div class="row"><button class="ghost small" data-act="undo" ${undo.length ? '' : 'disabled'}>Undo last</button></div>
    <p class="mini">Altitude <b>${num(t.p)} m</b>${alt.next ? ` · ${num(alt.togo)} m to ${alt.next[0]}` : ''}${tomorrow > tg ? ` · tomorrow: ${tomorrow}` : ''}</p>
  </section>

  <section class="card run ice ${runDone(d) ? 'done' : ''}">
    <header><h2>Treadmill</h2><span class="tag ${runDone(d) ? 'ok' : ''}">${runDone(d) ? 'Target hit' : `${s.kcal - o.kcal} kcal to go`}</span></header>
    <div class="stats">
      <div class="stat"><b>${num(o.km)}</b><span>km today</span></div>
      <div class="stat"><b>${o.kcal}</b><span>of ${s.kcal} kcal</span></div>
    </div>
    <div class="meter"><i style="width:${Math.min(100, o.kcal / s.kcal * 100)}%"></i></div>
    <form class="run-form" id="runForm">
      <label>Km <input name="km" inputmode="decimal" placeholder="0.0" autocomplete="off"></label>
      <label>Kcal <input name="kcal" inputmode="numeric" value="${Math.max(0, s.kcal - o.kcal) || ''}" autocomplete="off"></label>
      <button class="solid">Log</button>
    </form>
    <p class="mini">Travelled <b>${num(t.km)} km</b>${pos.next ? ` · ${num(pos.togo)} km to ${pos.next[0]}` : ' · beyond Rome'}</p>
  </section>`;
}

function viewJourney() {
  const t = totals(), pos = position(ROUTE, t.km);
  const active = Object.values(S.days).filter(o => o.km > 0).length;
  return `
  <header class="hero"><div><p class="eyebrow">Treadmill · Brussels to Rome</p><h1>Journey</h1></div></header>
  <section class="card ice">
    <div class="big" style="color:var(--text)">${num(t.km)}<small>km</small></div>
    <p class="muted">${pos.next ? `Last stop: ${pos.here[0]}. Next: ${pos.next[0]}.` : 'You walked to Rome. Everything from here is bonus distance.'}</p>
    <div class="stats three" style="color:var(--text)">
      <div class="stat"><b>${num(t.kcal)}</b><span>kcal burned</span></div>
      <div class="stat"><b>${active ? num(t.km / active) : 0}</b><span>km / session day</span></div>
      <div class="stat"><b>${Math.round(t.km / ROUTE[ROUTE.length - 1][1] * 100)}%</b><span>of the route</span></div>
    </div>
  </section>
  <section class="card ice">${timeline(ROUTE, t.km, 'km', false)}</section>`;
}

function viewAscent() {
  const t = totals(), pos = position(PEAKS, t.p);
  const best = Math.max(0, ...Object.values(S.days).map(o => o.p));
  return `
  <header class="hero"><div><p class="eyebrow">Push-ups · 1 rep = 1 metre</p><h1>Ascent</h1></div></header>
  <section class="card fire">
    <div class="big" style="color:var(--text)">${num(t.p)}<small>m</small></div>
    <p class="muted">${pos.next ? `Above ${pos.here[0]}. Climbing to ${pos.next[0]}.` : 'You are in space.'}</p>
    <div class="stats three" style="color:var(--text)">
      <div class="stat"><b>${num(t.p)}</b><span>total reps</span></div>
      <div class="stat"><b>${best}</b><span>best day</span></div>
      <div class="stat"><b>${target(today())}</b><span>today's target</span></div>
    </div>
  </section>
  <section class="card fire">${timeline(PEAKS, t.p, 'm', true)}</section>`;
}

function viewLog() {
  const s = S.settings, td = today(), t = totals();
  // 6 weeks ending this week, Monday first
  const end = parse(td), dow = (end.getDay() + 6) % 7;
  const first = addDays(td, -dow - 35);
  let cells = '';
  for (let k = 0; k < 42; k++) {
    const d = addDays(first, k), p = pushDone(d) && day(d).p > 0, r = runDone(d) && day(d).kcal > 0;
    const cls = p && r ? 'full' : p ? 'half' : r ? 'half run' : '';
    cells += `<button class="${cls} ${d === td ? 'now' : ''}" data-edit="${d}" ${d > td ? 'disabled' : ''}>${parse(d).getDate()}</button>`;
  }
  const complete = Object.keys(S.days).filter(done).length;
  return `
  <header class="hero"><div><p class="eyebrow">History and settings</p><h1>Log</h1></div></header>
  <section class="card">
    <div class="stats three">
      <div class="stat"><b>${complete}</b><span>full days</span></div>
      <div class="stat"><b>${bestStreak()}</b><span>best streak</span></div>
      <div class="stat"><b>${num(t.p)}</b><span>push-ups</span></div>
    </div>
    <div class="cal">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<span class="dow">${x}</span>`).join('')}${cells}</div>
    <div class="legend">
      <span><i style="background:var(--fire)"></i>both done</span>
      <span><i style="background:#5a2a10"></i>push-ups only</span>
      <span><i style="background:#12443f"></i>treadmill only</span>
    </div>
    <p class="muted" style="font-size:13px">Tap a day to correct it.</p>
  </section>

  <section class="card">
    <h2>Plan</h2>
    <form class="settings" id="setForm">
      <label class="wide">Start date <input type="date" name="start" value="${s.start}"></label>
      <label>Start reps <input name="startReps" inputmode="numeric" value="${s.startReps}"></label>
      <label>Added per day <input name="inc" inputmode="decimal" value="${s.inc}"></label>
      <label>Plateau <input name="cap" inputmode="numeric" value="${s.cap}"></label>
      <label>Daily kcal <input name="kcal" inputmode="numeric" value="${s.kcal}"></label>
      <button class="solid wide">Save plan</button>
    </form>
    <p class="muted" style="font-size:13px">Plateau of ${s.cap} is reached on day ${s.inc > 0 ? Math.ceil((s.cap - s.startReps) / s.inc) + 1 : '—'}.</p>
  </section>

  <section class="card">
    <h2>Backup</h2>
    <p class="muted" style="font-size:13px">Your data lives only in this browser. Export a file now and then.</p>
    <div class="row">
      <button class="ghost" data-act="export">Export</button>
      <button class="ghost" data-act="import">Import</button>
      <button class="ghost" data-act="reset">Reset</button>
    </div>
    <input type="file" id="file" accept="application/json,.json" hidden>
  </section>`;
}

const VIEWS = { today: viewToday, journey: viewJourney, ascent: viewAscent, log: viewLog };
function render() {
  $('#view').innerHTML = VIEWS[tab]();
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
}

/* ---------- events ---------- */
$('#tabs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  tab = b.dataset.tab; render(); window.scrollTo(0, 0);
});

let editing = null;
$('#view').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.add) {
    const n = +b.dataset.add; undo.push(n);
    if (navigator.vibrate) navigator.vibrate(15);
    mutate(today(), o => { o.p += n; });
  } else if (b.dataset.act === 'undo') {
    const n = undo.pop(); if (n) mutate(today(), o => { o.p -= n; });
  } else if (b.dataset.edit) {
    editing = b.dataset.edit;
    const o = day(editing), f = $('#editForm');
    $('#editTitle').textContent = parse(editing).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + ` · target ${target(editing)}`;
    f.p.value = o.p; f.km.value = o.km; f.kcal.value = o.kcal;
    $('#edit').showModal();
  } else if (b.dataset.act === 'export') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }));
    a.download = `training-arc-${today()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } else if (b.dataset.act === 'import') {
    $('#file').click();
  } else if (b.dataset.act === 'reset') {
    if (confirm('Erase all recorded days and settings?')) { S = defaults(); undo = []; save(); render(); }
  }
});

$('#view').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  if (f.id === 'runForm') {
    const km = toNum(f.km.value), kcal = toNum(f.kcal.value);
    if (km <= 0 && kcal <= 0) { toast('Enter a distance or calories'); return; }
    mutate(today(), o => { o.km += km; o.kcal += kcal; });
  } else if (f.id === 'setForm') {
    const s = S.settings;
    if (f.start.value) s.start = f.start.value;
    s.startReps = Math.max(1, Math.round(toNum(f.startReps.value)) || 25);
    s.inc = Math.max(0, toNum(f.inc.value));
    s.cap = Math.max(s.startReps, Math.round(toNum(f.cap.value)) || 100);
    s.kcal = Math.max(1, Math.round(toNum(f.kcal.value)) || 300);
    save(); render(); toast('Plan saved');
  }
});

$('#view').addEventListener('change', e => {
  if (e.target.id !== 'file' || !e.target.files[0]) return;
  e.target.files[0].text().then(txt => {
    const s = JSON.parse(txt);
    if (!s || !s.settings || !s.days) throw new Error('bad file');
    S = { settings: { ...defaults().settings, ...s.settings }, days: s.days };
    save(); render(); toast('Backup restored');
  }).catch(() => toast('That file is not a Training Arc backup'));
});

$('#edit').addEventListener('close', () => {
  if ($('#edit').returnValue !== 'save' || !editing) return;
  const f = $('#editForm');
  mutate(editing, o => { o.p = toNum(f.p.value); o.km = toNum(f.km.value); o.kcal = toNum(f.kcal.value); });
});

// roll over to the new day if the app stays open past midnight
let shown = today();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && today() !== shown) { shown = today(); undo = []; render(); }
});

render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
