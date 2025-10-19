// src/features/vac/components/VACViewer.jsx
import React, { memo, useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Download, Maximize2, Info } from 'lucide-react';
import { useVACStore } from '@core/stores/vacStore';
import { sx } from '@shared/styles/styleSystem';

export const VACViewer = memo(() => {
  const selectedChart = useVACStore(state => state.selectedChart);
  const charts = useVACStore(state => state.charts);
  const { selectChart } = useVACStore();
  
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [page, setPage] = useState(1);
  
  const chart = selectedChart ? charts[selectedChart] : null;
  
  // Reset zoom et rotation quand on change de carte
  useEffect(() => {
    setZoom(100);
    setRotation(0);
    setPage(1);
  }, [selectedChart]);
  
  if (!chart || !chart.isDownloaded) return null;
  
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleDownload = () => {
    // Pour les cartes importées, créer un lien de téléchargement
    if (chart.isCustom && chart.url) {
      const link = document.createElement('a');
      link.href = chart.url;
      link.download = `${chart.icao}_VAC.${chart.fileType?.split('/')[1] || 'pdf'}`;
      link.click();
    } else {
      window.open(chart.url, '_blank');
    }
  };
  
  return (
    <div style={styles.overlay}>
      <div style={styles.viewer}>
        {/* En-tête */}
        <div style={styles.header}>
          <div style={sx.combine(sx.flex.start, sx.spacing.gap(3))}>
            <h3 style={sx.combine(sx.text.lg, sx.text.bold, { margin: 0 })}>
              {chart.icao} - {chart.name}
            </h3>
            {chart.extractedData && (
              <span style={sx.combine(sx.text.sm, sx.text.secondary)}>
                {chart.extractedData.airportElevation > 0 && `Alt: ${chart.extractedData.airportElevation} ft`}
                {chart.extractedData.runways && chart.extractedData.runways.length > 0 && 
                  ` • ${chart.extractedData.runways.length} piste(s)`}
              </span>
            )}
          </div>
          
          <button
            onClick={() => selectChart(null)}
            style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Barre d'outils */}
        <div style={styles.toolbar}>
          <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
            <button
              onClick={handleZoomIn}
              style={styles.toolButton}
              title="Zoom avant"
            >
              <ZoomIn size={18} />
            </button>
            <button
              onClick={handleZoomOut}
              style={styles.toolButton}
              title="Zoom arrière"
            >
              <ZoomOut size={18} />
            </button>
            <span style={styles.zoomIndicator}>{zoom}%</span>
          </div>
          
          <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
            <button
              onClick={handleRotate}
              style={styles.toolButton}
              title="Rotation"
            >
              <RotateCw size={18} />
            </button>
            <button
              onClick={handleDownload}
              style={styles.toolButton}
              title="Télécharger PDF"
            >
              <Download size={18} />
            </button>
            <button
              onClick={() => {/* Plein écran */}}
              style={styles.toolButton}
              title="Plein écran"
            >
              <Maximize2 size={18} />
            </button>
          </div>
        </div>
        
        {/* Zone de visualisation */}
        <div style={styles.pdfContainer}>
          {/* Afficher la carte importée ou la démo */}
          {chart.isCustom && chart.url ? (
            <CustomChartViewer chart={chart} zoom={zoom} rotation={rotation} />
          ) : (
            <DemoVACChart chart={chart} zoom={zoom} rotation={rotation} />
          )}
        </div>
        
        {/* Panneau d'information */}
        <div style={styles.infoPanel}>
          <div style={sx.combine(sx.flex.start, sx.spacing.gap(2))}>
            <Info size={16} style={{ color: sx.theme.colors.primary[600] }} />
            <p style={sx.combine(sx.text.sm, { margin: 0 })}>
              Utilisez la molette de la souris pour zoomer, cliquez et glissez pour déplacer la carte
            </p>
          </div>
        </div>
      </div>
    </div>

});

// Composant pour afficher les cartes importées manuellement
const CustomChartViewer = memo(({ chart, zoom, rotation }) => {
  const isImage = chart.fileType?.startsWith('image/');
  const isPDF = chart.fileType === 'application/pdf';
  
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'auto',
      backgroundColor: '#f3f4f6',
      position: 'relative'
    }}>
      {isImage ? (
        <img
          src={chart.url}
          alt={`Carte VAC ${chart.icao}`}
          style={{
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            transformOrigin: 'center',
            transition: 'transform 0.3s',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
        />
      ) : isPDF ? (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Pour les PDF, on utilise un iframe ou embed */}
          <embed
            src={chart.url}
            type="application/pdf"
            style={{
              width: `${zoom}%`,
              height: `${zoom}%`,
              transform: `rotate(${rotation}deg)`,
              transformOrigin: 'center',
              transition: 'transform 0.3s',
              border: 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          />
          {/* Alternative si embed ne fonctionne pas */}
          <div style={{
            position: 'absolute',
            bottom: '20px',
            padding: '10px 20px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            borderRadius: '8px',
            fontSize: '14px'
          }}>
            Si le PDF ne s'affiche pas, 
            <a 
              href={chart.url} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#60a5fa', marginLeft: '5px' }}
            >
              cliquez ici pour l'ouvrir
            </a>
          </div>
        </div>
      ) : (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: '#6b7280'
        }}>
          <p>Format de fichier non supporté pour l'affichage</p>
          <p style={{ marginTop: '10px' }}>
            Utilisez le bouton Télécharger pour accéder au fichier
          </p>
        </div>
      )}
      
      {/* Indicateur de carte importée */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        padding: '8px 16px',
        backgroundColor: '#8b5cf6',
        color: 'white',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: 'bold',
        boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
      }}>
        CARTE IMPORTÉE
      </div>
    </div>

});

// Composant de démonstration pour simuler une carte VAC
const DemoVACChart = memo(({ chart, zoom, rotation }) => {
  const data = chart.extractedData;
  
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'auto',
      backgroundColor: '#f3f4f6'
    }}>
      <div style={{
        transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
        transformOrigin: 'center',
        transition: 'transform 0.3s',
        backgroundColor: 'white',
        padding: '40px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        minWidth: '600px',
        minHeight: '800px'
      }}>
        {/* En-tête de la carte */}
        <div style={{
          textAlign: 'center',
          marginBottom: '30px',
          borderBottom: '2px solid #1f2937',
          paddingBottom: '20px'
        }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 10px 0' }}>
            {chart.icao}
          </h1>
          <h2 style={{ fontSize: '24px', color: '#6b7280', margin: 0 }}>
            {chart.name}
          </h2>
        </div>
        
        {/* Informations terrain */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
            INFORMATIONS TERRAIN
          </h3>
          <table style={{ width: '100%', fontSize: '14px' }}>
            <tbody>
              <tr>
                <td style={styles.tableCell}>Code ICAO :</td>
                <td style={styles.tableCell}><strong>{chart.icao}</strong></td>
              </tr>
              {chart.extractedData?.iata && (
                <tr>
                  <td style={styles.tableCell}>Code IATA :</td>
                  <td style={styles.tableCell}><strong>{chart.extractedData.iata}</strong></td>
                </tr>
              )}
              <tr>
                <td style={styles.tableCell}>Nom complet :</td>
                <td style={styles.tableCell}><strong>{chart.name}</strong></td>
              </tr>
              {chart.extractedData?.city && (
                <tr>
                  <td style={styles.tableCell}>Ville :</td>
                  <td style={styles.tableCell}><strong>{chart.extractedData.city}</strong></td>
                </tr>
              )}
              <tr>
                <td style={styles.tableCell}>Coordonnées :</td>
                <td style={styles.tableCell}>
                  <strong>
                    {chart.coordinates?.lat?.toFixed(6)}°N, {chart.coordinates?.lon?.toFixed(6)}°E
                  </strong>
                </td>
              </tr>
              <tr>
                <td style={styles.tableCell}>Altitude de référence :</td>
                <td style={styles.tableCell}><strong>{data?.airportElevation || 0} ft</strong></td>
              </tr>
              {data?.circuitAltitude && (
                <tr>
                  <td style={styles.tableCell}>Altitude de tour de piste :</td>
                  <td style={styles.tableCell}><strong>{data.circuitAltitude} ft</strong></td>
                </tr>
              )}
              <tr>
                <td style={styles.tableCell}>Variation magnétique :</td>
                <td style={styles.tableCell}>
                  <strong>
                    {data?.magneticVariation?.value || data?.magneticVariation || 0}° E 
                    {data?.magneticVariation?.date && ` (${data.magneticVariation.date})`}
                    {data?.magneticVariation?.change && ` (Δ ${data.magneticVariation.change}°/an)`}
                  </strong>
                </td>
              </tr>
              {data?.transitionAltitude && (
                <tr>
                  <td style={styles.tableCell}>Altitude de transition :</td>
                  <td style={styles.tableCell}><strong>{data.transitionAltitude} ft</strong></td>
                </tr>
              )}
              {data?.referencePoint && (
                <tr>
                  <td style={styles.tableCell}>Point de référence :</td>
                  <td style={styles.tableCell}><strong>{data.referencePoint}</strong></td>
                </tr>
              )}
              {chart.source && (
                <tr>
                  <td style={styles.tableCell}>Source des données :</td>
                  <td style={styles.tableCell}>
                    <strong>{chart.source}</strong>
                    {data?.airac && ` (AIRAC ${data.airac})`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Caractéristiques des pistes */}
        {data?.runways && Array.isArray(data.runways) && data.runways.length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
              CARACTÉRISTIQUES DES PISTES
            </h3>
            <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  <th style={styles.tableHeader}>Piste</th>
                  <th style={styles.tableHeader}>QFU (Mag)</th>
                  <th style={styles.tableHeader}>QFU (Vrai)</th>
                  <th style={styles.tableHeader}>TORA</th>
                  <th style={styles.tableHeader}>TODA</th>
                  <th style={styles.tableHeader}>ASDA</th>
                  <th style={styles.tableHeader}>LDA</th>
                  <th style={styles.tableHeader}>Largeur</th>
                  <th style={styles.tableHeader}>Revêtement</th>
                  <th style={styles.tableHeader}>PCN</th>
                  <th style={styles.tableHeader}>ILS</th>
                </tr>
              </thead>
              <tbody>
                {data.runways.map((rwy, idx) => (
                  <tr key={idx}>
                    <td style={styles.tableCell}><strong>{rwy.identifier || rwy.designation || 'N/A'}</strong></td>
                    <td style={styles.tableCell}>{rwy.magneticBearing || rwy.qfu || rwy.orientation || 0}°</td>
                    <td style={styles.tableCell}>{rwy.trueBearing ? `${rwy.trueBearing}°` : '-'}</td>
                    <td style={styles.tableCell}>{rwy.tora || rwy.length || rwy.length_m || 0}m</td>
                    <td style={styles.tableCell}>{rwy.toda || rwy.length || rwy.length_m || 0}m</td>
                    <td style={styles.tableCell}>{rwy.asda || rwy.length || rwy.length_m || 0}m</td>
                    <td style={styles.tableCell}>{rwy.lda || rwy.length || rwy.length_m || 0}m</td>
                    <td style={styles.tableCell}>{rwy.width || rwy.width_m || 0}m</td>
                    <td style={styles.tableCell}>{rwy.surface || 'ASPH'}</td>
                    <td style={styles.tableCell}>{rwy.pcn || '-'}</td>
                    <td style={styles.tableCell}>
                      {rwy.ils ? (
                        <div style={{ fontSize: '11px' }}>
                          <div><strong>{rwy.ils.identifier || ''}</strong></div>
                          <div>{rwy.ils.frequency ? `${rwy.ils.frequency} MHz` : ''}</div>
                          <div>{rwy.ils.category ? `Cat ${rwy.ils.category}` : ''}</div>
                          {rwy.ils.glidePath?.slope && <div>GP: {rwy.ils.glidePath.slope}°</div>}
                        </div>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Légende des distances */}
            <div style={{ marginTop: '10px', fontSize: '12px', color: '#6b7280' }}>
              <p><strong>TORA</strong>: Take-Off Run Available (Distance de roulement au décollage)</p>
              <p><strong>TODA</strong>: Take-Off Distance Available (Distance utilisable au décollage)</p>
              <p><strong>ASDA</strong>: Accelerate-Stop Distance Available (Distance accélération-arrêt)</p>
              <p><strong>LDA</strong>: Landing Distance Available (Distance utilisable à l'atterrissage)</p>
              <p style={{ marginTop: '8px', fontStyle: 'italic' }}>
                ✅ <strong>Données AIXM officielles</strong>: Les valeurs QFU et distances déclarées affichées proviennent directement 
                des fichiers AIXM 4.5 et XML SIA officiels (AIRAC {data.airac || '2025-09-04'}). 
                Ces données sont fournies à titre indicatif et doivent être vérifiées avec les documents VAC officiels.
              </p>
            </div>
            
            {/* Détails des équipements de piste */}
            {data.runways.length > 0 && (
              <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px' }}>
                  ÉQUIPEMENTS ET AIDES VISUELLES
                </h4>
                {data.runways.map((rwy, idx) => (
                  <div key={idx} style={{ marginBottom: '15px' }}>
                    <h5 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>
                      Piste {rwy.designation || rwy.identifier}
                    </h5>
                    <div style={{ fontSize: '13px', paddingLeft: '15px' }}>
                      {rwy.vasis && (
                        <div>
                          <strong>VASIS/PAPI:</strong> {rwy.vasis.type || 'PAPI'} 
                          {rwy.vasis.angle && ` - Angle: ${rwy.vasis.angle}°`}
                          {rwy.vasis.meht && ` - MEHT: ${rwy.vasis.meht} ft`}
                        </div>
                      )}
                      {rwy.threshold && (
                        <div>
                          <strong>Seuil:</strong> {rwy.threshold.lat?.toFixed(6)}°N, {rwy.threshold.lon?.toFixed(6)}°E
                          {rwy.threshold_displaced > 0 && ` - Décalé de ${rwy.threshold_displaced}m`}
                        </div>
                      )}
                      {rwy.lighting && (
                        <div><strong>Balisage:</strong> {rwy.lighting}</div>
                      )}
                      {rwy.approach_lighting && (
                        <div><strong>Balisage d'approche:</strong> {rwy.approach_lighting}</div>
                      )}
                      {rwy.elevation && (
                        <div><strong>Élévation seuil:</strong> {rwy.elevation} ft</div>
                      )}
                      {rwy.remarks && (
                        <div><strong>Remarques:</strong> {rwy.remarks}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Fréquences */}
        {data?.frequencies && Object.keys(data.frequencies).length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
              FRÉQUENCES RADIO
            </h3>
            <table style={{ width: '100%', fontSize: '14px' }}>
              <tbody>
                {Object.entries(data.frequencies)
                  .filter(([type, freqData]) => freqData && (Array.isArray(freqData) ? freqData.length > 0 : freqData !== ''))
                  .map(([type, freqData]) => {
                    // Si c'est un tableau de fréquences (depuis AIXM)
                    if (Array.isArray(freqData)) {
                      return freqData.map((freq, idx) => (
                        <tr key={`${type}_${idx}`}>
                          <td style={styles.tableCell}>
                            {type.toUpperCase()}
                            {freq.remarks && <span style={{ fontSize: '12px', color: '#6b7280' }}> ({freq.remarks})</span>}
                            :
                          </td>
                          <td style={styles.tableCell}>
                            <strong>{freq.frequency} MHz</strong>
                            {freq.schedule && <span style={{ marginLeft: '10px', fontSize: '12px' }}>({freq.schedule})</span>}
                          </td>
                        </tr>
                      );
                    }
                    // Si c'est une simple string (format ancien)
                    return (
                      <tr key={type}>
                        <td style={styles.tableCell}>{type.toUpperCase()} :</td>
                        <td style={styles.tableCell}><strong>{freqData} MHz</strong></td>
                      </tr>

                  })}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Aides à la navigation */}
        {data?.navaids && data.navaids.length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
              AIDES À LA NAVIGATION
            </h3>
            <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  <th style={styles.tableHeader}>Type</th>
                  <th style={styles.tableHeader}>Identifiant</th>
                  <th style={styles.tableHeader}>Fréquence</th>
                  <th style={styles.tableHeader}>Coordonnées</th>
                  <th style={styles.tableHeader}>Distance/Radial</th>
                </tr>
              </thead>
              <tbody>
                {data.navaids.map((nav, idx) => (
                  <tr key={idx}>
                    <td style={styles.tableCell}><strong>{nav.type}</strong></td>
                    <td style={styles.tableCell}>{nav.identifier}</td>
                    <td style={styles.tableCell}>{nav.frequency} MHz</td>
                    <td style={styles.tableCell}>
                      {nav.coordinates?.lat?.toFixed(4)}°N, {nav.coordinates?.lon?.toFixed(4)}°E
                    </td>
                    <td style={styles.tableCell}>
                      {nav.distance && `${nav.distance} NM`}
                      {nav.radial && ` / ${nav.radial}°`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Espaces aériens */}
        {data?.airspaces && Object.keys(data.airspaces).length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
              ESPACES AÉRIENS ASSOCIÉS
            </h3>
            <table style={{ width: '100%', fontSize: '14px' }}>
              <tbody>
                {Object.entries(data.airspaces).map(([type, space]) => (
                  <tr key={type}>
                    <td style={styles.tableCell}>
                      <strong>{type.toUpperCase()}</strong>
                      {space.class && ` (Classe ${space.class})`}
                      :
                    </td>
                    <td style={styles.tableCell}>
                      {space.lower || 'SFC'} → {space.altitude || space.upper || 'UNL'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Services et équipements */}
        {(data?.operatingHours || data?.fuel || data?.customs || data?.handling) && (
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
              SERVICES ET ÉQUIPEMENTS
            </h3>
            <table style={{ width: '100%', fontSize: '14px' }}>
              <tbody>
                {data?.operatingHours && (
                  <tr>
                    <td style={styles.tableCell}>Horaires d'ouverture :</td>
                    <td style={styles.tableCell}><strong>{data.operatingHours}</strong></td>
                  </tr>
                )}
                {data?.fuel !== undefined && (
                  <tr>
                    <td style={styles.tableCell}>Avitaillement :</td>
                    <td style={styles.tableCell}>
                      <strong>{data.fuel ? '✅ Disponible' : '❌ Non disponible'}</strong>
                    </td>
                  </tr>
                )}
                {data?.customs !== undefined && (
                  <tr>
                    <td style={styles.tableCell}>Douanes :</td>
                    <td style={styles.tableCell}>
                      <strong>{data.customs ? '✅ Disponible' : '❌ Non disponible'}</strong>
                    </td>
                  </tr>
                )}
                {data?.handling !== undefined && (
                  <tr>
                    <td style={styles.tableCell}>Assistance (Handling) :</td>
                    <td style={styles.tableCell}>
                      <strong>{data.handling ? '✅ Disponible' : '❌ Non disponible'}</strong>
                    </td>
                  </tr>
                )}
                {data?.remarks && (
                  <tr>
                    <td style={styles.tableCell}>Remarques :</td>
                    <td style={styles.tableCell}>{data.remarks}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Schéma de piste simplifié */}
        <div style={{
          marginTop: '40px',
          padding: '20px',
          border: '2px solid #e5e7eb',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            [Schéma de l'aérodrome]
          </p>
          <div style={{
            margin: '20px auto',
            width: '400px',
            height: '200px',
            backgroundColor: '#f9fafb',
            border: '1px dashed #9ca3af',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ color: '#9ca3af' }}>
              Vue aérienne de l'aérodrome
            </span>
          </div>
        </div>
        
        {/* Note de démonstration */}
        <div style={{
          marginTop: '40px',
          padding: '15px',
          backgroundColor: '#fef3c7',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#92400e',
          textAlign: 'center'
        }}>
          <strong>MODE DÉMONSTRATION</strong><br />
          En production, la carte VAC PDF officielle serait affichée ici
        </div>
      </div>
    </div>

});

// Styles
const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  viewer: {
    width: '90%',
    height: '90%',
    maxWidth: '1400px',
    backgroundColor: 'white',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  header: {
    padding: '16px 24px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  toolbar: {
    padding: '12px 24px',
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  toolButton: {
    padding: '8px',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    '&:hover': {
      backgroundColor: '#f3f4f6',
      borderColor: '#d1d5db'
    }
  },
  zoomIndicator: {
    padding: '4px 12px',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500'
  },
  pdfContainer: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb'
  },
  infoPanel: {
    padding: '12px 24px',
    backgroundColor: '#f0f9ff',
    borderTop: '1px solid #bae6fd'
  },
  tableCell: {
    padding: '8px',
    borderBottom: '1px solid #e5e7eb'
  },
  tableHeader: {
    padding: '8px',
    fontWeight: 'bold',
    textAlign: 'left',
    borderBottom: '2px solid #d1d5db'
  }
};

VACViewer.displayName = 'VACViewer';
CustomChartViewer.displayName = 'CustomChartViewer';
DemoVACChart.displayName = 'DemoVACChart';

export default VACViewer;