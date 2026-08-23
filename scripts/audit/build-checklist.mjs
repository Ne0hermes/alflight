// scripts/audit/build-checklist.mjs
// ============================================================================
// GÉNÉRATEUR de la check-list de correction (artifact pilote).
// ----------------------------------------------------------------------------
// Entrée  : audit-<DATE>.json — tableau produit par le workflow d'audit
//           (un objet par avion : registration, model, generation, capacites,
//           resume, items[]).
// Sortie  : checklist.html — la page publiée en artifact.
//
// La page est reconstruite ENTIÈREMENT à partir des données (plus de patch sur
// un HTML figé : le générateur d'origine avait été perdu, la page était
// rapiécée). Mise en forme et comportements repris à l'identique :
// filtres par gravité, masquage des faits, progression, cases + commentaires
// persistés dans le navigateur, « Copier le rapport » par avion, masquage d'un
// avion terminé, tout déplier.
//
// Usage : node build-checklist.mjs audit-23-08.json "23 août 2026"
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';

const here = (f) => path.join(import.meta.dirname, f);
const [, , auditFile = 'audit-23-08.json', dateLabel = new Date().toISOString().slice(0, 10)] = process.argv;

const avions = JSON.parse(fs.readFileSync(here(auditFile), 'utf8')).filter(Boolean);

// ── Gabarits repris de la page actuelle (style + script) ────────────────────
const source = fs.readFileSync(here('checklist-source.html'), 'utf8');
const style = source.match(/<style>[\s\S]*?<\/style>/)[0];
const script = source
  .match(/<script>[\s\S]*?<\/script>/)[0]
  .replace(/check-list du \d{2}\/\d{2}\/\d{4}/g, `check-list du ${dateLabel}`)
  // Retour pilote 23/08 : « il a toujours marqué 81 problèmes et non plus 200 ».
  // Le filtre « Mineurs » est désactivé par défaut : le compteur ne portait que
  // sur les lignes AFFICHÉES, sans dire que d'autres étaient masquées. On le dit.
  .replace(
    "document.getElementById('prog').textContent=tot?fait+' / '+tot+' corrigés':'';",
    "const masques=document.querySelectorAll('.it').length-tot;"
    + "document.getElementById('prog').textContent="
    + "(tot?fait+' / '+tot+' corrigés':'')"
    + "+(masques?' · '+masques+' masqués par le filtre':'');"
  );

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

const SEV_ORDER = { critique: 0, majeur: 1, mineur: 2 };
const CAP_LABEL = { centrage: 'Centrage', decollage: 'Décollage', atterrissage: 'Atterrissage', carburant: 'Carburant' };
const CAP_CLASS = { oui: 'oui', partiel: 'partiel', non: 'non' };

let seq = 0;
const uid = () => `i${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ── Rendu d'un constat ──────────────────────────────────────────────────────
function renderItem(reg, item, n) {
  const itid = `${reg}-${String(n).padStart(2, '0')}`;
  const sev = item.gravite;
  const classePill = item.classe === 'a-confirmer'
    ? '<span class="pill a-manuel">À confirmer au manuel</span>'
    : '<span class="pill a-bloque">Erreur démontrée</span>';
  return `<div class="it ${sev}" data-sev="${sev}" data-id="${uid()}" data-itid="${itid}" data-champ="${esc(item.champ)}" data-sevlbl="${sev}">
<input type="checkbox" aria-label="Corrigé">
<div class="body">
<div class="tags"><span class="itid">${itid}</span><span class="pill p-${sev}">${sev}</span>${classePill}
<span class="cap">${esc(item.categorie)}</span><span class="path">${esc(item.champ)}</span></div>
<dl class="kv">
<dt>Trouvé</dt><dd class="val">${esc(item.trouve)}</dd>
<dt>Attendu</dt><dd>${esc(item.attendu)}</dd>
<dt>En vol</dt><dd>${esc(item.enVol)}</dd>
<dt>Action</dt><dd>${esc(item.action)}</dd><dt>Preuve</dt><dd style="font-style:italic;color:var(--ink-3)">${esc(item.demontrePar)}</dd>
</dl><textarea class="note" rows="1" placeholder="Votre correctif ou commentaire (${itid}) — repris dans le rapport à copier"></textarea></div></div>`;
}

// ── Rendu d'un avion ────────────────────────────────────────────────────────
function renderAvion(a) {
  const items = [...(a.items || [])].sort(
    (x, y) => (SEV_ORDER[x.gravite] ?? 3) - (SEV_ORDER[y.gravite] ?? 3)
  );
  const nb = (s) => items.filter(i => i.gravite === s).length;
  const pills = ['critique', 'majeur', 'mineur']
    .filter(s => nb(s) > 0)
    .map(s => `<span class="pill p-${s}">${nb(s)} ${s}${nb(s) > 1 ? 's' : ''}</span>`)
    .join('\n');
  const caps = Object.entries(a.capacites || {})
    .map(([k, v]) => `<span class="cap ${CAP_CLASS[v] || ''}">${CAP_LABEL[k] || k} : ${v}</span>`)
    .join('');

  return `<details class="av" open>
<summary><span class="reg">${esc(a.registration)}</span><span class="mdl">${esc(a.model)}</span><span class="spacer"></span>
${pills}
<span class="cap count"></span><button class="rapport" data-reg="${esc(a.registration)}" title="Copie tous vos commentaires et l’état des cases de cet avion, pour me les coller dans la conversation">Copier le rapport</button><button class="hideav" data-reg="${esc(a.registration)}" title="Masquer cet avion de la liste (il reste récupérable via « Avions masqués »)">Masquer</button></summary>
<div class="gen"><b>${esc(a.generation)}</b> — ${esc(a.resume)}</div>
<div class="caps">${caps}</div>
${items.length
    ? items.map((it, i) => renderItem(a.registration, it, i + 1)).join('\n')
    : '<div class="it mineur" data-sev="mineur" data-id="' + uid() + '" data-itid="' + a.registration + '-00" data-champ="—" data-sevlbl="mineur"><input type="checkbox" aria-label="Corrigé"><div class="body"><div class="tags"><span class="pill p-mineur">rien à signaler</span></div><dl class="kv"><dt>Trouvé</dt><dd>Aucun défaut démontrable sur cette fiche à la date de l’audit.</dd></dl></div></div>'}
</details>`;
}

// ── Compteurs globaux ───────────────────────────────────────────────────────
const all = avions.flatMap(a => a.items || []);
const n = (s) => all.filter(i => i.gravite === s).length;
const nConf = all.filter(i => i.classe === 'a-confirmer').length;

const html = `
<title>Check-list de correction — base avions ALFlight</title>
${style}

<div class="wrap">
<header class="top">
  <div class="eyebrow">ALFlight · check-list de correction</div>
  <h1>${avions.length} avions — dernier passage sur l’intégrité des données</h1>
  <p class="lede">Audit intégral refait le ${dateLabel} sur l’extraction réelle de la base : chaque ligne est un point
  encore à revoir aujourd’hui, avec la valeur trouvée, ce qui est attendu, ce que cela change en vol et la preuve.
  Cochez au fur et à mesure — cases et commentaires sont enregistrés dans ce navigateur.</p>
  <p class="lede" style="margin-top:10px"><b>${all.length} points au total</b> : <b>${n('critique')} critiques</b>, ${n('majeur')} majeurs et ${n('mineur')} mineurs.
  À l'ouverture, seuls les <b>${n('critique') + n('majeur')} critiques et majeurs</b> sont affichés — le bouton « Mineurs » de la barre révèle les ${n('mineur')} autres
  — dont ${nConf} « à confirmer au manuel » (aucune erreur démontrée, mais une valeur que seul le manuel de vol tranche).
  Les points corrigés depuis les audits précédents ne figurent plus : cette page ne montre que ce qui reste.</p>
  <p class="lede" style="margin-top:10px">Méthode : uniquement des contradictions internes à la fiche, des défauts
  prouvés en rejouant le moteur de préparation de vol sur vos abaques, ou des champs obligatoires vides. Aucune valeur
  n’est jugée « improbable » de mémoire.</p>
</header>

${fs.readFileSync(here('tpl-bar.html'), 'utf8')}

${avions.map(renderAvion).join('\n')}

<footer>Audit en lecture seule de la table <span class="path">community_presets</span> — extraction du ${dateLabel},
moteur rejoué sur chaque modèle d’abaque (5 jeux de conditions). Les valeurs « attendues » d’un point marqué
« à confirmer » sont à vérifier au manuel de vol de l’appareil : aucune n’a été lue dans un document constructeur.</footer>
</div>

${script}
`;

fs.writeFileSync(here('checklist.html'), html, 'utf8');
console.log(
  `checklist.html régénérée : ${avions.length} avions, ${all.length} points ` +
  `(${n('critique')} critiques / ${n('majeur')} majeurs / ${n('mineur')} mineurs, ${nConf} à confirmer) — ${Math.round(html.length / 1024)} ko`
);
