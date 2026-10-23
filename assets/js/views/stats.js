/* views/stats.js : statistiques consolidées — période, client, canal, secteur, chargé ;
 * comparaison entre campagnes et entre périodes ; repères internes par secteur.
 */
(function (LD) {
  'use strict';
  const u = LD.u, UI = LD.ui, S = LD.store, R = LD.ref, CH = LD.charts, TODAY = LD.TODAY;

  function weekly(camps, from, to) {
    const out = []; let d = u.addDays(from, -((u.dow(from) + 6) % 7));
    for (; d <= to; d = u.addDays(d, 7)) { const e = u.addDays(d, 6); out.push({ d, a: S.aggregate(camps, d < from ? from : d, e > to ? to : e) }); }
    return out;
  }
  // Repères internes : moyenne des campagnes LDS du même secteur sur 6 mois (tous clients, données fictives)
  function bench(sector) {
    const cs = LD.data.camps.filter(c => R.client(c.client).sector === sector && S.status(c) === 'terminee' && c.date >= LD.config.DATA_START);
    const med = arr => { const a = arr.filter(v => v != null && isFinite(v)).sort((x, y) => x - y); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
    const rs = cs.map(c => S.campResults(c));
    return { openRate: med(rs.map(r => r.openRate)), clickRate: med(rs.map(r => r.clickRate)), smsDeliv: med(rs.map(r => r.smsDeliv)), n: cs.length };
  }
  LD.bench = bench;

  function render(el, arg, user) {
    const [from, to] = S.periodRange(), days = u.diffDays(from, to) + 1;
    const camps = S.filteredCamps(), a = S.aggregate(camps, from, to), p = S.aggregate(camps, u.addDays(from, -days), u.addDays(from, -1));
    const isC = S.isClient(user);
    const wk = days > 45 ? weekly(camps, from, to) : S.dailySeries(camps, from, to);
    const labs = wk.map(x => u.fmtDateShort(x.d));
    // Par client / par canal / par chargé
    const groups = isC ? R.channels.map(ch => ({ k: ch.label, a: S.aggregate(camps.filter(c => c.channel === ch.id), from, to) })) : S.scopeClients(user).map(cl => ({ k: cl.name, id: cl.id, a: S.aggregate(camps.filter(c => c.client === cl.id), from, to) }));
    const tg = UI.table({ title: 'Résultats par ' + (isC ? 'canal' : 'client'), columns: [isC ? 'Canal' : 'Client', { label: 'Campagnes', align: 'r' }, { label: 'Envoyés', align: 'r' }, { label: 'Délivrés', align: 'r' }, { label: 'Ouvreurs', align: 'r' }, { label: 'Ouverture', align: 'r' }, { label: 'Cliqueurs', align: 'r' }, { label: 'Clic email', align: 'r' }, { label: 'Opt-out', align: 'r' }, { label: 'CA déclaré', align: 'r' }, { label: 'Facturable', align: 'r' }],
      rows: groups.filter(g => g.a.sent), rowAttr: g => g.id ? `data-href="#/client/${g.id}"` : '',
      render: g => [g.id ? UI.clientDot(g.id) + '<b>' + u.esc(g.k) + '</b>' : '<b>' + u.esc(g.k) + '</b>', g.a.prises, u.n(g.a.sent), u.n(g.a.delivered), u.n(g.a.opens), u.pct(g.a.openRate), u.n(g.a.clicks), u.pct(g.a.clickRate, 2), u.pct(g.a.optoutRate, 2), g.a.revenue ? UI.money(g.a.revenue) : '—', UI.money(g.a.cost)],
      raw: g => [g.k, g.a.prises, g.a.sent, g.a.delivered, g.a.opens, g.a.openRate, g.a.clicks, g.a.clickRate, g.a.optoutRate, g.a.revenue, Math.round(g.a.cost)],
      foot: ['<b>Total</b>', a.prises, u.n(a.sent), u.n(a.delivered), u.n(a.opens), u.pct(a.openRate), u.n(a.clicks), u.pct(a.clickRate, 2), u.pct(a.optoutRate, 2), UI.money(a.revenue), UI.money(a.cost)] });
    // Comparaison entre campagnes (les 8 dernières terminées)
    const cmp = camps.filter(c => S.status(c) === 'terminee' && S.dateOf(c) >= from && S.dateOf(c) <= to && c.parts[0].ch === 'email').slice(-8).reverse();
    const ccmp = UI.table({ title: 'Comparaison entre campagnes email', columns: ['Campagne', 'Date', { label: 'Délivrés', align: 'r' }, { label: 'Ouverture', align: 'r' }, { label: 'Clic', align: 'r' }, { label: 'Réactivité', align: 'r' }, { label: 'Désinscr.', align: 'r' }], rows: cmp, rowAttr: c => `data-href="#/campagne/${c.id}"`,
      render: c => { const r = S.campResults(c); return [(isC ? '' : UI.clientDot(c.client)) + '<b>' + u.esc(c.name) + '</b>', u.fmtDateShort(S.dateOf(c)), u.n(r.delivered), `<span class="${r.openRate > (a.openRate || 0) ? 'up' : ''}">${u.pct(r.openRate)}</span>`, u.pct(r.clickRate, 2), u.pct(r.ctor, 1), u.pct(r.optoutRate, 2)]; },
      raw: c => { const r = S.campResults(c); return [c.name, S.dateOf(c), r.delivered, r.openRate, r.clickRate, r.ctor, r.optoutRate]; } });
    const per = (l, cur, prv, f, inv) => `<tr><td>${l}</td><td class="r">${f(prv)}</td><td class="r"><b>${f(cur)}</b></td><td class="r">${UI.delta(cur, prv, inv) || '—'}</td></tr>`;
    const comp = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Indicateur</th><th class="r">Période précédente</th><th class="r">Période</th><th class="r">Évolution</th></tr></thead><tbody>
      ${per('Campagnes', a.prises, p.prises, v => u.n(v))}${per('Messages délivrés', a.delivered, p.delivered, v => u.n(v))}${per('Taux d\'ouverture email', a.openRate, p.openRate, v => u.pct(v))}${per('Taux de clic email', a.clickRate, p.clickRate, v => u.pct(v, 2))}${per('Délivrabilité SMS', a.smsDeliv, p.smsDeliv, v => u.pct(v))}${per('Lecture RCS', a.rcsRead, p.rcsRead, v => u.pct(v, 0))}${per('Opt-out', a.optoutRate, p.optoutRate, v => u.pct(v, 2), true)}${per('CA magasin déclaré', a.revenue, p.revenue, v => UI.money(v))}</tbody></table></div>`;
    const sec = S.filters.client ? R.client(S.filters.client).sector : isC ? R.client(user.client).sector : null;
    const bm = sec ? bench(sec) : null;
    const bl = (l, v, ref, f) => `<div class="bench"><span>${l}</span><div class="bench-t"><div class="bench-f" style="width:${Math.min(100, v / (ref * 1.6) * 100).toFixed(0)}%"></div><div class="bench-m" style="left:${(100 / 1.6).toFixed(0)}%" title="Repère secteur"></div></div><b>${f(v)}</b></div>`;
    el.innerHTML = `<div class="grid g6">
      ${UI.kpi({ label: 'Campagnes', value: u.n(a.prises), sub: UI.delta(a.prises, p.prises) + ' vs période précédente' })}
      ${UI.kpi({ label: 'Messages délivrés', value: u.n(a.delivered), sub: UI.delta(a.delivered, p.delivered) + ' · ' + u.n(a.sent) + ' envoyés' })}
      ${UI.kpi({ label: 'Ouverture email', value: u.pct(a.openRate), sub: UI.delta(a.openRate, p.openRate) + ' · réactivité ' + u.pct(a.ctor, 1) })}
      ${UI.kpi({ label: 'Clic email', value: u.pct(a.clickRate, 2), sub: UI.delta(a.clickRate, p.clickRate) })}
      ${UI.kpi({ label: 'SMS délivrés · STOP', value: u.pct(a.smsDeliv), sub: 'STOP ' + u.pct(a.stopRate, 2) + ' · clic ' + u.pct(a.smsClick, 1) })}
      ${UI.kpi({ label: 'CA magasin déclaré', value: UI.money(a.revenue), sub: a.roas ? 'ROAS ' + u.dec(a.roas, 1) + ' · ' + a.revCamps + ' campagnes' : 'clients drive-to-store' })}</div>
      <div class="grid" style="grid-template-columns:1.6fr 1fr">${UI.card('Délivrés, ouvreurs et cliqueurs <small>par ' + (days > 45 ? 'semaine' : 'jour') + '</small>', CH.line({ labels: labs, height: 240, series: [{ name: 'Délivrés', data: wk.map(x => x.a.delivered), color: '#233F93', area: true }, { name: 'Ouvreurs email', data: wk.map(x => x.a.opens), color: '#00ADDA' }, { name: 'Cliqueurs', data: wk.map(x => x.a.clicks), color: '#F59E0B' }] }))}
        ${UI.card('Comparaison entre périodes', comp, { tools: '<small class="muted">' + u.fmtDateShort(u.addDays(from, -days)) + '–' + u.fmtDateShort(u.addDays(from, -1)) + ' vs ' + u.fmtDateShort(from) + '–' + u.fmtDateShort(to) + '</small>' })}</div>
      <div class="grid" style="grid-template-columns:1fr 1fr 1fr">${UI.card('Taux d\'ouverture et de clic email', CH.line({ labels: labs, height: 200, pct: true, series: [{ name: 'Ouverture', data: wk.map(x => x.a.openRate), color: '#233F93' }, { name: 'Clic', data: wk.map(x => x.a.clickRate), color: '#00ADDA' }] }))}
        ${UI.card('Répartition par canal <small>messages délivrés</small>', CH.donut([{ label: 'Email', value: a.email.delivered, color: '#233F93' }, { label: 'SMS', value: a.sms.delivered, color: '#00ADDA' }, { label: 'RCS', value: a.rcs.delivered, color: '#2BB6A3' }], { size: 140, centerSub: 'délivrés' }))}
        ${UI.card('Repères internes <small>' + (sec ? u.esc(R.sector(sec).label) : 'médianes par secteur') + '</small>', bm ? bl('Ouverture email', a.openRate || 0, bm.openRate || 0.18, v => u.pct(v)) + '<div style="height:10px"></div>' + bl('Clic email', a.clickRate || 0, bm.clickRate || 0.02, v => u.pct(v, 2)) + '<div style="height:10px"></div>' + bl('Délivrabilité SMS', a.smsDeliv || 0, bm.smsDeliv || 0.96, v => u.pct(v)) + `<div class="note" style="margin-top:12px">Trait rouge : médiane des ${bm.n} campagnes LDS du secteur sur 6 mois (${u.pct(bm.openRate)} d'ouverture, ${u.pct(bm.clickRate, 2)} de clic). Repère interne fictif, pas une performance réelle.</div>` : (() => { const rows = R.sectors.map(s => ({ s, b: bench(s.id) })).filter(x => x.b.openRate); return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Secteur</th><th class="r">Ouverture</th><th class="r">Clic</th><th class="r">Délivr. SMS</th><th class="r">Camp.</th></tr></thead><tbody>' + rows.map(x => `<tr><td>${u.esc(x.s.label)}</td><td class="r">${u.pct(x.b.openRate)}</td><td class="r">${u.pct(x.b.clickRate, 2)}</td><td class="r">${u.pct(x.b.smsDeliv)}</td><td class="r">${x.b.n}</td></tr>`).join('') + '</tbody></table></div><div class="note" style="margin-top:8px">Médianes des campagnes LDS terminées sur 6 mois, par secteur (données fictives). Filtrez sur un client pour le situer.</div>'; })())}</div>
      <div class="grid g2">${UI.card('Résultats par ' + (isC ? 'canal' : 'client'), tg.html, { tools: tg.tools, cls: 'span2' })}</div>
      ${UI.card('Comparaison entre campagnes email <small>dernières campagnes terminées</small>', ccmp.html, { tools: ccmp.tools })}`;
  }
  LD.views.stats = { title: 'Statistiques', client: true, filters: { show: ['period', 'client', 'channel', 'sector', 'cdc', 'type'] }, render };
})(window.LD);
