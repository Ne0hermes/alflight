import fs from 'node:fs';
const p = new URL('./retours.json', import.meta.url);
const r = JSON.parse(fs.readFileSync(p, 'utf8'));
const nonEnBase = (itid, detail) => ({ itid, status: 'note', note: `Rapport pilote 21/08 : coché fait — mais la base ré-extraite le 21/08 à 13h05 montre la valeur INCHANGÉE (${detail}). Fiche vraisemblablement modifiée sans être enregistrée : Validation → « Valider et enregistrer », puis je re-vérifie.` });
const add = [
  nonEnBase('F-HSTR-01', '40 m toujours présent à 6000 ft / 10 °C'),
  nonEnBase('F-HSTR-02', '110 m toujours présent à 9000 ft / 40 °C'),
  nonEnBase('F-HSTR-03', '144 m toujours présent à 8000 ft / 40 °C'),
  nonEnBase('F-HSTR-04', 'réservoir : capacity 155,2 seul, pas de total/utilisable'),
  { itid: 'F-HSTR-05', status: 'note', note: "Rapport pilote 21/08 : coché fait sans valeur — maxBaggageTotalMass toujours absent. Si le DA40 NG n'a pas de limite TOTALE de soute (seulement 30 kg + 5 kg par compartiment), c'est conforme : dites-le-moi et je passe le point en validé." },
  { itid: 'F-HSTR-06', status: 'note', note: "Rapport pilote 21/08 : « valeur inexistante » — exact, ces miroirs (2,59) ne sont exposés par aucun écran. Inertes : le moteur lit cgEnvelope (2,53) en priorité. À réaligner par script dans le même lot que F-GUVV-01/04." },
  nonEnBase('F-HSTR-07', 'maxBaggageWeight = 50 kg, alors que les compartiments déclarés disent 30 kg + 5 kg'),
  nonEnBase('F-HSTR-08', 'maxAuxiliaryWeight = 20 kg'),
  nonEnBase('F-HSTR-09', '8830 m à 6000 ft / 10 °C et 700 m à 5000 ft / 10 °C'),
  nonEnBase('F-HSTR-10', '566 m à 10000 ft / 20 °C'),
  nonEnBase('F-HSTR-11', '750 m à 8000 ft / 40 °C'),
  nonEnBase('F-HSTR-12', '4000 m à 9000 ft / 20 °C'),
  nonEnBase('F-HSTR-13', '1070 m à 8000 ft / 20 °C'),
  nonEnBase('F-HSTR-14', '656 ft/min à 12000 ft / 0 °C'),
  nonEnBase('F-HSTR-15', '835 ft/min à 12000 ft / 30 °C'),
  nonEnBase('F-HSTR-16', '252 ft/min à 8000 ft / 40 °C'),
  nonEnBase('F-HSTR-17', '700 ft/min à 12000 ft / −20 °C'),
  { itid: 'F-HSTR-18', status: 'valide', note: "Rapport pilote 21/08 : « ne les donnent pas » — le manuel ne publie pas les colonnes manquantes au palier 6000 ft. Conforme : le moteur refuse hors grille (fail-closed), rien n'est inventé." },
  { itid: 'F-HSTR-19', status: 'note', note: "Rapport pilote 21/08 : « absente » — déclaration notée. bypassedFields est encore vide en base : certifiez les 2 opérations décollage volets UP via la pastille « Non fournie par le manuel (certifié) » de l'étape Performance, puis enregistrez la fiche ; je vérifie ensuite." },
  nonEnBase('F-HSTR-20', "performanceCorrections toujours absent — si le manuel DA40 NG ne donne aucun facteur vent/herbe, dites-le et je passe le point en validé")
];
const ids = new Set(add.map(x => x.itid));
const merged = [...r.filter(x => !ids.has(x.itid)), ...add];
fs.writeFileSync(p, JSON.stringify(merged, null, 1));
console.log('retours :', merged.length);
