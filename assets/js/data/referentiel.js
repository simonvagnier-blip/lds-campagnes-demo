/* referentiel.js : horloge de démo, paramètres, utilisateurs, clients, canaux, statuts.
 * Tous les noms (clients, personnes, marques) sont FICTIFS.
 */
window.LD = window.LD || {};

(function (LD) {
  'use strict';
  const u = LD.u;
  const qs = new URLSearchParams(location.search);

  // Horloge : ?h=15.5 fige l'heure (captures reproductibles), ?d=AAAA-MM-JJ fige la date
  const H = qs.get('h') != null ? parseFloat(qs.get('h')) : null;
  const DAY = qs.get('d');
  const boot = Date.now();
  function now() {
    const d = DAY ? u.parse(DAY) : new Date();
    if (H != null) { d.setHours(Math.floor(H), Math.round((H % 1) * 60), 0, 0); d.setTime(d.getTime() + (Date.now() - boot)); }
    else if (DAY) { const r = new Date(); d.setHours(r.getHours(), r.getMinutes(), r.getSeconds()); }
    return d;
  }
  LD.now = now;
  LD.TODAY = u.iso(now());
  LD.hourNow = () => { const d = now(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600; };

  // Paramètres (modifiables dans Administration — valeurs de démo)
  LD.config = {
    DATA_START: u.addMonths(LD.TODAY, -6),
    HORIZON: u.addDays(LD.TODAY, 42),
    SMS_WINDOW: [8, 20],               // règle à confirmer avec le juridique
    SMS_SUNDAY: false, SMS_HOLIDAYS: false,
    EMAIL_WINDOW: [6, 22],
    PRESSURE_DAYS: 7,                  // exclusion des contacts sollicités depuis moins de N jours
    PRESSURE_MAX_30D: 8,               // prises de parole max / client / 30 j avant alerte
    CAPACITY_DAY: 1800000,             // capacité de routage / jour (tous canaux) avant alerte surcharge
    THRESH: { hardBounce: 0.03, stop: 0.008, complaint: 0.0008, bdc: 0.8 },
    PRICE_NOTE: 'grille à brancher',
    LEGAL_NOTE: 'règle à confirmer avec le juridique'
  };

  const users = [
    { id: 'u-admin', name: 'Marc Olivier', login: 'm.olivier@lds-demo', role: 'Administrateur', kind: 'admin' },
    { id: 'u-claire', name: 'Claire Dubreuil', login: 'c.dubreuil@lds-demo', role: 'Directrice de clientèle', kind: 'dir' },
    { id: 'u-helene', name: 'Hélène Marchand', login: 'h.marchand@lds-demo', role: 'Directrice de clientèle', kind: 'dir' },
    { id: 'u-julien', name: 'Julien Morel', login: 'j.morel@lds-demo', role: 'Chargé de campagne', kind: 'cdc' },
    { id: 'u-sarah', name: 'Sarah Benali', login: 's.benali@lds-demo', role: 'Chargée de campagne', kind: 'cdc' },
    { id: 'u-thomas', name: 'Thomas Lefèvre', login: 't.lefevre@lds-demo', role: 'Chargé de campagne', kind: 'cdc' },
    { id: 'u-ines', name: 'Inès Garnier', login: 'i.garnier@lds-demo', role: 'Chargée de campagne', kind: 'cdc' },
    { id: 'u-client', name: 'Laura Petit', login: 'l.petit@maison-alba-demo', role: 'Client · lecture seule', kind: 'client', client: 'alba', title: 'Responsable marketing, Maison Alba' }
  ];
  const RIGHTS = {
    admin: { create: true, validate: false, admin: true, billing: true, deliver: true },
    dir: { create: true, validate: true, admin: false, billing: true, deliver: true },
    cdc: { create: true, validate: false, admin: false, billing: false, deliver: true },
    client: { create: false, validate: false, admin: false, billing: false, deliver: false, readonly: true }
  };
  users.forEach(x => x.rights = RIGHTS[x.kind]);

  const sectors = [
    { id: 'ameub', label: 'Retail ameublement' }, { id: 'banque', label: 'Banque' }, { id: 'assur', label: 'Assurance' },
    { id: 'mutu', label: 'Mutuelle' }, { id: 'auto', label: 'Automobile' }, { id: 'beaute', label: 'Beauté' },
    { id: 'telco', label: 'Télécom' }, { id: 'tour', label: 'Tourisme' }
  ];
  // d2s : drive-to-store (CA déclaré par le client) ; bdc : bon de commande (€ HT)
  const clients = [
    { id: 'alba', name: 'Maison Alba', sector: 'ameub', dir: 'u-claire', cdc: 'u-julien', contract: 'BDC annuel', bdc: 180000, cpm: 118, d2s: true, stores: 64, freq: 7, sender: 'MaisonAlba', color: '#233F93' },
    { id: 'somna', name: 'Somna Literie', sector: 'ameub', dir: 'u-claire', cdc: 'u-sarah', contract: 'BDC semestriel', bdc: 72000, cpm: 112, d2s: true, stores: 38, freq: 4, sender: 'Somna', color: '#00ADDA' },
    { id: 'oree', name: 'Banque Orée', sector: 'banque', dir: 'u-helene', cdc: 'u-thomas', contract: 'BDC annuel', bdc: 150000, cpm: 152, d2s: false, freq: 4, sender: 'BanqueOree', color: '#2BB6A3' },
    { id: 'velia', name: 'Assurances Vélia', sector: 'assur', dir: 'u-claire', cdc: 'u-ines', contract: 'Commande à la campagne', bdc: 60000, cpm: 138, d2s: false, freq: 3, sender: 'Velia', color: '#F59E0B' },
    { id: 'arpege', name: 'Mutuelle Arpège', sector: 'mutu', dir: 'u-helene', cdc: 'u-ines', contract: 'BDC annuel', bdc: 95000, cpm: 132, d2s: false, freq: 3, sender: 'Arpege', color: '#8B5CF6' },
    { id: 'lumen', name: 'Lumen Automobiles', sector: 'auto', dir: 'u-claire', cdc: 'u-thomas', contract: 'BDC annuel', bdc: 110000, cpm: 126, d2s: true, stores: 41, freq: 4, sender: 'LumenAuto', color: '#E5484D' },
    { id: 'nacre', name: 'Nacre Beauté', sector: 'beaute', dir: 'u-helene', cdc: 'u-sarah', contract: 'BDC trimestriel', bdc: 54000, cpm: 96, d2s: true, stores: 120, freq: 6, sender: 'NacreBeaute', color: '#D946EF' },
    { id: 'opaline', name: 'Opaline Mobile', sector: 'telco', dir: 'u-claire', cdc: 'u-julien', contract: 'BDC annuel', bdc: 140000, cpm: 88, d2s: false, freq: 5, sender: 'Opaline', color: '#0E4CA1' },
    { id: 'azuline', name: 'Azuline Voyages', sector: 'tour', dir: 'u-helene', cdc: 'u-julien', contract: 'Commande à la campagne', bdc: 48000, cpm: 104, d2s: false, freq: 3, sender: 'Azuline', color: '#65CBE3' }
  ];

  const channels = [
    { id: 'email', label: 'Email', short: 'Email', color: '#233F93' },
    { id: 'sms', label: 'SMS', short: 'SMS', color: '#00ADDA' },
    { id: 'rcs', label: 'RCS (repli SMS)', short: 'RCS', color: '#2BB6A3' },
    { id: 'seq', label: 'Séquence SMS + email', short: 'SMS + email', color: '#8B5CF6' }
  ];
  const STATUS = {
    brouillon: { label: 'Brouillon', cls: 'b-grey', step: 0 },
    bat: { label: 'BAT en attente client', cls: 'b-orange', step: 1 },
    bat_ok: { label: 'BAT validé client', cls: 'b-cyan', step: 1 },
    a_valider: { label: 'À valider (directrice)', cls: 'b-orange', step: 2 },
    validee: { label: 'Validée', cls: 'b-blue', step: 2 },
    programmee: { label: 'Programmée', cls: 'b-blue', step: 3 },
    en_cours: { label: 'En cours d\'envoi', cls: 'b-green', step: 4 },
    pause: { label: 'En pause', cls: 'b-orange', step: 4 },
    terminee: { label: 'Terminée', cls: 'b-grey', step: 5 },
    annulee: { label: 'Annulée', cls: 'b-red', step: -1 }
  };
  const STEPS = ['Brouillon', 'BAT', 'Validation', 'Programmée', 'Envoi', 'Terminée'];

  const types = [{ id: 'location', label: 'Location base LDS' }, { id: 'routage', label: 'Routage base client' }];

  LD.ref = {
    users, clients, sectors, channels, STATUS, STEPS, types,
    user: id => users.find(x => x.id === id), client: id => clients.find(x => x.id === id),
    sector: id => sectors.find(x => x.id === id), channel: id => channels.find(x => x.id === id),
    status: id => STATUS[id] || { label: id, cls: 'b-grey' },
    cdcs: () => users.filter(x => x.kind === 'cdc'), dirs: () => users.filter(x => x.kind === 'dir')
  };
})(window.LD);
