// Sonde de COMPLÉTUDE réutilisable : passe chaque fiche de la flotte au même
// juge que les formulaires (aircraftCompleteness) et écrit un bilan JSON.
// C'est LE contrôle de correspondance formulaire ↔ base : le score lit
// exactement les champs que les écrans exigent.
// Inactive sans PROBE_COMPLETENESS=1. PROBE_FLEET : répertoire des fiches
// (défaut : scripts/audit/fleet, rempli par dump-fleet + split-fleet).
import { it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { evaluateAircraft } from '../aircraftCompleteness';

const FLEET = process.env.PROBE_FLEET || 'D:/Applicator/alflight/scripts/audit/fleet';
const OUT = 'D:/Applicator/alflight/scripts/audit';

it.skipIf(!process.env.PROBE_COMPLETENESS)('sonde complétude', () => {
  const bilan = [];
  for (const f of fs.readdirSync(FLEET).filter((x) => x.endsWith('.json'))) {
    const a = JSON.parse(fs.readFileSync(path.join(FLEET, f), 'utf8'));
    const d = a.aircraft_data || a;
    const r = evaluateAircraft(d);
    const manquants = r.criticalMissing || [];
    bilan.push({
      registration: a.registration,
      score: r.percentage,
      critiquesManquants: manquants.map((m) => m.label),
    });
  }
  fs.writeFileSync(path.join(OUT, 'completeness-live.json'), JSON.stringify(bilan, null, 1));
  // Sortie lisible dans le journal vitest.
  for (const b of bilan) {
    console.log(
      `${String(b.registration).padEnd(9)} score ${String(b.score).padStart(3)}%` +
      (b.critiquesManquants.length ? ` — CRITIQUES manquants : ${b.critiquesManquants.join(' · ')}` : ' — complet (critiques)')
    );
  }
});
