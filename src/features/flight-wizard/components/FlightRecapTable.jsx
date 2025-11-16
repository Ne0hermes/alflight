import React from 'react';
import { Plane, MapPin, Navigation as NavigationIcon, Radio, Phone } from 'lucide-react';
import { theme } from '../../../styles/theme';
import VFRNavigationTable from '@features/navigation/components/VFRNavigationTable';

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
  flightType
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

    const titleColor = type === 'departure' ? '#10b981' :
                      type === 'arrival' ? '#ef4444' :
                      '#f59e0b';

    // Extraire les fréquences
    const atisFreq = aerodrome.frequencies ? extractFrequency(aerodrome.frequencies.atis) : null;
    const twrFreq = aerodrome.frequencies ? extractFrequency(aerodrome.frequencies.twr) : null;
    const afisFreq = aerodrome.frequencies ? extractFrequency(aerodrome.frequencies.afis) : null;
    const gndFreq = aerodrome.frequencies ? extractFrequency(aerodrome.frequencies.gnd) : null;
    const appFreq = aerodrome.frequencies ? extractFrequency(aerodrome.frequencies.app) : null;

    // Téléphone
    const phone = aerodrome.phone || null;

    // Altitudes
    const elevation = typeof aerodrome.elevation === 'object' ? aerodrome.elevation.value : aerodrome.elevation;
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
        border: '2px solid #e5e7eb',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: 'white'
      }}>
        {/* En-tête aérodrome */}
        <div style={{
          backgroundColor: titleColor,
          color: 'white',
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
            backgroundColor: '#f9fafb',
            padding: '6px',
            borderRadius: '4px'
          }}>
            {/* ATIS */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280', fontWeight: '600' }}>ATIS:</span>
              <span style={{ fontWeight: '700', color: atisFreq ? '#111827' : '#9ca3af' }}>
                {atisFreq ? `${atisFreq} MHz` : 'N/A'}
              </span>
            </div>

            {/* Tel tours */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280', fontWeight: '600' }}>Tel tours:</span>
              <span style={{ fontWeight: '700', color: phone ? '#111827' : '#9ca3af' }}>
                {phone || 'N/A'}
              </span>
            </div>

            {/* Freq Utile */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280', fontWeight: '600' }}>Freq Utile:</span>
              <span style={{ fontWeight: '600', color: '#111827', fontSize: '8px' }}>
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
              <span style={{ color: '#6b7280', fontWeight: '600' }}>Altitude:</span>
              <span style={{ fontWeight: '700', color: elevation ? '#111827' : '#9ca3af' }}>
                {elevation ? `${Math.round(elevation)} ft` : 'N/A'}
              </span>
            </div>

            {/* TdP (Tour de piste - altitude AMSL) */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280', fontWeight: '600' }}>TdP:</span>
              <span style={{ fontWeight: '700', color: tdpAlt ? '#111827' : '#9ca3af' }}>
                {tdpAlt && elevation ? `${Math.round(elevation + tdpAlt)} ft` : 'N/A'}
              </span>
            </div>

            {/* Alt Sec (Altitude de sécurité = Alt + 300ft) */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280', fontWeight: '600' }}>Alt Sec:</span>
              <span style={{ fontWeight: '700', color: altSec ? '#111827' : '#9ca3af' }}>
                {altSec ? `${Math.round(altSec)} ft` : 'N/A'}
              </span>
            </div>

            {/* Vert T (Vertical Terrain - altitude AMSL) */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280', fontWeight: '600' }}>Vert T:</span>
              <span style={{ fontWeight: '700', color: vertT ? '#111827' : '#9ca3af' }}>
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
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  backgroundColor: '#fefefe'
                }}>
                  {/* En-tête piste */}
                  <div style={{
                    backgroundColor: '#e5e7eb',
                    padding: '4px 6px',
                    borderBottom: '1px solid #d1d5db',
                    fontWeight: '700',
                    fontSize: '10px',
                    color: '#111827',
                    textAlign: 'center'
                  }}>
                    {qfu}
                  </div>

                  {/* Contenu piste */}
                  <div style={{ padding: '6px', fontSize: '9px' }}>
                    {/* QFU (degré exact) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ color: '#6b7280', fontWeight: '600' }}>QFU:</span>
                      <span style={{ fontWeight: '700', color: qfuDegrees !== 'N/A' ? '#111827' : '#9ca3af' }}>
                        {qfuDegrees}
                      </span>
                    </div>

                    {/* ILS */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ color: '#6b7280', fontWeight: '600' }}>ILS:</span>
                      <span style={{ fontWeight: '600', color: ilsDisplay === 'N/A' ? '#9ca3af' : '#111827', fontSize: '8px' }}>
                        {ilsDisplay}
                      </span>
                    </div>

                    {/* TODA */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ color: '#6b7280', fontWeight: '600' }}>TODA:</span>
                      <span style={{ fontWeight: '700', color: '#111827' }}>{toda}m</span>
                    </div>

                    {/* ASDA */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ color: '#6b7280', fontWeight: '600' }}>ASDA:</span>
                      <span style={{ fontWeight: '700', color: '#111827' }}>{asda}m</span>
                    </div>

                    {/* TORA avec performance */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '3px'
                    }}>
                      <span style={{ color: '#6b7280', fontWeight: '600' }}>TORA:</span>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <span style={{ fontWeight: '700', color: '#111827' }}>{tora}m</span>
                        {type === 'departure' && performanceData?.takeoff?.groundRoll && (
                          <span style={{
                            fontSize: '8px',
                            color: tora >= performanceData.takeoff.groundRoll ? '#059669' : '#dc2626',
                            fontWeight: '700'
                          }}>
                            ({Math.round(performanceData.takeoff.groundRoll)}m)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* LDA avec performance */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '3px'
                    }}>
                      <span style={{ color: '#6b7280', fontWeight: '600' }}>LDA:</span>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <span style={{ fontWeight: '700', color: '#111827' }}>{lda}m</span>
                        {type === 'arrival' && performanceData?.landing?.groundRoll && (
                          <span style={{
                            fontSize: '8px',
                            color: lda >= performanceData.landing.groundRoll ? '#059669' : '#dc2626',
                            fontWeight: '700'
                          }}>
                            ({Math.round(performanceData.landing.groundRoll)}m)
                          </span>
                        )}
                      </div>
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
        border: '2px solid #e5e7eb',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: 'white'
      }}>
        {/* En-tête tableau navigation - style identique aux aérodromes */}
        <div style={{
          backgroundColor: '#3b82f6',
          color: 'white',
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
              background-color: #f9fafb !important;
              border-bottom: 1px solid #d1d5db !important;
              color: #6b7280 !important;
            }
            .vfr-table-pdf-style td {
              padding: 3px 6px !important;
              font-size: 9px !important;
              border-bottom: 1px solid #e5e7eb !important;
            }
            .vfr-table-pdf-style tr:nth-child(even) {
              background-color: #f9fafb !important;
            }
            .vfr-table-pdf-style tr:nth-child(odd) {
              background-color: white !important;
            }
            .vfr-table-pdf-style .total-row {
              background-color: #dbeafe !important;
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
          />
        </div>
      </div>
    );
  };

  return (
    <>
      {/* CSS pour impression paysage */}
      <style>{`
        @media print {
          .flight-recap-table-container {
            page-break-before: always !important;
            page-break-after: always !important;
          }

          @page recap-landscape {
            size: A4 landscape;
            margin: 0.5cm;
          }

          .flight-recap-table-container {
            page: recap-landscape;
          }
        }
      `}</style>

      <div className="flight-recap-table-container" style={{
        backgroundColor: 'white',
        padding: '12px',
        borderRadius: '8px',
        border: `2px solid ${theme.colors.primary}`,
        marginTop: '24px'
      }}>
        {/* Titre principal */}
        <div style={{
          textAlign: 'center',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: `3px solid ${theme.colors.primary}`
        }}>
          <h2 style={{
            fontSize: '16px',
            fontWeight: '700',
            color: theme.colors.primary,
            margin: 0
          }}>
            📋 TABLEAU RÉCAPITULATIF DE VOL
          </h2>
          <div style={{
            fontSize: '10px',
            color: theme.colors.textSecondary,
            marginTop: '2px'
          }}>
            {flightPlan.aircraft.registration} - {new Date(flightPlan.generalInfo.date).toLocaleDateString('fr-FR')}
          </div>
        </div>

        {/* Grille principale : Aérodromes à gauche, Navigation à droite */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40% 60%',
          gap: '12px'
        }}>
          {/* Colonne gauche : Aérodromes */}
          <div>
            <h3 style={{
              fontSize: '11px',
              fontWeight: '700',
              color: '#111827',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <MapPin size={12} />
              AÉRODROMES
            </h3>

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
            <h3 style={{
              fontSize: '11px',
              fontWeight: '700',
              color: '#111827',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <NavigationIcon size={12} />
              NAVIGATION
            </h3>

            {/* Tableau de navigation détaillé */}
            {renderNavigationTable()}

            {/* TOD (Top of Descent) */}
            {todCalculation && (
              <div style={{
                border: '2px solid #fb923c',
                borderRadius: '6px',
                padding: '8px',
                backgroundColor: 'rgba(251, 146, 60, 0.1)',
                fontSize: '9px',
                marginBottom: '12px'
              }}>
                <div style={{ fontWeight: '700', color: '#fb923c', marginBottom: '4px' }}>
                  🛬 TOP OF DESCENT (TOD)
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ color: '#78350f', fontWeight: '600' }}>Distance TOD:</span>
                  <span style={{ fontWeight: '700' }}>
                    {todCalculation.distanceToTod} NM avant {todCalculation.arrivalAerodrome}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#78350f' }}>Descente:</span>
                  <span style={{ fontWeight: '600' }}>
                    {todCalculation.altitudeToDescent} ft @ {todCalculation.descentRate} ft/min ({todCalculation.descentTime} min)
                  </span>
                </div>
              </div>
            )}

            {/* Briefings */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{
                fontSize: '11px',
                fontWeight: '700',
                color: '#8b5cf6',
                marginBottom: '6px'
              }}>
                ✈️ BRIEFINGS
              </div>

              <div style={{
                border: '2px solid #8b5cf6',
                borderRadius: '6px',
                padding: '6px 8px',
                backgroundColor: '#f5f3ff',
                fontSize: '9px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                  <span style={{ fontWeight: '600', color: '#6b7280', whiteSpace: 'nowrap' }}>B. On:</span>
                  <span style={{ borderBottom: '1px solid #9ca3af', flex: 1 }}>&nbsp;</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                  <span style={{ fontWeight: '600', color: '#6b7280', whiteSpace: 'nowrap' }}>T/O B.:</span>
                  <span style={{ borderBottom: '1px solid #9ca3af', flex: 1 }}>&nbsp;</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                  <span style={{ fontWeight: '600', color: '#6b7280', whiteSpace: 'nowrap' }}>LDG B.:</span>
                  <span style={{ borderBottom: '1px solid #9ca3af', flex: 1 }}>&nbsp;</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                  <span style={{ fontWeight: '600', color: '#6b7280', whiteSpace: 'nowrap' }}>B. OFF:</span>
                  <span style={{ borderBottom: '1px solid #9ca3af', flex: 1 }}>&nbsp;</span>
                </div>
              </div>
            </div>

            {/* ATIS, Notes et Clairances */}
            <div>
              <div style={{
                fontSize: '11px',
                fontWeight: '700',
                color: '#6366f1',
                marginBottom: '6px'
              }}>
                📝 ATIS, NOTES ET CLAIRANCES
              </div>

              <div style={{
                border: '2px solid #6366f1',
                borderRadius: '6px',
                padding: '8px',
                backgroundColor: '#eff6ff',
                fontSize: '9px',
                minHeight: '60px',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.5',
                color: '#1e293b'
              }}>
                {flightPlan.notes || 'Aucune note ajoutée'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FlightRecapTable;
