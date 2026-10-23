/* views/dashboard.js : tableau de bord — envois en direct, indicateurs de période,
 * points d'attention, file du jour, volumes et charge des chargés.
 */
(function (LD) {
  'use strict';
  const u = LD.u, UI = LD.ui, S = LD.store, R = LD.ref, CH = LD.charts, C = LD.config, D = LD.data, TODAY = LD.TODAY;

  // ---------- Points d'attention (réutilisés par la fiche client) ----------
  function attention(user, onlyClient) {
    const out = [], camps = S.scopeCamps(user).filter(c => !onlyClient || c.client === onlyClient);
    const mine = c => user.kind !== 'dir' || R.client(c.client).dir === user.id;
    camps.filter(mine).forEach(c => {
      const st = S.status(c), d = u.diffDays(TODAY, S.dateOf(c)), cl = R.client(c.client);
      if (d >= 0 && d <= 2 && ['brouillon', 'bat'].includes(st)) out.push({ lvl: 'risk', ic: 'eye', t: (st === 'brouillon' ? 'BAT non préparé' : 'BAT non validé par le client') + ' à J-' + d, s: cl.name + ' · ' + c.name + ' · envoi le ' + u.fmtDateShort(S.dateOf(c)), href: '#/campagne/' + c.id, k: 'bat' });
      if (st === 'a_valider' && d >= 0 && d <= 4) out.push({ lvl: d <= 2 ? 'risk' : 'warn', ic: 'check', t: 'Validation en retard — directrice ' + R.user(cl.dir).name, s: cl.name + ' · ' + c.name + ' · envoi dans ' + d + ' j', href: '#/campagne/' + c.id, k: 'valid' });
      if (c.invalidImport && d >= -6 && d <= 0) out.push({ lvl: 'warn', ic: 'alert', t: 'Taux d\'adresses invalides anormal : ' + u.pct(c.invalidImport) + ' (seuil ' + u.pct(C.THRESH.hardBounce, 0) + ')', s: cl.name + ' · import base client · ' + c.name, href: '#/campagne/' + c.id, k: 'invalid' });
      if (d >= -6 && d < 0 && ['terminee', 'en_cours'].includes(st)) {
        const r = S.campResults(c);
        if (r.stopRate != null && r.stopRate > C.THRESH.stop) out.push({ lvl: 'warn', ic: 'msg', t: 'STOP au-dessus du seuil : ' + u.pct(r.stopRate, 2) + ' (seuil ' + u.pct(C.THRESH.stop, 1) + ')', s: cl.name + ' · ' + c.name + ' · ' + u.fmtDateShort(c.date), href: '#/campagne/' + c.id, k: 'stop' });
        if (r.complaintRate != null && r.complaintRate > C.THRESH.complaint) out.push({ lvl: 'warn', ic: 'alert', t: 'Plaintes au-dessus du seuil : ' + u.pct(r.complaintRate, 2), s: cl.name + ' · ' + c.name, href: '#/campagne/' + c.id, k: 'plainte' });
      }
    });
    S.scopeClients(user).filter(cl => (!onlyClient || cl.id === onlyClient) && (user.kind !== 'dir' || cl.dir === user.id)).forEach(cl => {
      const n = D.camps.filter(c => c.client === cl.id && S.status(c) !== 'annulee' && S.dateOf(c) > u.addDays(TODAY, -15) && S.dateOf(c) <= u.addDays(TODAY, 15)).length;
      if (n > C.PRESSURE_MAX_30D) out.push({ lvl: 'warn', ic: 'users', t: 'Conflit de pression : ' + n + ' prises de parole sur 30 jours (seuil ' + C.PRESSURE_MAX_30D + ')', s: cl.name + ' · du ' + u.fmtDateShort(u.addDays(TODAY, -14)) + ' au ' + u.fmtDateShort(u.addDays(TODAY, 15)), href: '#/client/' + cl.id, k: 'pression' });
      if (user.kind !== 'client') { const b = S.bdc(cl.id); if (b.alert) out.push({ lvl: b.ratio >= 1 ? 'risk' : 'info', ic: 'euro', t: 'Bon de commande consommé à ' + u.pct(b.ratio, 0), s: cl.name + ' · reste ' + u.n(Math.max(0, b.rest)) + ' € sur ' + u.n(b.amount) + ' €', href: '#/client/' + cl.id, k: 'bdc' }); }
    });
    if (!onlyClient && user.kind !== 'client') {
      for (let d = TODAY; d <= u.addDays(TODAY, 21); d = u.addDays(d, 1)) { const l = S.dayLoad(d); if (l > C.CAPACITY_DAY) out.push({ lvl: 'warn', ic: 'flow', t: 'Surcharge du routage le ' + u.DOWS[u.dow(d)].toLowerCase() + ' ' + u.fmtDateShort(d) + ' : ' + u.dec(l / 1e6, 1) + ' M messages', s: 'Capacité paramétrée : ' + u.dec(C.CAPACITY_DAY / 1e6, 1) + ' M / jour — replanifier depuis le planning', href: '#/planning', k: 'charge' }); }
    }
    const o = { risk: 0, warn: 1, info: 2 };
    return out.sort((a, b) => o[a.lvl] - o[b.lvl]);
  }
  LD.attention = attention;

  // ---------- Envois du jour ----------
  function todayCamps(user) {
    return S.scopeCamps(user).filter(c => c.parts.some(p => S.partDate(c, p) === TODAY) && S.status(c) !== 'annulee' || (S.status(c) === 'annulee' && S.dateOf(c) === TODAY))
      .sort((a, b) => S.hourOf(a) - S.hourOf(b));
  }
  function liveNumbers(user) {
    const list = todayCamps(user); let sent = 0, planned = 0, rate = 0, nrun = 0, ndone = 0, nprog = 0;
    list.forEach(c => c.parts.forEach(p => {
      if (S.partDate(c, p) !== TODAY) return;
      const r = S.partRes(c, p); sent += r.sent; planned += p.vol;
      const st = S.status(c);
      if (st === 'en_cours' && r.prog > 0 && r.prog < 1) rate += c.throughput;
    }));
    list.forEach(c => { const st = S.status(c); if (st === 'en_cours' || st === 'pause') nrun++; else if (st === 'terminee') ndone++; else if (st === 'programmee') nprog++; });
    return { list, sent, planned, rate, nrun, ndone, nprog };
  }
  function sendRow(c) {
    const st = S.status(c), p = c.parts[0], r = S.partRes(c, p), cl = R.client(c.client);
    const lbl = st === 'programmee' ? 'départ ' + LD.wf.H2(S.hourOf(c)) : st === 'terminee' ? 'terminé' : st === 'pause' ? 'en pause' : st === 'annulee' ? 'arrêté' : u.pct(r.prog, 0);
    return `<div class="sendrow" data-href="#/campagne/${c.id}" data-cid="${c.id}" style="cursor:pointer">
      <div class="nm"><b>${UI.clientDot(c.client)}${u.esc(cl.name)} · ${u.esc(c.name)}</b><small class="muted">${LD.wf.H2(S.hourOf(c))} · ${u.n(p.vol)} ${p.ch === 'email' ? 'emails' : p.ch === 'rcs' ? 'RCS' : 'SMS'}${c.parts.length > 1 && c.parts[1].date === p.date ? ' + ' + u.n(c.parts[1].vol) + ' en repli SMS' : ''} · ${u.esc(R.user(c.cdc).name)}</small></div>
      <div>${UI.chBadge(c.channel)}</div>
      <div class="sendbar"><div class="sendbar-t"><div class="sendbar-f ${st === 'pause' ? 'paused' : ''}" style="width:${(r.prog * 100).toFixed(1)}%"></div></div><div class="sendbar-l"><span class="counter" data-sent>${u.n(r.sent)} routés</span><span>${lbl}</span></div></div>
      <div class="rt">${UI.statusBadge(c)}<small class="muted">${p.ch === 'email' ? u.n(r.opens) + ' ouvreurs' : p.ch === 'rcs' ? u.n(r.read) + ' lus' : u.n(r.delivered) + ' délivrés'}</small></div></div>`;
  }

  function render(el, arg, user) {
    const isC = user.kind === 'client';
    const L = liveNumbers(user);
    const [from, to] = S.periodRange(), days = u.diffDays(from, to) + 1;
    const camps = S.filteredCamps();
    const cur = S.aggregate(camps, from, to), prev = S.aggregate(camps, u.addDays(from, -days), u.addDays(from, -1));
    const series = S.dailySeries(camps, from, to);
    const sp = (f, col) => CH.spark(series.map(x => f(x.a) || 0), { color: col, width: 220, height: 30 });
    const bars = [38, 60, 86, 112, 140, 112, 86, 60].map(h => `<i style="height:${h * .7}px"></i>`).join('');
    const running = L.list.filter(c => !['terminee', 'annulee'].includes(S.status(c)));
    const rows = (running.length ? running : L.list).slice(0, 5);

    const hero = `<div class="live-hero">
      <div class="lh-l"><div class="kpi-l"><span class="pill-live" style="color:#7CF0C6"><span class="dot"></span>En direct</span> Messages routés aujourd'hui ${UI.sim('flux simulé')}</div>
        <div class="lh-big counter" id="live-sent">${u.n(L.sent)}</div>
        <div class="lh-sub">sur <b id="live-planned">${u.n(L.planned)}</b> programmés ce jour · débit actuel <b id="live-rate">${u.n(L.rate)}</b> messages / heure</div>
        <div class="lh-grid"><div><b id="live-nrun">${L.nrun}</b><span>en cours / en pause</span></div><div><b id="live-nprog">${L.nprog}</b><span>programmés plus tard</span></div><div><b id="live-ndone">${L.ndone}</b><span>terminés aujourd'hui</span></div></div>
        <div class="lh-bars">${bars}</div></div>
      <div class="lh-r"><h3>${UI.icon('send')} Envois du jour <small class="muted" style="font-weight:400">${L.list.length} campagne(s) · avancement par campagne</small><span class="spacer"></span><a class="btn xs" href="#/planning">Voir le planning</a></h3>
        <div id="live-rows">${rows.map(sendRow).join('') || '<div class="note">Aucun envoi aujourd\'hui sur ce périmètre.</div>'}</div></div></div>`;

    const kpis = `<div class="grid g6">
      ${UI.kpi({ label: 'Messages délivrés', value: u.n(cur.delivered), sub: UI.delta(cur.delivered, prev.delivered) + ' vs période précédente', spark: sp(a => a.delivered, '#233F93'), hint: 'Email + SMS + RCS délivrés sur la période (date d\'envoi)' })}
      ${UI.kpi({ label: 'Taux d\'ouverture email', value: u.pct(cur.openRate), sub: UI.delta(cur.openRate, prev.openRate) + ' · ' + u.n(cur.email.opens) + ' ouvreurs', spark: sp(a => a.openRate, '#00ADDA'), hint: 'Ouvreurs uniques / emails délivrés' })}
      ${UI.kpi({ label: 'Taux de clic email', value: u.pct(cur.clickRate, 2), sub: UI.delta(cur.clickRate, prev.clickRate) + ' · ' + u.n(cur.email.clicks) + ' cliqueurs', spark: sp(a => a.clickRate, '#2BB6A3'), hint: 'Cliqueurs uniques / emails délivrés' })}
      ${UI.kpi({ label: 'Délivrabilité SMS', value: u.pct(cur.smsDeliv), sub: u.n(cur.sms.delivered) + ' SMS délivrés · clic ' + u.pct(cur.smsClick, 1), spark: sp(a => a.smsDeliv, '#0E4CA1'), hint: 'Accusés de réception opérateurs / SMS envoyés' })}
      ${UI.kpi({ label: 'Opt-out (désinscrits + STOP)', value: u.pct(cur.optoutRate, 2), sub: UI.delta(cur.optoutRate, prev.optoutRate, true) + ' · ' + u.n(cur.optout) + ' contacts', spark: sp(a => a.optoutRate, '#E5484D'), hint: 'Désinscriptions email + STOP SMS / RCS, rapportés aux délivrés' })}
      ${UI.kpi({ label: 'CA magasin déclaré', value: UI.money(cur.revenue), sub: (cur.roas ? 'ROAS ' + u.dec(cur.roas, 1) + ' · ' : '') + cur.revCamps + ' campagne(s) drive-to-store', spark: sp(a => a.revenue, '#F59E0B'), hint: 'CA déclaré par les clients drive-to-store, connu 5 à 14 jours après l\'envoi' })}
    </div>`;

    const att = attention(user);
    const attCard = UI.card(`${UI.icon('alert')} Points d'attention <span class="badge ${att.some(a => a.lvl === 'risk') ? 'b-red' : 'b-orange'}">${att.length}</span>`,
      `<div class="att">${att.slice(0, 7).map(a => `<div class="att-i" data-href="${a.href}"><div class="att-ic ${a.lvl}">${UI.icon(a.ic)}</div><div><b>${u.esc(a.t)}</b><small class="muted">${u.esc(a.s)}</small></div><span class="muted">›</span></div>`).join('') || '<div class="alert ok">' + UI.icon('check') + '<div>Rien à signaler.</div></div>'}</div>`,
      { tools: `<small class="muted">${user.kind === 'dir' ? 'vos comptes' : isC ? 'vos campagnes' : 'tous les comptes'}</small>`, foot: att.length > 7 ? '+ ' + (att.length - 7) + ' autre(s) point(s) — seuils réglables dans Administration' : 'Seuils réglables dans Administration' });

    // File du jour (timeline 7 h – 22 h)
    const H0 = 7, H1 = 22, span = H1 - H0, xp = h => ((Math.max(H0, Math.min(H1, h)) - H0) / span * 100);
    const nowH = LD.hourNow();
    const dl = `<div class="dayline"><div class="dl-hours">${Array.from({ length: span }, (_, i) => `<span>${H0 + i}h</span>`).join('')}</div>
      ${L.list.slice(0, 9).map(c => { const p = c.parts[0], st = S.status(c), h = S.hourOf(c), dur = S.duration(p, c);
        return `<div class="dl-row"><div class="dl-lbl">${UI.clientDot(c.client)}${u.esc(R.client(c.client).name)}</div><div class="dl-track"><div class="dl-blk ${st === 'terminee' ? 'done' : ''} ${st === 'pause' ? 'pause' : ''}" data-href="#/campagne/${c.id}" style="left:${xp(h)}%;width:${Math.max(3.2, xp(h + dur) - xp(h))}%;background:${R.channel(c.channel).color}" title="${u.esc(c.name + ' · ' + R.status(st).label + ' · ' + R.user(c.cdc).name)}">${LD.wf.H2(h)}</div><span class="dl-txt" style="${xp(h) > 62 ? 'right:calc(' + (100 - xp(h)).toFixed(2) + '% + 6px);text-align:right' : 'left:calc(' + (xp(h) + Math.max(3.2, xp(h + dur) - xp(h))).toFixed(2) + '% + 6px)'}"><b>${u.esc(c.name)}</b> · ${u.esc(R.status(st).label.toLowerCase())} · ${u.esc(R.user(c.cdc).name.split(' ')[0])}</span></div></div>`; }).join('')}
      ${nowH >= H0 && nowH <= H1 ? `<div class="dl-ov"><div class="dl-now" data-t="${LD.wf.H2(Math.floor(nowH * 4) / 4)}" style="left:${xp(nowH).toFixed(2)}%"></div></div>` : ''}</div>`;
    const dlCard = UI.card(`${UI.icon('clock')} File du jour <small>heure par heure · statut · chargé</small>`, L.list.length ? dl : '<div class="note">Aucun envoi programmé aujourd\'hui.</div>',
      { tools: `<div class="legend" style="margin:0">${R.channels.map(c => `<span><i style="background:${c.color}"></i>${c.short}</span>`).join('')}</div>` });

    // Volumes par jour, par canal
    const labs = series.map(x => u.fmtDateShort(x.d));
    const volCard = UI.card(`${UI.icon('chart')} Volumes délivrés par jour et par canal`, CH.bars({ labels: labs, stacked: true, height: 230, series: [
      { name: 'Email', data: series.map(x => x.a.email.delivered), color: '#233F93' }, { name: 'SMS', data: series.map(x => x.a.sms.delivered), color: '#00ADDA' }, { name: 'RCS', data: series.map(x => x.a.rcs.delivered), color: '#2BB6A3' }] }),
      { tools: `<small class="muted">${u.esc(S.periodLabel())}</small>`, foot: cur.camps + ' campagne(s) · ' + u.n(cur.sent) + ' messages envoyés · coût facturable estimé ' + UI.money(cur.cost) });

    // Charge des chargés (semaine en cours)
    const wStart = u.addDays(TODAY, -((u.dow(TODAY) + 6) % 7)), wEnd = u.addDays(wStart, 6), nwEnd = u.addDays(wEnd, 7);
    const load = R.cdcs().map(x => {
      const cs = S.scopeCamps(user).filter(c => c.cdc === x.id && S.status(c) !== 'annulee');
      const week = cs.filter(c => S.dateOf(c) >= TODAY && S.dateOf(c) <= wEnd), next = cs.filter(c => S.dateOf(c) > wEnd && S.dateOf(c) <= nwEnd);
      const prep = week.concat(next).filter(c => ['brouillon', 'bat', 'bat_ok', 'a_valider'].includes(S.status(c))).length;
      return { x, week: week.length, next: next.length, prep, cells: week.concat(next).map(c => S.status(c)) };
    });
    const loadCard = isC ? '' : UI.card(`${UI.icon('users')} Charge par chargé de campagne`, `<div class="load">${load.map(l => `<div class="load-i"><div>${UI.avatar(l.x.id, true)} <b style="font-weight:500">${u.esc(l.x.name)}</b></div><div class="load-cells">${l.cells.slice(0, 18).map(s => `<i class="${['brouillon', 'bat', 'bat_ok', 'a_valider'].includes(s) ? 'a' : ['validee', 'programmee'].includes(s) ? 'b' : 'v'}" title="${u.esc(R.status(s).label)}"></i>`).join('')}${Array.from({ length: Math.max(0, 12 - l.cells.length) }, () => '<i></i>').join('')}</div><div class="r"><b>${l.prep}</b> <small class="muted">à préparer</small></div></div>`).join('')}
      <div class="legend"><span><i style="background:#F59E0B"></i>À préparer (brouillon, BAT, validation)</span><span><i style="background:#233F93"></i>Validée / programmée</span><span><i style="background:#00ADDA"></i>En cours</span></div></div>`,
      { tools: `<small class="muted">semaine en cours et suivante · jusqu'au ${u.fmtDateShort(nwEnd)}</small>` });

    const batCard = isC ? (() => {
      const bats = S.scopeCamps(user).filter(c => S.status(c) === 'bat');
      const nxt = S.scopeCamps(user).filter(c => S.dateOf(c) > TODAY && S.status(c) !== 'annulee').slice(0, 5);
      return UI.card(`${UI.icon('eye')} BAT à valider <span class="badge b-orange">${bats.length}</span>`, bats.length ? bats.map(c => `<div class="att-i" data-href="#/campagne/${c.id}/bat"><div class="att-ic warn">${UI.icon('eye')}</div><div><b>${u.esc(c.name)}</b><small class="muted">${UI.chBadge(c.channel)} envoi prévu le ${u.fmtDate(S.dateOf(c))}</small></div><span class="btn sm primary">Voir le BAT</span></div>`).join('') : '<div class="alert ok">' + UI.icon('check') + '<div>Aucun BAT en attente.</div></div>', { foot: 'Prochains envois : ' + nxt.map(c => u.fmtDateShort(S.dateOf(c)) + ' ' + c.name).join(' · ') });
    })() : '';

    el.innerHTML = `${hero}${kpis}<div class="grid g2">${isC ? batCard : attCard}${dlCard}</div><div class="grid ${isC ? 'g1' : 'g2'}" style="${isC ? '' : 'grid-template-columns:1.4fr 1fr'}">${volCard}${loadCard}</div>`;
  }

  function live(el, user) {
    const L = liveNumbers(user);
    const set = (id, v) => { const e = document.getElementById(id); if (e && e.textContent !== v) { e.textContent = v; e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); } };
    set('live-sent', u.n(L.sent)); set('live-rate', u.n(L.rate)); set('live-nrun', String(L.nrun)); set('live-nprog', String(L.nprog)); set('live-ndone', String(L.ndone));
    document.querySelectorAll('#live-rows .sendrow').forEach(row => {
      const c = D.camps.find(x => x.id === row.dataset.cid); if (!c) return;
      const r = S.partRes(c, c.parts[0]);
      const f = row.querySelector('.sendbar-f'); if (f) f.style.width = (r.prog * 100).toFixed(1) + '%';
      const s = row.querySelector('[data-sent]'); if (s) { const v = u.n(r.sent) + ' routés'; if (s.textContent !== v) { s.textContent = v; s.classList.add('tick'); setTimeout(() => s.classList.remove('tick'), 600); } }
      const lb = row.querySelector('.sendbar-l span:last-child'), st = S.status(c);
      if (lb && st === 'en_cours') lb.textContent = u.pct(r.prog, 0);
    });
  }

  LD.views.dashboard = {
    title: (a, user) => user.kind === 'client' ? 'Accueil — ' + R.client(user.client).name : 'Tableau de bord',
    client: true, filters: { show: ['period', 'client', 'channel', 'cdc'] }, render, live
  };
})(window.LD);
