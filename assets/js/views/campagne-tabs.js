/* views/campagne-tabs.js : onglets de la fiche campagne — résultats, contenu, ciblage, BAT,
 * programmation, prix & facturation, journal.
 */
(function (LD) {
  'use strict';
  const u = LD.u, UI = LD.ui, S = LD.store, R = LD.ref, W = LD.wf, CH = LD.charts, D = LD.data, K = LD.content, TODAY = LD.TODAY;

  function timeline(hist) {
    return `<div class="timeline">${hist.map(h => `<div class="tl-i"><div class="tl-d ${h.s === 'bad' ? 'bad' : ''}"></div><div><b style="font-weight:500">${u.esc(h.label)}</b><small class="muted">${h.t ? u.fmtDateTime(new Date(h.t)).slice(0, 16) : u.fmtDate(h.date)} · ${u.esc(h.who)}${h.live ? ' · <span class="badge b-cyan" style="font-size:9.5px;padding:0 5px">démo</span>' : ''}</small></div></div>`).join('')}</div>`;
  }
  function funnel(rows) {
    const max = rows[0][1] || 1;
    return `<div class="funnel">${rows.map((r, i) => `<div class="fn-row"><span>${u.esc(r[0])}</span><div><div class="fn-bar" style="width:${Math.max(0.6, r[1] / max * 100).toFixed(1)}%;${r[3] ? 'background:' + r[3] : ''}"></div></div><span class="v" data-fn="${i}">${u.n(r[1])}</span><span class="p">${r[2] || ''}</span></div>`).join('')}</div>`;
  }
  // Courbe horaire (48 h) : ouvertures / clics ou lectures, répartis selon la décroissance d'engagement
  function hourly(c, r) {
    // Courbe d'engagement : pas d'une heure (campagne terminée, 48 h) ou d'un quart d'heure (envoi du jour en cours)
    const start = S.hourOf(c), elapsed = u.diffDays(S.dateOf(c), TODAY) * 24 + LD.hourNow() - start;
    const q = elapsed < 10 ? 4 : 1, n = q === 4 ? Math.max(2, Math.floor(elapsed * 4)) : Math.min(48, Math.max(12, Math.ceil(elapsed)));
    const em = c.parts.find(p => p.ch === 'email') || c.parts[0];
    const A = em.ch === 'email' ? r.email.opens : em.ch === 'rcs' ? r.rcs.read : r.sms.delivered, B = em.ch === 'email' ? r.email.clicks : r.clicks;
    const w = Array.from({ length: n }, (_, i) => { const t = i / q; return (q === 4 ? Math.min(1, (i + 1) / 3) : 1) * Math.exp(-t / 5) * (t < 1 ? 1.35 : 1) * (((start + t) % 24) < 7 ? 0.25 : 1); });
    const tw = u.sum(w), out = { lab: [], a: [], b: [] };
    for (let i = 0; i < n; i++) {
      const t = start + i / q, hh = Math.floor(t) % 24, mm = Math.round((t % 1) * 60);
      out.lab.push(q === 4 ? u.pad(hh) + 'h' + u.pad(mm) : (i === 0 || hh === 0 ? 'J' + Math.floor(t / 24) + ' ' : '') + hh + 'h');
      out.a.push(Math.round(A * w[i] / tw)); out.b.push(Math.round(B * w[i] / tw));
    }
    out.q = q; return out;
  }

  // Test A/B : valeurs A et B réellement enregistrées, gagnante désignée 2 h après le départ (S.abOutcome), écart affiché
  function abValues(c, k) {
    if (c.ab.a != null || c.ab.b != null) return { a: c.ab.kind === 'heure' ? W.H2(S.hourOf(c)) : c.ab.a, b: c.ab.kind === 'heure' ? W.H2(+c.ab.b) : c.ab.b };
    return { a: c.ab.kind === 'objet' ? (k.email ? k.email.subject : c.name) : c.ab.kind === 'heure' ? W.H2(S.hourOf(c)) : 'Visuel produit', b: c.ab.kind === 'objet' ? 'Dernières heures : ' + c.name.toLowerCase() : c.ab.kind === 'heure' ? W.H2(S.hourOf(c) + 2) : 'Visuel ambiance' };
  }
  function abCard(c, k, r) {
    const o = S.abOutcome(c); if (!o) return '';
    const v = abValues(c, k), base = o.crit === 'clic' ? (r && r.clickRate) || 0.021 : (r && r.openRate) || 0.18, vol = c.volume;
    const rate = w => o.winner ? (o.winner === w ? base * (1 + o.gain / 2) : base * (1 + o.gain / 2) / (1 + o.gain)) : null;
    const box = w => `<div class="ab-v ${o.winner === w ? 'win' : ''}"><div class="tag">Version ${w} · ${u.pct(o.share, 0)} de la cible · ${u.n(Math.round(vol * o.share))}</div><div class="val">${u.esc(w === 'A' ? v.a : v.b)}</div>${rate(w) != null ? `<div class="rate">${u.pct(rate(w), o.crit === 'clic' ? 2 : 1)} <small class="muted" style="font-size:11px;font-weight:400">${o.crit === 'clic' ? 'de clic' : "d'ouverture"} à 2 h</small></div>` : ''}${o.winner === w ? '<span class="badge b-green">gagnante</span>' : ''}</div>`;
    const at = W.H2(o.decideAt), rest = u.pct(o.rest, 0) + ' restants (' + u.n(Math.round(vol * o.rest)) + ' contacts)';
    let note;
    if (o.phase === 'prevu') note = `Test programmé : la gagnante sera désignée <b>2 h après le départ</b> (vers ${at}) sur le taux ${o.crit === 'clic' ? 'de clic' : "d'ouverture"}, puis envoyée automatiquement aux ${rest}.`;
    else if (o.phase === 'test') note = `<span class="pill-live"><span class="dot"></span>test en cours</span> Gagnante désignée à <b>${at}</b>, puis envoyée automatiquement aux ${rest}.`;
    else note = `Gagnante désignée à <b>${at}</b> : <b>version ${o.winner}</b>, écart <b>+${u.pct(o.gain, 0)}</b> (${u.dec((rate(o.winner) - rate(o.winner === 'A' ? 'B' : 'A')) * 100, 2)} point${o.crit === 'clic' ? '' : 's'}) sur le taux ${o.crit === 'clic' ? 'de clic' : "d'ouverture"}. ` + (o.restSent ? `La version ${o.winner} a été envoyée automatiquement aux ${rest} ${UI.sim('simulé')}.` : `Envoi du reste interrompu (campagne ${u.esc(R.status(S.status(c)).label.toLowerCase())}).`);
    return UI.card('Test A/B <small>' + u.esc((LD.wizAb ? LD.wizAb.AB_LABEL[c.ab.kind] : c.ab.kind) || c.ab.kind) + ' · ' + u.pct(o.share, 0) + ' + ' + u.pct(o.share, 0) + ' de la cible</small>', `<div class="ab-pair">${box('A')}${box('B')}</div><div class="note" style="margin-top:10px">${note}</div>`, { id: 'c-ab' });
  }
  const T = {};
  T.synthese = function (el, c, user, hist) {
    const r = S.campResults(c), st = S.status(c), cl = R.client(c.client), k = K.forCamp(c), bill = S.billing(c);
    const hasE = !!r.email.sent || c.parts.some(p => p.ch === 'email'), hasS = c.parts.some(p => p.ch === 'sms'), hasR = c.parts.some(p => p.ch === 'rcs');
    if (S.PRE.includes(st)) {
      el.innerHTML = `<div class="grid" style="grid-template-columns:1.6fr 1fr;margin-top:16px"><div style="display:flex;flex-direction:column;gap:16px"><div class="alert info" style="margin:0">${UI.icon('info')}<div><b>Campagne pas encore envoyée.</b> Les résultats (délivrés, ouvertures, clics, STOP, CA déclaré) s'afficheront ici en direct dès le lancement. Étape en cours : <b>${u.esc(R.status(st).label)}</b>.</div></div>${abCard(c, k, null)}</div>${UI.card('Chronologie des statuts', timeline(hist))}</div>`;
      return;
    }
    const rev = S.revenueOf(c), cpc = r.delivered ? bill.amount / r.delivered : null;
    const kp = [
      UI.kpi({ label: 'Envoyés', value: `<span data-live="sent">${u.n(r.sent)}</span>`, sub: st === 'en_cours' ? '<span class="pill-live"><span class="dot"></span>envoi en cours · ' + u.pct(S.partRes(c, c.parts[0]).prog, 0) + '</span>' : 'sur ' + u.n(c.volume) + ' prévus' }),
      UI.kpi({ label: 'Délivrés', value: `<span data-live="delivered">${u.n(r.delivered)}</span>`, sub: u.pct(r.sent ? r.delivered / r.sent : null) + ' de délivrabilité' }),
      hasE ? UI.kpi({ label: 'Ouvreurs email', value: u.n(r.email.opens), sub: 'taux ' + u.pct(r.openRate) }) : UI.kpi({ label: hasR ? 'Messages RCS lus' : 'Clics lien court', value: u.n(hasR ? r.rcs.read : r.sms.clicks), sub: hasR ? 'taux de lecture ' + u.pct(r.rcsRead, 0) : 'taux ' + u.pct(r.smsClick, 1) }),
      UI.kpi({ label: 'Cliqueurs', value: u.n(r.clicks), sub: hasE ? 'clic ' + u.pct(r.clickRate, 2) + ' · réactivité ' + u.pct(r.ctor, 1) : 'tous canaux' }),
      UI.kpi({ label: hasE && !hasS ? 'Désinscrits' : 'Opt-out (désinscrits + STOP)', value: u.n(r.optout), sub: u.pct(r.optoutRate, 2) + ' des délivrés' + (r.email.complaints ? ' · ' + u.n(r.email.complaints) + ' plainte(s)' : '') }),
      cl.d2s ? UI.kpi({ label: 'CA magasin déclaré', value: rev != null ? UI.money(rev) : '<span class="muted" style="font-size:18px">en attente</span>', sub: rev != null ? 'ROAS ' + u.dec(rev / bill.amount, 1) + ' · déclaré par le client' : 'déclaration client attendue à J+' + c.lag }) : UI.kpi({ label: 'Coût par contact délivré', value: cpc ? u.dec(cpc * 100, 1) + ' c€' : '—', sub: UI.money(bill.amount, true) + ' HT ' + (bill.estimate ? '(estimé)' : '') })
    ].join('');
    // Entonnoir principal
    const fe = hasE ? [['Envoyés', r.email.sent], ['Délivrés', r.email.delivered, u.pct(r.emailDeliv)], ['Ouvreurs', r.email.opens, u.pct(r.openRate)], ['Cliqueurs', r.email.clicks, u.pct(r.clickRate, 2)], ['Désinscrits', r.email.optout, u.pct(r.email.delivered ? r.email.optout / r.email.delivered : null, 2), '#E5484D']] : null;
    const fs = hasS ? [['SMS envoyés', r.sms.sent], ['Délivrés (accusés)', r.sms.delivered, u.pct(r.smsDeliv)], ['Clics lien court', r.sms.clicks, u.pct(r.smsClick, 1)], ['STOP reçus', r.sms.stop, u.pct(r.sms.delivered ? r.sms.stop / r.sms.delivered : null, 2), '#E5484D']] : null;
    const fr = hasR ? [['RCS envoyés', r.rcs.sent], ['Délivrés', r.rcs.delivered, u.pct(r.rcs.sent ? r.rcs.delivered / r.rcs.sent : null)], ['Lus', r.rcs.read, u.pct(r.rcsRead, 0)], ['Clics boutons', r.rcs.clicks, u.pct(r.rcsClick, 1)], ['STOP', r.rcs.stop, '', '#E5484D']] : null;
    const bounces = hasE ? `<dl class="mini-kv" style="margin-top:14px"><dt>Hard bounces (adresses invalides)</dt><dd>${u.n(r.email.hard)} · ${u.pct(r.hardRate, 2)}</dd><dt>Soft bounces (boîte pleine, indisponible)</dt><dd>${u.n(r.email.soft)} · ${u.pct(r.email.sent ? r.email.soft / r.email.sent : null, 2)}</dd><dt>Plaintes pour spam</dt><dd>${u.n(r.email.complaints)} · ${u.pct(r.complaintRate, 2)}</dd>${c.invalidImport ? `<dt>Invalides à l'import (base client)</dt><dd><span class="badge b-orange">${u.pct(c.invalidImport)} — anormal</span></dd>` : ''}</dl>` : '';
    const hr = hourly(c, r);
    const curve = CH.line({ labels: hr.lab, height: 220, maxTicks: 12, noPartial: true, series: [{ name: hasE ? 'Ouvertures' : hasR ? 'Lectures' : 'Délivrés', data: hr.a, color: '#233F93', area: true }, { name: 'Clics', data: hr.b, color: '#00ADDA' }] });
    const linkCard = hasE && k.email.links.length ? UI.card('Carte des clics <small>liens les plus cliqués</small>', CH.hbars(k.email.links.map(l => ({ label: l.label, value: Math.round(r.email.clicks * l.share), sub: u.pct(l.share, 0) }))) + `<div class="note" style="margin-top:10px">Liens trackés par la plateforme email · redirections contrôlées avant envoi.</div>`) : '';
    const dev = hasE ? UI.card('Répartition par appareil', CH.donut((() => { const tot = r.email.opens, v0 = Math.round(tot * c.dev[0]), v1 = Math.round(tot * c.dev[1]); return [v0, v1, tot - v0 - v1]; })().map((v, i) => ({ label: D.DEVICES[i], value: v, color: CH.PALETTE[i] })), { size: 150, centerSub: 'ouvreurs' }))
      : UI.card('Clics par système mobile', CH.donut((() => { const tot = r.clicks, a = 0.6 + (c.dev[1] % 0.08), v0 = Math.round(tot * a), v1 = Math.round(tot * (0.985 - a)); return [v0, v1, tot - v0 - v1]; })().map((v, i) => ({ label: ['Android', 'iOS', 'Autres'][i], value: v, color: CH.PALETTE[i] })), { size: 150, centerSub: 'cliqueurs' }) + `<div class="note" style="margin-top:8px">SMS et RCS sont reçus sur mobile : la répartition se fait par système, pas par appareil.</div>`);
    const ops = hasS ? UI.card('SMS — accusés de réception par opérateur', UI.table({ title: 'Accusés par opérateur', columns: ['Opérateur', { label: 'Envoyés', align: 'r' }, { label: 'Délivrés', align: 'r' }, { label: 'Taux', align: 'r' }, { label: 'STOP', align: 'r' }],
      rows: D.OPERATORS.map((o, i) => { const s = Math.round(r.sms.sent * c.ops[i]), dl = Math.round(r.sms.delivered * c.ops[i] * (1 + (i - 1.5) * 0.004)); return [o, s, Math.min(s, dl), s ? Math.min(s, dl) / s : null, Math.round(r.sms.stop * c.ops[i])]; }),
      render: x => [x[0], u.n(x[1]), u.n(x[2]), u.pct(x[3]), u.n(x[4])] }).html + `<div class="note" style="margin-top:8px">Accusés de réception et STOP (MO) remontés par Sinch ${UI.sim()} · ${u.n(r.sms.stop)} STOP ajoutés automatiquement à la liste d'exclusion.</div>`) : '';
    const rcs = hasR ? UI.card('RCS — lectures et clics par bouton', CH.hbars(K.forCamp(c).rcs.buttons.map((b, i) => ({ label: b, value: r.btn[i] || 0 })), {}) + `<dl class="mini-kv" style="margin-top:14px"><dt>Mobiles compatibles RCS</dt><dd>${u.n(c.parts.find(p => p.ch === 'rcs').vol)} · ${u.pct(c.parts.find(p => p.ch === 'rcs').vol / c.volume, 0)} de la cible</dd><dt>Part basculée en SMS (repli)</dt><dd>${u.n(c.parts.filter(p => p.fallback).reduce((a, p) => a + p.vol, 0))} · ${u.pct(c.parts.filter(p => p.fallback).reduce((a, p) => a + p.vol, 0) / c.volume, 0)}</dd><dt>Taux de lecture</dt><dd>${u.pct(r.rcsRead, 0)}</dd></dl>`) : '';
    const d2s = cl.d2s ? UI.card('Drive-to-store <small>CA déclaré par le client</small>', `<dl class="mini-kv"><dt>Coût de la campagne (HT)</dt><dd>${UI.money(bill.amount)} ${bill.estimate ? '<small class="muted">estimé</small>' : ''}</dd><dt>CA magasin déclaré</dt><dd>${rev != null ? UI.money(rev) : '<span class="badge b-grey">attendu à J+' + c.lag + ' (' + u.fmtDate(u.addDays(c.end, c.lag)) + ')</span>'}</dd><dt>ROAS (CA / coût)</dt><dd>${rev != null ? '<b>' + u.dec(rev / bill.amount, 1) + '</b>' : '—'}</dd><dt>Coût par contact délivré</dt><dd>${cpc ? u.dec(cpc, 2) + ' €' : '—'}</dd><dt>Coût par cliqueur</dt><dd>${r.clicks ? u.dec(bill.amount / r.clicks, 2) + ' €' : '—'}</dd><dt>Magasins concernés</dt><dd>${cl.stores}</dd></dl><div class="note" style="margin-top:10px">Le CA est saisi par la directrice de clientèle à réception de la déclaration du client ; il n'est jamais calculé par LDS.</div>`) : '';
    const ab = abCard(c, k, r);
    el.innerHTML = `<div class="grid g6" style="margin-top:16px">${kp}</div>
      <div class="grid" style="grid-template-columns:1.5fr 1fr">${UI.card('Entonnoir' + (st === 'en_cours' ? ' <span class="pill-live"><span class="dot"></span>en direct</span>' : ''), (fe ? funnel(fe) : '') + (fs ? (fe ? '<div style="height:14px"></div>' : '') + funnel(fs) : '') + (fr ? '<div style="height:14px"></div>' + funnel(fr) : '') + bounces, { id: 'c-funnel' })}${UI.card('Chronologie des statuts', timeline(hist))}</div>
      <div class="grid" style="grid-template-columns:1.6fr 1fr">${UI.card((hasE ? 'Ouvertures' : hasR ? 'Lectures' : 'Délivrés') + (hr.q === 4 ? ' et clics par quart d\'heure <small>depuis le départ · en direct</small>' : ' et clics heure par heure <small>premières heures après le départ</small>'), curve)}${dev}</div>
      <div class="grid g2">${[linkCard, ops, rcs, d2s, ab].filter(Boolean).join('')}</div>`;
  };
  T.live = function (el, c) {
    const r = S.campResults(c);
    el.querySelectorAll('[data-live]').forEach(x => { const v = u.n(r[x.dataset.live]); if (x.textContent !== v) { x.textContent = v; x.classList.remove('bump'); void x.offsetWidth; x.classList.add('bump'); } });
  };

  T.contenu = function (el, c, user) {
    const k = K.forCamp(c), cl = R.client(c.client), chk = W.contentCheck(Object.assign({}, c, { content: k }));
    let h = `<div class="grid" style="grid-template-columns:1fr 340px;margin-top:16px;align-items:start"><div style="display:flex;flex-direction:column;gap:16px">`;
    if (k.email) {
      const e = k.email;
      h += UI.card(`${UI.icon('mail')} Email <div class="seg" style="margin-left:10px"><button class="on" data-pv="desk">Bureau</button><button data-pv="mobile">Mobile</button></div>`, `<div id="pv-mail">${K.emailPreview(c, k, 'desk')}</div>`, { tools: `<small class="muted">${e.file ? '<span class="mono">' + u.esc(e.file) + '</span> · ' : ''}${e.source === 'zip' ? 'archive ' + u.dec(e.zipKb, 1) + ' ko · décompression en production' : 'Poids ' + u.dec(e.weight, 1) + ' ko · ' + e.images + ' images · textes alternatifs ' + (e.noAlt ? e.noAlt + ' manquant(s)' : e.alt ? 'présents' : 'manquants')}</small>` });
    }
    const phones = [];
    if (k.sms) { const sc = K.smsCount(K.fill(k.sms.text, cl)); phones.push(`<div>${K.smsPreview(c, k)}<div class="smsmeter" style="margin-top:10px;justify-content:center"><span><b>${sc.len}</b> caractères</span><span><b>${sc.parts}</b> SMS</span><span>${sc.unicode ? '<b style="color:var(--orange)">Unicode</b>' : '<b>GSM 7 bits</b>'}</span></div></div>`); }
    if (k.rcs) phones.push(K.rcsPreview(c, k));
    if (phones.length) h += UI.card(`${UI.icon('phone')} ${k.rcs ? 'RCS' + (k.sms ? ' et SMS de repli' : '') : 'SMS'} — aperçu téléphone`, `<div class="preview-wrap" style="justify-content:center">${phones.join('')}</div>`);
    h += `</div><div style="display:flex;flex-direction:column;gap:16px">`;
    h += UI.card('Paramètres', `<dl class="mini-kv">${k.email ? `<dt>Expéditeur</dt><dd>${u.esc(k.email.from)}</dd><dt>Adresse</dt><dd class="mono">${u.esc(k.email.fromEmail)}</dd><dt>Objet</dt><dd>${u.esc(k.email.subject)}</dd><dt>Pré-header</dt><dd>${u.esc(k.email.preheader)}</dd>` : ''}${k.sms ? `<dt>Émetteur SMS</dt><dd class="mono">${u.esc(k.sms.sender)}</dd>` : ''}${k.rcs ? `<dt>Agent RCS</dt><dd>${u.esc(k.rcs.agent)} ✔</dd><dt>Boutons</dt><dd>${k.rcs.buttons.map(u.esc).join(' · ')}</dd>` : ''}<dt>Personnalisation</dt><dd class="mono">{{prenom}} {{magasin}} {{lien}}</dd>${c.ab ? `<dt>Test A/B</dt><dd>${u.esc((LD.wizAb ? LD.wizAb.AB_LABEL[c.ab.kind] : c.ab.kind) || c.ab.kind)} — B : ${u.esc(abValues(c, k).b)}</dd>` : ''}</dl>`);
    h += UI.card('Mentions obligatoires', `<div class="checks">${UI.checks(chk.items)}</div><div class="note" style="margin-top:8px">✕ bloquant avant BAT et validation · ! signalé sans bloquer.</div>`);
    if (k.email && k.email.links.length) h += UI.card('Liens trackés', `<div class="checks">${k.email.links.map(l => `<div class="chk ok"><span class="m">✓</span><span>${u.esc(l.label)}<br><small class="mono muted">${u.esc(l.url)}</small></span></div>`).join('')}</div><div class="note" style="margin-top:8px">Réponse HTTP 200 vérifiée sur chaque lien ${UI.sim('simulé')}</div>`);
    el.innerHTML = h + '</div></div>';
    el.querySelectorAll('[data-pv]').forEach(b => b.onclick = () => { el.querySelectorAll('[data-pv]').forEach(x => x.classList.toggle('on', x === b)); el.querySelector('#pv-mail').innerHTML = K.emailPreview(c, k, b.dataset.pv); });
  };

  // Ciblage : critères et entonnoir de comptage (base de contacts virtuelle)
  function targetOf(c) {
    if (c.target) return c.target;
    const cl = R.client(c.client), r = u.rng('tg' + c.id), vol = c.volume;
    const raw = Math.round(vol * r.range(1.35, 1.9));
    const ex = [['Désinscrits / STOP', Math.round(raw * r.range(0.04, 0.07))], ['Repoussoir client', Math.round(raw * r.range(0.05, 0.12))], ['Pression marketing (< ' + LD.config.PRESSURE_DAYS + ' j)', Math.round(raw * r.range(0.08, 0.15))]];
    const after = raw - u.sum(ex, x => x[1]);
    return { source: c.type === 'routage' ? 'Base client importée' : 'Base LDS (opt-in partenaires)', criteria: cl.d2s ? ['25-55 ans', 'Rayon 15 km autour des ' + cl.stores + ' magasins', 'Intérêt : ' + R.sector(cl.sector).label.toLowerCase(), 'Actifs 6 mois'] : ['CSP+', '30-60 ans', 'France entière', 'Intérêt : ' + R.sector(cl.sector).label.toLowerCase()], raw, ex, after, cap: vol };
  }
  T.ciblage = function (el, c) {
    const t = targetOf(c), cl = R.client(c.client);
    const segs = D.segments.filter(s => s.client === c.client);
    const rows = [['Contacts correspondant aux critères', t.raw]].concat(t.ex.map(x => ['− ' + x[0], -x[1]])).concat([['Après exclusions', t.after], ['Plafond retenu (volume commandé)', Math.min(t.after, t.cap)]]);
    el.innerHTML = `<div class="grid g2" style="margin-top:16px">
      ${UI.card('Critères <small>' + u.esc(t.source) + '</small>', `<div class="chips">${t.criteria.map(x => `<span class="chip on">${u.esc(x)}</span>`).join('')}</div><div class="note" style="margin-top:12px">${c.type === 'routage' ? 'Fichier client importé, colonnes mises en correspondance, doublons et formats contrôlés.' : 'Comptage sur la base de contacts LDS ' + UI.sim('base virtuelle — branchement reporté')}</div>`)}
      ${UI.card('Entonnoir de comptage', `<div class="fun2">${rows.map(x => `<div><span>${u.esc(x[0])}</span><b class="${x[1] < 0 ? 'neg' : ''}">${x[1] < 0 ? '− ' + u.n(-x[1]) : u.n(x[1])}</b></div>`).join('')}</div>`)}
      ${UI.card('Segments enregistrés de ' + u.esc(cl.name), UI.table({ title: 'Segments', columns: ['Segment', { label: 'Contacts', align: 'r' }, 'Mis à jour', { label: 'Utilisations', align: 'r' }], rows: segs, render: s => [u.esc(s.label), u.n(s.count), u.fmtDate(s.updated), s.uses] }).html, { cls: 'span2' })}</div>`;
  };

  T.bat = function (el, c, user) {
    const st = S.status(c), ov = LD.state().ov[c.id] || {}, v = ov.batV || (S.PRE.includes(st) && st === 'brouillon' ? 0 : 1);
    const list = D.batLists[c.client], com = LD.state().batc[c.id] || [], k = K.forCamp(c), isC = S.isClient(user);
    const pre = !c.created && R.status(st).step >= 2 ? [{ t: null, date: u.addDays(S.dateOf(c), -6), user: 'u-client', text: 'Validé, merci. Pensez à bien mentionner les conditions en bas de l\'email.', approve: true, v: 1, cl: true }] : [];
    const all = pre.concat(com);
    const prev = k.email ? K.emailPreview(c, k, 'desk') : k.rcs ? K.rcsPreview(c, k) : K.smsPreview(c, k);
    el.innerHTML = `<div class="grid" style="grid-template-columns:1.4fr 1fr;margin-top:16px;align-items:start">
      ${UI.card(`BAT ${v ? 'v' + v : '— non préparé'} ${st === 'bat' ? '<span class="badge b-orange">en attente du client</span>' : R.status(st).step >= 2 || st === 'bat_ok' ? '<span class="badge b-green">validé par le client</span>' : ''}`, `<div class="preview-wrap" style="justify-content:center">${prev}</div>`, { foot: 'Mise à disposition simulée : aucun email ni SMS de BAT n\'est réellement envoyé.' })}
      <div style="display:flex;flex-direction:column;gap:16px">
        ${isC && st === 'bat' ? UI.card('Votre décision', `<div class="fld"><label>Commentaire (facultatif)</label><textarea id="bat-txt" placeholder="Ex. : remplacer le visuel, corriger le prix…"></textarea></div><div class="split" style="margin-top:10px"><button class="btn ok" id="bat-ok">${UI.icon('check')}Valider le BAT</button><button class="btn" id="bat-com">Envoyer un commentaire</button></div><div class="note" style="margin-top:8px">C'est la seule action possible depuis l'espace client. Elle est tracée au journal.</div>`) : ''}
        ${UI.card('Destinataires du BAT <small>liste mémorisée par client</small>', `<div class="checks">${list.map(x => `<div class="chk ok"><span class="m">✓</span><span><b style="font-weight:500">${u.esc(x.name)}</b><br><small class="muted mono">${u.esc(x.email)} · ${u.esc(x.mobile)}</small></span></div>`).join('')}</div>`)}
        ${UI.card('Versions et commentaires', all.length ? `<div style="display:flex;flex-direction:column;gap:8px">${all.map(x => `<div class="comment ${x.cl || (R.user(x.user) || {}).kind === 'client' ? 'cl' : ''}"><header><b>${u.esc((R.user(x.user) || {}).name || 'Client')}</b><span>v${x.v} · ${x.t ? u.fmtDateTime(new Date(x.t)).slice(0, 16) : u.fmtDate(x.date)}</span></header>${x.approve ? '<span class="badge b-green">BAT validé</span> ' : ''}${u.esc(x.text)}</div>`).join('')}</div>` : '<div class="note">Aucun commentaire pour l\'instant.</div>')}
      </div></div>`;
    const ok = el.querySelector('#bat-ok'), cm = el.querySelector('#bat-com'), tx = el.querySelector('#bat-txt');
    if (ok) ok.onclick = () => { if (UI.result(W.approveBat(c, user, tx.value || 'BAT validé.'))) LD.app.renderView(); };
    if (cm) cm.onclick = () => { if (UI.result(W.commentBat(c, user, tx.value))) LD.app.renderView(); };
  };

  T.prog = function (el, c) {
    const C = LD.config, hasS = c.parts.some(p => p.ch !== 'email');
    el.innerHTML = `<div class="grid g2" style="margin-top:16px">
      ${UI.card('Programmation', `<dl class="mini-kv">${c.parts.map((p, i) => `<dt>Envoi ${i + 1} · ${p.fallback ? 'SMS de repli' : R.channel(p.ch).label}</dt><dd>${u.fmtDate(S.partDate(c, p))} à ${W.H2(p.off ? p.hour : S.hourOf(c))} · ${u.n(p.vol)} messages</dd>`).join('')}<dt>Vagues</dt><dd>${c.waves} ${c.waves > 1 ? '(30 min de pause entre vagues)' : ''}</dd><dt>Débit maximal</dt><dd>${u.n(c.throughput)} messages / heure</dd>${W.sendPlan(c, S.dateOf(c), S.hourOf(c)).sort((a, b) => a.off - b.off).map(x => `<dt>Fin estimée · ${x.fam === 'sms' ? 'SMS / RCS' : 'Email'} ${x.off ? 'J+' + x.off : 'J0'}</dt><dd style="color:${x.fam === 'sms' && x.end > C.SMS_WINDOW[1] ? 'var(--red)' : 'inherit'}">${W.H2(x.end)} <small class="muted">(départ ${W.H2(x.start)}, ${u.dec(x.dur, 1)} h)</small></dd>`).join('')}<dt>Charge du routage ce jour</dt><dd>${u.n(S.dayLoad(S.dateOf(c)))} / ${u.n(C.CAPACITY_DAY)}</dd></dl>`)}
      ${UI.card('Fenêtres d\'envoi autorisées', `<div class="checks"><div class="chk ok"><span class="m">✓</span><span>Email : ${C.EMAIL_WINDOW[0]} h – ${C.EMAIL_WINDOW[1]} h, tous les jours</span></div><div class="chk ${hasS ? 'ok' : 'wa'}"><span class="m">${hasS ? '✓' : '–'}</span><span>SMS / RCS : départ et fin d'envoi entre ${C.SMS_WINDOW[0]} h et ${C.SMS_WINDOW[1]} h, pas le dimanche ni les jours fériés (même un samedi) ${UI.legal()}</span></div><div class="chk ok"><span class="m">✓</span><span>Exclusion des contacts sollicités depuis moins de ${C.PRESSURE_DAYS} jours</span></div></div><div class="note" style="margin-top:10px">Ces règles sont vérifiées à la programmation, au glisser-déposer dans le planning et au lancement. Réglage : Administration.</div>`)}</div>`;
  };

  T.facturation = function (el, c, user) {
    const b = S.billing(c), cl = R.client(c.client), bd = S.bdc(c.client);
    el.innerHTML = `<div class="grid g2" style="margin-top:16px">
      ${UI.card('Montant de la campagne <small>proposition, ajustable</small>', `<div class="bill-sum"><span>Volume facturable (${b.basis}, selon contrat)</span><b>${u.n(b.qty)}</b><span>Prix au mille (${c.type === 'routage' ? 'routage base client' : 'location base LDS'}) <small class="muted">${LD.config.PRICE_NOTE}</small></span><b>${S.isClient(user) || !(user.rights && user.rights.billing) ? u.dec(b.cpm, 2) + ' €' : `<input type="number" step="1" min="1" id="cpm-adj" value="${b.cpm}" style="width:76px;font:inherit;font-size:13px;padding:2px 6px;border:1px solid ${b.adjusted ? 'var(--orange)' : '#CFD9EA'};border-radius:6px;text-align:right"> €`}${b.adjusted ? ' <span class="badge b-orange">ajusté · grille ' + u.dec(b.grid, 2) + ' €</span>' : ''}</b><span>Média</span><b>${UI.money(b.media, true)}</b><span>Création graphique</span><b>${b.crea ? UI.money(b.crea, true) : '—'}</b><span class="t">Total HT ${b.estimate ? '(estimé)' : ''}</span><b class="t">${UI.money(b.amount, true)}</b></div>`)}
      ${UI.card('Bon de commande ' + u.esc(cl.name), CH.gauge(bd.consumed, { max: bd.amount, target: bd.amount * LD.config.THRESH.bdc, label: 'Consommé ' + UI.money(bd.consumed) + ' sur ' + UI.money(bd.amount) + ' · ' + u.pct(bd.ratio, 0) + ' · alerte à ' + u.pct(LD.config.THRESH.bdc, 0) }) + `<dl class="mini-kv" style="margin-top:12px"><dt>Contrat</dt><dd>${u.esc(cl.contract)}</dd><dt>Reste</dt><dd>${UI.money(bd.rest)}</dd><dt>Engagé à venir</dt><dd>${UI.money(bd.planned)}</dd></dl>`)}</div>`;
    const inp = el.querySelector('#cpm-adj');
    if (inp) inp.onchange = () => { if (!(+inp.value > 0)) { UI.toast('Prix au mille invalide', 'err'); return; } const nb = S.setCpm(c, +inp.value, user); LD.app.renderView(); UI.toast('Prix au mille ' + (nb.adjusted ? 'ajusté à ' + nb.cpm + ' €' : 'remis à la grille') + ' — repris dans la facturation, le BDC et l’espace client', 'ok'); };
  };

  T.journal = function (el, c, user, hist) {
    el.innerHTML = `<div style="margin-top:16px">${UI.card('Journal de la campagne', timeline(hist.slice().reverse()), { foot: 'Toutes les actions (création, BAT, validation, programmation, lancement, pause, annulation, export) sont tracées avec leur auteur et leur heure.' })}</div>`;
  };

  LD.campTabs = T;
})(window.LD);
