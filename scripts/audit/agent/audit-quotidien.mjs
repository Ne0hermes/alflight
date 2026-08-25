// scripts/audit/agent/audit-quotidien.mjs
//
// 🤖 AGENT QUOTIDIEN (demande pilote, 24/08/2026) — tourne sur le PC via une
// tâche planifiée Windows. Trois missions :
//   1. AUDIT D'INTÉGRITÉ des fiches avion (extraction fraîche de la base,
//      contrôles vitaux, valeurs fantômes connues, DIFF avec la veille) ;
//   2. SONDE MOTEUR : chaque modèle d'abaque évalué sur 5 conditions (le même
//      banc que les audits manuels, PROBE_REG=ALL) ;
//   3. NAVIGATION ALÉATOIRE en France : deux aérodromes tirés au sort, un
//      avion au sort, distance/cap/temps/carburant/masse-centrage calculés par
//      le VRAI moteur — toute valeur non finie ou refus inattendu est signalé.
//
// Le dimanche, un résumé HEBDOMADAIRE agrège les 7 rapports.
//
// Règles : fail-closed (une donnée absente est SIGNALÉE, jamais remplacée) ;
// lecture seule sur la base ; les clés restent dans .env — jamais affichées.
//
// Usage :  node scripts/audit/agent/audit-quotidien.mjs        (depuis la racine)
//          node scripts/audit/agent/audit-quotidien.mjs --hebdo (forcer le résumé)

import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');          // D:/Applicator/alflight
const AUDIT = path.resolve(__dirname, '..');               // scripts/audit
const RAPPORTS = path.join(__dirname, 'rapports');
fs.mkdirSync(RAPPORTS, { recursive: true });

const aujourdhui = new Date();
const jour = aujourdhui.toISOString().slice(0, 10);
const anomalies = [];   // { gravite: 'critique'|'majeur'|'info', quoi, detail }
const note = (gravite, quoi, detail) => anomalies.push({ gravite, quoi, detail });

const num = (v) => { const n = typeof v === 'string' ? parseFloat(v) : v; return Number.isFinite(n) ? n : null; };

// ═══ 1. EXTRACTION FRAÎCHE ══════════════════════════════════════════════════
console.log('── extraction de la base ──');
execSync('node dump-fleet.mjs', { cwd: AUDIT, stdio: 'inherit' });
execSync('node split-fleet.mjs', { cwd: AUDIT, stdio: 'inherit' });
const FLEET = path.join(AUDIT, 'fleet');
const fiches = fs.readdirSync(FLEET).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(FLEET, f), 'utf8')));

// ═══ 2. INTÉGRITÉ PAR AVION ═════════════════════════════════════════════════
console.log('── contrôles d\'intégrité ──');
const tankUsable = (t) => num(t?.usableCapacity) ?? num(t?.capacity);
for (const fiche of fiches) {
  const reg = fiche.registration, d = fiche.aircraft_data || {};
  const manque = (champ) => note('critique', `${reg} : ${champ} absent`, 'donnée vitale du devis de masse');

  if (num(d.emptyWeight) === null) manque('masse à vide');
  if (num(d.weightBalance?.emptyWeightArm) === null && num(d.arms?.empty) === null) manque('bras de la masse à vide');
  if (num(d.maxTakeoffWeight) === null && num(d.weights?.mtow) === null) manque('MTOW');
  const fwd = d.cgEnvelope?.forwardPoints;
  if (!Array.isArray(fwd) || fwd.length === 0) note('critique', `${reg} : enveloppe de centrage sans point avant`, 'aucun verdict de centrage possible');
  if (num(d.cgEnvelope?.aftCG) === null && !(Array.isArray(d.cgEnvelope?.aftPoints) && d.cgEnvelope.aftPoints.length)) note('critique', `${reg} : limite arrière absente`, '');
  for (const v of ['vs1', 'vso', 'vsTO', 'vne']) {
    if (num(d.speeds?.[v]) === null) note('majeur', `${reg} : vitesse ${v} absente`, 'requise depuis le 23/08');
  }
  const tanks = d.additionalFuelTanks || [];
  if (!tanks.some((t) => tankUsable(t) !== null)) note('critique', `${reg} : aucun réservoir avec un volume lisible`, '');
  tanks.forEach((t, i) => {
    const arm = num(t?.arm);
    if (tankUsable(t) !== null && (arm === null || arm === 0)) {
      note('critique', `${reg} : réservoir « ${t?.name || i} » sans bras exploitable`, `arm=${JSON.stringify(t?.arm)} — un bras 0/absent fausse le moment`);
    }
  });
  (d.baggageCompartments || []).forEach((c) => {
    const arm = num(c?.arm);
    if (arm === null || arm === 0) note('critique', `${reg} : compartiment « ${c?.name} » sans bras exploitable`, `arm=${JSON.stringify(c?.arm)}`);
  });
  // 🛡️ RÉAPPARITIONS (purges des 24-25/08) : tout champ banni qui revient en
  // base signale un cache local périmé qui a été re-sauvegardé.
  if (d.maxBaggageWeight !== undefined || d.maxAuxiliaryWeight !== undefined) {
    note('majeur', reg + ' : maxBaggageWeight/maxAuxiliaryWeight RÉAPPARUS', 'champ purgé le 24/08 — cache local périmé re-sauvegardé ?');
  }
  if (d.cgLimits !== undefined) note('majeur', reg + ' : cgLimits plat RÉAPPARU', 'purgé le 25/08');
  if (d.weightBalance?.cgLimits !== undefined) note('majeur', reg + ' : weightBalance.cgLimits RÉAPPARU', 'purgé le 25/08');
  for (const conteneur of ['arms', 'weightBalance']) {
    for (const [k, v] of Object.entries(d[conteneur] || {})) {
      if (typeof v !== 'object' && num(v) === 0 && /[Aa]rm$|^empty$|^frontSeats$|^rearSeats$|^fuelMain$|^baggageFwd$|^baggageAft$/.test(k)) {
        note('majeur', reg + ' : bras à ZÉRO réapparu (' + conteneur + '.' + k + ')', 'les zéros fabriqués ont été purgés le 24/08');
      }
    }
  }
  // Fantômes connus : miroir cgLimits plat qui contredit l'enveloppe.
  const platF = num(d.cgLimits?.forward), envF = num(fwd?.[0]?.cg);
  if (platF !== null && envF !== null && Math.abs(platF - envF) > 0.02) {
    note('majeur', `${reg} : cgLimits plat (${platF}) contredit l'enveloppe (${envF})`, 'miroir à purger — l\'enveloppe fait foi');
  }
  // La limite ARRIÈRE aussi : F-HSTR ne divergeait que sur elle (2,59 vs 2,53).
  const platA = num(d.cgLimits?.aft);
  const envA = num(d.cgEnvelope?.aftCG) ?? num(d.cgEnvelope?.aftPoints?.[0]?.cg);
  if (platA !== null && envA !== null && Math.abs(platA - envA) > 0.02) {
    note('majeur', reg + " : cgLimits plat arrière (" + platA + ") contredit l'enveloppe (" + envA + ")", "miroir à purger — l'enveloppe fait foi");
  }
}

// ═══ 3. DIFF AVEC LA VEILLE ═════════════════════════════════════════════════
const etat = {
  avions: Object.fromEntries(fiches.map((f) => [f.registration, {
    maj: f.updated_at, taille: JSON.stringify(f.aircraft_data || {}).length,
  }])),
};
const dernierEtatPath = path.join(RAPPORTS, 'dernier-etat.json');
if (fs.existsSync(dernierEtatPath)) {
  const avant = JSON.parse(fs.readFileSync(dernierEtatPath, 'utf8'));
  for (const reg of Object.keys(avant.avions || {})) {
    if (!etat.avions[reg]) note('critique', `${reg} : avion DISPARU de la base depuis hier`, '');
  }
  for (const [reg, v] of Object.entries(etat.avions)) {
    const p = avant.avions?.[reg];
    if (!p) note('info', `${reg} : NOUVEL avion en base`, '');
    else if (p.maj !== v.maj) note('info', `${reg} : fiche modifiée`, `${p.maj} → ${v.maj}`);
  }
}
fs.writeFileSync(dernierEtatPath, JSON.stringify(etat, null, 1));

// ═══ 4. SONDE MOTEUR (banc d'abaques, PROBE_REG=ALL) ═══════════════════════
console.log('── sonde moteur ──');
try {
  execSync('npx vitest run src/services/__tests__/audit.probe.test.js', {
    cwd: ROOT, stdio: 'pipe', timeout: 300000,
    env: { ...process.env, PROBE_REG: 'ALL', PROBE_FLEET: FLEET.replace(/\\/g, '/') },
  });
} catch (e) {
  note('critique', 'sonde moteur : le banc a échoué', String(e.message).slice(0, 300));
}
let modelesTestes = 0, refusMoteur = 0;
for (const f of fs.readdirSync(AUDIT).filter((x) => /^probe-F-.*\.json$/.test(x))) {
  const p = JSON.parse(fs.readFileSync(path.join(AUDIT, f), 'utf8'));
  for (const m of p.models || []) {
    modelesTestes++;
    const runs = m.runs || [];
    const echecs = runs.filter((r) => r.error);
    refusMoteur += echecs.length;
    // Un modèle qui ne calcule PLUS RIEN est une régression probable.
    if (runs.length > 0 && echecs.length === runs.length) {
      note('majeur', `${p.registration} : « ${m.name} » ne calcule plus AUCUNE condition`, echecs[0]?.error?.slice(0, 160) || '');
    }
    for (const r of runs) {
      if (!r.error && r.value !== null && !Number.isFinite(r.value)) {
        note('critique', `${p.registration} : « ${m.name} » rend une valeur non finie`, `${r.cond} → ${r.value}`);
      }
    }
  }
}

// ═══ 5. NAVIGATION ALÉATOIRE EN FRANCE ══════════════════════════════════════
console.log('── navigation aléatoire ──');
const nav = { }; // rempli ci-dessous, versé au rapport
try {
  const geo = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/derived/geojson/aerodromes.geojson'), 'utf8'));
  const terrains = (geo.features || [])
    .map((f) => ({
      nom: f.properties?.name, code: f.properties?.id || f.properties?.sia_uid,
      lat: num(f.properties?.latitude ?? f.geometry?.coordinates?.[1]),
      lon: num(f.properties?.longitude ?? f.geometry?.coordinates?.[0]),
    }))
    .filter((t) => t.lat !== null && t.lon !== null && t.nom);
  const tirage = () => terrains[Math.floor(Math.random() * terrains.length)];

  const navMod = await import(pathToFileURL(path.join(ROOT, 'packages/calc-engine/src/nav/navigationCalculations.js')).href);
  const wbMod = await import(pathToFileURL(path.join(ROOT, 'packages/calc-engine/src/wb/computeWeightBalance.js')).href);

  // Deux terrains entre 20 et 200 NM — jusqu'à 40 tirages pour trouver une paire.
  let depart = tirage(), arrivee = tirage(), distNM = null;
  for (let i = 0; i < 40; i++) {
    arrivee = tirage();
    distNM = navMod.calculateDistance(depart.lat, depart.lon, arrivee.lat, arrivee.lon);
    if (Number.isFinite(distNM) && distNM >= 20 && distNM <= 200 && arrivee.code !== depart.code) break;
    if (i % 8 === 7) depart = tirage();
  }
  const avion = fiches[Math.floor(Math.random() * fiches.length)];
  const d = avion.aircraft_data || {};
  nav.vol = `${depart.nom} (${depart.code}) → ${arrivee.nom} (${arrivee.code})`;
  nav.avion = avion.registration;
  nav.distanceNM = Number.isFinite(distNM) ? Math.round(distNM * 10) / 10 : null;
  if (!Number.isFinite(distNM)) note('critique', 'nav : distance non calculable', nav.vol);

  const cap = navMod.calculateBearing?.(depart.lat, depart.lon, arrivee.lat, arrivee.lon);
  nav.capVrai = Number.isFinite(cap) ? Math.round(cap) : null;

  // Temps et carburant : UNIQUEMENT depuis les données de l'avion — fail-closed.
  const tas = num(d.cruiseSpeedKt);
  const conso = num(d.fuelConsumption) ?? num(d.fuelConsumptionLph);
  if (tas === null) note('majeur', `nav : ${avion.registration} sans vitesse de croisière`, 'temps de vol incalculable');
  if (conso === null) note('majeur', `nav : ${avion.registration} sans consommation`, 'carburant incalculable');
  if (tas !== null && Number.isFinite(distNM)) {
    nav.tempsMin = Math.round((distNM / tas) * 60);
    if (conso !== null) nav.carburantVolLtr = Math.round((nav.tempsMin / 60) * conso * 10) / 10;
  }

  // Masse & centrage du vol tiré : pilote 85 kg + carburant du vol.
  const fobL = nav.carburantVolLtr != null ? nav.carburantVolLtr + 20 : null; // +20 L de marge d'exercice
  const wb = wbMod.computeWeightBalance({
    aircraft: d,
    loads: { frontLeft: 85, frontRight: 0, rearLeft: 0, rearRight: 0, baggage: 0, auxiliary: 0 },
    fobFuel: fobL != null ? { liters: fobL } : undefined,
    activeTankIds: null,
  });
  if (!wb) {
    note('majeur', `nav : M&C indisponible pour ${avion.registration}`, 'computeWeightBalance a rendu null');
  } else {
    nav.masseDecollage = wb.totalWeight ?? null;
    nav.cg = wb.cg ?? null;
    nav.centrageOk = wb.isWithinLimits ?? null;
    for (const [k, v] of Object.entries({ masse: wb.totalWeight, cg: wb.cg })) {
      if (v !== null && v !== undefined && !Number.isFinite(v)) {
        note('critique', `nav : ${avion.registration} — ${k} non fini`, String(v));
      }
    }
  }
} catch (e) {
  note('critique', 'nav aléatoire : plantage', String(e.stack || e).slice(0, 400));
}

// ═══ 6. RAPPORT DU JOUR ═════════════════════════════════════════════════════
const crit = anomalies.filter((a) => a.gravite === 'critique');
const maj = anomalies.filter((a) => a.gravite === 'majeur');
const infos = anomalies.filter((a) => a.gravite === 'info');
const rapport = { jour, avions: fiches.length, modelesTestes, refusMoteur, nav, anomalies };
fs.writeFileSync(path.join(RAPPORTS, `${jour}.json`), JSON.stringify(rapport, null, 1));

const lignes = [
  `Avions : ${fiches.length} · modèles testés : ${modelesTestes} (refus banc : ${refusMoteur})`,
  `Nav aléatoire : ${nav.vol || '—'} avec ${nav.avion || '—'} — ${nav.distanceNM ?? '?'} NM, cap ${nav.capVrai ?? '?'}°, ${nav.tempsMin ?? '?'} min, ${nav.carburantVolLtr ?? '?'} L, M&C ${nav.centrageOk === true ? 'OK' : nav.centrageOk === false ? 'HORS LIMITES' : 'indisponible'}`,
  `Anomalies : ${crit.length} critiques, ${maj.length} majeures, ${infos.length} infos`,
  ...crit.slice(0, 8).map((a) => `  ⛔ ${a.quoi}`),
  ...maj.slice(0, 6).map((a) => `  ⚠ ${a.quoi}`),
];
console.log('\n' + lignes.join('\n'));

// ═══ 7. JOURNAL GOOGLE SHEETS (serveur local, démarré si besoin) ════════════
async function poster(payload) {
  const tenter = () => fetch('http://127.0.0.1:3001/api/log', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  try { return await tenter(); } catch {
    const enfant = spawn(process.execPath, [path.join(ROOT, 'server/googleSheetsServer.js')],
      { cwd: ROOT, detached: true, stdio: 'ignore' });
    enfant.unref();
    await new Promise((r) => setTimeout(r, 4000));
    return tenter();
  }
}
try {
  await poster({
    summary: `Agent quotidien ${jour} : ${crit.length} critiques / ${maj.length} majeures sur ${fiches.length} avions`,
    details: lignes.join('\n'),
    files: `scripts/audit/agent/rapports/${jour}.json`,
    component: 'Agent quotidien',
  });
  console.log('journal Google Sheets : envoyé');
} catch (e) { console.error('journal Google Sheets : échec —', e.message); }

// ═══ 8. RÉSUMÉ HEBDOMADAIRE (le dimanche, ou --hebdo) ═══════════════════════
if (aujourdhui.getDay() === 0 || process.argv.includes('--hebdo')) {
  const septJours = [...Array(7)].map((_, i) => {
    const d2 = new Date(aujourdhui); d2.setDate(d2.getDate() - i);
    return d2.toISOString().slice(0, 10);
  });
  const rapports = septJours
    .map((j) => path.join(RAPPORTS, `${j}.json`))
    .filter((p) => fs.existsSync(p))
    .map((p) => JSON.parse(fs.readFileSync(p, 'utf8')));
  const totalCrit = rapports.reduce((s, r) => s + r.anomalies.filter((a) => a.gravite === 'critique').length, 0);
  const totalMaj = rapports.reduce((s, r) => s + r.anomalies.filter((a) => a.gravite === 'majeur').length, 0);
  const vols = rapports.map((r) => r.nav?.vol).filter(Boolean);
  const recurrentes = {};
  rapports.flatMap((r) => r.anomalies.filter((a) => a.gravite !== 'info')).forEach((a) => {
    recurrentes[a.quoi] = (recurrentes[a.quoi] || 0) + 1;
  });
  const top = Object.entries(recurrentes).sort((a, b) => b[1] - a[1]).slice(0, 10);
  try {
    await poster({
      summary: `RESUME HEBDO agent : ${rapports.length} jours audités, ${totalCrit} critiques / ${totalMaj} majeures cumulées`,
      details: [
        `Semaine du ${septJours[6]} au ${jour} — ${rapports.length} rapports.`,
        `Navigations testées : ${vols.length ? vols.join(' ; ') : 'aucune'}`,
        'Anomalies récurrentes :',
        ...top.map(([q, n]) => `  ${n}× ${q}`),
      ].join('\n'),
      files: 'scripts/audit/agent/rapports/',
      component: 'Agent quotidien',
    });
    console.log('résumé hebdomadaire : envoyé');
  } catch (e) { console.error('résumé hebdo : échec —', e.message); }
}

process.exit(crit.length > 0 ? 2 : 0);
