import React from 'react';
import { Plane, Navigation as NavigationIcon, Clock } from 'lucide-react';
import { theme } from '../../../styles/theme';
import VFRNavigationTable from '@features/navigation/components/VFRNavigationTable';
import { normalizeElevationToFeet } from '@utils/elevationUtils';

/* eslint-disable no-restricted-syntax -- ARTEFACT D'IMPRESSION (PDF).
   Ce composant est la SOURCE du PDF de plan de vol : il est capturé À L'ÉCRAN
   par html2canvas (FlightPlanWizard), donc le rendu doit rester CLAIR
   (fond blanc, texte sombre) INDÉPENDAMMENT du thème sombre de l'app.
   SUPERSEDED : html2canvas force data-theme="day-cockpit" (thème CLAIR) avant
   la capture, donc les var(--*) canoniques résolvent SOMBRE à l'écran et CLAIR
   dans le PDF automatiquement. Les couleurs sont désormais des var(--*).
   Charte respectée : accent = orange ALFlight, rouge = NO-GO (var canonique). */

// Palette d'IMPRESSION (feuille PDF) — source unique des couleurs de ce composant.
const PRINT = {
  accent: 'var(--accent-primary)',
  accentBg: 'var(--accent-soft)',
  ok: '#059669',   // vert GO/NO-GO sécurité — exception délibérée (couverte par l'eslint-disable du fichier)
  nogo: 'var(--color-red-critical)',
};

/**
 * Tableau récapitulatif pour le PDF
 * Format paysage - Affiche toutes les informations clés du vol
 */
export const FlightRecapTable = ({
  flightPlan,
  waypoints,
  selectedAircraft,
  aerodromeData,
  todCalculation,
  navigationResults,
  segmentAltitudes,
  setSegmentAltitude,
  departureTimeTheoretical,
  setDepartureTimeTheoretical,
  flightType,
  descentRate,
  setDescentRate,
  targetAltitude,
  setTargetAltitude,
  sunTimes,
  formatSunTime,
  onUpdate
}) => {
  // Récupérer les performances de l'avion
  const departurePerf = flightPlan?.performance?.departure;
  const arrivalPerf = flightPlan?.performance?.arrival;

  // Récupérer les aérodromes départ/arrivée depuis waypoints
  const departureWaypoint = waypoints?.find(wp => wp.type === 'departure');
  const arrivalWaypoint = waypoints?.find(wp => wp.type === 'arrival');

  // Récupérer les données AIXM pour départ et arrivée
  const departureAerodrome = aerodromeData?.find(ad => ad.icao === departureWaypoint?.icao);
  const arrivalAerodrome = aerodromeData?.find(ad => ad.icao === arrivalWaypoint?.icao);

  // Récupérer les alternates
  const alternates = flightPlan?.alternates || [];
  const alternateAerodromes = alternates.map(alt =>
    aerodromeData?.find(ad => ad.icao === alt.icao)
  ).filter(Boolean);

  /**
   * Extraire une fréquence d'un objet AIXM
   */
  const extractFrequency = (freqData) => {
    if (!freqData) return null;

    if (Array.isArray(freqData) && freqData.length > 0) {
      const firstItem = freqData[0];
      if (typeof firstItem === 'object' && firstItem !== null) {
        return firstItem.frequency || firstItem.freq || firstItem.value;
      }
      return firstItem;
    } else if (typeof freqData === 'object' && freqData !== null) {
      return freqData.frequency || freqData.freq || freqData.value;
    } else if (typeof freqData === 'string' || typeof freqData === 'number') {
      return freqData;
    }
    return null;
  };

  /**
   * Rendu d'une section aérodrome avec toutes les informations
   */
  const renderAerodromeSection = (aerodrome, performanceData, type = 'departure') => {
    if (!aerodrome || !aerodrome.runways || aerodrome.runways.length === 0) {
      return null;
    }

    // Titre de la section
    const sectionTitle = type === 'departure' ? 'DÉPART' :
      type === 'arrival' ? 'ARRIVÉE' :
        'DÉROUTEMENT';

    const titleColor = type === 'departure' ? PRINT.accent :
      type === 'arrival' ? PRINT.accent :
        PRINT.accent;

    // Extraire les fréquences
    const atisFreq = aerodrome.frequencies ? extractFrequency(aerodrome.frequencies.atis) : null;
    const twrFreq = aerodrome.frequencies ? extractFrequency(aerodrome.frequencies.twr) : null;
    const afisFreq = aerodrome.frequencies ? extractFrequency(aerodrome.frequencies.afis) : null;
    const gndFreq = aerodrome.frequencies ? extractFrequency(aerodrome.frequencies.gnd) : null;
    const appFreq = aerodrome.frequencies ? extractFrequency(aerodrome.frequencies.app) : null;

    // Téléphone
    const phone = aerodrome.phone || null;

    // Altitudes (élévation normalisée en pieds via util partagé — gère m→ft + variantes unit)
    const elevation = normalizeElevationToFeet(aerodrome.elevation, { context: `${aerodrome?.icao || 'aerodrome'} (recap)` });
    const tdpAlt = typeof aerodrome.circuitAltitude === 'object' ? aerodrome.circuitAltitude.value : aerodrome.circuitAltitude;
    const integrationAlt = typeof aerodrome.integrationAltitude === 'object' ? aerodrome.integrationAltitude.value : aerodrome.integrationAltitude;

    // Calculs des altitudes
    // Alt Sec = altitude de sécurité (élévation + 300 ft)
    const altSec = elevation ? elevation + 300 : null;
    // Vert T = utiliser integrationAltitude si disponible, sinon fallback TdP + 500 ft
    const vertT = integrationAlt || (tdpAlt ? tdpAlt + 500 : null);

    // Prendre les 2 premières pistes (généralement les pistes réciproques)
    const runways = aerodrome.runways.slice(0, 2);

    return (
      <div style={{
        marginBottom: '12px',
        pageBreakInside: 'avoid',
        border: '2px solid var(--border-subtle)',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-surface)'
      }}>
        {/* En-tête aérodrome */}
        <div style={{
          backgroundColor: titleColor,
          color: 'var(--color-white-soft)',
          padding: '6px 10px',
          fontWeight: '700',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <Plane size={14} />
          <span>{sectionTitle} - {aerodrome.icao}</span>
        </div>

        <div style={{ padding: '8px' }}>
          {/* Informations générales aérodrome */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px',
            marginBottom: '8px',
            fontSize: '9px',
            backgroundColor: 'var(--bg-overlay)',
            padding: '6px',
            borderRadius: '4px'
          }}>
            {/* ATIS */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>ATIS:</span>
              <span style={{ fontWeight: '700', color: atisFreq ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                {atisFreq ? `${atisFreq} MHz` : 'N/A'}
              </span>
            </div>

            {/* Tel tours */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>Tel tours:</span>
              <span style={{ fontWeight: '700', color: phone ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                {phone || 'N/A'}
              </span>
            </div>

            {/* Freq Utile */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>Freq Utile:</span>
              <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '8px' }}>
                {[
                  twrFreq ? `TWR: ${twrFreq}` : null,
                  afisFreq ? `AFIS: ${afisFreq}` : null,
                  gndFreq ? `GND: ${gndFreq}` : null,
                  appFreq ? `APP: ${appFreq}` : null
                ].filter(Boolean).join(' / ') || 'N/A'}
              </span>
            </div>

            {/* Altitude (terrain - élévation) */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>Altitude:</span>
              <span style={{ fontWeight: '700', color: elevation ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                {elevation ? `${Math.round(elevation)} ft` : 'N/A'}
              </span>
            </div>

            {/* TdP (Tour de piste - altitude AMSL) */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>TdP:</span>
              <span style={{ fontWeight: '700', color: tdpAlt ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                {tdpAlt && elevation ? `${Math.round(elevation + tdpAlt)} ft` : 'N/A'}
              </span>
            </div>

            {/* Alt Sec (Altitude de sécurité = Alt + 300ft) */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>Alt Sec:</span>
              <span style={{ fontWeight: '700', color: altSec ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                {altSec ? `${Math.round(altSec)} ft` : 'N/A'}
              </span>
            </div>

            {/* Vert T (Vertical Terrain - altitude AMSL) */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>Vert T:</span>
              <span style={{ fontWeight: '700', color: vertT ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                {vertT && elevation ? `${Math.round(elevation + vertT)} ft` : 'N/A'}
              </span>
            </div>
          </div>

          {/* Grille 2 colonnes pour les 2 sens de piste */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: runways.length === 2 ? '1fr 1fr' : '1fr',
            gap: '8px'
          }}>
            {runways.map((runway, idx) => {
              const qfu = runway.le_ident || runway.he_ident || runway.identifier;
              const heading = runway.le_heading || runway.he_heading || null;
              const qfuDegrees = heading ? `${String(heading).padStart(3, '0')}°` : 'N/A';

              const ils = runway.ils || null;
              const ilsDisplay = ils ? `${ils.category || 'ILS'}${ils.frequency ? ` - ${ils.frequency} MHz` : ''}` : 'N/A';

              const tora = runway.length || runway.le_length || runway.he_length || 0;
              const toda = runway.le_toda || runway.he_toda || tora;
              const asda = runway.le_asda || runway.he_asda || tora;
              const lda = runway.lda || runway.le_lda || runway.he_lda || tora;

              return (
                <div key={idx} style={{
                  border: '1px solid var(--border-regular)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  backgroundColor: 'var(--bg-surface)'
                }}>
                  {/* En-tête piste */}
                  <div style={{
                    backgroundColor: 'var(--bg-raised)',
                    padding: '4px 6px',
                    borderBottom: '1px solid var(--border-regular)',
                    fontWeight: '700',
                    fontSize: '10px',
                    color: 'var(--text-primary)',
                    textAlign: 'center'
                  }}>
                    {qfu}
                  </div>

                  {/* Contenu piste */}
                  <div style={{ padding: '6px', fontSize: '9px' }}>
                    {/* QFU (degré exact) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>QFU:</span>
                      <span style={{ fontWeight: '700', color: qfuDegrees !== 'N/A' ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                        {qfuDegrees}
                      </span>
                    </div>

                    {/* ILS */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>ILS:</span>
                      <span style={{ fontWeight: '600', color: ilsDisplay === 'N/A' ? 'var(--text-tertiary)' : 'var(--text-primary)', fontSize: '8px' }}>
                        {ilsDisplay}
                      </span>
                    </div>

                    {/* TODA */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>TODA:</span>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{toda}m</span>
                    </div>

                    {/* TORA - Affiché ici uniquement pour ARRIVÉE */}
                    {type === 'arrival' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>TORA:</span>
                        <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{tora}m</span>
                      </div>
                    )}

                    {/* LDA - Affiché ici pour DÉPART et ARRIVÉE */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>LDA:</span>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{lda}m</span>
                    </div>

                    {/* ASDA */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>ASDA:</span>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{asda}m</span>
                    </div>

                    {/* Séparateur avant TORA + performances */}
                    <div style={{
                      borderTop: '2px solid var(--border-regular)',
                      margin: '6px 0',
                      paddingTop: '6px'
                    }}>
                      {/* TORA + Performances de décollage (DÉPART) */}
                      {type === 'departure' && (
                        <>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '3px'
                          }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>TORA:</span>
                            <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{tora}m</span>
                          </div>

                          {/* Performances de décollage (abaques) */}
                          {performanceData?.takeoff?.abaques && performanceData.takeoff.abaques.length > 0 && (
                            <div style={{
                              marginTop: '4px',
                              paddingTop: '4px',
                              paddingLeft: '8px',
                              borderLeft: `3px solid ${PRINT.accent}`,
                              backgroundColor: PRINT.accentBg
                            }}>
                              <div style={{ fontSize: '8px', fontWeight: '700', color: PRINT.accent, marginBottom: '2px' }}>
                                📊 Décollage
                              </div>
                              {performanceData.takeoff.abaques.map((abaque, aIdx) => (
                                <div key={aIdx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                  <span style={{ color: 'var(--text-secondary)', fontSize: '8px' }}>{abaque.name}:</span>
                                  <span style={{
                                    fontWeight: '700',
                                    color: tora >= abaque.distance ? PRINT.ok : PRINT.nogo,
                                    fontSize: '8px'
                                  }}>
                                    {Math.round(abaque.distance)}m
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Performances calculées (si pas d'abaques ou en complément) */}
                          {(!performanceData?.takeoff?.abaques || performanceData.takeoff.abaques.length === 0) && performanceData?.takeoff?.groundRoll && (
                            <div style={{
                              marginTop: '4px',
                              paddingTop: '4px',
                              paddingLeft: '8px',
                              borderLeft: `3px solid ${PRINT.accent}`,
                              backgroundColor: PRINT.accentBg
                            }}>
                              <div style={{ fontSize: '8px', fontWeight: '700', color: PRINT.accent, marginBottom: '2px' }}>
                                📊 Calculé
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '8px' }}>Roulement:</span>
                                <span style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '8px' }}>
                                  {Math.round(performanceData.takeoff.groundRoll)}m
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '8px' }}>Passage 50ft:</span>
                                <span style={{
                                  fontWeight: '700',
                                  color: tora >= performanceData.takeoff.toda50ft ? PRINT.ok : PRINT.nogo,
                                  fontSize: '8px'
                                }}>
                                  {Math.round(performanceData.takeoff.toda50ft)}m
                                </span>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* LDA + Performances d'atterrissage (ARRIVÉE) */}
                      {type === 'arrival' && (
                        <>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '3px'
                          }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>LDA:</span>
                            <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{lda}m</span>
                          </div>

                          {/* Performances d'atterrissage (abaques) */}
                          {performanceData?.landing?.abaques && performanceData.landing.abaques.length > 0 && (
                            <div style={{
                              marginTop: '4px',
                              paddingTop: '4px',
                              paddingLeft: '8px',
                              borderLeft: `3px solid ${PRINT.accent}`,
                              backgroundColor: PRINT.accentBg
                            }}>
                              <div style={{ fontSize: '8px', fontWeight: '700', color: PRINT.accent, marginBottom: '2px' }}>
                                📊 Atterrissage
                              </div>
                              {performanceData.landing.abaques.map((abaque, aIdx) => (
                                <div key={aIdx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                  <span style={{ color: 'var(--text-secondary)', fontSize: '8px' }}>{abaque.name}:</span>
                                  <span style={{
                                    fontWeight: '700',
                                    color: lda >= abaque.distance ? PRINT.ok : PRINT.nogo,
                                    fontSize: '8px'
                                  }}>
                                    {Math.round(abaque.distance)}m
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Performances calculées (si pas d'abaques ou en complément) */}
                          {(!performanceData?.landing?.abaques || performanceData.landing.abaques.length === 0) && performanceData?.landing?.groundRoll && (
                            <div style={{
                              marginTop: '4px',
                              paddingTop: '4px',
                              paddingLeft: '8px',
                              borderLeft: `3px solid ${PRINT.accent}`,
                              backgroundColor: PRINT.accentBg
                            }}>
                              <div style={{ fontSize: '8px', fontWeight: '700', color: PRINT.accent, marginBottom: '2px' }}>
                                📊 Calculé
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '8px' }}>Roulement:</span>
                                <span style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '8px' }}>
                                  {Math.round(performanceData.landing.groundRoll)}m
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '8px' }}>Passage 50ft:</span>
                                <span style={{
                                  fontWeight: '700',
                                  color: lda >= performanceData.landing.lda50ft ? PRINT.ok : PRINT.nogo,
                                  fontSize: '8px'
                                }}>
                                  {Math.round(performanceData.landing.lda50ft)}m
                                </span>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  /**
   * Tableau de navigation VFR avec style identique aux sections aérodromes
   */
  const renderNavigationTable = () => {
    if (!waypoints || waypoints.length === 0 || !selectedAircraft) return null;

    const plannedAltitude = 3000; // Altitude par défaut

    return (
      <div style={{
        marginBottom: '12px',
        pageBreakInside: 'avoid',
        border: '2px solid var(--border-subtle)',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-surface)'
      }}>
        {/* En-tête tableau navigation - style identique aux aérodromes */}
        <div style={{
          backgroundColor: PRINT.accent,
          color: 'var(--color-white-soft)',
          padding: '6px 10px',
          fontWeight: '700',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <NavigationIcon size={14} />
          <span>TABLEAU DE NAVIGATION VFR</span>
        </div>

        {/* Contenu avec padding identique */}
        <div style={{ padding: '8px' }} className="vfr-table-pdf-style">
          <style>{`
            .vfr-table-pdf-style {
              font-size: 9px !important;
            }
            .vfr-table-pdf-style table {
              font-size: 9px !important;
              border-collapse: collapse !important;
            }
            .vfr-table-pdf-style th {
              padding: 4px 6px !important;
              font-size: 9px !important;
              font-weight: 600 !important;
              background-color: var(--bg-overlay) !important;
              border-bottom: 1px solid var(--border-regular) !important;
              color: var(--text-secondary) !important;
            }
            .vfr-table-pdf-style td {
              padding: 3px 6px !important;
              font-size: 9px !important;
              border-bottom: 1px solid var(--border-subtle) !important;
            }
            .vfr-table-pdf-style tr:nth-child(even) {
              background-color: var(--bg-overlay) !important;
            }
            .vfr-table-pdf-style tr:nth-child(odd) {
              background-color: var(--bg-surface) !important;
            }
            .vfr-table-pdf-style .total-row {
              background-color: ${PRINT.accentBg} !important;
              font-weight: 700 !important;
            }
          `}</style>
          <VFRNavigationTable
            waypoints={waypoints}
            selectedAircraft={selectedAircraft}
            plannedAltitude={plannedAltitude}
            flightType={flightType || 'VFR'}
            navigationResults={navigationResults}
            segmentAltitudes={segmentAltitudes}
            setSegmentAltitude={setSegmentAltitude}
            departureTimeTheoretical={departureTimeTheoretical}
            flightDate={flightPlan?.generalInfo?.date}
            hideToggleButton={true}
            hideTitle={true}
          />
        </div>
      </div>
    );
  };

  return (
    <>
      {/* CSS pour impression compacte */}
      <style>{`
        .flight-recap-table-container {
          page-break-before: always !important;
          page-break-after: always !important;
          page-break-inside: avoid !important;
        }

        .flight-recap-table-container * {
          box-sizing: border-box !important;
        }

        .recap-compact-section {
          page-break-inside: avoid !important;
        }

        .recap-grid-2col {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 8px !important;
        }

        /* iPhone responsive - éléments en colonne */
        @media (max-width: 430px) {
          .recap-main-grid {
            display: flex !important;
            flex-direction: column !important;
            grid-template-columns: unset !important;
          }
        }

        .recap-text-xs {
          font-size: 7px !important;
          line-height: 1.2 !important;
        }

        .recap-text-sm {
          font-size: 8px !important;
          line-height: 1.3 !important;
        }
      `}</style>

      <div className="flight-recap-table-container" style={{
        backgroundColor: 'var(--bg-surface)',
        padding: '8px',
        borderRadius: '8px',
        border: `2px solid ${theme.colors.primary}`,
        marginTop: '24px',
        maxWidth: '100%',
        fontSize: '8px'
      }}>
        {/* Titre principal */}
        <div style={{
          textAlign: 'center',
          marginBottom: '6px',
          paddingBottom: '4px',
          borderBottom: `2px solid ${theme.colors.primary}`
        }}>
          <h2 style={{
            fontSize: '12px',
            fontWeight: '700',
            color: theme.colors.primary,
            margin: 0
          }}>
            📋 TABLEAU RÉCAPITULATIF DE VOL
          </h2>
          <div style={{
            fontSize: '8px',
            color: theme.colors.textSecondary,
            marginTop: '2px'
          }}>
            {flightPlan.aircraft.registration} - {new Date(flightPlan.generalInfo.date).toLocaleDateString('fr-FR')}
          </div>
        </div>

        {/* Grille principale : Aérodromes à gauche, Navigation à droite */}
        <div className="recap-grid-2col recap-main-grid" style={{
          display: 'grid',
          gridTemplateColumns: '35% 65%',
          gap: '8px'
        }}>
          {/* Colonne gauche : Aérodromes */}
          <div>
            {/* Départ */}
            {departureAerodrome && renderAerodromeSection(
              departureAerodrome,
              departurePerf,
              'departure'
            )}

            {/* Arrivée */}
            {arrivalAerodrome && renderAerodromeSection(
              arrivalAerodrome,
              arrivalPerf,
              'arrival'
            )}

            {/* Déroutements */}
            {alternateAerodromes.map((altAerodrome, idx) => (
              <div key={idx}>
                {renderAerodromeSection(
                  altAerodrome,
                  null,
                  'alternate'
                )}
              </div>
            ))}
          </div>

          {/* Colonne droite : Navigation */}
          <div>
            {/* Temps de départ théorique + Heures nuit aéronautique */}
            <div style={{
              marginBottom: '12px',
              pageBreakInside: 'avoid',
              border: `2px solid ${PRINT.accent}`,
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: 'var(--bg-surface)'
            }}>
              <div style={{
                backgroundColor: PRINT.accent,
                color: 'var(--color-white-soft)',
                padding: '6px 10px',
                fontWeight: '700',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Clock size={14} />
                <span>HORAIRES DE VOL</span>
              </div>

              <div style={{ padding: '8px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  flexWrap: 'wrap',
                  fontSize: '9px'
                }}>
                  {/* Label + Input temps de départ */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: '600', whiteSpace: 'nowrap' }}>
                      ⏰ Départ théorique:
                    </span>
                    <input
                      type="time"
                      value={departureTimeTheoretical}
                      onChange={(e) => setDepartureTimeTheoretical && setDepartureTimeTheoretical(e.target.value)}
                      style={{
                        padding: '3px 5px',
                        border: `1px solid ${PRINT.accent}`,
                        borderRadius: '3px',
                        fontSize: '9px',
                        fontWeight: '600',
                        backgroundColor: 'var(--bg-surface)',
                        width: '70px'
                      }}
                    />
                  </div>

                  {/* Badge heures de nuit aéronautique */}
                  {sunTimes && formatSunTime && (
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      fontSize: '8px',
                      color: 'var(--text-primary)',
                      backgroundColor: 'rgba(242, 105, 33, 0.10)',
                      padding: '3px 8px',
                      borderRadius: '3px',
                      border: `1px solid ${PRINT.accent}`,
                      whiteSpace: 'nowrap'
                    }}>
                      <span style={{ whiteSpace: 'nowrap' }}>
                        🌅 <strong>Coucher:</strong> {formatSunTime(sunTimes.sunset)}
                      </span>
                      <span style={{ whiteSpace: 'nowrap' }}>
                        🌙 <strong>Nuit:</strong> {formatSunTime(sunTimes.nightStart)}
                      </span>
                      <span style={{ whiteSpace: 'nowrap' }}>
                        🌄 <strong>Lever:</strong> {formatSunTime(sunTimes.sunrise)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tableau de navigation VFR */}
            {renderNavigationTable()}

            {/* TOD (Top of Descent) - Style identique aux sections aérodromes */}
            {todCalculation && (
              <div style={{
                marginBottom: '12px',
                pageBreakInside: 'avoid',
                border: '2px solid var(--border-subtle)',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: 'var(--bg-surface)'
              }}>
                {/* En-tête TOD */}
                <div style={{
                  backgroundColor: PRINT.accent,
                  color: 'var(--color-white-soft)',
                  padding: '6px 10px',
                  fontWeight: '700',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <NavigationIcon size={14} />
                  <span>TOP OF DESCENT (TOD) - {todCalculation.arrivalAerodrome}</span>
                </div>

                <div style={{ padding: '8px' }}>
                  {/* Input modifiable pour le taux de descente */}
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Taux de descente (ft/min)
                    </label>
                    <input
                      type="number"
                      value={descentRate}
                      onChange={(e) => setDescentRate(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        fontSize: '9px',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-surface)'
                      }}
                    />
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '6px',
                    fontSize: '9px',
                    backgroundColor: 'var(--bg-overlay)',
                    padding: '6px',
                    borderRadius: '4px'
                  }}>
                    {/* Distance TOD */}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>Distance TOD:</span>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                        {todCalculation.distanceToTod} NM
                      </span>
                    </div>

                    {/* Descente totale */}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>Descente:</span>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                        {todCalculation.altitudeToDescent} ft
                      </span>
                    </div>

                    {/* Taux descente */}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>Taux:</span>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                        {todCalculation.descentRate} ft/min
                      </span>
                    </div>

                    {/* Temps descente */}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>Temps:</span>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                        {todCalculation.descentTime} min
                      </span>
                    </div>

                    {/* Altitude croisière */}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>Alt. croisière:</span>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                        {todCalculation.cruiseAltitude} ft
                      </span>
                    </div>

                    {/* Altitude pattern */}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>Alt. pattern:</span>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                        {todCalculation.patternAltitude} ft
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Briefings */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{
                fontSize: '11px',
                fontWeight: '700',
                color: PRINT.accent,
                marginBottom: '6px'
              }}>
                ✈️ BRIEFINGS
              </div>

              <div style={{
                border: `2px solid ${PRINT.accent}`,
                borderRadius: '6px',
                padding: '6px 8px',
                backgroundColor: PRINT.accentBg,
                fontSize: '9px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                  <span style={{ fontWeight: '600', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>B. On:</span>
                  <span style={{ borderBottom: '1px solid var(--text-tertiary)', flex: 1 }}>&nbsp;</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                  <span style={{ fontWeight: '600', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>T/O B.:</span>
                  <span style={{ borderBottom: '1px solid var(--text-tertiary)', flex: 1 }}>&nbsp;</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                  <span style={{ fontWeight: '600', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>LDG B.:</span>
                  <span style={{ borderBottom: '1px solid var(--text-tertiary)', flex: 1 }}>&nbsp;</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                  <span style={{ fontWeight: '600', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>B. OFF:</span>
                  <span style={{ borderBottom: '1px solid var(--text-tertiary)', flex: 1 }}>&nbsp;</span>
                </div>
              </div>
            </div>

            {/* Notes du Pilote - Éditable */}
            <div>
              <div style={{
                fontSize: '11px',
                fontWeight: '700',
                color: PRINT.accent,
                marginBottom: '6px'
              }}>
                ✍️ NOTES DU PILOTE
              </div>

              <textarea
                value={flightPlan.notes || ''}
                onChange={(e) => {
                  flightPlan.notes = e.target.value;
                  if (onUpdate) onUpdate();
                }}
                placeholder="Ajouter vos notes pré-vol (météo, NOTAMs, clairances, fréquences VOR/ATIS, QNH, vent, etc.)"
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '8px',
                  fontSize: '9px',
                  border: `2px solid ${PRINT.accent}`,
                  borderRadius: '6px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  backgroundColor: PRINT.accentBg,
                  color: 'var(--text-primary)',
                  lineHeight: '1.5'
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FlightRecapTable;
