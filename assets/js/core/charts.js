/* charts.js : graphiques SVG maison (aucune librairie externe).
 * line(), bars(), hbars(), donut(), heatmap(), gauge(), spark()
 * Chaque fonction renvoie une chaîne SVG/HTML à insérer dans le DOM.
 */
window.LD = window.LD || {};

(function (LD) {
  'use strict';
  const u = LD.u;
  const PALETTE = ['#233F93', '#00ADDA', '#2BB6A3', '#F59E0B', '#8B5CF6', '#E5484D', '#0E4CA1', '#65CBE3', '#64748B', '#D946EF'];

  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
    const n = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
    return n * p;
  }
  function fmtAxis(v, isPct) {
    if (isPct) return u.dec(v * 100, 1).replace(',0', '') + ' %';
    if (v >= 1000000) return u.dec(v / 1000000, 1) + ' M';
    if (v >= 10000) return u.n(v / 1000) + ' k';
    return u.n(v);
  }

  /* line({ labels, series:[{name,data,color,area,dash}], height, pct, stacked, refLine:{value,label} }) */
  function line(o) {
    const W = o.width || 900, H = o.height || 260, ml = 56, mr = 16, mt = 16, mb = 30;
    const iw = W - ml - mr, ih = H - mt - mb, n = o.labels.length;
    let max = 0;
    if (o.stacked) { for (let i = 0; i < n; i++) { let s = 0; o.series.forEach(se => s += se.data[i] || 0); max = Math.max(max, s); } }
    else o.series.forEach(s => s.data.forEach(v => { if (v != null) max = Math.max(max, v); }));
    if (o.refLine) max = Math.max(max, o.refLine.value);
    max = o.max || niceMax(max * 1.05);
    const min = o.min || 0;
    const x = i => ml + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
    const y = v => mt + ih - ((Math.max(v, min) - min) / (max - min)) * ih;
    let g = '';
    for (let t = 0; t <= 4; t++) {
      const v = min + ((max - min) * t) / 4, yy = y(v);
      g += `<line x1="${ml}" x2="${W - mr}" y1="${yy}" y2="${yy}" class="grid"/><text x="${ml - 8}" y="${yy + 4}" class="axis" text-anchor="end">${fmtAxis(v, o.pct)}</text>`;
    }
    const step = Math.max(1, Math.ceil(n / (o.maxTicks || 12)));
    o.labels.forEach((l, i) => { if (i % step === 0 || i === n - 1) g += `<text x="${x(i)}" y="${H - 8}" class="axis" text-anchor="middle">${u.esc(l)}</text>`; });
    const base = new Array(n).fill(0);
    o.series.forEach((s, si) => {
      const col = s.color || PALETTE[si % PALETTE.length];
      const pts = s.data.map((v, i) => { const val = (v || 0) + (o.stacked ? base[i] : 0); return [x(i), y(val), v]; });
      const path = pts.filter(p => p[2] != null).map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
      if (s.area || o.stacked) {
        const bottom = o.stacked ? base.map((b, i) => [x(i), y(b)]).reverse() : [[x(n - 1), y(min)], [x(0), y(min)]];
        const area = path + ' ' + bottom.map(p => 'L' + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + ' Z';
        g += `<path d="${area}" fill="${col}" opacity="${o.stacked ? 0.55 : 0.12}"/>`;
      }
      g += `<path d="${path}" fill="none" stroke="${col}" stroke-width="${s.width || 2.2}" ${s.dash ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round"/>`;
      if (o.stacked) s.data.forEach((v, i) => base[i] += v || 0);
      if (o.dots && n < 40) pts.forEach(p => { if (p[2] != null) g += `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${col}"/>`; });
    });
    if (o.refLine) {
      const yy = y(o.refLine.value);
      g += `<line x1="${ml}" x2="${W - mr}" y1="${yy}" y2="${yy}" stroke="#E5484D" stroke-width="1.5" stroke-dasharray="6 4"/><text x="${W - mr - 4}" y="${yy - 6}" class="axis ref" text-anchor="end">${u.esc(o.refLine.label)}</text>`;
    }
    g += partialMark(o, n, x(n - 1), mt, ih, W);
    // zones de survol (infobulles)
    if (o.tooltip !== false) {
      const bw = iw / Math.max(1, n - 1);
      o.labels.forEach((l, i) => {
        const tip = o.series.map(s => s.name + ' : ' + (s.data[i] == null ? '—' : o.pct ? u.pct(s.data[i]) : u.n(s.data[i]))).join('\n');
        g += `<rect x="${x(i) - bw / 2}" y="${mt}" width="${bw}" height="${ih}" fill="transparent"><title>${u.esc(l + '\n' + tip)}</title></rect>`;
      });
    }
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px">${g}</svg>` + legend(o.series);
  }

  // Journée en cours (partielle) : repère vertical + mention, pour ne pas lire la baisse comme une chute
  function partialMark(o, n, xx, mt, ih) {
    if (o.noPartial || !n || n < 3 || o.labels[n - 1] !== u.fmtDateShort(LD.TODAY)) return '';
    return `<line x1="${xx}" x2="${xx}" y1="${mt}" y2="${mt + ih}" stroke="#94A3B8" stroke-dasharray="3 3"/><text x="${xx - 6}" y="${mt + 10}" class="axis" text-anchor="end">aujourd'hui · en cours</text>`;
  }

  function legend(series) {
    if (!series || series.length < 2) return '';
    return '<div class="legend">' + series.map((s, i) => `<span><i style="background:${s.color || PALETTE[i % PALETTE.length]}"></i>${u.esc(s.name)}</span>`).join('') + '</div>';
  }

  /* bars({ labels, series:[{name,data,color}], stacked, height, pct }) — barres verticales */
  function bars(o) {
    const W = o.width || 900, H = o.height || 240, ml = 56, mr = 12, mt = 14, mb = 30;
    const iw = W - ml - mr, ih = H - mt - mb, n = o.labels.length;
    let max = 0;
    for (let i = 0; i < n; i++) { let s = 0; o.series.forEach(se => { s = o.stacked ? s + (se.data[i] || 0) : Math.max(s, se.data[i] || 0); }); max = Math.max(max, s); }
    if (o.refLine) max = Math.max(max, o.refLine.value);
    max = o.max || niceMax(max * 1.05);
    const min = o.min || 0;
    const y = v => mt + ih - ((Math.max(v, min) - min) / (max - min)) * ih;
    const slot = iw / n, ns = o.stacked ? 1 : o.series.length, bw = Math.min(46, (slot * 0.72) / ns);
    let g = '';
    for (let t = 0; t <= 4; t++) { const v = min + ((max - min) * t) / 4, yy = y(v); g += `<line x1="${ml}" x2="${W - mr}" y1="${yy}" y2="${yy}" class="grid"/><text x="${ml - 8}" y="${yy + 4}" class="axis" text-anchor="end">${fmtAxis(v, o.pct)}</text>`; }
    const step = Math.max(1, Math.ceil(n / (o.maxTicks || 14)));
    o.labels.forEach((l, i) => {
      const cx = ml + slot * i + slot / 2;
      if (i % step === 0) g += `<text x="${cx}" y="${H - 8}" class="axis" text-anchor="middle">${u.esc(l)}</text>`;
      let acc = 0;
      o.series.forEach((s, si) => {
        const v = s.data[i] || 0, col = s.color || PALETTE[si % PALETTE.length];
        const bx = o.stacked ? cx - bw / 2 : cx - (bw * ns) / 2 + si * bw;
        const y0 = y(acc + (o.stacked ? v : 0)), hh = o.stacked ? (v / (max - min)) * ih : ((Math.max(v, min) - min) / (max - min)) * ih;
        g += `<rect x="${bx.toFixed(1)}" y="${(o.stacked ? y0 : y(v)).toFixed(1)}" width="${(bw - (o.stacked ? 0 : 2)).toFixed(1)}" height="${Math.max(0, hh).toFixed(1)}" rx="2" fill="${col}"><title>${u.esc(l + ' — ' + s.name + ' : ' + (o.pct ? u.pct(v) : u.n(v)))}</title></rect>`;
        if (o.stacked) acc += v;
      });
      if (o.values && !o.stacked) g += `<text x="${cx}" y="${y(o.series[0].data[i]) - 5}" class="axis val" text-anchor="middle">${o.pct ? u.pct(o.series[0].data[i]) : u.n(o.series[0].data[i])}</text>`;
    });
    if (o.refLine) { const yy = y(o.refLine.value); g += `<line x1="${ml}" x2="${W - mr}" y1="${yy}" y2="${yy}" stroke="#E5484D" stroke-width="1.5" stroke-dasharray="6 4"/><text x="${W - mr - 4}" y="${yy - 6}" class="axis ref" text-anchor="end">${u.esc(o.refLine.label)}</text>`; }
    g += partialMark(o, n, ml + slot * (n - 1) + slot / 2 - bw, mt, ih);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px">${g}</svg>` + legend(o.series);
  }

  /* hbars([{label, value, color, sub}], {max, pct, target}) — barres horizontales en HTML */
  function hbars(items, o) {
    o = o || {};
    const max = o.max || Math.max(1e-9, ...items.map(i => i.value));
    return '<div class="hbars">' + items.map((it, i) => {
      const w = Math.max(0.5, Math.min(100, (it.value / max) * 100));
      return `<div class="hbar"><div class="hbar-l" title="${u.esc(it.label)}">${u.esc(it.label)}</div><div class="hbar-t"><div class="hbar-f" style="width:${w}%;background:${it.color || PALETTE[i % PALETTE.length]}"></div>${o.target ? `<div class="hbar-tg" style="left:${Math.min(100, (o.target / max) * 100)}%"></div>` : ''}</div><div class="hbar-v">${o.pct ? u.pct(it.value) : u.n(it.value)}${it.sub ? `<small>${u.esc(it.sub)}</small>` : ''}</div></div>`;
    }).join('') + '</div>';
  }

  /* donut([{label, value, color}], {size, center, centerSub}) */
  function donut(items, o) {
    o = o || {};
    const S = o.size || 170, r = S / 2 - 12, c = S / 2, circ = 2 * Math.PI * r, total = u.sum(items, i => i.value) || 1;
    let off = 0, g = `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#EEF2F7" stroke-width="22"/>`;
    items.forEach((it, i) => {
      const len = (it.value / total) * circ;
      g += `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${it.color || PALETTE[i % PALETTE.length]}" stroke-width="22" stroke-dasharray="${len} ${circ - len}" stroke-dashoffset="${-off}" transform="rotate(-90 ${c} ${c})"><title>${u.esc(it.label + ' : ' + u.n(it.value) + ' (' + u.pct(it.value / total) + ')')}</title></circle>`;
      off += len;
    });
    g += `<text x="${c}" y="${c + 2}" text-anchor="middle" class="donut-c">${u.esc(o.center || u.n(total))}</text>`;
    if (o.centerSub) g += `<text x="${c}" y="${c + 20}" text-anchor="middle" class="donut-s">${u.esc(o.centerSub)}</text>`;
    const leg = '<div class="donut-leg">' + items.map((it, i) => `<div><i style="background:${it.color || PALETTE[i % PALETTE.length]}"></i><span>${u.esc(it.label)}</span><b>${u.n(it.value)}</b><em>${u.pct(it.value / total)}</em></div>`).join('') + '</div>';
    return `<div class="donut"><svg viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">${g}</svg>${leg}</div>`;
  }

  /* heatmap(matrix[7][24], {rows, cols}) — HTML grid */
  function heatmap(m, o) {
    o = o || {};
    const rows = o.rows || ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    let max = 0; m.forEach(r => r.forEach(v => max = Math.max(max, v)));
    let h = '<div class="heat"><div class="heat-row heat-head"><span></span>' + Array.from({ length: 24 }, (_, i) => `<span>${i}h</span>`).join('') + '</div>';
    m.forEach((r, ri) => {
      h += `<div class="heat-row"><span class="heat-l">${rows[ri]}</span>` + r.map((v, ci) => {
        const a = max ? v / max : 0;
        return `<span class="heat-c" style="background:rgba(35,63,147,${(0.05 + a * 0.95).toFixed(3)});color:${a > 0.55 ? '#fff' : '#1C3664'}" title="${rows[ri]} ${ci}h–${ci + 1}h : ${u.n(v)} messages">${v >= 1000 ? u.dec(v / 1000, 1) + 'k' : u.n(v)}</span>`;
      }).join('') + '</div>';
    });
    return h + '</div>';
  }

  /* gauge(value, {max, target, label, pct}) — jauge horizontale */
  function gauge(value, o) {
    o = o || {};
    const max = o.max || 1, w = Math.max(0, Math.min(100, (value / max) * 100));
    const cls = o.cls || (w >= 100 ? 'g-red' : w >= 85 ? 'g-orange' : 'g-blue');
    return `<div class="gauge ${cls}"><div class="gauge-t"><div class="gauge-f" style="width:${w}%"></div>${o.target != null ? `<div class="gauge-m" style="left:${Math.min(100, (o.target / max) * 100)}%"></div>` : ''}</div>${o.label ? `<div class="gauge-l">${o.label}</div>` : ''}</div>`;
  }

  function spark(data, o) {
    o = o || {};
    const W = o.width || 120, H = o.height || 32, n = data.length;
    const max = Math.max(...data, 1), min = Math.min(...data, 0);
    const pts = data.map((v, i) => [(i / Math.max(1, n - 1)) * W, H - 3 - ((v - min) / (max - min || 1)) * (H - 6)]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="none"><path d="${d} L${W},${H} L0,${H} Z" fill="${o.color || '#00ADDA'}" opacity=".12"/><path d="${d}" fill="none" stroke="${o.color || '#00ADDA'}" stroke-width="1.8"/></svg>`;
  }

  // ---- Rendu à la largeur réelle du conteneur (évite la déformation du texte des axes) ----
  const pending = {}; let seq = 0;
  function deferred(fn) {
    return function (o) {
      if (o.width) return fn(o);
      const id = 'ch' + (++seq); pending[id] = { fn, o };
      return `<div class="chartbox" data-chart="${id}" style="min-height:${(o.height || 240)}px"></div>`;
    };
  }
  function mount(root) {
    (root || document).querySelectorAll('.chartbox[data-chart]').forEach(box => {
      const p = pending[box.dataset.chart]; if (!p) return;
      const w = Math.max(280, Math.floor(box.clientWidth || 900));
      box.innerHTML = p.fn(Object.assign({}, p.o, { width: w }));
      box.dataset.w = w;
    });
  }
  let rt = null;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => {
    document.querySelectorAll('.chartbox[data-chart]').forEach(box => { const p = pending[box.dataset.chart]; if (p && Math.abs(box.clientWidth - box.dataset.w) > 4) box.innerHTML = p.fn(Object.assign({}, p.o, { width: box.clientWidth })); });
  }, 150); });
  function clear() { Object.keys(pending).forEach(k => delete pending[k]); }

  LD.charts = { line: deferred(line), bars: deferred(bars), hbars, donut, heatmap, gauge, spark, PALETTE, niceMax, mount, clear };
})(window.LD);
