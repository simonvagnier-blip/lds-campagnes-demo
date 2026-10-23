/* views/conformite.js : listes d'exclusion (désinscrits, STOP Sinch, blacklist, repoussoirs, Bloctel),
 * mentions obligatoires, pression marketing. Comptages simulés.
 */
(function (LD) {
  'use strict';
  const u = LD.u, UI = LD.ui, S = LD.store, R = LD.ref, CH = LD.charts, D = LD.data, C = LD.config, TODAY = LD.TODAY;

  function render(el, arg, user) {
    const ex = D.exclusions;
    // STOP et désinscriptions par jour sur 30 jours (issus des campagnes)
    const from = u.addDays(TODAY, -29), ser = S.dailySeries(D.camps, from, TODAY);
    const te = UI.table({ title: 'Listes d\'exclusion', columns: ['Liste', { label: 'Contacts', align: 'r' }, { label: '+ 7 jours', align: 'r' }, 'Source', 'Synchronisation', 'Statut'], rows: ex,
      render: x => [`<b>${u.esc(x.label)}</b>`, x.rows != null ? u.n(x.rows) : '—', x.delta7 ? '+ ' + u.n(x.delta7) : '—', `<small>${u.esc(x.source)}</small>`, u.esc(x.sync), UI.sim()],
      raw: x => [x.label, x.rows, x.delta7, x.source, x.sync] });
    const tr = UI.table({ title: 'Repoussoirs clients', columns: ['Client', 'Fichier', { label: 'Lignes', align: 'r' }, 'Mis à jour', ''], rows: S.scopeClients(user),
      render: c => [UI.clientDot(c.id) + u.esc(c.name), `<span class="mono">${D.repous[c.id].file}</span>`, u.n(D.repous[c.id].rows), u.fmtDate(D.repous[c.id].updated) + (u.diffDays(D.repous[c.id].updated, TODAY) > 30 ? ' <span class="badge b-orange">à rafraîchir</span>' : ''), `<button class="btn xs" data-rep="${c.id}">Remplacer le fichier</button>`] });
    const pr = S.scopeClients(user).map(c => ({ c, n: S.pressure(c.id) })).sort((a, b) => b.n - a.n);
    el.innerHTML = `<div class="grid g4">${UI.kpi({ label: 'Désinscrits email', value: u.n(ex[0].rows), sub: '+ ' + u.n(ex[0].delta7) + ' sur 7 jours' })}${UI.kpi({ label: 'STOP SMS (retours Sinch)', value: u.n(ex[1].rows), sub: '+ ' + u.n(ex[1].delta7) + ' sur 7 jours · temps réel' })}${UI.kpi({ label: 'Blacklist', value: u.n(ex[2].rows), sub: 'plaintes, demandes RGPD, pièges' })}${UI.kpi({ label: 'Repoussoirs clients', value: u.n(ex[3].rows), sub: R.clients.length + ' fichiers' })}</div>
      <div class="alert info">${UI.icon('shield')}<div>Les listes d'exclusion sont appliquées <b>automatiquement</b> à chaque comptage, chaque envoi et chaque livraison de fichier. Comptages ${UI.sim('simulés')} sur la base de contacts virtuelle.</div></div>
      ${UI.card('Listes d\'exclusion', te.html, { tools: te.tools })}
      <div class="grid" style="grid-template-columns:1.5fr 1fr">${UI.card('Désinscriptions et STOP par jour <small>30 derniers jours, toutes campagnes</small>', CH.bars({ labels: ser.map(x => u.fmtDateShort(x.d)), height: 210, stacked: true, series: [{ name: 'Désinscrits email', data: ser.map(x => x.a.email.optout), color: '#233F93' }, { name: 'STOP SMS / RCS', data: ser.map(x => x.a.sms.stop + x.a.rcs.stop), color: '#E5484D' }] }))}
        ${UI.card('Derniers STOP reçus <small>webhook Sinch ' + UI.sim() + '</small>', `<div class="checks">${D.lastStops.map(s => `<div class="chk ok"><span class="m">✓</span><span><span class="mono">${s.num}</span> · ${u.fmtDateTime(s.at).slice(11, 16)} <small class="muted">ajouté à la liste STOP</small></span></div>`).join('')}</div>`)}</div>
      <div class="grid g2">${UI.card('Mentions obligatoires contrôlées <small>bloquant avant BAT et validation</small>', `<div class="checks"><div class="chk ok"><span class="m">✓</span><span>Email : lien de désinscription présent et fonctionnel</span></div><div class="chk ok"><span class="m">✓</span><span>Email : expéditeur identifiant l'annonceur</span></div><div class="chk ok"><span class="m">✓</span><span>SMS / RCS : mention STOP (numéro court de désinscription)</span></div><div class="chk ok"><span class="m">✓</span><span>SMS : émetteur alphanumérique identifiant l'annonceur (11 caractères max.)</span></div><div class="chk ok"><span class="m">✓</span><span>RCS : agent vérifié de la marque</span></div><div class="chk wa"><span class="m">!</span><span>Fenêtres SMS 8 h – 20 h, ni dimanche ni jour férié ${UI.legal()}</span></div></div>`)}
        ${UI.card('Pression marketing par client <small>prises de parole sur 30 jours</small>', CH.hbars(pr.map(x => ({ label: x.c.name, value: x.n, color: x.n > C.PRESSURE_MAX_30D ? '#F59E0B' : '#233F93' }))) + `<div class="note" style="margin-top:8px">Seuil d'alerte : ${C.PRESSURE_MAX_30D} prises de parole / 30 jours. Exclusion des contacts sollicités depuis moins de ${C.PRESSURE_DAYS} jours (réglable dans Administration).</div>`)}</div>
      ${UI.card('Repoussoirs clients', tr.html, { tools: tr.tools })}`;
    el.querySelectorAll('[data-rep]').forEach(b => b.onclick = () => { D.repous[b.dataset.rep].updated = TODAY; S.log('Repoussoir remplacé (contenu fictif)', b.dataset.rep, user); UI.toast('Repoussoir remplacé (simulé)', 'ok'); LD.app.renderView(); });
  }
  LD.views.conformite = { title: 'Base & conformité', filters: false, render };
})(window.LD);
