/* views/admin.js : utilisateurs et droits, rattachement clients / directrices, paramètres
 * (fenêtres d'envoi, jours fériés, seuils, pression, grilles de prix), journal des actions.
 */
(function (LD) {
  'use strict';
  const u = LD.u, UI = LD.ui, S = LD.store, R = LD.ref, C = LD.config, TODAY = LD.TODAY;
  const RIGHTS = [['create', 'Créer et préparer'], ['validate', 'Valider (ses comptes)'], ['deliver', 'Livrer des fichiers'], ['billing', 'Facturation'], ['admin', 'Paramétrer']];

  function render(el, arg, user) {
    const tab = arg || 'utilisateurs';
    const nav = `<div class="tabs">${[['utilisateurs', 'Utilisateurs et droits'], ['parametres', 'Paramètres'], ['journal', 'Journal des actions']].map(t => `<a class="tab ${t[0] === tab ? 'on' : ''}" href="#/admin/${t[0]}">${t[1]}</a>`).join('')}</div>`;
    let body = '';
    if (tab === 'utilisateurs') {
      const tu = UI.table({ title: 'Utilisateurs', columns: ['Utilisateur', 'Identifiant', 'Profil'].concat(RIGHTS.map(r => r[1])).concat(['Périmètre']), rows: R.users,
        render: x => [UI.avatar(x.id, true) + ' <b>' + u.esc(x.name) + '</b>', `<span class="mono">${u.esc(x.login)}</span>`, UI.badge(x.role, x.kind === 'client' ? 'b-cyan' : x.kind === 'admin' ? 'b-blue' : 'b-grey')].concat(RIGHTS.map(r => x.rights[r[0]] ? '<span style="color:var(--green);font-weight:700">✓</span>' : '<span class="muted">—</span>')).concat([u.esc(S.scopeLabel(x))]),
        raw: x => [x.name, x.login, x.role].concat(RIGHTS.map(r => x.rights[r[0]] ? 'oui' : 'non')) });
      const ta = UI.table({ title: 'Rattachement des clients', columns: ['Client', 'Secteur', 'Directrice de clientèle (valide)', 'Chargé habituel', 'Contrat'], rows: R.clients,
        render: c => [UI.clientDot(c.id) + '<b>' + u.esc(c.name) + '</b>', u.esc(R.sector(c.sector).label), `<select data-dir="${c.id}" style="font:inherit;font-size:12px;padding:3px 6px;border:1px solid #CFD9EA;border-radius:6px">${R.dirs().map(d => `<option value="${d.id}" ${d.id === c.dir ? 'selected' : ''}>${u.esc(d.name)}</option>`).join('')}</select>`, u.esc(R.user(c.cdc).name), u.esc(c.contract)] });
      body = `<div class="grid g4" style="margin-top:16px">${UI.kpi({ label: 'Utilisateurs LDS', value: '7', sub: '4 chargés · 2 directrices · 1 admin' })}${UI.kpi({ label: 'Comptes clients', value: '1', sub: 'démo · lecture seule' })}${UI.kpi({ label: 'Authentification', value: 'SSO', sub: 'annuaire LDS ' + UI.sim() })}${UI.kpi({ label: 'Actions tracées', value: u.n(S.journal().length), sub: 'depuis le début de la démo' })}</div>
        ${UI.card('Utilisateurs et droits', tu.html, { tools: `${tu.tools}<button class="btn sm" id="add-u">${UI.icon('plus')}Inviter un utilisateur</button>` })}
        ${UI.card('Rattachement des clients aux directrices', ta.html, { foot: 'Une directrice ne valide que les campagnes et livraisons des clients qui lui sont rattachés.' })}`;
    } else if (tab === 'parametres') {
      const H = LD.u.holidays(+TODAY.slice(0, 4));
      const fld = (k, l, v, help, legal) => `<div class="fld"><label>${l}${legal ? ' ' + UI.legal() : ''}</label><input type="number" data-p="${k}" value="${v}">${help ? `<span class="help">${help}</span>` : ''}</div>`;
      body = `<div class="grid g2" style="margin-top:16px">
        ${UI.card('Fenêtres d\'envoi', `<div class="form-g">${fld('SMS_WINDOW.0', 'SMS / RCS — début (h)', C.SMS_WINDOW[0], '', true)}${fld('SMS_WINDOW.1', 'SMS / RCS — fin (h)', C.SMS_WINDOW[1])}${fld('EMAIL_WINDOW.0', 'Email — début (h)', C.EMAIL_WINDOW[0])}${fld('EMAIL_WINDOW.1', 'Email — fin (h)', C.EMAIL_WINDOW[1])}
          <div class="fld full"><label><input type="checkbox" data-pb="SMS_SUNDAY" ${C.SMS_SUNDAY ? 'checked' : ''} style="width:auto"> Autoriser les SMS le dimanche</label><label><input type="checkbox" data-pb="SMS_HOLIDAYS" ${C.SMS_HOLIDAYS ? 'checked' : ''} style="width:auto"> Autoriser les SMS les jours fériés</label></div></div>`)}
        ${UI.card('Jours fériés ' + TODAY.slice(0, 4), `<div class="chips">${[...H].sort().map(d => `<span class="chip">${u.fmtDate(d)}</span>`).join('')}</div><div class="note" style="margin-top:8px">Calculés automatiquement (dont Pâques, Ascension, Pentecôte).</div>`)}
        ${UI.card('Seuils d\'alerte et pression marketing', `<div class="form-g">${fld('THRESH.hardBounce', 'Adresses invalides (%)', C.THRESH.hardBounce * 100)}${fld('THRESH.stop', 'STOP SMS (%)', C.THRESH.stop * 100)}${fld('THRESH.complaint', 'Plaintes (%)', C.THRESH.complaint * 100)}${fld('THRESH.bdc', 'Consommation du BDC (%)', C.THRESH.bdc * 100)}${fld('PRESSURE_DAYS', 'Exclure les contacts sollicités depuis moins de (jours)', C.PRESSURE_DAYS)}${fld('PRESSURE_MAX_30D', 'Prises de parole max. par client / 30 jours', C.PRESSURE_MAX_30D)}${fld('CAPACITY_DAY', 'Capacité du routage (messages / jour)', C.CAPACITY_DAY)}</div>`)}
        ${UI.card('Grilles de prix <small>' + C.PRICE_NOTE + '</small>', UI.table({ title: 'Grille', columns: ['Client', { label: 'Location (€ / mille)', align: 'r' }, { label: 'Routage (€ / mille)', align: 'r' }, { label: 'Création', align: 'r' }], rows: R.clients, render: c => [UI.clientDot(c.id) + u.esc(c.name), `<input type="number" data-cpm="${c.id}" value="${c.cpm}" style="width:80px;font:inherit;font-size:12px;padding:3px 6px;border:1px solid #CFD9EA;border-radius:6px;text-align:right">`, S.ROUTAGE_CPM + ' €', S.CREA_FEE + ' €'] }).html)}</div>`;
    } else {
      const j = S.journal();
      const tj = UI.table({ title: 'Journal des actions', max: 100, columns: ['Horodatage', 'Utilisateur', 'Action', 'Objet'], rows: j,
        render: x => [u.fmtDateTime(new Date(x.t)), u.esc((R.user(x.user) || { name: x.user }).name), u.esc(x.action), x.target && /^C-/.test(x.target) ? `<a href="#/campagne/${x.target}" class="mono">${x.target}</a>` : `<span class="mono">${u.esc(x.target)}</span>`],
        raw: x => [u.fmtDateTime(new Date(x.t)), (R.user(x.user) || { name: x.user }).name, x.action, x.target], empty: 'Aucune action depuis le début de la démo.' });
      body = `<div style="margin-top:16px">${UI.card('Journal des actions <small>création, BAT, validation, lancement, pause, annulation, export, connexion</small>', tj.html, { tools: `${tj.tools}<button class="btn sm danger" id="reset-demo">Réinitialiser la démo</button>` })}</div>`;
    }
    el.innerHTML = nav + body;
    el.querySelectorAll('[data-p]').forEach(x => x.onchange = () => {
      const [k, i] = x.dataset.p.split('.'), v = +x.value, pct = k === 'THRESH';
      if (i == null) C[k] = v; else if (pct) C[k][i] = v / 100; else C[k][+i] = v;
      LD.state().params[k] = C[k]; S.log('Paramètre modifié : ' + x.dataset.p + ' = ' + v); UI.toast('Paramètre enregistré et tracé', 'ok');
    });
    el.querySelectorAll('[data-pb]').forEach(x => x.onchange = () => { C[x.dataset.pb] = x.checked; LD.state().params[x.dataset.pb] = x.checked; S.log('Paramètre modifié : ' + x.dataset.pb + ' = ' + x.checked); UI.toast('Paramètre enregistré', 'ok'); });
    el.querySelectorAll('[data-cpm]').forEach(x => x.onchange = () => { R.client(x.dataset.cpm).cpm = +x.value; S.log('Grille de prix modifiée : ' + x.value + ' €', x.dataset.cpm); UI.toast('Grille modifiée (session de démo)', 'ok'); });
    el.querySelectorAll('[data-dir]').forEach(x => x.onchange = () => { R.client(x.dataset.dir).dir = x.value; S.log('Rattachement : ' + R.user(x.value).name, x.dataset.dir); UI.toast('Rattachement modifié (session de démo)', 'ok'); });
    const au = el.querySelector('#add-u'); if (au) au.onclick = () => UI.toast('Invitation simulée — aucun email envoyé', 'ok');
    const rs = el.querySelector('#reset-demo'); if (rs) rs.onclick = () => { if (confirm('Effacer toutes les actions de démonstration ?')) { S.resetState(); location.reload(); } };
  }
  LD.views.admin = { title: 'Administration', filters: false, render, right: 'admin' };
})(window.LD);
