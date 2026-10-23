/* views/livraisons-tm.js : commande de fiches télémarketing (matrice 12.1 à 12.3).
 * #/livraisons/commande : formulaire (client, ciblage, volume avec comptage simulé, champs, centre d'appels, exclusions)
 * #/livraisons/commande/<id> : fiche de commande — passage Bloctel, validation de la directrice, livraison, retours d'appels.
 */
(function (LD) {
  'use strict';
  const u = LD.u, UI = LD.ui, S = LD.store, R = LD.ref, W = LD.wf, D = LD.data, TODAY = LD.TODAY;
  const AGES = ['25-34 ans', '35-49 ans', '50-64 ans', '65 ans et +'];
  const ZONES = [['fr', 'France entière', 1], ['idf', 'Île-de-France', 0.19], ['ara', 'Auvergne-Rhône-Alpes', 0.12], ['hdf', 'Hauts-de-France', 0.09], ['occ', 'Occitanie', 0.09], ['paca', 'Provence-Alpes-Côte d\'Azur', 0.08], ['naq', 'Nouvelle-Aquitaine', 0.09]];
  const EXTRA = [['Propriétaires', 0.58], ['CSP+', 0.31], ['Foyers avec enfants', 0.42], ['Retraités', 0.27], ['Intérêt assurance / prévoyance', 0.22]];
  const FIELDS = ['Civilité', 'Nom', 'Prénom', 'Téléphone', 'Adresse', 'Code postal', 'Ville', 'Tranche d\'âge', 'Email'];
  const AGE_SHARE = { '25-34 ans': 0.2, '35-49 ans': 0.29, '50-64 ans': 0.27, '65 ans et +': 0.24 };
  const PRICE = 0.25; // € par fiche — grille à brancher

  // Comptage simulé et déterministe : base téléphonique virtuelle × critères, puis exclusions
  function count(o) {
    const phones = Math.round(D.base.mobile * 0.74);
    const ages = o.ages.length ? u.sum(o.ages, a => AGE_SHARE[a]) : 1, zone = (ZONES.find(z => z[0] === o.zone) || ZONES[0])[2];
    const extra = o.extra.reduce((m, x) => m * ((EXTRA.find(e => e[0] === x) || [0, 1])[1]), 1);
    const raw = Math.round(phones * ages * zone * extra / 100) * 100;
    const prev = u.sum(D.tm.filter(t => t.client === o.client && S.tmStatus(t) === 'livree'), t => t.volume);
    const already = Math.round(Math.min(raw * 0.35, prev * 0.6 + raw * 0.015));
    const repous = Math.round(raw * Math.min(0.12, D.repous[o.client].rows / D.base.mobile * 3));
    const optout = Math.round(raw * 0.011);
    const available = Math.max(0, raw - (o.excl.already ? already : 0) - (o.excl.repous ? repous : 0) - optout);
    return { raw, already, repous, optout, available };
  }
  function funnel(rows) {
    const max = rows[0][1] || 1;
    return `<div class="funnel">${rows.map(r => `<div class="fn-row"><span>${u.esc(r[0])}</span><div><div class="fn-bar" style="width:${Math.max(0.6, r[1] / max * 100).toFixed(1)}%;${r[3] ? 'background:' + r[3] : ''}"></div></div><span class="v">${u.n(r[1])}</span><span class="p">${r[2] || ''}</span></div>`).join('')}</div>`;
  }

  // ---------- Formulaire de commande ----------
  let fo = null;
  function foDefault(user) {
    const cls = S.scopeClients(user), cl = cls.find(c => ['banque', 'assur', 'mutu', 'telco', 'auto'].includes(c.sector)) || cls[0];
    return { client: cl.id, label: '', ages: ['35-49 ans', '50-64 ans'], zone: 'fr', extra: ['Propriétaires'], volume: 8000, fields: FIELDS.slice(0, 7), center: D.CENTERS[0], centerContact: 'plateau@prestataire-a-demo.example', wanted: u.addDays(TODAY, 7), excl: { already: true, repous: true } };
  }
  function crit(o) { return o.ages.concat([(ZONES.find(z => z[0] === o.zone) || ZONES[0])[1]], o.extra); }
  function form(el, user) {
    fo = fo || foDefault(user);
    const cls = S.scopeClients(user), cl = R.client(fo.client), k = count(fo), over = fo.volume > k.available;
    const chip = (grp, v, on) => `<button class="chip ${on ? 'on' : ''}" data-tg="${grp}" data-v="${u.esc(v)}">${u.esc(v)}${grp === 'fields' && v === 'Téléphone' ? ' · obligatoire' : ''}</button>`;
    el.innerHTML = `<div class="grid" style="grid-template-columns:1.4fr 1fr;align-items:start">${UI.card('Commander des fiches télémarketing', `<div class="form-g">
      <div class="fld"><label>Client</label><select data-fo="client">${cls.map(c => `<option value="${c.id}" ${c.id === fo.client ? 'selected' : ''}>${u.esc(c.name)}</option>`).join('')}</select><span class="help">Validation : ${u.esc(R.user(cl.dir).name)}</span></div>
      <div class="fld"><label>Intitulé de la commande</label><input data-fo="label" value="${u.esc(fo.label)}" placeholder="ex. Prospects prévoyance 35-64 ans"></div>
      <div class="fld full"><span class="lbl">Ciblage · tranches d'âge</span><div class="chips">${AGES.map(a => chip('ages', a, fo.ages.includes(a))).join('')}</div></div>
      <div class="fld"><label>Zone géographique</label><select data-fo="zone">${ZONES.map(z => `<option value="${z[0]}" ${z[0] === fo.zone ? 'selected' : ''}>${u.esc(z[1])}</option>`).join('')}</select></div>
      <div class="fld"><label>Date de livraison souhaitée</label><input type="date" data-fo="wanted" value="${fo.wanted}" min="${TODAY}"></div>
      <div class="fld full"><span class="lbl">Ciblage · critères complémentaires</span><div class="chips">${EXTRA.map(e => chip('extra', e[0], fo.extra.includes(e[0]))).join('')}</div></div>
      <div class="fld"><label>Nombre de fiches demandé</label><input type="number" data-fo="volume" value="${fo.volume}" step="500" min="500"><span class="help" id="fo-vh">${over ? '<b style="color:var(--red)">supérieur aux fiches disponibles (' + u.n(k.available) + ')</b>' : 'disponibles après exclusions : <b>' + u.n(k.available) + '</b>'}</span></div>
      <div class="fld"><label>Prix à la fiche</label><input value="${u.dec(PRICE, 2)} € · ${u.esc(LD.config.PRICE_NOTE)}" disabled><span class="help">Montant estimé : <b id="fo-amt">${UI.money(fo.volume * PRICE)}</b> HT</span></div>
      <div class="fld full"><span class="lbl">Champs livrés</span><div class="chips">${FIELDS.map(f => chip('fields', f, fo.fields.includes(f))).join('')}</div></div>
      <div class="fld"><label>Centre d'appels destinataire</label><select data-fo="center">${D.CENTERS.map(c => `<option ${c === fo.center ? 'selected' : ''}>${u.esc(c)}</option>`).join('')}</select></div>
      <div class="fld"><label>Contact du centre (dépôt sécurisé)</label><input data-fo="centerContact" value="${u.esc(fo.centerContact)}"><span class="help">Dépôt SFTP du centre ${UI.sim('simulé')}</span></div>
      <div class="fld full"><span class="lbl">Exclusions</span><div class="checks">
        <label class="chk ok" title="Exclusion obligatoire, non désactivable"><input type="checkbox" checked disabled style="width:auto;margin:0 4px 0 0"><span>Contacts déjà livrés à ${u.esc(cl.name)} (12 mois) · <b>${u.n(k.already)}</b> <small class="muted">· obligatoire</small></span></label>
                <label class="chk ok" title="Exclusion obligatoire, non désactivable"><input type="checkbox" checked disabled style="width:auto;margin:0 4px 0 0"><span>Repoussoir de ${u.esc(cl.name)} (${u.esc(D.repous[cl.id].file)}) · <b>${u.n(k.repous)}</b> <small class="muted">· obligatoire</small></span></label>
        <div class="chk ok"><span class="m">✓</span><span>Oppositions et désinscrits (toujours appliqué) · <b>${u.n(k.optout)}</b></span></div>
        <div class="chk wa"><span class="m">!</span><span>Liste Bloctel : passage obligatoire après la commande, avant validation et livraison</span></div></div></div></div>`,
      { foot: `<div class="split"><button class="btn primary" id="fo-ok">${UI.icon('plus')}Enregistrer la commande</button><span class="note">La commande est créée en « Passage Bloctel requis » : ni validation ni livraison possibles avant le passage.</span></div>` })}
      <div style="display:flex;flex-direction:column;gap:16px">
      ${UI.card('Comptage <small>base téléphonique virtuelle</small>', `<div style="margin-bottom:12px"><span class="count-big">${u.n(k.available)}</span> <span class="muted">fiches disponibles</span></div>${funnel([['Cible brute', k.raw, '', ''], ['Après déjà livrés', k.raw - (fo.excl.already ? k.already : 0), fo.excl.already ? '−' + u.n(k.already) : 'non appliqué'], ['Après repoussoir', k.raw - (fo.excl.already ? k.already : 0) - (fo.excl.repous ? k.repous : 0), fo.excl.repous ? '−' + u.n(k.repous) : 'non appliqué'], ['Après oppositions', k.available, '−' + u.n(k.optout)], ['Commandé', Math.min(fo.volume, k.available), u.pct(Math.min(fo.volume, k.available) / Math.max(1, k.available), 1), 'var(--cyan)']])}<div class="note" style="margin-top:10px">Ciblage : ${crit(fo).map(u.esc).join(' · ')} ${UI.sim('comptage simulé')}</div>`)}
      ${UI.card('Circuit de la commande', UI.steps(0, ['Commande', 'Passage Bloctel', 'Validation directrice', 'Livraison', 'Retours d\'appels']) + `<div class="alert warn" style="margin:12px 0 0">${UI.icon('shield')}<div><b>Bloctel obligatoire :</b> passage de moins de ${W.BLOCTEL_DAYS} jours avant validation et livraison. ${UI.legal()}</div></div>`)}</div></div>`;
    const re = () => form(el, user);
    el.querySelectorAll('[data-fo]').forEach(x => x.addEventListener(x.tagName === 'SELECT' || x.type === 'date' ? 'change' : 'input', () => {
      const key = x.dataset.fo; fo[key] = x.type === 'number' ? +x.value : x.value;
      if (key === 'client' || key === 'zone') return re();
      if (key === 'volume') { const kk = count(fo); el.querySelector('#fo-vh').innerHTML = fo.volume > kk.available ? '<b style="color:var(--red)">supérieur aux fiches disponibles (' + u.n(kk.available) + ')</b>' : 'disponibles après exclusions : <b>' + u.n(kk.available) + '</b>'; el.querySelector('#fo-amt').textContent = UI.money(fo.volume * PRICE); }
    }));
    el.querySelectorAll('[data-fo="volume"]').forEach(x => x.addEventListener('change', re));
    el.querySelectorAll('[data-tg]').forEach(b => b.onclick = () => {
      const g = b.dataset.tg, v = b.dataset.v; if (g === 'fields' && v === 'Téléphone') { UI.toast('Le champ « Téléphone » est obligatoire', 'warn'); return; }
      const ref = g === 'ages' ? AGES : g === 'extra' ? EXTRA.map(e => e[0]) : FIELDS;
      fo[g] = fo[g].includes(v) ? fo[g].filter(x => x !== v) : ref.filter(x => x === v || fo[g].includes(x)); re();
    });
    fo.excl = { already: true, repous: true }; // exclusions obligatoires
    el.querySelector('#fo-ok').onclick = () => {
      const kk = count(fo);
      const r = W.createTm(Object.assign({}, fo, { criteria: crit(fo), counts: kk, available: kk.available, price: PRICE, label: fo.label || crit(fo).slice(0, 3).join(' · ') }), user);
      if (UI.result(r)) { fo = null; location.hash = '#/livraisons/commande/' + r.id; }
    };
  }

  // ---------- Fiche de commande ----------
  const RET = [['appeles', 'Fiches appelées'], ['joints', 'Contacts joints'], ['argumentes', 'Argumentés'], ['accords', 'Accords'], ['refus', 'Refus'], ['faux', 'Faux numéros']];
  function page(el, id, user) {
    const t = S.scopeTm(user).find(x => x.id === id);
    if (!t) { el.innerHTML = `<div class="alert risk">${UI.icon('lock')}<div><b>Commande introuvable ou hors de votre périmètre.</b></div></div>`; return; }
    const cl = R.client(t.client), s = S.tmStatus(t), bd = W.bloctelDate(t), ok = W.bloctelOk(t), val = W.tmValidator(t), so = LD.state().tm[t.id] || {}, deliv = S.tmDelivered(t);
    const idx = s === 'livree' ? (t.returns ? 5 : 4) : s === 'validee' ? 3 : s === 'a_valider' ? 2 : ok ? 2 : 1;
    const jr = S.journal().filter(j => j.target === t.id).slice().reverse();
    const row = (cls, title, sub, act) => `<div class="act-row ${cls}"><div><b>${title}</b><div class="note">${sub}</div></div><div>${act || ''}</div></div>`;
    const isD = user.kind === 'dir' && cl.dir === user.id;
    const steps = `<div class="act-list">
      ${row('done', '1. Commande enregistrée', `${u.fmtDate(t.date)} par ${u.esc(R.user(t.by).name)} · ${u.n(t.volume)} fiches pour ${u.esc(t.center)}`)}
      ${row(ok || s === 'livree' ? 'done' : 'cur', '2. Passage Bloctel ' + (s === 'livree' ? '<span class="badge b-green">effectué avant livraison</span>' : ok ? '<span class="badge b-green">à jour</span>' : '<span class="badge b-red">' + (bd ? 'périmé' : 'requis') + '</span>'), bd ? `${s === 'livree' ? 'Passage' : 'Dernier passage'} le <b>${u.fmtDate(bd)}</b> (il y a ${u.diffDays(bd, TODAY)} j) · <b>${u.n(W.bloctelRemoved(t))}</b> numéros opposés retirés${ok || s === 'livree' ? '' : ' · plus de ' + W.BLOCTEL_DAYS + ' jours : livraison bloquée'}` : '<b>Aucun passage effectué</b> : validation et livraison bloquées', s !== 'livree' && !ok ? `<button class="btn sm warn" data-ta="runBloctel" data-id="${t.id}">${UI.icon('shield')}Lancer le passage Bloctel (simulé)</button>` : s !== 'livree' ? `<button class="btn sm" data-ta="runBloctel" data-id="${t.id}">Relancer le passage</button>` : '')}
      ${row(val ? 'done' : (s === 'a_valider' || (ok && s === 'preparation')) ? 'cur' : '', '3. Validation de la directrice', val ? `Validée par <b>${u.esc(R.user(val).name)}</b>${so.vat ? ' le ' + u.fmtDate(so.vat) : ''}` : `${u.esc(R.user(cl.dir).name)} valide${s === 'a_valider' ? ' — <b>en attente</b>' : ' après le passage Bloctel'}`, s === 'a_valider' ? `<button class="btn sm ${isD ? 'ok' : ''}" data-ta="validateTm" data-id="${t.id}">${UI.icon('check')}Valider</button>` : s === 'preparation' ? `<button class="btn sm" data-ta="submitTm" data-id="${t.id}">Soumettre</button>` : '')}
      ${row(s === 'livree' ? 'done' : s === 'validee' ? 'cur' : '', '4. Livraison au centre d\'appels', s === 'livree' ? `Livrée${so.at || t.deliveredAt ? ' le <b>' + u.fmtDate(so.at || t.deliveredAt) + '</b>' : ''} · <b>${u.n(deliv)}</b> fiches · dépôt sécurisé ${UI.sim()}` : `${u.n(deliv)} fiches · ${u.esc(t.center)}${t.centerContact ? ' · <span class="mono">' + u.esc(t.centerContact) + '</span>' : ''}`, s !== 'livree' ? `<button class="btn sm ${s === 'validee' ? 'primary' : ''}" data-ta="deliverTm" data-id="${t.id}">${UI.icon('send')}Livrer</button>` : '')}
      ${row(t.returns ? 'done' : s === 'livree' ? 'cur' : '', '5. Retours d\'appels', t.returns ? `${u.n(t.returns.accords)} accords sur ${u.n(t.returns.joints)} contacts joints${so.rat ? ' · saisis le ' + u.fmtDate(so.rat) : ''}` : s === 'livree' ? 'À saisir ci-dessous (ou import du fichier de retour du centre)' : 'Après livraison')}
      </div>`;
    const r = t.returns, dflt = [0.9, 0.42, 0.27, 0.03, 0.22, 0.04];
    const retForm = s === 'livree' ? `<div class="ret-g">${RET.map(([k, l], i) => `<div class="fld"><label>${l}</label><input type="number" min="0" data-r="${k}" value="${r ? r[k] : Math.round(deliv * dflt[i])}"></div>`).join('')}</div>
      <div class="split" style="margin-top:12px"><button class="btn primary" id="ret-ok">${UI.icon('check')}${r ? 'Mettre à jour les retours' : 'Enregistrer les retours'}</button><span class="note">Contrôle de cohérence : appelés ≤ livrés, joints ≤ appelés, argumentés ≤ joints, accords + refus ≤ argumentés. Import du fichier de retour ${UI.sim()}</span></div>` : `<div class="note">La saisie des retours s'ouvre après la livraison des fiches.</div>`;
    const retView = r ? funnel([['Fiches livrées', deliv, ''], ['Appelées', r.appeles, u.pct(r.appeles / Math.max(1, deliv), 0)], ['Contacts joints', r.joints, u.pct(r.joints / Math.max(1, r.appeles), 0)], ['Argumentés', r.argumentes, u.pct(r.argumentes / Math.max(1, r.joints), 0)], ['Accords', r.accords, u.pct(r.accords / Math.max(1, r.joints), 1), 'var(--green)']]) + `<div class="note" style="margin-top:8px">${u.n(r.refus)} refus · ${u.n(r.faux)} faux numéros · coût par accord <b>${UI.money(S.tmAmount(t) / Math.max(1, r.accords), true)}</b></div>` : '';
    el.innerHTML = `<div class="camp-head"><div style="min-width:0">
        <div class="note"><a href="#/livraisons/telemarketing">Fiches télémarketing</a> › ${UI.clientDot(t.client)}${u.esc(cl.name)} › <span class="mono">${t.id}</span></div>
        <h2 style="margin-top:4px">${u.esc(t.label)} ${LD.livraisons.tst(t)} ${t.created ? '<span class="badge b-cyan">créée en démo</span>' : ''}</h2>
        <div class="meta"><span>Fiches <b>${u.n(t.volume)}</b></span><span>Centre <b>${u.esc(t.center)}</b></span><span>Bloctel <b>${bd ? u.fmtDate(bd) : 'aucun passage'}</b></span><span>Directrice <b>${u.esc(R.user(cl.dir).name)}</b></span><span>Montant <b>${UI.money(S.tmAmount(t), true)} HT</b></span></div>
        <div style="margin-top:12px;max-width:820px">${UI.steps(idx, ['Commande', 'Passage Bloctel', 'Validation directrice', 'Livraison', 'Retours d\'appels'])}</div>
      </div><div class="camp-actions">${LD.livraisons.tmActions(t, user, 'sm')}</div></div>
      ${!ok && s !== 'livree' ? `<div class="alert risk" style="margin-top:16px">${UI.icon('lock')}<div><b>Livraison bloquée : ${u.esc(W.bloctelMsg(t))}.</b> Lancez le passage Bloctel avant la validation de la directrice et la livraison. ${UI.legal()}</div></div>` : ''}
      <div class="grid" style="grid-template-columns:1.25fr 1fr;align-items:start;margin-top:16px"><div style="display:flex;flex-direction:column;gap:16px">
      ${UI.card('Suivi de la commande', steps)}
      ${UI.card('Retours d\'appels <small>' + (r ? 'saisis' : 'à saisir') + '</small>', retView + (retView ? '<div style="height:14px"></div>' : '') + retForm, { id: 'tm-ret' })}
      </div><div style="display:flex;flex-direction:column;gap:16px">
      ${UI.card('Paramètres de la commande', `<dl class="mini-kv"><dt>Client</dt><dd>${UI.clientDot(t.client)}${u.esc(cl.name)}</dd><dt>Ciblage</dt><dd data-tv="criteria">${(t.criteria || [t.label]).map(u.esc).join(' · ')}</dd><dt>Fiches commandées</dt><dd data-tv="volume">${u.n(t.volume)}</dd><dt>Champs livrés</dt><dd data-tv="fields">${t.fields.map(u.esc).join(', ')}</dd><dt>Centre d'appels</dt><dd data-tv="center">${u.esc(t.center)}</dd>${t.centerContact ? `<dt>Contact du centre</dt><dd class="mono">${u.esc(t.centerContact)}</dd>` : ''}${t.wanted ? `<dt>Livraison souhaitée</dt><dd>${u.fmtDate(t.wanted)}</dd>` : ''}<dt>Prix</dt><dd>${u.dec(t.price, 2)} € la fiche · ${UI.money(S.tmAmount(t), true)} HT</dd><dt>Préparée par</dt><dd>${u.esc(R.user(t.by).name)}</dd></dl>`)}
      ${UI.card('Exclusions appliquées', `<div class="checks"><div class="chk ${t.exclOn && !t.exclOn.already ? 'ko' : 'ok'}"><span class="m">${t.exclOn && !t.exclOn.already ? '✕' : '✓'}</span><span>Déjà livrés à ${u.esc(cl.name)} · <b>${u.n(t.excluded.already)}</b></span></div><div class="chk ${t.exclOn && !t.exclOn.repous ? 'ko' : 'ok'}"><span class="m">${t.exclOn && !t.exclOn.repous ? '✕' : '✓'}</span><span>Repoussoir client · <b>${u.n(t.excluded.repous)}</b></span></div>${t.excluded.optout != null ? `<div class="chk ok"><span class="m">✓</span><span>Oppositions et désinscrits · <b>${u.n(t.excluded.optout)}</b></span></div>` : ''}<div class="chk ${ok || s === 'livree' ? 'ok' : bd ? 'wa' : 'ko'}"><span class="m">${ok || s === 'livree' ? '✓' : bd ? '!' : '✕'}</span><span>Bloctel · ${bd ? '<b>' + u.n(W.bloctelRemoved(t)) + '</b> numéros retirés le ' + u.fmtDate(bd) + (ok || s === 'livree' ? '' : ' — passage périmé, à relancer') : 'passage non effectué'}</span></div></div>`)}
      ${UI.card('Journal de la commande', jr.length ? `<div class="timeline">${jr.map(j => `<div class="tl-i"><div class="tl-d"></div><div><b style="font-weight:500">${u.esc(j.action)}</b><small class="muted">${u.fmtDateTime(new Date(j.t)).slice(0, 16)} · ${u.esc((R.user(j.user) || {}).name || '—')}</small></div></div>`).join('')}</div>` : '<div class="note">Commande issue de l\'historique : actions antérieures à la maquette.</div>')}
      </div></div>`;
    LD.livraisons.bindActions(el, user);
    const b = el.querySelector('#ret-ok');
    if (b) b.onclick = () => { const x = {}; el.querySelectorAll('[data-r]').forEach(i => { x[i.dataset.r] = +i.value; }); if (UI.result(W.saveReturns(t, x, user))) LD.app.renderView(); };
  }
  LD.tmViews = { form, page, count, resetForm: () => { fo = null; } };
})(window.LD);
