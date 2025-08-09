// Couche Leaflet pour afficher les aérodromes OpenAIP
import L from 'leaflet';
import 'leaflet.markercluster';
import airportsClient from '../../services/openaipAirportsClient';
import { debounce } from '../../utils/debounce';
import AirportsFilterControl from '../controls/AirportsFilterControl';

class OpenAIPAirportsLayer {
  constructor(map, options = {}) {
    this.map = map;
    this.options = {
      minZoom: 6, // Zoom minimum abaissé pour voir plus d'aérodromes
      debounceDelay: 400,
      clusteringThreshold: 100, // Nombre de marqueurs avant clustering
      ...options
    };

    // État de la couche
    this.state = {
      filters: this.getDefaultFilters(),
      loading: false,
      error: null,
      airports: [],
      visibleAirports: []
    };

    // Groupes de couches
    this.layerGroup = L.layerGroup();
    this.markers = new Map(); // Map d'ID -> marker
    
    // Initialiser le clustering si beaucoup de points
    this.useCluster = false;
    this.clusterGroup = null;

    // Contrôle de filtres
    this.filterControl = null;

    // Gestionnaire de mouvement de carte avec debounce
    this.debouncedRefresh = debounce(this.refresh.bind(this), this.options.debounceDelay);

    // Initialiser
    this.init();
  }

  getDefaultFilters() {
    return {
      showWithoutICAO: false,
      types: [], // Tous les types par défaut
      minRunwayLength: 0,
      runwaySurface: null,
      ifrOnly: false,
      vfrNightOnly: false,
      search: ''
    };
  }

  init() {
    // Ajouter la couche à la carte
    this.layerGroup.addTo(this.map);

    // Créer et ajouter le contrôle de filtres
    this.filterControl = new AirportsFilterControl({
      position: 'topright',
      layer: this,
      onFiltersChange: this.handleFiltersChange.bind(this)
    });
    this.filterControl.addTo(this.map);

    // Écouter les événements de la carte
    this.map.on('moveend', this.handleMapMove.bind(this));
    this.map.on('zoomend', this.handleZoomChange.bind(this));

    // Charger les données initiales
    this.refresh();
  }

  handleMapMove() {
    if (this.map.getZoom() >= this.options.minZoom) {
      this.debouncedRefresh();
    }
  }

  handleZoomChange() {
    if (this.map.getZoom() < this.options.minZoom) {
      this.clearMarkers();
    } else {
      this.debouncedRefresh();
    }
  }

  handleFiltersChange(filters) {
    this.state.filters = { ...this.state.filters, ...filters };
    this.applyFilters();
  }

  async refresh() {
    // Ne pas charger si zoom insuffisant
    if (this.map.getZoom() < this.options.minZoom) {
      return;
    }

    // Récupérer la bbox visible
    const bounds = this.map.getBounds();
    const bbox = {
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth()
    };

    // Mettre à jour l'état de chargement
    this.setLoading(true);

    try {
      // Récupérer les aérodromes depuis l'API
      const airports = await airportsClient.getAirportsByBbox(bbox, this.state.filters);
      
      // Stocker les données
      this.state.airports = airports;
      
      // Appliquer les filtres et afficher
      this.applyFilters();
      
      this.setLoading(false);
    } catch (error) {
      console.error('Erreur lors du chargement des aérodromes:', error);
      this.setError(error.message);
      this.setLoading(false);
    }
  }

  applyFilters() {
    // Filtrer les aérodromes côté client
    const filtered = airportsClient.filterAirports(this.state.airports, this.state.filters);
    this.state.visibleAirports = filtered;

    // Mettre à jour l'affichage
    this.renderMarkers(filtered);

    // Mettre à jour le compteur dans le contrôle
    if (this.filterControl) {
      this.filterControl.updateCount(filtered.length, this.state.airports.length);
    }
  }

  renderMarkers(airports) {
    // Nettoyer les marqueurs existants
    this.clearMarkers();

    // Décider si on utilise le clustering
    this.useCluster = airports.length > this.options.clusteringThreshold;

    if (this.useCluster && !this.clusterGroup) {
      // Créer le groupe de clustering si nécessaire
      this.clusterGroup = L.markerClusterGroup({
        chunkedLoading: true,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        maxClusterRadius: 50
      });
      this.map.addLayer(this.clusterGroup);
    }

    // Créer les marqueurs
    const markers = airports.map(airport => this.createMarker(airport));

    // Ajouter les marqueurs
    if (this.useCluster && this.clusterGroup) {
      this.clusterGroup.addLayers(markers);
    } else {
      markers.forEach(marker => {
        marker.addTo(this.layerGroup);
      });
    }
  }

  createMarker(airport) {
    // Créer l'icône en fonction du type et des caractéristiques
    const icon = this.createIcon(airport);

    // Créer le marqueur
    const marker = L.marker([airport.position[1], airport.position[0]], {
      icon: icon,
      title: `${airport.name} ${airport.icao ? `(${airport.icao})` : ''}`
    });

    // Ajouter la popup
    const popupContent = this.createPopupContent(airport);
    marker.bindPopup(popupContent, {
      maxWidth: 350,
      className: 'airport-popup'
    });

    // Stocker la référence
    this.markers.set(airport.id, marker);

    return marker;
  }

  createIcon(airport) {
    // Déterminer la couleur et le style selon le type et les capacités
    let color = '#0066CC'; // Bleu par défaut
    let opacity = 1;
    let size = 24;

    // Aérodromes sans ICAO : plus petits et transparents
    if (!airport.hasICAO) {
      opacity = 0.6;
      size = 18;
      color = '#999999';
    }
    // IFR capable : vert
    else if (airport.isIFRCapable) {
      color = '#00AA00';
      size = 28;
    }
    // VFR nuit : orange
    else if (airport.isVFRNightCapable) {
      color = '#FF6600';
    }

    // Déterminer le symbole selon le type
    let symbol = '✈️';
    const type = airport.type;
    if (type === 4 || type === 'HELIPORT') {
      symbol = '🚁';
    } else if (type === 6 || type === 'GLIDER') {
      symbol = '🛩️';
    } else if (type === 7 || type === 'ULM') {
      symbol = '🪂';
    } else if (type === 8 || type === 'SEAPLANE') {
      symbol = '🛥️';
    }

    // Créer une icône HTML
    return L.divIcon({
      html: `<div style="
        background-color: ${color};
        opacity: ${opacity};
        color: white;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${size * 0.6}px;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">${symbol}</div>`,
      className: 'airport-marker',
      iconSize: [size, size],
      iconAnchor: [size/2, size/2]
    });
  }

  createPopupContent(airport) {
    // Construire le contenu HTML de la popup
    const runwaysHtml = airport.runways.length > 0 ? `
      <div class="popup-section">
        <h4>Pistes</h4>
        <table class="runway-table">
          ${airport.runways.map(rwy => `
            <tr>
              <td><strong>${rwy.direction || 'N/A'}</strong></td>
              <td>${rwy.length}${rwy.lengthUnit} × ${rwy.width}${rwy.widthUnit}</td>
              <td>${rwy.surface}</td>
              <td>${rwy.lighted ? '💡' : ''}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    ` : '';

    const frequenciesHtml = airport.frequencies.length > 0 ? `
      <div class="popup-section">
        <h4>Fréquences</h4>
        <table class="frequency-table">
          ${airport.frequencies.map(freq => `
            <tr>
              <td><strong>${freq.type}</strong></td>
              <td>${freq.frequency} ${freq.frequencyUnit}</td>
              <td>${freq.name || ''}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    ` : '';

    return `
      <div class="airport-popup-content">
        <h3>${airport.name}</h3>
        <div class="airport-codes">
          ${airport.icao ? `<span class="code icao">ICAO: ${airport.icao}</span>` : ''}
          ${airport.iata ? `<span class="code iata">IATA: ${airport.iata}</span>` : ''}
        </div>
        
        <div class="popup-section">
          <table class="info-table">
            ${airport.city ? `<tr><td>Ville:</td><td>${airport.city}</td></tr>` : ''}
            ${airport.country ? `<tr><td>Pays:</td><td>${airport.country}</td></tr>` : ''}
            <tr><td>Altitude:</td><td>${airport.elevation || 'N/A'} ${airport.elevationUnit}</td></tr>
            <tr><td>Position:</td><td>${airport.position[1].toFixed(5)}°, ${airport.position[0].toFixed(5)}°</td></tr>
            <tr><td>IFR:</td><td>${airport.isIFRCapable ? '✅' : '❌'}</td></tr>
            <tr><td>VFR Nuit:</td><td>${airport.isVFRNightCapable ? '✅' : '❌'}</td></tr>
          </table>
        </div>

        ${runwaysHtml}
        ${frequenciesHtml}

        <div class="popup-actions">
          <button onclick="navigator.clipboard.writeText('${airport.position[1]},${airport.position[0]}')">
            📋 Copier coordonnées
          </button>
          <button onclick="window.open('https://www.openaip.net/airport/${airport.id}', '_blank')">
            🔗 Voir sur OpenAIP
          </button>
        </div>
      </div>
      
      <style>
        .airport-popup-content { font-size: 12px; }
        .airport-popup-content h3 { margin: 0 0 8px 0; color: #0066CC; }
        .airport-codes { margin-bottom: 8px; }
        .code { 
          display: inline-block; 
          padding: 2px 6px; 
          margin-right: 6px;
          background: #f0f0f0; 
          border-radius: 3px; 
          font-family: monospace;
        }
        .popup-section { 
          margin-top: 10px; 
          padding-top: 10px; 
          border-top: 1px solid #ddd; 
        }
        .popup-section h4 { 
          margin: 0 0 6px 0; 
          font-size: 11px; 
          color: #666; 
        }
        .info-table, .runway-table, .frequency-table { 
          width: 100%; 
          font-size: 11px; 
        }
        .info-table td, .runway-table td, .frequency-table td { 
          padding: 2px 4px; 
        }
        .info-table td:first-child { 
          font-weight: bold; 
          width: 40%; 
        }
        .popup-actions { 
          margin-top: 10px; 
          display: flex; 
          gap: 6px; 
        }
        .popup-actions button { 
          flex: 1; 
          padding: 4px 8px; 
          font-size: 11px; 
          border: 1px solid #ddd; 
          background: white; 
          border-radius: 3px; 
          cursor: pointer; 
        }
        .popup-actions button:hover { 
          background: #f0f0f0; 
        }
      </style>
    `;
  }

  clearMarkers() {
    // Nettoyer les marqueurs
    if (this.clusterGroup) {
      this.clusterGroup.clearLayers();
    }
    this.layerGroup.clearLayers();
    this.markers.clear();
  }

  setLoading(loading) {
    this.state.loading = loading;
    if (this.filterControl) {
      this.filterControl.setLoading(loading);
    }
  }

  setError(error) {
    this.state.error = error;
    if (this.filterControl) {
      this.filterControl.setError(error);
    }
  }

  destroy() {
    // Nettoyer les événements
    this.map.off('moveend', this.handleMapMove.bind(this));
    this.map.off('zoomend', this.handleZoomChange.bind(this));

    // Annuler les requêtes en cours
    if (this.debouncedRefresh) {
      this.debouncedRefresh.cancel();
    }

    // Retirer les couches
    this.clearMarkers();
    if (this.clusterGroup) {
      this.map.removeLayer(this.clusterGroup);
    }
    this.map.removeLayer(this.layerGroup);

    // Retirer le contrôle
    if (this.filterControl) {
      this.map.removeControl(this.filterControl);
    }

    // Vider le cache
    airportsClient.clearCache();
  }
}

export default OpenAIPAirportsLayer;