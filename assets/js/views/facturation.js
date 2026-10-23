/* views/facturation.js : proposition de facturation mensuelle (ajustable), suivi des bons de commande,
 * export vers la comptabilité. Prix indicatifs : « grille à brancher ».
 */
(function (LD) {
  'use strict';
  const u = LD.u, UI = LD.ui, S = LD.store, R = LD.ref, D = LD.data, C = LD.config, TODAY = LD.TODAY;

  function lines(from, to, clientId) {
    const out = [];
    S.scopeCamps().filter(c => (!clientId || c.client === clientId) && S.dateOf(c) >= from && S.dateOf(c) <= to && S.dateOf(c) <= TODAY && ['terminee', 'en_cours', 'pause', 'annulee'].includes(S.status(c))).forEach(c => {
      const b = S.billing(c); if (!b.qty && !b.crea) return;
      // Montant = S.billing (fonction de prix unique, CPM ajusté compris) : mêmes chiffres que l'onglet Prix, le BDC et l'espace client
      out.push({ kind: 'Campagne', id: c.id, client: c.client, date: S.dateOf(c), label: c.name + ' · ' + R.channel(c.channel).label, basis: b.qty, unit: c.type === 'routage' ? 'routage (envoyés)' : 'location (délivrés)', cpm: b.cpm, grid: b.grid, crea: b.crea, estimate: b.estimate, amount: b.amount, adjusted: b.adjusted });
    });
    D.files.filter(f => (!clientId || f.client === clientId) && ['livree', 'expiree'].includes(S.fileStatus(f)) && f.date >= from && f.date <= to).forEach(f => out.push({ kind: 'Fichier', id: f.id, client: f.client, date: f.date, label: f.label, basis: f.volume, unit: 'lignes livrées', cpm: f.cpm, crea: 0, amount: S.fileAmount(f) }));
    D.tm.filter(t => (!clientId || t.client === clientId) && S.tmStatus(t) === 'livree' && t.date >= from && t.date <= to).forEach(t => out.push({ kind: 'Télémarketing', id: t.id, client: t.client, date: t.date, label: t.label, basis: t.volume, unit: 'fiches (' + u.dec(t.price, 2) + ' € / fiche)', cpm: null, crea: 0, amount: S.tmAmount(t) }));
    return out.sort((a, b) => a.client.localeCompare(b.client) || a.date.localeCompare(b.date));
  }

  function render(el, arg, user) {
    const months = []; for (let i = 0; i < 6; i++) months.push(u.addMonths(TODAY, -i).slice(0, 7));
    const m = months.includes(arg) ? arg : months[0], from = m + '-01', to = u.monthEnd(from);
    const L = lines(from, to, S.filters.client), byCl = u.groupBy(L, x => x.client);
    const total = u.sum(L, x => x.amount);
    const t = UI.table({ title: 'Facturation ' + u.fmtMonth(from), max: 80, columns: ['Client', 'Type', 'Référence', 'Date', 'Libellé', { label: 'Base', align: 'r' }, 'Unité', { label: 'Prix au mille', align: 'r' }, { label: 'Création', align: 'r' }, { label: 'Montant HT', align: 'r' }],
      rows: L, render: x => [UI.clientDot(x.client) + u.esc(R.client(x.client).name), x.kind, `<span class="mono">${x.id}</span>`, u.fmtDateShort(x.date), u.esc(x.label) + (x.estimate ? ' <span class="badge b-grey">en cours</span>' : ''), u.n(x.basis), `<small>${u.esc(x.unit)}</small>`, x.cpm != null ? (user.rights.billing && x.kind === 'Campagne' ? `<input type="number" step="1" value="${x.cpm}" data-adj="${x.id}" style="width:70px;font:inherit;font-size:12px;padding:2px 6px;border:1px solid ${x.adjusted ? 'var(--orange)' : '#CFD9EA'};border-radius:6px;text-align:right" title="Grille : ${x.grid} €"> €${x.adjusted ? '<span class="sub" style="color:var(--orange)">ajusté · grille ' + x.grid + ' €</span>' : ''}` : u.dec(x.cpm, 2) + ' €') : '—', x.crea ? UI.money(x.crea) : '—', '<b>' + UI.money(x.amount, true) + '</b>'],
      raw: x => [R.client(x.client).name, x.kind, x.id, x.date, x.label, x.basis, x.unit, x.cpm, x.crea, x.amount], foot: ['<b>Total</b>', '', '', '', L.length + ' lignes', '', '', '', '', '<b>' + UI.money(total, true) + '</b>'] });
    const vk = LD.state().params.recapOk = LD.state().params.recapOk || {};
    const recap = UI.table({ title: 'Récapitulatif ' + u.fmtMonth(from), columns: ['Client', { label: 'Campagnes', align: 'r' }, { label: 'Fichiers', align: 'r' }, { label: 'Télémarketing', align: 'r' }, { label: 'Total HT', align: 'r' }, 'Validation', ''], rows: Object.keys(byCl).map(k => ({ k, l: byCl[k] })),
      render: x => { const ok = vk[m + x.k]; return [UI.clientDot(x.k) + '<b>' + u.esc(R.client(x.k).name) + '</b>', UI.money(u.sum(x.l.filter(y => y.kind === 'Campagne'), y => y.amount)), UI.money(u.sum(x.l.filter(y => y.kind === 'Fichier'), y => y.amount)), UI.money(u.sum(x.l.filter(y => y.kind === 'Télémarketing'), y => y.amount)), '<b>' + UI.money(u.sum(x.l, y => y.amount), true) + '</b>', ok ? '<span class="badge b-green">validé · ' + u.esc(R.user(ok).name) + '</span>' : '<span class="badge b-orange">à valider</span>', ok ? '' : `<button class="btn xs ok" data-rok="${x.k}">Valider</button>`]; },
      raw: x => [R.client(x.k).name, u.sum(x.l.filter(y => y.kind === 'Campagne'), y => y.amount), u.sum(x.l.filter(y => y.kind === 'Fichier'), y => y.amount), u.sum(x.l.filter(y => y.kind === 'Télémarketing'), y => y.amount), u.sum(x.l, y => y.amount), vk[m + x.k] ? 'validé' : 'à valider'] });
    const bdcs = S.scopeClients(user).filter(c => !S.filters.client || c.id === S.filters.client).map(c => ({ c, b: S.bdc(c.id), m: u.sum(byCl[c.id] || [], x => x.amount) }));
    const tb = UI.table({ title: 'Bons de commande', columns: ['Client', 'Contrat', { label: 'Montant BDC', align: 'r' }, { label: 'Consommé', align: 'r' }, 'Consommation', { label: 'Engagé à venir', align: 'r' }, { label: 'Reste', align: 'r' }, { label: 'Ce mois', align: 'r' }],
      rows: bdcs, rowAttr: x => `data-href="#/client/${x.c.id}"`, render: x => [UI.clientDot(x.c.id) + '<b>' + u.esc(x.c.name) + '</b>', u.esc(x.c.contract), UI.money(x.b.amount), UI.money(x.b.consumed), `<div class="sendbar" style="min-width:160px"><div class="sendbar-t"><div class="sendbar-f" style="width:${Math.min(100, x.b.ratio * 100).toFixed(0)}%;${x.b.alert ? 'background:#F59E0B' : ''}"></div></div><div class="sendbar-l"><span>${u.pct(x.b.ratio, 0)}</span><span>${x.b.alert ? '<b style="color:var(--orange)">alerte</b>' : ''}</span></div></div>`, UI.money(x.b.planned), UI.money(x.b.rest), UI.money(x.m)],
      raw: x => [x.c.name, x.c.contract, x.c.bdc, Math.round(x.b.consumed), x.b.ratio, Math.round(x.b.planned), Math.round(x.b.rest), Math.round(x.m)] });
    el.innerHTML = `<div class="split"><div class="seg">${months.slice().reverse().map(x => `<button class="${x === m ? 'on' : ''}" data-m="${x}">${u.fmtMonth(x + '-01', true)}</button>`).join('')}</div><span class="spacer"></span><button class="btn primary" id="exp-compta">${UI.icon('dl')}Export comptabilité (Excel)</button><button class="btn" id="exp-csv">${UI.icon('dl')}CSV</button></div>
      <div class="grid g4">${UI.kpi({ label: 'À facturer — ' + u.fmtMonth(from), value: UI.money(total), sub: Object.keys(byCl).length + ' clients · ' + L.length + ' lignes' + (m === TODAY.slice(0, 7) ? ' · mois en cours' : '') })}${UI.kpi({ label: 'Campagnes', value: UI.money(u.sum(L.filter(x => x.kind === 'Campagne'), x => x.amount)), sub: L.filter(x => x.kind === 'Campagne').length + ' campagnes' })}${UI.kpi({ label: 'Fichiers et télémarketing', value: UI.money(u.sum(L.filter(x => x.kind !== 'Campagne'), x => x.amount)), sub: L.filter(x => x.kind !== 'Campagne').length + ' livraisons' })}${UI.kpi({ label: 'BDC au-delà de ' + u.pct(C.THRESH.bdc, 0), value: String(bdcs.filter(x => x.b.alert).length), cls: bdcs.some(x => x.b.alert) ? 'warn' : '', sub: bdcs.filter(x => x.b.alert).map(x => x.c.name).join(', ') || 'aucun' })}</div>
      <div class="alert info">${UI.icon('info')}<div><b>Proposition de facturation, ajustable.</b> Location base LDS : facturée aux <b>délivrés</b> ; routage base client : aux <b>envoyés</b> ; création graphique : ${S.CREA_FEE} € forfaitaire. Prix au mille indicatifs (« ${C.PRICE_NOTE} ») ; un prix modifié ici est tracé au journal.</div></div>
      ${UI.card('Récapitulatif mensuel par client <small>à valider avant export</small>', recap.html, { tools: recap.tools })}
      ${UI.card('Lignes de facturation', t.html, { tools: t.tools })}
      ${UI.card('Suivi des bons de commande', tb.html, { tools: tb.tools })}`;
    el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { location.hash = '#/facturation/' + b.dataset.m; });
    el.querySelectorAll('[data-adj]').forEach(x => x.onchange = () => { const c = S.getCamp(x.dataset.adj); if (!c || !(+x.value > 0)) { UI.toast('Prix au mille invalide', 'err'); return; } const b = S.setCpm(c, +x.value, user); LD.app.renderView(); UI.toast('Prix au mille ' + (b.adjusted ? 'ajusté à ' + b.cpm + ' €' : 'remis à la grille') + ' — ' + UI.money(b.amount, true) + ' HT, repris dans le BDC, l\u2019onglet Prix et l\u2019espace client', 'ok'); });
    el.querySelectorAll('[data-rok]').forEach(b => b.onclick = () => { vk[m + b.dataset.rok] = user.id; S.log('Récapitulatif de facturation ' + m + ' validé', b.dataset.rok); UI.toast('Récapitulatif validé', 'ok'); LD.app.renderView(); });
    el.querySelector('#exp-csv').onclick = () => { LD.exporter.csv(LD.exporter.get(t.idx)); S.log('Export CSV facturation ' + m); UI.toast('Export CSV généré', 'ok'); };
    el.querySelector('#exp-compta').onclick = () => { LD.exporter.excel(LD.exporter.get(t.idx)); S.log('Export comptabilité ' + m); UI.toast('Export comptabilité généré (' + L.length + ' lignes)', 'ok'); };
  }
  LD.billingLines = lines;
  LD.views.facturation = { title: 'Facturation', filters: { show: ['client'], noExport: true }, render, right: 'billing' };
})(window.LD);
