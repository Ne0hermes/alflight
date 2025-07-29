import React from 'react';
import { useFlightSystem } from '@context/FlightSystemContext';
import { LoadInput } from '../../../components/ui/LoadInput';
import { FUEL_DENSITIES } from '../../../utils/constants';

// Styles constants
const S = {
  box: { padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', marginBottom: '12px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  h3: { fontSize: '18px', fontWeight: '600', color: '#1f2937', marginBottom: '16px' },
  h4: { fontSize: '16px', fontWeight: '600', marginBottom: '12px' },
  h5: { fontSize: '13px', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' },
  text: { fontSize: '13px', color: '#6b7280' },
  val: { fontWeight: '500', color: '#374151' },
  moment: { fontWeight: '600', color: '#059669' },
  p0: { margin: '0' },
  p4: { margin: '0 0 4px 0' },
  p6: { margin: '6px 0 0 0' },
  p8: { margin: '0 0 8px 0' },
  mt: m => ({ marginTop: m + 'px' }),
  info: { marginTop: '12px', padding: '8px', backgroundColor: '#e0f2fe', borderRadius: '4px', fontSize: '12px', color: '#0c4a6e' },
  alert: (bg, color, border) => ({ padding: '12px', backgroundColor: bg, color, borderRadius: '6px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', ...(border && { border: `1px solid ${border}` }) }),
  card: (bg, border) => ({ padding: '12px', backgroundColor: bg, borderRadius: '6px', border: `2px solid ${border}` }),
  dot: color => ({ width: '12px', height: '12px', backgroundColor: color, borderRadius: '50%' })
};

export const WeightBalanceModule = () => {
  const { selectedAircraft: ac, loads, setLoads, navigationResults, currentCalculation: calc, fobFuel, fuelData } = useFlightSystem();
  
  // Helpers
  const calcMoment = (mass, arm) => (mass * arm).toFixed(1);
  const fuelDensity = ac ? FUEL_DENSITIES[ac.fuelType] : 0;
  const wb = ac?.weightBalance;
  
  // Total moment calculation
  const totalMoment = ac ? 
    ac.emptyWeight * wb.emptyWeightArm +
    loads.frontLeft * wb.frontLeftSeatArm +
    loads.frontRight * wb.frontRightSeatArm +
    loads.rearLeft * wb.rearLeftSeatArm +
    loads.rearRight * wb.rearRightSeatArm +
    loads.baggage * wb.baggageArm +
    loads.auxiliary * wb.auxiliaryArm +
    loads.fuel * wb.fuelArm : 0;

  // Common calculations
  const fuelBalance = fuelData ? Object.values(fuelData).reduce((sum, f) => sum + (f?.ltr || 0), 0) : 0;
  const remainingFuelL = Math.max(0, (fobFuel?.ltr || 0) - fuelBalance);
  const remainingFuelKg = remainingFuelL * fuelDensity;
  
  // Four scenarios calculations
  const scenarios = ac ? (() => {
    const fulltankFuel = ac.fuelCapacity * fuelDensity;
    const fulltankW = calc.totalWeight - loads.fuel + fulltankFuel;
    const fulltankM = totalMoment - loads.fuel * wb.fuelArm + fulltankFuel * wb.fuelArm;
    
    const zfwW = calc.totalWeight - loads.fuel;
    const zfwM = totalMoment - loads.fuel * wb.fuelArm;
    
    const ldgW = fobFuel?.ltr > 0 ? zfwW + remainingFuelKg : zfwW;
    const ldgM = fobFuel?.ltr > 0 ? zfwM + remainingFuelKg * wb.fuelArm : zfwM;
    
    return {
      fulltank: { w: fulltankW, cg: fulltankW > 0 ? fulltankM / fulltankW : 0, fuel: fulltankFuel },
      toCrm: { w: calc.totalWeight, cg: calc.cg, fuel: loads.fuel },
      landing: { w: ldgW, cg: ldgW > 0 ? ldgM / ldgW : 0, fuel: fobFuel?.ltr > 0 ? remainingFuelKg : 0 },
      zfw: { w: zfwW, cg: zfwW > 0 ? zfwM / zfwW : 0, fuel: 0 }
    };
  })() : null;

  // Forward limit calculation
  const getForwardLimit = weight => {
    if (!ac || !weight) return 0;
    const fwdVar = wb.cgLimits.forwardVariable;
    if (!fwdVar?.length) return wb.cgLimits.forward;
    
    const sorted = [...fwdVar].sort((a, b) => a.weight - b.weight);
    if (weight <= sorted[0].weight) return sorted[0].cg;
    if (weight >= sorted[sorted.length - 1].weight) return sorted[sorted.length - 1].cg;
    
    for (let i = 0; i < sorted.length - 1; i++) {
      if (weight >= sorted[i].weight && weight <= sorted[i + 1].weight) {
        const ratio = (weight - sorted[i].weight) / (sorted[i + 1].weight - sorted[i].weight);
        return sorted[i].cg + ratio * (sorted[i + 1].cg - sorted[i].cg);
      }
    }
    return wb.cgLimits.forward;
  };

  // Check limits
  const isWithinLimits = ac && calc.totalWeight && calc.cg ? 
    calc.cg >= getForwardLimit(calc.totalWeight) && 
    calc.cg <= wb.cgLimits.aft &&
    calc.totalWeight >= ac.minTakeoffWeight &&
    calc.totalWeight <= ac.maxTakeoffWeight : false;

  // LoadRow component
  const LoadRow = ({ label, value, onChange, max, armValue }) => (
    <div style={S.box}>
      <LoadInput label={label} value={value} onChange={onChange} max={max} />
      <div style={{ ...S.grid, marginTop: '8px', fontSize: '13px', color: '#6b7280' }}>
        <div style={S.row}>
          <span>📏 Bras de levier:</span>
          <span style={S.val}>{armValue?.toFixed(2) || '0.00'} m</span>
        </div>
        <div style={S.row}>
          <span>⚖️ Moment:</span>
          <span style={S.moment}>{calcMoment(value, armValue || 0)} kg.m</span>
        </div>
      </div>
    </div>
  );

  // Table row component
  const TR = ({ label, mass, arm, moment }) => (
    <tr>
      <td style={{ padding: '6px 0' }}>{label}</td>
      <td style={{ textAlign: 'right', padding: '6px 0' }}>{mass}</td>
      <td style={{ textAlign: 'right', padding: '6px 0' }}>{arm.toFixed(2)}</td>
      <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: '500' }}>{moment || calcMoment(mass, arm)}</td>
    </tr>
  );

  // Scenario card component
  const ScenarioCard = ({ color, bg, title, data }) => (
    <div style={S.card(bg, color)}>
      <h5 style={{ ...S.h5, color: color === '#3b82f6' ? '#1e40af' : color === '#10b981' ? '#065f46' : color === '#f59e0b' ? '#92400e' : '#dc2626' }}>
        <div style={S.dot(color)}></div>
        {title}
      </h5>
      <div style={{ fontSize: '12px', color: color === '#3b82f6' ? '#1e40af' : color === '#10b981' ? '#065f46' : color === '#f59e0b' ? '#92400e' : '#dc2626' }}>
        <p style={S.p4}>Masse: <strong>{data.w.toFixed(0)} kg</strong></p>
        <p style={S.p4}>CG: <strong>{data.cg.toFixed(2)} m</strong></p>
        <p style={S.p0}>Carburant: <strong>{data.fuel.toFixed(0)} kg</strong> {title === 'T/O CRM' ? '(CRM)' : title === 'FULLTANK' ? '' : title === 'LANDING' ? (fobFuel?.ltr > 0 ? '(CRM - Bilan)' : '(ZFW)') : '(Sans carburant)'}</p>
        {title === 'LANDING' && fobFuel?.ltr > 0 && remainingFuelL < (navigationResults?.regulationReserveLiters || 0) && (
          <p style={{ ...S.mt(4), color: '#dc2626', fontWeight: '600', fontSize: '11px' }}>⚠️ Sous réserve réglementaire</p>
        )}
      </div>
    </div>
  );

  // SVG helpers
  const scales = ac ? (() => {
    let cgMin = wb.cgLimits.forward, cgMax = wb.cgLimits.aft;
    wb.cgLimits.forwardVariable?.forEach(p => { cgMin = Math.min(cgMin, p.cg); cgMax = Math.max(cgMax, p.cg); });
    const cgRange = cgMax - cgMin;
    return {
      cgMin: (cgMin - cgRange * 0.1) * 1000,
      cgMax: (cgMax + cgRange * 0.1) * 1000,
      weightMin: ac.emptyWeight - 50,
      weightMax: ac.maxTakeoffWeight + 50
    };
  })() : null;

  const toSvgX = cg => scales ? 50 + (cg * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500 : 0;
  const toSvgY = w => scales ? 350 - (w - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300 : 0;

  const createEnvelopePoints = () => {
    if (!ac || !scales) return '';
    const hasVar = wb.cgLimits.forwardVariable?.length > 0;
    
    if (!hasVar) {
      const pts = [
        { w: ac.minTakeoffWeight, cg: wb.cgLimits.forward },
        { w: ac.maxTakeoffWeight, cg: wb.cgLimits.forward },
        { w: ac.maxTakeoffWeight, cg: wb.cgLimits.aft },
        { w: ac.minTakeoffWeight, cg: wb.cgLimits.aft }
      ];
      return pts.map(p => `${toSvgX(p.cg)},${toSvgY(p.w)}`).join(' ');
    }
    
    const fwdPts = [...wb.cgLimits.forwardVariable].sort((a, b) => a.weight - b.weight);
    if (fwdPts[0].weight > ac.minTakeoffWeight) fwdPts.unshift({ weight: ac.minTakeoffWeight, cg: wb.cgLimits.forward });
    if (fwdPts[fwdPts.length - 1].weight < ac.maxTakeoffWeight) fwdPts.push({ weight: ac.maxTakeoffWeight, cg: wb.cgLimits.forward });
    
    const envPts = [...fwdPts.map(p => ({ w: p.weight, cg: p.cg })), { w: ac.maxTakeoffWeight, cg: wb.cgLimits.aft }, { w: ac.minTakeoffWeight, cg: wb.cgLimits.aft }];
    return envPts.map(p => `${toSvgX(p.cg)},${toSvgY(p.w)}`).join(' ');
  };

  return (
    <div>
      {/* Chargement et moments */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={S.h3}>⚖️ Chargement et Moments</h3>
        <div>
          <div style={S.grid}>
            <LoadRow label="👨‍✈️ Siège avant gauche (Pilote)" value={loads.frontLeft} onChange={v => setLoads({...loads, frontLeft: v})} armValue={wb?.frontLeftSeatArm} />
            <LoadRow label="🧑‍🤝‍🧑 Siège avant droit" value={loads.frontRight} onChange={v => setLoads({...loads, frontRight: v})} armValue={wb?.frontRightSeatArm} />
          </div>
          <div style={S.grid}>
            <LoadRow label="👥 Siège arrière gauche" value={loads.rearLeft} onChange={v => setLoads({...loads, rearLeft: v})} armValue={wb?.rearLeftSeatArm} />
            <LoadRow label="👥 Siège arrière droit" value={loads.rearRight} onChange={v => setLoads({...loads, rearRight: v})} armValue={wb?.rearRightSeatArm} />
          </div>
          <div style={S.grid}>
            <LoadRow label={`🎒 Bagages (max ${ac?.maxBaggageWeight || 0} kg)`} value={loads.baggage} onChange={v => setLoads({...loads, baggage: v})} max={ac?.maxBaggageWeight} armValue={wb?.baggageArm} />
            <LoadRow label={`📦 Rangement annexe (max ${ac?.maxAuxiliaryWeight || 0} kg)`} value={loads.auxiliary} onChange={v => setLoads({...loads, auxiliary: v})} max={ac?.maxAuxiliaryWeight} armValue={wb?.auxiliaryArm} />
          </div>
        </div>
      </div>

      {/* Tableau récapitulatif */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px' }}>
          <h4 style={S.h4}>📐 Récapitulatif des moments</h4>
          <table style={{ width: '100%', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '8px 0', color: '#6b7280' }}>Élément</th>
                <th style={{ textAlign: 'right', padding: '8px 0', color: '#6b7280' }}>Masse (kg)</th>
                <th style={{ textAlign: 'right', padding: '8px 0', color: '#6b7280' }}>Bras (m)</th>
                <th style={{ textAlign: 'right', padding: '8px 0', color: '#6b7280' }}>Moment (kg.m)</th>
              </tr>
            </thead>
            <tbody>
              {ac && (
                <>
                  <TR label="Masse à vide" mass={ac.emptyWeight} arm={wb.emptyWeightArm} />
                  {loads.frontLeft > 0 && <TR label="Pilote" mass={loads.frontLeft} arm={wb.frontLeftSeatArm} />}
                  {loads.frontRight > 0 && <TR label="Passager avant" mass={loads.frontRight} arm={wb.frontRightSeatArm} />}
                  {loads.rearLeft > 0 && <TR label="Passager arrière gauche" mass={loads.rearLeft} arm={wb.rearLeftSeatArm} />}
                  {loads.rearRight > 0 && <TR label="Passager arrière droit" mass={loads.rearRight} arm={wb.rearRightSeatArm} />}
                  {loads.baggage > 0 && <TR label="Bagages" mass={loads.baggage} arm={wb.baggageArm} />}
                  {loads.auxiliary > 0 && <TR label="Rangement auxiliaire" mass={loads.auxiliary} arm={wb.auxiliaryArm} />}
                  <tr style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '6px 0', fontWeight: '600', color: '#059669' }}>Carburant CRM</td>
                    <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: '600', color: '#059669' }}>{loads.fuel}</td>
                    <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: '600', color: '#059669' }}>{wb.fuelArm.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: '600', color: '#059669' }}>{calcMoment(loads.fuel, wb.fuelArm)}</td>
                  </tr>
                </>
              )}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #374151' }}>
                <td style={{ padding: '8px 0', fontWeight: '600' }}>TOTAL</td>
                <td style={{ textAlign: 'right', padding: '8px 0', fontWeight: '600' }}>{calc.totalWeight?.toFixed(1) || 0}</td>
                <td style={{ textAlign: 'right', padding: '8px 0', fontWeight: '600' }}>{calc.cg?.toFixed(2) || 0}</td>
                <td style={{ textAlign: 'right', padding: '8px 0', fontWeight: '600', color: '#059669' }}>{totalMoment.toFixed(1)}</td>
              </tr>
              {fobFuel?.ltr > 0 && fuelData && scenarios && (
                <tr style={{ borderTop: '1px solid #e5e7eb', backgroundColor: '#fef3c7' }}>
                  <td style={{ padding: '8px 0', fontWeight: '600', color: '#92400e' }}>À L'ATTERRISSAGE</td>
                  <td style={{ textAlign: 'right', padding: '8px 0', fontWeight: '600', color: '#92400e' }}>{scenarios.landing.w.toFixed(1)}</td>
                  <td style={{ textAlign: 'right', padding: '8px 0', fontWeight: '600', color: '#92400e' }}>{scenarios.landing.cg.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', padding: '8px 0', fontWeight: '600', color: '#92400e' }}>{(scenarios.landing.w * scenarios.landing.cg).toFixed(1)}</td>
                </tr>
              )}
            </tfoot>
          </table>
          
          <div style={S.info}>
            <p style={{ ...S.p0, fontWeight: '600' }}>💡 Formule du Centre de Gravité:</p>
            <p style={S.p6}>CG = Moment total ÷ Masse totale = {totalMoment.toFixed(1)} ÷ {calc.totalWeight?.toFixed(1) || 1} = {calc.cg?.toFixed(3) || 0} m</p>
          </div>
        </div>
      </div>

      {/* Scénarios de centrage */}
      {ac && scenarios && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={S.h3}>
            🔄 Scénarios de centrage
            <span style={{ fontSize: '12px', fontWeight: '400', color: '#6b7280', marginLeft: '8px' }}>(Couleurs correspondantes au graphique)</span>
          </h3>
          
          <div style={S.alert('#ecfdf5', '#047857', '#10b981')}>
            <p style={{ ...S.p0, fontWeight: '600' }}>💡 CRM (Crew Resource Management) :</p>
            <p style={S.p6}>Carburant constaté à bord et validé par le commandant de bord.<br/>Cette valeur doit être saisie dans l'onglet "Bilan Carburant" → section "Carburant CRM".</p>
          </div>

          {fobFuel?.ltr > 0 ? (
            <div style={S.alert('#059669', 'white')}>
              <div style={{ fontSize: '24px' }}>✅</div>
              <div>
                <p style={{ ...S.p0, fontSize: '16px', fontWeight: '600' }}>CRM défini : {loads.fuel} kg</p>
                <p style={{ ...S.mt(4), fontSize: '13px', opacity: 0.9 }}>({(loads.fuel / fuelDensity).toFixed(1)} L) - Densité {ac.fuelType}: {fuelDensity}</p>
              </div>
            </div>
          ) : (
            <div style={S.alert('#fef3c7', '#92400e')}>
              <div style={{ fontSize: '24px' }}>⚠️</div>
              <div>
                <p style={{ ...S.p0, fontSize: '14px', fontWeight: '600' }}>CRM non défini</p>
                <p style={{ ...S.mt(4), fontSize: '13px' }}>Veuillez saisir le carburant CRM dans l'onglet "Bilan Carburant"</p>
              </div>
            </div>
          )}
          
          <div style={S.grid}>
            <ScenarioCard color="#3b82f6" bg="#dbeafe" title="FULLTANK" data={scenarios.fulltank} />
            <ScenarioCard color="#10b981" bg="#d1fae5" title="T/O CRM" data={scenarios.toCrm} />
            <ScenarioCard color="#f59e0b" bg="#fef3c7" title="LANDING" data={scenarios.landing} />
            <ScenarioCard color="#ef4444" bg="#fee2e2" title="ZFW" data={scenarios.zfw} />
          </div>
        </div>
      )}

      {/* Graphique */}
      <div style={S.mt(32)}>
        <h3 style={S.h3}>📈 Enveloppe de centrage</h3>
        
        <div style={{ padding: '16px', borderRadius: '8px', marginBottom: '16px', backgroundColor: isWithinLimits ? '#f0fdf4' : '#fef2f2', border: `2px solid ${isWithinLimits ? '#10b981' : '#ef4444'}` }}>
          <p style={{ fontSize: '18px', fontWeight: 'bold', margin: '0', color: isWithinLimits ? '#065f46' : '#dc2626' }}>
            {isWithinLimits ? '✅ Dans les limites' : '❌ Hors limites'}
          </p>
        </div>
        
        {ac && scales && scenarios ? (
          <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '24px' }}>
            <svg viewBox="0 0 600 400" style={{ width: '100%', maxWidth: '800px', height: 'auto', margin: '0 auto', display: 'block' }}>
              {/* Grille */}
              <defs>
                <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                  <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
                </pattern>
              </defs>
              <rect width="600" height="400" fill="url(#grid)" />
              
              {/* Axes */}
              <line x1="50" y1="350" x2="550" y2="350" stroke="#374151" strokeWidth="2" />
              <line x1="50" y1="50" x2="50" y2="350" stroke="#374151" strokeWidth="2" />
              <path d="M 545 345 L 550 350 L 545 355" fill="none" stroke="#374151" strokeWidth="2" />
              <path d="M 45 55 L 50 50 L 55 55" fill="none" stroke="#374151" strokeWidth="2" />
              
              {/* Labels axes */}
              <text x="300" y="390" textAnchor="middle" fontSize="12" fill="#374151">Centre de Gravité (mm)</text>
              <text x="25" y="200" textAnchor="middle" fontSize="12" fill="#374151" transform="rotate(-90 25 200)">Masse (kg)</text>
              
              {/* Échelles */}
              {[0, 1, 2, 3, 4].map(i => {
                const cgVal = scales.cgMin + (scales.cgMax - scales.cgMin) * i / 4;
                const wVal = scales.weightMin + (scales.weightMax - scales.weightMin) * i / 4;
                const x = 50 + 500 * i / 4;
                const y = 350 - 300 * i / 4;
                return (
                  <g key={i}>
                    <line x1={x} y1="345" x2={x} y2="355" stroke="#374151" strokeWidth="1" />
                    <text x={x} y="370" textAnchor="middle" fontSize="10" fill="#6b7280">{cgVal.toFixed(0)}</text>
                    <line x1="45" y1={y} x2="55" y2={y} stroke="#374151" strokeWidth="1" />
                    <text x="35" y={y + 5} textAnchor="end" fontSize="10" fill="#6b7280">{wVal.toFixed(0)}</text>
                  </g>
                );
              })}
              
              {/* Enveloppe */}
              <polygon points={createEnvelopePoints()} fill="#dbeafe" fillOpacity="0.5" stroke="#3b82f6" strokeWidth="2" />
              
              {/* Lignes limites */}
              <line x1="50" y1={toSvgY(ac.maxTakeoffWeight)} x2="550" y2={toSvgY(ac.maxTakeoffWeight)} stroke="#8b5cf6" strokeWidth="2" strokeDasharray="5,5" />
              <text x="555" y={toSvgY(ac.maxTakeoffWeight) + 5} fontSize="10" fill="#8b5cf6">MTOW</text>
              
              {ac.maxLandingWeight !== ac.maxTakeoffWeight && (
                <>
                  <line x1="50" y1={toSvgY(ac.maxLandingWeight)} x2="550" y2={toSvgY(ac.maxLandingWeight)} stroke="#06b6d4" strokeWidth="2" strokeDasharray="5,5" />
                  <text x="555" y={toSvgY(ac.maxLandingWeight) + 5} fontSize="10" fill="#06b6d4">MLW</text>
                </>
              )}
              
              {/* Points et lignes de connexion */}
              <g>
                <polyline points={`${toSvgX(scenarios.fulltank.cg)},${toSvgY(scenarios.fulltank.w)} ${toSvgX(scenarios.toCrm.cg)},${toSvgY(scenarios.toCrm.w)} ${toSvgX(scenarios.landing.cg)},${toSvgY(scenarios.landing.w)} ${toSvgX(scenarios.zfw.cg)},${toSvgY(scenarios.zfw.w)}`} fill="none" stroke="#6b7280" strokeWidth="2" strokeDasharray="5,5" opacity="0.6" />
                
                {/* Points avec labels */}
                {[
                  { s: scenarios.fulltank, color: '#3b82f6', label: 'FULLTANK', xOff: -40, yOff: -30 },
                  { s: scenarios.toCrm, color: '#10b981', label: 'T/O CRM', xOff: 40, yOff: -30 },
                  { s: scenarios.zfw, color: '#ef4444', label: 'ZFW', xOff: -40, yOff: 30 },
                  { s: scenarios.landing, color: '#f59e0b', label: 'LANDING', xOff: 40, yOff: 30 }
                ].map(({ s, color, label, xOff, yOff }) => {
                  const x = toSvgX(s.cg), y = toSvgY(s.w);
                  return (
                    <g key={label}>
                      <circle cx={x} cy={y} r="6" fill={color} stroke="white" strokeWidth="2" />
                      <line x1={x} y1={y} x2={x + xOff} y2={y + yOff} stroke={color} strokeWidth="1" />
                      <text x={x + xOff + (xOff > 0 ? 5 : -5)} y={y + yOff + 5} textAnchor={xOff > 0 ? "start" : "end"} fontSize="10" fill={color} fontWeight="600">{label}</text>
                      <text x={x + xOff + (xOff > 0 ? 5 : -5)} y={y + yOff + 15} textAnchor={xOff > 0 ? "start" : "end"} fontSize="9" fill="#6b7280">{s.w.toFixed(0)}kg / {(s.cg * 1000).toFixed(0)}mm</text>
                    </g>
                  );
                })}
              </g>
              
              <text x="300" y="25" textAnchor="middle" fontSize="14" fontWeight="600" fill="#1f2937">Diagramme de Masse et Centrage</text>
              <text x="300" y="45" textAnchor="middle" fontSize="11" fill="#6b7280">{ac.registration} - {ac.model}</text>
            </svg>
            
            {/* Guide */}
            <div style={{ ...S.mt(16), padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              <h4 style={{ ...S.h4, color: '#1f2937' }}>📘 Guide de lecture du diagramme</h4>
              <div style={S.text}>
                {[
                  { color: '#3b82f6', label: 'point bleu (FULLTANK)', desc: 'représente la configuration avec réservoirs pleins' },
                  { color: '#10b981', label: 'point vert (T/O CRM)', desc: 'représente la masse et centrage au décollage avec le carburant CRM' },
                  { color: '#f59e0b', label: 'point orange (LANDING)', desc: 'représente la position prévue à l\'atterrissage' },
                  { color: '#ef4444', label: 'point rouge (ZFW)', desc: 'représente la configuration sans carburant (Zero Fuel Weight)' },
                  { color: '#8b5cf6', label: 'ligne horizontale violette pointillée', desc: 'indique la masse maximale au décollage (MTOW)' }
                ].map(({ color, label, desc }) => (
                  <p key={label} style={S.p8}>• Le <span style={{ color, fontWeight: '600' }}>{label}</span> {desc}</p>
                ))}
                {ac.maxLandingWeight !== ac.maxTakeoffWeight && (
                  <p style={S.p0}>• La <span style={{ color: '#06b6d4', fontWeight: '600' }}>ligne horizontale cyan pointillée</span> indique la masse maximale à l'atterrissage (MLW)</p>
                )}
              </div>
            </div>
            
            {/* Info carburant */}
            <div style={{ ...S.mt(16), padding: '16px', backgroundColor: '#e0f2fe', borderRadius: '8px' }}>
              <h4 style={{ ...S.h4, color: '#0c4a6e' }}>💡 Information carburant</h4>
              <div style={{ fontSize: '13px', color: '#0c4a6e' }}>
                <p style={S.p8}>• Densité {ac.fuelType} : {fuelDensity} kg/L</p>
                <p style={S.p8}>• Capacité totale : {ac.fuelCapacity} L = {(ac.fuelCapacity * fuelDensity).toFixed(1)} kg</p>
                <p style={S.p8}>• Le bras de levier du carburant est constant : {wb.fuelArm} m</p>
                
                {fobFuel?.ltr > 0 && fuelData && (
                  <div style={{ ...S.mt(12), padding: '8px', backgroundColor: '#0284c7', color: 'white', borderRadius: '4px', fontWeight: '600' }}>
                    <p style={S.p0}>📊 Calcul carburant atterrissage :</p>
                    <p style={{ ...S.mt(4), fontWeight: '400' }}>
                      CRM: {fobFuel.ltr.toFixed(1)} L - Bilan total: {fuelBalance.toFixed(1)} L = Restant: {remainingFuelL.toFixed(1)} L
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '32px', backgroundColor: '#f3f4f6', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ color: '#6b7280' }}>Sélectionnez un avion pour afficher l'enveloppe de centrage</p>
          </div>
        )}
      </div>
    </div>
  );
};