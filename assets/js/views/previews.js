/* views/previews.js : contenu par défaut d'une campagne (fictif) et aperçus email (bureau / mobile),
 * téléphone SMS et RCS (carte enrichie, carrousel). Calcul GSM / Unicode du SMS.
 */
(function (LD) {
  'use strict';
  const u = LD.u, R = LD.ref;

  const GSM = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
  const GSM_EXT = '^{}\\[~]|€';
  function smsCount(text) {
    let unicode = false, len = 0;
    for (const ch of text) { if (GSM.includes(ch)) len += 1; else if (GSM_EXT.includes(ch)) len += 2; else { unicode = true; break; } }
    if (unicode) len = [...text].length;
    const single = unicode ? 70 : 160, multi = unicode ? 67 : 153;
    const parts = len <= single ? 1 : Math.ceil(len / multi);
    const bad = unicode ? [...text].filter(ch => !GSM.includes(ch) && !GSM_EXT.includes(ch)) : [];
    return { len, unicode, parts, single, multi, bad: [...new Set(bad)] };
  }

  function forCamp(c) {
    if (c.content) return c.content;
    const cl = R.client(c.client), sec = cl.sector, r = u.rng('ct' + c.id);
    const offer = { ameub: 'jusqu\'à -30 % sur une sélection', banque: 'frais de dossier offerts', assur: '2 mois offerts', mutu: '1 mois offert', auto: 'essai sans engagement', beaute: 'un soin offert dès 40 € d\'achat', telco: '6 mois à prix réduit', tour: '-20 % sur les départs d\'hiver' }[sec];
    const store = cl.d2s ? ' dans votre magasin le plus proche' : ' en ligne';
    const k = {};
    if (c.parts.some(p => p.ch === 'email')) k.email = {
      from: cl.name, fromEmail: 'offres@' + cl.id + '-demo.example', subject: c.name + ' : ' + offer, preheader: 'Offre valable jusqu\'à dimanche' + store,
      html: '<p>Bonjour {{prenom}},</p>… <a href="https://' + cl.id + '-demo.example/offre">Voir l&#39;offre</a> … <a href="{{desinscription}}">Se désinscrire</a>', weight: Math.round(r.range(38, 96)), images: r.int(3, 7), alt: true,
      links: [{ label: 'Bouton principal « J\'en profite »', url: 'https://' + cl.id + '-demo.example/offre', share: r.range(0.46, 0.6) }, { label: 'Visuel principal', url: 'https://' + cl.id + '-demo.example/offre#visuel', share: r.range(0.16, 0.24) },
        { label: cl.d2s ? 'Trouver mon magasin' : 'En savoir plus', url: 'https://' + cl.id + '-demo.example/' + (cl.d2s ? 'magasins' : 'infos'), share: r.range(0.08, 0.14) }, { label: 'Logo', url: 'https://' + cl.id + '-demo.example', share: r.range(0.03, 0.06) }, { label: 'Lien de désinscription', url: '{{desinscription}}', share: 0.02 }]
    };
    if (c.parts.some(p => p.ch === 'sms')) k.sms = { sender: cl.sender.slice(0, 11), text: cl.name + ' : ' + c.name + ', ' + offer + store + '. {{lien}} STOP 36XXX' };
    if (c.parts.some(p => p.ch === 'rcs')) k.rcs = { agent: cl.name, verified: true, title: c.name, text: offer[0].toUpperCase() + offer.slice(1) + store + '. Offre valable jusqu\'à dimanche. STOP au 36XXX', buttons: cl.d2s ? ['Voir l\'offre', 'Itinéraire vers le magasin', 'Appeler le magasin'] : ['Voir l\'offre', 'Être rappelé', 'Appeler'], carousel: sec === 'beaute' };
    // Normalise les totaux de la carte des clics
    if (k.email) { const s = u.sum(k.email.links, l => l.share); k.email.links.forEach(l => l.share /= s); }
    return k;
  }

  const fill = (t, cl) => String(t).replace(/\{\{\s*prenom\s*\}\}/g, 'Camille').replace(/\{\{\s*lien\s*\}\}/g, 'lds.li/' + cl.id.slice(0, 3) + '7K').replace(/\{\{\s*magasin\s*\}\}/g, 'Lyon Part-Dieu');
  // Aperçu d'un gabarit importé : iframe isolée (sandbox, aucun script) et politique de sécurité interdisant tout chargement externe
  const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:">`;
  // Le gabarit (souvent 600 px de large) est ramené à la largeur de l'aperçu, sans modifier le fichier
  const FIT = '<style>html,body{margin:0}table{max-width:100%!important}img{max-width:100%!important;height:auto!important}</style>';
  function frame(e, cl) { const doc = CSP + FIT + fill(e.html, cl).replace(/\{\{\s*desinscription\s*\}\}/g, '#desinscription'); return `<iframe class="mail-frame" sandbox="" title="Aperçu du gabarit importé" srcdoc="${u.esc(doc)}"></iframe>`; }
  function emailPreview(c, k, mode) {
    const cl = R.client(c.client), e = k.email;
    if (e.source === 'html' && e.html) return `<div class="mail-prev ${mode === 'mobile' ? 'mobile' : ''}"><div class="mail-bar"><b>${u.esc(e.from)}</b> &lt;${u.esc(e.fromEmail || '')}&gt;<br><b>${u.esc(fill(e.subject, cl))}</b> <span class="muted">— ${u.esc(fill(e.preheader || '', cl))}</span></div><div class="mail-body">${frame(e, cl)}</div></div>`;
    return `<div class="mail-prev ${mode === 'mobile' ? 'mobile' : ''}"><div class="mail-bar"><b>${u.esc(e.from)}</b> &lt;${u.esc(e.fromEmail || '')}&gt;<br><b>${u.esc(fill(e.subject, cl))}</b> <span class="muted">— ${u.esc(fill(e.preheader || '', cl))}</span></div>
      <div class="mail-body"><div class="mail-hero" style="background:linear-gradient(135deg, ${cl.color}, #0F1B33)"><small style="opacity:.8">${u.esc(cl.name)}</small><b>${u.esc(c.name)}</b></div>
      <div class="mail-txt">Bonjour Camille,<br><br>${u.esc(fill(e.preheader || '', cl))}. Découvrez notre sélection et profitez de conditions réservées aux abonnés.${cl.d2s ? '<br>Votre magasin le plus proche : <b>Lyon Part-Dieu</b> (2,4 km).' : ''}<br><a class="mail-cta" style="background:${cl.color}">J'en profite</a></div>
      <div class="mail-foot">Vous recevez cet email car vous avez accepté de recevoir les offres des partenaires de Live Data Solutions. <u>Se désinscrire</u> · Annonceur : ${u.esc(cl.name)} (société fictive) · Données fictives de démonstration.</div></div></div>`;
  }
  function phone(top, inner) {
    return `<div class="phone"><div class="phone-in"><div class="phone-top">${top}</div><div class="phone-msgs">${inner}</div></div></div>`;
  }
  function smsPreview(c, k) {
    const cl = R.client(c.client), t = fill(k.sms.text, cl).replace(/(lds\.li\/\S+)/, '<span class="lk">$1</span>');
    return phone(`${u.esc(k.sms.sender)}<small>SMS · aujourd'hui ${LD.wf.H2(c.parts.find(p => p.ch === 'sms').hour)}</small>`, `<div class="bubble">${t}</div>`);
  }
  function rcsCard(cl, k, img) {
    return `<div class="rcs-card"><div class="rcs-img" style="background:linear-gradient(135deg, ${cl.color}, #0F1B33)">${u.esc(img)}</div><div class="rcs-txt"><b>${u.esc(k.title)}</b>${u.esc(fill(k.text, cl))}</div>${k.buttons.map(b => `<span class="rcs-btn">${u.esc(b)}</span>`).join('')}</div>`;
  }
  function rcsPreview(c, k) {
    const cl = R.client(c.client), r = k.rcs;
    const body = r.carousel ? `<div class="rcs-car">${['Sérum éclat', 'Crème de jour', 'Coffret découverte'].map(x => rcsCard(cl, Object.assign({}, r, { title: x, buttons: r.buttons.slice(0, 2) }), x)).join('')}</div>` : rcsCard(cl, r, cl.name);
    return phone(`${u.esc(r.agent)}<small class="verified">✔ Agent vérifié de la marque</small>`, body);
  }
  // Gabarit par défaut de l'assistant : vrai document HTML (liens, images avec alt), contrôlé comme un fichier importé
  function defaultTemplate(cl, e) {
    const img = (alt, w, h, col) => `<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'%3E%3Crect width='100%25' height='100%25' fill='%23${col}'/%3E%3C/svg%3E" width="${w}" height="${h}" alt="${u.esc(alt)}" style="display:block;border:0">`;
    const L = e.links, a = (i, inner, st) => `<a href="${u.esc(L[i].url)}" style="${st || 'color:#233F93'}">${inner}</a>`;
    const col = (cl.color || '#233F93').replace('#', '');
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${u.esc(e.subject)}</title></head><body style="margin:0;background:#F6F8FB;font-family:Arial,sans-serif">
<table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" style="background:#fff">
<tr><td style="padding:16px 24px">${a(3, img('Logo ' + cl.name, 140, 36, col))}</td></tr>
<tr><td>${a(1, img(e.subject, 600, 260, col))}</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.5;color:#1F2937">Bonjour {{prenom}},<br><br>${u.esc(e.preheader)}. Découvrez notre sélection et profitez de conditions réservées aux abonnés.<br><br>${a(0, 'J\u2019en profite', 'display:inline-block;background:#' + col + ';color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold')}</td></tr>
<tr><td style="padding:0 24px 16px">${img('Sélection du moment', 552, 120, 'E5ECF6')}</td></tr>
<tr><td style="padding:0 24px 24px;font-size:14px">${a(2, L[2].label)}</td></tr>
<tr><td style="padding:16px 24px;font-size:11px;color:#6B7280;background:#F3F4F6">Vous recevez cet email car vous avez accepté de recevoir les offres des partenaires de Live Data Solutions. ${a(4, 'Se désinscrire', 'color:#6B7280')} · Annonceur : ${u.esc(cl.name)} (société fictive).</td></tr>
</table></body></html>`;
    const size = new TextEncoder().encode(html).length, an = LD.wf.htmlLinks(html);
    return Object.assign(e, { html, size, weight: Math.round(size / 1024 * 10) / 10, images: an.images, noAlt: an.noAlt, alt: !an.noAlt, file: 'gabarit-' + cl.id + '.html', source: null });
  }
  // Import d'un gabarit : un .html est réellement lu (contenu, poids, liens, images, textes alternatifs) ;
  // un .zip : nom et poids réels de l'archive, décompression et analyse en production (le HTML courant reste en place).
  function importTemplate(file, email) {
    const name = file.name || 'gabarit', ext = (name.split('.').pop() || '').toLowerCase(), kb = Math.round(file.size / 1024 * 10) / 10;
    if (!['html', 'htm', 'zip'].includes(ext)) return Promise.reject(new Error('Format non pris en charge : .' + ext + ' (attendu : .html ou .zip)'));
    if (ext === 'zip') { Object.assign(email, { file: name, size: file.size, zipKb: kb, source: 'zip', importedAt: LD.now().getTime() }); return Promise.resolve(email); }
    return file.text().then(txt => {
      const an = LD.wf.htmlLinks(txt), ls = an.links.filter(l => l.href);
      const w = ls.map((l, i) => /d[ée]sinscri|unsubscribe/i.test(l.href + ' ' + l.text) ? 0.12 : 1 / (i + 1)), tw = u.sum(w) || 1;
      Object.assign(email, { html: txt, file: name, size: file.size, weight: kb, images: an.images, noAlt: an.noAlt, alt: !an.noAlt, source: 'html', importedAt: LD.now().getTime(),
        links: ls.map((l, i) => ({ label: (l.text || l.href).slice(0, 60), url: l.href, share: w[i] / tw })) });
      delete email.zipKb; return email;
    });
  }
  LD.content = { forCamp, smsCount, emailPreview, smsPreview, rcsPreview, fill, importTemplate, defaultTemplate };
})(window.LD);
