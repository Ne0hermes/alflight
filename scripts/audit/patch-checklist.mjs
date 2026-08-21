// Applique retours.json à la source de l'artifact check-list (sans le générateur d'origine, perdu le 21/08).
// status fait|valide|code|obsolete → item coché + classe regle + note ✓ ; status note → note ✎ seule.
import fs from 'node:fs';
const src = fs.readFileSync(new URL('./checklist-source.html', import.meta.url), 'utf8');
const retours = JSON.parse(fs.readFileSync(new URL('./retours.json', import.meta.url), 'utf8'));
let html = src, applied = 0, missing = [];
for (const r of retours) {
  const marker = `data-itid="${r.itid}"`;
  const i = html.indexOf(marker);
  if (i < 0) { missing.push(r.itid); continue; }
  const start = html.lastIndexOf('<div class="it ', i);
  const end = html.indexOf('</textarea></div></div>', i) + '</textarea></div></div>'.length;
  let block = html.slice(start, end);
  const settled = ['fait', 'valide', 'code', 'obsolete'].includes(r.status);
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // retire une note précédente du même type pour rester idempotent
  block = block.replace(/<div class="notefait">(✓|✎)[\s\S]*?<\/div>(?=<textarea)/, '');
  if (settled) {
    block = block.replace(/^<div class="it ([^"]*?)"/, (m, cls) => `<div class="it ${cls.includes('regle') ? cls : cls + ' regle'}"`);
    block = block.replace(/<input type="checkbox" aria-label="Corrigé"(?! checked)>/, '<input type="checkbox" aria-label="Corrigé" checked>');
  }
  block = block.replace(/<textarea class="note"/, `<div class="notefait">${settled ? '✓' : '✎'} ${esc(r.note)}</div><textarea class="note"`);
  html = html.slice(0, start) + block + html.slice(end);
  applied++;
}
fs.writeFileSync(new URL('./checklist.html', import.meta.url), html);
console.log(`appliqués : ${applied} / ${retours.length}${missing.length ? ' | introuvables : ' + missing.join(', ') : ''} → checklist.html (${Math.round(html.length / 1024)} ko)`);
