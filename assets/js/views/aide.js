/* views/aide.js : aide intégrée — questions fréquentes, parcours d'une campagne, glossaire. */
(function (LD) {
  'use strict';
  const u = LD.u, UI = LD.ui, R = LD.ref, S = LD.store;
  const FAQ_LDS = [
    ['Comment créer une campagne ?', 'Bouton « Nouvelle campagne » : six étapes (brief, canal, ciblage, contenu, test A/B et BAT, programmation). Le brouillon est enregistré à chaque modification.'],
    ['Qui valide une campagne ?', 'Le client valide le BAT depuis son espace (ou le chargé le saisit pour lui). La directrice de clientèle rattachée au compte valide ensuite la campagne ; elle seule le peut. La campagne peut alors être programmée puis lancée.'],
    ['Comment replanifier ?', 'Dans le planning, glissez la campagne vers un autre jour. Seules les campagnes non lancées se déplacent ; les fenêtres d\'envoi, la surcharge du routage et la pression marketing sont vérifiées.'],
    ['Quelles sont les fenêtres d\'envoi SMS ?', 'Par défaut : 8 h – 20 h, ni le dimanche ni les jours fériés. Règle à confirmer avec le juridique ; elle se règle dans Administration.'],
    ['Que se passe-t-il en cas de problème pendant un envoi ?', '« Mettre en pause » suspend le routage ; « Reprendre » le relance là où il s\'était arrêté. « Arrêt d\'urgence » stoppe définitivement : les messages déjà routés restent comptés.'],
    ['Comment est calculé le montant facturable ?', 'Location de la base LDS : délivrés × prix au mille du client. Routage de la base client : envoyés × prix de routage. Création graphique en forfait. C\'est une proposition, ajustable ligne par ligne dans Facturation.'],
    ['Pourquoi une livraison de fichier est-elle bloquée ?', 'Toute livraison exige la validation de la directrice du compte. Les fiches télémarketing exigent en plus un passage Bloctel de moins de 30 jours.'],
    ['D\'où viennent les chiffres ?', 'De la maquette : données fictives générées localement, base de contacts virtuelle, connecteurs simulés. Aucun chiffre n\'est une performance réelle de LDS.']
  ];
  const FAQ_CL = [
    ['Que puis-je faire dans mon espace ?', 'Consulter vos campagnes, votre planning, vos statistiques et vos bilans ; valider ou commenter un BAT ; télécharger vos bilans et vos fichiers livrés. Toutes les autres données sont en lecture seule.'],
    ['Comment valider un BAT ?', 'Menu « BAT à valider », ouvrez la campagne : bouton « Valider le BAT » ou « Envoyer un commentaire ». Votre décision est tracée.'],
    ['Quand le CA magasin apparaît-il ?', 'Dès que vous nous l\'avez déclaré, en général 5 à 14 jours après l\'envoi.'],
    ['Qui contacter ?', 'Votre directrice de clientèle Live Data Solutions.']
  ];
  LD.views.aide = {
    title: 'Aide', client: true, filters: false,
    render(el, arg, user) {
      const isC = S.isClient(user), faq = isC ? FAQ_CL : FAQ_LDS;
      el.innerHTML = `<div class="grid" style="grid-template-columns:1.5fr 1fr;align-items:start">${UI.card('Questions fréquentes', `<div style="display:flex;flex-direction:column;gap:6px">${faq.map((q, i) => `<details class="faq" ${i === 0 ? 'open' : ''} style="border:1px solid var(--line);border-radius:10px;padding:10px 14px"><summary style="cursor:pointer;font-weight:600;color:var(--navy)">${u.esc(q[0])}</summary><p style="margin:8px 0 2px;font-size:13px;line-height:1.6">${u.esc(q[1])}</p></details>`).join('')}</div>`)}
        <div style="display:flex;flex-direction:column;gap:16px">${UI.card('Parcours d\'une campagne', UI.steps(6) + `<div class="note" style="margin-top:12px">Brouillon → BAT (client) → validation (directrice) → programmation → envoi → terminée. Chaque étape est tracée au journal.</div>`)}
          ${UI.card('Glossaire', `<dl class="mini-kv"><dt>Délivrés</dt><dd>messages acceptés par la messagerie ou l'opérateur</dd><dt>Ouvreurs</dt><dd>contacts uniques ayant ouvert l'email</dd><dt>Réactivité</dt><dd>cliqueurs / ouvreurs</dd><dt>Opt-out</dt><dd>désinscriptions email et STOP SMS / RCS</dd><dt>Repoussoir</dt><dd>fichier du client à exclure (ses clients)</dd><dt>Prise de parole</dt><dd>une campagne, même en plusieurs envois</dd><dt>ROAS</dt><dd>CA déclaré / coût de la campagne</dd><dt>Seeds</dt><dd>adresses témoins insérées dans un fichier livré</dd></dl>`)}
          ${UI.card('Support', `<div class="note">Maquette v2 — ${isC ? 'votre directrice de clientèle' : 'administrateur : ' + u.esc(R.users.find(x => x.kind === 'admin').name)}. Données fictives, aucun envoi réel.</div>`)}</div></div>`;
    }
  };
})(window.LD);
