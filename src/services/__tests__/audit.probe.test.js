// Sonde d'audit RÉUTILISABLE : évalue tous les modèles d'abaques d'un avion
// avec le moteur de préparation de vol (adaptateur réel) sur un jeu de
// conditions standard, et écrit scripts/audit/probe-<REG>.json.
// Inactive sans PROBE_REG (ou PROBE_REG=ALL pour toute la flotte).
import { it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { evaluateAbacWithAtelierEngine } from '../atelierCascadeAdapter';
const FLEET = 'C:/Users/neohe/AppData/Local/Temp/claude/D--Applicator/b9873912-3901-434f-8efc-9ca9fccee018/scratchpad/fleet';
const OUT = 'D:/Applicator/alflight/scripts/audit';
const COND = [
  { label: '15 °C / 500 ft / vent 0', temperature: 15, pressure_altitude: 500, wind: 0 },
  { label: '15 °C / 500 ft / vent +8', temperature: 15, pressure_altitude: 500, wind: 8 },
  { label: '15 °C / 500 ft / vent −5', temperature: 15, pressure_altitude: 500, wind: -5 },
  { label: '30 °C / 2500 ft / vent 0', temperature: 30, pressure_altitude: 2500, wind: 0 },
  { label: '0 °C / 0 ft / vent 0', temperature: 0, pressure_altitude: 0, wind: 0 }
];
const reg = process.env.PROBE_REG;
it.skipIf(!reg)('sonde moteur', () => {
  const regs = reg === 'ALL' ? fs.readdirSync(FLEET).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')) : [reg];
  for (const r of regs) {
    const a = JSON.parse(fs.readFileSync(path.join(FLEET, r + '.json'), 'utf8'));
    const d = a.aircraft_data || a;
    const mass = Number(d.weights?.mtow || d.maxTakeoffWeight || d.mtow) || 1000;
    const out = (d.performanceModels || []).map((m, i) => ({
      index: i, name: m.name, plancheType: m.data?.metadata?.plancheType || null,
      graphs: (m.data?.graphs || []).map(g => ({ name: g.name, role: g.role || 'primary', op: g.operationId || null, x: g.axes?.xAxis?.title, fam: g.familyAxisVariable || null, readout: g.readoutAxis || 'y', curves: (g.curves || []).length, linkedTo: (g.linkedTo || []).length })),
      referenceCases: (m.data?.metadata?.referenceCases || []).length,
      runs: COND.map(c => {
        const rr = evaluateAbacWithAtelierEngine(m.data, { temperature: c.temperature, pressure_altitude: c.pressure_altitude, mass, wind: c.wind });
        return { cond: c.label, chain: (rr.steps || []).map(s => s.graphName).join(' > '), value: rr.finalValue ?? null, unit: rr.outputUnit || null, error: rr.error || null, missing: rr.missing || null };
      })
    }));
    fs.writeFileSync(path.join(OUT, `probe-${r}.json`), JSON.stringify({ registration: r, model: d.model, mass, models: out }, null, 1));
  }
});
