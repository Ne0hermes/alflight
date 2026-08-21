// Re-vérification sur données RÉELLES (fleet-live.json) des points traités aujourd'hui sur des copies périmées.
import fs from 'node:fs';
const live = JSON.parse(fs.readFileSync('C:/Users/neohe/AppData/Local/Temp/claude/D--Applicator/b9873912-3901-434f-8efc-9ca9fccee018/scratchpad/fleet-live.json', 'utf8'));
const get = r => { const a = live.find(x => x.registration === r); return { a, d: a?.aircraft_data || {} }; };
const cell = (d, ti, alt, t) => { const row = (d.advancedPerformance?.tables?.[ti]?.data || []).find(x => +x.Altitude === alt && +x.Temperature === t); return row ? row.value : '(absente)'; };
// ── F-HSTR ──
{ const { a, d } = get('F-HSTR'); console.log(`=== F-HSTR (updated ${a.updated_at})`);
  const checks = [['01', 17, 6000, 10, 40], ['02', 17, 9000, 40, 110], ['03', 24, 8000, 40, 144], ['09a', 28, 6000, 10, 8830], ['09b', 28, 5000, 10, 700], ['10', 12, 10000, 20, 566], ['11', 13, 8000, 40, 750], ['12', 25, 9000, 20, 4000], ['13', 27, 8000, 20, 1070], ['14', 6, 12000, 0, 656], ['15', 7, 12000, 30, 835], ['16', 33, 8000, 40, 252], ['17', 35, 12000, -20, 700]];
  for (const [id, ti, alt, t, bad] of checks) { const v = cell(d, ti, alt, t); console.log(`  -${id} table[${ti}] (${alt} ft, ${t} °C) : ${v} ${+v === bad ? '⚠ TOUJOURS la valeur aberrante' : '→ corrigé (était ' + bad + ')'}`); }
  const tk = (d.additionalFuelTanks || [])[0] || {};
  console.log(`  -04 réservoir : total=${tk.totalCapacity} utilisable=${tk.usableCapacity} (capacity=${tk.capacity}) | racine cap=${d.fuelCapacity} usable=${d.fuelUsableCapacity}`);
  console.log(`  -05 maxBaggageTotalMass=${d.maxBaggageTotalMass} | -07 maxBaggageWeight=${d.maxBaggageWeight} | -08 maxAuxiliaryWeight=${d.maxAuxiliaryWeight} | compartiments=${JSON.stringify((d.baggageCompartments || []).map(c => [c.name, c.maxWeight, c.arm]))}`);
  console.log(`  -06 cgLimits racine=${JSON.stringify(d.cgLimits)} wb.aft=${d.weightBalance?.cgLimits?.aft} env.aft=${d.cgEnvelope?.aftCG}`);
  console.log(`  -19 bypassed=${JSON.stringify(d.bypassedFields)} | -20 corrections=${JSON.stringify((d.performanceCorrections || []).map(c => [c.type, c.mode, c.value, c.appliesTo]))}`);
  const go = (d.advancedPerformance?.tables || []).slice(8, 12).map(tb => [...new Set((tb.data || []).filter(r => +r.Altitude === 6000).map(r => r.Temperature))].join('/')); console.log(`  -18 go_around 6000 ft températures : ${go.join(' | ')}`);
}
// ── F-GUVV ──
{ const { a, d } = get('F-GUVV'); console.log(`=== F-GUVV (updated ${a.updated_at})`);
  (d.performanceModels || []).forEach((m, i) => { const gs = m.data?.graphs || []; const p = gs.find(g => (g.role || 'primary') === 'primary'); const wind = gs.find(g => g.isWindRelated); console.log(`  [${i}] ${m.name} | primaire=${p?.name} (X=${p?.axes?.xAxis?.title}) | vent: ${(wind?.curves || []).filter(c => c.windDirection === 'tailwind').length} tailwind / ${(wind?.curves || []).filter(c => c.windDirection === 'headwind').length} headwind | links=${gs.map(g => (g.linkedTo || []).length).join(',')}`); });
  console.log(`  -04 cgLimits racine=${JSON.stringify(d.cgLimits)} env: fwd=${JSON.stringify((d.cgEnvelope?.forwardPoints || []).map(p => p.cg))} aft=${d.cgEnvelope?.aftCG}`);
}
// ── F-GOFP ──
{ const { a, d } = get('F-GOFP'); console.log(`=== F-GOFP (updated ${a.updated_at})`);
  console.log(`  fuelCapacity=${d.fuelCapacity} usable=${d.fuelUsableCapacity} | arms=${JSON.stringify(d.arms)} | maxBaggage=${d.maxBaggageWeight}/${d.maxAuxiliaryWeight} | emptyWeight=${d.emptyWeight} | weighing=${JSON.stringify(d.weighingReport ? { date: d.weighingReport.certificationDate, ew: d.weighingReport.emptyWeight } : null)}`);
}
// ── F-GIEA ──
{ const { a, d } = get('F-GIEA'); console.log(`=== F-GIEA (updated ${a.updated_at})`);
  console.log(`  vso=${d.speeds?.vso} vs1=${d.speeds?.vs1} vsTO=${d.speeds?.vsTO} vr=${d.speeds?.vr} initialClimb=${d.speeds?.initialClimb} | maxBaggage=${d.maxBaggageWeight} arms.baggageAft=${d.arms?.baggageAft} | windLimits=${JSON.stringify(d.windLimits?.limits)} | minTOW racine=${d.minTakeoffWeight} | bypassed=${JSON.stringify(d.bypassedFields)} | modèles=${(d.performanceModels || []).map(m => m.name).join(' ; ')}`);
}
