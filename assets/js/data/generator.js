/* generator.js : campagnes fictives à graine fixe — 6 mois glissants jusqu'à aujourd'hui
 * + 6 semaines à venir. Chaque campagne a une ou plusieurs « parties » (un envoi par canal).
 * Les résultats d'une campagne du jour progressent avec l'heure (flux simulé).
 */
window.LD = window.LD || {};

(function (LD) {
  'use strict';
  const u = LD.u, R = LD.ref, C = LD.config, TODAY = LD.TODAY;

  const MIX = { // part des canaux par secteur : email, sms, rcs, seq
    ameub: [0.5, 0.22, 0.14, 0.14], banque: [0.72, 0.16, 0, 0.12], assur: [0.66, 0.2, 0, 0.14], mutu: [0.7, 0.18, 0, 0.12],
    auto: [0.5, 0.24, 0.12, 0.14], beaute: [0.46, 0.26, 0.16, 0.12], telco: [0.52, 0.3, 0.1, 0.08], tour: [0.7, 0.18, 0, 0.12]
  };
  const NAMES = {
    ameub: ['Soldes salon & séjour', 'Nouvelle collection automne', 'Portes ouvertes magasins', 'Week-end privilège', 'Opération literie', 'Cuisine — offre installation', 'Black Friday mobilier', 'Fête des pères déco', 'Inauguration magasin'],
    banque: ['Offre prêt immobilier', 'Ouverture de compte en ligne', 'Épargne — livret boosté', 'Carte premium', 'Prêt travaux', 'Assurance emprunteur'],
    assur: ['Devis auto en 3 minutes', 'Assurance habitation étudiants', 'Rentrée — multirisque', 'Offre parrainage', 'Assurance animaux'],
    mutu: ['Complémentaire santé seniors', 'Mutuelle jeunes actifs', 'Offre famille', 'Prévention santé — bilan', 'Changement de mutuelle'],
    auto: ['Essais week-end SUV hybride', 'Révision à prix fixe', 'Portes ouvertes concessions', 'Offre reprise', 'Lancement citadine électrique', 'Pneus hiver'],
    beaute: ['Nouveau soin visage', 'Journées beauté magasins', 'Calendrier de l\'Avent', 'Offre parfum fête des mères', 'Programme fidélité'],
    telco: ['Forfait 5G 100 Go', 'Fibre — offre de bienvenue', 'Smartphone reconditionné', 'Offre famille', 'Portabilité — 6 mois offerts'],
    tour: ['Séjours au soleil', 'Ventes flash hiver', 'Week-ends en Europe', 'Croisières printemps', 'Early booking été']
  };
  const OBJ = ['Trafic magasin', 'Génération de leads', 'Conversion en ligne', 'Notoriété offre', 'Réactivation'];
  const DEVICES = ['Mobile', 'Bureau', 'Tablette'];
  const OPERATORS = ['Opérateur A', 'Opérateur B', 'Opérateur C', 'Opérateur D'];

  const pick = (r, arr, w) => { let x = r(), i = 0; for (; i < w.length; i++) { x -= w[i]; if (x < 0) return arr[i]; } return arr[arr.length - 1]; };
  const round = (v, s) => Math.round(v / s) * s;

  // Résultats complets d'une partie (fin de campagne + 72 h)
  function partResults(r, ch, vol) {
    const res = { sent: vol, delivered: 0, hard: 0, soft: 0, opens: 0, clicks: 0, optout: 0, complaints: 0, stop: 0, read: 0, btn: [0, 0, 0] };
    if (ch === 'email') {
      const hardR = r.range(0.004, 0.022), softR = r.range(0.004, 0.014);
      res.hard = Math.round(vol * hardR); res.soft = Math.round(vol * softR);
      res.delivered = vol - res.hard - res.soft;
      res.opens = Math.round(res.delivered * r.range(0.11, 0.27));
      res.clicks = Math.min(res.opens, Math.round(res.delivered * r.range(0.008, 0.035)));
      res.optout = Math.round(res.delivered * r.range(0.0008, 0.0035));
      res.complaints = Math.round(res.delivered * r.range(0.00005, 0.0004));
    } else if (ch === 'sms') {
      const dl = r.range(0.94, 0.985);
      res.delivered = Math.round(vol * dl); res.hard = Math.round((vol - res.delivered) * 0.7); res.soft = vol - res.delivered - res.hard;
      res.clicks = Math.round(res.delivered * r.range(0.018, 0.06));
      res.stop = Math.round(res.delivered * r.range(0.0015, 0.0065));
      res.optout = res.stop;
    } else { // rcs
      const dl = r.range(0.955, 0.99);
      res.delivered = Math.round(vol * dl); res.hard = vol - res.delivered;
      res.read = Math.round(res.delivered * r.range(0.62, 0.81));
      const c = Math.round(res.read * r.range(0.06, 0.14));
      res.btn = [Math.round(c * 0.52), Math.round(c * 0.31), c - Math.round(c * 0.52) - Math.round(c * 0.31)];
      res.clicks = c; res.stop = Math.round(res.delivered * r.range(0.001, 0.004)); res.optout = res.stop;
    }
    return res;
  }

  function makeParts(r, ch, cl) {
    const evol = round(r.range(30000, 600000) * (cl.sector === 'tour' || cl.sector === 'mutu' ? 0.6 : 1), 500);
    const svol = round(r.range(8000, 180000), 100);
    const eh = pick(r, [7.5, 8, 9, 10, 11], [0.15, 0.3, 0.25, 0.2, 0.1]);
    const sh = pick(r, [10, 11, 12, 14, 17, 18], [0.18, 0.22, 0.2, 0.15, 0.15, 0.1]);
    if (ch === 'email') return [{ ch: 'email', off: 0, hour: eh, vol: evol }];
    if (ch === 'sms') return [{ ch: 'sms', off: 0, hour: sh, vol: svol }];
    if (ch === 'rcs') { // RCS + repli SMS sur les mobiles non compatibles
      const comp = r.range(0.52, 0.68), rv = round(svol * comp, 100);
      return [{ ch: 'rcs', off: 0, hour: sh, vol: rv }, { ch: 'sms', off: 0, hour: sh, vol: svol - rv, fallback: true }];
    }
    // séquence : SMS J0 puis email J+2 (une seule prise de parole)
    return [{ ch: 'sms', off: 0, hour: sh, vol: svol }, { ch: 'email', off: 2, hour: eh, vol: evol }];
  }

  const camps = [];
  let seq = 0;
  R.clients.forEach((cl, ci) => {
    const r = u.rng('lds-v2-' + cl.id);
    const mix = MIX[cl.sector];
    for (let w = u.addDays(C.DATA_START, -((u.dow(C.DATA_START) + 6) % 7)); w <= C.HORIZON; w = u.addDays(w, 7)) {
      const lambda = cl.freq / 4.33;
      let k = Math.floor(lambda) + (r() < lambda % 1 ? 1 : 0);
      for (let i = 0; i < k; i++) {
        const day = u.addDays(w, pick(r, [0, 1, 2, 3, 4, 5], [0.1, 0.26, 0.24, 0.24, 0.12, cl.sector === 'ameub' || cl.sector === 'beaute' ? 0.04 : 0]));
        if (day < C.DATA_START || day > C.HORIZON || !u.isWorkingDay(day) && u.dow(day) !== 6) continue;
        const ch = pick(r, ['email', 'sms', 'rcs', 'seq'], mix);
        const parts = makeParts(r, ch, cl);
        parts.forEach(p => { p.date = u.addDays(day, p.off); p.full = partResults(u.rng('res' + seq + p.ch + p.off), p.ch, p.vol); });
        const type = r() < 0.24 ? 'routage' : 'location';
        const base = NAMES[cl.sector][Math.floor(r() * NAMES[cl.sector].length)];
        const cdc = r() < 0.8 ? cl.cdc : R.cdcs()[Math.floor(r() * 4)].id;
        seq++;
        camps.push({
          id: 'C-' + day.slice(2, 4) + day.slice(5, 7) + '-' + String(seq).padStart(3, '0'),
          client: cl.id, name: base, objective: OBJ[Math.floor(r() * OBJ.length)], type, channel: ch, cdc, dir: cl.dir,
          date: day, hour: parts[0].hour, parts, ab: r() < 0.22 ? { kind: pick(r, ['objet', 'contenu', 'heure'], [0.6, 0.25, 0.15]), share: 0.1, winner: r() < 0.55 ? 'A' : 'B', gain: r.range(0.04, 0.22) } : null,
          waves: parts[0].vol > 250000 ? 3 : parts[0].vol > 100000 ? 2 : 1,
          throughput: parts[0].ch === 'email' ? 180000 : 60000, segment: null,
          seed: seq, crea: r() < 0.35, dev: [r.range(0.58, 0.74), 0, 0], ops: [r.range(0.3, 0.4), r.range(0.22, 0.3), r.range(0.18, 0.24)],
          roas: cl.d2s ? r.range(2.6, 9.5) : null, lag: r.int(5, 14)
        });
      }
    }
  });
  camps.forEach(c => { c.dev[1] = (1 - c.dev[0]) * 0.82; c.dev[2] = 1 - c.dev[0] - c.dev[1]; c.ops.push(1 - c.ops[0] - c.ops[1] - c.ops[2]); });

  // ---- Scénarios de démonstration (déterministes) ----
  const byClient = id => camps.filter(c => c.client === id);
  const upcoming = camps.filter(c => c.date > TODAY).sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour);
  // Campagnes du jour : on garantit une file du jour fournie
  const todayList = camps.filter(c => c.date === TODAY);
  const want = [['alba', 'email', 8, 'Week-end privilège', 420000], ['opaline', 'sms', 14.5, 'Forfait 5G 100 Go', 120000], ['nacre', 'rcs', 14, 'Journées beauté magasins', 90000],
    ['oree', 'email', 9, 'Épargne — livret boosté', 310000], ['lumen', 'sms', 17, 'Essais week-end SUV hybride', 64000], ['azuline', 'email', 13, 'Ventes flash hiver', 380000]];
  want.forEach(([cid, ch, h, name, vol], i) => {
    const cl = R.client(cid), r = u.rng('today' + i);
    const parts = makeParts(r, ch, cl); parts[0].hour = h; parts.forEach(p => { p.hour = h; p.date = TODAY; });
    if (ch !== 'rcs') parts[0].vol = vol; else { parts[0].vol = Math.round(vol * 0.6); parts[1].vol = vol - parts[0].vol; }
    parts.forEach(p => p.full = partResults(u.rng('rt' + i + p.ch), p.ch, p.vol));
    seq++;
    camps.push({ id: 'C-' + TODAY.slice(2, 4) + TODAY.slice(5, 7) + '-' + String(seq).padStart(3, '0'), client: cid, name, objective: OBJ[i % 5], type: i === 3 ? 'routage' : 'location', channel: ch, cdc: cl.cdc, dir: cl.dir,
      date: TODAY, hour: h, parts, ab: i === 0 ? { kind: 'objet', share: 0.1, winner: 'B', gain: 0.14 } : null, waves: vol > 250000 ? 3 : 2, throughput: ch === 'email' ? (i === 5 ? 100000 : 140000) : 45000,
      seed: seq, crea: i % 2 === 0, dev: [0.68, 0.26, 0.06], ops: [0.36, 0.27, 0.21, 0.16], roas: cl.d2s ? 4.8 + i : null, lag: 7, demo: i === 2 ? 'pause' : null });
  });
  // Statuts des campagnes à venir : préparation d'autant moins avancée que la date est lointaine
  upcoming.forEach((c, i) => {
    const d = u.diffDays(TODAY, c.date), r = u.rng('st' + c.id);
    let st;
    if (d <= 2) st = r() < 0.75 ? 'programmee' : 'validee';
    else if (d <= 7) st = pick(r, ['programmee', 'validee', 'a_valider', 'bat_ok', 'bat'], [0.25, 0.2, 0.2, 0.15, 0.2]);
    else if (d <= 18) st = pick(r, ['validee', 'a_valider', 'bat_ok', 'bat', 'brouillon'], [0.1, 0.15, 0.15, 0.3, 0.3]);
    else st = r() < 0.3 ? 'bat' : 'brouillon';
    c.baseStatus = st;
  });
  // Points d'attention injectés : BAT manquant à J-2, validation en retard
  const d1 = upcoming.filter(c => u.diffDays(TODAY, c.date) <= 2);
  if (d1[0]) d1[0].baseStatus = 'bat';
  if (d1[1]) d1[1].baseStatus = 'brouillon';
  const d3 = upcoming.filter(c => { const x = u.diffDays(TODAY, c.date); return x >= 1 && x <= 4; });
  d3.slice(2, 4).forEach(c => c.baseStatus = 'a_valider');
  // Un BAT en attente pour le compte client de démonstration
  const albaBat = upcoming.filter(c => c.client === 'alba' && u.diffDays(TODAY, c.date) >= 3 && u.diffDays(TODAY, c.date) <= 9);
  if (albaBat[0]) albaBat[0].baseStatus = 'bat';
  // Taux d'adresses invalides anormal sur un import (routage) récent ; STOP au-dessus du seuil
  const recentRoutage = camps.filter(c => c.type === 'routage' && c.date <= TODAY && c.date >= u.addDays(TODAY, -6) && c.parts[0].ch === 'email').slice(-1)[0];
  if (recentRoutage) { const f = recentRoutage.parts[0].full; const extra = Math.round(f.sent * 0.052); f.hard += extra; f.delivered -= extra; recentRoutage.invalidImport = 0.071; }
  const recentSms = camps.filter(c => c.parts[0].ch === 'sms' && c.date < TODAY && c.date >= u.addDays(TODAY, -5)).slice(-1)[0];
  if (recentSms) { const f = recentSms.parts[0].full; f.stop = Math.round(f.delivered * 0.0112); f.optout = f.stop; }
  // Annulations ponctuelles dans le passé
  camps.filter(c => c.date < TODAY).forEach(c => { if (u.rng('ann' + c.id)() < 0.02) c.cancelled = true; });
  // Jour chargé à venir (alerte de surcharge du routage) : mardi en J+11..17
  let busy = u.addDays(TODAY, 11); while (u.dow(busy) !== 2) busy = u.addDays(busy, 1);
  ['alba', 'oree', 'opaline', 'velia'].forEach((cid, i) => {
    const c = upcoming.find(x => x.client === cid && x.parts[0].ch === 'email' && x.date > u.addDays(TODAY, 8) && x.date !== busy);
    if (c) { c.parts.forEach(p => { p.date = u.addDays(busy, p.off); }); c.date = busy; c.parts[0].vol = Math.max(c.parts[0].vol, 380000 + i * 20000); c.parts[0].full = partResults(u.rng('busy' + i), 'email', c.parts[0].vol); }
  });

  camps.sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour);
  camps.forEach(c => { c.volume = u.sum(c.parts, p => p.vol); c.end = c.parts.reduce((m, p) => p.date > m ? p.date : m, c.date); });

  // ---- Segments enregistrés, listes BAT, repoussoirs, contacts client (fictifs) ----
  const segments = [], batLists = {}, repous = {}, contacts = {};
  R.clients.forEach((cl, i) => {
    const r = u.rng('seg' + cl.id);
    const segs = cl.d2s ? ['Rayon 15 km autour des magasins · 25-55 ans', 'Propriétaires · rayon 30 km', 'Acheteurs maison 12 mois'] : ['CSP+ · 30-60 ans · France entière', 'Ouvreurs 90 jours · intérêt ' + R.sector(cl.sector).label.toLowerCase(), 'Jeunes actifs 25-35 ans'];
    segs.forEach((s, k) => segments.push({ id: cl.id + '-s' + k, client: cl.id, label: s, count: round(r.range(180000, 2400000), 1000), updated: u.addDays(TODAY, -r.int(2, 60)), uses: r.int(1, 14) }));
    batLists[cl.id] = [
      { name: 'Responsable marketing', email: 'marketing@' + cl.id + '-demo.example', mobile: '06 •• •• •• 1' + i, client: true },
      { name: 'Chef de projet CRM', email: 'crm@' + cl.id + '-demo.example', mobile: '06 •• •• •• 2' + i, client: true },
      { name: R.user(cl.cdc).name + ' (LDS)', email: R.user(cl.cdc).login, mobile: '06 •• •• •• 3' + i, client: false },
      { name: R.user(cl.dir).name + ' (LDS)', email: R.user(cl.dir).login, mobile: '06 •• •• •• 4' + i, client: false }
    ];
    repous[cl.id] = { rows: round(r.range(40000, 900000), 100), updated: u.addDays(TODAY, -r.int(3, 40)), file: 'repoussoir-' + cl.id + '.csv' };
    contacts[cl.id] = [{ role: 'Responsable marketing', email: 'marketing@' + cl.id + '-demo.example' }, { role: 'Chef de projet CRM', email: 'crm@' + cl.id + '-demo.example' }, { role: 'Comptabilité fournisseurs', email: 'compta@' + cl.id + '-demo.example' }];
  });

  // Bons de commande : montant calé pour un taux de consommation réaliste depuis l'ouverture du BDC (début de la période)
  const BDC_TARGET = { alba: 0.86, somna: 0.58, oree: 0.47, velia: 0.71, arpege: 0.39, lumen: 0.64, nacre: 0.93, opaline: 0.52, azuline: 0.44 };
  R.clients.forEach(cl => {
    const est = u.sum(camps.filter(c => c.client === cl.id && c.date <= TODAY && !c.cancelled), c => (c.type === 'routage' ? 24 : cl.cpm) * c.volume * 0.985 / 1000 + (c.crea ? 450 : 0));
    cl.bdc = Math.round(est / (BDC_TARGET[cl.id] || 0.6) / 5000) * 5000; cl.bdcStart = C.DATA_START;
  });

  LD.data = { camps, segments, batLists, repous, contacts, partResults, OPERATORS, DEVICES, busyDay: busy };
})(window.LD);
