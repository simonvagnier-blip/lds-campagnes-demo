/* store.js : session, cloisonnement, filtres, statuts calculés, résultats (y compris en direct),
 * agrégations, facturation. Le cloisonnement est appliqué ICI, avant toute vue :
 * le compte client n'obtient jamais une campagne d'un autre client.
 * En production ce filtrage serait fait côté serveur (API), jamais dans le navigateur seul.
 */
window.LD = window.LD || {};

(function (LD) {
  'use strict';
  const u = LD.u, R = LD.ref, C = LD.config, D = LD.data, TODAY = LD.TODAY;
  const qs = new URLSearchParams(location.search);

  // ---------- État persistant (actions de démo) ----------
  const SKEY = 'lds-v2-state';
  let state = null;
  try { state = JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { state = null; }
  // newFiles / newTm : livraisons et commandes créées dans la démo ; adj : prix au mille ajustés (par campagne)
  const BLANK = () => ({ ov: {}, created: [], journal: [], files: {}, tm: {}, params: {}, draft: null, batc: {}, newFiles: [], newTm: [], adj: {} });
  // ?reset=1 efface tout au premier chargement (LD_NORESET : rechargement simulé par les contrôles automatiques)
  if (!state || (qs.get('reset') && !window.LD_NORESET)) state = BLANK();
  state = Object.assign(BLANK(), state);
  if (state.params && state.params.adj) { Object.assign(state.adj, state.params.adj); delete state.params.adj; }
  function save() { try { localStorage.setItem(SKEY, JSON.stringify(state)); } catch (e) { /* file:// sans stockage */ } }
  function resetState() { const b = BLANK(); Object.keys(b).forEach(k => { state[k] = b[k]; }); save(); }
  Object.keys(state.params || {}).forEach(k => { if (k !== 'recapOk') C[k] = state.params[k]; });
  state.created.forEach(c => { if (!D.camps.find(x => x.id === c.id)) D.camps.push(c); });
  state.newFiles.forEach(f => { if (!D.files.find(x => x.id === f.id)) D.files.unshift(f); });
  state.newTm.forEach(t => { if (!D.tm.find(x => x.id === t.id)) D.tm.unshift(t); });
  Object.keys(state.tm).forEach(id => { const o = state.tm[id], t = D.tm.find(x => x.id === id); if (t && o.returns) t.returns = o.returns; });
  save();

  // ---------- Session ----------
  const KEY = 'lds-v2-session';
  let session = null;
  try { session = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { session = null; }
  if (qs.get('as')) session = { userId: qs.get('as'), at: Date.now() };
  if (qs.get('logout')) session = null;
  function currentUser() { return session ? R.user(session.userId) : null; }
  function login(userId) {
    session = { userId, at: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(session)); } catch (e) { /* */ }
    log('Connexion'); resetFilters();
  }
  function logout() { log('Déconnexion'); session = null; try { localStorage.removeItem(KEY); } catch (e) { /* */ } }

  // ---------- Journal des actions ----------
  function log(action, target, user) {
    const usr = user || currentUser();
    state.journal.unshift({ t: LD.now().getTime(), user: usr ? usr.id : '—', action, target: target || '' });
    state.journal = state.journal.slice(0, 400); save();
  }

  // ---------- Cloisonnement ----------
  function isClient(user) { user = user || currentUser(); return !!(user && user.kind === 'client'); }
  function scopeCamps(user) {
    user = user || currentUser(); if (!user) return [];
    return user.kind === 'client' ? D.camps.filter(c => c.client === user.client) : D.camps.slice();
  }
  function scopeClients(user) {
    user = user || currentUser(); if (!user) return [];
    return user.kind === 'client' ? R.clients.filter(c => c.id === user.client) : R.clients.slice();
  }
  function scopeFiles(user) { user = user || currentUser(); if (!user) return []; return user.kind === 'client' ? D.files.filter(f => f.client === user.client) : D.files.slice(); }
  function scopeTm(user) { user = user || currentUser(); if (!user) return []; return user.kind === 'client' ? D.tm.filter(f => f.client === user.client) : D.tm.slice(); }
  function scopeLabel(user) {
    user = user || currentUser(); if (!user) return '';
    if (user.kind === 'client') return 'Espace client · ' + R.client(user.client).name + ' · lecture seule';
    if (user.kind === 'dir') return 'Tous les comptes · valide ses ' + R.clients.filter(c => c.dir === user.id).length + ' comptes';
    return 'Tous les comptes LDS';
  }
  function getCamp(id, user) { return scopeCamps(user).find(c => c.id === id) || null; }

  // ---------- Statut calculé ----------
  const hNow = () => LD.hourNow();
  // Durée d'envoi d'une part : débit PARTAGÉ par les parts du même jour et de la même famille (SMS + RCS + repli d'un côté, email de l'autre),
  // même calcul que sendPlan (workflow) : volume du groupe / débit + (vagues − 1) × 30 min. Toutes les parts d'un groupe avancent ensemble.
  function duration(p, c) {
    const fam = x => x.ch === 'email' ? 'email' : 'sms', vol = c.parts.filter(x => x.off === p.off && fam(x) === fam(p)).reduce((a, x) => a + x.vol, 0);
    return Math.max(0.25, vol / (c.throughput || 50000) + ((c.waves || 1) - 1) * 0.5);
  }
  function status(c) {
    const ov = state.ov[c.id];
    if (ov && ov.status) return ov.status;
    if (c.cancelled) return 'annulee';
    if (c.end < TODAY) return 'terminee';
    if (c.date < TODAY) return 'en_cours'; // séquence : envoi suivant à venir
    if (c.date === TODAY) {
      if (c.demo === 'pause' && hNow() >= c.hour + 0.4) return 'pause';
      if (hNow() < c.hour) return 'programmee';
      if (hNow() < c.hour + duration(c.parts[0], c)) return 'en_cours';
      return c.end > TODAY ? 'en_cours' : 'terminee';
    }
    return c.baseStatus || 'brouillon';
  }
  function dateOf(c) { const ov = state.ov[c.id]; return ov && ov.date ? ov.date : c.date; }
  function hourOf(c) { const ov = state.ov[c.id]; return ov && ov.hour != null ? ov.hour : c.hour; }
  function partDate(c, p) { const ov = state.ov[c.id]; return ov && ov.date ? u.addDays(ov.date, p.off) : p.date; }
  const PRE = ['brouillon', 'bat', 'bat_ok', 'a_valider', 'validee', 'programmee'];

  // ---------- Résultats ----------
  const g = h => h <= 0 ? 0 : Math.min(1, (1 - Math.exp(-h / 5)) / (1 - Math.exp(-14)));
  function partProgress(c, p) {
    const st = status(c), ov = state.ov[c.id] || {};
    if (PRE.includes(st)) return { prog: 0, eng: 0 };
    if (st === 'annulee' && ov.stoppedAt == null) return { prog: 0, eng: 0 };
    const h = u.diffDays(partDate(c, p), TODAY) * 24 + hNow() - (p.off ? p.hour : hourOf(c));
    if (h <= 0) return { prog: 0, eng: 0 };
    let prog = Math.min(1, h / duration(p, c));
    if (c.demo === 'pause' && st === 'pause') prog = Math.min(prog, 0.4 / duration(p, c));
    if (ov.stoppedAt != null) prog = Math.min(prog, ov.stoppedAt);
    if (ov.launchedAt != null) prog = Math.min(1, Math.max(0, (LD.now().getTime() - ov.launchedAt) / 3600000 / duration(p, c)) + 0.004);
    return { prog, eng: Math.min(prog, g(h)) };
  }
  const KEYS = ['sent', 'delivered', 'hard', 'soft', 'opens', 'clicks', 'optout', 'complaints', 'stop', 'read'];
  function partRes(c, p) {
    const { prog, eng } = partProgress(c, p), f = p.full, o = { ch: p.ch, fallback: !!p.fallback, prog };
    o.sent = Math.round(f.sent * prog); o.delivered = Math.round(f.delivered * prog); o.hard = Math.round(f.hard * prog); o.soft = Math.round(f.soft * prog);
    ['opens', 'clicks', 'optout', 'complaints', 'stop', 'read'].forEach(k => o[k] = Math.round(f[k] * eng));
    o.btn = f.btn.map(v => Math.round(v * eng));
    return o;
  }
  function blank() {
    const a = {}; KEYS.forEach(k => a[k] = 0);
    ['email', 'sms', 'rcs'].forEach(ch => { a[ch] = {}; KEYS.forEach(k => a[ch][k] = 0); });
    a.fallback = 0; a.btn = [0, 0, 0]; a.camps = 0; a.revenue = 0; a.revCamps = 0; a.cost = 0; a.costD2s = 0; a.prises = 0;
    return a;
  }
  function derive(a) {
    a.openRate = a.email.delivered ? a.email.opens / a.email.delivered : null;
    a.clickRate = a.email.delivered ? a.email.clicks / a.email.delivered : null;
    a.ctor = a.email.opens ? a.email.clicks / a.email.opens : null;
    a.emailDeliv = a.email.sent ? a.email.delivered / a.email.sent : null;
    a.smsDeliv = a.sms.sent ? a.sms.delivered / a.sms.sent : null;
    a.smsClick = a.sms.delivered ? a.sms.clicks / a.sms.delivered : null;
    a.stopRate = (a.sms.delivered + a.rcs.delivered) ? (a.sms.stop + a.rcs.stop) / (a.sms.delivered + a.rcs.delivered) : null;
    a.rcsRead = a.rcs.delivered ? a.rcs.read / a.rcs.delivered : null;
    a.rcsClick = a.rcs.read ? a.rcs.clicks / a.rcs.read : null;
    a.optoutRate = a.delivered ? a.optout / a.delivered : null;
    a.hardRate = a.email.sent ? a.email.hard / a.email.sent : null;
    a.complaintRate = a.email.delivered ? a.email.complaints / a.email.delivered : null;
    a.roas = a.costD2s ? a.revenue / a.costD2s : null;
    a.cpc = a.clicks ? a.cost / a.clicks : null;
    return a;
  }
  function addPart(a, r) {
    KEYS.forEach(k => { a[k] += r[k] || 0; a[r.ch][k] += r[k] || 0; });
    if (r.fallback) a.fallback += r.sent;
    if (r.ch === 'rcs') r.btn.forEach((v, i) => a.btn[i] += v);
  }
  function billingDone(c) { const st = status(c), ov = state.ov[c.id] || {}; return ['terminee', 'en_cours', 'pause'].includes(st) || (st === 'annulee' && ov.stoppedAt != null); }
  function campResults(c) { const a = blank(); c.parts.forEach(p => addPart(a, partRes(c, p))); a.camps = 1; addMoney(a, c); return derive(a); }
  function revenueOf(c) {
    const cl = R.client(c.client); if (!cl.d2s || !c.roas || status(c) !== 'terminee') return null;
    if (u.diffDays(c.end, TODAY) < c.lag) return null;
    // CA déclaré par le client : indépendant d'un ajustement de prix (base = montant à la grille) ; le ROAS, lui, suit le prix facturé
    const b = billing(c);
    return Math.round(price({ qty: b.qty, cpm: b.grid, crea: c.crea }).amount * c.roas / 10) * 10;
  }
  // Test A/B : versions A et B envoyées chacune à « share » de la cible ; gagnante désignée 2 h après le départ
  // (critère : ouverture pour l'objet et l'heure, clic pour le contenu), puis envoyée automatiquement au reste (simulé).
  const AB_DECIDE_H = 2;
  function abOutcome(c) {
    if (!c.ab) return null;
    const st = status(c), start = hourOf(c), ov = state.ov[c.id] || {};
    const o = { kind: c.ab.kind, share: c.ab.share, rest: Math.max(0, 1 - 2 * c.ab.share), decideAt: start + AB_DECIDE_H, crit: c.ab.kind === 'contenu' ? 'clic' : 'ouverture' };
    if (PRE.includes(st) || (st === 'annulee' && ov.stoppedAt == null)) return Object.assign(o, { phase: 'prevu' });
    const elapsed = u.diffDays(dateOf(c), TODAY) * 24 + hNow() - start;
    if (elapsed < AB_DECIDE_H) return Object.assign(o, { phase: 'test' });
    let winner = c.ab.winner, gain = c.ab.gain;
    if (!winner) { const r = u.rng('ab-' + c.id); winner = r() < 0.5 ? 'A' : 'B'; gain = 0.04 + r() * 0.16; }
    return Object.assign(o, { phase: st === 'terminee' ? 'fin' : 'decide', winner, gain, restSent: !(st === 'annulee' || st === 'pause') });
  }
  function addMoney(a, c) { const b = billing(c); a.cost += b.amount; const rv = revenueOf(c); if (rv != null) { a.revenue += rv; a.costD2s += b.amount; a.revCamps++; } }
  function aggregate(camps, from, to, opts) {
    opts = opts || {}; const a = blank(); const seen = new Set();
    camps.forEach(c => {
      if (!billingDone(c) && status(c) !== 'terminee') { if (!opts.planned) return; }
      c.parts.forEach(p => {
        const pd = partDate(c, p);
        if (pd < from || pd > to) return;
        if (opts.ch && p.ch !== opts.ch) return;
        addPart(a, partRes(c, p));
        if (!seen.has(c.id)) { seen.add(c.id); a.camps++; }
      });
    });
    camps.forEach(c => { if (seen.has(c.id) && dateOf(c) >= from && dateOf(c) <= to) { addMoney(a, c); a.prises++; } });
    return derive(a);
  }
  function dailySeries(camps, from, to, opts) {
    const out = [];
    for (let d = from; d <= to; d = u.addDays(d, 1)) out.push({ d, a: aggregate(camps, d, d, opts) });
    return out;
  }

  // ---------- Facturation (proposition, ajustable) ----------
  // UNE seule fonction de prix (price) : récap mensuel, BDC, onglet Prix, bilan, espace client et assistant passent tous par elle.
  const ROUTAGE_CPM = 24, CREA_FEE = 450;
  const r2 = v => Math.round(v * 100) / 100;
  function gridCpm(type, clientId) { return type === 'routage' ? ROUTAGE_CPM : R.client(clientId).cpm; }
  function cpmOf(c) { const a = state.adj[c.id]; return a != null ? a : gridCpm(c.type, c.client); }
  function price(o) { // o : { qty, cpm } ou { qty, type, client } ; crea : forfait création
    const cpm = o.cpm != null ? o.cpm : gridCpm(o.type, o.client), media = o.qty / 1000 * cpm, crea = o.crea ? CREA_FEE : 0;
    return { cpm, media: r2(media), crea, amount: r2(media + crea) };
  }
  function setCpm(c, v, user) {
    const grid = gridCpm(c.type, c.client);
    if (v == null || v === '' || +v === grid) delete state.adj[c.id]; else state.adj[c.id] = +v;
    log('Prix au mille ' + (state.adj[c.id] != null ? 'ajusté à ' + v + ' €' : 'remis à la grille (' + grid + ' €)'), c.id, user); save();
    return billing(c);
  }
  function billing(c) {
    const done = billingDone(c);
    let qty;
    if (done) { const a = blank(); c.parts.forEach(p => addPart(a, partRes(c, p))); qty = c.type === 'routage' ? a.sent : a.delivered; }
    else qty = c.volume;
    const p = price({ qty, cpm: cpmOf(c), crea: c.crea });
    return Object.assign({ basis: c.type === 'routage' ? 'envoyés' : 'délivrés', qty, estimate: !done || status(c) !== 'terminee', adjusted: state.adj[c.id] != null, grid: gridCpm(c.type, c.client) }, p);
  }
  function fileAmount(f) { return price({ qty: f.volume, cpm: f.cpm }).amount; }
  // Fiches livrées : volume commandé, plafonné par les fiches restantes après passage Bloctel (commandes créées dans la démo)
  function tmDelivered(t) { if (!t.created) return t.volume; const o = state.tm[t.id] || {}; return Math.max(0, Math.min(t.volume, (t.available || t.volume) - (o.removed || 0))); }
  function tmAmount(t) { return r2(tmDelivered(t) * t.price); }
  function bdc(clientId) {
    const cl = R.client(clientId);
    const camps = D.camps.filter(c => c.client === clientId && dateOf(c) <= TODAY && billingDone(c));
    const files = D.files.filter(f => f.client === clientId && ['livree', 'expiree'].includes(fileStatus(f)));
    const tms = D.tm.filter(t => t.client === clientId && tmStatus(t) === 'livree');
    const consumed = u.sum(camps, c => billing(c).amount) + u.sum(files, fileAmount) + u.sum(tms, tmAmount);
    const planned = u.sum(D.camps.filter(c => c.client === clientId && dateOf(c) > TODAY && status(c) !== 'annulee'), c => billing(c).amount);
    return { amount: cl.bdc, consumed, planned, rest: cl.bdc - consumed, ratio: consumed / cl.bdc, alert: consumed / cl.bdc >= C.THRESH.bdc };
  }

  // ---------- Pression marketing / charge du routage ----------
  function pressure(clientId, date) {
    date = date || TODAY;
    return D.camps.filter(c => c.client === clientId && status(c) !== 'annulee' && dateOf(c) > u.addDays(date, -30) && dateOf(c) <= date).length;
  }
  function dayLoad(date, except) {
    let v = 0; D.camps.forEach(c => { if (c.id === except || status(c) === 'annulee') return; c.parts.forEach(p => { if (partDate(c, p) === date) v += p.vol; }); });
    return v;
  }

  // ---------- Filtres globaux ----------
  const PERIODS = [
    { id: 'today', label: "Aujourd'hui" }, { id: '7d', label: '7 derniers jours' }, { id: '30d', label: '30 derniers jours' }, { id: '90d', label: '90 derniers jours' },
    { id: 'mtd', label: 'Mois en cours' }, { id: 'prev', label: 'Mois précédent' }, { id: '6m', label: '6 derniers mois' }, { id: 'custom', label: 'Personnalisée…' }
  ];
  const defaultFilters = () => ({ period: '30d', from: null, to: null, client: '', channel: '', cdc: '', status: '', sector: '', type: '' });
  let filters = defaultFilters();
  ['period', 'client', 'channel', 'cdc', 'status', 'sector', 'type'].forEach(k => { if (qs.get(k)) filters[k] = qs.get(k); });
  if (qs.get('from')) { filters.period = 'custom'; filters.from = qs.get('from'); filters.to = qs.get('to') || TODAY; }
  function resetFilters() { filters = defaultFilters(); }
  function periodRange(f) {
    f = f || filters;
    switch (f.period) {
      case 'today': return [TODAY, TODAY];
      case '7d': return [u.addDays(TODAY, -6), TODAY];
      case '30d': return [u.addDays(TODAY, -29), TODAY];
      case '90d': return [u.addDays(TODAY, -89), TODAY];
      case 'mtd': return [u.monthStart(TODAY), TODAY];
      case 'prev': { const p = u.addMonths(TODAY, -1); return [p, u.monthEnd(p)]; }
      case '6m': return [C.DATA_START, TODAY];
      case 'custom': return [f.from || u.addDays(TODAY, -29), f.to || TODAY];
      default: return [u.addDays(TODAY, -29), TODAY];
    }
  }
  function periodLabel(f) {
    f = f || filters; const [a, b] = periodRange(f), p = PERIODS.find(x => x.id === f.period);
    return (p && f.period !== 'custom' ? p.label + ' · ' : '') + (a === b ? u.fmtDate(a) : u.fmtDate(a) + ' → ' + u.fmtDate(b));
  }
  function filteredCamps(f, opts) {
    f = f || filters; opts = opts || {};
    return scopeCamps().filter(c => (!f.client || c.client === f.client) && (!f.channel || c.channel === f.channel) && (!f.cdc || c.cdc === f.cdc) &&
      (!f.sector || R.client(c.client).sector === f.sector) && (!f.type || c.type === f.type) && (opts.ignoreStatus || !f.status || status(c) === f.status));
  }
  function fileStatus(f) { return (state.files[f.id] && state.files[f.id].status) || f.status; }
  function tmStatus(t) { return (state.tm[t.id] && state.tm[t.id].status) || t.status; }

  LD.state = () => state; LD.save = save;
  LD.store = {
    currentUser, login, logout, isClient, scopeCamps, scopeClients, scopeFiles, scopeTm, scopeLabel, getCamp, status, dateOf, hourOf, partDate, partRes, partProgress,
    campResults, aggregate, dailySeries, billing, bdc, revenueOf, pressure, dayLoad, duration, log, blank, derive, fileAmount, tmAmount, resetState,
    PERIODS, get filters() { return filters; }, setFilter(k, v) { filters[k] = v; }, resetFilters, periodRange, periodLabel, filteredCamps,
    ROUTAGE_CPM, CREA_FEE, fileStatus, tmStatus, PRE, journal: () => state.journal, price, cpmOf, setCpm, gridCpm, abOutcome, tmDelivered
  };
  LD.audit = { log: (a) => log(a) };
})(window.LD);
