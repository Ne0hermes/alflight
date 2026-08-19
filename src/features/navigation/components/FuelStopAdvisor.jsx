// src/features/navigation/components/FuelStopAdvisor.jsx
// 🔧 LOT 8 — Alerte « autonomie insuffisante » + suggestions d'escale
// avitaillement, affichées à l'étape Trajet dès que le carburant minimal
// (trip + réserve finale réglementaire) dépasse la capacité de l'avion.
// Une escale insérée (waypoint fuelStop) découpe le calcul par tronçon :
// l'alerte disparaît quand chaque tronçon tient dans les réservoirs.
import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Fuel, CheckCircle } from 'lucide-react';
import { useNavigation, useFuel } from '@core/contexts';
import { getCruiseSpeedKt, getFuelConsumptionLph, getFuelUsableCapacityLtr } from '@utils/aircraftPerf';
import { analyzeFuelAutonomy, findFuelStopCandidates, assessRouteFuelWaypoint } from '../utils/fuelStopPlanner';

const bannerBase = {
  padding: '14px 16px',
  marginTop: '12px',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--fs-body)',
  lineHeight: 1.5
};

export const FuelStopAdvisor = ({ selectedAircraft, navigationResults }) => {
  const { waypoints, setWaypoints } = useNavigation();
  // Revue cran 3 : mêmes postes que le bilan par tronçon (roulage/dégagement
  // si déjà calculés — 0 sinon, honnête à l'étape Trajet)
  const { fuelData } = useFuel();

  // Base d'aérodromes (chargée uniquement quand l'alerte se déclenche)
  const [airports, setAirports] = useState(null); // null = pas encore chargé
  const [loadingAirports, setLoadingAirports] = useState(false);

  const cruiseSpeedKt = getCruiseSpeedKt(selectedAircraft);
  const fuelConsumptionLph = getFuelConsumptionLph(selectedAircraft);
  // ⛽ Borne d'escale = carburant UTILISABLE : la capacité physique pouvait
  // masquer le besoin d'une escale (l'inutilisable ne brûle pas).
  const capacityLtr = getFuelUsableCapacityLtr(selectedAircraft);
  const reserveLiters = navigationResults?.regulationReserveLiters || 0;

  const analysis = useMemo(() => analyzeFuelAutonomy({
    waypoints,
    cruiseSpeedKt,
    fuelConsumptionLph,
    reserveLiters,
    capacityLtr,
    taxiLtr: fuelData?.roulage?.ltr || 0,
    alternateLtr: fuelData?.alternate?.ltr || 0
  }), [waypoints, cruiseSpeedKt, fuelConsumptionLph, reserveLiters, capacityLtr, fuelData]);

  // Charger la base d'aérodromes à la première alerte (même patron que le
  // module Déroutements : store OpenAIP, repli aeroDataProvider).
  // ⚠️ REVUE LOT 8 : loadingAirports NI dans la garde NI dans les deps — il
  // re-déclenchait l'effet à mi-chargement et le cleanup annulait le fetch
  // (spinner éternel). Les deps restantes suffisent comme garde de réentrance.
  useEffect(() => {
    if (analysis.status !== 'insufficient' || airports !== null) return;
    let cancelled = false;
    setLoadingAirports(true);
    (async () => {
      try {
        const { useOpenAIPStore } = await import('@core/stores/openAIPStore');
        let list = useOpenAIPStore.getState().airports || [];
        if (list.length === 0) {
          try {
            await useOpenAIPStore.getState().loadAirports('FR');
            list = useOpenAIPStore.getState().airports || [];
          } catch { /* repli ci-dessous */ }
        }
        if (list.length === 0) {
          const { aeroDataProvider } = await import('@core/data');
          const staticAirports = await aeroDataProvider.getAirfields({ country: 'FR' });
          list = (staticAirports || []).map(apt => ({
            ...apt,
            position: apt.coordinates || { lat: apt.lat, lon: apt.lon ?? apt.lng }
          }));
        }

        // 🔧 REVUE LOT 8 (critique) — les aérodromes du provider GeoJSON n'ont
        // PAS de champ services.fuel : le flag AVITAILLEMENT vient de la couche
        // services SIA (aerodrome_services.json, entrées type FUEL explicites).
        // Sans cet enrichissement, AUCUNE suggestion ne sortait jamais.
        // A5 : seul un enregistrement FUEL explicite produit fuel:true ; en cas
        // d'échec de chargement, pas d'enrichissement (fail-closed : 0 suggestion).
        try {
          const { geoJSONDataService } = await import('../services/GeoJSONDataService');
          const services = await geoJSONDataService.getAerodromeServices();
          const fuelIcaos = new Set(
            (services || [])
              .filter(s => (s?.type || '').toUpperCase() === 'FUEL')
              .map(s => (s.aerodrome_icao || '').toUpperCase())
          );
          list = list.map(apt => (apt.services?.fuel === true || apt.fuel === true)
            ? apt
            : (fuelIcaos.has((apt.icao || '').toUpperCase())
              ? { ...apt, services: { ...(apt.services || {}), fuel: true } }
              : apt));
        } catch (e) {
          console.warn('⚠️ [FuelStopAdvisor] Services SIA indisponibles (pas d\'enrichissement FUEL) :', e?.message);
        }

        if (!cancelled) setAirports(list.filter(a => a.icao && a.icao.startsWith('LF')));
      } catch (e) {
        console.warn('⚠️ [FuelStopAdvisor] Chargement aérodromes impossible :', e?.message);
        if (!cancelled) setAirports([]);
      } finally {
        if (!cancelled) setLoadingAirports(false);
      }
    })();
    return () => { cancelled = true; };
  }, [analysis.status, airports]);

  const candidates = useMemo(() => {
    if (analysis.status !== 'insufficient' || !airports || !analysis.worstLeg) return [];
    // routeWaypoints : exclusion sur la ROUTE ENTIÈRE (le départ/arrivée du vol
    // ne doit jamais être proposé comme escale, même hors du tronçon en défaut)
    return findFuelStopCandidates({ airports, leg: analysis.worstLeg, routeWaypoints: waypoints });
  }, [analysis, airports, waypoints]);

  // 🔧 LOT 10-C — aérodromes DÉJÀ DANS la navigation avec avitaillement (SIA) :
  // proposer de les MARQUER comme escale (sans insérer de nouveau point), avec
  // les litres minimum à avitailler compte tenu de la consommation pour y
  // arriver (hypothèse : réservoirs pleins au départ).
  const routeFuelOptions = useMemo(() => {
    if (analysis.status !== 'insufficient' || !airports) return [];
    const fuelSet = new Set(
      airports
        .filter(a => a.services?.fuel === true || a.fuel === true)
        .map(a => (a.icao || '').toUpperCase())
    );
    const valid = waypoints.filter(wp => Number.isFinite(wp?.lat) && Number.isFinite(wp?.lon));
    return valid
      .slice(1, -1) // points intermédiaires uniquement (ni départ ni arrivée)
      .filter(wp => {
        const icao = String(wp.icao || wp.name || '').toUpperCase();
        return /^[A-Z]{4}$/.test(icao) && fuelSet.has(icao) && wp.fuelStop !== true;
      })
      .map(wp => ({
        wp,
        icao: String(wp.icao || wp.name).toUpperCase(),
        assessment: assessRouteFuelWaypoint({
          waypoints,
          waypoint: wp,
          cruiseSpeedKt,
          fuelConsumptionLph,
          reserveLiters,
          capacityLtr,
          taxiLtr: fuelData?.roulage?.ltr || 0,
          alternateLtr: fuelData?.alternate?.ltr || 0
        })
      }))
      .filter(o => o.assessment != null);
  }, [analysis.status, airports, waypoints, cruiseSpeedKt, fuelConsumptionLph, reserveLiters, capacityLtr, fuelData]);

  const markAsFuelStop = (wp) => {
    setWaypoints(waypoints.map(w => (w === wp ? { ...w, fuelStop: true } : w)));
    console.log(`⛽ [FuelStopAdvisor] ${wp.icao || wp.name} marqué comme escale avitaillement`);
  };

  const insertStop = (candidate) => {
    const stopWaypoint = {
      id: Date.now(),
      name: candidate.icao,
      icao: candidate.icao,
      type: 'waypoint',
      fuelStop: true,
      // Inséré PAR l'advisor (≠ waypoint existant marqué) : « Retirer »
      // supprime le point ; un point marqué est seulement dé-marqué
      fuelStopInserted: true,
      lat: candidate.position.lat,
      lon: candidate.position.lon,
      elevation: candidate.elevation ?? null,
      airportName: candidate.name
    };
    // ⚠️ insertAfterGlobalIndex est calculé sur les waypoints VALIDES (mêmes
    // objets) : retrouver l'index dans la liste complète via la référence
    const validWaypoints = waypoints.filter(wp => Number.isFinite(wp?.lat) && Number.isFinite(wp?.lon));
    const anchor = validWaypoints[candidate.insertAfterGlobalIndex];
    const anchorIdx = waypoints.indexOf(anchor);
    const insertAt = anchorIdx >= 0 ? anchorIdx + 1 : waypoints.length - 1;
    const next = [...waypoints];
    next.splice(insertAt, 0, stopWaypoint);
    setWaypoints(next);
    console.log(`⛽ [FuelStopAdvisor] Escale ${candidate.icao} insérée en position ${insertAt}`);
  };

  const removeStop = (wp) => {
    // Point inséré par l'advisor → suppression ; aérodrome du trajet marqué
    // comme escale → simple dé-marquage (le waypoint reste dans la route)
    if (wp.fuelStopInserted === true) {
      setWaypoints(waypoints.filter(w => w !== wp));
    } else {
      setWaypoints(waypoints.map(w => (w === wp ? { ...w, fuelStop: false } : w)));
    }
  };

  if (analysis.status === 'no-data') return null;

  const fmtL = (v) => `${Math.round(v)} L`;
  const fuelStops = waypoints.filter(wp => wp?.fuelStop === true);

  // ── Tout tient : confirmation compacte UNIQUEMENT si une escale existe ────
  if (analysis.status === 'ok') {
    if (fuelStops.length === 0) return null;
    const worstFitting = analysis.legs.reduce((a, b) => (a.requiredLtr >= b.requiredLtr ? a : b));
    return (
      <div style={{
        ...bannerBase,
        backgroundColor: 'var(--bg-overlay)',
        border: '1px solid var(--border-subtle)',
        borderLeft: '4px solid #22c55e'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--text-primary)' }}>
          <CheckCircle size={18} color="#22c55e" />
          Escale avitaillement : {fuelStops.map(wp => wp.icao || wp.name).join(', ')}
        </div>
        <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Chaque tronçon tient dans les réservoirs — tronçon le plus gourmand :
          {' '}{fmtL(worstFitting.requiredLtr)} (réserve finale incluse) pour {fmtL(analysis.capacityLtr)} embarquables.
          {' '}Pensez à prévoir le plein complet à l'escale.
          {fuelStops.map((wp, idx) => (
            <button
              key={wp.id ?? wp.icao ?? idx}
              onClick={() => removeStop(wp)}
              style={{
                marginLeft: '10px', padding: '2px 10px', fontSize: 'var(--fs-caption)',
                backgroundColor: 'transparent', color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', cursor: 'pointer'
              }}
            >
              Retirer l'escale {wp.icao || wp.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Autonomie insuffisante : alerte + suggestions ─────────────────────────
  const worst = analysis.worstLeg;
  return (
    <div style={{
      ...bannerBase,
      backgroundColor: 'rgba(220, 38, 38, 0.08)',
      border: '2px solid var(--color-red-critical)',
      borderLeft: '6px solid var(--color-red-critical)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--color-red-critical)' }}>
        <AlertTriangle size={20} />
        Autonomie insuffisante pour ce trajet
      </div>
      <div style={{ color: 'var(--text-primary)', marginTop: '6px' }}>
        Le tronçon {worst.from?.name || worst.from?.icao} → {worst.to?.name || worst.to?.icao}
        {' '}demande au minimum <strong>{fmtL(worst.requiredLtr)}</strong>
        {/* Décomposition = mêmes postes que requiredLtr (revue LOT 10 : la
            contingence — et roulage/dégagement s'ils sont renseignés — sont
            DANS le total ; l'ancien libellé « hors roulage/déroutement »
            était devenu faux et la somme affichée n'additionnait plus) */}
        {' '}({fmtL(worst.tripLtr)} de vol + {fmtL(worst.contingencyLtr)} de contingence
        {worst.taxiLtr > 0 && <> + {fmtL(worst.taxiLtr)} de roulage</>}
        {worst.alternateLtr > 0 && <> + {fmtL(worst.alternateLtr)} de dégagement</>}
        {' '}+ {fmtL(reserveLiters)} de réserve finale, hors montée),
        {' '}pour <strong>{fmtL(analysis.capacityLtr)}</strong> embarquables au maximum.
        {' '}Ajoutez une <strong>escale avitaillement</strong> sur la trajectoire pour refaire le plein.
      </div>

      {/* 🔧 LOT 10-C — priorité aux aérodromes DÉJÀ dans la navigation */}
      {routeFuelOptions.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
            <Fuel size={16} color="#22c55e" />
            Un aérodrome de votre navigation permet l'avitaillement
          </div>
          {routeFuelOptions.map(({ wp, icao, assessment }) => (
            <div
              key={icao}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                padding: '8px 10px', marginBottom: '6px', flexWrap: 'wrap',
                backgroundColor: 'var(--bg-surface)', border: '1px solid #22c55e',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <div style={{ minWidth: 0 }}>
                <strong>{icao}</strong>
                <span style={{ color: 'var(--text-secondary)' }}> — déjà sur votre trajet</span>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-tertiary)' }}>
                  {assessment.reachable && assessment.restFits
                    ? <>≈ {Math.ceil(assessment.consumedToWpLtr)} L consommés pour l'atteindre
                      (depuis le dernier plein) · en partant réservoirs pleins, restant ≈ {Math.floor(assessment.remainingAtWpLtr)} L
                      → <strong style={{ color: 'var(--text-primary)' }}>avitaillez au moins {Math.ceil(assessment.minRefuelLtr)} L</strong> pour
                      finir le vol ({Math.ceil(assessment.requiredRestLtr)} L requis ensuite)</>
                    : assessment.reachable
                      ? <>⚠ même le plein complet ({Math.round(capacityLtr)} L) ne couvre pas la suite du vol
                        ({Math.ceil(assessment.requiredRestLtr)} L requis) — une escale supplémentaire reste nécessaire</>
                      : <>⚠ hors de portée même réservoirs pleins — une escale plus tôt reste nécessaire</>}
                </div>
              </div>
              {assessment.reachable && assessment.restFits && (
                <button
                  onClick={() => markAsFuelStop(wp)}
                  style={{
                    padding: '6px 14px', fontSize: 'var(--fs-caption)', fontWeight: 600,
                    color: '#ffffff', backgroundColor: '#22c55e',
                    border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', flexShrink: 0
                  }}
                >
                  ⛽ Marquer comme escale
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
          <Fuel size={16} color="var(--accent-primary)" />
          {routeFuelOptions.length > 0 ? 'Autres escales possibles (hors trajet, à moins de 15 NM de la route)' : 'Escales suggérées (avitaillement, à moins de 15 NM de la route)'}
        </div>

        {loadingAirports && (
          <p style={{ margin: 0, fontSize: 'var(--fs-caption)', color: 'var(--text-tertiary)' }}>
            Recherche d'aérodromes avitaillables le long de la route…
          </p>
        )}

        {!loadingAirports && airports !== null && candidates.length === 0 && (
          <p style={{ margin: 0, fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
            Aucun aérodrome avec avitaillement recensé à moins de 15 NM du milieu de ce tronçon.
            Ajoutez manuellement un waypoint vers un terrain avitaillé de votre connaissance,
            ou raccourcissez le trajet.
          </p>
        )}

        {candidates.map(c => (
          <div
            key={c.icao}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
              padding: '8px 10px', marginBottom: '6px', flexWrap: 'wrap',
              backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            <div style={{ minWidth: 0 }}>
              <strong>{c.icao}</strong>
              <span style={{ color: 'var(--text-secondary)' }}> — {c.name}</span>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-tertiary)' }}>
                ⛽ à {c.distToRouteNM.toFixed(1)} NM de la route · à {Math.round(c.fraction * 100)} % du tronçon
              </div>
            </div>
            <button
              onClick={() => insertStop(c)}
              style={{
                padding: '6px 14px', fontSize: 'var(--fs-caption)', fontWeight: 600,
                color: '#ffffff', backgroundColor: 'var(--accent-primary)',
                border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', flexShrink: 0
              }}
            >
              + Insérer comme escale
            </button>
          </div>
        ))}
      </div>

      <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-caption)', color: 'var(--text-tertiary)' }}>
        Estimation sans vent, hors montée : affinez au bilan carburant.
        Avitaillement recensé par le SIA — <strong>type de carburant non précisé</strong> (AVGAS/JetA1)
        ni horaires : vérifiez la VAC du terrain choisi ou téléphonez.
      </p>
    </div>
  );
};

export default FuelStopAdvisor;
