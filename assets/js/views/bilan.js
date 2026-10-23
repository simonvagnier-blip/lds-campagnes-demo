/* views/bilan.js : bilan client généré (une campagne ou une période), imprimable en PDF.
 * #/bilan/<client> (période des filtres) · #/bilan/<client>/<campagne>
 */
(function (LD) {
  'use strict';
  const u = LD.u, UI = LD.ui, S = LD.store, R = LD.ref, CH = LD.charts, TODAY = LD.TODAY;

  function render(el, arg, user) {
    const isC = S.isClient(user);
    let [cid, campId] = (arg || '').split('/');
    if (isC) cid = user.client;
    const cls = S.scopeClients(user);
    const cl = cls.find(c => c.id === cid) || (S.filters.client && cls.find(c => c.id === S.filters.client)) || cls[0];
    const one = campId ? S.getCamp(campId) : null;
    if (campId && !one) { el.innerHTML = `<div class="alert risk">${UI.icon('lock')}<div><b>Campagne hors de votre périmètre.</b></div></div>`; return; }
    const [from, to] = one ? [one.date, one.end] : S.periodRange();
    const camps = one ? [one] : S.scopeCamps(user).filter(c => c.client === cl.id && (!S.filters.channel || c.channel === S.filters.channel));
    const a = S.aggregate(camps, from, to), bm = LD.bench(cl.sector);
    const list = camps.filter(c => S.dateOf(c) >= from && S.dateOf(c) <= to && ['terminee', 'en_cours', 'pause'].includes(S.status(c))).sort((x, y) => S.dateOf(x).localeCompare(S.dateOf(y)));
    const best = list.filter(c => c.parts.some(p => p.ch === 'email')).map(c => ({ c, r: S.campResults(c) })).sort((x, y) => (y.r.clickRate || 0) - (x.r.clickRate || 0))[0];
    const t = UI.table({ title: 'Bilan ' + cl.name, columns: ['Date', 'Campagne', 'Canal', { label: 'Délivrés', align: 'r' }, { label: 'Ouverture', align: 'r' }, { label: 'Clic', align: 'r' }, { label: 'Opt-out', align: 'r' }, { label: 'CA déclaré', align: 'r' }], rows: list,
      render: c => { const r = S.campResults(c), rv = S.revenueOf(c); return [u.fmtDate(S.dateOf(c)), u.esc(c.name), UI.chBadge(c.channel), u.n(r.delivered), u.pct(r.openRate), u.pct(r.clickRate != null ? r.clickRate : r.smsClick, 2), u.pct(r.optoutRate, 2), rv != null ? UI.money(rv) : '—']; },
      raw: c => { const r = S.campResults(c); return [S.dateOf(c), c.name, R.channel(c.channel).label, r.delivered, r.openRate, r.clickRate, r.optoutRate, S.revenueOf(c)]; } });
    const reco = [];
    if (a.openRate != null && bm.openRate && a.openRate < bm.openRate) reco.push('Ouverture email sous le repère du secteur : tester l\'objet en A/B sur les prochains envois et avancer l\'heure d\'envoi à 8 h.');
    else if (a.openRate != null) reco.push('Ouverture email au-dessus du repère du secteur : conserver les objets courts et personnalisés.');
    if (a.sms.sent && a.stopRate > LD.config.THRESH.stop) reco.push('Taux de STOP élevé : espacer les SMS (pression marketing à ' + (LD.config.PRESSURE_DAYS + 3) + ' jours) et raccourcir le message.');
    if (R.client(cl.id).d2s) reco.push('Drive-to-store : coupler un RCS avec bouton « Itinéraire » aux SMS sur les magasins les plus performants.');
    reco.push('Prochaine étape proposée : séquence SMS + email sur les non-cliqueurs de la dernière campagne.');
    el.innerHTML = `<div class="split" style="margin-bottom:-4px">${isC ? '' : `<label class="flt"><span>Client</span><select id="bl-cl">${cls.map(c => `<option value="${c.id}" ${c.id === cl.id ? 'selected' : ''}>${u.esc(c.name)}</option>`).join('')}</select></label>`}<span class="spacer"></span>${t.tools}<button class="btn primary" id="bl-pdf">${UI.icon('dl')}Imprimer / PDF</button>${isC ? '' : `<span class="note">Généré automatiquement · ${UI.sim('envoi au client : manuel')}</span>`}</div>
      <div class="bilan-page"><div class="bilan-head"><div><h2>${one ? 'Bilan de campagne' : 'Bilan de période'} — ${u.esc(cl.name)}</h2><p>${one ? u.esc(one.name) + ' · ' + u.fmtDate(one.date) : 'Du ' + u.fmtDate(from) + ' au ' + u.fmtDate(to)} · préparé par ${u.esc(R.user(R.client(cl.id).dir).name)}, Live Data Solutions</p></div><img src="assets/img/logo-livedata.svg" alt="Live Data"></div>
        <div class="grid g5">${UI.kpi({ label: 'Campagnes', value: String(list.length), sub: u.n(a.sent) + ' messages envoyés' })}${UI.kpi({ label: 'Messages délivrés', value: u.n(a.delivered), sub: u.pct(a.sent ? a.delivered / a.sent : null) + ' de délivrabilité' })}${UI.kpi({ label: 'Ouverture email', value: u.pct(a.openRate), sub: 'repère secteur ' + u.pct(bm.openRate) })}${UI.kpi({ label: 'Cliqueurs', value: u.n(a.clicks), sub: 'clic email ' + u.pct(a.clickRate, 2) + ' · repère ' + u.pct(bm.clickRate, 2) })}${UI.kpi({ label: R.client(cl.id).d2s ? 'CA magasin déclaré' : 'Opt-out', value: R.client(cl.id).d2s ? UI.money(a.revenue) : u.pct(a.optoutRate, 2), sub: R.client(cl.id).d2s ? (a.roas ? 'ROAS ' + u.dec(a.roas, 1) : 'déclaration en attente') : u.n(a.optout) + ' contacts' })}</div>
        <div class="grid g2" style="margin-top:16px">${UI.card('Délivrés par canal', CH.donut([{ label: 'Email', value: a.email.delivered, color: '#233F93' }, { label: 'SMS', value: a.sms.delivered, color: '#00ADDA' }, { label: 'RCS', value: a.rcs.delivered, color: '#2BB6A3' }].filter(x => x.value), { size: 140, centerSub: 'délivrés' }))}
          ${UI.card('Faits marquants et recommandations', `<ul style="margin:0;padding-left:18px;line-height:1.7;font-size:12.5px">${best ? `<li>Meilleure campagne : <b>${u.esc(best.c.name)}</b> (${u.fmtDateShort(best.c.date)}) — ${u.pct(best.r.clickRate, 2)} de clic.</li>` : ''}${reco.map(x => `<li>${u.esc(x)}</li>`).join('')}</ul>`)}</div>
        <div style="margin-top:16px">${UI.card('Détail des campagnes', t.html)}</div>
        <div class="note" style="margin-top:12px">Données fictives de démonstration — aucun chiffre ne représente une performance réelle de Live Data Solutions. Le CA magasin est celui déclaré par le client. Les repères sont les médianes des campagnes LDS du même secteur sur 6 mois.</div></div>`;
    const s = el.querySelector('#bl-cl'); if (s) s.onchange = () => { location.hash = '#/bilan/' + s.value; };
    el.querySelector('#bl-pdf').onclick = () => { S.log('Bilan imprimé / PDF (tracé)', cl.id); LD.exporter.pdf('Bilan ' + cl.name); };
  }
  LD.views.bilan = { title: (a, user) => user.kind === 'client' ? 'Mes bilans' : 'Bilan client', client: true, filters: (user) => ({ show: ['period', 'channel'], noExport: true }), render };
})(window.LD);
