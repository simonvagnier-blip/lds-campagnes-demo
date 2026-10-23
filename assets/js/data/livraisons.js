/* livraisons.js : livraisons de fichiers en clair, commandes de fiches télémarketing,
 * listes d'exclusion et journal d'API simulés. Base de contacts : virtuelle (simulation).
 */
(function (LD) {
  'use strict';
  const u = LD.u, R = LD.ref, TODAY = LD.TODAY;
  const r = u.rng('lds-v2-livraisons');
  const round = (v, s) => Math.round(v / s) * s;

  const KINDS = { email: 'Fichier emails', mobile: 'Fichier mobiles', postal: 'Fichier postal' };
  const COLS = {
    email: ['Civilité', 'Prénom', 'Nom', 'Email', 'Code postal', 'Tranche d\'âge', 'Date d\'opt-in', 'Source de collecte'],
    mobile: ['Civilité', 'Prénom', 'Nom', 'Mobile', 'Code postal', 'Tranche d\'âge', 'Date d\'opt-in', 'Source de collecte'],
    postal: ['Civilité', 'Prénom', 'Nom', 'Adresse', 'Code postal', 'Ville', 'Tranche d\'âge']
  };
  const FST = { preparation: ['En préparation', 'b-grey'], a_valider: ['À valider (directrice)', 'b-orange'], validee: ['Validée — prête à livrer', 'b-blue'], livree: ['Livrée', 'b-green'], expiree: ['Lien expiré', 'b-grey'] };
  const TST = { preparation: ['En préparation', 'b-grey'], bloctel: ['Passage Bloctel requis', 'b-red'], a_valider: ['À valider (directrice)', 'b-orange'], validee: ['Validée — prête à livrer', 'b-blue'], livree: ['Livrée', 'b-green'] };

  const files = [];
  for (let i = 0; i < 16; i++) {
    const cl = R.clients[Math.floor(r() * R.clients.length)];
    const kind = ['email', 'mobile', 'postal'][Math.floor(r() * 3)];
    const age0 = Math.floor(r() * 150) - 12, age = i < 3 ? i : age0; // jours depuis la préparation
    const date = u.addDays(TODAY, -Math.max(0, age));
    let status = age > 30 ? 'expiree' : age > 3 ? 'livree' : ['preparation', 'a_valider', 'validee'][i % 3];
    const vol = round(r.range(15000, 220000), 100);
    const f = {
      id: 'F-' + String(2401 + i), client: cl.id, kind, label: KINDS[kind] + ' — ' + ['CSP+ 30-55 ans', 'Rayon 20 km magasins', 'Intérêt maison & déco', 'Jeunes actifs', 'Propriétaires', 'Seniors actifs'][i % 6],
      columns: COLS[kind].slice(0, 5 + (i % 3)), format: i % 2 ? 'Excel' : 'CSV', volume: vol, seeds: 8 + (i % 4) * 2, date,
      usage: { days: [30, 60, 90][i % 3], uses: [1, 2, 3][i % 3] }, method: i % 3 === 0 ? 'sftp' : 'lien', status,
      by: cl.cdc, validatedBy: ['validee', 'livree', 'expiree'].includes(status) ? cl.dir : null,
      deliveredAt: ['livree', 'expiree'].includes(status) ? u.addDays(date, 1) : null, expires: u.addDays(date, 8),
      downloads: [], cpm: Math.round(cl.cpm * 0.85)
    };
    if (f.deliveredAt) { const n = 1 + (i % 3); for (let k = 0; k < n; k++) f.downloads.push({ at: u.addDays(f.deliveredAt, k), by: 'contact client (' + cl.name + ')', ip: '82.64.' + (10 + i) + '.' + (20 + k) }); }
    files.push(f);
  }
  files.sort((a, b) => b.date.localeCompare(a.date));

  const tm = [];
  const CENTERS = ['Centre d\'appels prestataire A', 'Centre d\'appels prestataire B', 'Plateau interne du client'];
  for (let i = 0; i < 10; i++) {
    const cl = R.clients.filter(c => ['banque', 'assur', 'mutu', 'telco', 'auto'].includes(c.sector))[i % 5];
    const age0 = Math.floor(r() * 120) - 8, age = i === 1 ? 2 : i === 4 ? 1 : i === 2 ? 0 : i === 0 ? 3 : age0;
    const date = u.addDays(TODAY, -Math.max(0, age));
    const vol = round(r.range(2000, 18000), 50);
    const bloctelAge = i === 1 ? 46 : i === 4 ? 33 : Math.floor(r() * 20);
    let status = age > 4 ? 'livree' : ['preparation', 'a_valider', 'validee'][i % 3];
    const bloctel = { date: u.addDays(TODAY, -bloctelAge), removed: Math.round(vol * r.range(0.11, 0.24)) };
    if (status !== 'livree' && bloctelAge > 30) status = 'bloctel';
    if (status === 'livree') bloctel.date = u.addDays(date, 1); // passage Bloctel entre la commande et la livraison (J+2)
    const ret = status === 'livree' && age > 10 ? (() => {
      const joints = Math.round(vol * r.range(0.32, 0.48)), arg = Math.round(joints * r.range(0.55, 0.75)), acc = Math.round(arg * r.range(0.06, 0.16));
      return { appeles: Math.round(vol * r.range(0.8, 0.98)), joints, argumentes: arg, accords: acc, refus: arg - acc, faux: Math.round(vol * r.range(0.02, 0.06)) };
    })() : null;
    tm.push({
      id: 'T-' + String(801 + i), client: cl.id, label: ['Prospects épargne 35-60 ans', 'Seniors — complémentaire santé', 'Propriétaires — rayon 25 km', 'Jeunes conducteurs', 'Familles — offre box'][i % 5],
      volume: vol, fields: ['Civilité', 'Nom', 'Prénom', 'Téléphone', 'Adresse', 'Code postal', 'Ville', 'Tranche d\'âge'].slice(0, 6 + (i % 3)),
      center: CENTERS[i % 3], date, status, bloctel, excluded: { already: Math.round(vol * r.range(0.03, 0.09)), repous: Math.round(vol * r.range(0.01, 0.04)) },
      by: cl.cdc, validatedBy: ['validee', 'livree'].includes(status) ? cl.dir : null, deliveredAt: status === 'livree' ? u.addDays(date, 2) : null, returns: ret, price: 0.22 + (i % 4) * 0.03
    });
  }
  tm.sort((a, b) => b.date.localeCompare(a.date));

  // Listes d'exclusion (comptages simulés)
  const exclusions = [
    { id: 'unsub', label: 'Désinscrits email (toutes campagnes)', rows: 1284300, delta7: 6420, source: 'Plateforme email interne · retours de désinscription', sync: 'toutes les 15 min' },
    { id: 'stop', label: 'STOP SMS', rows: 412800, delta7: 2310, source: 'Retours Sinch (MO « STOP »)', sync: 'temps réel (webhook)' },
    { id: 'black', label: 'Blacklist (plaintes, demandes RGPD, adresses pièges)', rows: 58210, delta7: 140, source: 'Saisie conformité + retours FBL', sync: 'manuelle' },
    { id: 'repous', label: 'Repoussoirs clients (fichiers clients à exclure)', rows: u.sum(Object.values(LD.data.repous), x => x.rows), delta7: 0, source: 'Fichiers déposés par les clients', sync: 'à chaque dépôt' },
    { id: 'bloctel', label: 'Bloctel (opposition au démarchage téléphonique)', rows: null, delta7: null, source: 'API Bloctel — passage à chaque livraison télémarketing', sync: 'par livraison' }
  ];
  const lastStops = [];
  for (let i = 0; i < 9; i++) lastStops.push({ at: new Date(LD.now().getTime() - (i * 23 + 4) * 60000), num: '06 •• •• ' + String(10 + i * 7).slice(-2) + ' ' + String(31 + i * 5).slice(-2), via: 'Sinch · MO STOP', camp: null });

  // Base de contacts virtuelle (simulation — branchement reporté)
  const base = { email: 14200000, mobile: 8600000, postal: 11900000, rcs: 0.58, note: 'Base virtuelle simulée — branchement reporté' };

  LD.data.files = files; LD.data.tm = tm; LD.data.exclusions = exclusions; LD.data.lastStops = lastStops; LD.data.base = base;
  LD.data.FST = FST; LD.data.TST = TST; LD.data.COLS = COLS; LD.data.KINDS = KINDS; LD.data.CENTERS = CENTERS;
})(window.LD);
