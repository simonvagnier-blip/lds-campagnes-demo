/* views/planning.js : calendrier mois / semaine / liste, charge du routage par jour,
 * glisser-déposer pour replanifier une campagne non lancée (contrôles du workflow).
 * Arguments : #/planning/mois/AAAA-MM · #/planning/semaine/AAAA-MM-JJ · #/planning/liste
 */
(function (LD) {
  'use strict';
  const u = LD.u, UI = LD.ui, S = LD.store, R = LD.ref, C = LD.config, W = LD.wf, TODAY = LD.TODAY;
  const STC = { brouillon: '#94A3B8', bat: '#F59E0B', bat_ok: '#00ADDA', a_valider: '#F97316', validee: '#3B6FD8', programmee: '#233F93', en_cours: '#12A16B', pause: '#F59E0B', terminee: '#64748B', annulee: '#E5484D' };
  const fmtVol = v => v >= 1e6 ? u.dec(v / 1e6, 1) + ' M' : v >= 1000 ? u.n(v / 1000) + ' k' : u.n(v);

  function ev(c, user) {
    const st = S.status(c), drag = !S.isClient(user) && S.PRE.includes(st);
    return `<div class="ev s-${st}" ${drag ? 'draggable="true"' : ''} data-id="${c.id}" data-href="#/campagne/${c.id}" style="border-left-color:${R.channel(c.channel).color}" title="${u.esc(R.client(c.client).name + ' · ' + c.name + '\n' + R.channel(c.channel).label + ' · ' + u.n(c.volume) + ' messages · ' + R.status(st).label + ' · ' + R.user(c.cdc).name + (drag ? '\nGlisser pour replanifier' : ''))}"><i class="st" style="background:${STC[st]}"></i><span class="t">${W.H2(S.hourOf(c))}</span><span class="n">${u.esc(R.client(c.client).name.split(' ')[0])} · ${u.esc(c.name)}</span></div>`;
  }
  function dayLoadHtml(d) {
    const v = S.dayLoad(d); if (!v) return '';
    return `<span class="cal-load ${v > C.CAPACITY_DAY ? 'hot' : ''}" title="Charge du routage ce jour (tous clients) : ${u.n(v)} messages · capacité ${u.n(C.CAPACITY_DAY)}">${v > C.CAPACITY_DAY ? '⚠ ' : ''}${fmtVol(v)}</span>`;
  }

  function month(ym, user, camps) {
    const first = ym + '-01', start = u.addDays(first, -((u.dow(first) + 6) % 7));
    const by = u.groupBy(camps, c => S.dateOf(c));
    let h = '<div class="cal">' + ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(x => `<div class="cal-h">${x}</div>`).join('');
    for (let i = 0; i < 42; i++) {
      const d = u.addDays(start, i); if (i % 7 === 0 && i >= 28 && d.slice(0, 7) !== ym) break;
      const items = (by[d] || []).sort((a, b) => S.hourOf(a) - S.hourOf(b)), load = S.dayLoad(d);
      const cls = [d.slice(0, 7) !== ym ? 'out' : '', d === TODAY ? 'today' : '', u.dow(d) % 6 === 0 ? 'we' : '', load > C.CAPACITY_DAY && !S.isClient(user) ? 'over' : ''].join(' ');
      h += `<div class="cal-d ${cls}" data-day="${d}"><div class="cal-top"><span class="cal-n">${+d.slice(8)}${W.isHoliday(d) ? ' <small class="muted" style="font-weight:400">férié</small>' : ''}</span>${S.isClient(user) ? '' : dayLoadHtml(d)}</div>${items.slice(0, 4).map(c => ev(c, user)).join('')}${items.length > 4 ? `<span class="cal-more" data-more="${d}">+ ${items.length - 4} autre(s)</span>` : ''}</div>`;
    }
    return h + '</div>';
  }
  function week(d0, user, camps) {
    const start = u.addDays(d0, -((u.dow(d0) + 6) % 7)), H0 = 7, H1 = 21, PX = 44;
    let h = `<div class="week"><div class="wh"></div>${Array.from({ length: 7 }, (_, i) => { const d = u.addDays(start, i); return `<div class="wh ${d === TODAY ? 'today' : ''}">${u.DOWS[u.dow(d)]} ${u.fmtDateShort(d)} ${S.isClient(user) ? '' : dayLoadHtml(d)}</div>`; }).join('')}`;
    h += `<div>${Array.from({ length: H1 - H0 }, (_, i) => `<div class="hr">${H0 + i}h</div>`).join('')}</div>`;
    for (let i = 0; i < 7; i++) {
      const d = u.addDays(start, i), items = camps.filter(c => S.dateOf(c) === d).sort((a, b) => S.hourOf(a) - S.hourOf(b));
      const cols = [];
      const pos = items.map(c => { const top = (S.hourOf(c) - H0) * PX, hh = Math.max(40, S.duration(c.parts[0], c) * PX); let k = 0; while (cols[k] != null && cols[k] > top) k++; cols[k] = top + hh; return { c, top, hh, k }; });
      const nk = Math.max(1, cols.length);
      h += `<div class="wc" data-day="${d}">${Array.from({ length: H1 - H0 }, () => '<div class="slot"></div>').join('')}${pos.map(p => { const st = S.status(p.c);
        return `<div class="wev" data-id="${p.c.id}" data-href="#/campagne/${p.c.id}" ${!S.isClient(user) && S.PRE.includes(st) ? 'draggable="true"' : ''} style="top:${p.top}px;height:${p.hh - 3}px;left:calc(${(p.k / nk) * 100}% + 3px);width:calc(${100 / nk}% - 6px);background:${R.channel(p.c.channel).color};${['terminee', 'annulee'].includes(st) ? 'opacity:.5' : ''}" title="${u.esc(p.c.name + ' · ' + R.status(st).label)}"><b>${W.H2(S.hourOf(p.c))} ${u.esc(R.client(p.c.client).name)}</b>${u.esc(p.c.name)}<br>${fmtVol(p.c.volume)} · ${u.esc(R.status(st).label)}</div>`; }).join('')}</div>`;
    }
    return h + '</div>';
  }
  function listView(camps) {
    const rows = camps.filter(c => S.dateOf(c) >= u.addDays(TODAY, -7)).sort((a, b) => S.dateOf(a).localeCompare(S.dateOf(b)) || S.hourOf(a) - S.hourOf(b));
    return UI.table({
      title: 'Planning des campagnes', columns: ['Date', 'Heure', 'Client', 'Campagne', 'Canal', { label: 'Volume', align: 'r' }, 'Statut', 'Chargé'],
      rows, rowAttr: c => `data-href="#/campagne/${c.id}"`,
      render: c => [u.DOWS[u.dow(S.dateOf(c))].slice(0, 3) + '. ' + u.fmtDate(S.dateOf(c)), W.H2(S.hourOf(c)), UI.clientDot(c.client) + u.esc(R.client(c.client).name), `<b>${u.esc(c.name)}</b><span class="sub mono">${c.id}</span>`, UI.chBadge(c.channel), u.n(c.volume), UI.statusBadge(c), u.esc(R.user(c.cdc).name)],
      raw: c => [S.dateOf(c), W.H2(S.hourOf(c)), R.client(c.client).name, c.name, R.channel(c.channel).label, c.volume, R.status(S.status(c)).label, R.user(c.cdc).name]
    });
  }

  function render(el, arg, user) {
    const [mode0, p] = (arg || '').split('/');
    const mode = mode0 || 'mois';
    const camps = S.filteredCamps();
    const ym = mode === 'mois' && p ? p : TODAY.slice(0, 7), wd = mode === 'semaine' && p ? p : TODAY;
    const prevNext = mode === 'mois' ? [u.addMonths(ym + '-01', -1).slice(0, 7), u.addMonths(ym + '-01', 1).slice(0, 7)] : [u.addDays(wd, -7), u.addDays(wd, 7)];
    const label = mode === 'mois' ? u.fmtMonth(ym + '-01') : mode === 'semaine' ? 'Semaine du ' + u.fmtDate(u.addDays(wd, -((u.dow(wd) + 6) % 7))) : 'Liste — 7 derniers jours et à venir';
    const legend = `<div class="legend-st">${['brouillon', 'bat', 'a_valider', 'validee', 'programmee', 'en_cours', 'terminee'].map(k => `<span><i style="background:${STC[k]}"></i>${R.STATUS[k].label}</span>`).join('')}</div>`;
    const hz = camps.filter(c => S.dateOf(c) > TODAY && S.dateOf(c) <= C.HORIZON && S.status(c) !== 'annulee').sort((a, b) => S.dateOf(a).localeCompare(S.dateOf(b)));
    const over = []; for (let d = TODAY; d <= C.HORIZON; d = u.addDays(d, 1)) if (S.dayLoad(d) > C.CAPACITY_DAY) over.push(d);
    const isC = S.isClient(user);
    const tbl = mode === 'liste' ? listView(camps) : null;
    const body = tbl ? tbl.html : mode === 'semaine' ? week(wd, user, camps) : month(ym, user, camps);
    el.innerHTML = `
      <div class="grid g4">
        ${UI.kpi({ label: 'Campagnes à venir (6 semaines)', value: u.n(hz.length), sub: u.n(u.sum(hz, c => c.volume)) + ' messages programmés ou en préparation' })}
        ${UI.kpi({ label: 'En préparation', value: u.n(hz.filter(c => ['brouillon', 'bat', 'bat_ok', 'a_valider'].includes(S.status(c))).length), sub: 'brouillon, BAT ou validation en attente' })}
        ${UI.kpi({ label: 'Validées / programmées', value: u.n(hz.filter(c => ['validee', 'programmee'].includes(S.status(c))).length), sub: 'prêtes à partir' })}
        ${isC ? UI.kpi({ label: 'Prochain envoi', value: hz[0] ? u.fmtDateShort(S.dateOf(hz[0])) : '—', sub: hz[0] ? u.esc(hz[0].name) : '' }) : UI.kpi({ label: 'Jours en surcharge du routage', value: String(over.length), cls: over.length ? 'warn' : '', sub: over.length ? over.map(d => u.fmtDateShort(d)).join(', ') + ' · capacité ' + u.dec(C.CAPACITY_DAY / 1e6, 1) + ' M / jour' : 'capacité ' + u.dec(C.CAPACITY_DAY / 1e6, 1) + ' M messages / jour' })}
      </div>
      ${over.length && !isC ? `<div class="alert warn">${UI.icon('alert')}<div><b>Surcharge du routage prévue le ${over.map(d => u.DOWS[u.dow(d)].toLowerCase() + ' ' + u.fmtDate(d)).join(', ')}</b> — le volume total programmé dépasse la capacité paramétrée. Glissez une campagne non lancée vers un autre jour pour lisser la charge.</div></div>` : ''}
      <div class="card"><div class="card-h"><div class="cal-tools">
          <div class="seg">${['mois', 'semaine', 'liste'].map(m => `<button data-mode="${m}" class="${m === mode ? 'on' : ''}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}</div>
          ${mode !== 'liste' ? `<button class="btn sm" data-nav="${prevNext[0]}">‹</button><button class="btn sm" data-nav="today">Aujourd'hui</button><button class="btn sm" data-nav="${prevNext[1]}">›</button>` : ''}
          <h3 style="margin-left:6px">${label}</h3></div>${tbl ? tbl.tools : legend}</div>
        <div class="card-b">${body}</div>
        <div class="card-f">${isC ? 'Vos campagnes uniquement · lecture seule' : 'En haut à droite de chaque jour : volume total routé ce jour-là, tous clients (charge du routage). Glissez une campagne non lancée pour la replanifier : fenêtres d\'envoi, surcharge et pression marketing sont contrôlées. Fenêtres SMS : ' + UI.legal()}</div></div>`;
    el.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { location.hash = '#/planning/' + b.dataset.mode; });
    el.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => { location.hash = '#/planning/' + mode + (b.dataset.nav === 'today' ? '' : '/' + b.dataset.nav); });
    el.querySelectorAll('[data-more]').forEach(b => b.onclick = e => { e.stopPropagation(); location.hash = '#/planning/semaine/' + b.dataset.more; });
    if (!isC) bindDrag(el, user);
  }

  function bindDrag(el, user) {
    let dragId = null;
    el.querySelectorAll('[draggable="true"]').forEach(x => x.addEventListener('dragstart', e => { dragId = x.dataset.id; e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; }));
    el.querySelectorAll('[data-day]').forEach(d => {
      d.addEventListener('dragover', e => { if (dragId) { e.preventDefault(); d.classList.add('drop'); } });
      d.addEventListener('dragleave', () => d.classList.remove('drop'));
      d.addEventListener('drop', e => { e.preventDefault(); d.classList.remove('drop'); const c = LD.data.camps.find(x => x.id === dragId); dragId = null; if (c) replan(c, d.dataset.day, user); });
    });
  }
  function replan(c, day, user) {
    if (day === S.dateOf(c)) return;
    if (UI.result(W.replan(c, user, day))) LD.app.renderView();
  }
  LD.planning = { replan };

  LD.views.planning = { title: 'Planning', client: true, filters: { show: ['client', 'channel', 'cdc', 'status', 'type'], noExport: true }, render };
})(window.LD);
