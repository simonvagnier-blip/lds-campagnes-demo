/* ui.js : coquille de l'application (menu, barre haute, barre de filtres) et composants
 * réutilisables (cartes KPI, tableaux exportables, badges, modale, toast, étapes).
 */
window.LD = window.LD || {};

(function (LD) {
  'use strict';
  const u = LD.u, R = LD.ref, S = LD.store;

  const NAV = [
    { sec: 'Pilotage' },
    { id: 'dashboard', label: 'Tableau de bord', clabel: 'Accueil', icon: 'grid', client: true },
    { id: 'planning', label: 'Planning', icon: 'cal', client: true },
    { id: 'campagnes', label: 'Campagnes', icon: 'send', client: true },
    { id: 'validation', label: 'À valider', icon: 'check', count: 'validation' },
    { id: 'bat', label: 'BAT', clabel: 'BAT à valider', icon: 'eye', client: true, count: 'bat' },
    { sec: 'Clients & résultats' },
    { id: 'clients', label: 'Clients', icon: 'users' },
    { id: 'stats', label: 'Statistiques', icon: 'chart', client: true },
    { id: 'bilan', label: 'Bilan client', clabel: 'Mes bilans', icon: 'doc', client: true },
    { sec: 'Livraisons & facturation' },
    { id: 'livraisons', label: 'Livraisons de fichiers', clabel: 'Fichiers livrés', icon: 'box', client: true },
    { id: 'facturation', label: 'Facturation', icon: 'euro', right: 'billing' },
    { sec: 'Plateforme' },
    { id: 'routage', label: 'Routage & connecteurs', icon: 'flow' },
    { id: 'conformite', label: 'Base & conformité', icon: 'shield' },
    { id: 'admin', label: 'Administration', icon: 'key', right: 'admin' },
    { id: 'aide', label: 'Aide', icon: 'help', client: true }
  ];
  const ICONS = {
    grid: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    doc: '<path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',
    euro: '<path d="M18 7a6 6 0 100 10M4 10h10M4 14h10"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6M17 11a3 3 0 100-6M22 21c0-3-2-5-5-5.5"/>',
    flag: '<path d="M4 21V4M4 4h12l-2 4 2 4H4"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
    check: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
    flow: '<rect x="2" y="4" width="6" height="6" rx="1"/><rect x="16" y="4" width="6" height="6" rx="1"/><rect x="9" y="15" width="6" height="6" rx="1"/><path d="M8 7h8M19 10v3a2 2 0 01-2 2h-2M5 10v3a2 2 0 002 2h2"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 015 .5c0 2-2.5 2-2.5 4M12 17h.01"/>',
    dl: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>', logout: '<path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/>', alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2h3"/>',
    pause: '<path d="M8 5v14M16 5v14"/>', play: '<path d="M6 4l14 8-14 8z"/>', stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    msg: '<path d="M21 12a8 8 0 01-11.6 7.1L3 21l1.9-6.4A8 8 0 1121 12z"/>', star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
    pin: '<path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    rcs: '<rect x="3" y="4" width="18" height="13" rx="3"/><path d="M7 21l3-4M8 9h8M8 12h5"/>', link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>'
  };
  function icon(name, cls) { return `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`; }

  function navAllowed(item, user) {
    if (user.kind === 'client') return !!item.client;
    if (item.right && !user.rights[item.right]) return false;
    return true;
  }
  function navCount(item, user) {
    if (item.count === 'validation') return S.scopeCamps(user).filter(c => S.status(c) === 'a_valider' && (user.kind !== 'dir' || R.client(c.client).dir === user.id)).length;
    if (item.count === 'bat') return S.scopeCamps(user).filter(c => S.status(c) === 'bat').length;
    return 0;
  }

  function shell(route, user) {
    const nav = NAV.filter(it => it.sec || navAllowed(it, user));
    const cleaned = nav.filter((it, i) => !it.sec || (nav[i + 1] && !nav[i + 1].sec));
    const others = R.users.filter(x => x.id !== user.id);
    const isC = user.kind === 'client';
    return `
<div class="demo-banner">Maquette — données fictives, aucun envoi réel · connecteurs Sinch (SMS, RCS), plateforme email interne et base de contacts simulés</div>
<div class="app ${isC ? 'is-client' : ''}">
  <aside class="side">
    <div class="brand"><img src="assets/img/logo-livedata-white.svg" alt="Live Data"><div class="brand-sub">${isC ? 'Espace client<br><b>' + u.esc(R.client(user.client).name) + '</b>' : '<b>LDS Campagnes</b><br>Gestion des campagnes'}</div></div>
    ${!isC && user.rights.create ? `<a href="#/nouvelle" class="side-cta">${icon('plus')}<span>Nouvelle campagne</span></a>` : ''}
    <nav>${cleaned.map(it => { if (it.sec) return `<div class="nav-sec">${it.sec}</div>`; const n = it.count ? navCount(it, user) : 0;
      return `<a href="#/${it.id}" class="nav-i ${route === it.id ? 'on' : ''}">${icon(it.icon)}<span>${isC && it.clabel ? it.clabel : it.label}</span>${n ? `<em class="nav-n">${n}</em>` : ''}</a>`; }).join('')}</nav>
    <div class="side-foot"><div class="host">${icon('lock')}<span>${isC ? 'Accès en lecture seule · seules actions : valider ou commenter un BAT, télécharger vos bilans et fichiers (tracé)' : 'Outil interne Live Data Solutions · 6 utilisateurs + espaces clients en lecture seule'}</span></div></div>
  </aside>
  <main class="main">
    <header class="top">
      <div class="top-l"><h1 id="page-title"></h1><div class="scope-badge" title="Périmètre de données de l'utilisateur connecté">${icon(isC ? 'lock' : 'users')} ${u.esc(S.scopeLabel(user))}</div></div>
      <div class="top-r">
        <div class="live-clock" id="live-clock"><span class="dot"></span><span id="clock-txt"></span></div>
        <div class="switch-user">
          <label>Démo · changer d'utilisateur</label>
          <select id="switch-user"><option value="${user.id}" selected>${u.esc(user.name)} — ${u.esc(user.role)}</option>${others.map(o => `<option value="${o.id}">${u.esc(o.name)} — ${u.esc(o.role)}</option>`).join('')}</select>
        </div>
        <div class="user"><div class="avatar ${isC ? 'cl' : ''}">${u.esc(user.name.split(' ').map(w => w[0]).join('').slice(0, 2))}</div><div><b>${u.esc(user.name)}</b><small>${u.esc(user.role)}</small></div>
        <a href="#/logout" class="btn-icon" title="Se déconnecter">${icon('logout')}</a></div>
      </div>
    </header>
    <div id="filters"></div>
    <section id="view" class="view"></section>
    <footer class="foot">Live Data Solutions · LDS Campagnes — maquette v2 · données fictives générées localement, aucun appel réseau · <span id="gen-info"></span></footer>
  </main>
</div>
<div id="modal-root"></div><div id="toast-root"></div>`;
  }

  // ---------- Barre de filtres ----------
  // opts : { show: ['period','client','channel','sector','cdc','status','type'], noExport }
  function filterBar(opts) {
    opts = opts || {};
    const user = S.currentUser(), isC = user.kind === 'client';
    const show = (opts.show || ['period', 'client', 'channel', 'sector', 'cdc', 'type']).filter(k => !isC || !['client', 'sector', 'cdc'].includes(k));
    const f = S.filters;
    const sel = (k, label, items, all) => `<label class="flt"><span>${label}</span><select data-f="${k}"><option value="">${all}</option>${items.map(i => `<option value="${i.v}" ${String(f[k]) === String(i.v) ? 'selected' : ''}>${u.esc(i.l)}</option>`).join('')}</select></label>`;
    let h = '<div class="filters">';
    if (show.includes('period')) {
      h += `<label class="flt"><span>Période</span><select data-f="period">${S.PERIODS.map(p => `<option value="${p.id}" ${f.period === p.id ? 'selected' : ''}>${p.label}</option>`).join('')}</select></label>`;
      if (f.period === 'custom') { const [a, b] = S.periodRange(); h += `<label class="flt"><span>Du</span><input type="date" data-f="from" value="${a}" min="${LD.config.DATA_START}" max="${LD.TODAY}"></label><label class="flt"><span>Au</span><input type="date" data-f="to" value="${b}" min="${LD.config.DATA_START}" max="${LD.TODAY}"></label>`; }
    }
    if (show.includes('client')) h += sel('client', 'Client', S.scopeClients().map(c => ({ v: c.id, l: c.name })), 'Tous les clients');
    if (show.includes('channel')) h += sel('channel', 'Canal', R.channels.map(c => ({ v: c.id, l: c.label })), 'Tous');
    if (show.includes('sector')) h += sel('sector', 'Secteur', R.sectors.map(s => ({ v: s.id, l: s.label })), 'Tous');
    if (show.includes('cdc')) h += sel('cdc', 'Chargé de campagne', R.cdcs().map(x => ({ v: x.id, l: x.name })), 'Tous');
    if (show.includes('type')) h += sel('type', 'Type', R.types.map(x => ({ v: x.id, l: x.label })), 'Tous');
    if (show.includes('status')) h += sel('status', 'Statut', Object.keys(R.STATUS).map(k => ({ v: k, l: R.STATUS[k].label })), 'Tous');
    const active = ['client', 'channel', 'cdc', 'status', 'sector', 'type'].some(k => f[k]) || f.period !== '30d';
    if (show.includes('period')) h += `<div class="flt-sum">${icon('info')}<span>${u.esc(S.periodLabel())}</span>${active ? '<button class="link" data-reset>Réinitialiser</button>' : ''}</div>`;
    else if (active) h += `<div class="flt-sum"><button class="link" data-reset>Réinitialiser</button></div>`;
    if (!opts.noExport) h += `<div class="flt-exp"><span>Exporter</span><button class="btn sm" data-exp="csv">CSV</button><button class="btn sm" data-exp="xls">Excel</button><button class="btn sm" data-exp="pdf" title="Impression de l'écran ; « Enregistrer au format PDF » dans la boîte d'impression du navigateur">Imprimer / PDF</button></div>`;
    return h + '</div>';
  }

  // ---------- Composants ----------
  function kpi(o) {
    return `<div class="kpi ${o.cls || ''}" ${o.id ? `id="${o.id}"` : ''}><div class="kpi-l">${u.esc(o.label)}${o.hint ? `<span class="hint" title="${u.esc(o.hint)}">${icon('info')}</span>` : ''}</div><div class="kpi-v" ${o.vid ? `id="${o.vid}"` : ''}>${o.value}</div>${o.sub ? `<div class="kpi-s">${o.sub}</div>` : ''}${o.spark || ''}</div>`;
  }
  function card(title, body, o) {
    o = o || {};
    return `<div class="card ${o.cls || ''}" ${o.id ? `id="${o.id}"` : ''}><div class="card-h"><h3>${title}</h3>${o.tools || ''}</div><div class="card-b">${body}</div>${o.foot ? `<div class="card-f">${o.foot}</div>` : ''}</div>`;
  }
  function badge(text, cls) { return `<span class="badge ${cls || ''}">${u.esc(text)}</span>`; }
  function rag(level, text) { const m = { ok: 'b-green', warn: 'b-orange', risk: 'b-red', na: 'b-grey' }; return badge(text, m[level] || 'b-grey'); }
  function statusBadge(c) { const s = R.status(S.status(c)); return `<span class="badge ${s.cls}">${S.status(c) === 'en_cours' ? '<span class="dot sm"></span>' : ''}${u.esc(s.label)}</span>`; }
  function chBadge(ch) { const c = R.channel(ch); return `<span class="chb ch-${ch}">${u.esc(c.short)}</span>`; }
  function sim(text) { return `<span class="sim" title="Fonction simulée dans la maquette : le branchement réel reste à faire">${u.esc(text || 'simulé')}</span>`; }
  // Liste de contrôles : ok (✓), bloquant (✕) ou signalé sans bloquer (!)
  function checks(items) { return items.map(i => { const c = i.ok ? 'ok' : i.warn ? 'wa' : 'ko'; return `<div class="chk ${c}"><span class="m">${i.ok ? '✓' : i.warn ? '!' : '✕'}</span><span>${u.esc(i.label)}</span></div>`; }).join(''); }
  function legal() { return `<span class="legal-tag" title="Règle à valider avant la mise en production">règle à confirmer avec le juridique</span>`; }

  function table(t) {
    const idx = LD.exporter.register({ title: t.title, columns: t.columns.map(c => c.label || c), rows: t.rows.map(r => t.raw ? t.raw(r) : r), meta: t.meta || [S.periodLabel(), S.scopeLabel(), 'Données fictives — maquette'] });
    const cols = t.columns.map(c => typeof c === 'string' ? { label: c } : c);
    const rows = t.max ? t.rows.slice(0, t.max) : t.rows;
    const body = rows.map(r => '<tr' + (t.rowAttr ? ' ' + t.rowAttr(r) : '') + '>' + (t.render ? t.render(r) : r).map((v, i) => `<td class="${cols[i] && cols[i].align === 'r' ? 'r' : ''}">${v == null ? '—' : v}</td>`).join('') + '</tr>').join('');
    const foot = t.foot ? '<tfoot><tr>' + t.foot.map((v, i) => `<td class="${cols[i] && cols[i].align === 'r' ? 'r' : ''}">${v}</td>`).join('') + '</tr></tfoot>' : '';
    const tools = `<div class="tbl-tools"><button class="btn xs" data-texp="${idx}" data-fmt="csv">${icon('dl')}CSV</button><button class="btn xs" data-texp="${idx}" data-fmt="xls">${icon('dl')}Excel</button></div>`;
    return { html: `<div class="tbl-wrap ${t.cls || ''}"><table class="tbl"><thead><tr>${cols.map(c => `<th class="${c.align === 'r' ? 'r' : ''}">${u.esc(c.label)}</th>`).join('')}</tr></thead><tbody>${body || `<tr><td colspan="${cols.length}" class="empty">${t.empty || 'Aucune donnée sur ce périmètre / cette période'}</td></tr>`}</tbody>${foot}</table></div>${t.max && t.rows.length > t.max ? `<div class="note" style="margin-top:8px">${t.max} premières lignes affichées sur ${u.n(t.rows.length)} — l'export contient toutes les lignes.</div>` : ''}`, tools, idx };
  }

  function modal(title, body, o) {
    o = o || {};
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal-bg"><div class="modal ${o.wide ? 'wide' : ''}"><div class="modal-h"><h3>${title}</h3><button class="btn-icon" data-close>✕</button></div><div class="modal-b">${body}</div>${o.foot ? `<div class="modal-f">${o.foot}</div>` : ''}</div></div>`;
    root.querySelector('[data-close]').onclick = closeModal;
    root.querySelector('.modal-bg').onclick = e => { if (e.target.classList.contains('modal-bg')) closeModal(); };
    return root;
  }
  function closeModal() { const r = document.getElementById('modal-root'); if (r) r.innerHTML = ''; }
  function toast(msg, cls) {
    const root = document.getElementById('toast-root'); if (!root) return;
    const el = document.createElement('div'); el.className = 'toast ' + (cls || ''); el.innerHTML = msg; root.appendChild(el);
    setTimeout(() => el.classList.add('out'), 4800); setTimeout(() => el.remove(), 5400);
  }
  // Retour d'une action du workflow
  function result(r, okMsg) {
    if (!r.ok) { toast(icon('alert') + ' <b>Action refusée</b><br>' + u.esc(r.msg), 'err'); return false; }
    toast('<b>' + u.esc(okMsg || r.msg) + '</b>' + (r.warn && r.warn.length ? '<br><small style="color:#FDE7B0">' + r.warn.map(u.esc).join('<br>') + '</small>' : ''), r.warn && r.warn.length ? 'warn' : 'ok');
    return true;
  }
  function delta(cur, prev, invert) {
    if (!prev || cur == null) return '';
    const d = (cur - prev) / prev, good = invert ? d <= 0 : d >= 0;
    return `<span class="delta ${good ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${u.pct(Math.abs(d))}</span>`;
  }
  function steps(cur, labels) {
    labels = labels || R.STEPS;
    return `<div class="steps">${labels.map((l, i) => `<div class="step ${i < cur ? 'done' : i === cur ? 'cur' : ''}">${u.esc(l)}</div>`).join('')}</div>`;
  }
  function money(v, dec) { return v == null ? '—' : (dec ? u.dec(v, 2) : u.n(v)) + ' €'; }
  function avatar(uid, small) { const x = R.user(uid); if (!x) return ''; return `<span class="av ${small ? 'sm' : ''}" title="${u.esc(x.name)}">${x.name.split(' ').map(w => w[0]).join('')}</span>`; }
  function clientDot(cid) { const c = R.client(cid); return `<i class="cdot" style="background:${c.color}"></i>`; }

  LD.views = LD.views || {};
  LD.ui = { NAV, icon, shell, filterBar, kpi, card, badge, rag, statusBadge, chBadge, sim, legal, checks, table, modal, closeModal, toast, result, delta, steps, money, avatar, clientDot, navAllowed };
})(window.LD);
