// Applique les résultats du ré-audit (reaudit-results.json = tableau des sorties d'agents) :
//  - items existants → retours.json (resolu→fait, ouvert/a-confirmer→note, obsolete→obsolete)
//  - constats nouveaux → nouveaux itids (REG-NN suivant) insérés dans checklist-source.html
import fs from 'node:fs';
const here = (f) => new URL('./' + f, import.meta.url);
const results = JSON.parse(fs.readFileSync(here('reaudit-results.json'), 'utf8')).filter(Boolean);
const retours = JSON.parse(fs.readFileSync(here('retours.json'), 'utf8'));
let html = fs.readFileSync(here('checklist-source.html'), 'utf8');
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const closed = new Set(retours.filter(r => ['fait', 'valide', 'code', 'obsolete'].includes(r.status)).map(r => r.itid));
const byId = new Map(retours.map(r => [r.itid, r]));
const D = '21/08 (ré-audit sur extraction réelle 15h52)';
let nbFait = 0, nbOuvert = 0, nbConf = 0, nbObs = 0, nbNew = 0;
const created = [];
for (const res of results) {
  const reg = res.registration;
  for (const it of res.items || []) {
    if (closed.has(it.itid)) continue;
    let entry;
    if (it.statut === 'resolu') { entry = { itid: it.itid, status: 'fait', note: `Ré-audit ${D} : résolu en base — ${it.preuve}` }; nbFait++; }
    else if (it.statut === 'obsolete') { entry = { itid: it.itid, status: 'obsolete', note: `Ré-audit ${D} : sans objet — ${it.preuve}` }; nbObs++; }
    else if (it.statut === 'a-confirmer') { entry = { itid: it.itid, status: 'note', note: `Ré-audit ${D} : à confirmer au manuel — ${it.preuve}` }; nbConf++; }
    else { entry = { itid: it.itid, status: 'note', note: `Ré-audit ${D} : toujours ouvert — ${it.preuve}` }; nbOuvert++; }
    byId.set(it.itid, entry);
  }
  // nouveaux constats → itids suivants
  const existing = [...html.matchAll(new RegExp(`data-itid="${reg}-(\d+)"`, 'g'))].map(m => +m[1]);
  let next = (existing.length ? Math.max(...existing) : 0) + 1;
  const blocks = [];
  for (const n of res.nouveaux || []) {
    const itid = `${reg}-${String(next++).padStart(2, '0')}`;
    const sev = n.gravite;
    const pill = n.classe === 'a-confirmer' ? '<span class="pill a-manuel">À confirmer au manuel</span>' : '<span class="pill a-bloque">Erreur démontrée</span>';
    blocks.push(`<div class="it ${sev}" data-sev="${sev}" data-id="n${Math.random().toString(36).slice(2, 8)}" data-itid="${itid}" data-champ="${esc(n.champ)}" data-sevlbl="${sev}">
<input type="checkbox" aria-label="Corrigé">
<div class="body">
<div class="tags"><span class="itid">${itid}</span><span class="pill p-${sev}">${sev}</span>${pill}
<span class="cap">ré-audit 21/08</span><span class="path">${esc(n.champ)}</span></div>
<dl class="kv">
<dt>Trouvé</dt><dd class="val">${esc(n.trouve)}</dd>
<dt>Attendu</dt><dd>${esc(n.attendu)}</dd>
<dt>En vol</dt><dd>${esc(n.enVol)}</dd>
<dt>Action</dt><dd>${esc(n.action)}</dd><dt>Preuve</dt><dd style="font-style:italic;color:var(--ink-3)">${esc(n.demontrePar)}</dd>
</dl><textarea class="note" rows="1" placeholder="Votre correctif ou commentaire (${itid}) — repris dans le rapport à copier"></textarea></div></div>`);
    created.push({ itid, ...n });
    nbNew++;
  }
  if (blocks.length) {
    // insertion avant le </details> de l'avion concerné
    const start = html.indexOf(`<span class="reg">${reg}</span>`);
    if (start < 0) { console.warn('avion introuvable dans la source :', reg); continue; }
    const end = html.indexOf('</details>', start);
    html = html.slice(0, end) + blocks.join('\n') + html.slice(end);
  }
}
fs.writeFileSync(here('retours.json'), JSON.stringify([...byId.values()], null, 1));
fs.writeFileSync(here('checklist-source.html'), html);
fs.writeFileSync(here('nouveaux-21-08.json'), JSON.stringify(created, null, 1));
console.log(`résolus : ${nbFait} · toujours ouverts : ${nbOuvert} · à confirmer : ${nbConf} · obsolètes : ${nbObs} · NOUVEAUX : ${nbNew}`);
