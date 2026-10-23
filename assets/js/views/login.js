/* views/login.js : connexion — compte nominatif (identifiant + mot de passe) ou SSO Google Workspace LDS (simulé). */
(function (LD) {
  'use strict';
  const u = LD.u, UI = LD.ui, R = LD.ref, S = LD.store;
  const DEMO_PWD = 'demo';

  function render(root) {
    const bars = [38, 60, 86, 112, 140, 112, 86, 60, 38].map(h => `<i style="height:${h * 1.6}px"></i>`).join('');
    root.innerHTML = `
<div class="demo-banner">Maquette — données fictives, aucun envoi réel · connecteurs Sinch (SMS, RCS), plateforme email interne et base de contacts simulés</div>
<div class="login-page">
  <div class="login-hero">
    <img src="assets/img/logo-livedata-white.svg" alt="Live Data">
    <h2>Gestion des campagnes<br><span>LDS Campagnes</span></h2>
    <p>Préparez, faites valider, programmez et suivez toutes les campagnes email, SMS et RCS de vos clients — de la brief au bilan, au même endroit.</p>
    <div class="login-feats">
      <div>${UI.icon('cal')}<span>Planning partagé, file d'envoi du jour et charge du routage</span></div>
      <div>${UI.icon('send')}<span>Assistant de création : ciblage, contenu, BAT, programmation</span></div>
      <div>${UI.icon('check')}<span>Circuit de validation : BAT client, puis directrice de clientèle</span></div>
      <div>${UI.icon('chart')}<span>Résultats en direct : délivrés, ouvertures, clics, STOP, CA magasin</span></div>
      <div>${UI.icon('box')}<span>Livraisons de fichiers et fiches télémarketing tracées, Bloctel</span></div>
      <div>${UI.icon('euro')}<span>Facturation au mille, suivi des bons de commande, bilans clients</span></div>
    </div>
    <div class="login-bars">${bars}</div>
    <div class="legal">Outil interne Live Data Solutions · espaces clients en lecture seule · maquette : aucun envoi, aucun appel réseau</div>
  </div>
  <div class="login-form">
    <div class="login-box">
      <span class="client">${UI.icon('lock')} Accès équipes LDS et clients</span>
      <h1>Connexion</h1>
      <p>Accès nominatif. Chaque action est tracée au journal.</p>
      <button class="btn sso-btn" id="sso">${UI.icon('key')} Connexion avec le compte Google Workspace LDS</button>
      <div class="sso-sub"><span class="sim">simulé</span> Authentification unique à brancher sur l'annuaire LDS ; double authentification pour les comptes clients</div>
      <div class="or">ou avec votre compte nominatif</div>
      <form id="lf" autocomplete="off">
        <div class="field"><label for="lg">Identifiant</label><input id="lg" placeholder="prenom.nom@…" value=""></div>
        <div class="field"><label for="pw">Mot de passe</label><input id="pw" type="password" placeholder="••••••••"></div>
        <div class="login-err" id="lerr"></div>
        <button class="btn primary" type="submit">Se connecter</button>
      </form>
      <div class="demo-accounts">
        <h4>Comptes de démonstration · mot de passe « ${DEMO_PWD} »</h4>
        ${R.users.map(x => `<button data-u="${x.id}"><span><b>${u.esc(x.name)}</b> · ${u.esc(x.role)}<br><small>${u.esc(x.login)}</small></span><small>${u.esc(S.scopeLabel(x))}</small></button>`).join('')}
      </div>
    </div>
  </div>
</div>`;
    const lg = root.querySelector('#lg'), pw = root.querySelector('#pw'), err = root.querySelector('#lerr');
    root.querySelectorAll('[data-u]').forEach(b => b.onclick = () => { lg.value = R.user(b.dataset.u).login; pw.value = DEMO_PWD; pw.focus(); });
    root.querySelector('#lf').onsubmit = e => {
      e.preventDefault();
      const usr = R.users.find(x => x.login.toLowerCase() === lg.value.trim().toLowerCase());
      if (!usr || pw.value !== DEMO_PWD) { err.textContent = 'Identifiant ou mot de passe incorrect.'; return; }
      S.login(usr.id); location.hash = '#/dashboard'; LD.app.render();
    };
    root.querySelector('#sso').onclick = () => {
      const scr = document.createElement('div'); scr.className = 'sso-screen';
      scr.innerHTML = `<div><div class="spinner"></div><h3>Authentification unique simulée…</h3><p class="note">En production : redirection vers l'annuaire Google Workspace de LDS. Ici : connexion au compte de démonstration de la chargée de campagne Sarah Benali.</p></div>`;
      document.body.appendChild(scr);
      setTimeout(() => { scr.remove(); S.login('u-sarah'); location.hash = '#/dashboard'; LD.app.render(); }, 1200);
    };
  }
  LD.views.login = { render };
})(window.LD);
