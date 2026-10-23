/* views/routage.js : connecteurs (Sinch SMS / RCS, plateforme email interne, base de contacts),
 * file d'envoi, débit, erreurs, journal des appels API — tout est simulé.
 */
(function (LD) {
  'use strict';
  const u = LD.u, UI = LD.ui, S = LD.store, R = LD.ref, CH = LD.charts, D = LD.data, C = LD.config, TODAY = LD.TODAY;

  function apiLog(user) {
    const now = LD.now(), r = u.rng('api' + Math.floor(now.getTime() / 60000)), lines = [];
    const run = D.camps.filter(c => S.status(c) === 'en_cours' && c.parts.some(p => S.partDate(c, p) === TODAY));
    for (let i = 0; i < 16; i++) {
      const t = new Date(now.getTime() - i * (7000 + Math.floor(r() * 9000))), c = run.length ? run[i % run.length] : null;
      const ts = '<span class="mu">' + u.fmtDateTime(t).slice(11) + '</span> ';
      const ch = c ? c.parts[0].ch : 'email';
      const roll = r();
      if (!c) lines.push(ts + '<span class="mu">GET  /health</span> <span class="ok">200</span> 34 ms');
      else if (ch === 'email') lines.push(ts + (roll < 0.06 ? `POST /email/v1/batches <span class="wa">429</span> limite de débit — nouvel essai dans 30 s · ${c.id}` : `POST /email/v1/batches <span class="ok">202</span> lot de 5 000 · ${c.id} · ${Math.floor(60 + r() * 90)} ms`));
      else lines.push(ts + (roll < 0.05 ? `POST /sinch/xms/v1/batches <span class="er">503</span> indisponible — relance automatique 1/3 · ${c.id}` : `POST /sinch/xms/v1/batches <span class="ok">201</span> ${ch === 'rcs' ? 'RCS' : 'SMS'} × 1 000 · ${c.id} · ${Math.floor(80 + r() * 120)} ms`));
      if (i % 5 === 2) lines.push(ts + '<span class="mu">WEBHOOK</span> /sinch/delivery-reports <span class="ok">200</span> ' + Math.floor(400 + r() * 600) + ' accusés de réception');
      if (i % 7 === 4) lines.push(ts + '<span class="mu">WEBHOOK</span> /sinch/inbound <span class="ok">200</span> MO « STOP » → liste d\'exclusion');
    }
    return lines.slice(0, 18).join('<br>');
  }

  function render(el, arg, user) {
    const run = D.camps.filter(c => c.parts.some(p => S.partDate(c, p) === TODAY) && ['en_cours', 'pause', 'programmee'].includes(S.status(c))).sort((a, b) => S.hourOf(a) - S.hourOf(b));
    let rate = 0, queue = 0; run.forEach(c => { const r = S.partRes(c, c.parts[0]); if (S.status(c) === 'en_cours') rate += c.throughput; queue += c.parts[0].vol - r.sent; });
    const conns = [
      { ic: 'mail', name: 'Plateforme email interne', st: ['Connecté (simulé)', 'b-green'], d: 'Envoi par lots, suivi des ouvertures / clics, retours de bounces et de désinscriptions', m: 'API REST · lots de 5 000 · webhook désinscriptions toutes les 15 min', todo: 'Documentation de l\'API interne, compte de service, environnement de test' },
      { ic: 'msg', name: 'Sinch — SMS', st: ['Connecté (simulé)', 'b-green'], d: 'Envoi SMS, émetteur alphanumérique, accusés de réception, STOP entrants (MO)', m: 'API XMS · webhooks accusés + MO · 2 relances automatiques', todo: 'Clé API Sinch (coffre-fort, jamais dans le code), numéro court STOP, quotas' },
      { ic: 'rcs', name: 'Sinch — RCS', st: ['À confirmer', 'b-orange'], d: 'Cartes enrichies, carrousels, boutons, agent vérifié de la marque, repli SMS automatique', m: 'API Conversation · vérification de l\'agent par marque', todo: 'Confirmer l\'offre RCS chez Sinch, vérifier un agent par client' },
      { ic: 'users', name: 'Base de contacts', st: ['Simulée — branchement reporté', 'b-grey'], d: 'Comptages, entonnoirs, extractions et fichiers livrés calculés sur une base virtuelle', m: u.dec(D.base.email / 1e6, 1) + ' M emails · ' + u.dec(D.base.mobile / 1e6, 1) + ' M mobiles · ' + u.dec(D.base.postal / 1e6, 1) + ' M adresses (virtuels)', todo: 'Branchement reporté' },
      { ic: 'shield', name: 'Bloctel', st: ['Simulé', 'b-grey'], d: 'Passage des numéros de téléphone avant toute livraison de fiches télémarketing', m: 'Dépôt de fichier et retour des numéros opposés', todo: 'Abonnement Bloctel de LDS, accès au service' }
    ];
    const hours = Array.from({ length: 15 }, (_, i) => 7 + i), nowH = LD.hourNow();
    const thr = hours.map(h => { let v = 0; D.camps.forEach(c => c.parts.forEach(p => { if (S.partDate(c, p) !== TODAY || S.status(c) === 'annulee') return; const s = p.off ? p.hour : S.hourOf(c), d = S.duration(p, c); const ov = Math.max(0, Math.min(h + 1, s + d) - Math.max(h, s)); v += ov / d * p.vol; })); return h <= nowH ? Math.round(v) : null; });
    const plan = hours.map(h => { let v = 0; D.camps.forEach(c => c.parts.forEach(p => { if (S.partDate(c, p) !== TODAY || S.status(c) === 'annulee') return; const s = p.off ? p.hour : S.hourOf(c), d = S.duration(p, c); const ov = Math.max(0, Math.min(h + 1, s + d) - Math.max(h, s)); v += ov / d * p.vol; })); return Math.round(v); });
    const tq = UI.table({ title: 'File d\'envoi du jour', columns: ['Départ', 'Campagne', 'Canal', { label: 'Volume', align: 'r' }, { label: 'Routés', align: 'r' }, { label: 'Restant', align: 'r' }, { label: 'Débit max', align: 'r' }, { label: 'Erreurs', align: 'r' }, 'Statut'], rows: run, rowAttr: c => `data-href="#/campagne/${c.id}"`,
      render: c => { const r = S.partRes(c, c.parts[0]); return [LD.wf.H2(S.hourOf(c)), UI.clientDot(c.client) + '<b>' + u.esc(R.client(c.client).name) + '</b> · ' + u.esc(c.name), UI.chBadge(c.channel), u.n(c.parts[0].vol), u.n(r.sent), u.n(c.parts[0].vol - r.sent), u.n(c.throughput) + '/h', u.n(Math.round(r.sent * 0.0007)), UI.statusBadge(c)]; } });
    el.innerHTML = `<div class="grid g4">${UI.kpi({ label: 'Débit en cours', value: `<span id="rt-rate">${u.n(rate)}</span>`, sub: 'messages / heure · tous connecteurs' })}${UI.kpi({ label: 'Messages en file', value: `<span id="rt-q">${u.n(queue)}</span>`, sub: run.length + ' campagnes aujourd\'hui (en cours ou programmées)' })}${UI.kpi({ label: 'Erreurs API (1 h)', value: '0,4 %', sub: 'relances automatiques : 2 essais, puis alerte' })}${UI.kpi({ label: 'Capacité du jour', value: u.pct(S.dayLoad(TODAY) / C.CAPACITY_DAY, 0), sub: u.n(S.dayLoad(TODAY)) + ' / ' + u.n(C.CAPACITY_DAY) + ' messages' })}</div>
      <div class="alert info">${UI.icon('info')}<div><b>Tous les connecteurs sont simulés dans la maquette :</b> aucun appel réseau, aucun message envoyé. Le journal ci-dessous illustre le fonctionnement attendu une fois branchés.</div></div>
      <div class="grid" style="grid-template-columns:1.25fr 1fr">${UI.card(`${UI.icon('flow')} Connecteurs`, conns.map(x => `<div class="conn"><div class="conn-ic">${UI.icon(x.ic)}</div><div><b>${x.name}</b> ${UI.badge(x.st[0], x.st[1])}<small class="muted">${u.esc(x.d)}</small><small class="muted mono" style="font-size:11px">${u.esc(x.m)}</small></div><div><small class="muted">Pour brancher :</small><br><small>${u.esc(x.todo)}</small></div></div>`).join(''))}
        ${UI.card('Messages routés par heure <small>aujourd\'hui</small>', CH.line({ labels: hours.map(h => h + 'h'), height: 210, series: [{ name: 'Prévu', data: plan, color: '#94A3B8', dash: true }, { name: 'Routé', data: thr, color: '#00ADDA', area: true }] }) + `<div class="flowmap" style="margin-top:14px"><div class="fm-col"><div class="fm-box"><b>Planning</b>campagnes programmées</div><div class="fm-box dash"><b>Base de contacts</b>virtuelle</div></div><div class="fm-arrow"></div><div class="fm-col"><div class="fm-box core"><b>LDS Campagnes</b>file, débit, fenêtres, exclusions</div></div><div class="fm-arrow"></div><div class="fm-col"><div class="fm-box"><b>Email interne</b>lots</div><div class="fm-box"><b>Sinch</b>SMS · RCS</div></div></div>`)}</div>
      ${UI.card('File d\'envoi du jour', tq.html, { tools: tq.tools })}
      ${UI.card('Journal des appels API <small>simulé · rafraîchi en direct</small>', `<div class="log" id="api-log">${apiLog(user)}</div>`)}`;
  }
  LD.views.routage = { title: 'Routage & connecteurs', filters: false, render,
    live(el, user) { const lg = el.querySelector('#api-log'); if (lg) lg.innerHTML = apiLog(user); let rate = 0, q = 0; D.camps.filter(c => c.parts.some(p => S.partDate(c, p) === TODAY) && ['en_cours', 'pause', 'programmee'].includes(S.status(c))).forEach(c => { const r = S.partRes(c, c.parts[0]); if (S.status(c) === 'en_cours') rate += c.throughput; q += c.parts[0].vol - r.sent; }); const a = el.querySelector('#rt-rate'), b = el.querySelector('#rt-q'); if (a) a.textContent = u.n(rate); if (b) b.textContent = u.n(q); } };
})(window.LD);
