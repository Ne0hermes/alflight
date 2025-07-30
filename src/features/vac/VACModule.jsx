// src/features/vac/VACModule.jsx
import React, { memo, useState, useEffect } from 'react';
import { Map, Download, Trash2, Eye, Info, Search, CheckCircle, AlertTriangle, Clock, HardDrive } from 'lucide-react';
import { useVACStore, vacSelectors } from '@core/stores/vacStore';
import { useNavigation } from '@core/contexts';
import { sx } from '@shared/styles/styleSystem';
import { VACViewer } from './components/VACViewer';
import { VACDataExtractor } from './components/VACDataExtractor';

export const VACModule = memo(() => {
  const { waypoints } = useNavigation();
  const [searchIcao, setSearchIcao] = useState('');
  const [showDetails, setShowDetails] = useState(null);
  const [filter, setFilter] = useState('all'); // all, downloaded, navigation
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(() => {
    // Vérifier si le disclaimer a déjà été accepté
    return localStorage.getItem('vac-disclaimer-accepted') === 'true';
  });
  
  const charts = useVACStore(state => state.charts);
  const availableCharts = vacSelectors.useAvailableCharts();
  const downloadedCharts = vacSelectors.useDownloadedCharts();
  const { initializeChart, downloadChart, deleteChart, selectChart } = vacSelectors.useVACActions();
  
  // Handler pour accepter le disclaimer
  const handleAcceptDisclaimer = () => {
    setDisclaimerAccepted(true);
    localStorage.setItem('vac-disclaimer-accepted', 'true');
  };
  
  // Initialiser les cartes disponibles au montage
  useEffect(() => {
    if (disclaimerAccepted) {
      availableCharts.forEach(icao => initializeChart(icao));
    }
  }, [disclaimerAccepted]);
  
  // Extraire les codes OACI de la navigation
  const navigationIcaos = waypoints
    .map(wp => wp.name)
    .filter(name => name && name.match(/^[A-Z]{4}$/));
  
  // Filtrer les cartes selon le filtre actif
  const getFilteredCharts = () => {
    let filtered = Object.values(charts);
    
    switch (filter) {
      case 'downloaded':
        filtered = filtered.filter(c => c.isDownloaded);
        break;
      case 'navigation':
        filtered = filtered.filter(c => navigationIcaos.includes(c.icao));
        break;
    }
    
    // Appliquer la recherche
    if (searchIcao) {
      filtered = filtered.filter(c => 
        c.icao.includes(searchIcao.toUpperCase()) ||
        c.name.toLowerCase().includes(searchIcao.toLowerCase())
      );
    }
    
    return filtered;
  };
  
  const filteredCharts = getFilteredCharts();
  
  // Statistiques
  const stats = {
    total: Object.keys(charts).length,
    downloaded: downloadedCharts.length,
    totalSize: downloadedCharts.reduce((sum, c) => {
      const size = c.fileSize;
      const numericSize = typeof size === 'string' ? parseFloat(size) : (size || 0);
      return sum + (isNaN(numericSize) ? 0 : numericSize);
    }, 0),
    navigation: navigationIcaos.filter(icao => charts[icao]?.isDownloaded).length
  };
  
  return (
    <div style={sx.spacing.p(6)}>
      {/* Écran de disclaimer si non accepté */}
      {!disclaimerAccepted ? (
        <div style={sx.combine(sx.flex.center, { minHeight: '60vh' })}>
          <div style={{ maxWidth: '800px', width: '100%' }}>
            <div style={sx.combine(
              sx.components.card.base,
              sx.spacing.p(6),
              { borderColor: '#ef4444', borderWidth: '2px' }
            )}>
              <div style={sx.combine(sx.flex.center, sx.spacing.mb(4))}>
                <AlertTriangle size={48} color="#ef4444" />
              </div>
              
              <h3 style={sx.combine(sx.text.xl, sx.text.bold, sx.text.center, sx.spacing.mb(4))}>
                AVERTISSEMENT IMPORTANT - RESPONSABILITÉ DU COMMANDANT DE BORD
              </h3>
              
              <div style={sx.combine(sx.text.base, sx.spacing.mb(6))}>
                <p style={sx.spacing.mb(3)}>
                  <strong>Avant d'utiliser ce module, vous devez comprendre et accepter les conditions suivantes :</strong>
                </p>
                
                <ul style={{ paddingLeft: '24px', lineHeight: '1.8' }}>
                  <li style={sx.spacing.mb(2)}>
                    Les cartes VAC et leurs analyses sont fournies <strong>à titre indicatif uniquement</strong> et ne remplacent en aucun cas les documents officiels
                  </li>
                  <li style={sx.spacing.mb(2)}>
                    Le commandant de bord est <strong>seul responsable</strong> de télécharger et vérifier les cartes VAC officielles depuis le site du Service de l'Information Aéronautique (SIA)
                  </li>
                  <li style={sx.spacing.mb(2)}>
                    Les données extraites peuvent contenir des <strong>erreurs, être incomplètes ou obsolètes</strong>
                  </li>
                  <li style={sx.spacing.mb(2)}>
                    Toute décision opérationnelle reste sous la <strong>responsabilité exclusive du commandant de bord</strong>
                  </li>
                  <li style={sx.spacing.mb(2)}>
                    Vous devez <strong>toujours vérifier</strong> la validité, l'exactitude et la mise à jour des cartes avant utilisation
                  </li>
                  <li style={sx.spacing.mb(2)}>
                    Cette application est un <strong>outil d'aide</strong> et ne peut se substituer au jugement professionnel du pilote
                  </li>
                  <li style={sx.spacing.mb(2)}>
                    Les développeurs de cette application <strong>déclinent toute responsabilité</strong> en cas d'erreur, d'omission ou de mauvaise utilisation
                  </li>
                </ul>
                
                <div style={sx.combine(
                  sx.components.alert.base,
                  sx.components.alert.warning,
                  sx.spacing.mt(4)
                )}>
                  <Info size={20} />
                  <div>
                    <p style={sx.text.sm}>
                      <strong>Rappel réglementaire :</strong> Conformément à la réglementation aéronautique, 
                      le commandant de bord doit s'assurer de disposer de toute la documentation à jour 
                      nécessaire au vol, incluant les cartes VAC officielles.
                    </p>
                  </div>
                </div>
              </div>
              
              <div style={sx.combine(sx.flex.center, sx.spacing.gap(4))}>
                <button
                  onClick={() => window.history.back()}
                  style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
                >
                  ← Retour
                </button>
                
                <button
                  onClick={handleAcceptDisclaimer}
                  style={sx.combine(
                    sx.components.button.base,
                    sx.components.button.primary,
                    { 
                      backgroundColor: '#dc2626',
                      '&:hover': { backgroundColor: '#b91c1c' }
                    }
                  )}
                >
                  J'ai lu et j'accepte ces conditions
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Disclaimer permanent en haut du module */}
          <div style={sx.combine(
            sx.components.alert.base, 
            sx.components.alert.danger, 
            sx.spacing.mb(6),
            { borderWidth: '2px' }
          )}>
            <AlertTriangle size={24} style={{ flexShrink: 0 }} />
            <div>
              <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2))}>
                ⚠️ RAPPEL - RESPONSABILITÉ DU COMMANDANT DE BORD
              </h4>
              <p style={sx.text.sm}>
                Les cartes VAC doivent être téléchargées depuis le site officiel du SIA. 
                Les données affichées ici sont indicatives. Le commandant de bord reste seul responsable de la vérification des informations.
                <button
                  onClick={() => {
                    localStorage.removeItem('vac-disclaimer-accepted');
                    setDisclaimerAccepted(false);
                  }}
                  style={{
                    marginLeft: '12px',
                    fontSize: '12px',
                    color: '#dc2626',
                    textDecoration: 'underline',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Relire l'avertissement complet
                </button>
              </p>
            </div>
          </div>

          {/* Contenu du module */}
          <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
            <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
              <h3 style={sx.combine(sx.text.xl, sx.text.bold)}>
                🗺️ Gestion des cartes VAC
              </h3>
          
          {/* Statistiques */}
          <div style={sx.combine(sx.flex.row, sx.spacing.gap(4), sx.text.sm)}>
            <StatCard 
              icon={Map} 
              value={stats.downloaded} 
              total={stats.total} 
              label="Cartes" 
              color="primary"
            />
            <StatCard 
              icon={HardDrive} 
              value={stats.totalSize.toFixed(1)} 
              label="MB" 
              color="success"
            />
            <StatCard 
              icon={CheckCircle} 
              value={stats.navigation} 
              total={navigationIcaos.length} 
              label="Navigation" 
              color="warning"
            />
          </div>
        </div>
        
        {/* Alerte si cartes manquantes pour la navigation */}
        {navigationIcaos.length > 0 && stats.navigation < navigationIcaos.length && (
          <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, sx.spacing.mb(4))}>
            <AlertTriangle size={20} />
            <div>
              <p style={sx.combine(sx.text.sm, sx.text.bold)}>
                Cartes manquantes pour votre navigation
              </p>
              <p style={sx.text.sm}>
                {navigationIcaos.filter(icao => !charts[icao]?.isDownloaded).join(', ')}
              </p>
            </div>
          </div>
        )}
        
        {/* Barre de recherche et filtres */}
        <div style={sx.combine(sx.flex.row, sx.spacing.gap(3))}>
          {/* Recherche */}
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={16} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: sx.theme.colors.gray[400]
            }} />
            <input
              type="text"
              placeholder="Rechercher par code OACI ou nom..."
              value={searchIcao}
              onChange={(e) => setSearchIcao(e.target.value)}
              style={sx.combine(sx.components.input.base, { paddingLeft: '36px' })}
            />
          </div>
          
          {/* Filtres */}
          <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
            {[
              { value: 'all', label: 'Toutes' },
              { value: 'downloaded', label: 'Téléchargées' },
              { value: 'navigation', label: 'Navigation' }
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                style={sx.combine(
                  sx.components.button.base,
                  filter === f.value ? sx.components.button.primary : sx.components.button.secondary
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </section>
      
      {/* Liste des cartes */}
      <section>
        <div style={{ display: 'grid', gap: '12px' }}>
          {filteredCharts.map(chart => (
            <ChartCard 
              key={chart.icao}
              chart={chart}
              isInNavigation={navigationIcaos.includes(chart.icao)}
              onDownload={() => downloadChart(chart.icao)}
              onDelete={() => deleteChart(chart.icao)}
              onView={() => selectChart(chart.icao)}
              onDetails={() => setShowDetails(showDetails === chart.icao ? null : chart.icao)}
              showDetails={showDetails === chart.icao}
            />
          ))}
        </div>
        
        {filteredCharts.length === 0 && (
          <div style={sx.combine(sx.text.center, sx.text.secondary, sx.spacing.p(8))}>
            {searchIcao ? 'Aucune carte trouvée' : 'Aucune carte dans cette catégorie'}
          </div>
        )}
      </section>
      
      {/* Extracteur de données */}
      <VACDataExtractor />
      
      {/* Note d'information */}
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mt(6))}>
        <Info size={20} />
        <div>
          <p style={sx.combine(sx.text.sm, sx.text.bold)}>
            💡 À propos des cartes VAC
          </p>
          <p style={sx.combine(sx.text.sm, sx.spacing.mt(1))}>
            Les cartes VAC (Visual Approach Charts) contiennent les informations essentielles pour les approches à vue.
            Les données extraites incluent : altitude terrain, caractéristiques des pistes, fréquences radio et altitude de tour de piste.
          </p>
          <p style={sx.combine(sx.text.sm, sx.spacing.mt(2), sx.text.secondary)}>
            Note : En mode démo, les données sont simulées. En production, les cartes PDF seraient téléchargées depuis le SIA.
          </p>
        </div>
      </div>
      
          {/* Visualiseur de cartes */}
          <VACViewer />
        </>
      )}
    </div>
  );
});

// Composant pour une carte statistique
const StatCard = memo(({ icon: Icon, value, total, label, color }) => {
  const colorTheme = sx.theme.colors[color];
  
  return (
    <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
      <Icon size={20} style={{ color: colorTheme[600] }} />
      <div>
        <p style={sx.combine(sx.text.lg, sx.text.bold, { margin: 0 })}>
          {value}{total && <span style={sx.text.secondary}>/{total}</span>}
        </p>
        <p style={sx.combine(sx.text.xs, sx.text.secondary, { margin: 0 })}>
          {label}
        </p>
      </div>
    </div>
  );
});

// Composant pour une carte VAC
const ChartCard = memo(({ chart, isInNavigation, onDownload, onDelete, onView, onDetails, showDetails }) => {
  const isDownloading = vacSelectors.useIsDownloading(chart.icao);
  const error = vacSelectors.useError(chart.icao);
  
  return (
    <div style={sx.combine(
      sx.components.card.base,
      isInNavigation && {
        borderColor: sx.theme.colors.primary[500],
        backgroundColor: sx.theme.colors.primary[50]
      }
    )}>
      <div style={sx.combine(sx.flex.between, sx.spacing.mb(showDetails ? 3 : 0))}>
        {/* Informations principales */}
        <div style={{ flex: 1 }}>
          <div style={sx.combine(sx.flex.start, sx.spacing.gap(3), sx.spacing.mb(2))}>
            <h4 style={sx.combine(sx.text.lg, sx.text.bold, { margin: 0 })}>
              {chart.icao}
              {isInNavigation && (
                <span style={sx.combine(
                  sx.text.xs,
                  sx.spacing.ml(2),
                  {
                    backgroundColor: sx.theme.colors.primary[600],
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '4px'
                  }
                )}>
                  Navigation
                </span>
              )}
            </h4>
            <p style={sx.combine(sx.text.base, sx.text.secondary, { margin: 0 })}>
              {chart.name}
            </p>
          </div>
          
          <div style={sx.combine(sx.text.sm, sx.text.secondary, sx.flex.row, sx.spacing.gap(3))}>
            <span>Lat: {chart.coordinates.lat.toFixed(4)}°</span>
            <span>Lon: {chart.coordinates.lon.toFixed(4)}°</span>
            {chart.isDownloaded && (
              <>
                <span style={sx.combine(sx.flex.start, sx.spacing.gap(1))}>
                  <Clock size={12} />
                  {new Date(chart.downloadDate).toLocaleDateString('fr-FR')}
                </span>
                <span style={sx.combine(sx.flex.start, sx.spacing.gap(1))}>
                  <HardDrive size={12} />
                  {chart.fileSize} MB
                </span>
              </>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
          {!chart.isDownloaded ? (
            <button
              onClick={onDownload}
              disabled={isDownloading}
              style={sx.combine(
                sx.components.button.base,
                sx.components.button.primary,
                isDownloading && { opacity: 0.5, cursor: 'not-allowed' }
              )}
            >
              {isDownloading ? (
                <>
                  <div style={{
                    width: 16,
                    height: 16,
                    border: '2px solid white',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Téléchargement...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Télécharger
                </>
              )}
            </button>
          ) : (
            <>
              <button
                onClick={onView}
                style={sx.combine(sx.components.button.base, sx.components.button.primary)}
              >
                <Eye size={16} />
                Visualiser
              </button>
              <button
                onClick={onDetails}
                style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
              >
                <Info size={16} />
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Supprimer la carte ${chart.icao} ?`)) {
                    onDelete();
                  }
                }}
                style={sx.combine(sx.components.button.base, sx.components.button.danger)}
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Erreur */}
      {error && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.danger, sx.spacing.mt(3))}>
          <AlertTriangle size={16} />
          <p style={sx.text.sm}>{error}</p>
        </div>
      )}
      
      {/* Détails extraits */}
      {showDetails && chart.isDownloaded && chart.extractedData && (
        <ExtractedDataDetails data={chart.extractedData} />
      )}
    </div>
  );
});

// Composant pour afficher les données extraites
const ExtractedDataDetails = memo(({ data }) => {
  return (
    <div style={sx.combine(
      sx.spacing.mt(3),
      sx.spacing.pt(3),
      { borderTop: `1px solid ${sx.theme.colors.gray[200]}` }
    )}>
      <h5 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
        📊 Données extraites
      </h5>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
        {/* Informations générales */}
        <div style={sx.components.card.base}>
          <h6 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
            Informations terrain
          </h6>
          <div style={sx.combine(sx.text.sm, sx.text.secondary)}>
            <p style={{ margin: '4px 0' }}>
              Altitude : <strong>{data.airportElevation} ft</strong>
            </p>
            {data.circuitAltitude && (
              <p style={{ margin: '4px 0' }}>
                Tour de piste : <strong>{data.circuitAltitude} ft</strong>
              </p>
            )}
            <p style={{ margin: '4px 0' }}>
              Variation magnétique : <strong>{data.magneticVariation}°</strong>
            </p>
          </div>
        </div>
        
        {/* Fréquences */}
        <div style={sx.components.card.base}>
          <h6 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
            Fréquences radio
          </h6>
          <div style={sx.combine(sx.text.sm, sx.text.secondary)}>
            {Object.entries(data.frequencies).map(([type, freq]) => (
              <p key={type} style={{ margin: '4px 0' }}>
                {type.toUpperCase()} : <strong>{freq} MHz</strong>
              </p>
            ))}
          </div>
        </div>
      </div>
      
      {/* Pistes */}
      {data.runways.length > 0 && (
        <div style={sx.combine(sx.spacing.mt(3))}>
          <h6 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
            Caractéristiques des pistes
          </h6>
          <div style={{ display: 'grid', gap: '8px' }}>
            {data.runways.map((rwy, idx) => (
              <div key={idx} style={sx.combine(
                sx.spacing.p(2),
                sx.bg.gray,
                sx.rounded.md,
                sx.text.sm
              )}>
                <div style={sx.combine(sx.flex.between)}>
                  <strong>Piste {rwy.identifier}</strong>
                  <span style={sx.text.secondary}>QFU {rwy.qfu}°</span>
                </div>
                <div style={sx.combine(sx.text.secondary, sx.spacing.mt(1))}>
                  {rwy.length} × {rwy.width} m • {rwy.surface}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// Export des display names
VACModule.displayName = 'VACModule';
StatCard.displayName = 'StatCard';
ChartCard.displayName = 'ChartCard';
ExtractedDataDetails.displayName = 'ExtractedDataDetails';

export default VACModule;