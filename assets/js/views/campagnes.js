/* views/campagnes.js : liste des campagnes (onglets, recherche, duplication) et modèles par client. */
(function (LD) {
  'use strict';
  const u = LD.u, UI = LD.ui, S = LD.store, R = LD.ref, W = LD.wf, TODAY = LD.TODAY;
  let q = '';
  const TABS = [
    { id: 'avenir', label: 'À venir', f: c => S.PRE.includes(S.status(c)) },
    { id: 'encours', label: 'En cours', f: c => ['en_cours', 'pause'].includes(S.status(c)) },
    { id: 'terminees', label: 'Terminées', f: c => ['terminee', 'annulee'].includes(S.status(c)) },
    { id: 'toutes', label: 'Toutes', f: () => true }
  ];
  // Modèles de campagne par client (paramètres pré-remplis dans l'assistant)
  const MODELS = [
    { id: 'm1', client: 'alba', name: 'Week-end privilège — SMS + email', channel: 'seq', note: 'SMS J0 11 h, email J+2 9 h · rayon 15 km magasins' },
    { id: 'm2', client: 'alba', name: 'Portes ouvertes — RCS carte magasin', channel: 'rcs', note: 'Bouton itinéraire, repli SMS' },
    { id: 'm3', client: 'opaline', name: 'Offre mobile — SMS court', channel: 'sms', note: '1 SMS · lien court tracké · 11 h' },
    { id: 'm4', client: 'oree', name: 'Newsletter produit — email', channel: 'email', note: 'Test A/B sur l\'objet 10 %' },
    { id: 'm5', client: 'nacre', name: 'Journées beauté — RCS carrousel', channel: 'rcs', note: '3 cartes produits, bouton magasin' },
    { id: 'm6', client: 'lumen', name: 'Essais concession — SMS + email', channel: 'seq', note: 'SMS J0, email J+2 avec prise de RDV' }
  ];
  LD.models = MODELS;

  function render(el, arg, user) {
    const tab = TABS.find(t => t.id === arg) || TABS[0];
    const isC = S.isClient(user);
    const base = S.filteredCamps(), ql = q.trim().toLowerCase();
    const match = c => !ql || (c.name + ' ' + c.id + ' ' + R.client(c.client).name).toLowerCase().includes(ql);
    const rows = base.filter(tab.f).filter(match).sort((a, b) => tab.id === 'avenir' ? S.dateOf(a).localeCompare(S.dateOf(b)) || S.hourOf(a) - S.hourOf(b) : S.dateOf(b).localeCompare(S.dateOf(a)));
    const perf = c => {
      const r = S.campResults(c), st = S.status(c);
      if (S.PRE.includes(st)) { const d = u.diffDays(TODAY, S.dateOf(c)); return `<span class="muted">départ ${d === 0 ? 'aujourd\'hui' : 'dans ' + d + ' j'}</span><span class="sub">estimé ${UI.money(S.billing(c).amount)} HT</span>`; }
      if (c.parts.some(p => p.ch === 'email')) return `<b>${u.pct(r.openRate)}</b> ouv. · ${u.pct(r.clickRate, 2)} clic<span class="sub">${u.n(r.delivered)} délivrés</span>`;
      if (c.parts.some(p => p.ch === 'rcs')) return `<b>${u.pct(r.rcsRead, 0)}</b> lus · ${u.n(r.clicks)} clics<span class="sub">${u.n(r.delivered)} délivrés</span>`;
      return `<b>${u.pct(r.smsDeliv)}</b> délivr. · ${u.pct(r.smsClick, 1)} clic<span class="sub">${u.n(r.sms.stop)} STOP</span>`;
    };
    const t = UI.table({
      title: 'Campagnes — ' + tab.label, max: 60,
      columns: ['Date', 'Client', 'Campagne', 'Canal', 'Type', { label: 'Volume', align: 'r' }, 'Statut', 'Résultats', 'Chargé', ''],
      rows, rowAttr: c => `data-href="#/campagne/${c.id}"`,
      render: c => [`<b>${u.fmtDate(S.dateOf(c))}</b><span class="sub">${W.H2(S.hourOf(c))}</span>`, UI.clientDot(c.client) + u.esc(R.client(c.client).name),
        `<b>${u.esc(c.name)}</b><span class="sub mono">${c.id}${c.ab ? ' · test A/B' : ''}${c.created ? ' · créée en démo' : ''}</span>`, UI.chBadge(c.channel), `<small>${u.esc(R.types.find(x => x.id === c.type).label)}</small>`,
        u.n(c.volume), UI.statusBadge(c), perf(c), UI.avatar(c.cdc, true) + ' <small>' + u.esc(R.user(c.cdc).name.split(' ')[0]) + '</small>',
        isC ? '' : `<button class="btn xs" data-dup="${c.id}" title="Dupliquer la campagne (nouvelle campagne en brouillon)">${UI.icon('copy')}Dupliquer</button>`],
      raw: c => { const r = S.campResults(c); return [S.dateOf(c), R.client(c.client).name, c.name, c.id, R.channel(c.channel).label, c.type, c.volume, R.status(S.status(c)).label, r.delivered, r.openRate != null ? +(r.openRate * 100).toFixed(2) : '', r.clickRate != null ? +(r.clickRate * 100).toFixed(2) : '', R.user(c.cdc).name]; },
      meta: ['Onglet ' + tab.label, S.scopeLabel(), 'Données fictives — maquette']
    });
    LD.exporter.get(t.idx).columns = ['Date', 'Client', 'Campagne', 'Identifiant', 'Canal', 'Type', 'Volume', 'Statut', 'Délivrés', 'Ouverture %', 'Clic %', 'Chargé'];
    const counts = TABS.map(x => base.filter(x.f).filter(match).length);
    const models = MODELS.filter(m => !isC && (!S.filters.client || m.client === S.filters.client));
    el.innerHTML = `
      <div class="card"><div class="card-h"><div class="tabs" style="border:0">${TABS.map((x, i) => `<a class="tab ${x.id === tab.id ? 'on' : ''}" href="#/campagnes/${x.id}">${x.label} <span class="badge b-grey">${counts[i]}</span></a>`).join('')}</div>
        <div class="split"><input id="q" class="search" placeholder="Rechercher une campagne, un client…" value="${u.esc(q)}" style="width:320px;font:inherit;font-size:12.5px;padding:7px 10px;border:1px solid #CFD9EA;border-radius:8px">${t.tools}${isC ? '' : `<a class="btn sm primary" href="#/nouvelle">${UI.icon('plus')}Nouvelle campagne</a>`}</div></div>
        <div class="card-b">${t.html}</div></div>
      ${models.length ? UI.card(`${UI.icon('copy')} Modèles de campagne par client <small>réutilisez les paramètres d'une campagne type</small>`, `<div class="grid g3">${models.map(m => `<div class="ch-opt" data-model="${m.id}"><b>${UI.clientDot(m.client)}${u.esc(R.client(m.client).name)}</b><span style="color:var(--text);font-weight:500">${u.esc(m.name)}</span><span>${UI.chBadge(m.channel)} ${u.esc(m.note)}</span><span class="link" style="padding:0;text-align:left">Créer depuis ce modèle ›</span></div>`).join('')}</div>`) : ''}`;
    const inp = el.querySelector('#q');
    inp.oninput = () => { q = inp.value; const pos = inp.selectionStart; render(el, arg, user); const n = el.querySelector('#q'); n.focus(); n.setSelectionRange(pos, pos); };
    el.querySelectorAll('[data-dup]').forEach(b => b.onclick = e => {
      e.stopPropagation(); const c = S.getCamp(b.dataset.dup); const r = W.duplicate(c, user);
      if (UI.result(r)) location.hash = '#/campagne/' + r.id;
    });
    el.querySelectorAll('[data-model]').forEach(b => b.onclick = () => { location.hash = '#/nouvelle/modele/' + b.dataset.model; });
  }
  LD.views.campagnes = { title: 'Campagnes', client: true, filters: { show: ['client', 'channel', 'sector', 'cdc', 'type'], noExport: true }, render };
})(window.LD);
