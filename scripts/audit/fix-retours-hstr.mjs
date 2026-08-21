import fs from 'node:fs';
const p = new URL('./retours.json', import.meta.url);
const r = JSON.parse(fs.readFileSync(p, 'utf8'));
const V = 'Vérifié sur l\'extraction RÉELLE du 21/08 15h52 (mes contrôles précédents lisaient une copie périmée — erreur de ma part, corrigée)';
const fait = (itid, detail) => ({ itid, status: 'fait', note: `${V} : ${detail}` });
const add = [
  fait('F-HSTR-01', 'table[17] (6000 ft, 10 °C) = 740 m (était 40).'), fait('F-HSTR-02', 'table[17] (9000 ft, 40 °C) = 1100 m (était 110).'),
  fait('F-HSTR-03', 'table[24] (8000 ft, 40 °C) = 1440 m (était 144).'), fait('F-HSTR-04', 'réservoir : totalCapacity 155 / usableCapacity 147 (racine 155,2 / 147,5).'),
  fait('F-HSTR-05', 'maxBaggageTotalMass = 35 kg (30 + 5).'),
  { itid: 'F-HSTR-06', status: 'note', note: `${V} : cgLimits racine et miroir toujours à 2,59 alors que l'enveloppe dit 2,53 — champs NON exposés en UI et INERTES (le moteur lit cgEnvelope). À réaligner par script dans le lot F-GUVV.` },
  { itid: 'F-HSTR-07', status: 'note', note: `${V} : maxBaggageWeight toujours 50 kg alors que les compartiments déclarés font 30 + 5 kg (total 35 saisi). Champ legacy : le moteur applique les plafonds par compartiment + le total — à vider pour lever la contradiction.` },
  { itid: 'F-HSTR-08', status: 'note', note: `${V} : maxAuxiliaryWeight toujours 20 kg — le DA40 NG n'a pas de compartiment auxiliaire hors les 2 déclarés : à vider.` },
  fait('F-HSTR-09', 'table[28] (6000 ft, 10 °C) = 830 m et (5000 ft, 10 °C) = 785 m.'), fait('F-HSTR-10', 'table[12] (10000 ft, 20 °C) = 660 m.'),
  fait('F-HSTR-11', 'table[13] (8000 ft, 40 °C) = 570 m.'), fait('F-HSTR-12', 'table[25] (9000 ft, 20 °C) = 1400 m.'), fait('F-HSTR-13', 'table[27] (8000 ft, 20 °C) = 1170 m.'),
  fait('F-HSTR-14', 'table[6] (12000 ft, 0 °C) = 565 ft/min.'), fait('F-HSTR-15', 'table[7] (12000 ft, 30 °C) = 535 ft/min.'), fait('F-HSTR-16', 'table[33] (8000 ft, 40 °C) = 525 ft/min.'), fait('F-HSTR-17', 'table[35] (12000 ft, −20 °C) = 770 ft/min.'),
  { itid: 'F-HSTR-18', status: 'valide', note: 'Rapport pilote 21/08 : « ne les donnent pas » — le manuel ne publie pas les colonnes manquantes au palier 6000 ft. Conforme : le moteur refuse hors grille, rien n\'est inventé.' },
  { itid: 'F-HSTR-19', status: 'note', note: `${V} : bypassedFields encore vide. Déclaration « absente » notée : certifiez les 2 opérations décollage volets UP via la pastille « Non fournie par le manuel (certifié) » de l'étape Performance, puis enregistrez.` },
  fait('F-HSTR-20', '11 règles saisies (vent face/arrière par tranche de 10 %, herbe, herbe haute, herbe mouillée, sol mou, dur mouillé) — les états de piste deviennent applicables avec le sélecteur livré le 21/08.'),
  fait('F-GIEA-08', 'windLimits.limits = maxCrosswind 17 kt (le faux maxTailwind a disparu).'),
  { itid: 'F-GIEA-01', status: 'note', note: 'Manuel p31-32 : Vs 50 kt sans volet, 44 kt volets 40°. Extraction réelle du 21/08 15h52 : vs1 = 50 ✓, mais vso = 63 ENCORE, et vsTO = 44 (le 44 est la valeur volets 40° = VSO, pas une valeur volets décollage). → vso = 44 ; vsTO : le manuel ne donne pas de valeur intermédiaire, laisser vide.' }
];
const ids = new Set(add.map(x => x.itid));
const merged = [...r.filter(x => !ids.has(x.itid)), ...add];
fs.writeFileSync(p, JSON.stringify(merged, null, 1));
console.log('retours :', merged.length);
