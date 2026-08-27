// scripts/audit/build-checklist.mjs
// ============================================================================
// GÉNÉRATEUR de la check-list de correction (artifact pilote) — v3, 25/08/2026.
// ----------------------------------------------------------------------------
// Entrée  : audit-<DATE>.json  (un objet par avion : registration, model,
//           generation, capacites, resume, items[])
//           retours-<DATE>.json (itid → { status, note }) — la SOURCE DE VÉRITÉ
//           des points vérifiés par Claude.
// Sortie  : checklist.html — la page publiée en artifact.
//
// REFONTE v3 (demande pilote : « refais l'artefact complètement ») — l'ancienne
// page persistait cases et commentaires par un identifiant ALÉATOIRE régénéré à
// chaque édition : à chaque republication, le stockage du navigateur ne
// correspondait plus et la page « continuait à marquer l'ancien état ».
// Désormais :
//   • DEUX vérités séparées, qui ne s'écrasent plus :
//       - le statut OFFICIEL (retours.json) : « ✅ vérifié » — badge fixe,
//         non décochable, jamais affecté par le navigateur ;
//       - la coche LOCALE du pilote (« corrigé de mon côté, à vérifier ») :
//         uniquement sur les points encore ouverts.
//   • persistance par ITID (stable d'une édition à l'autre), clés v3 ;
//   • les clés v1 de l'ancienne page sont PURGÉES au chargement ;
//   • bouton « Réinitialiser mes coches » ;
//   • générateur AUTONOME : le script et la barre sont générés ici (le style
//     visuel reste repris de checklist-source.html, inchangé).
//
// Usage : node build-checklist.mjs audit-23-08.json "25 août 2026"
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';

const here = (f) => path.join(import.meta.dirname, f);
const [, , auditFile = 'audit-23-08.json', dateLabel = new Date().toISOString().slice(0, 10)] = process.argv;

const avions = JSON.parse(fs.readFileSync(here(auditFile), 'utf8')).filter(Boolean);

const retoursFile = auditFile.replace(/^audit-/, 'retours-');
const retours = fs.existsSync(here(retoursFile))
  ? Object.fromEntries(JSON.parse(fs.readFileSync(here(retoursFile), 'utf8')).map(r => [r.itid, r]))
  : {};
const CLOS = new Set(['fait', 'valide', 'code', 'obsolete']);

// Style visuel : repris tel quel de la page d'origine (classes .it, .pill, .av…).
const source = fs.readFileSync(here('checklist-source.html'), 'utf8');
const style = source.match(/<style>[\s\S]*?<\/style>/)[0];

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

const SEV_ORDER = { critique: 0, majeur: 1, mineur: 2 };
const CAP_LABEL = { centrage: 'Centrage', decollage: 'Décollage', atterrissage: 'Atterrissage', carburant: 'Carburant' };
const CAP_CLASS = { oui: 'oui', partiel: 'partiel', non: 'non' };

// ── Rendu d'un constat ──────────────────────────────────────────────────────
function renderItem(reg, item, n) {
  const itid = `${reg}-${String(n).padStart(2, '0')}`;
  const sev = item.gravite;
  const classePill = (item.classe === 'a-confirmer'
    ? '<span class="pill a-manuel">À confirmer au manuel</span>'
    : '<span class="pill a-bloque">Erreur démontrée</span>')
    + (item.ajout ? `<span class="pill a-manuel">Nouveau ${String(item.ajout).slice(8, 10)}/${String(item.ajout).slice(5, 7)}</span>` : '');
  const r = retours[itid];
  const clos = r && CLOS.has(r.status);
  const noteHtml = r ? `<div class="notefait">${clos ? '✓' : '✎'} ${esc(r.note)}</div>` : '';
  // Point CLOS : badge fixe, aucune case — l'état officiel ne se coche ni ne se
  // décoche dans un navigateur. Point OUVERT : case locale (persistée par itid).
  const controle = clos
    ? '<span class="verif" title="Vérifié sur pièces — statut officiel, indépendant de ce navigateur">✅</span>'
    : '<input type="checkbox" aria-label="Corrigé de mon côté (sera vérifié)">';
  return `<div class="it ${sev}${clos ? ' regle done' : ''}" data-sev="${sev}" data-itid="${itid}" data-clos="${clos ? '1' : '0'}" data-champ="${esc(item.champ)}" data-sevlbl="${sev}">
${controle}
<div class="body">
<div class="tags"><span class="itid">${itid}</span><span class="pill p-${sev}">${sev}</span>${classePill}
<span class="cap">${esc(item.categorie)}</span><span class="path">${esc(item.champ)}</span></div>
<dl class="kv">
<dt>Trouvé</dt><dd class="val">${esc(item.trouve)}</dd>
<dt>Attendu</dt><dd>${esc(item.attendu)}</dd>
<dt>En vol</dt><dd>${esc(item.enVol)}</dd>
<dt>Action</dt><dd>${esc(item.action)}</dd><dt>Preuve</dt><dd style="font-style:italic;color:var(--ink-3)">${esc(item.demontrePar)}</dd>
</dl>${noteHtml}${clos ? '' : `<textarea class="note" rows="1" placeholder="Votre correctif ou commentaire (${itid}) — repris dans le rapport à copier"></textarea>`}</div></div>`;
}

// ── Rendu d'un avion ────────────────────────────────────────────────────────
function renderAvion(a) {
  // ⚠️ NUMÉROTATION HISTORIQUE : tri par gravité PUIS numérotation — c'est
  // ainsi que les itids ont été assignés à l'origine, et ils sont FIGÉS
  // (tous les rapports du pilote les référencent). Ne jamais changer.
  // Les items AJOUTÉS après coup (flag `ajout`, ex. passe finale du 26/08)
  // sont numérotés APRÈS tous les items historiques — jamais intercalés,
  // sinon la numérotation figée casserait.
  const anciens = (a.items || []).filter((it) => !it.ajout);
  const ajouts = (a.items || []).filter((it) => it.ajout);
  const tri = (x, y) => (SEV_ORDER[x.gravite] ?? 3) - (SEV_ORDER[y.gravite] ?? 3);
  const tous = [...[...anciens].sort(tri), ...[...ajouts].sort(tri)]
    .map((it, i) => ({ it, n: i + 1 }));
  // ✂️ ÉDITION CONSOLIDÉE (demande pilote 25/08) : les points réglés ET
  // vérifiés en base sont RETIRÉS de la page — elle ne montre que ce qui
  // reste à faire. Les points annotés mais ouverts (✎/partiel) restent.
  const estClos = ({ n }) => {
    const r = retours[`${a.registration}-${String(n).padStart(2, '0')}`];
    return r && CLOS.has(r.status);
  };
  const retires = tous.filter(estClos).length;
  const items = tous.filter((x) => !estClos(x));
  const nb = (s) => items.filter(({ it }) => it.gravite === s).length;
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
<span class="cap count"></span><button class="rapport" data-reg="${esc(a.registration)}" title="Copie vos coches et commentaires de cet avion, à me coller dans la conversation">Copier le rapport</button><button class="hideav" data-reg="${esc(a.registration)}" title="Masquer cet avion de la liste (récupérable via « Avions masqués »)">Masquer</button></summary>
<div class="gen"><b>${esc(a.generation)}</b> — ${esc(a.resume)}</div>
<div class="caps">${caps}</div>
${retires ? `<div class="gen">✂️ ${retires} point${retires > 1 ? 's' : ''} réglé${retires > 1 ? 's' : ''} et vérifié${retires > 1 ? 's' : ''} en base — retiré${retires > 1 ? 's' : ''} de cette édition.</div>` : ''}
${items.length
    ? items.map(({ it, n }) => renderItem(a.registration, it, n)).join('\n')
    : '<div class="it mineur regle done" data-sev="mineur" data-itid="' + esc(a.registration) + '-00" data-clos="1" data-champ="—" data-sevlbl="mineur"><span class="verif">✅</span><div class="body"><div class="tags"><span class="pill p-mineur">tout est réglé</span></div><dl class="kv"><dt>État</dt><dd>Plus aucun point ouvert sur cette fiche — chaque correction a été vérifiée sur l’extraction de la base.</dd></dl></div></div>'}
</details>`;
}

// ── Compteurs globaux (depuis la SOURCE DE VÉRITÉ, pas le navigateur) ──────
// Même numérotation historique (tri par gravité puis rang) pour les compteurs.
const all = avions.flatMap((a) => [...(a.items || [])]
  .sort((x, y) => (SEV_ORDER[x.gravite] ?? 3) - (SEV_ORDER[y.gravite] ?? 3))
  .map((it, i) => ({ it, itid: `${a.registration}-${String(i + 1).padStart(2, '0')}` })));
const n = (s) => all.filter(({ it }) => it.gravite === s).length;
const nConf = all.filter(({ it }) => it.classe === 'a-confirmer').length;
const nClos = all.filter(({ itid }) => retours[itid] && CLOS.has(retours[itid].status)).length;
const nOuverts = all.length - nClos;
// Compteurs sur les points RESTANTS (les clos sont retirés de la page).
const ouverts = all.filter(({ itid }) => !(retours[itid] && CLOS.has(retours[itid].status)));
const nOuvertsSev = (s) => ouverts.filter(({ it }) => it.gravite === s).length;
const nConfOuverts = ouverts.filter(({ it }) => it.classe === 'a-confirmer').length;

const barre = `<div class="bar" role="group" aria-label="Filtres">
  <button class="f" data-sev="critique" aria-pressed="true">Critiques</button>
  <button class="f" data-sev="majeur" aria-pressed="true">Majeurs</button>
  <button class="f" data-sev="mineur" aria-pressed="false">Mineurs</button>
  <button class="f" id="hideDone" aria-pressed="false">Masquer les réglés</button>
  <span class="spacer"></span>
  <span class="prog" id="prog"></span>
  <button class="f" id="toggleAll" aria-pressed="false">Tout déplier</button>
  <button class="f" id="showHidden" aria-pressed="false" style="display:none">Avions masqués : 0</button>
  <button class="f" id="resetLocal" title="Efface UNIQUEMENT vos coches et commentaires de ce navigateur — jamais les statuts vérifiés">Réinitialiser mes coches</button>
</div>`;

// ── Script client v3 — persistance par ITID, deux vérités séparées ─────────
const script = `<style>
.verif{font-size:18px;line-height:1;margin-top:2px;flex-shrink:0}
.it.locale{outline:2px dashed var(--accent, #0e6e6e);outline-offset:2px}
.it.locale .tags::after{content:"corrigé de votre côté — à vérifier";font-size:11px;color:var(--accent, #0e6e6e);font-weight:600;margin-left:6px}
</style>
<script>
// v3 (25/08/2026) — persistance par ITID (stable d'une édition à l'autre).
// L'ancien stockage v1 (identifiants aléatoires, régénérés à chaque édition)
// est PURGÉ : il rendait la page incohérente à chaque republication.
['alflight-checklist-v1','alflight-checklist-notes-v1','alflight-checklist-hidden-v1']
  .forEach(k=>{try{localStorage.removeItem(k)}catch(e){}});
const KEY='alfck-v3-fait', NKEY='alfck-v3-notes', HKEY='alfck-v3-hidden';
const load=(k)=>{try{return JSON.parse(localStorage.getItem(k)||'{}')}catch(e){return{}}};
const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
let done=load(KEY), notes=load(NKEY), hiddenAv=load(HKEY);

// Cases LOCALES (points ouverts uniquement) — par itid.
document.querySelectorAll('.it[data-clos="0"]').forEach(el=>{
  const itid=el.dataset.itid;
  const box=el.querySelector('input[type=checkbox]');
  if(!box)return;
  if(done[itid]){box.checked=true;el.classList.add('locale')}
  box.addEventListener('change',()=>{
    el.classList.toggle('locale',box.checked);
    if(box.checked)done[itid]=1;else delete done[itid];
    save(KEY,done);apply();
  });
});
// Commentaires — par itid.
document.querySelectorAll('.it textarea.note').forEach(ta=>{
  const itid=ta.closest('.it').dataset.itid;
  if(notes[itid])ta.value=notes[itid];
  ta.addEventListener('input',()=>{
    if(ta.value.trim())notes[itid]=ta.value;else delete notes[itid];
    save(NKEY,notes);
  });
});

const F=[...document.querySelectorAll('button.f[data-sev]')];
const HD=document.getElementById('hideDone');
function apply(){
  const on=new Set(F.filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.dataset.sev));
  const hide=HD.getAttribute('aria-pressed')==='true';
  document.querySelectorAll('.it').forEach(el=>{
    const regle=el.dataset.clos==='1';
    const vis=on.has(el.dataset.sev)&&!(hide&&regle);
    el.classList.toggle('hidden',!vis);
  });
  let tot=0,verif=0,loc=0;
  document.querySelectorAll('details.av').forEach(d=>{
    const items=[...d.querySelectorAll('.it')].filter(e=>on.has(e.dataset.sev));
    const v=items.filter(e=>e.dataset.clos==='1').length;
    const l=items.filter(e=>e.classList.contains('locale')).length;
    tot+=items.length;verif+=v;loc+=l;
    d.querySelector('.count').textContent=items.length?v+' / '+items.length+' vérifiés'+(l?' · '+l+' à vérifier':''):'rien à ce filtre';
    d.classList.toggle('hidden',items.length===0);
  });
  const masques=document.querySelectorAll('.it').length-tot;
  document.getElementById('prog').textContent=
    (tot?verif+' / '+tot+' vérifiés':'')
    +(loc?' · '+loc+' coché'+(loc>1?'s':'')+' par vous (à vérifier)':'')
    +(masques?' · '+masques+' masqués par le filtre':'');
}
F.concat([HD]).forEach(b=>b.addEventListener('click',()=>{
  b.setAttribute('aria-pressed',b.getAttribute('aria-pressed')!=='true');apply();
}));

// Rapport par avion — même format qu'avant (le circuit établi).
document.querySelectorAll('button.rapport').forEach(b=>b.addEventListener('click',async(e)=>{
  e.preventDefault();e.stopPropagation();
  const card=b.closest('details.av');
  const reg=b.dataset.reg;
  const L=['=== RAPPORT '+reg+' — check-list du ${dateLabel} ==='];
  const faitsSans=[];
  card.querySelectorAll('.it[data-clos="0"]').forEach(el=>{
    const itid=el.dataset.itid, champ=el.dataset.champ, sev=el.dataset.sevlbl;
    const coche=!!el.querySelector('input[type=checkbox]')?.checked;
    const note=(el.querySelector('textarea.note')?.value||'').trim();
    if(note){
      L.push('');
      L.push('['+itid+'] '+champ+' ('+sev+') — '+(coche?'FAIT':'non fait'));
      L.push('  → '+note.split(String.fromCharCode(10)).join(String.fromCharCode(10)+'    '));
    }else if(coche){faitsSans.push(itid);}
  });
  if(faitsSans.length){L.push('');L.push('Cochés faits sans commentaire : '+faitsSans.join(', '));}
  if(L.length===1){L.push('');L.push('(aucun commentaire ni case cochée sur cet avion)');}
  const txt=L.join(String.fromCharCode(10));
  try{await navigator.clipboard.writeText(txt);}
  catch(err){
    const t=document.createElement('textarea');t.value=txt;document.body.appendChild(t);
    t.select();document.execCommand('copy');t.remove();
  }
  const old=b.textContent;b.textContent='Copié ✓';setTimeout(()=>{b.textContent=old;},1600);
}));

// Avions masqués — par immatriculation (stable).
const SH=document.getElementById('showHidden');
function applyHidden(){
  let nb=0;
  document.querySelectorAll('details.av').forEach(d=>{
    const reg=d.querySelector('.hideav')?.dataset.reg;
    const h=!!hiddenAv[reg];
    d.classList.toggle('user-hidden',h);
    if(h)nb++;
    const b=d.querySelector('.hideav');
    if(b)b.textContent=h?'Ré-afficher':'Masquer';
  });
  SH.style.display=nb?'':'none';
  SH.textContent='Avions masqués : '+nb;
  document.body.classList.toggle('reveal-hidden',SH.getAttribute('aria-pressed')==='true');
  if(!nb){SH.setAttribute('aria-pressed','false');document.body.classList.remove('reveal-hidden');}
}
document.querySelectorAll('.hideav').forEach(b=>b.addEventListener('click',(e)=>{
  e.preventDefault();e.stopPropagation();
  const reg=b.dataset.reg;
  if(hiddenAv[reg])delete hiddenAv[reg];else hiddenAv[reg]=1;
  save(HKEY,hiddenAv);applyHidden();
}));
SH.addEventListener('click',()=>{
  SH.setAttribute('aria-pressed',SH.getAttribute('aria-pressed')!=='true');
  applyHidden();
});

document.getElementById('resetLocal').addEventListener('click',()=>{
  if(!confirm('Effacer vos coches et commentaires de CE navigateur ? (Les statuts vérifiés ✅ ne bougent pas.)'))return;
  done={};notes={};hiddenAv={};
  [KEY,NKEY,HKEY].forEach(k=>{try{localStorage.removeItem(k)}catch(e){}});
  document.querySelectorAll('.it.locale').forEach(el=>{el.classList.remove('locale');const b=el.querySelector('input');if(b)b.checked=false;});
  document.querySelectorAll('.it textarea.note').forEach(t=>t.value='');
  applyHidden();apply();
});

const T=document.getElementById('toggleAll');
T.addEventListener('click',()=>{
  const open=T.getAttribute('aria-pressed')!=='true';
  T.setAttribute('aria-pressed',open);T.textContent=open?'Tout replier':'Tout déplier';
  document.querySelectorAll('details.av').forEach(d=>d.open=open);
});
applyHidden();apply();
</script>`;

const html = `
<title>Check-list de correction — base avions ALFlight</title>
${style}

<div class="wrap">
<header class="top">
  <div class="eyebrow">ALFlight · check-list de correction · v3</div>
  <h1>${avions.length} avions — dernier passage sur l’intégrité des données</h1>
  <p class="lede"><b>Édition consolidée</b> : sur les ${all.length} points recensés depuis l’audit d’origine,
  <b>${nClos} sont réglés et vérifiés en base</b> — ils ont été <b>retirés de cette page</b> (chaque retrait a été
  contrôlé sur l’extraction du ${dateLabel} : la valeur fautive a réellement disparu). Il reste <b>${nOuverts} points à
  traiter</b>. Cochez « corrigé de mon côté » et commentez : « Copier le rapport » me transmet vos retours, je vérifie
  sur pièces, et le point disparaît à l’édition suivante. Vos coches sont conservées d’une édition à l’autre.</p>
  <p class="lede" style="margin-top:10px">Restants : ${nOuvertsSev('critique')} critiques, ${nOuvertsSev('majeur')} majeurs, ${nOuvertsSev('mineur')} mineurs — dont ${nConfOuverts} « à confirmer au manuel ».
  À l’ouverture, seuls les critiques et majeurs sont affichés ; le bouton « Mineurs » révèle le reste. Dernière édition : ${dateLabel}.</p>
</header>

${barre}

${avions.map(renderAvion).join('\n')}

<footer>Audit en lecture seule de la table <span class="path">community_presets</span> — moteur rejoué sur chaque modèle
d’abaque. Les valeurs « attendues » d’un point « à confirmer » sont à vérifier au manuel de vol : aucune n’a été lue dans
un document constructeur.</footer>
</div>

${script}
`;

fs.writeFileSync(here('checklist.html'), html, 'utf8');
console.log(
  `checklist.html v3 : ${avions.length} avions, ${all.length} points — ${nClos} vérifiés / ${nOuverts} ouverts ` +
  `(${n('critique')} critiques, ${n('majeur')} majeurs, ${n('mineur')} mineurs) — ${Math.round(html.length / 1024)} ko`
);
