/* views/campagne.js : fiche campagne — en-tête, étapes, actions selon le rôle et le statut,
 * onglets (#/campagne/<id>/<onglet>). Les onglets sont dans campagne-tabs.js.
 */
(function (LD) {
  'use strict';
  const u = LD.u, UI = LD.ui, S = LD.store, R = LD.ref, W = LD.wf, TODAY = LD.TODAY;
  const TABS = [['synthese', 'Résultats'], ['contenu', 'Contenu'], ['ciblage', 'Ciblage'], ['bat', 'BAT'], ['prog', 'Programmation'], ['facturation', 'Prix & facturation'], ['journal', 'Journal']];
  const CTABS = ['synthese', 'contenu', 'bat'];

  // Chronologie synthétique des statuts (campagnes historiques) + journal réel de la démo
  function history(c) {
    const st = S.status(c), step = R.status(st).step, d = S.dateOf(c), cl = R.client(c.client), ov = LD.state().ov[c.id] || {};
    const h = [], add = (k, date, label, who, s) => h.push({ k, date, label, who, s: s || 'done' });
    if (c.created) add(0, TODAY, 'Création', R.user(c.cdc).name);
    else add(0, u.addDays(d, -16), 'Création (brief client reçu)', R.user(c.cdc).name);
    const done = n => st === 'annulee' ? (ov.stoppedAt != null || n <= 2) : step >= n;
    if (!c.created) {
      if (done(1) || st === 'bat') add(1, u.addDays(d, -8), 'BAT v1 mis à disposition du client', R.user(c.cdc).name);
      if (done(2) || ['bat_ok', 'a_valider'].includes(st)) add(1, u.addDays(d, -6), 'BAT validé par le client', 'Client · ' + cl.name);
      if (done(2) && st !== 'a_valider' || st === 'a_valider') add(2, u.addDays(d, -5), 'Soumise à validation', R.user(c.cdc).name);
      if (done(3) || st === 'validee') add(2, u.addDays(d, -4), 'Validée', R.user(cl.dir).name);
      if (done(3)) add(3, u.addDays(d, -3), 'Programmée le ' + u.fmtDate(d) + ' à ' + W.H2(S.hourOf(c)), R.user(c.cdc).name);
      if (done(4)) add(4, d, 'Lancement de l\'envoi', 'Routage automatique');
      if (st === 'terminee') add(5, c.end, 'Envoi terminé — statistiques consolidées à J+3', 'Routage automatique');
    }
    const jr = LD.store.journal().filter(j => j.target === c.id).slice().reverse().map(j => ({ date: u.iso(new Date(j.t)), t: j.t, label: j.action, who: (R.user(j.user) || { name: j.user }).name, s: /ARRÊT|Annul|Renvoy/.test(j.action) ? 'bad' : 'done', live: true }));
    return h.concat(jr);
  }

  function actions(c, user) {
    if (S.isClient(user)) return S.status(c) === 'bat' ? `<a class="btn primary" href="#/campagne/${c.id}/bat">${UI.icon('eye')}Voir et valider le BAT</a>` : '';
    const st = S.status(c), cl = R.client(c.client), b = [];
    const btn = (act, label, cls, ic) => b.push(`<button class="btn ${cls || ''}" data-act="${act}">${ic ? UI.icon(ic) : ''}${label}</button>`);
    if (st === 'brouillon') { btn('sendBat', 'Préparer et mettre le BAT à disposition', 'primary', 'eye'); btn('cancel', 'Annuler', 'danger'); }
    if (st === 'bat') { btn('sendBat', 'Nouvelle version du BAT', '', 'eye'); btn('approveBat', 'Valider le BAT pour le client', '', 'check'); btn('cancel', 'Annuler', 'danger'); }
    if (st === 'bat_ok') { btn('submit', 'Soumettre à la directrice (' + R.user(cl.dir).name.split(' ')[0] + ')', 'primary', 'check'); btn('cancel', 'Annuler', 'danger'); }
    if (st === 'a_valider') {
      if (W.canValidate(user, c)) { btn('validate', 'Valider la campagne', 'ok', 'check'); btn('reject', 'Renvoyer au chargé', 'warn'); }
      else b.push(`<span class="badge b-orange" style="padding:8px 12px">En attente de ${u.esc(R.user(cl.dir).name)} — seule la directrice du compte valide</span>`);
    }
    if (st === 'validee') { btn('schedule', 'Programmer l\'envoi', 'primary', 'clock'); btn('cancel', 'Annuler', 'danger'); }
    if (st === 'programmee') { btn('launch', 'Lancer maintenant (simulé)', 'ok', 'play'); btn('schedule', 'Modifier la programmation', '', 'clock'); btn('cancel', 'Annuler', 'danger'); }
    if (st === 'en_cours') { btn('pause', 'Mettre en pause', 'warn', 'pause'); btn('emergency', 'Arrêt d\'urgence', 'danger', 'stop'); }
    if (st === 'pause') { btn('resume', 'Reprendre l\'envoi', 'ok', 'play'); btn('emergency', 'Arrêt d\'urgence', 'danger', 'stop'); }
    btn('duplicate', 'Dupliquer', '', 'copy');
    if (['terminee'].includes(st)) b.push(`<a class="btn" href="#/bilan/${c.client}/${c.id}">${UI.icon('doc')}Bilan client</a>`);
    return b.join('');
  }

  function scheduleModal(c, user) {
    const d0 = S.dateOf(c) >= TODAY ? S.dateOf(c) : TODAY, h0 = S.hourOf(c);
    const hasSms = c.parts.some(p => p.ch !== 'email');
    const body = `<div class="form-g">
      <div class="fld"><label>Date d'envoi</label><input type="date" id="sd" value="${d0}" min="${TODAY}"></div>
      <div class="fld"><label>Heure de départ</label><input type="time" id="sh" value="${u.pad(Math.floor(h0))}:${u.pad(Math.round((h0 % 1) * 60))}" step="900"></div>
      <div class="fld"><label>Envoi en vagues</label><select id="sw">${[1, 2, 3, 4].map(n => `<option ${n === c.waves ? 'selected' : ''} value="${n}">${n === 1 ? 'Une seule vague' : n + ' vagues (30 min de pause entre vagues)'}</option>`).join('')}</select></div>
      <div class="fld"><label>Débit maximal</label><select id="st">${[20000, 50000, 100000, 150000, 200000].map(n => `<option ${n === c.throughput ? 'selected' : ''} value="${n}">${u.n(n)} messages / heure</option>`).join('')}</select></div>
      <div class="full" id="sch-check"></div></div>`;
    const root = UI.modal('Programmer l\'envoi — ' + u.esc(c.name), body, { foot: `<button class="btn" data-close2>Annuler</button><button class="btn primary" id="sch-ok">Programmer</button>` });
    const chk = () => {
      const d = root.querySelector('#sd').value, [hh, mm] = root.querySelector('#sh').value.split(':').map(Number), h = hh + mm / 60;
      const cc = Object.assign({}, c, { waves: +root.querySelector('#sw').value, throughput: +root.querySelector('#st').value }), errs = W.campWindow(cc, d, h), warn = W.loadWarn(c, d), plan = W.sendPlan(cc, d, h);
      root.querySelector('#sch-check').innerHTML = (errs.length ? `<div class="alert risk">${UI.icon('alert')}<div><b>Programmation impossible</b><ul>${errs.map(e => `<li>${u.esc(e)}</li>`).join('')}</ul></div></div>` : `<div class="alert ok">${UI.icon('check')}<div><b>Fenêtres d'envoi respectées</b>${hasSms ? '<br><small>SMS / RCS : 8 h – 20 h, pas le dimanche ni les jours fériés — ' + UI.legal() + '</small>' : ''}</div></div>`)
        + (warn.length ? `<div class="alert warn" style="margin-top:8px">${UI.icon('alert')}<div>${warn.map(u.esc).join('<br>')}</div></div>` : '')
        + `<div class="note" style="margin-top:8px">Fin estimée : ${plan.sort((x, y) => x.off - y.off).map(x => (x.fam === 'sms' ? 'SMS / RCS' : 'Email') + (x.off ? ' J+' + x.off : '') + ' ' + W.H2(x.end)).join(' · ')} (volume ÷ débit + 30 min de pause entre vagues) · charge du routage ce jour : ${u.n(S.dayLoad(d, c.id) + c.parts[0].vol)} messages.</div>`;
      root.querySelector('#sch-ok').disabled = !!errs.length;
    };
    root.querySelectorAll('input,select').forEach(x => x.oninput = chk); chk();
    root.querySelector('[data-close2]').onclick = UI.closeModal;
    root.querySelector('#sch-ok').onclick = () => {
      const d = root.querySelector('#sd').value, [hh, mm] = root.querySelector('#sh').value.split(':').map(Number);
      c.waves = +root.querySelector('#sw').value; c.throughput = +root.querySelector('#st').value;
      const r = W.schedule(c, user, d, hh + mm / 60); if (UI.result(r)) { UI.closeModal(); LD.app.renderView(); }
    };
  }

  function doAct(act, c, user) {
    if (act === 'schedule') return scheduleModal(c, user);
    if (act === 'reject') { const reason = 'Ciblage à revoir avec le client'; return UI.result(W.reject(c, user, reason)) && LD.app.renderView(); }
    if (act === 'approveBat') return UI.result(W.approveBat(c, user, 'BAT validé par email du client (saisi par LDS).')) && LD.app.renderView();
    if (act === 'duplicate') { const r = W.duplicate(c, user); if (UI.result(r)) location.hash = '#/campagne/' + r.id; return; }
    if (act === 'emergency' && !confirm('Arrêt d\'urgence : stopper immédiatement l\'envoi de « ' + c.name + ' » ? (simulé)')) return;
    const r = W[act](c, user); if (UI.result(r)) LD.app.renderView();
  }

  function render(el, arg, user) {
    const [id, tab0] = (arg || '').split('/');
    const c = S.getCamp(id);
    if (!c) { el.innerHTML = `<div class="alert risk">${UI.icon('lock')}<div><b>Campagne introuvable ou hors de votre périmètre.</b><br>${u.esc(S.scopeLabel(user))}</div></div>`; S.log('Accès refusé à la campagne ' + id); return; }
    const isC = S.isClient(user), tabs = TABS.filter(t => !isC || CTABS.includes(t[0]));
    const tab = tabs.find(t => t[0] === tab0) ? tab0 : 'synthese';
    const st = S.status(c), cl = R.client(c.client), step = R.status(st).step;
    const hd = `<div class="camp-head"><div style="min-width:0">
        <div class="note"><a href="#/campagnes">Campagnes</a> › ${UI.clientDot(c.client)}${isC ? u.esc(cl.name) : `<a href="#/client/${cl.id}">${u.esc(cl.name)}</a>`} › <span class="mono">${c.id}</span></div>
        <h2 style="margin-top:4px">${u.esc(c.name)} ${UI.statusBadge(c)} ${UI.chBadge(c.channel)}${c.ab ? ' <span class="badge b-cyan">Test A/B</span>' : ''}</h2>
        <div class="meta"><span>Envoi <b>${u.DOWS[u.dow(S.dateOf(c))].toLowerCase()} ${u.fmtDate(S.dateOf(c))} à ${W.H2(S.hourOf(c))}</b></span><span>Volume <b>${u.n(c.volume)}</b>${c.parts.length > 1 ? ' (' + c.parts.map(p => u.n(p.vol) + ' ' + (p.fallback ? 'SMS de repli' : R.channel(p.ch).short) + (p.off ? ' à J+' + p.off : '')).join(' + ') + ')' : ''}</span><span>Type <b>${u.esc(R.types.find(x => x.id === c.type).label)}</b></span><span>Objectif <b>${u.esc(c.objective)}</b></span><span>Chargé <b>${u.esc(R.user(c.cdc).name)}</b></span><span>Directrice <b>${u.esc(R.user(cl.dir).name)}</b></span></div>
        <div style="margin-top:12px;max-width:760px">${UI.steps(st === 'annulee' ? -1 : st === 'terminee' ? 6 : step)}</div>
      </div><div class="camp-actions">${actions(c, user)}</div></div>`;
    const nav = `<div class="tabs">${tabs.map(t => `<a class="tab ${t[0] === tab ? 'on' : ''}" href="#/campagne/${c.id}/${t[0]}">${t[1]}${t[0] === 'bat' && st === 'bat' ? ' <span class="badge b-orange">à valider</span>' : ''}</a>`).join('')}</div>`;
    el.innerHTML = hd + (st === 'annulee' ? `<div class="alert risk">${UI.icon('stop')}<div><b>Campagne ${LD.state().ov[c.id] && LD.state().ov[c.id].stoppedAt != null ? 'arrêtée en urgence à ' + u.pct(LD.state().ov[c.id].stoppedAt, 0) + ' de l\'envoi' : 'annulée'}.</b> Les messages déjà routés restent comptés et facturables selon le contrat.</div></div>` : '') + nav + '<div id="ctab"></div>';
    LD.campTabs[tab](el.querySelector('#ctab'), c, user, history(c));
    el.querySelectorAll('[data-act]').forEach(b => b.onclick = () => doAct(b.dataset.act, c, user));
  }

  LD.campagne = { history, doAct };
  LD.views.campagne = {
    title: (arg) => { const c = S.getCamp((arg || '').split('/')[0]); return c ? 'Campagne · ' + R.client(c.client).name : 'Campagne'; },
    client: true, filters: false, render,
    live(el, user) { const c = S.getCamp((LD.app.parseHash().arg || '').split('/')[0]); if (c && ['en_cours'].includes(S.status(c)) && LD.campTabs.live) LD.campTabs.live(el, c); }
  };
})(window.LD);
