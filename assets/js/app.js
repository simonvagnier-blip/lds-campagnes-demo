/* app.js : routeur (#/vue/argument), coquille, délégation d'événements,
 * horloge et rafraîchissement « temps réel » des vues qui l'exposent.
 */
window.LD = window.LD || {};
LD.views = LD.views || {};

(function (LD) {
  'use strict';
  const u = LD.u, S = LD.store, UI = LD.ui, R = LD.ref;
  let liveTimer = null, currentRoute = null, currentView = null;
  const PARENT = { campagne: 'campagnes', client: 'clients' };

  function parseHash() {
    const h = (location.hash || '#/dashboard').replace(/^#\/?/, '');
    const [route, ...rest] = h.split('/');
    return { route: route || 'dashboard', arg: decodeURIComponent(rest.join('/')) };
  }
  function allowed(route, view, user) {
    const nav = UI.NAV.find(n => n.id === (PARENT[route] || route));
    if (user.kind === 'client') return !!view.client;
    if (nav) return UI.navAllowed(nav, user);
    if (view.right && !user.rights[view.right]) return false;
    return true;
  }

  function render() {
    const { route, arg } = parseHash();
    const user = S.currentUser();
    if (route === 'logout') { S.logout(); location.hash = '#/login'; return; }
    if (!user || route === 'login') {
      if (user && route === 'login') { location.hash = '#/dashboard'; return; }
      stopLive(); currentRoute = 'login';
      document.body.className = 'is-login';
      LD.views.login.render(document.getElementById('root'));
      return;
    }
    let view = LD.views[route];
    if (!view || !allowed(route, view, user)) view = LD.views.denied;
    document.body.className = '';
    const root = document.getElementById('root');
    const navRoute = PARENT[route] || route;
    if (currentRoute === 'login' || !root.querySelector('.app') || root.dataset.user !== user.id || root.dataset.route !== navRoute) {
      root.innerHTML = UI.shell(navRoute, user);
      root.dataset.user = user.id; root.dataset.route = navRoute;
      bindShell();
    }
    currentRoute = route; currentView = view;
    renderView(arg);
    window.scrollTo(0, 0);
  }

  function renderView(arg) {
    const view = currentView, user = S.currentUser();
    if (arg === undefined) arg = parseHash().arg;
    LD.exporter.reset(); UI.closeModal();
    const title = typeof view.title === 'function' ? view.title(arg, user) : view.title;
    document.getElementById('page-title').textContent = title;
    document.title = title + ' · LDS Campagnes';
    const fl = document.getElementById('filters');
    const fopts = typeof view.filters === 'function' ? view.filters(user) : view.filters;
    fl.innerHTML = fopts === false ? '' : UI.filterBar(fopts || {});
    const el = document.getElementById('view');
    const t0 = performance.now();
    LD.charts.clear();
    try { view.render(el, arg, user); LD.charts.mount(el); }
    catch (e) { console.error(e); window.dispatchEvent(new ErrorEvent('error', { message: e.message + ' @ ' + (e.stack || '').split('\n')[1] })); el.innerHTML = `<div class="alert risk">${UI.icon('alert')}<div><b>Erreur d'affichage</b><br>${u.esc(e.message)}</div></div>`; }
    document.getElementById('gen-info').textContent = 'Calculé en ' + Math.round(performance.now() - t0) + ' ms';
    stopLive();
    if (view.live && !/[?&]static=1/.test(location.search)) liveTimer = setInterval(() => { try { view.live(el, user); } catch (e) { console.error(e); } }, 2000);
    tickClock(); refreshCounts();
  }
  function stopLive() { if (liveTimer) clearInterval(liveTimer); liveTimer = null; }
  function refreshCounts() {
    const user = S.currentUser(); if (!user) return;
    document.querySelectorAll('.nav-i').forEach(a => {
      const id = a.getAttribute('href').slice(2), it = UI.NAV.find(n => n.id === id); if (!it || !it.count) return;
      const n = it.count === 'validation' ? S.scopeCamps(user).filter(c => S.status(c) === 'a_valider' && (user.kind !== 'dir' || R.client(c.client).dir === user.id)).length : S.scopeCamps(user).filter(c => S.status(c) === 'bat').length;
      let em = a.querySelector('.nav-n'); if (!n) { if (em) em.remove(); return; }
      if (!em) { em = document.createElement('em'); em.className = 'nav-n'; a.appendChild(em); } em.textContent = n;
    });
  }
  LD.refreshCounts = refreshCounts;

  function tickClock() {
    const c = document.getElementById('clock-txt'); if (!c) return;
    const d = LD.now();
    c.textContent = 'En direct · ' + u.DOWS[d.getDay()].toLowerCase() + '. ' + u.fmtDateTime(d).slice(0, 16).replace(' ', ' · ');
  }
  setInterval(tickClock, 15000);

  function bindShell() {
    const root = document.getElementById('root');
    if (root.dataset.bound) return; root.dataset.bound = '1';
    root.addEventListener('change', e => {
      const t = e.target;
      if (t.id === 'switch-user') {
        const usr = R.user(t.value);
        S.login(t.value);
        UI.toast('Connecté en tant que <b>' + u.esc(usr.name) + '</b> — ' + u.esc(usr.role) + '<br><small style="color:#B8CBEA">Périmètre : ' + u.esc(S.scopeLabel(usr)) + '</small>');
        root.dataset.user = '';
        const { route } = parseHash();
        const v = LD.views[route];
        if (usr.kind === 'client' && (!v || !v.client)) { location.hash = '#/dashboard'; return; }
        render(); return;
      }
      if (t.dataset.f) {
        S.setFilter(t.dataset.f, t.value);
        if (t.dataset.f === 'period' && t.value === 'custom') { const [a, b] = S.periodRange({ period: '30d' }); S.setFilter('from', a); S.setFilter('to', b); }
        renderView();
      }
    });
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-exp],[data-texp],[data-reset],[data-href]');
      if (!b) return;
      if (b.dataset.reset != null) { S.resetFilters(); renderView(); return; }
      if (b.dataset.href) { if (e.target.closest('button,a,select,input') && e.target.closest('button,a,select,input') !== b) return; location.hash = b.dataset.href; return; }
      if (b.dataset.texp != null) {
        const t = LD.exporter.get(+b.dataset.texp);
        if (b.dataset.fmt === 'csv') LD.exporter.csv(t); else LD.exporter.excel(t);
        UI.toast('Export ' + (b.dataset.fmt === 'csv' ? 'CSV' : 'Excel') + ' généré : <b>' + u.esc(t.title) + '</b> (' + t.rows.length + ' lignes)', 'ok');
        return;
      }
      if (b.dataset.exp) {
        const fmt = b.dataset.exp;
        if (fmt === 'pdf') { LD.exporter.pdf(document.title); return; }
        const tabs = LD.exporter.all();
        if (!tabs.length) { UI.toast('Aucun tableau exportable sur cet écran', 'warn'); return; }
        const t = tabs[0];
        if (fmt === 'csv') LD.exporter.csv(t); else LD.exporter.excel(t);
        UI.toast('Export ' + (fmt === 'csv' ? 'CSV' : 'Excel') + ' : <b>' + u.esc(t.title) + '</b>', 'ok');
      }
    });
  }

  LD.views.denied = {
    title: 'Accès non autorisé', filters: false, client: true,
    render(el, arg, user) {
      el.innerHTML = `<div class="alert risk">${UI.icon('lock')}<div><b>Cette rubrique ou cette donnée n'est pas incluse dans vos droits.</b><br>Profil « ${u.esc(user.role)} » · périmètre : ${u.esc(S.scopeLabel(user))}. Les droits sont attribués par l'administrateur (rubrique « Administration »).</div></div>`;
      S.log('Tentative d\'accès refusée : ' + location.hash);
    }
  };

  window.addEventListener('error', e => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:999;background:#DC3545;color:#fff;padding:8px 14px;font:12px monospace';
    d.className = 'js-error'; d.textContent = 'Erreur JS : ' + e.message + ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')';
    document.body.appendChild(d);
  });
  window.addEventListener('hashchange', render);
  document.addEventListener('DOMContentLoaded', () => {
    if (!location.hash) location.hash = S.currentUser() ? '#/dashboard' : '#/login';
    render();
  });
  LD.app = { render, renderView, parseHash, go: h => { location.hash = h; } };
})(window.LD);
