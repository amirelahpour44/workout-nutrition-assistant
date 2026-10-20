'use strict';

var KEYS = {
  plan: 'wna_plan_v1',
  logs: 'wna_logs_v1',
  nutrition: 'wna_nutrition_v1'
};

var BACKUP_APP_ID = 'wna';
var BACKUP_VERSION = 1;
var SAVE_DEBOUNCE_MS = 700;
var STATUS_HIDE_MS = 2500;
var DAY_NOTE_PREFIX = 'day:';
var APP_UPDATE_KEY = 'wna_last_update';

var DAY_COLORS = ['#ef4444', '#3b82f6', '#f97316', '#a855f7', '#eab308', '#22c55e', '#14b8a6'];
var DEFAULT_DAY_NAMES = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
var JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
var WEEKDAY_NAMES = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

var state = {
  plan: null,
  logs: {},
  nutrition: null,
  weekOffset: 0,
  ui: {
    exerciseId: null,
    exerciseIsNew: false,
    mealId: null,
    mealIsNew: false,
    itemId: null,
    itemIsNew: false,
    selectedPlanDayId: null,
    selectedTrackerDayId: null,
    expandedTrackExId: null
  }
};

function $(sel, root) {
  return (root || document).querySelector(sel);
}

function $all(sel, root) {
  return Array.prototype.slice.call((root || document).querySelectorAll(sel));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}

function faNum(value) {
  return String(value == null ? '' : value).replace(/\d/g, function (d) {
    return '۰۱۲۳۴۵۶۷۸۹'[+d];
  });
}

function enNum(value) {
  return String(value == null ? '' : value).replace(/[۰-۹]/g, function (d) {
    return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  });
}

function num(value) {
  var parsed = parseFloat(enNum(value));
  return isFinite(parsed) ? parsed : null;
}

function val(x) {
  return x === undefined || x === null ? '' : x;
}

function icon(name, cls) {
  var paths = {
    pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    up: '<path d="m18 15-6-6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    bulb: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>',
    utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7Z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/>'
  };
  return '<svg class="' + (cls || 'ic') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[name] + '</svg>';
}

function validPlan(p) {
  return !!p && typeof p === 'object' && !Array.isArray(p) && Array.isArray(p.dayNames) && Array.isArray(p.days);
}

function validLogs(l) {
  if (!l || typeof l !== 'object' || Array.isArray(l)) return false;
  var weeks = Object.keys(l);
  for (var i = 0; i < weeks.length; i++) {
    var week = l[weeks[i]];
    if (!week || typeof week !== 'object' || Array.isArray(week)) return false;
  }
  return true;
}

function validNutrition(n) {
  return !!n && typeof n === 'object' && !Array.isArray(n) && Array.isArray(n.meals);
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    return false;
  }
}

function loadSection(key, validator, seedFactory) {
  var value = null;
  var seeded = false;
  try {
    var raw = localStorage.getItem(key);
    if (raw != null) {
      var parsed = JSON.parse(raw);
      if (validator(parsed)) value = parsed;
    }
  } catch (err) {
    value = null;
  }
  if (!value) {
    value = seedFactory();
    seeded = true;
  }
  return { value: value, seeded: seeded };
}

function makeExercise(name, sets, reps, note) {
  return { id: uid(), name: name, sets: sets, reps: reps, note: note || '' };
}

function makeSeedPlan() {
  return {
    dayNames: clone(DEFAULT_DAY_NAMES),
    days: [
      {
        id: uid(),
        name: 'شنبه — سینه و پشت‌بازو',
        colorIndex: 0,
        exercises: [
          makeExercise('پرس سینه هالتر', 4, 8, 'میله را آرام تا سطح سینه پایین بیاورید.'),
          makeExercise('قفسه سینه دمبل', 3, 12, ''),
          makeExercise('پشت‌بازو سیم‌کش', 3, 12, 'آرنج‌ها چسبیده به بدن بماند.')
        ]
      },
      {
        id: uid(),
        name: 'یکشنبه — پا و شکم',
        colorIndex: 2,
        exercises: [
          makeExercise('اسکات هالتر', 4, 10, 'زنجیر پا موازی کف، سینه بالا.'),
          makeExercise('جلو پا دستگاه', 3, 12, ''),
          makeExercise('کرانچ شکم', 3, 15, '')
        ]
      },
      {
        id: uid(),
        name: 'سه‌شنبه — سرشانه و زیربغل',
        colorIndex: 3,
        exercises: [
          makeExercise('زیربغل سیم‌کش از جلو', 4, 10, ''),
          makeExercise('پرس سرشانه دمبل', 3, 10, 'کمر به پشتی صندلی چسبیده باشد.'),
          makeExercise('نشر جانب', 3, 12, '')
        ]
      }
    ]
  };
}

function makeSeedNutrition() {
  function item(name, qty, protein, kcal) {
    return { id: uid(), name: name, qty: qty, protein: protein, kcal: kcal };
  }
  return {
    meals: [
      {
        id: uid(),
        name: 'صبحانه',
        note: '',
        items: [
          item('تخم‌مرغ آب‌پز', '۳ عدد', 18, 140),
          item('نان سنگک', '۱ کف دست', 4, 120),
          item('شیر کم‌چرب', '۱ لیوان', 8, 100)
        ]
      },
      {
        id: uid(),
        name: 'ناهار',
        note: 'ترجیحاً بعد از تمرین مصرف شود.',
        items: [
          item('سینه مرغ گریل', '۱۵۰ گرم', 35, 230),
          item('برنج پخته', '۱۰ قاشق', 6, 250),
          item('سالاد فصل', '۱ کاسه', 2, 60)
        ]
      },
      {
        id: uid(),
        name: 'میان‌وعده',
        note: '',
        items: [
          item('ماست یونانی', '۱ ظرف کوچک', 15, 130),
          item('موز', '۱ عدد', 1, 90)
        ]
      },
      {
        id: uid(),
        name: 'شام',
        note: '',
        items: [
          item('ماهی قزل‌آلا', '۱۵۰ گرم', 30, 220),
          item('سبزیجات بخارپز', '۲۰۰ گرم', 4, 70)
        ]
      }
    ]
  };
}

function div(a, b) {
  return ~~(a / b);
}

function mod(a, b) {
  return a - ~~(a / b) * b;
}

function jalCal(jy) {
  var breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  var bl = breaks.length;
  var gy = jy + 621;
  var leapJ = -14;
  var jp = breaks[0];
  var jm, jump = 0, leap, n, i;
  for (i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  var leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  var march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap: leap, gy: gy, march: march };
}

function g2d(gy, gm, gd) {
  var d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn) {
  var j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  var i = div(mod(j, 1461), 4) * 5 + 308;
  var gd = div(mod(i, 153), 5) + 1;
  var gm = mod(div(i, 153), 12) + 1;
  var gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy: gy, gm: gm, gd: gd };
}

function j2d(jy, jm, jd) {
  var r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn) {
  var gy = d2g(jdn).gy;
  var jy = gy - 621;
  var r = jalCal(jy);
  var jdn1f = g2d(gy, 3, r.march);
  var k = jdn - jdn1f;
  var jm, jd;
  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy: jy, jm: jm, jd: jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy: jy, jm: jm, jd: jd };
}

function toJalali(date) {
  return d2j(g2d(date.getFullYear(), date.getMonth() + 1, date.getDate()));
}

function startOfWeekSaturday(date) {
  var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 1) % 7));
  return d;
}

function addDays(date, days) {
  var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

function faDate(date) {
  var j = toJalali(date);
  return faNum(j.jd) + ' ' + JALALI_MONTHS[j.jm - 1];
}

function faDayDate(date) {
  return WEEKDAY_NAMES[date.getDay()] + ' ' + faDate(date);
}

function weekInfoAt(offset) {
  var saturday = addDays(startOfWeekSaturday(new Date()), offset * 7);
  var friday = addDays(saturday, 6);
  var j = toJalali(saturday);
  var dayOfYear = j.jd;
  for (var m = 1; m < j.jm; m++) dayOfYear += m <= 6 ? 31 : 30;
  var weekNumber = Math.floor((dayOfYear - 1) / 7) + 1;
  return {
    key: j.jy + '-W' + String(weekNumber).padStart(2, '0'),
    label: 'هفته ' + faNum(weekNumber) + ' • سال ' + faNum(j.jy),
    range: faDayDate(saturday) + ' تا ' + faDayDate(friday)
  };
}

function findDay(dayId) {
  return state.plan.days.find(function (day) {
    return day.id === dayId;
  }) || null;
}

function ensureSelectedDayId(currentId) {
  if (currentId && state.plan.days.some(function (day) {
    return day.id === currentId;
  })) return currentId;
  return state.plan.days.length ? state.plan.days[0].id : null;
}

function buildChipsHtml(days, selectedId, actionName) {
  return days.map(function (day) {
    var color = DAY_COLORS[day.colorIndex % DAY_COLORS.length];
    var isActive = day.id === selectedId;
    return '<button type="button" class="chip-btn' + (isActive ? ' is-active' : '') + '" style="--day-color:' + esc(color) + '" data-action="' + actionName + '" data-id="' + esc(day.id) + '" aria-pressed="' + isActive + '">' + esc(day.name || 'بدون نام') + '</button>';
  }).join('');
}

function findMeal(mealId) {
  return state.nutrition.meals.find(function (meal) {
    return meal.id === mealId;
  }) || null;
}

function nextDayName() {
  var used = state.plan.days.map(function (day) {
    return day.name.trim();
  });
  for (var i = 0; i < DEFAULT_DAY_NAMES.length; i++) {
    var candidate = DEFAULT_DAY_NAMES[i];
    var isUsed = used.some(function (name) {
      return name.indexOf(candidate) !== -1;
    });
    if (!isUsed) return candidate;
  }
  return 'روز جدید';
}

function removeExercisesFromLogs(exerciseIds) {
  Object.keys(state.logs).forEach(function (weekKey) {
    var week = state.logs[weekKey];
    exerciseIds.forEach(function (id) {
      delete week[id];
    });
  });
}

function dayNoteKey(dayId) {
  return DAY_NOTE_PREFIX + dayId;
}

function removeDayNotesFromLogs(dayId) {
  var key = dayNoteKey(dayId);
  Object.keys(state.logs).forEach(function (weekKey) {
    delete state.logs[weekKey][key];
  });
}

var MAX_TRACK_SETS = 12;

function normalizeLogRec(rec) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return { sets: [] };
  if (Array.isArray(rec.sets)) {
    var clean = [];
    rec.sets.forEach(function (set) {
      if (!set || typeof set !== 'object') return;
      var r = set.r === '' || set.r == null ? '' : num(set.r);
      var w = set.w === '' || set.w == null ? '' : num(set.w);
      if (r === '' && w === '') return;
      clean.push({ w: w, r: r });
    });
    return { sets: clean.slice(0, MAX_TRACK_SETS) };
  }
  var lw = num(rec.w);
  var lr = num(rec.r);
  var ls = num(rec.s);
  if (lw == null && lr == null && ls == null) return { sets: [] };
  var count = ls != null ? Math.min(MAX_TRACK_SETS, Math.max(1, Math.round(ls))) : 1;
  var sets = [];
  for (var i = 0; i < count; i++) sets.push({ w: lw == null ? '' : lw, r: lr == null ? '' : lr });
  return { sets: sets };
}

function logSets(rec) {
  return normalizeLogRec(rec).sets;
}

function logAggregates(rec) {
  var sets = logSets(rec);
  var bestW = null;
  var bestR = null;
  sets.forEach(function (set) {
    var w = num(set.w);
    var r = num(set.r);
    if (w != null && (bestW == null || w > bestW)) bestW = w;
    if (r != null && (bestR == null || r > bestR)) bestR = r;
  });
  return { w: bestW, r: bestR, s: sets.length ? sets.length : null };
}

function normalizeLogs(logs) {
  Object.keys(logs || {}).forEach(function (weekKey) {
    var week = logs[weekKey];
    if (!week || typeof week !== 'object') return;
    Object.keys(week).forEach(function (key) {
      if (key.indexOf(DAY_NOTE_PREFIX) === 0) return;
      week[key] = normalizeLogRec(week[key]);
    });
  });
  return logs;
}

function findExercise(exerciseId) {
  var found = null;
  state.plan.days.some(function (day) {
    var ex = day.exercises.find(function (e) {
      return e.id === exerciseId;
    });
    if (ex) found = ex;
    return !!ex;
  });
  return found;
}

function formatWeightList(sets) {
  var weights = [];
  var allSame = true;
  var first = null;
  for (var i = 0; i < sets.length; i++) {
    var w = num(sets[i].w);
    if (w == null) continue;
    if (first == null) first = w;
    else if (w !== first) allSame = false;
    if (weights.indexOf(w) === -1) weights.push(w);
  }
  if (first == null) return '';
  if (allSame) return faNum(first) + ' کیلو';
  return weights.map(function (w) {
    return faNum(w);
  }).join('/') + ' کیلو';
}

function formatSetsSummary(sets) {
  if (!sets || !sets.length) return '';
  var reps = sets.map(function (set) {
    var r = num(set.r);
    return r != null ? faNum(r) : '—';
  }).join('/');
  var weights = formatWeightList(sets);
  return weights ? weights + ' • ' + reps + ' تکرار' : reps + ' تکرار';
}

function targetsText(targets) {
  if (!targets || !targets.length) return '';
  var tokens = [];
  var uniformReps = num(targets[0].r);
  var uniformWeight = num(targets[0].w);
  var isUniform = uniformReps != null;
  for (var i = 0; i < targets.length; i++) {
    var w = num(targets[i].w);
    var r = num(targets[i].r);
    if (r != uniformReps || (w || null) !== (uniformWeight || null)) isUniform = false;
  }
  function token(w, r) {
    return r + (w != null ? '@' + w : '');
  }
  if (isUniform) {
    tokens = [targets.length + 'x' + token(uniformWeight, uniformReps)];
  } else {
    tokens = targets.map(function (t) {
      return token(num(t.w), num(t.r));
    });
  }
  return tokens.join('/');
}

function getPersonalRecord(exId, field, upToWeekKey, skipCurrentWeek) {
  var best = null;
  Object.keys(state.logs).forEach(function (weekKey) {
    if (weekKey > upToWeekKey) return;
    if (skipCurrentWeek && weekKey === upToWeekKey) return;
    var rec = state.logs[weekKey][exId];
    if (!rec) return;
    if (field === 's') {
      var count = logSets(rec).length;
      if (count && (best == null || count > best)) best = count;
      return;
    }
    logSets(rec).forEach(function (set) {
      var value = num(set[field]);
      if (value != null && (best == null || value > best)) best = value;
    });
  });
  return best;
}

function exerciseHasPrThisWeek(exId, weekKey) {
  var rec = (state.logs[weekKey] || {})[exId];
  if (!rec) return false;
  var fields = ['w', 'r'];
  return logSets(rec).some(function (set) {
    return fields.some(function (field) {
      return isNewRecord(exId, field, weekKey, set[field]);
    });
  });
}

function isNewRecord(exId, field, weekKey, value) {
  var value2 = num(value);
  if (value2 == null) return false;
  var priorBest = getPersonalRecord(exId, field, weekKey, true);
  return priorBest == null || value2 > priorBest;
}

function isStaleLogTrace(curSets, prevSets) {
  if (curSets.length !== prevSets.length) return false;
  if (!curSets.length) return false;
  for (var i = 0; i < curSets.length; i++) {
    var aw = num(curSets[i].w);
    var ar = num(curSets[i].r);
    var bw = num(prevSets[i].w);
    var br = num(prevSets[i].r);
    if (aw !== bw || ar !== br) return false;
  }
  return true;
}

function isStaleNum(exId, weekKey, prevWeekKey) {
  return isStaleLogTrace(
    logSets((state.logs[weekKey] || {})[exId]),
    logSets((state.logs[prevWeekKey] || {})[exId])
  );
}

function updateRowHighlights(weekKey, prevWeekKey, exerciseId) {
  var row = $('#tracker-days .track-row[data-ex-row="' + exerciseId + '"]');
  if (!row) return;
  row.classList.toggle('is-stale', isStaleNum(exerciseId, weekKey, prevWeekKey));
  var hasPr = false;
  $all('input[data-set]', row).forEach(function (input) {
    var isPr = isNewRecord(exerciseId, input.dataset.field, weekKey, input.value);
    input.classList.toggle('is-pr', isPr);
    if (isPr) hasPr = true;
  });
  if (!hasPr) hasPr = exerciseHasPrThisWeek(exerciseId, weekKey);
  var trophy = row.querySelector('.pr-trophy');
  if (trophy) trophy.hidden = !hasPr;
}

function persistPlan() {
  return writeStore(KEYS.plan, state.plan);
}

function persistNutrition() {
  return writeStore(KEYS.nutrition, state.nutrition);
}

function persistLogs() {
  return writeStore(KEYS.logs, state.logs);
}

function resetUiEditing() {
  state.ui.exerciseId = null;
  state.ui.exerciseIsNew = false;
  state.ui.mealId = null;
  state.ui.mealIsNew = false;
  state.ui.itemId = null;
  state.ui.itemIsNew = false;
}

function renderPlan() {
  var wrap = $('#plan-days');
  $('#plan-empty').hidden = state.plan.days.length > 0;
  state.ui.selectedPlanDayId = ensureSelectedDayId(state.ui.selectedPlanDayId);
  var chips = $('#plan-day-chips');
  chips.hidden = state.plan.days.length === 0;
  chips.innerHTML = buildChipsHtml(state.plan.days, state.ui.selectedPlanDayId, 'select-plan-day');
  wrap.innerHTML = '';
  var index = state.plan.days.findIndex(function (day) {
    return day.id === state.ui.selectedPlanDayId;
  });
  if (index !== -1) wrap.insertAdjacentHTML('beforeend', buildDayCardHtml(state.plan.days[index], index));
}

function buildDayCardHtml(day, index) {
  var color = DAY_COLORS[day.colorIndex % DAY_COLORS.length];
  var first = index === 0;
  var last = index === state.plan.days.length - 1;
  var rows = day.exercises.map(function (ex, exIndex) {
    return state.ui.exerciseId === ex.id ? buildExerciseEditHtml(day.id, ex) : buildExerciseViewHtml(day.id, ex, exIndex, color);
  }).join('');
  return (
    '<article class="card day-card" style="--day-color:' + esc(color) + '">' +
      '<header class="day-head">' +
        '<span class="day-chip">روز ' + faNum(index + 1) + '</span>' +
        '<input type="text" class="day-name-input" data-role="day-name" data-id="' + esc(day.id) + '" value="' + esc(day.name) + '" maxlength="80" aria-label="نام روز">' +
        '<span class="meal-sum">' + faNum(day.exercises.length) + ' تمرین</span>' +
        '<div class="row-actions">' +
          '<button type="button" class="icon-btn" data-action="move-day" data-id="' + esc(day.id) + '" data-dir="-1" title="انتقال به بالا" aria-label="انتقال روز به بالا"' + (first ? ' disabled' : '') + '>' + icon('up') + '</button>' +
          '<button type="button" class="icon-btn" data-action="move-day" data-id="' + esc(day.id) + '" data-dir="1" title="انتقال به پایین" aria-label="انتقال روز به پایین"' + (last ? ' disabled' : '') + '>' + icon('down') + '</button>' +
          '<button type="button" class="icon-btn danger" data-action="delete-day" data-id="' + esc(day.id) + '" title="حذف روز" aria-label="حذف روز">' + icon('trash') + '</button>' +
        '</div>' +
      '</header>' +
      '<ul class="exercises">' + rows + '</ul>' +
      '<div style="margin-top:12px">' +
        '<button type="button" class="btn-dashed" data-action="add-exercise" data-day="' + esc(day.id) + '">' + icon('plus') + ' افزودن تمرین جدید</button>' +
      '</div>' +
    '</article>'
  );
}

function buildExerciseViewHtml(dayId, ex, index, color) {
  var note = ex.note
    ? '<span class="ex-note">' + icon('bulb') + esc(ex.note) + '</span>'
    : '';
  return (
    '<li class="exercise-row" data-id="' + esc(ex.id) + '">' +
      '<span class="ex-index">' + faNum(index + 1) + '</span>' +
      '<div class="ex-main">' +
        '<strong>' + esc(ex.name) + '</strong>' +
        '<span class="ex-meta">' + (ex.targets && ex.targets.length ? 'هدف: ' + esc(formatSetsSummary(ex.targets)) : faNum(ex.sets) + ' ست × ' + faNum(ex.reps) + ' تکرار') + '</span>' +
        note +
      '</div>' +
      '<div class="row-actions">' +
        '<button type="button" class="icon-btn" data-action="move-exercise" data-day="' + esc(dayId) + '" data-id="' + esc(ex.id) + '" data-dir="-1" title="انتقال به بالا" aria-label="انتقال تمرین به بالا">' + icon('up') + '</button>' +
        '<button type="button" class="icon-btn" data-action="move-exercise" data-day="' + esc(dayId) + '" data-id="' + esc(ex.id) + '" data-dir="1" title="انتقال به پایین" aria-label="انتقال تمرین به پایین">' + icon('down') + '</button>' +
        '<button type="button" class="icon-btn" data-action="edit-exercise" data-id="' + esc(ex.id) + '" title="ویرایش" aria-label="ویرایش تمرین">' + icon('pencil') + '</button>' +
        '<button type="button" class="icon-btn danger" data-action="delete-exercise" data-day="' + esc(dayId) + '" data-id="' + esc(ex.id) + '" title="حذف" aria-label="حذف تمرین">' + icon('trash') + '</button>' +
      '</div>' +
    '</li>'
  );
}

function buildExerciseEditHtml(dayId, ex) {
  return (
    '<li class="exercise-row is-editing" data-id="' + esc(ex.id) + '">' +
      '<div class="form-grid">' +
        '<label class="field span-all">نام تمرین<input type="text" data-field="name" value="' + esc(ex.name) + '" maxlength="120"></label>' +
        '<label class="field">تعداد ست هدف<input type="number" min="1" step="1" inputmode="numeric" data-field="sets" value="' + esc(val(ex.sets)) + '"></label>' +
        '<label class="field">تعداد تکرار هدف<input type="number" min="1" step="1" inputmode="numeric" data-field="reps" value="' + esc(val(ex.reps)) + '"></label>' +
        '<label class="field span-all">هدف ست‌به‌ست (اختیاری — خالی = یکنواخت)' +
          '<input type="text" dir="ltr" data-field="targets" value="' + esc(targetsText(ex.targets)) + '" maxlength="60" placeholder="مثلاً 8/8/6 یا 2×8@40/1×6@45">' +
        '</label>' +
        '<label class="field span-all">نکته فنی (اختیاری)<input type="text" data-field="note" value="' + esc(val(ex.note)) + '" maxlength="200"></label>' +
      '</div>' +
      '<div class="edit-actions">' +
        '<button type="button" class="btn btn-primary btn-sm" data-action="save-exercise" data-day="' + esc(dayId) + '" data-id="' + esc(ex.id) + '">ذخیره تمرین</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="cancel-edit-exercise">انصراف</button>' +
      '</div>' +
    '</li>'
  );
}

function renderTracker() {
  var info = weekInfoAt(state.weekOffset);
  var prevInfo = weekInfoAt(state.weekOffset - 1);
  $('#week-label').textContent = info.label;
  $('#week-range').textContent = info.range;
  $('#btn-current-week').hidden = state.weekOffset === 0;

  var hasExercises = state.plan.days.some(function (day) {
    return day.exercises.length > 0;
  });
  var chips = $('#tracker-day-chips');
  var wrap = $('#tracker-days');
  $('#tracker-empty').hidden = hasExercises;

  if (!hasExercises) {
    chips.hidden = true;
    wrap.hidden = true;
    wrap.innerHTML = '';
    return;
  }

  state.ui.selectedTrackerDayId = ensureSelectedDayId(state.ui.selectedTrackerDayId);
  chips.hidden = false;
  chips.innerHTML = buildChipsHtml(state.plan.days, state.ui.selectedTrackerDayId, 'select-tracker-day');
  wrap.hidden = false;
  wrap.innerHTML = '';

  var dayIndex = state.plan.days.findIndex(function (day) {
    return day.id === state.ui.selectedTrackerDayId;
  });
  var day = state.plan.days[dayIndex];
  var color = DAY_COLORS[day.colorIndex % DAY_COLORS.length];
  var head =
    '<header class="day-head">' +
      '<span class="day-chip">' + esc(day.name) + '</span>' +
      '<span class="meal-sum">' + faNum(day.exercises.length) + ' تمرین</span>' +
    '</header>';

  if (!day.exercises.length) {
    wrap.insertAdjacentHTML(
      'beforeend',
      '<article class="card day-card" style="--day-color:' + esc(color) + '">' +
        head +
        '<div class="empty" style="padding:26px 16px">' +
          '<p>برای این روز هنوز تمرینی تعریف نشده است.</p>' +
          '<button type="button" class="btn btn-primary btn-sm" data-goto-tab="plan">افزودن تمرین در برنامه تمرینی</button>' +
        '</div>' +
        buildDaySummaryHtml(info.key, day) +
      '</article>'
    );
    return;
  }

  var rows = day.exercises.map(function (ex) {
    return buildTrackRowHtml(info.key, prevInfo.key, ex);
  }).join('');
  wrap.insertAdjacentHTML(
    'beforeend',
    '<article class="card day-card" style="--day-color:' + esc(color) + '">' +
      head +
      '<div class="stack" style="gap:10px">' + rows + '</div>' +
      buildDaySummaryHtml(info.key, day) +
    '</article>'
  );
}

function buildDaySummaryHtml(weekKey, day) {
  var note = (state.logs[weekKey] || {})[dayNoteKey(day.id)] || {};
  return (
    '<div class="day-summary">' +
      '<label class="field">خلاصه این روز (اختیاری)' +
        '<textarea rows="2" maxlength="500" placeholder="مثلاً: حس خوبی داشتم، وزنه‌ها خوب رفت؛ خواب کم بود…" data-day-note data-wk="' + esc(weekKey) + '" data-day="' + esc(day.id) + '">' + esc(val(note.note)) + '</textarea>' +
      '</label>' +
    '</div>'
  );
}

function buildTrackRowHtml(weekKey, prevWeekKey, ex) {
  var rec = (state.logs[weekKey] || {})[ex.id] || {};
  var sets = logSets(rec);
  var prevSets = logSets((state.logs[prevWeekKey] || {})[ex.id]);
  var prevSummary = formatSetsSummary(prevSets);
  var prevHint = prevSummary
    ? 'هفته قبل: ' + prevSummary
    : 'هفته قبل مقداری ثبت نشده';
  var hasPrThisWeek = exerciseHasPrThisWeek(ex.id, weekKey);
  var trophy = '<span class="pr-trophy"' + (hasPrThisWeek ? '' : ' hidden') + ' title="رکورد جدید در این هفته">' + icon('trophy') + '</span>';
  var stale = isStaleNum(ex.id, weekKey, prevWeekKey);
  if (state.ui.expandedTrackExId === ex.id) {
    return buildTrackExpandedHtml(weekKey, prevWeekKey, ex, trophy, stale);
  }
  var chip = sets.length
    ? '<span class="sets-chip">' + icon('layers') + esc(formatSetsSummary(sets)) + '</span>'
    : '<span class="sets-chip is-target">' + icon('layers') + 'هدف: ' + esc(ex.targets && ex.targets.length ? formatSetsSummary(ex.targets) : faNum(ex.sets) + '×' + faNum(ex.reps)) + ' — برای ثبت، لمس کنید</span>';
  return (
    '<div class="track-row' + (stale ? ' is-stale' : '') + '" data-ex-row="' + esc(ex.id) + '">' +
      '<button type="button" class="t-main" data-action="toggle-track-set" data-ex="' + esc(ex.id) + '">' +
        '<span class="t-head"><strong>' + esc(ex.name) + '</strong>' + trophy + '</span>' +
        (ex.note ? '<span class="prev-hint">' + icon('bulb') + ' ' + esc(ex.note) + '</span>' : '') +
        '<span class="prev-hint">' + esc(prevHint) + '</span>' +
        chip +
      '</button>' +
      '<span class="t-chevron" aria-hidden="true">' + icon('down') + '</span>' +
    '</div>'
  );
}

function buildTrackExpandedHtml(weekKey, prevWeekKey, ex, trophy, stale) {
  var rec = (state.logs[weekKey] || {})[ex.id] || {};
  var sets = logSets(rec);
  var prevSets = logSets((state.logs[prevWeekKey] || {})[ex.id]);
  var prW = getPersonalRecord(ex.id, 'w', weekKey);
  var prR = getPersonalRecord(ex.id, 'r', weekKey);
  var targetCount = Math.round(num(ex.sets) || 3) || 3;
  var rowCount = Math.min(MAX_TRACK_SETS, Math.max(sets.length, targetCount));
  var rows = [];
  for (var i = 0; i < rowCount; i++) {
    var set = sets[i] || null;
    var prevSet = prevSets[i] || null;
    var trgt = ex.targets && ex.targets.length ? ex.targets[i] : null;
    var phW = prevSet && num(prevSet.w) != null ? prevSet.w : (trgt && num(trgt.w) != null ? trgt.w : prW);
    var phR = prevSet && num(prevSet.r) != null ? prevSet.r : (trgt && num(trgt.r) != null ? trgt.r : (num(ex.reps) != null ? ex.reps : prR));
    rows.push(
      '<div class="set-row">' +
        '<span class="set-index">' + faNum(i + 1) + '</span>' +
        '<label class="set-field"><span>وزنه (کیلوگرم)</span>' +
          '<input class="' + (set && isNewRecord(ex.id, 'w', weekKey, set.w) ? 'is-pr' : '') + '" type="number" min="0" step="0.25" inputmode="decimal" placeholder="' + esc(phW != null && phW !== '' ? faNum(phW) : '') + '" data-wk="' + esc(weekKey) + '" data-ex="' + esc(ex.id) + '" data-set="' + i + '" data-field="w" value="' + esc(val(set && set.w)) + '">' +
        '</label>' +
        '<label class="set-field"><span>تکرار</span>' +
          '<input class="' + (set && isNewRecord(ex.id, 'r', weekKey, set.r) ? 'is-pr' : '') + '" type="number" min="0" step="1" inputmode="numeric" placeholder="' + esc(phR != null && phR !== '' ? faNum(phR) : '') + '" data-wk="' + esc(weekKey) + '" data-ex="' + esc(ex.id) + '" data-set="' + i + '" data-field="r" value="' + esc(val(set && set.r)) + '">' +
        '</label>' +
        (set
          ? '<button type="button" class="icon-btn danger set-remove" data-action="remove-track-set" data-wk="' + esc(weekKey) + '" data-ex="' + esc(ex.id) + '" data-set="' + i + '" title="حذف ست" aria-label="حذف ست ' + faNum(i + 1) + '">' + icon('trash') + '</button>'
          : '<span class="set-remove" aria-hidden="true"></span>') +
      '</div>'
    );
  }
  return (
    '<div class="track-row is-expanded' + (stale ? ' is-stale' : '') + '" data-ex-row="' + esc(ex.id) + '">' +
      '<header class="t-info">' +
        '<div class="t-line">' +
          '<span class="t-head"><strong>' + esc(ex.name) + '</strong>' + trophy + '</span>' +
          '<button type="button" class="icon-btn t-collapse" data-action="toggle-track-set" data-ex="' + esc(ex.id) + '" title="بستن" aria-label="بستن ویرایش ست‌های ' + esc(ex.name) + '">' + icon('up') + '</button>' +
        '</div>' +
        (ex.note ? '<span class="prev-hint">' + icon('bulb') + ' ' + esc(ex.note) + '</span>' : '') +
      '</header>' +
      '<div class="quick-row">' +
        '<label class="field quick-field">ثبت سریع ست‌ها' +
          '<input type="text" dir="ltr" data-role="track-quick" data-wk="' + esc(weekKey) + '" data-ex="' + esc(ex.id) + '" placeholder="مثلاً 8/8/6 یا 3×8@40">' +
        '</label>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="copy-track-prev" data-wk="' + esc(weekKey) + '" data-ex="' + esc(ex.id) + '">' + icon('copy') + ' کپی از هفته قبل</button>' +
      '</div>' +
      '<div class="track-sets">' +
        '<div class="set-row sets-head" aria-hidden="true">' +
          '<span class="set-index">ست</span>' +
          '<span class="set-field">وزنه (کیلوگرم)</span>' +
          '<span class="set-field">تکرار</span>' +
          '<span class="set-remove"></span>' +
        '</div>' +
        rows.join('') +
      '</div>' +
      '<div class="track-sets-foot">' +
        '<button type="button" class="btn-dashed" data-action="add-track-set" data-wk="' + esc(weekKey) + '" data-ex="' + esc(ex.id) + '">' + icon('plus') + ' افزودن ست' + (sets.length ? ' (حالا ' + faNum(sets.length) + ' ست)' : '') + '</button>' +
      '</div>' +
    '</div>'
  );
}

function parseQuickSets(text) {
  var raw = enNum(String(text == null ? '' : text)).trim();
  if (!raw) return [];
  raw = raw.replace(/[×xX*]/g, 'x');
  raw = raw.replace(/[،,؛;|]/g, '/');
  var parts = raw.split('/').filter(function (part) {
    return part.trim() !== '';
  });
  var sets = [];
  for (var i = 0; i < parts.length; i++) {
    var match = parts[i].trim().match(/^(\d{1,2})(?:x(\d{1,2}))?(?:@(\d{1,3}(?:\.\d{1,2})?))?$/);
    if (!match) return null;
    var count = match[2] ? parseInt(match[1], 10) : 1;
    var reps = match[2] ? parseInt(match[2], 10) : parseInt(match[1], 10);
    var weight = match[3] !== undefined ? parseFloat(match[3]) : '';
    if (!count || !reps) return null;
    for (var j = 0; j < count; j++) {
      if (sets.length >= MAX_TRACK_SETS) return null;
      sets.push({ w: weight === '' ? '' : weight, r: reps });
    }
  }
  return sets.length ? sets : null;
}

function mealTotals(meal) {
  var protein = 0;
  var kcal = 0;
  meal.items.forEach(function (item) {
    var p = num(item.protein);
    var k = num(item.kcal);
    if (p != null) protein += p;
    if (k != null) kcal += k;
  });
  return { protein: protein, kcal: kcal };
}

function renderNutrition() {
  var wrap = $('#nutrition-meals');
  wrap.innerHTML = '';
  $('#nutrition-empty').hidden = state.nutrition.meals.length > 0;
  state.nutrition.meals.forEach(function (meal) {
    wrap.insertAdjacentHTML('beforeend', buildMealCardHtml(meal));
  });

  var totals = { protein: 0, kcal: 0 };
  state.nutrition.meals.forEach(function (meal) {
    var t = mealTotals(meal);
    totals.protein += t.protein;
    totals.kcal += t.kcal;
  });
  var hasMeals = state.nutrition.meals.length > 0;
  $('#nutrition-summary').hidden = !hasMeals;
  $('#total-protein').textContent = faNum(Math.round(totals.protein * 10) / 10);
  $('#total-kcal').textContent = faNum(Math.round(totals.kcal));
}

function buildMealCardHtml(meal) {
  var t = mealTotals(meal);
  var sumChip =
    t.protein || t.kcal
      ? '<span class="meal-sum">~' + faNum(Math.round(t.protein * 10) / 10) + ' گ پروتئین • ~' + faNum(Math.round(t.kcal)) + ' کالری</span>'
      : '';
  var head;
  if (state.ui.mealId === meal.id) {
    head =
      '<div class="form-grid" style="width:100%">' +
        '<label class="field span-all">نام وعده<input type="text" data-field="name" value="' + esc(meal.name) + '" maxlength="80"></label>' +
        '<label class="field span-all">یادداشت (اختیاری)<input type="text" data-field="note" value="' + esc(val(meal.note)) + '" maxlength="200"></label>' +
        '<div class="edit-actions">' +
          '<button type="button" class="btn btn-primary btn-sm" data-action="save-meal" data-id="' + esc(meal.id) + '">ذخیره وعده</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-action="cancel-edit-meal">انصراف</button>' +
        '</div>' +
      '</div>';
  } else {
    head =
      '<span class="meal-icon">' + icon('utensils') + '</span>' +
      '<h3>' + esc(meal.name) + '</h3>' +
      sumChip +
      '<div class="row-actions">' +
        '<button type="button" class="icon-btn" data-action="edit-meal" data-id="' + esc(meal.id) + '" title="ویرایش وعده" aria-label="ویرایش وعده">' + icon('pencil') + '</button>' +
        '<button type="button" class="icon-btn danger" data-action="delete-meal" data-id="' + esc(meal.id) + '" title="حذف وعده" aria-label="حذف وعده">' + icon('trash') + '</button>' +
      '</div>';
  }
  var items = meal.items.map(function (item) {
    return state.ui.itemId === item.id ? buildItemEditHtml(meal.id, item) : buildItemViewHtml(meal.id, item);
  }).join('');
  var noteHtml = meal.note && state.ui.mealId !== meal.id
    ? '<p class="meal-note">' + icon('bulb') + esc(meal.note) + '</p>'
    : '';
  return (
    '<article class="card meal-card" data-id="' + esc(meal.id) + '">' +
      '<header class="meal-head">' + head + '</header>' +
      '<ul class="items">' + items + '</ul>' +
      '<div class="meal-foot">' +
        noteHtml +
        '<button type="button" class="btn-dashed" data-action="add-item" data-meal="' + esc(meal.id) + '">' + icon('plus') + ' افزودن ماده غذایی</button>' +
      '</div>' +
    '</article>'
  );
}

function buildItemViewHtml(mealId, item) {
  var macros = [];
  if (num(item.protein) != null) macros.push(faNum(item.protein) + ' گ پروتئین');
  if (num(item.kcal) != null) macros.push(faNum(item.kcal) + ' کالری');
  return (
    '<li class="item-row" data-id="' + esc(item.id) + '">' +
      '<span class="item-name">' + esc(item.name) + '</span>' +
      '<span class="item-qty">' + esc(item.qty || '—') + '</span>' +
      '<span class="item-macros">' + (macros.join(' • ') || 'بدون مقدار غذایی') + '</span>' +
      '<div class="row-actions">' +
        '<button type="button" class="icon-btn" data-action="edit-item" data-meal="' + esc(mealId) + '" data-id="' + esc(item.id) + '" title="ویرایش" aria-label="ویرایش ماده غذایی">' + icon('pencil') + '</button>' +
        '<button type="button" class="icon-btn danger" data-action="delete-item" data-meal="' + esc(mealId) + '" data-id="' + esc(item.id) + '" title="حذف" aria-label="حذف ماده غذایی">' + icon('trash') + '</button>' +
      '</div>' +
    '</li>'
  );
}

function buildItemEditHtml(mealId, item) {
  return (
    '<li class="item-row is-editing" data-id="' + esc(item.id) + '">' +
      '<div class="form-grid">' +
        '<label class="field span-all">نام ماده غذایی<input type="text" data-field="name" value="' + esc(item.name) + '" maxlength="120"></label>' +
        '<label class="field">مقدار تقریبی<input type="text" data-field="qty" value="' + esc(val(item.qty)) + '" maxlength="60" placeholder="مثلاً ۱۰۰ گرم"></label>' +
        '<label class="field">پروتئین (گرم)<input type="number" min="0" step="0.5" inputmode="decimal" data-field="protein" value="' + esc(val(item.protein)) + '"></label>' +
        '<label class="field">کالری (کیلوکالری)<input type="number" min="0" step="1" inputmode="decimal" data-field="kcal" value="' + esc(val(item.kcal)) + '"></label>' +
      '</div>' +
      '<div class="edit-actions">' +
        '<button type="button" class="btn btn-primary btn-sm" data-action="save-item" data-meal="' + esc(mealId) + '" data-id="' + esc(item.id) + '">ذخیره</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="cancel-edit-item">انصراف</button>' +
      '</div>' +
    '</li>'
  );
}

function renderAll() {
  renderPlan();
  renderTracker();
  renderNutrition();
}

function switchTab(name) {
  $all('.tab').forEach(function (tab) {
    var isActive = tab.dataset.tab === name;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  $('#panel-plan').hidden = name !== 'plan';
  $('#panel-tracker').hidden = name !== 'tracker';
  $('#panel-nutrition').hidden = name !== 'nutrition';
  if (name === 'plan') renderPlan();
  if (name === 'tracker') renderTracker();
  if (name === 'nutrition') renderNutrition();
}

var confirmCallback = null;

function askConfirm(options) {
  $('#confirm-title').textContent = options.title;
  $('#confirm-message').textContent = options.message;
  $('#confirm-ok').textContent = options.okLabel || 'تأیید';
  confirmCallback = options.onOk || null;
  $('#confirm-overlay').hidden = false;
  $('#confirm-ok').focus();
}

function closeConfirm() {
  $('#confirm-overlay').hidden = true;
  confirmCallback = null;
}

var toastTimer = null;

function showToast(message, kind) {
  var el = $('#toast');
  el.textContent = message;
  el.className = 'toast show' + (kind ? ' ' + kind : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    el.className = 'toast';
  }, 2800);
}

var saveTimer = null;
var statusTimer = null;

function setSaveStatus(status) {
  var pill = $('#save-status');
  pill.hidden = false;
  pill.dataset.state = status;
  pill.textContent = status === 'saving' ? 'در حال ذخیره…' : status === 'saved' ? 'ذخیره شد' : 'خطا در ذخیره‌سازی';
  clearTimeout(statusTimer);
  if (status === 'saved') {
    statusTimer = setTimeout(function () {
      pill.hidden = true;
    }, STATUS_HIDE_MS);
  }
}

function flushPendingLogsSave() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!$('#save-status').hidden && $('#save-status').dataset.state === 'saving') {
    setSaveStatus(persistLogs() ? 'saved' : 'error');
  }
}

function queueLogsSave() {
  setSaveStatus('saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    saveTimer = null;
    setSaveStatus(persistLogs() ? 'saved' : 'error');
  }, SAVE_DEBOUNCE_MS);
}

function addDay() {
  var day = {
    id: uid(),
    name: nextDayName(),
    colorIndex: state.plan.days.length % DAY_COLORS.length,
    exercises: []
  };
  state.plan.days.push(day);
  persistPlan();
  resetUiEditing();
  state.ui.selectedPlanDayId = day.id;
  renderPlan();
  showToast('روز جدید اضافه شد.', 'success');
}

function deleteDay(dayId) {
  var day = findDay(dayId);
  if (!day) return;
  askConfirm({
    title: 'حذف روز',
    message: 'روز «' + day.name + '» همراه با همه تمرین‌هایش حذف شود؟ این عمل بازگشت‌پذیر نیست.',
    okLabel: 'حذف روز',
    onOk: function () {
      var ids = day.exercises.map(function (ex) {
        return ex.id;
      });
      state.plan.days = state.plan.days.filter(function (d) {
        return d.id !== dayId;
      });
      removeExercisesFromLogs(ids);
      removeDayNotesFromLogs(dayId);
      if (state.ui.selectedPlanDayId === dayId) state.ui.selectedPlanDayId = null;
      if (state.ui.selectedTrackerDayId === dayId) state.ui.selectedTrackerDayId = null;
      persistPlan();
      persistLogs();
      resetUiEditing();
      renderAll();
      showToast('روز حذف شد.', 'success');
    }
  });
}

function moveDay(dayId, dir) {
  var index = state.plan.days.findIndex(function (day) {
    return day.id === dayId;
  });
  var target = index + dir;
  if (index === -1 || target < 0 || target >= state.plan.days.length) return;
  var tmp = state.plan.days[index];
  state.plan.days[index] = state.plan.days[target];
  state.plan.days[target] = tmp;
  persistPlan();
  renderPlan();
}

function addExercise(dayId) {
  var day = findDay(dayId);
  if (!day) return;
  flushPendingLogsSave();
  var ex = makeExercise('', 3, 10, '');
  day.exercises.push(ex);
  persistPlan();
  resetUiEditing();
  state.ui.exerciseId = ex.id;
  state.ui.exerciseIsNew = true;
  renderPlan();
  var row = $('#plan-days .exercise-row[data-id="' + ex.id + '"] input[data-field="name"]');
  if (row) row.focus();
}

function readExerciseForm(row) {
  var rawTargets = $('[data-field="targets"]', row).value.trim();
  return {
    name: $('[data-field="name"]', row).value.trim(),
    sets: Math.max(1, Math.round(num($('[data-field="sets"]', row).value) || 3)),
    reps: Math.max(1, Math.round(num($('[data-field="reps"]', row).value) || 10)),
    targets: rawTargets ? parseQuickSets(rawTargets) : [],
    note: $('[data-field="note"]', row).value.trim()
  };
}

function saveExercise(dayId, exerciseId) {
  var row = $('#plan-days .exercise-row.is-editing[data-id="' + exerciseId + '"]');
  var day = findDay(dayId);
  var ex = day && day.exercises.find(function (e) {
    return e.id === exerciseId;
  });
  if (!row || !ex) return;
  var data = readExerciseForm(row);
  if (!data.name) {
    $('[data-field="name"]', row).focus();
    showToast('نام تمرین نمی‌تواند خالی باشد.', 'error');
    return;
  }
  if (data.targets === null) {
    $('[data-field="targets"]', row).focus();
    showToast('فرمت هدف ست‌به‌ست درست نیست. مثلاً 8/8/6 یا 3×8@40', 'error');
    return;
  }
  ex.name = data.name;
  ex.targets = data.targets.length ? data.targets : null;
  ex.sets = ex.targets ? ex.targets.length : data.sets;
  ex.reps = ex.targets ? ex.targets[0].r : data.reps;
  ex.note = data.note;
  persistPlan();
  resetUiEditing();
  renderPlan();
  showToast('تمرین ذخیره شد.', 'success');
}

function cancelEditExercise() {
  if (state.ui.exerciseIsNew && state.ui.exerciseId) {
    state.plan.days.forEach(function (day) {
      day.exercises = day.exercises.filter(function (e) {
        return e.id !== state.ui.exerciseId;
      });
    });
    persistPlan();
  }
  resetUiEditing();
  renderPlan();
}

function deleteExercise(dayId, exerciseId) {
  var day = findDay(dayId);
  var ex = day && day.exercises.find(function (e) {
    return e.id === exerciseId;
  });
  if (!ex) return;
  askConfirm({
    title: 'حذف تمرین',
    message: 'تمرین «' + ex.name + '» حذف شود؟ رکوردهای ثبت‌شده آن هم پاک می‌شود.',
    okLabel: 'حذف تمرین',
    onOk: function () {
      day.exercises = day.exercises.filter(function (e) {
        return e.id !== exerciseId;
      });
      removeExercisesFromLogs([exerciseId]);
      persistPlan();
      persistLogs();
      resetUiEditing();
      renderAll();
      showToast('تمرین حذف شد.', 'success');
    }
  });
}

function moveExercise(dayId, exerciseId, dir) {
  var day = findDay(dayId);
  if (!day) return;
  var index = day.exercises.findIndex(function (e) {
    return e.id === exerciseId;
  });
  var target = index + dir;
  if (index === -1 || target < 0 || target >= day.exercises.length) return;
  var tmp = day.exercises[index];
  day.exercises[index] = day.exercises[target];
  day.exercises[target] = tmp;
  persistPlan();
  renderPlan();
}

function ensureTrackRec(weekKey, exerciseId) {
  if (!state.logs[weekKey]) state.logs[weekKey] = {};
  var rec = state.logs[weekKey][exerciseId];
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) rec = { sets: [] };
  if (!Array.isArray(rec.sets)) rec = normalizeLogRec(rec);
  state.logs[weekKey][exerciseId] = rec;
  return rec;
}

function addTrackSet(weekKey, exerciseId) {
  var ex = findExercise(exerciseId);
  var rec = ensureTrackRec(weekKey, exerciseId);
  var sets = rec.sets;
  if (sets.length >= MAX_TRACK_SETS) {
    showToast('حداکثر ' + faNum(MAX_TRACK_SETS) + ' ست می‌توان ثبت کرد.', 'error');
    return;
  }
  var last = sets.length ? sets[sets.length - 1] : null;
  var prevSets = logSets((state.logs[weekInfoAt(state.weekOffset - 1).key] || {})[exerciseId]);
  var prevFirst = prevSets.length ? prevSets[0] : null;
  var w = last && num(last.w) != null
    ? last.w
    : prevFirst && num(prevFirst.w) != null
      ? prevFirst.w
      : ((ex && getPersonalRecord(exerciseId, 'w', weekKey)) || '');
  var r = last && num(last.r) != null
    ? last.r
    : prevFirst && num(prevFirst.r) != null
      ? prevFirst.r
      : (ex ? ex.reps : '');
  sets.push({ w: val(w), r: val(r) });
  queueLogsSave();
  renderTracker();
  var repInput = $('#tracker-days .track-row[data-ex-row="' + exerciseId + '"] input[data-set="' + (sets.length - 1) + '"][data-field="r"]');
  if (repInput) repInput.focus();
}

function removeTrackSet(weekKey, exerciseId, setIndex) {
  var rec = ensureTrackRec(weekKey, exerciseId);
  if (setIndex < 0 || setIndex >= rec.sets.length) return;
  rec.sets.splice(setIndex, 1);
  if (!rec.sets.length) delete state.logs[weekKey][exerciseId];
  queueLogsSave();
  renderTracker();
  var weekInfo = weekInfoAt(state.weekOffset);
  updateRowHighlights(weekInfo.key, weekInfoAt(state.weekOffset - 1).key, exerciseId);
}

function copyTrackPrev(weekKey, exerciseId) {
  var prevSets = logSets((state.logs[weekInfoAt(state.weekOffset - 1).key] || {})[exerciseId]).map(function (set) {
    return { w: val(set.w), r: val(set.r) };
  });
  if (!prevSets.length) {
    showToast('برای این تمرین در هفته قبل مقداری ثبت نشده است.', 'error');
    return;
  }
  var rec = ensureTrackRec(weekKey, exerciseId);
  rec.sets = prevSets.slice(0, MAX_TRACK_SETS);
  queueLogsSave();
  renderTracker();
  showToast('ست‌های هفته قبل کپی شد.', 'success');
}

function addMeal() {
  flushPendingLogsSave();
  var meal = { id: uid(), name: 'وعده جدید', note: '', items: [] };
  state.nutrition.meals.push(meal);
  persistNutrition();
  resetUiEditing();
  renderNutrition();
  var card = $('#nutrition-meals .meal-card[data-id="' + meal.id + '"]');
  if (card) $('[data-field="name"]', card).focus();
}

function editMeal(mealId) {
  resetUiEditing();
  state.ui.mealId = mealId;
  renderNutrition();
  var card = $('#nutrition-meals .meal-card[data-id="' + mealId + '"]');
  if (card) $('[data-field="name"]', card).focus();
}

function saveMeal(mealId) {
  var card = $('#nutrition-meals .meal-card[data-id="' + mealId + '"]');
  var meal = findMeal(mealId);
  if (!card || !meal) return;
  var name = $('[data-field="name"]', card).value.trim();
  if (!name) {
    $('[data-field="name"]', card).focus();
    showToast('نام وعده نمی‌تواند خالی باشد.', 'error');
    return;
  }
  meal.name = name;
  meal.note = $('[data-field="note"]', card).value.trim();
  persistNutrition();
  resetUiEditing();
  renderNutrition();
  showToast('وعده ذخیره شد.', 'success');
}

function cancelEditMeal() {
  if (state.ui.mealIsNew && state.ui.mealId) {
    state.nutrition.meals = state.nutrition.meals.filter(function (m) {
      return m.id !== state.ui.mealId;
    });
    persistNutrition();
  }
  resetUiEditing();
  renderNutrition();
}

function deleteMeal(mealId) {
  var meal = findMeal(mealId);
  if (!meal) return;
  askConfirm({
    title: 'حذف وعده',
    message: 'وعده «' + meal.name + '» با همه مواد غذایی‌اش حذف شود؟',
    okLabel: 'حذف وعده',
    onOk: function () {
      state.nutrition.meals = state.nutrition.meals.filter(function (m) {
        return m.id !== mealId;
      });
      persistNutrition();
      resetUiEditing();
      renderNutrition();
      showToast('وعده حذف شد.', 'success');
    }
  });
}

function addItem(mealId) {
  var meal = findMeal(mealId);
  if (!meal) return;
  var item = { id: uid(), name: '', qty: '', protein: '', kcal: '' };
  meal.items.push(item);
  persistNutrition();
  resetUiEditing();
  state.ui.itemId = item.id;
  state.ui.itemIsNew = true;
  renderNutrition();
  var row = $('#nutrition-meals .item-row[data-id="' + item.id + '"] input[data-field="name"]');
  if (row) row.focus();
}

function saveItem(mealId, itemId) {
  var meal = findMeal(mealId);
  var item = meal && meal.items.find(function (i) {
    return i.id === itemId;
  });
  var row = $('#nutrition-meals .item-row.is-editing[data-id="' + itemId + '"]');
  if (!meal || !item || !row) return;
  var name = $('[data-field="name"]', row).value.trim();
  if (!name) {
    $('[data-field="name"]', row).focus();
    showToast('نام ماده غذایی نمی‌تواند خالی باشد.', 'error');
    return;
  }
  item.name = name;
  item.qty = $('[data-field="qty"]', row).value.trim();
  item.protein = $('[data-field="protein"]', row).value.trim();
  item.kcal = $('[data-field="kcal"]', row).value.trim();
  persistNutrition();
  resetUiEditing();
  renderNutrition();
  showToast('ماده غذایی ذخیره شد.', 'success');
}

function cancelEditItem() {
  if (state.ui.itemIsNew && state.ui.itemId) {
    state.nutrition.meals.forEach(function (meal) {
      meal.items = meal.items.filter(function (i) {
        return i.id !== state.ui.itemId;
      });
    });
    persistNutrition();
  }
  resetUiEditing();
  renderNutrition();
}

function deleteItem(mealId, itemId) {
  var meal = findMeal(mealId);
  var item = meal && meal.items.find(function (i) {
    return i.id === itemId;
  });
  if (!item) return;
  askConfirm({
    title: 'حذف ماده غذایی',
    message: '«' + item.name + '» از وعده «' + meal.name + '» حذف شود؟',
    okLabel: 'حذف',
    onOk: function () {
      meal.items = meal.items.filter(function (i) {
        return i.id !== itemId;
      });
      persistNutrition();
      resetUiEditing();
      renderNutrition();
      showToast('ماده غذایی حذف شد.', 'success');
    }
  });
}

var ACTIONS = {
  'add-day': function (btn) {
    addDay();
  },
  'delete-day': function (btn) {
    deleteDay(btn.dataset.id);
  },
  'move-day': function (btn) {
    moveDay(btn.dataset.id, parseInt(btn.dataset.dir, 10));
  },
  'add-exercise': function (btn) {
    addExercise(btn.dataset.day);
  },
  'edit-exercise': function (btn) {
    flushPendingLogsSave();
    resetUiEditing();
    state.ui.exerciseId = btn.dataset.id;
    renderPlan();
    var row = $('#plan-days .exercise-row.is-editing input[data-field="name"]');
    if (row) row.focus();
  },
  'save-exercise': function (btn) {
    saveExercise(btn.dataset.day, btn.dataset.id);
  },
  'cancel-edit-exercise': function () {
    cancelEditExercise();
  },
  'delete-exercise': function (btn) {
    deleteExercise(btn.dataset.day, btn.dataset.id);
  },
  'move-exercise': function (btn) {
    moveExercise(btn.dataset.day, btn.dataset.id, parseInt(btn.dataset.dir, 10));
  },
  'select-plan-day': function (btn) {
    flushPendingLogsSave();
    resetUiEditing();
    state.ui.selectedPlanDayId = btn.dataset.id;
    renderPlan();
  },
  'select-tracker-day': function (btn) {
    flushPendingLogsSave();
    state.ui.selectedTrackerDayId = btn.dataset.id;
    renderTracker();
  },
  'toggle-track-set': function (btn) {
    flushPendingLogsSave();
    var exId = btn.dataset.ex;
    state.ui.expandedTrackExId = state.ui.expandedTrackExId === exId ? null : exId;
    renderTracker();
  },
  'add-track-set': function (btn) {
    addTrackSet(btn.dataset.wk, btn.dataset.ex);
  },
  'remove-track-set': function (btn) {
    removeTrackSet(btn.dataset.wk, btn.dataset.ex, parseInt(btn.dataset.set, 10));
  },
  'copy-track-prev': function (btn) {
    copyTrackPrev(btn.dataset.wk, btn.dataset.ex);
  },
  'add-meal': function () {
    addMeal();
  },
  'edit-meal': function (btn) {
    editMeal(btn.dataset.id);
  },
  'save-meal': function (btn) {
    saveMeal(btn.dataset.id);
  },
  'cancel-edit-meal': function () {
    cancelEditMeal();
  },
  'delete-meal': function (btn) {
    deleteMeal(btn.dataset.id);
  },
  'add-item': function (btn) {
    addItem(btn.dataset.meal);
  },
  'edit-item': function (btn) {
    resetUiEditing();
    state.ui.itemId = btn.dataset.id;
    renderNutrition();
    var row = $('#nutrition-meals .item-row.is-editing input[data-field="name"]');
    if (row) row.focus();
  },
  'save-item': function (btn) {
    saveItem(btn.dataset.meal, btn.dataset.id);
  },
  'cancel-edit-item': function () {
    cancelEditItem();
  },
  'delete-item': function (btn) {
    deleteItem(btn.dataset.meal, btn.dataset.id);
  }
};

function downloadBackup() {
  flushPendingLogsSave();
  var data = {};
  [KEYS.plan, KEYS.logs, KEYS.nutrition].forEach(function (key) {
    var raw = localStorage.getItem(key);
    if (raw == null) return;
    try {
      data[key] = JSON.parse(raw);
    } catch (err) {
      /* skip */
    }
  });
  var payload = {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: data
  };
  var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  var now = new Date();
  var stamp = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  a.href = url;
  a.download = 'workout-nutrition-backup-' + stamp + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 500);
  showToast('فایل پشتیبان دانلود شد.', 'success');
}

function restoreBackup(file) {
  var reader = new FileReader();
  reader.onload = function () {
    var payload;
    try {
      payload = JSON.parse(String(reader.result));
    } catch (err) {
      showToast('فایل انتخاب‌شده یک فایل JSON معتبر نیست.', 'error');
      return;
    }
    if (!payload || payload.app !== BACKUP_APP_ID || !payload.data || typeof payload.data !== 'object') {
      showToast('ساختار فایل پشتیبان معتبر نیست.', 'error');
      return;
    }
    var valid = {};
    var count = 0;
    if (payload.data[KEYS.plan] !== undefined && validPlan(payload.data[KEYS.plan])) {
      valid[KEYS.plan] = payload.data[KEYS.plan];
      count++;
    }
    if (payload.data[KEYS.logs] !== undefined && validLogs(payload.data[KEYS.logs])) {
      valid[KEYS.logs] = payload.data[KEYS.logs];
      count++;
    }
    if (payload.data[KEYS.nutrition] !== undefined && validNutrition(payload.data[KEYS.nutrition])) {
      valid[KEYS.nutrition] = payload.data[KEYS.nutrition];
      count++;
    }
    if (!count) {
      showToast('در این فایل هیچ داده معتبری پیدا نشد.', 'error');
      return;
    }
    var when = payload.exportedAt ? new Date(payload.exportedAt).toLocaleDateString('fa-IR') : 'نامشخص';
    askConfirm({
      title: 'بازگردانی اطلاعات',
      message: 'اطلاعات فعلی با محتوای پشتیبان (تاریخ تهیه: ' + when + ') جایگزین می‌شود. مطمئن هستید؟',
      okLabel: 'بازگردانی',
      onOk: function () {
        Object.keys(valid).forEach(function (key) {
          localStorage.setItem(key, JSON.stringify(valid[key]));
        });
        if (valid[KEYS.plan]) state.plan = valid[KEYS.plan];
        if (valid[KEYS.nutrition]) state.nutrition = valid[KEYS.nutrition];
        if (valid[KEYS.logs]) {
          state.logs = normalizeLogs(valid[KEYS.logs]);
          persistLogs();
        }
        resetUiEditing();
        state.weekOffset = 0;
        renderAll();
        showToast(count + ' بخش داده با موفقیت بازگردانی شد.', 'success');
      }
    });
  };
  reader.onerror = function () {
    showToast('خواندن فایل با خطا مواجه شد.', 'error');
  };
  reader.readAsText(file, 'utf-8');
}

function requestAppUpdate() {
  askConfirm({
    title: 'به‌روزرسانی اپ',
    message: 'آخرین نسخه از سرور دریافت و صفحه دوباره بارگیری می‌شود. داده‌های شما حذف نمی‌شود.',
    okLabel: 'به‌روزرسانی',
    onOk: function () {
      performAppUpdate();
    }
  });
}

function performAppUpdate() {
  var cleanup = Promise.resolve();
  if ('serviceWorker' in navigator) {
    cleanup = navigator.serviceWorker.getRegistrations().then(function (registrations) {
      return Promise.all(registrations.map(function (registration) {
        return registration.unregister();
      }));
    }).catch(function () { /* noop */ });
  }
  if (self.caches && caches.keys) {
    cleanup = cleanup.then(function () {
      return caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (key) {
          return caches.delete(key);
        }));
      });
    }).catch(function () { /* noop */ });
  }
  cleanup.then(function () {
    try {
      localStorage.setItem(APP_UPDATE_KEY, String(Date.now()));
    } catch (err) {
      /* noop */
    }
    showToast('در حال دریافت نسخه جدید…', 'success');
    setTimeout(function () {
      window.location.reload();
    }, 500);
  });
}

function announceRecentUpdate() {
  var ts = 0;
  try {
    ts = Number(localStorage.getItem(APP_UPDATE_KEY) || 0);
  } catch (err) {
    return;
  }
  if (!ts) return;
  try {
    localStorage.removeItem(APP_UPDATE_KEY);
  } catch (err) {
    /* noop */
  }
  if (Date.now() - ts < 20000) {
    showToast('اپ به آخرین نسخه به‌روزرسانی شد.', 'success');
  }
}

function loadData(seedIfMissing) {
  var planRes = loadSection(KEYS.plan, validPlan, makeSeedPlan);
  state.plan = planRes.value;
  if (seedIfMissing && planRes.seeded) persistPlan();

  var nutritionRes = loadSection(KEYS.nutrition, validNutrition, makeSeedNutrition);
  state.nutrition = nutritionRes.value;
  if (seedIfMissing && nutritionRes.seeded) persistNutrition();

  state.logs = {};
  try {
    var raw = localStorage.getItem(KEYS.logs);
    if (raw != null) {
      var parsed = JSON.parse(raw);
      if (validLogs(parsed)) state.logs = normalizeLogs(parsed);
    }
  } catch (err) {
    state.logs = {};
  }
}

function bindEvents() {
  document.addEventListener('click', function (event) {
    var actionBtn = event.target.closest('[data-action]');
    if (actionBtn) {
      var handler = ACTIONS[actionBtn.dataset.action];
      if (handler) handler(actionBtn);
      return;
    }
    var gotoBtn = event.target.closest('[data-goto-tab]');
    if (gotoBtn) {
      switchTab(gotoBtn.dataset.gotoTab);
      return;
    }
    var tab = event.target.closest('.tab');
    if (tab) switchTab(tab.dataset.tab);
  });

  document.addEventListener('change', function (event) {
    var input = event.target.closest('.day-name-input');
    if (!input) return;
    var day = findDay(input.dataset.id);
    if (!day) return;
    var name = input.value.trim();
    day.name = name || day.name;
    input.value = day.name;
    persistPlan();
    ['#plan-day-chips', '#tracker-day-chips'].forEach(function (sel) {
      var chip = $(sel + ' .chip-btn[data-id="' + day.id + '"]');
      if (chip) chip.textContent = day.name;
    });
    renderTracker();
  });

  $('#panel-tracker').addEventListener('input', function (event) {
    var noteInput = event.target.closest('textarea[data-day-note]');
    if (noteInput) {
      var nWeek = noteInput.dataset.wk;
      var nDay = noteInput.dataset.day;
      if (!state.logs[nWeek]) state.logs[nWeek] = {};
      state.logs[nWeek][dayNoteKey(nDay)] = { note: noteInput.value.trim() };
      queueLogsSave();
      return;
    }
    var setInput = event.target.closest('input[data-wk][data-set]');
    if (!setInput) return;
    var weekKey = setInput.dataset.wk;
    var exerciseId = setInput.dataset.ex;
    var setIndex = parseInt(setInput.dataset.set, 10);
    if (isNaN(setIndex)) return;
    var rec = ensureTrackRec(weekKey, exerciseId);
    if (setIndex >= MAX_TRACK_SETS || setInput.dataset.field === 's') return;
    while (rec.sets.length <= setIndex) rec.sets.push({ w: '', r: '' });
    rec.sets[setIndex][setInput.dataset.field] = setInput.value.trim();
    updateRowHighlights(weekKey, weekInfoAt(state.weekOffset - 1).key, exerciseId);
    queueLogsSave();
  });

  $('#panel-tracker').addEventListener('change', function (event) {
    var quick = event.target.closest('input[data-role="track-quick"]');
    if (!quick) return;
    var parsed = parseQuickSets(quick.value);
    if (parsed === null) {
      showToast('فرمت ثبت سریع درست نیست. مثلاً 8/8/6 یا 3×8@40', 'error');
      return;
    }
    if (!parsed.length) return;
    var rec = ensureTrackRec(quick.dataset.wk, quick.dataset.ex);
    rec.sets = parsed;
    queueLogsSave();
    renderTracker();
  });

  $('#btn-add-day').addEventListener('click', addDay);
  $('#btn-add-meal').addEventListener('click', addMeal);

  $('#btn-prev-week').addEventListener('click', function () {
    flushPendingLogsSave();
    state.weekOffset -= 1;
    renderTracker();
  });
  $('#btn-next-week').addEventListener('click', function () {
    flushPendingLogsSave();
    state.weekOffset += 1;
    renderTracker();
  });
  $('#btn-current-week').addEventListener('click', function () {
    flushPendingLogsSave();
    state.weekOffset = 0;
    renderTracker();
  });

  $('#btn-download-backup').addEventListener('click', downloadBackup);
  $('#btn-app-update').addEventListener('click', requestAppUpdate);
  $('#btn-restore-backup').addEventListener('click', function () {
    $('#restore-file').click();
  });
  $('#restore-file').addEventListener('change', function () {
    var file = this.files && this.files[0];
    this.value = '';
    if (file) restoreBackup(file);
  });

  $('#confirm-ok').addEventListener('click', function () {
    var cb = confirmCallback;
    closeConfirm();
    if (cb) cb();
  });
  $('#confirm-cancel').addEventListener('click', closeConfirm);
  $('#confirm-overlay').addEventListener('click', function (event) {
    if (event.target === this) closeConfirm();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !$('#confirm-overlay').hidden) closeConfirm();
  });

  window.addEventListener('beforeunload', flushPendingLogsSave);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushPendingLogsSave();
  });
}

loadData(true);
if (typeof document !== 'undefined' && document.getElementById('plan-days')) {
  bindEvents();
  renderAll();
  announceRecentUpdate();
}
