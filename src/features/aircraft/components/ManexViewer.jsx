// src/features/aircraft/components/ManexViewer.jsx
import React, { memo, useState, useEffect } from 'react';
import { FileText, Download, X, Eye, Calendar, Database, BarChart3, AlertTriangle } from 'lucide-react';
import { getManexWithPdf } from '../../../core/stores/manexStore';
import dataBackupManager from '../../../utils/dataBackupManager';
import { showNotification } from '../../../shared/components/Notification';

export const ManexViewer = memo(({ aircraft, onClose }) => {
  const [activeTab, setActiveTab] = useState('info');
  const [manexFullData, setManexFullData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Charger les données complètes du MANEX depuis tous les stores possibles.
  // Cas 1 : aircraft.manex déjà présent (legacy / déjà chargé) → on l'utilise
  //         et on enrichit éventuellement avec le PDF d'IndexedDB.
  // Cas 2 : aircraft.hasManex === true mais aircraft.manex absent (liste légère)
  //         → on va chercher dans manexStore (zustand) puis dataBackupManager
  //           (IndexedDB) en fallback.
  useEffect(() => {
    let cancelled = false;

    const loadManexData = async () => {
      if (!aircraft || !aircraft.id) {
        setLoading(false);
        return;
      }
      try {
        // 1) Tentative via manexStore (métadonnées + PDF si présent)
        let merged = null;
        try {
          const fromStore = await getManexWithPdf(aircraft.id);
          if (fromStore && Object.keys(fromStore).length > 0) {
            merged = { ...(aircraft.manex || {}), ...fromStore };
          }
        } catch (err) {
          console.warn('[ManexViewer] manexStore lookup failed:', err.message);
        }

        // 2) Si toujours pas de PDF, essayer dataBackupManager (IndexedDB des
        //    backups d'avions complets).
        if (!merged || !merged.pdfData) {
          try {
            await dataBackupManager.initPromise;
            const fullAircraft = await Promise.race([
              dataBackupManager.getAircraftData(aircraft.id),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
            ]);
            if (fullAircraft && fullAircraft.manex) {
              merged = { ...(merged || {}), ...fullAircraft.manex };
            }
          } catch (err) {
            console.warn('[ManexViewer] dataBackupManager lookup failed:', err.message);
          }
        }

        // 3) Dernier recours : ce qui est déjà sur l'objet aircraft.
        if (!merged && aircraft.manex) {
          merged = aircraft.manex;
        }

        if (!cancelled) {
          setManexFullData(merged);
          setLoading(false);
        }
      } catch (error) {
        console.error('[ManexViewer] Erreur globale chargement MANEX:', error);
        if (!cancelled) {
          setManexFullData(aircraft.manex || null);
          setLoading(false);
        }
      }
    };

    loadManexData();
    return () => { cancelled = true; };
  }, [aircraft]);

  // On accepte aussi le cas où aircraft.manex est absent mais hasManex=true :
  // le useEffect ci-dessus s'occupe de récupérer les données.
  if (!aircraft) return null;

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'var(--bg-overlay)',
          borderRadius: 'var(--radius-sm)',
          padding: '24px',
          textAlign: 'center'
        }}>
          <p>Chargement des données MANEX...</p>
        </div>
      </div>
    );
  }

  // Utiliser les données complètes ou les métadonnées selon ce qui est disponible.
  // Fallback ultime : objet vide pour éviter les crashes — un message informatif
  // sera affiché si aucune donnée n'a pu être chargée.
  const manex = manexFullData || aircraft.manex || {};
  const hasNothing = !manexFullData && !aircraft.manex;

  // Fonction pour télécharger le PDF original
  const handleDownloadPdf = () => {
    if (manex.pdfData) {
      try {
        // Le pdfData est en base64
        const link = document.createElement('a');
        link.href = manex.pdfData;
        link.download = manex.fileName || `MANEX_${aircraft.registration}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification(
          `📥 Téléchargement du MANEX ${aircraft.registration} démarré`,
          'success',
          3000
        );
      } catch (error) {
        console.error('Erreur lors du téléchargement:', error);
        showNotification(
          '❌ Erreur lors du téléchargement du PDF',
          'error',
          5000
        );
      }
    } else {
      showNotification(
        '⚠️ Le fichier PDF original n\'est pas disponible',
        'warning',
        4000
      );
    }
  };

  // Exporte un dump complet : avion + manex + extraction. Sans le pdfData
  // (qui peut être lourd) sauf si l'utilisateur clique « Télécharger le PDF ».
  const handleExportData = () => {
    try {
      const { pdfData: _omitPdf, ...manexMeta } = manex || {};
      const dataToExport = {
        exportedAt: new Date().toISOString(),
        aircraft: {
          id: aircraft.id,
          registration: aircraft.registration,
          model: aircraft.model,
          manufacturer: aircraft.manufacturer,
          type: aircraft.type,
          homeAeroclub: aircraft.homeAeroclub,
          homeBase: aircraft.homeBase
        },
        manex: manexMeta,
        // Pour debug / inspection : on inclut toute l'extraction et les méta
        // utiles, sans le PDF binaire.
        manexExtraction: aircraft.data?.manexExtraction || null
      };

      const dataStr = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `MANEX_DATA_${aircraft.registration || aircraft.id}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showNotification(
        `📊 Données MANEX exportées pour ${aircraft.registration}`,
        'success',
        3000
      );
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      showNotification(
        '❌ Erreur lors de l\'export des données',
        'error',
        5000
      );
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'var(--bg-overlay)',
        borderRadius: 'var(--radius-sm)',
        padding: '24px',
        maxWidth: '800px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* En-tête */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
            <FileText size={24} style={{ marginRight: '8px' }} />
            MANEX - {aircraft.registration}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Avertissement si aucune donnée trouvée */}
        {hasNothing && (
          <div style={{
            padding: '16px',
            backgroundColor: 'rgba(242, 105, 33, 0.10)',
            border: '1px solid var(--accent-primary)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <AlertTriangle size={20} color="var(--accent-primary)" />
            <div style={{ fontSize: 13, color: 'var(--accent-primary)' }}>
              <strong>Aucune donnée MANEX trouvée pour cet avion.</strong>
              <div style={{ marginTop: 4 }}>
                Le flag <code>hasManex</code> indique qu'un MANEX existe, mais ni
                IndexedDB ni le store local n'ont retrouvé les données. Le PDF
                peut avoir été effacé du cache local. Réimportez-le depuis le
                wizard si nécessaire.
              </div>
            </div>
          </div>
        )}

        {/* Onglets */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '2px solid var(--border-subtle)',
          marginBottom: '20px'
        }}>
          {['info', 'performances', 'limitations', 'charts'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px',
                backgroundColor: activeTab === tab ? 'var(--text-secondary)' : 'transparent',
                color: activeTab === tab ? 'white' : 'var(--text-secondary)',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid var(--text-secondary)' : '2px solid transparent',
                marginBottom: '-2px',
                cursor: 'pointer',
                fontWeight: activeTab === tab ? 'bold' : 'normal',
                textTransform: 'capitalize'
              }}
            >
              {tab === 'info' && <Eye size={16} style={{ display: 'inline', marginRight: '6px' }} />}
              {tab === 'performances' && <BarChart3 size={16} style={{ display: 'inline', marginRight: '6px' }} />}
              {tab === 'limitations' && <AlertTriangle size={16} style={{ display: 'inline', marginRight: '6px' }} />}
              {tab === 'charts' && <Database size={16} style={{ display: 'inline', marginRight: '6px' }} />}
              {tab}
            </button>
          ))}
        </div>

        {/* Contenu des onglets */}
        <div style={{ flex: 1, overflow: 'auto', marginBottom: '20px' }}>
          {/* Onglet Info */}
          {activeTab === 'info' && (
            <div>
              <div style={{ backgroundColor: 'var(--bg-overlay)', padding: '16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
                  Informations du document
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  <div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Nom du fichier</p>
                    <p style={{ fontSize: '14px', fontWeight: '500' }}>{manex.fileName}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Taille</p>
                    <p style={{ fontSize: '14px', fontWeight: '500' }}>{manex.fileSize}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Nombre de pages</p>
                    <p style={{ fontSize: '14px', fontWeight: '500' }}>{manex.pageCount || 'N/A'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Date d'import</p>
                    <p style={{ fontSize: '14px', fontWeight: '500' }}>
                      {manex.uploadDate ? new Date(manex.uploadDate).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
                
                {/* Indicateur de source des données */}
                {manex.dataSource && (
                  <div style={{ 
                    marginTop: '12px', 
                    padding: '8px 12px', 
                    backgroundColor: 'rgba(242, 105, 33, 0.10)', 
                    border: '1px solid var(--bg-overlay)',
                    borderRadius: 'var(--radius-sm)'
                  }}>
                    <p style={{ fontSize: '12px', color: 'var(--accent-primary)', margin: 0 }}>
                      ⚠️ Source des données : {manex.dataSource}
                    </p>
                  </div>
                )}
              </div>

              {/* Sections trouvées */}
              {manex.sections && manex.sections.length > 0 && (
                <div style={{ backgroundColor: 'var(--bg-overlay)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
                    Sections identifiées
                  </h4>
                  <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                    {manex.sections.map((section, idx) => (
                      <div key={idx} style={{ fontSize: '13px', marginBottom: '6px' }}>
                        • Section {section.number}: {section.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Onglet Performances */}
          {activeTab === 'performances' && (
            <div>
              <div style={{ backgroundColor: 'var(--bg-overlay)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
                  Vitesses caractéristiques
                </h4>
                {manex.performances && Object.keys(manex.performances).length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    {Object.entries(manex.performances).map(([key, value]) => (
                      <div key={key} style={{ backgroundColor: 'var(--bg-overlay)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{key.toUpperCase()}</p>
                        <p style={{ fontSize: '16px', fontWeight: 'bold' }}>{value} kt</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Aucune donnée de performance extraite</p>
                )}
              </div>
            </div>
          )}

          {/* Onglet Limitations */}
          {activeTab === 'limitations' && (
            <div>
              <div style={{ backgroundColor: '#fff4ed', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-overlay)' }}>
                <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
                  Limitations opérationnelles
                </h4>
                {manex.limitations && Object.keys(manex.limitations).length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    {Object.entries(manex.limitations).map(([key, value]) => (
                      <div key={key}>
                        <p style={{ fontSize: '12px', color: 'var(--accent-primary)' }}>{key.toUpperCase()}</p>
                        <p style={{ fontSize: '16px', fontWeight: 'bold' }}>{value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '14px', color: 'var(--accent-primary)' }}>Aucune limitation extraite</p>
                )}
              </div>
            </div>
          )}

          {/* Onglet Charts */}
          {activeTab === 'charts' && (
            <div>
              <div style={{ backgroundColor: 'var(--bg-overlay)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
                  Abaques de performances
                </h4>
                {manex.performanceCharts && Object.keys(manex.performanceCharts).length > 0 ? (
                  <div>
                    {Object.entries(manex.performanceCharts).map(([chartType, chart]) => (
                      chart && (
                        <div key={chartType} style={{ marginBottom: '16px', backgroundColor: 'var(--bg-overlay)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                          <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
                            {chartType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          </p>
                          <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                            {chart.pressureAltitudes && (
                              <p>• Altitudes: {chart.pressureAltitudes.join(', ')} ft</p>
                            )}
                            {chart.temperatures && (
                              <p>• Températures: {chart.temperatures.join(', ')} °C</p>
                            )}
                            {chart.unit && (
                              <p>• Unité: {chart.unit}</p>
                            )}
                            {chart.corrections && Object.keys(chart.corrections).length > 0 && (
                              <p>• Corrections: {Object.keys(chart.corrections).join(', ')}</p>
                            )}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Aucun abaque de performance disponible</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Boutons d'action */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {manex.pdfData && (
              <button
                onClick={handleDownloadPdf}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--text-secondary)',
                  color: 'var(--text-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Download size={16} />
                Télécharger le PDF
              </button>
            )}
            <button
              onClick={handleExportData}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--text-primary)',
                color: 'var(--text-primary)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Database size={16} />
              Exporter les données
            </button>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
});

ManexViewer.displayName = 'ManexViewer';

export default ManexViewer;