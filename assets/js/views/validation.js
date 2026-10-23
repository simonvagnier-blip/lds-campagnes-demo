/* views/validation.js : file de validation (directrice : ses comptes uniquement) et suivi des BAT. */
(function (LD) {
  'use strict';
  const u = LD.u, UI = LD.ui, S = LD.store, R = LD.ref, W = LD.wf, TODAY = LD.TODAY;

  function render(el, arg, user) {
    const all = S.filteredCamps(null, { ignoreStatus: true }).filter(c => S.status(c) === 'a_valider').sort((a, b) => S.dateOf(a).localeCompare(S.dateOf(b)));
    const mine = all.filter(c => W.canValidate(user, c)), others = all.filter(c => !W.canValidate(user, c));
    const files = S.scopeFiles(user).filter(f => S.fileStatus(f) === 'a_valider'), tms = S.scopeTm(user).filter(t => S.tmStatus(t) === 'a_valider');
    const row = (c, can) => {
      const k = W.contentCheck(Object.assign({}, c, { content: LD.content.forCamp(c) })), d = u.diffDays(TODAY, S.dateOf(c)), b = S.billing(c);
      return `<div class="card" style="box-shadow:none"><div class="card-b" style="display:grid;grid-template-columns:minmax(0,1.6fr) 1fr 1fr auto;gap:18px;align-items:center;padding:14px 18px">
        <div style="min-width:0"><div class="note">${UI.clientDot(c.client)}${u.esc(R.client(c.client).name)} · <span class="mono">${c.id}</span></div><b style="font-size:14px;color:var(--navy)"><a href="#/campagne/${c.id}">${u.esc(c.name)}</a></b> ${UI.chBadge(c.channel)}<div class="note">Préparée par ${u.esc(R.user(c.cdc).name)} · BAT validé par le client</div></div>
        <div><div class="kpi-l">Envoi</div><b>${u.fmtDate(S.dateOf(c))} · ${W.H2(S.hourOf(c))}</b><div>${d <= 2 ? '<span class="badge b-red">dans ' + d + ' j — urgent</span>' : '<span class="badge b-grey">dans ' + d + ' j</span>'}</div></div>
        <div><div class="kpi-l">Volume · montant estimé</div><b>${u.n(c.volume)}</b> · ${UI.money(b.amount)}<div class="note">${k.ok ? '✓ mentions obligatoires' : '✕ mentions manquantes'}</div></div>
        <div class="split">${can ? `<button class="btn ok" data-v="${c.id}">${UI.icon('check')}Valider</button><button class="btn warn" data-r="${c.id}">Renvoyer</button>` : `<span class="badge b-grey" title="Seule la directrice du compte valide">Validation : ${u.esc(R.user(R.client(c.client).dir).name)}</span>`}<a class="btn" href="#/campagne/${c.id}/contenu">Voir</a></div></div></div>`;
    };
    const bats = S.filteredCamps(null, { ignoreStatus: true }).filter(c => S.status(c) === 'bat').sort((a, b) => S.dateOf(a).localeCompare(S.dateOf(b)));
    const tb = UI.table({ title: 'BAT en attente du client', columns: ['Envoi', 'Client', 'Campagne', 'Canal', 'Version', 'Attente', 'Chargé'], rows: bats, rowAttr: c => `data-href="#/campagne/${c.id}/bat"`,
      render: c => { const d = u.diffDays(TODAY, S.dateOf(c)); return [u.fmtDate(S.dateOf(c)) + (d <= 2 ? ' <span class="badge b-red">J-' + d + '</span>' : ''), UI.clientDot(c.client) + u.esc(R.client(c.client).name), `<b>${u.esc(c.name)}</b>`, UI.chBadge(c.channel), 'v' + ((LD.state().ov[c.id] || {}).batV || 1), d <= 2 ? '<span class="badge b-red">relancer le client</span>' : '<span class="badge b-orange">en attente</span>', u.esc(R.user(c.cdc).name)]; },
      raw: c => [S.dateOf(c), R.client(c.client).name, c.name, R.channel(c.channel).label, R.user(c.cdc).name] });
    el.innerHTML = `<div class="grid g4">
        ${UI.kpi({ label: user.kind === 'dir' ? 'À valider par vous' : 'Campagnes à valider', value: String(user.kind === 'dir' ? mine.length : all.length), sub: user.kind === 'dir' ? 'vos ' + R.clients.filter(c => c.dir === user.id).length + ' comptes' : 'par les directrices de clientèle', cls: mine.length ? 'warn' : '' })}
        ${UI.kpi({ label: 'Urgentes (envoi ≤ 2 jours)', value: String(all.filter(c => u.diffDays(TODAY, S.dateOf(c)) <= 2).length), sub: 'à traiter en priorité' })}
        ${UI.kpi({ label: 'BAT en attente du client', value: String(bats.length), sub: bats.filter(c => u.diffDays(TODAY, S.dateOf(c)) <= 2).length + ' à J-2 ou moins' })}
        ${UI.kpi({ label: 'Livraisons à valider', value: String(files.length + tms.length), sub: files.length + ' fichier(s) · ' + tms.length + ' commande(s) télémarketing' })}</div>
      ${user.kind === 'dir' ? `<div class="alert info">${UI.icon('lock')}<div>Vous validez uniquement les campagnes et livraisons de <b>vos comptes</b> : ${R.clients.filter(c => c.dir === user.id).map(c => u.esc(c.name)).join(', ')}. Les autres sont visibles, sans bouton de validation.</div></div>` : `<div class="alert info">${UI.icon('info')}<div>Seule la directrice de clientèle du compte peut valider une campagne ou une livraison. ${user.kind === 'admin' ? 'L\'administrateur paramètre, il ne valide pas.' : ''}</div></div>`}
      ${UI.card(`${UI.icon('check')} ${user.kind === 'dir' ? 'À valider par vous' : 'En attente de validation'} <span class="badge b-orange">${(user.kind === 'dir' ? mine : all).length}</span>`, `<div style="display:flex;flex-direction:column;gap:10px">${(user.kind === 'dir' ? mine : all).map(c => row(c, W.canValidate(user, c))).join('') || '<div class="alert ok">' + UI.icon('check') + '<div>Rien à valider.</div></div>'}</div>`)}
      ${user.kind === 'dir' && others.length ? UI.card(`Autres comptes (validation par l'autre directrice) <span class="badge b-grey">${others.length}</span>`, `<div style="display:flex;flex-direction:column;gap:10px">${others.map(c => row(c, false)).join('')}</div>`) : ''}
      ${files.length + tms.length ? UI.card(`${UI.icon('box')} Livraisons à valider`, `<div class="checks">${files.map(f => `<div class="chk wa"><span class="m">!</span><span><a href="#/livraisons/fichiers">${f.id}</a> · ${u.esc(R.client(f.client).name)} · ${u.esc(f.label)} · ${u.n(f.volume)} lignes</span></div>`).concat(tms.map(t => `<div class="chk wa"><span class="m">!</span><span><a href="#/livraisons/telemarketing">${t.id}</a> · ${u.esc(R.client(t.client).name)} · fiches télémarketing · ${u.n(t.volume)} fiches</span></div>`)).join('')}</div>`) : ''}
      ${UI.card(`${UI.icon('eye')} BAT en attente du client`, tb.html, { tools: tb.tools })}`;
    el.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { if (UI.result(W.validate(S.getCamp(b.dataset.v), user))) { LD.app.renderView(); } });
    el.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { if (UI.result(W.reject(S.getCamp(b.dataset.r), user, 'à reprendre'))) LD.app.renderView(); });
  }
  LD.views.validation = { title: 'À valider', filters: { show: ['client', 'channel', 'cdc'], noExport: true }, render };

  // Vue « BAT » (client : ses BAT ; équipes : suivi)
  LD.views.bat = {
    title: (a, user) => user.kind === 'client' ? 'BAT à valider' : 'BAT', client: true, filters: { show: ['client', 'channel', 'cdc'], noExport: true },
    render(el, arg, user) {
      const list = S.filteredCamps(null, { ignoreStatus: true }).filter(c => ['bat', 'bat_ok', 'brouillon'].includes(S.status(c)) || (S.status(c) !== 'annulee' && S.dateOf(c) >= TODAY && user.kind === 'client'));
      const wait = list.filter(c => S.status(c) === 'bat');
      const t = UI.table({ title: 'BAT', columns: ['Envoi', 'Client', 'Campagne', 'Canal', 'Statut', ''], rows: list.sort((a, b) => S.dateOf(a).localeCompare(S.dateOf(b))), rowAttr: c => `data-href="#/campagne/${c.id}/bat"`,
        render: c => [u.fmtDate(S.dateOf(c)), UI.clientDot(c.client) + u.esc(R.client(c.client).name), `<b>${u.esc(c.name)}</b>`, UI.chBadge(c.channel), UI.statusBadge(c), S.status(c) === 'bat' ? `<a class="btn xs primary" href="#/campagne/${c.id}/bat">${user.kind === 'client' ? 'Valider ou commenter' : 'Voir le BAT'}</a>` : ''],
        raw: c => [S.dateOf(c), R.client(c.client).name, c.name, R.channel(c.channel).label, R.status(S.status(c)).label] });
      el.innerHTML = `<div class="grid g3">${UI.kpi({ label: 'BAT en attente de validation', value: String(wait.length), cls: wait.length ? 'warn' : '', sub: user.kind === 'client' ? 'votre validation est attendue' : 'côté client' })}${UI.kpi({ label: 'Validés, en attente de validation interne', value: String(list.filter(c => S.status(c) === 'bat_ok').length), sub: 'BAT validé par le client' })}${UI.kpi({ label: 'Brouillons (BAT à préparer)', value: String(list.filter(c => S.status(c) === 'brouillon').length), sub: 'côté LDS' })}</div>
        ${user.kind === 'client' ? `<div class="alert info">${UI.icon('lock')}<div>Espace en lecture seule. Votre seule action possible : <b>valider ou commenter un BAT</b>. Chaque action est tracée.</div></div>` : ''}
        ${UI.card('BAT et campagnes à venir', t.html, { tools: t.tools })}`;
    }
  };
})(window.LD);
