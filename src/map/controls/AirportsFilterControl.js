// Contrôle Leaflet pour filtrer les aérodromes
import L from 'leaflet';

class AirportsFilterControl extends L.Control {
  constructor(options = {}) {
    super(options);
    this.layer = options.layer;
    this.onFiltersChange = options.onFiltersChange;
    this.container = null;
    this.collapsed = true;
    this.loading = false;
    this.error = null;
    this.count = { visible: 0, total: 0 };
  }

  onAdd(map) {
    this.container = L.DomUtil.create('div', 'leaflet-control-airports-filter leaflet-bar');
    
    // Empêcher la propagation des événements de la carte
    L.DomEvent.disableClickPropagation(this.container);
    L.DomEvent.disableScrollPropagation(this.container);

    this.update();
    return this.container;
  }

  update() {
    const html = `
      <div class="airports-filter-header" id="airports-filter-toggle">
        <span class="filter-icon">✈️</span>
        <span class="filter-title">Aérodromes</span>
        <span class="filter-count">${this.count.visible}/${this.count.total}</span>
        ${this.loading ? '<span class="loading-spinner">⏳</span>' : ''}
        <span class="toggle-icon">${this.collapsed ? '▼' : '▲'}</span>
      </div>
      
      <div class="airports-filter-body" style="display: ${this.collapsed ? 'none' : 'block'};">
        ${this.error ? `<div class="filter-error">⚠️ ${this.error}</div>` : ''}
        
        <div class="filter-section">
          <label class="filter-label">Recherche</label>
          <input type="text" 
                 id="airport-search" 
                 placeholder="Nom, ICAO, IATA, ville..." 
                 class="filter-input">
        </div>

        <div class="filter-section">
          <label class="filter-label">Types d'aérodrome</label>
          <select id="airport-types" multiple class="filter-select">
            <option value="0">Aéroport international</option>
            <option value="1">Aéroport régional</option>
            <option value="2">Aérodrome</option>
            <option value="3">Terrain privé</option>
            <option value="4">Héliport</option>
            <option value="5">Altiport</option>
            <option value="6">Planeur</option>
            <option value="7">ULM</option>
            <option value="8">Hydravion</option>
          </select>
        </div>

        <div class="filter-section">
          <label class="filter-checkbox">
            <input type="checkbox" id="show-without-icao">
            <span>Afficher terrains sans ICAO</span>
          </label>
        </div>

        <div class="filter-section">
          <label class="filter-label">Longueur piste min (m)</label>
          <input type="number" 
                 id="min-runway-length" 
                 placeholder="ex: 800" 
                 min="0" 
                 step="100"
                 class="filter-input">
        </div>

        <div class="filter-section">
          <label class="filter-label">Surface de piste</label>
          <select id="runway-surface" class="filter-select">
            <option value="">Toutes</option>
            <option value="asphalt">Asphalte</option>
            <option value="concrete">Béton</option>
            <option value="grass">Herbe</option>
            <option value="gravel">Gravier</option>
            <option value="sand">Sable</option>
            <option value="water">Eau</option>
          </select>
        </div>

        <div class="filter-section">
          <label class="filter-checkbox">
            <input type="checkbox" id="ifr-only">
            <span>IFR uniquement</span>
          </label>
          <label class="filter-checkbox">
            <input type="checkbox" id="vfr-night-only">
            <span>VFR nuit uniquement</span>
          </label>
        </div>

        <div class="filter-actions">
          <button id="apply-filters" class="filter-button primary">Appliquer</button>
          <button id="reset-filters" class="filter-button">Réinitialiser</button>
        </div>
      </div>

      <style>
        .leaflet-control-airports-filter {
          background: white;
          border-radius: 5px;
          box-shadow: 0 1px 5px rgba(0,0,0,0.4);
          padding: 0;
          min-width: 250px;
          max-width: 300px;
        }
        
        .airports-filter-header {
          padding: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          border-bottom: 1px solid #ddd;
          user-select: none;
        }
        
        .airports-filter-header:hover {
          background: #f5f5f5;
        }
        
        .filter-icon {
          font-size: 18px;
        }
        
        .filter-title {
          flex: 1;
          font-weight: bold;
          font-size: 14px;
        }
        
        .filter-count {
          background: #0066CC;
          color: white;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 11px;
        }
        
        .loading-spinner {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .toggle-icon {
          color: #666;
        }
        
        .airports-filter-body {
          padding: 10px;
          max-height: 400px;
          overflow-y: auto;
        }
        
        .filter-error {
          background: #fff3cd;
          border: 1px solid #ffc107;
          color: #856404;
          padding: 6px;
          border-radius: 3px;
          margin-bottom: 10px;
          font-size: 12px;
        }
        
        .filter-section {
          margin-bottom: 12px;
        }
        
        .filter-label {
          display: block;
          font-size: 12px;
          font-weight: bold;
          margin-bottom: 4px;
          color: #333;
        }
        
        .filter-input,
        .filter-select {
          width: 100%;
          padding: 4px 6px;
          border: 1px solid #ddd;
          border-radius: 3px;
          font-size: 12px;
        }
        
        .filter-select[multiple] {
          height: 80px;
        }
        
        .filter-checkbox {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          cursor: pointer;
          margin-bottom: 6px;
        }
        
        .filter-checkbox input {
          cursor: pointer;
        }
        
        .filter-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #ddd;
        }
        
        .filter-button {
          flex: 1;
          padding: 6px 12px;
          border: 1px solid #ddd;
          border-radius: 3px;
          font-size: 12px;
          cursor: pointer;
          background: white;
        }
        
        .filter-button:hover {
          background: #f5f5f5;
        }
        
        .filter-button.primary {
          background: #0066CC;
          color: white;
          border-color: #0066CC;
        }
        
        .filter-button.primary:hover {
          background: #0052A3;
        }
      </style>
    `;

    this.container.innerHTML = html;
    this.attachEvents();
  }

  attachEvents() {
    // Toggle collapse/expand
    const header = this.container.querySelector('#airports-filter-toggle');
    if (header) {
      L.DomEvent.on(header, 'click', () => {
        this.collapsed = !this.collapsed;
        this.update();
      });
    }

    // Apply filters button
    const applyBtn = this.container.querySelector('#apply-filters');
    if (applyBtn) {
      L.DomEvent.on(applyBtn, 'click', () => this.applyFilters());
    }

    // Reset filters button
    const resetBtn = this.container.querySelector('#reset-filters');
    if (resetBtn) {
      L.DomEvent.on(resetBtn, 'click', () => this.resetFilters());
    }

    // Search on Enter key
    const searchInput = this.container.querySelector('#airport-search');
    if (searchInput) {
      L.DomEvent.on(searchInput, 'keypress', (e) => {
        if (e.key === 'Enter') {
          this.applyFilters();
        }
      });
    }
  }

  applyFilters() {
    const filters = {
      search: this.container.querySelector('#airport-search').value,
      types: Array.from(this.container.querySelector('#airport-types').selectedOptions).map(o => parseInt(o.value)),
      showWithoutICAO: this.container.querySelector('#show-without-icao').checked,
      minRunwayLength: parseInt(this.container.querySelector('#min-runway-length').value) || 0,
      runwaySurface: this.container.querySelector('#runway-surface').value,
      ifrOnly: this.container.querySelector('#ifr-only').checked,
      vfrNightOnly: this.container.querySelector('#vfr-night-only').checked
    };

    if (this.onFiltersChange) {
      this.onFiltersChange(filters);
    }
  }

  resetFilters() {
    // Réinitialiser les champs
    this.container.querySelector('#airport-search').value = '';
    this.container.querySelector('#airport-types').selectedIndex = -1;
    this.container.querySelector('#show-without-icao').checked = false;
    this.container.querySelector('#min-runway-length').value = '';
    this.container.querySelector('#runway-surface').value = '';
    this.container.querySelector('#ifr-only').checked = false;
    this.container.querySelector('#vfr-night-only').checked = false;

    // Appliquer les filtres vides
    this.applyFilters();
  }

  updateCount(visible, total) {
    this.count = { visible, total };
    const countElement = this.container.querySelector('.filter-count');
    if (countElement) {
      countElement.textContent = `${visible}/${total}`;
    }
  }

  setLoading(loading) {
    this.loading = loading;
    const spinner = this.container.querySelector('.loading-spinner');
    if (spinner) {
      spinner.style.display = loading ? 'inline' : 'none';
    }
  }

  setError(error) {
    this.error = error;
    this.update();
  }

  onRemove(map) {
    // Nettoyer les événements si nécessaire
  }
}

export default AirportsFilterControl;