/* views/livraisons.js : livraisons de fichiers en clair et liste des commandes de fiches télémarketing.
 * #/livraisons/fichiers · #/livraisons/telemarketing · #/livraisons/nouvelle (formulaire de fichier) · #/livraisons/fichier/<id> (fiche de livraison)
 * #/livraisons/commande (nouvelle commande de fiches) · #/livraisons/commande/<id> (fiche de commande) : voir livraisons-tm.js
 * Règles : aucune livraison sans validation de la directrice ; pas de fiches télémarketing sans passage Bloctel < 30 j.
 */
(function (LD) {
  'use strict';
  const u = LD.u, UI = LD.ui, S = LD.store, R = LD.ref, W = LD.wf, D = LD.data;
  const fst = f => { const s = D.FST[S.fileStatus(f)]; return UI.badge(s[0], s[1]); };
  const tst = t => { const s = D.TST[S.tmStatus(t)]; return UI.badge(s[0], s[1]); };
  const FMT = { CSV: 'CSV (UTF-8, séparateur « ; »)', Excel: 'Excel (.xls)' };
  const SAMPLE = {
    'Civilité': ['Mme', 'M.'], 'Prénom': ['Camille', 'Julien'], 'Nom': ['D•••', 'M•••'], 'Email': ['c•••@exemple.fr', 'j•••@exemple.fr'], 'Mobile': ['06 •• •• 12 34', '07 •• •• 56 78'],
    'Téléphone': ['04 •• •• 12 34', '06 •• •• 56 78'], 'Code postal': ['69003', '33000'], "Tranche d'âge": ['35-49', '25-34'], "Date d'opt-in": ['12/03/2026', '02/07/2025'],
    'Source de collecte': ['Partenaire jeux-concours', 'Comparateur en ligne'], 'Adresse': ['12 rue •••', '4 avenue •••'], 'Ville': ['Lyon', 'Bordeaux']
  };
  const colsPreview = cols => `<div class="tbl-wrap cols-prev"><table class="tbl"><thead><tr>${cols.map(c => `<th>${u.esc(c)}</th>`).join('')}</tr></thead><tbody>${[0, 1].map(i => `<tr>${cols.map(c => `<td>${u.esc((SAMPLE[c] || ['—', '—'])[i])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const isDir = (user, cid) => user.kind === 'dir' && R.client(cid).dir === user.id;
  const first = cid => R.user(R.client(cid).dir).name.split(' ')[0];

  function fileActions(f, user, sz) {
    sz = sz || 'xs';
    if (S.isClient(user)) return S.fileStatus(f) === 'livree' ? `<button class="btn ${sz} primary" data-dl="${f.id}">${UI.icon('dl')}Télécharger</button>` : '';
    const s = S.fileStatus(f), b = [];
    if (s === 'preparation') b.push(`<button class="btn ${sz}" data-fa="submitFile" data-id="${f.id}">Soumettre à ${u.esc(first(f.client))}</button>`);
    if (s === 'a_valider') b.push(`<button class="btn ${sz} ${isDir(user, f.client) ? 'ok' : ''}" data-fa="validateFile" data-id="${f.id}">${UI.icon('check')}Valider</button>`);
    if (['preparation', 'a_valider', 'validee'].includes(s)) b.push(`<button class="btn ${sz} ${s === 'validee' ? 'primary' : ''}" data-fa="deliverFile" data-id="${f.id}">${UI.icon('send')}Livrer</button>`);
    return b.join(' ');
  }
  function tmActions(t, user, sz) {
    sz = sz || 'xs';
    const s = S.tmStatus(t), b = [];
    if (S.isClient(user)) return '';
    if (!W.bloctelOk(t) && s !== 'livree') b.push(`<button class="btn ${sz} warn" data-ta="runBloctel" data-id="${t.id}">${UI.icon('shield')}${sz === 'xs' ? 'Passer Bloctel' : 'Lancer le passage Bloctel (simulé)'}</button>`);
    if (s === 'preparation') b.push(`<button class="btn ${sz}" data-ta="submitTm" data-id="${t.id}">Soumettre à ${u.esc(first(t.client))}</button>`);
    if (s === 'a_valider') b.push(`<button class="btn ${sz} ${isDir(user, t.client) ? 'ok' : ''}" data-ta="validateTm" data-id="${t.id}">${UI.icon('check')}Valider</button>`);
    if (s !== 'livree') b.push(`<button class="btn ${sz} ${s === 'validee' ? 'primary' : ''}" data-ta="deliverTm" data-id="${t.id}">${UI.icon('send')}Livrer</button>`);
    if (s === 'livree' && !t.returns && sz === 'xs') b.push(`<a class="btn xs" href="#/livraisons/commande/${t.id}">Saisir les retours</a>`);
    return b.join(' ');
  }

  // ---------- Fiche de livraison de fichier ----------
  function filePage(el, f, user) {
    if (!f) { el.innerHTML = `<div class="alert risk">${UI.icon('lock')}<div><b>Livraison introuvable ou hors de votre périmètre.</b></div></div>`; return; }
    const cl = R.client(f.client), s = S.fileStatus(f), isC = S.isClient(user), val = W.fileValidator(f), so = LD.state().files[f.id] || {};
    const idx = { preparation: 0, a_valider: 1, validee: 2, livree: 4, expiree: 4 }[s];
    const dls = f.downloads.concat(S.journal().filter(j => j.target === f.id && /Téléchargement/.test(j.action)).map(j => ({ at: u.iso(new Date(j.t)), by: (R.user(j.user) || {}).name, ip: 'session de démo' })));
    const jr = S.journal().filter(j => j.target === f.id).slice().reverse();
    const deliveredAt = so.at || f.deliveredAt;
    el.innerHTML = `<div class="camp-head"><div style="min-width:0">
        <div class="note"><a href="#/livraisons/fichiers">${isC ? 'Fichiers livrés' : 'Livraisons de fichiers'}</a> › ${UI.clientDot(f.client)}${u.esc(cl.name)} › <span class="mono">${f.id}</span></div>
        <h2 style="margin-top:4px">${u.esc(f.label)} ${fst(f)} ${f.created ? '<span class="badge b-cyan">créée en démo</span>' : ''}</h2>
        <div class="meta"><span>Lignes <b>${u.n(f.volume)}</b> + <b>${f.seeds}</b> adresses témoins</span><span>Format <b>${u.esc(f.format)}</b></span><span>Usage <b>${f.usage.uses} utilisation(s) · ${f.usage.days} jours</b></span><span>Mode <b>${f.method === 'sftp' ? 'dépôt SFTP' : 'lien chiffré (7 jours)'}</b></span><span>Directrice <b>${u.esc(R.user(cl.dir).name)}</b></span></div>
        <div style="margin-top:12px;max-width:720px">${UI.steps(idx, ['Préparation', 'Validation directrice', 'Prête à livrer', 'Livrée'])}</div>
      </div><div class="camp-actions">${fileActions(f, user, 'sm')}</div></div>
      <div class="grid" style="grid-template-columns:1.35fr 1fr;align-items:start;margin-top:16px"><div style="display:flex;flex-direction:column;gap:16px">
      ${UI.card('Paramètres de la livraison', `<dl class="mini-kv"><dt>Client</dt><dd>${UI.clientDot(f.client)}${u.esc(cl.name)}</dd><dt>Type de fichier</dt><dd data-fv="kind">${u.esc(D.KINDS[f.kind])}</dd><dt>Contenu</dt><dd>${u.esc(f.label)}</dd><dt>Lignes livrées</dt><dd data-fv="volume">${u.n(f.volume)}</dd><dt>Adresses témoins</dt><dd data-fv="seeds">${f.seeds}</dd><dt>Format</dt><dd data-fv="format">${u.esc(FMT[f.format] || f.format)}</dd><dt>Colonnes (${f.columns.length})</dt><dd data-fv="columns">${f.columns.map(u.esc).join(', ')}</dd><dt>Usage autorisé</dt><dd data-fv="usage">${f.usage.uses} utilisation(s) · ${f.usage.days} jours</dd><dt>Mode de livraison</dt><dd data-fv="method">${f.method === 'sftp' ? 'Dépôt SFTP client' + (f.sftp ? ' · <span class="mono">' + u.esc(f.sftp) + '</span>' : '') : 'Lien chiffré, expiration 7 jours'} ${UI.sim()}</dd><dt>Expiration</dt><dd>${f.method === 'sftp' ? 'fichier retiré du serveur à J+7' : u.fmtDate(deliveredAt ? u.addDays(deliveredAt, 7) : f.expires)}</dd><dt>Rappel RGPD</dt><dd>${f.rgpd === false ? '<span class="badge b-orange">non joint</span>' : '<span class="badge b-green">joint à la livraison</span>'}</dd><dt>Montant</dt><dd>${UI.money(S.fileAmount(f), true)} HT <small class="muted">(${f.cpm} € le mille · ${LD.config.PRICE_NOTE})</small></dd><dt>Préparée par</dt><dd>${u.esc(R.user(f.by).name)} · ${u.fmtDate(f.date)}</dd><dt>Validée par</dt><dd>${val ? u.esc(R.user(val).name) : '<span class="badge b-orange">non validée</span>'}</dd><dt>Livrée le</dt><dd>${deliveredAt ? u.fmtDate(deliveredAt) : '—'}</dd></dl>`)}
      ${UI.card('Aperçu des colonnes livrées <small>2 lignes fictives, masquées</small>', colsPreview(f.columns))}
      </div><div style="display:flex;flex-direction:column;gap:16px">
      ${UI.card('Traçabilité des téléchargements', dls.length ? `<div class="checks">${dls.map(x => `<div class="chk ok"><span class="m">↓</span><span>${u.fmtDate(x.at)} · ${u.esc(x.by)} <small class="muted mono">${u.esc(x.ip)}</small></span></div>`).join('')}</div>` : '<div class="note">Aucun téléchargement.</div>')}
      <div class="alert warn" style="margin:0">${UI.icon('lock')}<div><b>Mot de passe du fichier envoyé séparément</b> (SMS au contact client désigné) ${UI.sim('simulé')}</div></div>
      <div class="alert info" style="margin:0">${UI.icon('info')}<div><b>Rappel RGPD remis au client :</b> usage limité à l'objet et à la durée prévus, pas de cession, suppression à l'issue, droits des personnes à relayer à LDS.</div></div>
      <div class="alert info" style="margin:0">${UI.icon('shield')}<div>Les ${f.seeds} adresses témoins permettent de détecter une réutilisation du fichier au-delà de l'usage contractuel.</div></div>
      ${isC ? '' : UI.card('Journal de la livraison', jr.length ? `<div class="timeline">${jr.map(j => `<div class="tl-i"><div class="tl-d"></div><div><b style="font-weight:500">${u.esc(j.action)}</b><small class="muted">${u.fmtDateTime(new Date(j.t)).slice(0, 16)} · ${u.esc((R.user(j.user) || {}).name || '—')}</small></div></div>`).join('')}</div>` : '<div class="note">Livraison issue de l\'historique : actions antérieures à la maquette.</div>')}
      </div></div>`;
    bindActions(el, user);
  }

  // ---------- Formulaire de livraison de fichier (tous les choix sont enregistrés) ----------
  let nf = null;
  function nfDefault(user) { const cl = S.scopeClients(user)[0]; return { client: cl.id, kind: 'email', segment: '', volume: 50000, columns: D.COLS.email.slice(0, 6), format: 'CSV', days: 30, uses: 1, seeds: 10, method: 'lien', sftp: '', rgpd: true }; }
  const KSHARE = { email: 1, mobile: 0.61, postal: 0.83 };
  function newForm(el, user) {
    nf = nf || nfDefault(user);
    const cls = S.scopeClients(user), cl = R.client(nf.client), segs = D.segments.filter(s => s.client === nf.client), key = W.KEYCOL[nf.kind];
    if (!segs.find(s => s.id === nf.segment)) nf.segment = segs[0] ? segs[0].id : '';
    const seg = segs.find(s => s.id === nf.segment), avail = seg ? Math.round(seg.count * KSHARE[nf.kind] / 100) * 100 : 0;
    const sel = (k, opts) => `<select data-nf="${k}">${opts.map(o => `<option value="${o[0]}" ${String(o[0]) === String(nf[k]) ? 'selected' : ''}>${u.esc(o[1])}</option>`).join('')}</select>`;
    const vh = () => nf.volume > avail ? '<b style="color:var(--red)">supérieur au disponible (' + u.n(avail) + ')</b>' : 'disponible après exclusions : ' + u.n(avail);
    el.innerHTML = `<div class="grid" style="grid-template-columns:1.4fr 1fr;align-items:start">${UI.card('Préparer une livraison de fichier', `<div class="form-g">
      <div class="fld"><label>Client</label>${sel('client', cls.map(c => [c.id, c.name]))}<span class="help">Validation : ${u.esc(R.user(cl.dir).name)}</span></div>
      <div class="fld"><label>Type de fichier</label>${sel('kind', Object.keys(D.KINDS).map(k => [k, D.KINDS[k]]))}<span class="help">Les colonnes proposées changent avec le type</span></div>
      <div class="fld"><label>Segment (base de contacts virtuelle)</label>${sel('segment', segs.map(s => [s.id, s.label + ' · ' + u.n(s.count)]))}<span class="help">${UI.sim('comptage simulé')}</span></div>
      <div class="fld"><label>Volume (lignes)</label><input type="number" data-nf="volume" value="${nf.volume}" step="1000" min="1000"><span class="help" id="nf-vh">${vh()}</span></div>
      <div class="fld full"><span class="lbl">Colonnes livrées · ${u.esc(D.KINDS[nf.kind].toLowerCase())}</span><div class="chips">${D.COLS[nf.kind].map(c => `<button class="chip ${nf.columns.includes(c) ? 'on' : ''}" data-col="${u.esc(c)}" ${c === key ? 'title="Colonne obligatoire pour ce type de fichier"' : ''}>${u.esc(c)}${c === key ? ' · obligatoire' : ''}</button>`).join('')}</div></div>
      <div class="fld"><label>Format</label>${sel('format', [['CSV', FMT.CSV], ['Excel', FMT.Excel]])}</div>
      <div class="fld"><label>Adresses témoins (seeds)</label><input type="number" data-nf="seeds" value="${nf.seeds}" min="0" max="50"></div>
      <div class="fld"><label>Durée d'usage autorisée</label>${sel('days', [[30, '30 jours'], [60, '60 jours'], [90, '90 jours']])}</div>
      <div class="fld"><label>Nombre d'utilisations autorisées</label>${sel('uses', [[1, '1 utilisation'], [2, '2 utilisations'], [3, '3 utilisations']])}</div>
      <div class="fld"><label>Mode de livraison</label>${sel('method', [['lien', 'Lien chiffré, expiration 7 jours'], ['sftp', 'Dépôt SFTP client']])}<span class="help">Mot de passe envoyé séparément au contact client (SMS)</span></div>
      ${nf.method === 'sftp' ? `<div class="fld"><label>Serveur SFTP du client</label><input data-nf="sftp" value="${u.esc(nf.sftp)}"><span class="help">Identifiants fournis par le client ${UI.sim('simulé')}</span></div>` : '<div></div>'}
      <div class="fld full"><label><input type="checkbox" data-nf="rgpd" ${nf.rgpd ? 'checked' : ''} style="width:auto"> Joindre le rappel des obligations RGPD (usage, durée, interdiction de cession, suppression)</label></div></div>`,
      { foot: `<div class="split"><button class="btn primary" id="nf-ok">${UI.icon('plus')}Créer en préparation</button><span class="note">Tous les paramètres sont enregistrés dans la fiche de livraison. Livraison bloquée tant que ${u.esc(R.user(cl.dir).name)} ne l'a pas validée.</span></div>` })}
      <div style="display:flex;flex-direction:column;gap:16px">${UI.card('Aperçu des colonnes livrées <small>' + nf.columns.length + ' colonnes · données fictives</small>', colsPreview(D.COLS[nf.kind].filter(c => nf.columns.includes(c))))}
      ${UI.card('Exclusions appliquées', `<div class="checks"><div class="chk ok"><span class="m">✓</span><span>Désinscrits et STOP</span></div><div class="chk ok"><span class="m">✓</span><span>Repoussoir de ${u.esc(cl.name)} (${u.n(D.repous[cl.id].rows)} lignes)</span></div><div class="chk ok"><span class="m">✓</span><span>Contacts déjà livrés à ce client sur 12 mois</span></div><div class="chk ok"><span class="m">✓</span><span>Blacklist</span></div></div><div class="note" style="margin-top:10px">Comptages et extraction sur la base de contacts virtuelle ${UI.sim('simulée — branchement reporté')}</div>`)}
      ${UI.card('Circuit', UI.steps(0, ['Préparation', 'Validation directrice', 'Prête à livrer', 'Livrée']) + '<div class="note" style="margin-top:12px">Livraison simulée : aucun fichier ne quitte la maquette.</div>')}</div></div>`;
    el.querySelectorAll('[data-nf]').forEach(x => x.addEventListener(x.tagName === 'SELECT' || x.type === 'checkbox' ? 'change' : 'input', () => {
      const k = x.dataset.nf; nf[k] = x.type === 'checkbox' ? x.checked : (x.type === 'number' || k === 'days' || k === 'uses') ? +x.value : x.value;
      if (k === 'kind') nf.columns = D.COLS[nf.kind].slice(0, 6);
      if ((k === 'method' || k === 'client') && nf.method === 'sftp' && (!nf.sftp || k === 'client')) nf.sftp = 'sftp.' + nf.client + '-demo.example';
      if (['client', 'kind', 'method', 'segment'].includes(k)) newForm(el, user);
      else if (k === 'volume') el.querySelector('#nf-vh').innerHTML = vh();
    }));
    el.querySelectorAll('[data-col]').forEach(b => b.onclick = () => {
      const c = b.dataset.col; if (c === key) { UI.toast('La colonne « ' + u.esc(key) + ' » est obligatoire pour ce type de fichier', 'warn'); return; }
      nf.columns = nf.columns.includes(c) ? nf.columns.filter(x => x !== c) : D.COLS[nf.kind].filter(x => x === c || nf.columns.includes(x)); newForm(el, user);
    });
    el.querySelector('#nf-ok').onclick = () => {
      if (nf.volume > avail) { UI.toast(UI.icon('alert') + ' <b>Volume supérieur au disponible</b> (' + u.n(avail) + ')', 'err'); return; }
      const r = W.createFile(Object.assign({}, nf, { segLabel: seg ? seg.label : '' }), user);
      if (UI.result(r)) { nf = null; location.hash = '#/livraisons/fichier/' + r.id; }
    };
  }

  function bindActions(el, user) {
    el.querySelectorAll('[data-fa]').forEach(b => b.onclick = e => { e.stopPropagation(); const f = D.files.find(x => x.id === b.dataset.id); if (UI.result(W[b.dataset.fa](f, user))) LD.app.renderView(); });
    el.querySelectorAll('[data-ta]').forEach(b => b.onclick = e => { e.stopPropagation(); const t = D.tm.find(x => x.id === b.dataset.id); if (UI.result(W[b.dataset.ta](t, user))) LD.app.renderView(); });
    el.querySelectorAll('[data-dl]').forEach(b => b.onclick = e => { e.stopPropagation(); const f = D.files.find(x => x.id === b.dataset.dl); const r = W.download(f, user); if (UI.result(r)) { const xl = /excel|xls/i.test(f.format || ''); LD.exporter[xl ? 'excel' : 'csv']({ title: 'Livraison ' + f.id, columns: f.columns, rows: [1, 2, 3, 4, 5].map(i => f.columns.map(() => '(fictif ' + i + ')')), meta: ['Fichier de démonstration au format ' + (xl ? 'Excel' : 'CSV') + ' — aucune donnée personnelle'] }); } });
  }

  function render(el, arg, user) {
    const isC = S.isClient(user), [a0, a1] = (arg || '').split('/');
    if (a0 === 'fichier') return filePage(el, S.scopeFiles(user).find(f => f.id === a1), user);
    if (!isC && a0 === 'nouvelle') return newForm(el, user);
    if (!isC && a0 === 'commande') return a1 ? LD.tmViews.page(el, a1, user) : LD.tmViews.form(el, user);
    const tab = isC ? 'fichiers' : (a0 === 'telemarketing' ? 'telemarketing' : 'fichiers');
    const btnF = `<a class="btn sm ${tab === 'fichiers' ? 'primary' : ''}" href="#/livraisons/nouvelle">${UI.icon('plus')}Nouvelle livraison de fichier</a>`, btnT = `<a class="btn sm ${tab === 'telemarketing' ? 'primary' : ''}" href="#/livraisons/commande">${UI.icon('plus')}Commander des fiches télémarketing</a>`;
    const nav = isC ? '' : `<div class="tabs">${[['fichiers', 'Fichiers en clair'], ['telemarketing', 'Fiches télémarketing']].map(t => `<a class="tab ${t[0] === tab ? 'on' : ''}" href="#/livraisons/${t[0]}">${t[1]}</a>`).join('')}<span class="spacer"></span><div class="split" style="margin-bottom:6px">${tab === 'fichiers' ? btnT + btnF : btnF + btnT}</div></div>`;
    const fc = S.filters.client;
    if (tab === 'telemarketing') {
      const tms = S.scopeTm(user).filter(t => !fc || t.client === fc);
      const tt = UI.table({ title: 'Fiches télémarketing', columns: ['Commande', 'Client', 'Contenu', { label: 'Fiches', align: 'r' }, 'Centre d\'appels', 'Bloctel', 'Statut', 'Retours', ''], rows: tms, rowAttr: t => `data-href="#/livraisons/commande/${t.id}" style="cursor:pointer"`,
        render: t => { const bd = W.bloctelDate(t), ok = W.bloctelOk(t), r = t.returns; return [`<b class="mono">${t.id}</b><span class="sub">${u.fmtDate(t.date)}</span>`, UI.clientDot(t.client) + u.esc(R.client(t.client).name), u.esc(t.label) + (t.created ? ' <span class="badge b-cyan">démo</span>' : '') + `<span class="sub">${t.fields.length} champs · exclus : ${u.n(t.excluded.already)} déjà livrés, ${u.n(t.excluded.repous)} repoussoir</span>`, u.n(t.volume), u.esc(t.center), !bd ? '<span class="badge b-red">aucun passage</span>' : S.tmStatus(t) === 'livree' ? `<span class="badge b-grey">${u.fmtDate(bd)}</span><span class="sub">avant livraison · ${u.n(W.bloctelRemoved(t))} retirés</span>` : ok ? `<span class="badge b-green">${u.fmtDate(bd)}</span><span class="sub">${u.n(W.bloctelRemoved(t))} numéros retirés</span>` : `<span class="badge b-red">${u.fmtDate(bd)} · > ${W.BLOCTEL_DAYS} j</span>`, tst(t), r ? `${u.n(r.joints)} joints · <b>${u.n(r.accords)}</b> accords<span class="sub">${u.pct(r.joints ? r.accords / r.joints : null, 1)} de transformation</span>` : '—', tmActions(t, user)]; },
        raw: t => [t.id, R.client(t.client).name, t.label, t.volume, t.center, W.bloctelDate(t) || 'aucun', D.TST[S.tmStatus(t)][0], t.returns ? t.returns.accords : ''] });
      const blocked = tms.filter(t => !W.bloctelOk(t) && S.tmStatus(t) !== 'livree'), wr = tms.filter(t => t.returns);
      el.innerHTML = nav + `<div class="grid g4" style="margin-top:16px">${UI.kpi({ label: 'Commandes', value: String(tms.length), sub: u.n(u.sum(tms, t => t.volume)) + ' fiches' })}${UI.kpi({ label: 'Bloquées Bloctel', value: String(blocked.length), cls: blocked.length ? 'risk' : '', sub: 'aucun passage ou passage de plus de ' + W.BLOCTEL_DAYS + ' jours' })}${UI.kpi({ label: 'Contacts joints', value: u.n(u.sum(wr, t => t.returns.joints)), sub: 'retours des centres d\'appels' })}${UI.kpi({ label: 'Accords', value: u.n(u.sum(wr, t => t.returns.accords)), sub: u.pct(u.sum(wr, t => t.returns.accords) / Math.max(1, u.sum(wr, t => t.returns.joints)), 1) + ' des joints' })}</div>
        <div class="alert warn">${UI.icon('shield')}<div><b>Aucune fiche télémarketing ne part sans passage Bloctel de moins de ${W.BLOCTEL_DAYS} jours</b> ni sans validation de la directrice de clientèle. Bouton « Livrer » bloqué sinon. ${UI.legal()} · API Bloctel ${UI.sim()}</div></div>
        ${UI.card('Commandes de fiches télémarketing <small>cliquez une ligne pour ouvrir la fiche de commande</small>', tt.html, { tools: tt.tools })}`;
    } else {
      const fs = S.scopeFiles(user).filter(f => !fc || f.client === fc);
      const tf = UI.table({ title: 'Livraisons de fichiers', columns: ['Livraison', 'Client', 'Contenu', { label: 'Lignes', align: 'r' }, 'Format · usage', 'Mode', 'Validation', 'Statut', 'Téléchargements', ''], rows: fs, rowAttr: f => `data-href="#/livraisons/fichier/${f.id}" style="cursor:pointer"`,
        render: f => { const v = W.fileValidator(f); return [`<b class="mono">${f.id}</b><span class="sub">${u.fmtDate(f.date)}</span>`, UI.clientDot(f.client) + u.esc(R.client(f.client).name), u.esc(f.label) + (f.created ? ' <span class="badge b-cyan">démo</span>' : '') + `<span class="sub">${f.columns.length} colonnes · ${f.seeds} témoins</span>`, u.n(f.volume), f.format + `<span class="sub">${f.usage.uses} usage(s) · ${f.usage.days} j</span>`, f.method === 'sftp' ? 'SFTP' : 'Lien chiffré', v ? u.esc(R.user(v).name) : '<span class="muted">—</span>', fst(f), f.downloads.length ? f.downloads.length + ' · dernier ' + u.fmtDateShort(f.downloads[f.downloads.length - 1].at) : '—', fileActions(f, user)]; },
        raw: f => [f.id, R.client(f.client).name, f.label, f.volume, f.format, f.method, f.usage.uses, f.usage.days, D.FST[S.fileStatus(f)][0], f.downloads.length] });
      el.innerHTML = nav + `<div class="grid g4" style="margin-top:${isC ? 0 : 16}px">${UI.kpi({ label: isC ? 'Fichiers livrés' : 'Livraisons', value: String(fs.length), sub: u.n(u.sum(fs, f => f.volume)) + ' lignes' })}${UI.kpi({ label: 'À valider', value: String(fs.filter(f => S.fileStatus(f) === 'a_valider').length), sub: 'par la directrice du compte' })}${UI.kpi({ label: 'Livrées', value: String(fs.filter(f => ['livree', 'expiree'].includes(S.fileStatus(f))).length), sub: u.sum(fs, f => f.downloads.length) + ' téléchargements tracés' })}${UI.kpi({ label: 'Montant livré', value: UI.money(u.sum(fs.filter(f => ['livree', 'expiree'].includes(S.fileStatus(f))), S.fileAmount)), sub: 'HT · ' + LD.config.PRICE_NOTE })}</div>
        ${isC ? `<div class="alert info">${UI.icon('lock')}<div>Vos fichiers livrés. Chaque téléchargement est tracé (date, utilisateur, adresse IP).</div></div>` : `<div class="alert info">${UI.icon('shield')}<div><b>Aucune livraison sans validation de la directrice de clientèle.</b> Lien chiffré expirant à 7 jours ou dépôt SFTP, adresses témoins (seeds) et traçabilité des téléchargements.</div></div>`}
        ${UI.card('Livraisons de fichiers en clair <small>cliquez une ligne pour ouvrir la fiche</small>', tf.html, { tools: tf.tools })}`;
    }
    bindActions(el, user);
  }
  const sub = () => (LD.app && LD.app.parseHash ? LD.app.parseHash().arg : '') || '';
  LD.views.livraisons = {
    title: (a, user) => { const [a0, a1] = (a || '').split('/'); if (a0 === 'fichier') return 'Livraison ' + (a1 || ''); if (a0 === 'nouvelle') return 'Nouvelle livraison de fichier'; if (a0 === 'commande') return a1 ? 'Commande de fiches ' + a1 : 'Commande de fiches télémarketing'; return user.kind === 'client' ? 'Fichiers livrés' : 'Livraisons de fichiers'; },
    client: true, filters: () => /^(fichier|nouvelle|commande)/.test(sub()) ? false : { show: ['client'], noExport: true }, render
  };
  LD.livraisons = { bindActions, tmActions, colsPreview, tst, resetForm: () => { nf = null; } };
})(window.LD);
