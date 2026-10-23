/* Live Data — LDS Campagnes (maquette)
 * utils.js : PRNG à graine fixe, dates, formats FR, petits helpers DOM.
 * Aucune dépendance externe.
 */
window.LD = window.LD || {};

(function (LD) {
  'use strict';

  // ---- PRNG déterministe (mulberry32) + hash de chaîne (cyrb53 simplifié) ----
  function hashStr(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    return h1 >>> 0;
  }
  function rng(seed) {
    let a = (typeof seed === 'string' ? hashStr(seed) : seed) >>> 0;
    const next = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.range = (min, max) => min + (max - min) * next();
    next.int = (min, max) => Math.floor(min + (max - min + 1) * next());
    next.pick = (arr) => arr[Math.floor(next() * arr.length)];
    next.chance = (p) => next() < p;
    next.normal = () => { // Box-Muller
      let u = 0, v = 0; while (u === 0) u = next(); while (v === 0) v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    return next;
  }

  // ---- Dates (on travaille en dates locales "YYYY-MM-DD") ----
  const pad = (n) => String(n).padStart(2, '0');
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  function addDays(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function diffDays(a, b) { return Math.round((parse(b) - parse(a)) / 86400000); }
  function monthKey(s) { return s.slice(0, 7); }
  function daysInMonth(s) { const d = parse(s); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
  function monthStart(s) { return s.slice(0, 7) + '-01'; }
  function monthEnd(s) { return s.slice(0, 7) + '-' + pad(daysInMonth(s)); }
  function addMonths(s, n) { const d = parse(monthStart(s)); d.setMonth(d.getMonth() + n); return iso(d); }
  function dow(s) { return parse(s).getDay(); } // 0 = dimanche
  // Jours fériés FR (fixes + Pâques) pour le calcul des jours ouvrés
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4,
      f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
      i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return iso(new Date(y, month - 1, day));
  }
  const holidayCache = {};
  function holidays(y) {
    if (holidayCache[y]) return holidayCache[y];
    const e = easter(y);
    const set = new Set([y + '-01-01', y + '-05-01', y + '-05-08', y + '-07-14', y + '-08-15', y + '-11-01', y + '-11-11', y + '-12-25',
      addDays(e, 1), addDays(e, 39), addDays(e, 50)]);
    holidayCache[y] = set; return set;
  }
  function isWorkingDay(s) { const w = dow(s); return w !== 0 && w !== 6 && !holidays(+s.slice(0, 4)).has(s); }
  function workingDaysBetween(a, b) { // inclusif
    let n = 0; for (let d = a; d <= b; d = addDays(d, 1)) if (isWorkingDay(d)) n++; return n;
  }

  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MONTHS_S = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const DOWS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  function fmtDate(s) { return s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4); }
  function fmtDateShort(s) { return s.slice(8, 10) + '/' + s.slice(5, 7); }
  function fmtMonth(s, short) { const m = +s.slice(5, 7) - 1; return (short ? MONTHS_S[m] : MONTHS[m]) + ' ' + s.slice(0, 4); }
  function fmtDateTime(ts) { // ts = Date
    return pad(ts.getDate()) + '/' + pad(ts.getMonth() + 1) + '/' + ts.getFullYear() + ' ' + pad(ts.getHours()) + ':' + pad(ts.getMinutes()) + ':' + pad(ts.getSeconds());
  }

  // ---- Nombres FR ----
  const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function n(v) { return v == null || isNaN(v) ? '—' : nf0.format(Math.round(v)); }
  function pct(v, dec) { if (v == null || isNaN(v) || !isFinite(v)) return '—'; const f = dec === 2 ? nf2 : dec === 0 ? nf0 : nf1; return f.format(v * 100) + ' %'; }
  function dec(v, d) { return v == null || isNaN(v) ? '—' : (d === 2 ? nf2 : nf1).format(v); }
  function ratio(a, b) { return b ? a / b : 0; }

  // ---- DOM ----
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function sum(arr, f) { let s = 0; for (const x of arr) s += f ? f(x) : x; return s; }
  function groupBy(arr, f) { const m = {}; for (const x of arr) { const k = f(x); (m[k] = m[k] || []).push(x); } return m; }

  LD.u = {
    hashStr, rng, pad, iso, parse, addDays, diffDays, monthKey, daysInMonth, monthStart, monthEnd, addMonths, dow,
    isWorkingDay, workingDaysBetween, holidays, MONTHS, MONTHS_S, DOWS, fmtDate, fmtDateShort, fmtMonth, fmtDateTime,
    n, pct, dec, ratio, esc, $, $$, sum, groupBy
  };
})(window.LD);
