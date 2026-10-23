/* workflow.js : règles métier du parcours d'une campagne et des livraisons.
 * Brouillon → BAT → BAT validé client → À valider → Validée → Programmée → En cours → Terminée.
 * Chaque action contrôle les droits et les règles, journalise, et ne fait AUCUN appel réseau.
 */
(function (LD) {
  'use strict';
  const u = LD.u, R = LD.ref, C = LD.config, D = LD.data, S = LD.store, TODAY = LD.TODAY;
  const st = () => LD.state();
  const ov = id => (st().ov[id] = st().ov[id] || {});
  const fail = msg => ({ ok: false, msg });
  const done = (msg, warn) => ({ ok: true, msg, warn: warn || [] });
  const H2 = h => u.pad(Math.floor(h)) + 'h' + (h % 1 ? u.pad(Math.round((h % 1) * 60)) : '');

  // Jour férié reconnu quel que soit le jour de la semaine (y compris un samedi)
  function isHoliday(d) { return u.holidays(+d.slice(0, 4)).has(d); }
  function smsDayOk(d) { return (u.dow(d) !== 0 || C.SMS_SUNDAY) && (!isHoliday(d) || C.SMS_HOLIDAYS); }
  function nextSmsDay(d) { let x = u.addDays(d, 1); while (!smsDayOk(x)) x = u.addDays(x, 1); return x; }
  const WAVE_GAP = 0.5; // pause de 30 min entre deux vagues
  // Fenêtres d'envoi (SMS / RCS : règle à confirmer avec le juridique)
  function windowCheck(ch, date, hour) {
    const errs = [];
    if (ch === 'sms' || ch === 'rcs') {
      if (hour < C.SMS_WINDOW[0] || hour >= C.SMS_WINDOW[1]) errs.push('SMS / RCS : envoi autorisé de ' + C.SMS_WINDOW[0] + ' h à ' + C.SMS_WINDOW[1] + ' h uniquement');
      if (u.dow(date) === 0 && !C.SMS_SUNDAY) errs.push('SMS / RCS : pas d\'envoi le dimanche');
      if (isHoliday(date) && !C.SMS_HOLIDAYS) errs.push('SMS / RCS : pas d\'envoi un jour férié (' + u.DOWS[u.dow(date)].toLowerCase() + ' ' + u.fmtDate(date) + ')');
    } else if (hour < C.EMAIL_WINDOW[0] || hour >= C.EMAIL_WINDOW[1]) errs.push('Email : fenêtre ' + C.EMAIL_WINDOW[0] + ' h – ' + C.EMAIL_WINDOW[1] + ' h');
    return errs;
  }
  // Heures de fin estimées : un groupe par jour d'envoi et par famille de canal (SMS / RCS d'un côté, email de l'autre).
  // Fin = départ + volume / débit + (vagues − 1) × 30 min de pause.
  function sendPlan(c, date, hour) {
    const g = {};
    c.parts.forEach(p => {
      const fam = p.ch === 'email' ? 'email' : 'sms', k = p.off + '|' + fam;
      const x = g[k] = g[k] || { off: p.off, fam, date: u.addDays(date, p.off), start: p.off ? p.hour : hour, vol: 0 };
      x.vol += p.vol;
    });
    const tp = c.throughput || 50000, w = c.waves || 1;
    return Object.values(g).map(x => Object.assign(x, { tp, waves: w, dur: x.vol / tp + (w - 1) * WAVE_GAP, end: x.start + x.vol / tp + (w - 1) * WAVE_GAP }));
  }
  // Proposition quand un envoi SMS / RCS finirait après la fenêtre : avancer le départ ou reporter le reste au jour suivant
  function smsAdvice(x) {
    const lim = C.SMS_WINDOW[1], latest = Math.floor((lim - x.dur) * 4) / 4;
    const fit = Math.max(0, Math.floor((lim - x.start - (x.waves - 1) * WAVE_GAP) * x.tp / 100) * 100);
    return { latest: latest >= C.SMS_WINDOW[0] ? latest : null, fit: Math.min(fit, x.vol), rest: Math.max(0, x.vol - fit), next: nextSmsDay(x.date) };
  }
  function campWindow(c, date, hour) {
    let e = [];
    c.parts.forEach(p => { e = e.concat(windowCheck(p.ch, u.addDays(date, p.off), p.off ? p.hour : hour)); });
    sendPlan(c, date, hour).forEach(x => {
      if (x.fam !== 'sms' || x.end <= C.SMS_WINDOW[1] + 1e-9 || x.start >= C.SMS_WINDOW[1]) return;
      const a = smsAdvice(x);
      e.push('SMS / RCS : fin d\'envoi estimée à ' + H2(x.end) + ' le ' + u.fmtDate(x.date) + ', après ' + C.SMS_WINDOW[1] + ' h (' + u.n(x.vol) + ' messages à ' + u.n(x.tp) + ' / h' + (x.waves > 1 ? ', ' + x.waves + ' vagues' : '') + ')'
        + ' — proposition : ' + (a.latest != null ? 'avancer le départ à ' + H2(a.latest) + ' au plus tard, ou ' : '') + (a.fit ? 'envoyer ' + u.n(a.fit) + ' messages ce jour-là et une vague de ' + u.n(a.rest) + ' le ' + u.fmtDate(a.next) : 'reporter l’envoi complet au ' + u.fmtDate(a.next)));
    });
    return [...new Set(e)];
  }
  // Lien de désinscription : un vrai lien <a href> vers une URL ou un placeholder de désinscription ({{desinscription}}),
  // dont le texte ou l'URL renvoie à la désinscription. Le mot seul dans le texte ne suffit pas.
  const UNSUB = /d[ée]sinscri|d[ée]sabonn|unsubscribe|opt-?out/i, PH = /^\{\{\s*[a-z_]+\s*\}\}$/i, URLX = /^https?:\/\/[^\s"'<>]+$/i;
  const htmlCache = new Map();
  function htmlLinks(html) {
    html = html || ''; if (htmlCache.has(html)) return htmlCache.get(html);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const links = [...doc.querySelectorAll('a')].map(a => ({ href: (a.getAttribute('href') || '').trim(), text: (a.textContent || '').trim() || ((a.querySelector('img') || {}).alt || '') }));
    const imgs = [...doc.querySelectorAll('img')], o = { links, images: imgs.length, noAlt: imgs.filter(i => !(i.getAttribute('alt') || '').trim()).length };
    if (htmlCache.size > 200) htmlCache.clear(); htmlCache.set(html, o); return o;
  }
  // La destination elle-même doit être une désinscription (URL contenant desinscription / unsubscribe / opt-out, ou {{desinscription}}) : un libellé « Se désinscrire » vers une autre page est refusé.
  function unsubOk(html) { return htmlLinks(html).links.some(l => (URLX.test(l.href) || PH.test(l.href)) && UNSUB.test(l.href)); }
  function linkOk(l) { return URLX.test(l.href) || PH.test(l.href) || /^mailto:\S+@\S+$/i.test(l.href); }
  // Contrôle des mentions obligatoires (avant BAT et validation) ; warn = signalé sans bloquer
  function contentCheck(c) {
    const k = c.content; if (!k) return { ok: true, items: [{ ok: true, label: 'Contenu contrôlé à la préparation (campagne historique)' }] };
    const items = [];
    if (k.email) {
      const e = k.email, an = htmlLinks(e.html), bad = an.links.filter(l => !linkOk(l));
      items.push({ ok: unsubOk(e.html), label: 'Email : lien de désinscription présent (balise <a href> dont la destination est une désinscription : {{desinscription}} ou URL de désinscription)' });
      items.push({ ok: !!(e.from && e.from.trim()), label: 'Email : expéditeur identifiant l\'annonceur' });
      items.push({ ok: !!(e.subject && e.subject.trim()), label: 'Email : objet renseigné' });
      items.push({ ok: !bad.length, label: 'Email : liens valides (' + an.links.length + ' lien' + (an.links.length > 1 ? 's' : '') + (bad.length ? ', ' + bad.length + ' invalide(s) : ' + bad.slice(0, 2).map(l => '« ' + (l.href || 'vide') + ' »').join(' ') : '') + ')' });
      if (e.source === 'zip') items.push({ ok: false, warn: true, label: 'Email : archive ' + e.file + ' (' + u.dec(e.zipKb, 1) + ' ko) importée — décompression, poids du HTML et images contrôlés en production (simulé) ; contrôles ci-dessous sur le gabarit courant' });
      items.push({ ok: (e.weight || 0) <= 100, warn: true, label: 'Email : poids du HTML ' + u.dec(e.weight || 0, 1) + ' ko (au-delà de 100 ko, Gmail tronque le message)' });
      const noAlt = e.html && an.images ? an.noAlt : (e.alt === false ? 1 : 0);
      items.push({ ok: !noAlt, warn: true, label: 'Email : textes alternatifs des images' + (noAlt ? ' — ' + noAlt + ' image(s) sans alt' : ' présents') });
    }
    if (k.sms) {
      items.push({ ok: /STOP\s?(au\s)?[0-9X]{5}|STOP SMS/i.test(k.sms.text || ''), label: 'SMS : mention STOP (désinscription) présente' });
      items.push({ ok: !!k.sms.sender && k.sms.sender.length <= 11 && /^[A-Za-z0-9 ]+$/.test(k.sms.sender), label: 'SMS : émetteur alphanumérique ≤ 11 caractères (identifie l\'annonceur)' });
    }
    if (k.rcs) {
      items.push({ ok: !!k.rcs.agent, label: 'RCS : agent vérifié de la marque' });
      items.push({ ok: /STOP/i.test(k.rcs.text || ''), label: 'RCS : mention STOP présente' });
    }
    return { ok: items.every(i => i.ok || i.warn), items };
  }

  function canValidate(user, c) { return !!user && user.kind === 'dir' && R.client(c.client).dir === user.id; }
  function canEdit(user) { return !!user && user.rights.create; }

  const A = {
    sendBat(c, user) {
      if (!canEdit(user)) return fail('Action réservée aux équipes LDS');
      if (!['brouillon', 'bat'].includes(S.status(c))) return fail('Le BAT se prépare sur une campagne en brouillon ou en BAT');
      const k = contentCheck(c); if (!k.ok) return fail('Mentions obligatoires manquantes : ' + k.items.filter(i => !i.ok && !i.warn).map(i => i.label).join(' · '));
      const o = ov(c.id); o.status = 'bat'; o.batV = (o.batV || 1) + (o.batSent ? 1 : 0); o.batSent = true;
      S.log('BAT v' + o.batV + ' mis à disposition du client (simulé — aucun envoi)', c.id, user);
      return done('BAT v' + o.batV + ' mis à disposition du client — simulé, aucun envoi réel');
    },
    approveBat(c, user, comment) {
      if (S.status(c) !== 'bat') return fail('Aucun BAT en attente de validation');
      if (user.kind === 'client' && user.client !== c.client) return fail('Accès refusé');
      if (!user.rights.create && user.kind !== 'client') return fail('Action non autorisée');
      const o = ov(c.id); o.status = 'bat_ok'; o.batBy = user.id;
      addComment(c, user, comment || 'BAT validé.', true);
      S.log('BAT v' + (o.batV || 1) + ' validé' + (user.kind === 'client' ? ' par le client' : ' (pour le compte du client)'), c.id, user); LD.save();
      return done('BAT validé');
    },
    commentBat(c, user, text) {
      if (!text || !text.trim()) return fail('Commentaire vide');
      if (user.kind === 'client' && user.client !== c.client) return fail('Accès refusé');
      addComment(c, user, text, false); S.log('Commentaire sur le BAT', c.id, user); return done('Commentaire enregistré');
    },
    submit(c, user) {
      if (!canEdit(user)) return fail('Action réservée aux équipes LDS');
      if (S.status(c) !== 'bat_ok') return fail('Le BAT doit être validé par le client avant la validation interne');
      ov(c.id).status = 'a_valider'; S.log('Soumise à la validation de ' + R.user(R.client(c.client).dir).name, c.id, user); LD.save();
      return done('Soumise à la validation de la directrice de clientèle');
    },
    validate(c, user) {
      if (S.status(c) !== 'a_valider') return fail('La campagne n\'est pas en attente de validation');
      if (!canValidate(user, c)) return fail('Seule la directrice du compte (' + R.user(R.client(c.client).dir).name + ') peut valider cette campagne');
      const k = contentCheck(c); if (!k.ok) return fail('Mentions obligatoires manquantes');
      ov(c.id).status = 'validee'; ov(c.id).validatedBy = user.id; S.log('Validée', c.id, user); LD.save();
      return done('Campagne validée');
    },
    reject(c, user, reason) {
      if (S.status(c) !== 'a_valider') return fail('La campagne n\'est pas en attente de validation');
      if (!canValidate(user, c)) return fail('Seule la directrice du compte peut refuser');
      ov(c.id).status = 'bat_ok'; S.log('Renvoyée au chargé : ' + (reason || 'à reprendre'), c.id, user); LD.save();
      return done('Renvoyée au chargé de campagne');
    },
    schedule(c, user, date, hour) {
      if (!canEdit(user)) return fail('Action réservée aux équipes LDS');
      if (!['validee', 'programmee'].includes(S.status(c))) return fail('Seule une campagne validée peut être programmée');
      date = date || S.dateOf(c); hour = hour != null ? hour : S.hourOf(c);
      if (date < TODAY) return fail('Date passée');
      const w = campWindow(c, date, hour); if (w.length) return fail(w.join(' · '));
      const warn = loadWarn(c, date);
      const o = ov(c.id); o.status = 'programmee'; o.date = date; o.hour = hour;
      S.log('Programmée le ' + u.fmtDate(date) + ' à ' + H2(hour) + ' · ' + c.waves + ' vague(s) · débit max ' + u.n(c.throughput) + '/h', c.id, user); LD.save();
      return done('Programmée le ' + u.fmtDate(date) + ' à ' + H2(hour), warn);
    },
    launch(c, user) {
      if (!canEdit(user)) return fail('Action réservée aux équipes LDS');
      if (S.status(c) !== 'programmee') return fail('Seule une campagne programmée peut être lancée');
      const now = LD.now(), h = now.getHours() + now.getMinutes() / 60, pd = S.dateOf(c), ph = S.hourOf(c);
      const early = TODAY < pd || (TODAY === pd && h + 1e-9 < ph);
      if (early && !canValidate(user, c)) return fail('Campagne programmée le ' + u.fmtDate(pd) + ' à ' + H2(ph) + ' : un lancement anticipé est réservé à la directrice de clientèle du compte (' + R.user(R.client(c.client).dir).name + '). Sinon, modifier la programmation.');
      const w = campWindow(c, TODAY, h); if (w.length) return fail('Lancement immédiat impossible : ' + w.join(' · '));
      const o = ov(c.id); o.status = 'en_cours'; o.date = TODAY; o.hour = h; o.launchedAt = now.getTime(); delete o.stoppedAt;
      S.log((early ? 'Lancement anticipé (programmé le ' + u.fmtDate(pd) + ' à ' + H2(ph) + ')' : 'Lancement') + ' — simulé, aucun appel API', c.id, user); LD.save();
      return done('Lancement simulé — aucun message réellement envoyé');
    },
    pause(c, user) {
      if (!canEdit(user)) return fail('Action réservée aux équipes LDS');
      if (S.status(c) !== 'en_cours') return fail('Seule une campagne en cours peut être mise en pause');
      const p = S.partProgress(c, c.parts[0]).prog; const o = ov(c.id); o.status = 'pause'; o.stoppedAt = p; delete o.launchedAt;
      S.log('Mise en pause à ' + u.pct(p, 0) + ' de l\'envoi', c.id, user); LD.save(); return done('Envoi en pause');
    },
    resume(c, user) {
      if (!canEdit(user)) return fail('Action réservée aux équipes LDS');
      if (S.status(c) !== 'pause') return fail('La campagne n\'est pas en pause');
      const o = ov(c.id), p = o.stoppedAt != null ? o.stoppedAt : S.partProgress(c, c.parts[0]).prog;
      { // Reprise : fenêtre d'envoi contrôlée sur l'heure actuelle et sur la fin estimée du reste de l'envoi
        // Même regroupement que sendPlan : volumes SMS + RCS (repli compris) cumulés à débit partagé, reste = part non encore envoyée
        const now = LD.now(), h = now.getHours() + now.getMinutes() / 60, errs = [];
        c.parts.filter(x => !x.off).forEach(x => { windowCheck(x.ch, TODAY, h).forEach(m => errs.push(m)); });
        sendPlan(c, TODAY, h).filter(x => !x.off && x.fam === 'sms').forEach(x => {
          const rem = x.vol * (1 - p), end = h + rem / x.tp + (x.waves - 1) * WAVE_GAP * (1 - p);
          if (h < C.SMS_WINDOW[1] && end > C.SMS_WINDOW[1] + 1e-9) errs.push('SMS / RCS : fin du reste de l\'envoi estimée à ' + H2(end) + ' (' + u.n(Math.round(rem)) + ' messages SMS + RCS restants à ' + u.n(x.tp) + ' / h), après ' + C.SMS_WINDOW[1] + ' h');
        });
        const ue = [...new Set(errs)];
        if (ue.length) return fail('Reprise impossible maintenant : ' + ue.join(' · ') + ' — reprendre dans la fenêtre autorisée (prochaine possibilité SMS : ' + u.fmtDate(smsDayOk(TODAY) && h < C.SMS_WINDOW[0] ? TODAY : nextSmsDay(TODAY)) + ' à partir de ' + C.SMS_WINDOW[0] + ' h)');
      }
      o.status = 'en_cours'; delete o.stoppedAt; o.launchedAt = LD.now().getTime() - p * S.duration(c.parts[0], c) * 3600000;
      if (!o.date) { o.date = S.dateOf(c); } S.log('Reprise de l\'envoi', c.id, user); LD.save(); return done('Envoi repris');
    },
    cancel(c, user) {
      if (!canEdit(user)) return fail('Action réservée aux équipes LDS');
      if (!S.PRE.includes(S.status(c))) return fail('Une campagne lancée s\'arrête par « Arrêt d\'urgence »');
      ov(c.id).status = 'annulee'; S.log('Annulée', c.id, user); LD.save(); return done('Campagne annulée');
    },
    emergency(c, user) {
      if (!canEdit(user)) return fail('Action réservée aux équipes LDS');
      if (!['en_cours', 'pause'].includes(S.status(c))) return fail('Aucun envoi en cours');
      const o = ov(c.id), p = o.stoppedAt != null ? o.stoppedAt : S.partProgress(c, c.parts[0]).prog;
      o.status = 'annulee'; o.stoppedAt = p; delete o.launchedAt;
      S.log('ARRÊT D\'URGENCE à ' + u.pct(p, 0) + ' de l\'envoi (simulé)', c.id, user); LD.save(); return done('Arrêt d\'urgence : envoi stoppé');
    },
    replan(c, user, date) {
      if (!canEdit(user)) return fail('Action réservée aux équipes LDS');
      const s = S.status(c);
      if (!S.PRE.includes(s)) return fail('Campagne déjà lancée : replanification impossible');
      if (date < TODAY) return fail('Impossible de replanifier dans le passé');
      const w = campWindow(c, date, S.hourOf(c)); if (w.length) return fail(w.join(' · '));
      const warn = loadWarn(c, date), o = ov(c.id), from = S.dateOf(c);
      o.date = date; if (s === 'programmee') o.status = 'validee';
      S.log('Replanifiée du ' + u.fmtDate(from) + ' au ' + u.fmtDate(date) + (s === 'programmee' ? ' (programmation à confirmer)' : ''), c.id, user); LD.save();
      return done('Replanifiée au ' + u.fmtDate(date), warn);
    },
    duplicate(c, user) {
      if (!canEdit(user)) return fail('Action réservée aux équipes LDS');
      let d = u.addDays(TODAY, 10); while (!u.isWorkingDay(d)) d = u.addDays(d, 1);
      const n = create(Object.assign({}, c, { name: c.name + ' (copie)', date: d, content: c.content }), user, 'Dupliquée depuis ' + c.id);
      return Object.assign(done('Campagne dupliquée : ' + n.id), { id: n.id });
    }
  };
  function loadWarn(c, date) {
    const w = [], load = S.dayLoad(date, c.id) + u.sum(c.parts.filter(p => p.off === 0), p => p.vol);
    if (load > C.CAPACITY_DAY) w.push('Surcharge du routage le ' + u.fmtDate(date) + ' : ' + u.n(load) + ' messages pour une capacité de ' + u.n(C.CAPACITY_DAY));
    const pr = S.pressure(c.client, date) + (S.dateOf(c) > u.addDays(date, -30) && S.dateOf(c) <= date ? 0 : 1);
    if (pr > C.PRESSURE_MAX_30D) w.push('Pression marketing : ' + pr + ' prises de parole sur 30 jours pour ' + R.client(c.client).name + ' (seuil ' + C.PRESSURE_MAX_30D + ')');
    return w;
  }
  function addComment(c, user, text, approve) {
    const b = st().batc[c.id] = st().batc[c.id] || [];
    b.push({ t: LD.now().getTime(), user: user.id, text, approve: !!approve, v: (st().ov[c.id] && st().ov[c.id].batV) || 1 }); LD.save();
  }

  // Création d'une campagne depuis l'assistant
  let seq = 900;
  function create(d, user, note) {
    const cl = R.client(d.client), ch = d.channel;
    const vols = d.vols || {};
    const parts = [];
    const eh = d.hour != null ? d.hour : 9, sh = d.smsHour != null ? d.smsHour : 11;
    if (ch === 'email') parts.push({ ch: 'email', off: 0, hour: eh, vol: vols.email || 150000 });
    if (ch === 'sms') parts.push({ ch: 'sms', off: 0, hour: sh, vol: vols.sms || 60000 });
    if (ch === 'rcs') { const t = vols.sms || 60000, rv = Math.round(t * C.RCS_SHARE / 100 / 100) * 100; parts.push({ ch: 'rcs', off: 0, hour: sh, vol: rv }, { ch: 'sms', off: 0, hour: sh, vol: t - rv, fallback: true }); }
    if (ch === 'seq') parts.push({ ch: 'sms', off: 0, hour: sh, vol: vols.sms || 60000 }, { ch: 'email', off: d.seqGap || 2, hour: eh, vol: vols.email || 150000 });
    if (d.parts && !d.vols) { parts.length = 0; d.parts.forEach(p => parts.push({ ch: p.ch, off: p.off, hour: p.hour, vol: p.vol, fallback: p.fallback })); }
    while (D.camps.find(x => x.id === 'C-' + d.date.slice(2, 4) + d.date.slice(5, 7) + '-' + seq)) seq++;
    const id = 'C-' + d.date.slice(2, 4) + d.date.slice(5, 7) + '-' + (seq++);
    parts.forEach((p, i) => { p.date = u.addDays(d.date, p.off); p.full = D.partResults(u.rng('new' + id + i), p.ch, p.vol); });
    const c = {
      id, client: cl.id, name: d.name, objective: d.objective || 'Trafic magasin', type: d.type || 'location', channel: ch, cdc: user.kind === 'cdc' ? user.id : cl.cdc, dir: cl.dir,
      date: d.date, hour: parts[0].hour, parts, ab: d.ab || null, waves: d.waves || 1, throughput: d.throughput || (parts[0].ch === 'email' ? 150000 : 50000),
      seed: seq, crea: !!d.crea, dev: [0.66, 0.28, 0.06], ops: [0.35, 0.27, 0.22, 0.16], roas: cl.d2s ? 5.2 : null, lag: 7, content: d.content || null,
      segment: d.segment || null, target: d.target || null, budget: d.budget || null, baseStatus: 'brouillon', created: true
    };
    c.volume = u.sum(parts, p => p.vol); c.end = parts.reduce((m, p) => p.date > m ? p.date : m, c.date);
    D.camps.push(c); st().created.push(c);
    S.log('Création' + (note ? ' — ' + note : ''), id, user); LD.save();
    return c;
  }

  // ---------- Livraisons ----------
  const BLOCTEL_DAYS = 30; // règle à confirmer avec le juridique
  const tmo = t => (st().tm[t.id] = st().tm[t.id] || {});
  function bloctelDate(t) { return (st().tm[t.id] && st().tm[t.id].bloctel) || t.bloctel.date || null; }
  function bloctelOk(t) { const d = bloctelDate(t); return !!d && u.diffDays(d, TODAY) <= BLOCTEL_DAYS; }
  function bloctelRemoved(t) { const o = st().tm[t.id]; return o && o.removed != null ? o.removed : t.bloctel.removed; }
  function bloctelMsg(t) { const d = bloctelDate(t); return d ? 'dernier passage Bloctel le ' + u.fmtDate(d) + ' (plus de ' + BLOCTEL_DAYS + ' jours)' : 'aucun passage Bloctel effectué'; }
  function tmValidator(t) { const o = st().tm[t.id]; return (o && o.by) || t.validatedBy || null; }
  function fileValidator(f) { const o = st().files[f.id]; return (o && o.by) || f.validatedBy || null; }
  const isDirOf = (user, clientId) => !!user && user.kind === 'dir' && R.client(clientId).dir === user.id;
  const dirName = clientId => R.user(R.client(clientId).dir).name;
  const KEYCOL = { email: 'Email', mobile: 'Mobile', postal: 'Adresse' };

  // Création d'une livraison de fichier : tous les choix du formulaire sont enregistrés et persistés
  function createFile(d, user) {
    if (!canEdit(user)) return fail('Action réservée aux équipes LDS');
    const cl = R.client(d.client); if (!cl) return fail('Client inconnu');
    if (!D.KINDS[d.kind]) return fail('Type de fichier inconnu');
    if (!(+d.volume > 0)) return fail('Volume à renseigner');
    if (!d.columns || !d.columns.length) return fail('Choisissez au moins une colonne');
    if (!d.columns.includes(KEYCOL[d.kind])) return fail('La colonne « ' + KEYCOL[d.kind] + ' » est obligatoire pour un ' + D.KINDS[d.kind].toLowerCase());
    if (d.method === 'sftp' && !(d.sftp || '').trim()) return fail('Serveur SFTP du client à renseigner');
    let n = 2500 + st().newFiles.length; while (D.files.find(x => x.id === 'F-' + n)) n++;
    const f = {
      id: 'F-' + n, client: cl.id, kind: d.kind, label: D.KINDS[d.kind] + ' — ' + (d.segLabel || 'ciblage spécifique'), segment: d.segment || null,
      columns: d.columns.slice(), format: d.format === 'Excel' ? 'Excel' : 'CSV', volume: +d.volume, seeds: Math.max(0, Math.round(+d.seeds || 0)), date: TODAY,
      usage: { days: +d.days || 30, uses: +d.uses || 1 }, method: d.method === 'sftp' ? 'sftp' : 'lien', sftp: d.method === 'sftp' ? d.sftp.trim() : null, rgpd: !!d.rgpd,
      status: 'preparation', by: user.id, validatedBy: null, deliveredAt: null, expires: u.addDays(TODAY, 7), downloads: [], cpm: Math.round(cl.cpm * 0.85), created: true
    };
    D.files.unshift(f); st().newFiles.push(f);
    S.log('Livraison de fichier créée — ' + f.format + ', ' + f.usage.uses + ' usage(s) sur ' + f.usage.days + ' j, ' + (f.method === 'sftp' ? 'dépôt SFTP' : 'lien chiffré') + ', ' + f.seeds + ' adresses témoins', f.id, user); LD.save();
    return Object.assign(done('Livraison ' + f.id + ' créée en préparation'), { id: f.id, file: f });
  }
  // Commande de fiches télémarketing : créée en « passage Bloctel requis »
  function createTm(d, user) {
    if (!canEdit(user)) return fail('Action réservée aux équipes LDS');
    const cl = R.client(d.client); if (!cl) return fail('Client inconnu');
    if (!(+d.volume > 0)) return fail('Nombre de fiches à renseigner');
    if (!d.excl || !d.excl.already || !d.excl.repous) return fail('Exclusions obligatoires : les contacts déjà livrés au client et son repoussoir ne peuvent pas être désactivés');
    if (+d.volume > d.available) return fail('Volume demandé (' + u.n(+d.volume) + ') supérieur aux fiches disponibles après exclusions (' + u.n(d.available) + ')');
    if (!d.fields || !d.fields.includes('Téléphone')) return fail('Le champ « Téléphone » est obligatoire');
    if (!d.center) return fail('Centre d\'appels destinataire à choisir');
    let n = 900 + st().newTm.length; while (D.tm.find(x => x.id === 'T-' + n)) n++;
    const t = {
      id: 'T-' + n, client: cl.id, label: (d.label || '').trim() || 'Commande du ' + u.fmtDate(TODAY), criteria: d.criteria || [], volume: +d.volume, fields: d.fields.slice(),
      center: d.center, centerContact: (d.centerContact || '').trim(), wanted: d.wanted || null, date: TODAY, status: 'bloctel', bloctel: { date: null, removed: null },
      excluded: { already: d.excl.already ? d.counts.already : 0, repous: d.excl.repous ? d.counts.repous : 0, optout: d.counts.optout }, exclOn: Object.assign({}, d.excl),
      pool: d.counts.raw, available: d.available, by: user.id, validatedBy: null, deliveredAt: null, returns: null, price: +d.price || 0.25, created: true
    };
    D.tm.unshift(t); st().newTm.push(t);
    S.log('Commande de fiches télémarketing créée (' + u.n(t.volume) + ' fiches, ' + t.center + ') — passage Bloctel requis', t.id, user); LD.save();
    return Object.assign(done('Commande ' + t.id + ' enregistrée — passage Bloctel requis avant validation'), { id: t.id, tm: t });
  }
  const F = {
    validateFile(f, user) {
      if (!isDirOf(user, f.client)) return fail('Seule la directrice du compte (' + dirName(f.client) + ') valide une livraison');
      if (S.fileStatus(f) !== 'a_valider') return fail('Livraison non soumise à validation');
      st().files[f.id] = { status: 'validee', by: user.id, vat: TODAY }; S.log('Livraison de fichier validée', f.id, user); LD.save(); return done('Livraison validée');
    },
    submitFile(f, user) {
      if (!canEdit(user)) return fail('Action réservée aux équipes LDS'); if (S.fileStatus(f) !== 'preparation') return fail('Déjà soumise');
      st().files[f.id] = { status: 'a_valider' }; S.log('Livraison soumise à la validation de ' + dirName(f.client), f.id, user); LD.save(); return done('Soumise à ' + dirName(f.client));
    },
    deliverFile(f, user) {
      if (!canEdit(user)) return fail('Action réservée aux équipes LDS');
      if (S.fileStatus(f) !== 'validee') return fail('Livraison bloquée : validation de la directrice de clientèle obligatoire avant toute livraison');
      st().files[f.id] = Object.assign(st().files[f.id] || {}, { status: 'livree', at: TODAY, by2: user.id });
      S.log('Fichier livré (' + (f.method === 'sftp' ? 'dépôt SFTP sur ' + (f.sftp || 'le serveur du client') : 'lien chiffré, expiration 7 jours') + ' — simulé, aucun envoi)', f.id, user); LD.save(); return done('Livraison simulée — aucun envoi réel');
    },
    runBloctel(t, user) {
      if (!canEdit(user)) return fail('Action réservée aux équipes LDS');
      if (S.tmStatus(t) === 'livree') return fail('Commande déjà livrée');
      const o = tmo(t), before = S.tmStatus(t); o.bloctel = TODAY;
      if (t.created) o.removed = Math.round(Math.min(t.volume, t.available || t.volume) * (0.12 + u.rng('bloctel-' + t.id)() * 0.08));
      if (before === 'bloctel') o.status = 'a_valider';
      S.log('Passage Bloctel (simulé) — ' + u.n(bloctelRemoved(t)) + ' numéros opposés retirés', t.id, user); LD.save();
      return done('Passage Bloctel simulé : ' + u.n(bloctelRemoved(t)) + ' numéros retirés' + (o.status === 'a_valider' && before === 'bloctel' ? ' — commande soumise à ' + dirName(t.client) : ''));
    },
    validateTm(t, user) {
      if (!isDirOf(user, t.client)) return fail('Seule la directrice du compte (' + dirName(t.client) + ') valide une commande');
      if (t.exclOn && (!t.exclOn.already || !t.exclOn.repous)) return fail('Validation bloquée : exclusions obligatoires (déjà livrés, repoussoir) non appliquées');
      if (!bloctelOk(t)) return fail('Validation bloquée : ' + bloctelMsg(t));
      if (S.tmStatus(t) !== 'a_valider') return fail('Commande non soumise à validation');
      Object.assign(tmo(t), { status: 'validee', by: user.id, vat: TODAY }); S.log('Commande télémarketing validée', t.id, user); LD.save(); return done('Commande validée');
    },
    deliverTm(t, user) {
      if (!canEdit(user)) return fail('Action réservée aux équipes LDS');
      if (t.exclOn && (!t.exclOn.already || !t.exclOn.repous)) return fail('Livraison bloquée : exclusions obligatoires (déjà livrés, repoussoir) non appliquées');
      if (!bloctelOk(t)) return fail('Livraison bloquée : passage Bloctel de moins de ' + BLOCTEL_DAYS + ' jours obligatoire (' + bloctelMsg(t) + ')');
      if (S.tmStatus(t) !== 'validee') return fail('Livraison bloquée : validation de la directrice de clientèle obligatoire');
      Object.assign(tmo(t), { status: 'livree', at: TODAY }); S.log('Fiches télémarketing livrées à ' + t.center + ' (simulé, aucun envoi)', t.id, user); LD.save(); return done('Livraison simulée — aucun envoi réel');
    },
    submitTm(t, user) {
      if (!canEdit(user)) return fail('Action réservée aux équipes LDS');
      if (!bloctelOk(t)) { tmo(t).status = 'bloctel'; LD.save(); return fail('Passage Bloctel requis avant soumission (' + bloctelMsg(t) + ')'); }
      if (S.tmStatus(t) !== 'preparation') return fail('Déjà soumise');
      tmo(t).status = 'a_valider'; S.log('Commande télémarketing soumise à la validation de ' + dirName(t.client), t.id, user); LD.save(); return done('Soumise à ' + dirName(t.client));
    },
    // Retours du centre d'appels : saisie contrôlée (entonnoir cohérent), persistée
    saveReturns(t, r, user) {
      if (!canEdit(user)) return fail('Action réservée aux équipes LDS');
      if (S.tmStatus(t) !== 'livree') return fail('Les retours se saisissent une fois les fiches livrées');
      const v = k => Math.max(0, Math.round(+r[k] || 0)), x = { appeles: v('appeles'), joints: v('joints'), argumentes: v('argumentes'), accords: v('accords'), refus: v('refus'), faux: v('faux') };
      const deliv = S.tmDelivered(t);
      if (x.appeles > deliv) return fail('Fiches appelées (' + u.n(x.appeles) + ') supérieures aux fiches livrées (' + u.n(deliv) + ')');
      if (x.joints > x.appeles) return fail('Contacts joints supérieurs aux fiches appelées');
      if (x.argumentes > x.joints) return fail('Argumentés supérieurs aux contacts joints');
      if (x.accords + x.refus > x.argumentes) return fail('Accords + refus supérieurs aux argumentés');
      if (x.faux > x.appeles - x.joints) return fail('Faux numéros supérieurs aux appels non aboutis');
      t.returns = x; Object.assign(tmo(t), { returns: x, rat: TODAY });
      S.log('Retours d\'appels saisis : ' + u.n(x.accords) + ' accords sur ' + u.n(x.joints) + ' contacts joints', t.id, user); LD.save();
      return done('Retours enregistrés');
    },
    download(f, user) {
      if (user.kind === 'client' && f.client !== user.client) return fail('Accès refusé');
      if (!['livree'].includes(S.fileStatus(f))) return fail(S.fileStatus(f) === 'expiree' ? 'Lien expiré' : 'Fichier non livré');
      S.log('Téléchargement du fichier ' + f.id + ' (tracé)', f.id, user); return done('Téléchargement tracé (contenu fictif)');
    }
  };
  C.RCS_SHARE = C.RCS_SHARE || 58;

  LD.wf = Object.assign({ windowCheck, campWindow, sendPlan, smsAdvice, nextSmsDay, smsDayOk, WAVE_GAP, contentCheck, unsubOk, htmlLinks, canValidate, canEdit, create, loadWarn,
    bloctelOk, bloctelDate, bloctelRemoved, bloctelMsg, tmValidator, fileValidator, createFile, createTm, KEYCOL, BLOCTEL_DAYS, H2, isHoliday }, A, F);
})(window.LD);
