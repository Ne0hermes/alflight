import fs from 'node:fs';
const p = new URL('./retours.json', import.meta.url);
const r = JSON.parse(fs.readFileSync(p, 'utf8'));
const M = 'Manuel pilote F-GIEA (Aéroclub de Sens, éd. 1 2025)';
const note = (itid, note) => ({ itid, status: 'note', note });
const add = [
  note('F-GIEA-01', `${M}, p31-32 : CONTREDIT la fiche — décrochage à la masse max : sans volet Vs 50 kt, volets 40° 44 kt (1,3 Vs = 65 / 58 ; 1,45 Vs = 73 / 64). Le 63 kt de la fiche est Vx (p23, p32). → speeds.vso = 44, vs1 = 50.`),
  note('F-GIEA-02', `${M}, p44 et p51 : carburant UTILISABLE 48 US gal = 182 l CONFIRMÉ (bras 95,0 in = 2,413 m). La capacité TOTALE (189 l / 50 US gal) n'apparaît nulle part dans ce document → à confirmer sur le POH d'origine avant de l'inscrire.`),
  note('F-GIEA-03', `${M}, p51-52 : CONTREDIT — « Bagages (50 lb – 23 kg maximum) », bras 142,8 in = 3,627 m. Le 50 de la fiche est l'injection par défaut ou une confusion lb/kg. → maxBaggageWeight = 23 ; et arms.baggageAft / weightBalance.baggageArm valent 0 → 3,627 m.`),
  note('F-GIEA-04', `${M}, p51-52 : une seule station bagages, AUCUN compartiment auxiliaire (p52 : catégorie utilitaire = bagages et passagers arrière interdits). → vider maxAuxiliaryWeight.`),
  { itid: 'F-GIEA-05', status: 'valide', note: `${M}, p35-38 (lecture graphique ±3 °C) : l'axe OAT va bien de −40 à +40 °C mais les lignes d'altitude sont TRONQUÉES côté froid sur le papier (dessin Piper) — début de la ligne niveau mer ≈ −5 / +3 / +10 / +7 °C selon l'abaque. Les courbes de la fiche reproduisent fidèlement le papier : ne PAS les prolonger vers −40 °C (ce serait inventer). Le moteur refuse hors tracé.` },
  note('F-GIEA-06', `${M}, p34 (décollage) : herbe sèche courte (≤ 20 cm) ×1,20 ; herbe humide courte ×1,30 ; sol mou / contaminé ×1,25 ; pente montante 2 % → +10 % — facteurs à multiplier entre eux. p49 (atterrissage) : piste en dur mouillée ×1,15 ; herbe sèche ×1,15 ; herbe humide ×1,35 ; sol mou ×1,25 ; pente 2 % → +10 %. → règles DISTINCTES par phase (le preset « herbe +15 % both » ne correspond PAS au manuel). Les types herbe mouillée / sol mou / dur mouillé deviennent applicables avec le sélecteur d'état de piste (chantier du 21/08).`),
  note('F-GIEA-07', `Même constat que F-GIEA-01 : vso = 44 kt volets 40°, vs1 = 50 kt (p31-32).`),
  note('F-GIEA-08', `${M}, p32 : « VENT DE TRAVERS MAX DÉMONTRÉ 17 KT ». Aucune limite de vent ARRIÈRE dans le document (les 5 kt des abaques sont une limite de tracé, pas opérationnelle). → maxCrosswind = 17 ; maxTailwind = 17 est une confusion → le manuel ne le donne pas.`),
  note('F-GIEA-09', `${M} : aucune liste d'opérations approuvées. Équipements attestés par les check-lists : balise de détresse (p16, p58, p70) → elt = true justifié ; transpondeur, GPS, Garmin G5, détecteur CO. vfrDay etc. : à déclarer par le pilote.`),
  note('F-GIEA-10', `${M}, p53 : le domaine de centrage commence à 1200 lb = 550 kg ; aucune masse mini explicite, 600 n'apparaît nulle part. → racine minTakeoffWeight = 550 (cohérent avec l'enveloppe).`),
  note('F-GIEA-11', `${M}, p20 : « Transpondeur ALT » sans lettre de mode. Correction structurelle (champ singulier orphelin → vider), indépendante du manuel.`),
  note('F-GIEA-12', `${M}, p35-38 : titres du papier — « Course au décollage avec 0° de volets », « Performances de décollage avec 0° de volets — franchissement 50 ft (15 m) », idem 25°. → renommer sans marqueur « ⚠ DOUBLON ».`),
  note('F-GIEA-13', `${M}, p50 : abaque DISTANCE D'ATTERRISSAGE volets 40° uniquement (1055 kg, piste dure sèche, freinage max, Vi 63 kt, vent debout 15 kt / arrière 5 kt, deux sorties course / 50 ft). Aucun abaque volets rentrés → landing_*_flaps_up : certification « absent du manuel » légitime ; landing_*_flaps_landing : numérisables depuis p50 (lecture descendante).`),
  note('F-GIEA-14', `${M}, p35-38 : les abaques portent des lignes « VENT DEBOUT » (0-15 kt) et « VENT ARRIÈRE » (0-5 kt) → tags windDirection headwind sur h11, tailwind sur t2 et t14 légitimes (structure).`),
  note('F-GIEA-15', `Structure (fiche) : les deux « 7 » et les deux « h6 » ont des plages Y distinctes → deux guides différents mal numérotés, pas des doublons. → RENUMÉROTER (7→7/8, 8→9… ; h6→h6/h7…), ne pas supprimer.`),
  note('F-GIEA-16', `${M}, p35-38 : panneau masse de 1600 lb (726 kg) à la ligne de référence 2325 lb (1055 kg), graduations 750/850/950/1050 kg ; panneau vent : référence vent nul à 0 kt. → axe masse [726 ; 1055], guides jusqu'à la ligne de référence, guides vent démarrant à 0.`),
  note('F-GIEA-17', `${M}, p35-38 : double échelle (ft à droite, m à gauche) — les valeurs de la fiche suivent l'échelle ft. → outputUnit = 'ft', titres Y « Course au décollage » / « Distance de décollage avec franchissement 50 ft (15 m) ».`),
  note('F-GIEA-18', `${M}, p21-22 : rotation « selon la masse 45 à 55 kt » (normal volets 0°), 40 à 50 kt (terrain court) ; abaques : Vi d'envol 50 kt à 2325 lb, 40 kt à 1600 lb. Pas de valeur unique → proposition vr = 55 kt (borne haute, masse max, procédure normale) — à valider par le pilote.`),
  note('F-GIEA-19', `${M}, p21 : « Vitesse de montée initiale 63 kt » (décollage normal volets 0°) ; p23 : pente max 63, vario max 79, en route 86 kt. → initialClimb = 63 kt (unité vitesse, pas ft/min).`)
];
const ids = new Set(add.map(x => x.itid));
const merged = [...r.filter(x => !ids.has(x.itid)), ...add];
fs.writeFileSync(p, JSON.stringify(merged, null, 1));
console.log('retours :', merged.length);
