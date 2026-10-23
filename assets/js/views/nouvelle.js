/* views/nouvelle.js : assistant de création en 6 étapes — Brief, Canal, Ciblage, Contenu, A/B & BAT, Programmation.
 * Le brouillon est conservé (localStorage) ; #/nouvelle/<n> ouvre l'étape n ; #/nouvelle/modele/<id> part d'un modèle.
 * Comptages calculés sur la base de contacts VIRTUELLE (simulation — branchement reporté).
 */
(function (LD) {
  'use strict';
  const u = LD.u, UI = LD.ui, S = LD.store, R = LD.ref, W = LD.wf, C = LD.config, D = LD.data, TODAY = LD.TODAY, K = LD.content;
  const STEPS = [['Brief', 'client, objectif, type'], ['Canal', 'email, SMS, RCS, séquence'], ['Ciblage', 'critères et comptage'], ['Contenu', 'message et aperçu'], ['Test A/B et BAT', 'versions, destinataires'], ['Programmation', 'date, vagues, débit']];

  function nextWorkDay(n) { let d = u.addDays(TODAY, n); while (!u.isWorkingDay(d)) d = u.addDays(d, 1); return d; }
  function fresh(user) {
    const cl = R.clients.find(c => user.kind !== 'cdc' || c.cdc === user.id) || R.clients[0];
    return { client: cl.id, name: '', objective: 'Trafic magasin', type: 'location', budget: 25000, channel: 'email', seqGap: 2,
      crit: { age: ['25-34', '35-49'], csp: [], radius: 15, interests: [], behav: ['Actifs 6 mois'], geo: 'magasins' }, segment: '', imp: null, cap: 200000,
      content: null, ab: { on: false, kind: 'objet', share: 10, b: '' }, spill: false, date: nextWorkDay(8), hour: 9, smsHour: 11, waves: 1, throughput: 150000, step: 0 };
  }
  function draft(user) { const st = LD.state(); if (!st.draft) { st.draft = fresh(user); LD.save(); } return st.draft; }
  function save() { LD.save(); }

  // ---------- Comptage sur la base virtuelle ----------
  const AGES = ['18-24', '25-34', '35-49', '50-64', '65+'], AGE_W = [0.12, 0.21, 0.27, 0.24, 0.16];
  const CSP = ['CSP+', 'CSP-', 'Retraités', 'Étudiants'], CSP_W = [0.31, 0.34, 0.24, 0.11];
  const INTER = ['Maison & déco', 'Banque & épargne', 'Assurance', 'Santé', 'Automobile', 'Beauté', 'High-tech & mobile', 'Voyages'];
  const BEHAV = ['Actifs 6 mois', 'Ouvreurs 90 jours', 'Cliqueurs 90 jours', 'Acheteurs en ligne'], BEHAV_W = [0.62, 0.38, 0.14, 0.27];
  function count(d) {
    const cl = R.client(d.client), B = D.base;
    if (d.type === 'routage') { const imp = d.imp || { valid: 0 }; return { routage: true, raw: imp.rows || 0, ex: imp.rows ? [['Doublons', imp.dups], ['Formats invalides', imp.invalid], ['Désinscrits / STOP', Math.round(imp.valid * 0.031)], ['Pression marketing (< ' + C.PRESSURE_DAYS + ' j)', Math.round(imp.valid * 0.06)]] : [], cap: d.cap }; }
    const ch = d.channel, mob = ch !== 'email', em = ch === 'email' || ch === 'seq';
    let f = 1;
    f *= d.crit.age.length ? u.sum(d.crit.age, a => AGE_W[AGES.indexOf(a)]) : 1;
    f *= d.crit.csp.length ? u.sum(d.crit.csp, a => CSP_W[CSP.indexOf(a)]) : 1;
    if (d.crit.geo === 'magasins' && cl.d2s) f *= Math.min(0.92, cl.stores * Math.PI * d.crit.radius * d.crit.radius / 550000 * 1.9);
    f *= d.crit.interests.length ? 1 - Math.pow(0.7, d.crit.interests.length) : 1;
    d.crit.behav.forEach(b => f *= BEHAV_W[BEHAV.indexOf(b)]);
    const raw = Math.round((mob ? B.mobile : B.email) * f);
    const rep = D.repous[d.client].rows / 14e6;
    const ex = [['Désinscrits / STOP', Math.round(raw * 0.052)], ['Repoussoir client (' + u.n(D.repous[d.client].rows) + ' lignes)', Math.round(raw * Math.min(0.2, rep * 2.4))], ['Pression marketing (< ' + C.PRESSURE_DAYS + ' j)', Math.round(raw * 0.112)]];
    const o = { raw, ex, cap: d.cap, mob, em };
    if (ch === 'seq') o.emailRaw = Math.round(B.email * f * 0.83);
    return o;
  }
  function finalVols(d) {
    const k = count(d), after = Math.max(0, k.raw - u.sum(k.ex, x => x[1])), v = Math.min(after, d.cap);
    const r = { after, total: v };
    if (d.channel === 'email') r.email = v;
    if (d.channel === 'sms') r.sms = v;
    if (d.channel === 'rcs') { r.sms = v; r.rcs = Math.round(v * C.RCS_SHARE / 100); r.fallback = v - r.rcs; }
    if (d.channel === 'seq') { r.sms = v; r.email = Math.min(d.cap, Math.round((k.emailRaw || v) * 0.79)); }
    return r;
  }

  // ---------- Contenu par défaut ----------
  function ensureContent(d) {
    const cl = R.client(d.client);
    d.content = d.content || {};
    const k = d.content, nm = d.name || 'Nouvelle campagne';
    if ((d.channel === 'email' || d.channel === 'seq') && !k.email) k.email = { from: cl.name, fromEmail: 'offres@' + cl.id + '-demo.example', subject: nm + ' : jusqu\'à -30 %', preheader: 'Offre réservée aux abonnés, valable jusqu\'à dimanche', links: [{ label: 'Bouton principal « J\'en profite »', url: 'https://' + cl.id + '-demo.example/offre', share: 0.55 }, { label: 'Visuel principal', url: 'https://' + cl.id + '-demo.example/offre#visuel', share: 0.22 }, { label: 'Trouver mon magasin', url: 'https://' + cl.id + '-demo.example/magasins', share: 0.13 }, { label: 'Logo', url: 'https://' + cl.id + '-demo.example', share: 0.08 }, { label: 'Lien de désinscription', url: '{{desinscription}}', share: 0.02 }] };
    if ((d.channel === 'sms' || d.channel === 'seq' || d.channel === 'rcs') && !k.sms) k.sms = { sender: cl.sender.slice(0, 11), text: cl.name + ' : ' + nm + ', jusqu\'a -30% ce week-end dans votre magasin {{magasin}}. {{lien}} STOP 36XXX' };
    if (k.email && !k.email.html) LD.content.defaultTemplate(cl, k.email); // vrai HTML par défaut, contrôlé comme un import
    if (d.channel === 'rcs' && !k.rcs) k.rcs = { agent: cl.name, verified: true, title: nm, text: 'Jusqu\'à -30 % ce week-end dans votre magasin. STOP au 36XXX', buttons: cl.d2s ? ['Voir l\'offre', 'Itinéraire vers le magasin', 'Appeler le magasin'] : ['Voir l\'offre', 'Être rappelé', 'Appeler'], carousel: false };
    if (!(d.channel === 'email' || d.channel === 'seq')) delete k.email;
    if (d.channel === 'email') { delete k.sms; delete k.rcs; }
    if (d.channel !== 'rcs') delete k.rcs;
    return k;
  }
  // Vague complémentaire le jour SMS autorisé suivant, quand l'envoi du jour finirait après la fenêtre (règle à confirmer avec le juridique)
  function spillParts(d, parts) {
    const j0 = parts.filter(p => p.off === 0 && p.ch !== 'email'), V = u.sum(j0, p => p.vol); if (!V) return;
    const fit = Math.max(0, Math.floor((C.SMS_WINDOW[1] - d.smsHour - ((d.waves || 1) - 1) * W.WAVE_GAP) * d.throughput / 100) * 100);
    if (fit >= V) return;
    const nd = u.diffDays(d.date, W.nextSmsDay(d.date)), ratio = fit / V;
    j0.forEach(p => { const rest = p.vol - Math.round(p.vol * ratio); p.vol -= rest; parts.push({ ch: p.ch, off: nd, hour: C.SMS_WINDOW[0] + 1, vol: rest, fallback: p.fallback, spill: true }); });
  }
  // Test A/B : description pour le récapitulatif et objet enregistré dans la campagne
  function abSum(d) {
    if (!d.ab.on) return 'non';
    const L = LD.wizAb.AB_LABEL[d.ab.kind], b = String(d.ab.b || '').trim();
    return u.esc(L) + ' · ' + d.ab.share + ' % + ' + d.ab.share + ' %<br><small class="muted">B : ' + (b ? u.esc(b.length > 60 ? b.slice(0, 60) + '…' : b) : '<b style="color:var(--red)">à saisir</b>') + '</small>';
  }
  function abSpec(d) {
    if (!d.ab.on) return null;
    const b = String(d.ab.b || '').trim(), hb = d.ab.kind === 'heure' ? (([h, m]) => h + m / 60)(b.split(':').map(Number)) : null;
    return { kind: d.ab.kind, share: d.ab.share / 100, a: LD.wizAb.abA(d), b: d.ab.kind === 'heure' ? hb : b, winner: null, gain: null };
  }
  function pseudoCamp(d) {
    const v = finalVols(d), parts = [];
    if (d.channel === 'email') parts.push({ ch: 'email', off: 0, hour: d.hour, vol: v.email });
    if (d.channel === 'sms') parts.push({ ch: 'sms', off: 0, hour: d.smsHour, vol: v.sms });
    if (d.channel === 'rcs') parts.push({ ch: 'rcs', off: 0, hour: d.smsHour, vol: v.rcs }, { ch: 'sms', off: 0, hour: d.smsHour, vol: v.fallback, fallback: true });
    if (d.channel === 'seq') parts.push({ ch: 'sms', off: 0, hour: d.smsHour, vol: v.sms }, { ch: 'email', off: d.seqGap, hour: d.hour, vol: v.email });
    if (d.spill && d.channel !== 'email') spillParts(d, parts);
    parts.forEach(p => p.date = u.addDays(d.date, p.off));
    return { id: 'BROUILLON', client: d.client, name: d.name || 'Nouvelle campagne', channel: d.channel, parts, content: ensureContent(d), type: d.type, volume: u.sum(parts, p => p.vol), throughput: d.throughput, waves: d.waves, hour: parts[0].hour, date: d.date };
  }

  // ---------- Panneau de synthèse ----------
  function summary(d) {
    const cl = R.client(d.client), v = finalVols(d), pc = pseudoCamp(d), b = S.bdc(d.client);
    const price = S.price({ qty: u.sum(pc.parts, p => p.vol), type: d.type, client: d.client }).media; // fonction de prix unique
    const chk = W.contentCheck(pc), win = W.campWindow(pc, d.date, pc.hour), warn = W.loadWarn(pc, d.date);
    const items = [[!!d.name, 'Nom de la campagne'], [v.total > 0, 'Cible non vide'], [chk.ok, 'Mentions obligatoires'], [!win.length, 'Fenêtres d\'envoi'], [d.date >= TODAY, 'Date future']];
    return UI.card('Récapitulatif', `<dl class="mini-kv"><dt>Client</dt><dd>${UI.clientDot(cl.id)}${u.esc(cl.name)}</dd><dt>Campagne</dt><dd>${u.esc(d.name || '—')}</dd><dt>Canal</dt><dd>${UI.chBadge(d.channel)}</dd><dt>Type</dt><dd>${d.type === 'routage' ? 'Routage base client' : 'Location base LDS'}</dd><dt>Envoi</dt><dd>${u.fmtDate(d.date)} · ${W.H2(pc.hour)}</dd><dt>Test A/B</dt><dd>${abSum(d)}</dd></dl>
      <div style="margin:14px 0 4px" class="kpi-l">Volume retenu</div><div class="count-big" id="sum-count">${u.n(v.total)}</div>
      <div class="note">${pc.parts.map(p => u.n(p.vol) + ' ' + (p.fallback ? 'SMS de repli' : R.channel(p.ch).short) + (p.off ? ' (J+' + p.off + ')' : '')).join(' + ')}</div>
      <div style="margin:14px 0 4px" class="kpi-l">Montant estimé <small class="muted">${C.PRICE_NOTE}</small></div><div style="font-size:20px;font-weight:600;color:var(--navy)">${UI.money(price)} HT</div>
      <div class="note">${u.esc(cl.contract)} : reste ${UI.money(b.rest)} ${b.rest < price ? '<span class="badge b-red">insuffisant</span>' : ''}</div>
      <div class="checks" style="margin-top:14px">${items.map(i => `<div class="chk ${i[0] ? 'ok' : 'ko'}"><span class="m">${i[0] ? '✓' : '✕'}</span><span>${i[1]}</span></div>`).join('')}${warn.map(w => `<div class="chk wa"><span class="m">!</span><span>${u.esc(w)}</span></div>`).join('')}</div>`,
      { cls: 'wiz-sum', foot: 'Brouillon enregistré automatiquement · aucune donnée envoyée' });
  }

  // ---------- Étapes 1, 2, 6 ----------
  const STEP = {};
  STEP[0] = function (d, user) {
    const cls = S.scopeClients(user), cl = R.client(d.client), b = S.bdc(d.client);
    return `<div class="form-g">
      <div class="fld"><label>Client</label><select data-k="client">${cls.map(c => `<option value="${c.id}" ${c.id === d.client ? 'selected' : ''}>${u.esc(c.name)} — ${u.esc(R.sector(c.sector).label)}</option>`).join('')}</select><span class="help">Directrice : ${u.esc(R.user(cl.dir).name)} · chargé habituel : ${u.esc(R.user(cl.cdc).name)}</span></div>
      <div class="fld"><label>Nom de la campagne</label><input data-k="name" value="${u.esc(d.name)}" placeholder="Ex. : Week-end privilège novembre"></div>
      <div class="fld"><label>Objectif</label><select data-k="objective">${['Trafic magasin', 'Génération de leads', 'Conversion en ligne', 'Notoriété offre', 'Réactivation'].map(o => `<option ${o === d.objective ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
      <div class="fld"><label>Budget de la campagne (€ HT)</label><input type="number" data-k="budget" value="${d.budget}" step="500"><span class="help">BDC rattaché : ${u.esc(cl.contract)} · ${UI.money(b.amount)} · consommé ${u.pct(b.ratio, 0)}</span></div>
      <div class="fld full"><span class="lbl">Type de campagne</span><div class="choice c2">${R.types.map(t => `<button class="ch-opt ${t.id === d.type ? 'on' : ''}" data-set="type" data-v="${t.id}"><b>${UI.icon(t.id === 'routage' ? 'box' : 'users')}${t.label}</b><span>${t.id === 'routage' ? 'Le client fournit son fichier ; LDS route et facture le routage.' : 'Ciblage sur la base de contacts LDS (opt-in partenaires).'}</span></button>`).join('')}</div></div></div>`;
  };
  STEP[1] = function (d) {
    const opts = [['email', 'Email', 'mail', 'Plateforme email interne'], ['sms', 'SMS', 'msg', 'Sinch · 160 caractères'], ['rcs', 'RCS', 'rcs', 'Carte enrichie, repli SMS automatique'], ['seq', 'Séquence SMS + email', 'send', 'Une prise de parole, deux envois']];
    return `<div class="choice">${opts.map(o => `<button class="ch-opt ${o[0] === d.channel ? 'on' : ''}" data-set="channel" data-v="${o[0]}"><b>${UI.icon(o[2])}${o[1]}</b><span>${o[3]}</span></button>`).join('')}</div>
      ${d.channel === 'seq' ? `<div class="form-g" style="margin-top:16px"><div class="fld"><label>Délai entre le SMS et l'email</label><select data-k="seqGap" data-num>${[1, 2, 3, 5, 7].map(n => `<option value="${n}" ${n === d.seqGap ? 'selected' : ''}>J+${n}</option>`).join('')}</select><span class="help">L'email ne part qu'aux contacts non cliqueurs du SMS ${UI.sim('simulé')}</span></div></div>` : ''}
      ${d.channel === 'rcs' ? `<div class="alert info" style="margin-top:16px">${UI.icon('info')}<div><b>RCS avec repli SMS.</b> Les mobiles compatibles reçoivent la carte enrichie ; les autres reçoivent automatiquement le SMS. Fournisseur RCS à confirmer (Sinch propose le RCS) ${UI.sim('simulé — à confirmer')}</div></div>` : ''}`;
  };
  STEP[5] = function (d) {
    const pc = pseudoCamp(d), win = W.campWindow(pc, d.date, pc.hour), warn = W.loadWarn(pc, d.date), hasE = d.channel === 'email' || d.channel === 'seq', hasS = d.channel !== 'email';
    const tm = h => u.pad(Math.floor(h)) + ':' + u.pad(Math.round((h % 1) * 60));
    const plan = W.sendPlan(pc, d.date, pc.hour).sort((a, b) => a.off - b.off || a.fam.localeCompare(b.fam));
    const lim = C.SMS_WINDOW[1], over = plan.find(x => x.fam === 'sms' && x.off === 0 && x.end > lim + 1e-9 && x.start < lim), adv = over ? W.smsAdvice(over) : null;
    const spillOn = pc.parts.some(p => p.spill), sp = plan.find(x => x.fam === 'sms' && x.off > 0 && pc.parts.some(p => p.spill && p.off === x.off));
    const endLine = `<div class="end-line">${plan.map(x => { const late = x.fam === 'sms' && x.end > lim + 1e-9; return `<span>${x.fam === 'sms' ? (d.channel === 'rcs' ? 'RCS / SMS' : 'SMS') : 'Email'} · ${u.DOWS[u.dow(x.date)].toLowerCase()} ${u.fmtDateShort(x.date)} : <b>${W.H2(x.start)}</b> → fin estimée <b style="color:${late ? 'var(--red)' : 'var(--green)'}">${W.H2(x.end)}</b> <small class="muted">(${u.n(x.vol)} messages)</small></span>`; }).join('')}</div>`;
    const fixes = adv ? `<div class="fix-row">${adv.latest != null ? `<button class="btn sm" data-fix="advance" data-v="${adv.latest}">${UI.icon('cal')}Avancer le départ à ${W.H2(adv.latest)}</button>` : ''}<button class="btn sm primary" data-fix="spill">${UI.icon('plus')}${adv.fit ? 'Ajouter une vague le ' : 'Reporter tout l’envoi au '}${u.DOWS[u.dow(adv.next)].toLowerCase()} ${u.fmtDate(adv.next)} à ${C.SMS_WINDOW[0] + 1} h (${u.n(adv.rest)} messages)</button></div>` : '';
    return `<div class="form-g">
      <div class="fld"><label>Date d'envoi${d.channel === 'seq' ? ' (SMS, J0)' : ''}</label><input type="date" data-k="date" value="${d.date}" min="${TODAY}"><span class="help">${u.DOWS[u.dow(d.date)]}${W.isHoliday(d.date) ? ' · <b style="color:var(--red)">jour férié</b>' : ''} · charge du routage ce jour : ${u.n(S.dayLoad(d.date) + pc.parts[0].vol)} messages</span></div>
      ${hasS ? `<div class="fld"><label>Heure de départ ${d.channel === 'rcs' ? 'RCS / SMS' : 'SMS'}</label><input type="time" data-k="smsHour" data-time value="${tm(d.smsHour)}" step="900"></div>` : ''}
      ${hasE ? `<div class="fld"><label>Heure email${d.channel === 'seq' ? ' (J+' + d.seqGap + ')' : ''}</label><input type="time" data-k="hour" data-time value="${tm(d.hour)}" step="900"></div>` : ''}
      <div class="fld"><label>Envoi en vagues</label><select data-k="waves" data-num>${[1, 2, 3, 4].map(n => `<option value="${n}" ${n === d.waves ? 'selected' : ''}>${n === 1 ? 'Une seule vague' : n + ' vagues (30 min de pause entre vagues)'}</option>`).join('')}</select></div>
      <div class="fld"><label>Débit maximal</label><select data-k="throughput" data-num>${[20000, 50000, 100000, 150000, 200000].map(n => `<option value="${n}" ${n === d.throughput ? 'selected' : ''}>${u.n(n)} messages / heure</option>`).join('')}</select><span class="help">Fin = départ + volume ÷ débit + pauses entre vagues</span></div>
      <div class="full"><div class="kpi-l">Heures de fin estimées</div>${endLine}</div>
      <div class="full">${win.length ? `<div class="alert risk">${UI.icon('alert')}<div><b>Fenêtre d'envoi non autorisée</b> ${UI.legal()}<ul>${win.map(e => `<li>${u.esc(e)}</li>`).join('')}</ul>${fixes}</div></div>` : `<div class="alert ok">${UI.icon('check')}<div><b>Fenêtres d'envoi respectées, fin d'envoi comprise.</b> ${hasS ? 'SMS / RCS : départ et fin entre ' + C.SMS_WINDOW[0] + ' h et ' + C.SMS_WINDOW[1] + ' h, pas le dimanche ni les jours fériés — ' + UI.legal() : 'Email : ' + C.EMAIL_WINDOW[0] + ' h – ' + C.EMAIL_WINDOW[1] + ' h'}</div></div>`}
      ${spillOn && sp ? `<div class="alert info" style="margin-top:8px">${UI.icon('info')}<div><b>Vague complémentaire ajoutée :</b> ${u.n(sp.vol)} messages le ${u.DOWS[u.dow(sp.date)].toLowerCase()} ${u.fmtDate(sp.date)} à ${W.H2(sp.start)} (fin estimée ${W.H2(sp.end)}). <button class="link" data-fix="unspill">Retirer la vague</button></div></div>` : ''}
      ${warn.length ? `<div class="alert warn" style="margin-top:8px">${UI.icon('alert')}<div>${warn.map(u.esc).join('<br>')}</div></div>` : ''}</div>
      <div class="full alert info">${UI.icon('info')}<div>À la création, la campagne est enregistrée en <b>brouillon</b>. Elle suit ensuite le circuit : BAT client → validation par ${u.esc(R.user(R.client(d.client).dir).name)} → programmation → lancement.</div></div></div>`;
  };

  function render(el, arg, user) {
    const parts = (arg || '').split('/');
    if (parts[0] === 'modele') {
      const m = LD.models.find(x => x.id === parts[1]);
      if (m) { const d = fresh(user); d.client = m.client; d.channel = m.channel; d.name = m.name.split(' — ')[0]; d.fromModel = m.name; LD.state().draft = d; save(); location.hash = '#/nouvelle/1'; return; }
    }
    // Exemples de démonstration (aide et captures) : mêmes chemins de code que la saisie manuelle
    if (parts[0] === 'exemple') {
      const d = fresh(user); d.step = 0;
      if (parts[1] === 'import') {
        Object.assign(d, { name: 'Soldes d\'hiver', channel: 'email' }); LD.state().draft = d; ensureContent(d); save();
        const img = 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27600%27 height=%27240%27%3E%3Crect width=%27100%25%27 height=%27100%25%27 fill=%27%23233F93%27/%3E%3Ctext x=%2750%25%27 y=%2755%25%27 font-family=%27Arial%27 font-size=%2738%27 fill=%27white%27 text-anchor=%27middle%27%3ESOLDES D%27HIVER%3C/text%3E%3C/svg%3E';
        const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Soldes d'hiver</title></head><body style="margin:0;background:#EEF2F7;font-family:Arial,sans-serif"><table role="presentation" width="600" align="center" style="background:#fff;border-collapse:collapse"><tr><td style="padding:18px 24px;font-weight:bold;color:#233F93;font-size:18px">${u.esc(R.client(d.client).name)}</td></tr><tr><td><a href="https://${d.client}-demo.example/soldes"><img src="${img}" width="600" height="240" alt="Soldes d'hiver : jusqu'à -40 %" style="display:block"></a></td></tr><tr><td style="padding:24px;font-size:15px;line-height:1.55;color:#1F2937">Bonjour {{prenom}},<br><br>Les soldes d'hiver commencent : jusqu'à -40 % sur une sélection, en ligne et dans votre magasin.<br><br><a href="https://${d.client}-demo.example/soldes" style="display:inline-block;background:#00ADDA;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">Je découvre</a></td></tr><tr><td style="padding:0 24px 20px"><img src="${img}" width="552" height="90" style="display:block"></td></tr><tr><td style="padding:0 24px 24px;font-size:14px"><a href="https://${d.client}-demo.example/magasins" style="color:#233F93">Trouver mon magasin</a></td></tr><tr><td style="padding:16px 24px;font-size:11px;color:#6B7280;background:#F3F4F6">Vous recevez cet email car vous avez accepté les offres des partenaires de Live Data Solutions. <a href="{{desinscription}}" style="color:#6B7280">Se désinscrire</a> · Société fictive.</td></tr></table></body></html>`;
        K.importTemplate(new File([html], 'exemple-soldes-hiver.html', { type: 'text/html' }), d.content.email).then(() => { save(); location.hash = '#/nouvelle/4'; });
        return;
      }
      if (parts[1] === 'fin-sms') { Object.assign(d, { name: 'Vente privée du soir', channel: 'sms', client: 'opaline', smsHour: 18, throughput: 50000, waves: 2 }); LD.state().draft = d; save(); location.hash = '#/nouvelle/6'; return; }
      if (parts[1] === 'ab') { Object.assign(d, { name: 'Soldes d\'hiver', channel: 'email' }); LD.state().draft = d; ensureContent(d); d.ab = { on: true, kind: 'objet', share: 10, b: 'Dernières heures : jusqu\'à -40 % sur une sélection' }; save(); location.hash = '#/nouvelle/5'; return; }
    }
    if (parts[0] === 'reset') { LD.state().draft = null; save(); location.hash = '#/nouvelle/1'; return; }
    const d = draft(user);
    const step = Math.max(0, Math.min(5, (+parts[0] || d.step + 1) - 1)); d.step = step; save();
    const body = (STEP[step] || LD.wizSteps[step])(d, user);
    el.innerHTML = `${d.fromModel ? `<div class="alert info">${UI.icon('copy')}<div>Créée depuis le modèle <b>${u.esc(d.fromModel)}</b> — paramètres pré-remplis, modifiables.</div></div>` : ''}
      <div class="wiz"><div class="wiz-steps">${STEPS.map((s, i) => `<div class="wiz-s ${i === step ? 'on' : i < step ? 'ok' : ''}" data-go="${i + 1}"><i>${i < step ? '✓' : i + 1}</i><span>${s[0]}<small>${s[1]}</small></span></div>`).join('')}<div style="padding:10px 8px 4px"><button class="link" data-go="reset">Recommencer à zéro</button></div></div>
      <div class="card"><div class="card-h"><h3>Étape ${step + 1} sur 6 · ${STEPS[step][0]}</h3><small class="muted">${STEPS[step][1]}</small></div><div class="card-b" id="wiz-body">${body}</div>
        <div class="card-f wiz-foot"><button class="btn" data-go="${step}" ${step === 0 ? 'disabled' : ''}>‹ Précédent</button>${step < 5 ? `<button class="btn primary" data-go="${step + 2}">Suivant ›</button>` : `<div class="split"><button class="btn" id="wz-create">Créer en brouillon</button><button class="btn primary" id="wz-bat">${UI.icon('eye')}Créer et préparer le BAT</button></div>`}</div></div>
      <div id="wiz-sum">${summary(d)}</div></div>`;
    bind(el, d, user, step);
  }

  function bind(el, d, user, step) {
    const refreshSum = () => { const s = el.querySelector('#wiz-sum'); if (s) s.innerHTML = summary(d); };
    el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { if (b.dataset.go === 'reset') { location.hash = '#/nouvelle/reset'; return; } location.hash = '#/nouvelle/' + b.dataset.go; });
    el.querySelectorAll('[data-set]').forEach(b => b.onclick = () => { d[b.dataset.set] = b.dataset.v; if (b.dataset.set === 'channel' || b.dataset.set === 'client') d.content = null; save(); LD.app.renderView(); });
    el.querySelectorAll('[data-k]').forEach(x => {
      const ev = x.tagName === 'SELECT' || x.type === 'date' || x.type === 'time' ? 'change' : 'input';
      x.addEventListener(ev, () => {
        let v = x.value;
        if (x.dataset.time != null) { const [h, m] = v.split(':').map(Number); v = h + m / 60; } else if (x.dataset.num != null || x.type === 'number' || x.type === 'range') v = +v;
        d[x.dataset.k] = v; if (x.dataset.k === 'client') d.content = null; save();
        if (ev === 'change') LD.app.renderView(); else refreshSum();
      });
    });
    if (LD.wizBind) LD.wizBind(el, d, user, step, refreshSum);
    el.querySelectorAll('[data-fix]').forEach(b => b.onclick = () => { const f = b.dataset.fix; if (f === 'advance') { d.smsHour = +b.dataset.v; d.spill = false; } if (f === 'spill') d.spill = true; if (f === 'unspill') d.spill = false; save(); LD.app.renderView(); });
    const create = withBat => {
      if (!d.name.trim()) { UI.toast(UI.icon('alert') + ' <b>Nom de la campagne manquant</b> (étape 1)', 'err'); return; }
      const pc = pseudoCamp(d), win = W.campWindow(pc, d.date, pc.hour);
      if (win.length) { UI.toast(UI.icon('alert') + ' <b>Fenêtre d\'envoi non autorisée</b><br>' + u.esc(win.join(' · ')), 'err'); return; }
      if (!pc.volume) { UI.toast(UI.icon('alert') + ' <b>Cible vide</b> (étape 3)', 'err'); return; }
      if (d.ab.on && !String(d.ab.b || '').trim()) { UI.toast(UI.icon('alert') + ' <b>Version B du test A/B à saisir</b> (étape 5)', 'err'); return; }
      const c = W.create({ client: d.client, name: d.name, objective: d.objective, type: d.type, channel: d.channel, date: d.date, hour: pc.hour, parts: pc.parts, content: ensureContent(d), ab: abSpec(d), waves: d.waves, throughput: d.throughput, target: targetSnapshot(d), budget: d.budget }, user, 'assistant');
      if (withBat) UI.result(W.sendBat(c, user)); else UI.toast('Campagne <b>' + u.esc(c.name) + '</b> créée en brouillon (' + c.id + ')', 'ok');
      LD.state().draft = null; save(); location.hash = '#/campagne/' + c.id;
    };
    const a = el.querySelector('#wz-create'), b = el.querySelector('#wz-bat');
    if (a) a.onclick = () => create(false); if (b) b.onclick = () => create(true);
  }
  function targetSnapshot(d) {
    const k = count(d), v = finalVols(d);
    return { source: d.type === 'routage' ? 'Base client importée (' + (d.imp ? d.imp.file : '—') + ')' : 'Base LDS (opt-in partenaires) — base virtuelle', criteria: d.type === 'routage' ? ['Fichier client importé'] : d.crit.age.map(a => a + ' ans').concat(d.crit.csp, d.crit.geo === 'magasins' ? ['Rayon ' + d.crit.radius + ' km autour des magasins'] : ['France entière'], d.crit.interests, d.crit.behav), raw: k.raw, ex: k.ex, after: v.after, cap: d.cap };
  }

  LD.wiz = { count, finalVols, ensureContent, pseudoCamp, abSpec, AGES, CSP, INTER, BEHAV, save };
  LD.views.nouvelle = { title: 'Nouvelle campagne', filters: false, render, right: 'create' };
})(window.LD);
