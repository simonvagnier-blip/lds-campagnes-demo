/* export.js : exports CSV (séparateur ;), Excel (SpreadsheetML, ouvrable par Excel)
 * et PDF (impression navigateur, mise en page dédiée). Fonctionne hors ligne (Blob).
 */
window.LD = window.LD || {};

(function (LD) {
  'use strict';
  const u = LD.u;

  function download(name, mime, content) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function slug(s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase(); }
  function stamp() { const d = LD.now(); return u.iso(d).replace(/-/g, '') + '-' + u.pad(d.getHours()) + u.pad(d.getMinutes()); }

  // table = { title, columns: [..], rows: [[..]], meta: [..lignes de contexte] }
  function csv(table) {
    const esc = v => { const s = v == null ? '' : String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const lines = [];
    (table.meta || []).forEach(m => lines.push(esc(m)));
    if (table.meta && table.meta.length) lines.push('');
    lines.push(table.columns.map(esc).join(';'));
    table.rows.forEach(r => lines.push(r.map(esc).join(';')));
    download(slug(table.title) + '-' + stamp() + '.csv', 'text/csv;charset=utf-8', '\ufeff' + lines.join('\r\n'));
    LD.audit.log('Export CSV — ' + table.title + ' (' + table.rows.length + ' lignes)');
  }
  function excel(table) {
    const x = s => u.esc(s);
    const cell = v => typeof v === 'number' && isFinite(v) ? `<Cell><Data ss:Type="Number">${v}</Data></Cell>` : `<Cell><Data ss:Type="String">${x(v == null ? '' : v)}</Data></Cell>`;
    let rows = '';
    (table.meta || []).forEach(m => rows += `<Row>${cell(m)}</Row>`);
    if (table.meta && table.meta.length) rows += '<Row></Row>';
    rows += '<Row ss:StyleID="h">' + table.columns.map(cell).join('') + '</Row>';
    table.rows.forEach(r => rows += '<Row>' + r.map(cell).join('') + '</Row>');
    const xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="h"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1C3664" ss:Pattern="Solid"/></Style></Styles>
<Worksheet ss:Name="${x(table.title.slice(0, 30).replace(/[\\/?*[\]:]/g, ' '))}"><Table>${rows}</Table></Worksheet></Workbook>`;
    download(slug(table.title) + '-' + stamp() + '.xls', 'application/vnd.ms-excel', xml);
    LD.audit.log('Export Excel — ' + table.title + ' (' + table.rows.length + ' lignes)');
  }
  function pdf(title) {
    LD.audit.log('Export PDF (impression) — ' + (title || document.title));
    document.body.classList.add('printing');
    window.print();
    setTimeout(() => document.body.classList.remove('printing'), 500);
  }

  // Registre des tableaux exportables de la vue courante
  let registry = [];
  function reset() { registry = []; }
  function register(t) { registry.push(t); return registry.length - 1; }
  function get(i) { return registry[i]; }
  function all() { return registry; }

  LD.exporter = { csv, excel, pdf, download, reset, register, get, all, slug, stamp };
})(window.LD);
