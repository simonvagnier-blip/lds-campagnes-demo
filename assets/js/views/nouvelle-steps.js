/* views/nouvelle-steps.js : étapes 3 (ciblage / import), 4 (contenu, contrôles SMS et email), 5 (A/B, BAT) de l'assistant. */
(function (LD) {
  'use strict';
  const u = LD.u, UI = LD.ui, S = LD.store, R = LD.ref, W = LD.wf, C = LD.config, D = LD.data, K = LD.content;
  const Z = () => LD.wiz;
  const chip = (grp, v, on) => `<button class="chip ${on ? 'on' : ''}" data-chip="${grp}" data-v="${u.esc(v)}">${u.esc(v)}</button>`;

  function funnelHtml(d) {
    const k = Z().count(d), v = Z().finalVols(d);
    if (k.routage && !k.raw) return '<div class="note">Importez un fichier pour obtenir le comptage.</div>';
    const rows = [[k.routage ? 'Lignes du fichier importé' : 'Contacts correspondant aux critères', k.raw]].concat(k.ex.map(x => ['− ' + x[0], -x[1]])).concat([['Après exclusions', v.after], ['Plafond (volume commandé)', d.cap], ['Volume retenu', v.total]]);
    return `<div class="kpi-l">Comptage en direct ${k.routage ? '' : UI.sim('base virtuelle')}</div><div class="count-big" id="cnt">${u.n(v.total)}</div><div class="fun2" style="margin-top:8px">${rows.map(x => `<div><span>${u.esc(x[0])}</span><b class="${x[1] < 0 ? 'neg' : ''}">${x[1] < 0 ? '− ' + u.n(-x[1]) : u.n(x[1])}</b></div>`).join('')}</div>
      ${d.channel === 'rcs' ? `<div class="note" style="margin-top:8px">Dont ${u.n(v.rcs)} mobiles compatibles RCS (${C.RCS_SHARE} %) et ${u.n(v.fallback)} en repli SMS.</div>` : ''}${d.channel === 'seq' ? `<div class="note" style="margin-top:8px">Email à J+${d.seqGap} : ${u.n(v.email)} contacts disposant aussi d'un email opt-in.</div>` : ''}`;
  }

  const S3 = function (d) {
    const cl = R.client(d.client), segs = D.segments.filter(s => s.client === d.client);
    if (d.type === 'routage') {
      const imp = d.imp;
      return `<div class="grid" style="grid-template-columns:1.3fr 1fr;gap:18px">
        <div><div class="dropzone" id="drop">${UI.icon('box')}<br><b>Déposez le fichier client</b> (CSV, Excel)<br><small>ou</small> <button class="btn sm" id="imp-demo">Importer le fichier de démonstration</button></div>
        ${imp ? `<div style="margin-top:14px"><div class="kpi-l">Correspondance des colonnes · ${u.esc(imp.file)}</div><div class="map-cols" style="margin-top:8px">${imp.map.map(m => `<span class="src">${u.esc(m[0])}</span><span>→</span><select style="font:inherit;font-size:12px;padding:4px 6px;border:1px solid #CFD9EA;border-radius:6px">${['Email', 'Mobile', 'Civilité', 'Prénom', 'Nom', 'Code postal', 'Ignorer'].map(o => `<option ${o === m[1] ? 'selected' : ''}>${o}</option>`).join('')}</select>`).join('')}</div>
          <div class="kpi-l" style="margin-top:14px">Contrôle qualité</div><div class="checks" style="margin-top:6px"><div class="chk ok"><span class="m">✓</span><span>${u.n(imp.rows)} lignes lues · encodage UTF-8 · séparateur « ; »</span></div><div class="chk wa"><span class="m">!</span><span>${u.n(imp.dups)} doublons supprimés (${u.pct(imp.dups / imp.rows)})</span></div><div class="chk ${imp.invalid / imp.rows > C.THRESH.hardBounce ? 'ko' : 'wa'}"><span class="m">${imp.invalid / imp.rows > C.THRESH.hardBounce ? '✕' : '!'}</span><span>${u.n(imp.invalid)} ${d.channel === 'email' ? 'emails' : 'numéros'} au format invalide (${u.pct(imp.invalid / imp.rows)}) ${imp.invalid / imp.rows > C.THRESH.hardBounce ? '— <b>taux anormal</b>, à signaler au client' : ''}</span></div><div class="chk ok"><span class="m">✓</span><span>Désinscrits et STOP de la liste d'exclusion retirés automatiquement</span></div></div>` : ''}</div>
        <div>${funnelHtml(d)}<div class="fld" style="margin-top:14px"><label>Plafond</label><input type="number" data-k="cap" value="${d.cap}" step="5000"></div></div></div>`;
    }
    return `<div class="grid" style="grid-template-columns:1.3fr 1fr;gap:18px"><div style="display:flex;flex-direction:column;gap:14px">
      ${segs.length ? `<div class="fld"><label>Partir d'un segment enregistré</label><select id="seg"><option value="">— Nouveau ciblage —</option>${segs.map(s => `<option value="${s.id}" ${s.id === d.segment ? 'selected' : ''}>${u.esc(s.label)} · ${u.n(s.count)}</option>`).join('')}</select></div>` : ''}
      <div class="fld"><span class="lbl">Âge</span><div class="chips">${Z().AGES.map(a => chip('age', a, d.crit.age.includes(a))).join('')}</div></div>
      <div class="fld"><span class="lbl">Catégorie socio-professionnelle</span><div class="chips">${Z().CSP.map(a => chip('csp', a, d.crit.csp.includes(a))).join('')}</div></div>
      <div class="fld"><span class="lbl">Géographie</span><div class="chips">${cl.d2s ? chip('geo', 'Autour des magasins', d.crit.geo === 'magasins') : ''}${chip('geo', 'France entière', d.crit.geo !== 'magasins')}</div>
        ${cl.d2s && d.crit.geo === 'magasins' ? `<div class="split" style="margin-top:6px"><input type="range" min="5" max="50" step="5" value="${d.crit.radius}" id="radius" style="flex:1"><b id="radius-v" style="min-width:110px">rayon ${d.crit.radius} km</b></div><span class="help">${cl.stores} magasins de ${u.esc(cl.name)} (liste fictive)</span>` : ''}</div>
      <div class="fld"><span class="lbl">Centres d'intérêt</span><div class="chips">${Z().INTER.map(a => chip('interests', a, d.crit.interests.includes(a))).join('')}</div></div>
      <div class="fld"><span class="lbl">Comportements</span><div class="chips">${Z().BEHAV.map(a => chip('behav', a, d.crit.behav.includes(a))).join('')}</div></div>
      <div class="fld"><label>Plafond (volume commandé)</label><input type="number" data-k="cap" value="${d.cap}" step="5000"></div>
      <div class="split"><button class="btn sm" id="seg-save">${UI.icon('star')}Enregistrer comme segment</button><span class="note">Repoussoir ${u.esc(cl.name)} : ${u.n(D.repous[d.client].rows)} lignes, mis à jour le ${u.fmtDate(D.repous[d.client].updated)}</span></div>
      </div><div class="card" style="box-shadow:none;background:#FAFBFD"><div class="card-b" id="funnel">${funnelHtml(d)}</div></div></div>`;
  };

  // Gabarit email : import réel d'un fichier .html (lu et contrôlé) ou .zip (nom et poids réels, décompression en production)
  function tplBlock(e) {
    const src = e.source === 'html' ? `<span class="badge b-green">HTML importé</span>` : e.source === 'zip' ? `<span class="badge b-orange">archive ZIP</span>` : `<span class="badge b-grey">gabarit par défaut</span>`;
    const size = e.source === 'zip' ? u.dec(e.zipKb, 1) + ' ko (archive)' : u.dec(e.weight || 0, 1) + ' ko';
    return `<label class="dropzone imp-zone" id="tpl-drop" for="tpl-file">${UI.icon('dl')}<span><b>Importer le gabarit HTML</b> (.html ou .zip)<br><small>Cliquez ou déposez le fichier ici · le HTML est lu et contrôlé (liens, désinscription, poids, textes alternatifs)</small></span><span class="btn sm">Choisir un fichier</span></label>
      <input type="file" id="tpl-file" accept=".html,.htm,.zip" hidden>
      <div class="imp-meta" id="tpl-meta">${src}<span>Fichier <b class="mono">${u.esc(e.file || '—')}</b></span><span>Poids <b>${size}</b></span>${e.source === 'zip' ? '<span>Contenu : <b>décompression en production</b> ' + UI.sim('simulé') + '</span>' : `<span><b>${e.images || 0}</b> image(s) · alt ${e.noAlt ? '<b style="color:var(--orange)">' + e.noAlt + ' manquant(s)</b>' : '<b>présents</b>'}</span><span><b>${(e.links || []).length}</b> lien(s) tracké(s)</span>`}${e.source ? '<button class="link" id="tpl-reset">Revenir au gabarit par défaut</button>' : ''}</div>`;
  }
  const S4 = function (d) {
    const k = Z().ensureContent(d), cl = R.client(d.client), pc = Z().pseudoCamp(d), chk = W.contentCheck(pc);
    let left = '', right = '';
    if (k.email) {
      left += `<div class="kpi-l" style="margin-bottom:8px">${UI.icon('mail')} Email</div><div class="form-g">
        <div class="fld"><label>Nom de l'expéditeur</label><input data-c="email.from" value="${u.esc(k.email.from)}"></div>
        <div class="fld"><label>Adresse d'envoi</label><input data-c="email.fromEmail" value="${u.esc(k.email.fromEmail)}"></div>
        <div class="fld full"><label>Objet <small class="muted">${k.email.subject.length} car.</small></label><input data-c="email.subject" value="${u.esc(k.email.subject)}"></div>
        <div class="fld full"><label>Pré-header</label><input data-c="email.preheader" value="${u.esc(k.email.preheader)}"></div>
        <div class="fld full"><span class="lbl">Gabarit HTML</span><div id="tpl-box">${tplBlock(k.email)}</div><span class="help" id="tpl-err"></span></div></div>`;
      right += `<div class="split" style="margin-bottom:8px"><div class="seg"><button class="on" data-pv="desk">Bureau</button><button data-pv="mobile">Mobile</button></div>${k.email.source === 'html' ? '<span class="note">Aperçu du fichier importé, isolé (aucun script, aucun chargement externe)</span>' : ''}</div><div id="pv-mail">${K.emailPreview(pc, k, 'desk')}</div>`;
    }
    if (k.sms) {
      const sc = K.smsCount(K.fill(k.sms.text, cl));
      left += `<div class="kpi-l" style="margin:16px 0 8px">${UI.icon('msg')} SMS ${d.channel === 'rcs' ? '(repli)' : ''}</div><div class="form-g">
        <div class="fld"><label>Émetteur (11 caractères max.)</label><input data-c="sms.sender" maxlength="14" value="${u.esc(k.sms.sender)}"></div><div></div>
        <div class="fld full"><label>Message <small class="muted">variables : {{prenom}} {{magasin}} {{lien}}</small></label><textarea data-c="sms.text">${u.esc(k.sms.text)}</textarea>
        <div class="smsmeter" id="smsm">${smsMeter(sc)}<span>Lien court tracké : {{lien}} → lds.li/…</span></div></div></div>`;
      right += `<div style="margin-top:${k.email ? 16 : 0}px;display:flex;gap:14px;justify-content:center" id="pv-ph">${d.channel === 'rcs' ? K.rcsPreview(pc, k) : ''}${K.smsPreview(pc, k)}</div>`;
    }
    if (k.rcs) left += `<div class="kpi-l" style="margin:16px 0 8px">${UI.icon('rcs')} RCS</div><div class="form-g"><div class="fld"><label>Titre de la carte</label><input data-c="rcs.title" value="${u.esc(k.rcs.title)}"></div><div class="fld"><label>Agent vérifié</label><input value="${u.esc(k.rcs.agent)} ✔" disabled></div><div class="fld full"><label>Texte</label><textarea data-c="rcs.text">${u.esc(k.rcs.text)}</textarea></div><div class="fld full"><span class="lbl">Boutons</span><div class="chips">${k.rcs.buttons.map(b => `<span class="chip on">${u.esc(b)}</span>`).join('')}</div></div></div>`;
    left += `<div class="kpi-l" style="margin:16px 0 8px">Contrôles avant BAT (✕ bloquant · ! à surveiller)</div><div class="checks" id="chk">${UI.checks(chk.items)}</div>`;
    return `<div class="grid" style="grid-template-columns:1.1fr 1fr;gap:20px;align-items:start"><div>${left}</div><div>${right}</div></div>`;
  };
  function smsMeter(sc) { return `<span><b>${sc.len}</b> caractères</span><span><b>${sc.parts}</b> SMS ${sc.parts > 1 ? '(coût × ' + sc.parts + ')' : ''}</span><span>${sc.unicode ? '<b style="color:var(--orange)">Unicode — 70 car. par SMS</b>' + (sc.bad.length ? ' à cause de : ' + sc.bad.map(x => '« ' + u.esc(x) + ' »').join(' ') : '') : '<b>GSM 7 bits</b> — 160 car. par SMS'}</span>`; }

  // Test A/B : la version B est réellement saisie et enregistrée (objet, contenu ou heure)
  function abKinds(d) { return d.channel === 'email' ? ['objet', 'contenu', 'heure'] : d.channel === 'seq' ? ['objet', 'contenu'] : ['contenu']; }
  const AB_LABEL = { objet: 'Objet', contenu: 'Contenu', heure: 'Heure d\'envoi' };
  function abA(d) {
    const k = Z().ensureContent(d);
    if (d.ab.kind === 'objet') return k.email ? k.email.subject : '';
    if (d.ab.kind === 'heure') return W.H2(d.hour);
    return k.email ? 'Gabarit ' + (k.email.file || 'par défaut') : (k.sms ? k.sms.text : '');
  }
  function abDefault(d) {
    const k = Z().ensureContent(d);
    if (d.ab.kind === 'objet') return 'Dernières heures : ' + (k.email ? k.email.subject : '');
    if (d.ab.kind === 'heure') return '11:00';
    return k.email ? 'Variante : visuel ambiance, bouton « Voir les offres »' : (k.sms ? k.sms.text.replace(/^([^:]+:)/, '$1 derniers jours,') : '');
  }
  const S5 = function (d) {
    const list = D.batLists[d.client], kinds = abKinds(d);
    if (d.ab.on && !kinds.includes(d.ab.kind)) { d.ab.on = false; Z().save(); }
    const opts = [[false, 'Pas de test']].concat(kinds.map(x => [x, AB_LABEL[x]]));
    const bIn = d.ab.kind === 'heure' ? `<input type="time" id="ab-b" step="900" value="${u.esc(d.ab.b || '')}">` : d.ab.kind === 'contenu' && d.channel !== 'email' && d.channel !== 'seq' ? `<textarea id="ab-b">${u.esc(d.ab.b || '')}</textarea>` : `<input id="ab-b" value="${u.esc(d.ab.b || '')}" placeholder="Saisissez la version B">`;
    return `<div class="form-g"><div class="fld full"><span class="lbl">Test A/B</span><div class="choice c${Math.min(4, opts.length)}" style="${opts.length === 2 ? 'grid-template-columns:repeat(2,minmax(0,1fr))' : ''}">${opts.map(o => `<button class="ch-opt ${(!d.ab.on && o[0] === false) || (d.ab.on && d.ab.kind === o[0]) ? 'on' : ''}" data-ab="${o[0]}"><b>${o[1]}</b><span>${o[0] === false ? 'Envoi unique à toute la cible' : 'Deux versions sur ' + d.ab.share + ' % chacune, puis la gagnante'}</span></button>`).join('')}</div></div>
      ${d.ab.on ? `<div class="fld full"><div class="ab-pair"><div class="ab-v"><div class="tag">Version A · actuelle</div><div class="val">${u.esc(abA(d)) || '—'}</div></div><div class="ab-v" style="border-color:#9DB5E0;background:#F7FAFF"><div class="tag">Version B · à saisir</div><div class="fld" style="margin-top:6px">${bIn}</div><span class="help" id="ab-help">${d.ab.b ? 'Enregistrée dans le brouillon' : '<b style="color:var(--red)">Version B vide : la création sera refusée</b>'}</span></div></div></div>
      <div class="fld"><label>Part de la cible par version</label><select id="ab-share">${[5, 10, 15, 20].map(n => `<option ${n === d.ab.share ? 'selected' : ''} value="${n}">${n} %</option>`).join('')}</select></div>
      <div class="fld"><span class="lbl">Gagnante</span><div class="note" style="padding-top:6px">Désignée <b>2 h après le départ</b> sur le taux ${d.ab.kind === 'contenu' ? 'de clic' : 'd\'ouverture'}, puis envoyée automatiquement aux <b>${100 - d.ab.share * 2} %</b> restants ${UI.sim('simulé')}. Le résultat (gagnante, écart) s'affiche dans l'onglet Résultats.</div></div>` : ''}
      <div class="fld full"><span class="lbl">Destinataires du BAT <small class="muted">liste mémorisée pour ${u.esc(R.client(d.client).name)}</small></span><div class="checks">${list.map(x => `<div class="chk ok"><span class="m">✓</span><span>${u.esc(x.name)} <small class="muted mono">${u.esc(x.email)} · ${u.esc(x.mobile)}</small></span></div>`).join('')}</div>
      <span class="help">Le client valide ou commente le BAT depuis son espace (lecture seule). Mise à disposition simulée : aucun envoi réel.</span></div></div>`;
  };

  function bind(el, d, user, step, refreshSum) {
    const rerender = () => { Z().save(); LD.app.renderView(); };
    el.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => {
      const g = b.dataset.chip, v = b.dataset.v;
      if (g === 'geo') d.crit.geo = v === 'France entière' ? 'france' : 'magasins';
      else { const a = d.crit[g]; const i = a.indexOf(v); if (i >= 0) a.splice(i, 1); else a.push(v); }
      d.segment = ''; rerender();
    });
    const rad = el.querySelector('#radius');
    if (rad) rad.oninput = () => { d.crit.radius = +rad.value; el.querySelector('#radius-v').textContent = 'rayon ' + rad.value + ' km'; el.querySelector('#funnel').innerHTML = funnelHtml(d); refreshSum(); Z().save(); };
    const cap = el.querySelector('[data-k="cap"]');
    if (cap) cap.addEventListener('input', () => { const f = el.querySelector('#funnel'); if (f) f.innerHTML = funnelHtml(d); });
    const seg = el.querySelector('#seg');
    if (seg) seg.onchange = () => { d.segment = seg.value; const s = D.segments.find(x => x.id === seg.value); if (s) { const r = u.rng(s.id); d.crit = { age: ['25-34', '35-49', '50-64'].slice(0, 2 + (r() < 0.5 ? 1 : 0)), csp: s.label.includes('CSP+') ? ['CSP+'] : [], radius: s.label.includes('30') ? 30 : 15, interests: [], behav: s.label.includes('Ouvreurs') ? ['Ouvreurs 90 jours'] : ['Actifs 6 mois'], geo: s.label.includes('Rayon') || s.label.includes('rayon') ? 'magasins' : 'france' }; } rerender(); };
    const ss = el.querySelector('#seg-save');
    if (ss) ss.onclick = () => { const v = Z().count(d); D.segments.push({ id: d.client + '-s' + D.segments.length, client: d.client, label: 'Segment du ' + u.fmtDate(LD.TODAY) + ' — ' + (d.name || 'sans nom'), count: v.raw, updated: LD.TODAY, uses: 0 }); S.log('Segment enregistré', d.client, user); UI.toast('Segment enregistré (' + u.n(v.raw) + ' contacts)', 'ok'); };
    const imp = el.querySelector('#imp-demo');
    if (imp) imp.onclick = () => { const rows = 184250; d.imp = { file: 'export-clients-' + d.client + '.csv', rows, dups: 6120, invalid: 9340, valid: rows - 6120 - 9340, map: [['EMAIL_ADR', d.channel === 'email' ? 'Email' : 'Mobile'], ['TEL_PORT', 'Mobile'], ['CIV', 'Civilité'], ['PRENOM', 'Prénom'], ['NOM', 'Nom'], ['CP', 'Code postal'], ['DATE_MAJ', 'Ignorer']] }; S.log('Import du fichier client (contenu fictif)', d.client, user); rerender(); };
    el.querySelectorAll('[data-c]').forEach(x => x.addEventListener('input', () => {
      const [a, b] = x.dataset.c.split('.'); d.content[a][b] = x.value; Z().save();
      const pc = Z().pseudoCamp(d), cl = R.client(d.client);
      if (a === 'sms') { const sc = K.smsCount(K.fill(d.content.sms.text, cl)); const m = el.querySelector('#smsm'); if (m) m.innerHTML = `<span><b>${sc.len}</b> caractères</span><span><b>${sc.parts}</b> SMS ${sc.parts > 1 ? '(coût × ' + sc.parts + ')' : ''}</span><span>${sc.unicode ? '<b style="color:var(--orange)">Unicode — 70 car. par SMS</b>' + (sc.bad.length ? ' à cause de : ' + sc.bad.map(z => '« ' + u.esc(z) + ' »').join(' ') : '') : '<b>GSM 7 bits</b> — 160 car. par SMS'}</span>`; }
      const ph = el.querySelector('#pv-ph'); if (ph) ph.innerHTML = (d.channel === 'rcs' ? K.rcsPreview(pc, d.content) : '') + (d.content.sms ? K.smsPreview(pc, d.content) : '');
      const pm = el.querySelector('#pv-mail'); if (pm && a === 'email') pm.innerHTML = K.emailPreview(pc, d.content, el.querySelector('[data-pv].on').dataset.pv);
      const ck = el.querySelector('#chk'); if (ck) ck.innerHTML = UI.checks(W.contentCheck(pc).items);
      refreshSum();
    }));
    el.querySelectorAll('[data-pv]').forEach(b => b.onclick = () => { el.querySelectorAll('[data-pv]').forEach(x => x.classList.toggle('on', x === b)); el.querySelector('#pv-mail').innerHTML = K.emailPreview(Z().pseudoCamp(d), d.content, b.dataset.pv); });
    // Import réel du gabarit (.html lu, .zip : nom et poids réels)
    const fi = el.querySelector('#tpl-file'), drop = el.querySelector('#tpl-drop');
    const doImport = file => {
      if (!file) return Promise.resolve(null);
      const p = K.importTemplate(file, d.content.email).then(() => { Z().save(); S.log('Gabarit importé : ' + file.name + ' (' + u.n(file.size) + ' octets)', d.client, user); UI.toast('Gabarit <b>' + u.esc(file.name) + '</b> importé (' + u.dec(file.size / 1024, 1) + ' ko)', 'ok'); rerender(); return d.content.email; })
        .catch(e => { const h = el.querySelector('#tpl-err'); if (h) h.innerHTML = '<b style="color:var(--red)">' + u.esc(e.message) + '</b>'; UI.toast(UI.icon('alert') + ' ' + u.esc(e.message), 'err'); return null; });
      Z().lastImport = p; return p;
    };
    if (fi) fi.onchange = () => doImport(fi.files[0]);
    if (drop) {
      drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
      drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag'); doImport(e.dataTransfer.files[0]); });
    }
    const tr = el.querySelector('#tpl-reset');
    if (tr) tr.onclick = e => { e.preventDefault(); delete d.content.email; Z().ensureContent(d); rerender(); };
    el.querySelectorAll('[data-ab]').forEach(b => b.onclick = () => {
      const v = b.dataset.ab, was = d.ab.kind; d.ab.on = v !== 'false'; if (d.ab.on) d.ab.kind = v;
      if (d.ab.on && (was !== d.ab.kind || !d.ab.b)) d.ab.b = LD.wizAb.abDefault(d);
      rerender();
    });
    const ab = el.querySelector('#ab-b');
    if (ab) ab.addEventListener('input', () => { d.ab.b = ab.value; Z().save(); const h = el.querySelector('#ab-help'); if (h) h.innerHTML = d.ab.b.trim() ? 'Enregistrée dans le brouillon' : '<b style="color:var(--red)">Version B vide : la création sera refusée</b>'; refreshSum(); });
    const sh = el.querySelector('#ab-share'); if (sh) sh.onchange = () => { d.ab.share = +sh.value; rerender(); };
  }

  LD.wizSteps = { 2: S3, 3: S4, 4: S5 };
  LD.wizBind = bind;
  LD.wizAb = { abA, abDefault, abKinds, AB_LABEL };
})(window.LD);
