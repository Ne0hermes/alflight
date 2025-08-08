// src/features/pilot/components/PilotLogbook.jsx
import React, { useState, useEffect } from 'react';
import { FileText, Plus, Download, Trash2, Edit2, Plane, Clock, MapPin, Moon, Sun, Search } from 'lucide-react';
// Style system removed - using inline styles
import { useAircraftStore } from '../../../core/stores/aircraftStore';

const PilotLogbook = () => {
  const { aircraftList } = useAircraftStore();
  const [entries, setEntries] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAircraftData, setSelectedAircraftData] = useState(null);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    aircraft: '',
    departure: '',
    arrival: '',
    
    // Heures
    blockOff: '',
    takeOff: '',
    landing: '',
    blockOn: '',
    totalTime: '',
    
    // Fonction à bord
    pic: false,
    dualCommand: false,
    copilot: false,
    dualReceived: false,
    instructor: false,
    examiner: false,
    
    // Type de vol
    singleEngine: true,
    multiEngine: false,
    turboprop: false,
    jet: false,
    
    // Conditions
    dayLandings: 0,
    nightLandings: 0,
    nightTime: 0,
    ifrTime: 0,
    actualIMC: 0,
    simulatedIMC: 0,
    crossCountry: false,
    
    // Autres
    pilotName: '',
    remarks: ''
  });

  // Charger les entrées depuis localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pilotLogbook');
    if (saved) {
      setEntries(JSON.parse(saved));
    }
  }, []);

  // Calculer automatiquement le temps total
  useEffect(() => {
    if (formData.blockOff && formData.blockOn) {
      const off = new Date(`1970-01-01T${formData.blockOff}`);
      const on = new Date(`1970-01-01T${formData.blockOn}`);
      const diff = (on - off) / (1000 * 60 * 60); // en heures
      
      if (diff > 0) {
        setFormData(prev => ({
          ...prev,
          totalTime: diff.toFixed(1)
        }));
      }
    }
  }, [formData.blockOff, formData.blockOn]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Si on sélectionne un avion, récupérer ses infos
    if (field === 'aircraft' && value && value !== 'OTHER') {
      const aircraft = aircraftList.find(a => a.registration === value);
      if (aircraft) {
        setSelectedAircraftData(aircraft);
      }
    } else if (field === 'aircraft' && value === 'OTHER') {
      setSelectedAircraftData(null);
    }
  };

  const handleSubmit = () => {
    // Si "Autre avion" est sélectionné, utiliser la valeur personnalisée
    const finalAircraft = formData.aircraft === 'OTHER' ? formData.aircraftCustom : formData.aircraft;
    
    const entry = {
      ...formData,
      aircraft: finalAircraft,
      id: editingEntry ? editingEntry.id : Date.now(),
      createdAt: editingEntry ? editingEntry.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    delete entry.aircraftCustom; // Ne pas stocker le champ temporaire

    let newEntries;
    if (editingEntry) {
      newEntries = entries.map(e => e.id === editingEntry.id ? entry : e);
    } else {
      newEntries = [...entries, entry];
    }

    // Trier par date
    newEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    setEntries(newEntries);
    localStorage.setItem('pilotLogbook', JSON.stringify(newEntries));
    
    resetForm();
    
    // Mettre à jour l'expérience du pilote automatiquement
    const profile = JSON.parse(localStorage.getItem('pilotProfile') || '{}');
    if (profile.firstName) {
      // Déclencher une mise à jour du profil
      window.dispatchEvent(new Event('logbook-updated'));
    }
    
    alert(editingEntry ? 'Entrée modifiée avec succès !' : 'Vol enregistré dans le carnet !');
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      aircraft: '',
      departure: '',
      arrival: '',
      blockOff: '',
      takeOff: '',
      landing: '',
      blockOn: '',
      totalTime: '',
      pic: false,
      dualCommand: false,
      copilot: false,
      dualReceived: false,
      instructor: false,
      examiner: false,
      singleEngine: true,
      multiEngine: false,
      turboprop: false,
      jet: false,
      aircraftCustom: '',
      dayLandings: 0,
      nightLandings: 0,
      nightTime: 0,
      ifrTime: 0,
      actualIMC: 0,
      simulatedIMC: 0,
      crossCountry: false,
      pilotName: '',
      remarks: ''
    });
    setEditingEntry(null);
    setShowForm(false);
    setSelectedAircraftData(null);
  };

  const handleEdit = (entry) => {
    setFormData(entry);
    setEditingEntry(entry);
    setShowForm(true);
    
    // Vérifier si l'avion existe dans la liste
    const aircraft = aircraftList.find(a => a.registration === entry.aircraft);
    if (aircraft) {
      setSelectedAircraftData(aircraft);
    }
  };

  const handleDelete = (id) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette entrée ?')) {
      const newEntries = entries.filter(e => e.id !== id);
      setEntries(newEntries);
      localStorage.setItem('pilotLogbook', JSON.stringify(newEntries));
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(entries, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `pilot-logbook-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Calculer les totaux
  const calculateTotals = () => {
    const totals = {
      totalHours: 0,
      picHours: 0,
      copilotHours: 0,
      nightHours: 0,
      ifrHours: 0,
      dayLandings: 0,
      nightLandings: 0,
      approaches: 0
    };

    entries.forEach(entry => {
      totals.totalHours += parseFloat(entry.totalTime) || 0;
      if (entry.pic) totals.picHours += parseFloat(entry.totalTime) || 0;
      if (entry.copilot) totals.copilotHours += parseFloat(entry.totalTime) || 0;
      totals.nightHours += parseFloat(entry.nightTime) || 0;
      totals.ifrHours += parseFloat(entry.ifrTime) || 0;
      totals.dayLandings += parseInt(entry.dayLandings) || 0;
      totals.nightLandings += parseInt(entry.nightLandings) || 0;
      totals.approaches += (parseInt(entry.ilsApproaches) || 0) + 
                          (parseInt(entry.vorApproaches) || 0) + 
                          (parseInt(entry.ndbApproaches) || 0) + 
                          (parseInt(entry.gpsApproaches) || 0);
    });

    return totals;
  };

  const totals = calculateTotals();

  // Filtrer les entrées
  const filteredEntries = entries.filter(entry => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!entry.aircraft?.toLowerCase().includes(search) &&
          !entry.departure?.toLowerCase().includes(search) &&
          !entry.arrival?.toLowerCase().includes(search) &&
          !entry.remarks?.toLowerCase().includes(search)) {
        return false;
      }
    }

    if (filter === 'pic' && !entry.pic) return false;
    if (filter === 'night' && !entry.nightTime) return false;
    if (filter === 'ifr' && !entry.ifrTime) return false;
    if (filter === 'crossCountry' && !entry.crossCountry) return false;

    return true;
  });

  const inputStyle = {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    width: '100%',
    backgroundColor: 'white'
  };

  const labelStyle = {
    fontSize: '12px',
    color: '#374151',
    fontWeight: '500',
    marginBottom: '4px',
    display: 'block'
  };

  return (
    <div>
      {/* En-tête avec statistiques */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>
            <FileText size={20} style={{ display: 'inline', marginRight: '8px' }} />
            Carnet de Vol Digital
          </h3>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowForm(!showForm)}
              style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              Nouveau vol
            </button>
            
            {entries.length > 0 && (
              <button
                onClick={handleExport}
                style={{ padding: '8px 16px', backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={16} />
                Exporter
              </button>
            )}
          </div>
        </div>

        {/* Statistiques globales */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
          gap: '16px',
          padding: '16px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px'
        }}>
          <div>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>Total heures</p>
            <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{totals.totalHours.toFixed(1)}</p>
          </div>
          <div>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>Heures CDB</p>
            <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{totals.picHours.toFixed(1)}</p>
          </div>
          <div>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>Heures OPL</p>
            <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{totals.copilotHours.toFixed(1)}</p>
          </div>
          <div>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>Heures nuit</p>
            <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{totals.nightHours.toFixed(1)}</p>
          </div>
          <div>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>Heures IFR</p>
            <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{totals.ifrHours.toFixed(1)}</p>
          </div>
          <div>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>Att. jour</p>
            <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{totals.dayLandings}</p>
          </div>
          <div>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>Att. nuit</p>
            <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{totals.nightLandings}</p>
          </div>
          <div>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>Approches</p>
            <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{totals.approaches}</p>
          </div>
        </div>
      </div>

      {/* Formulaire d'ajout/édition */}
      {showForm && (
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '16px' }}>
          <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
            {editingEntry ? 'Modifier le vol' : 'Enregistrer un vol'}
          </h4>


          {/* Informations générales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={labelStyle}>Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                style={inputStyle}
                required
              />
            </div>
            
            <div>
              <label style={labelStyle}>Avion *</label>
              <select
                value={formData.aircraft}
                onChange={(e) => handleChange('aircraft', e.target.value)}
                style={inputStyle}
                required
              >
                <option value="">Sélectionner un avion...</option>
                {aircraftList.map(aircraft => (
                  <option key={aircraft.id} value={aircraft.registration}>
                    {aircraft.registration} - {aircraft.model}
                  </option>
                ))}
                <option value="OTHER">Autre avion (non enregistré)</option>
              </select>
              {formData.aircraft === 'OTHER' && (
                <input
                  type="text"
                  value={formData.aircraftCustom || ''}
                  onChange={(e) => handleChange('aircraftCustom', e.target.value)}
                  placeholder="Immatriculation..."
                  style={{...inputStyle, marginTop: '8px'}}
                />
              )}
            </div>
            
            <div>
              <label style={labelStyle}>Type {selectedAircraftData && '(auto)'}</label>
              <input
                type="text"
                value={formData.aircraftType}
                onChange={(e) => handleChange('aircraftType', e.target.value)}
                placeholder="C172, PA28..."
                style={selectedAircraftData ? {...inputStyle, backgroundColor: '#f3f4f6'} : inputStyle}
                disabled={!!selectedAircraftData}
              />
            </div>
            
            <div>
              <label style={labelStyle}>Nom du pilote</label>
              <input
                type="text"
                value={formData.pilotName}
                onChange={(e) => handleChange('pilotName', e.target.value)}
                placeholder="CDB ou instructeur"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Route */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={labelStyle}>Départ *</label>
              <input
                type="text"
                value={formData.departure}
                onChange={(e) => handleChange('departure', e.target.value)}
                placeholder="LFXX"
                style={inputStyle}
                required
              />
            </div>
            
            <div>
              <label style={labelStyle}>Arrivée *</label>
              <input
                type="text"
                value={formData.arrival}
                onChange={(e) => handleChange('arrival', e.target.value)}
                placeholder="LFXX"
                style={inputStyle}
                required
              />
            </div>
            
            <div>
              <label style={labelStyle}>Route / Escales</label>
              <input
                type="text"
                value={formData.route}
                onChange={(e) => handleChange('route', e.target.value)}
                placeholder="Via LFXX, LFYY..."
                style={inputStyle}
              />
            </div>
          </div>

          {/* Heures */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={labelStyle}>Block Off</label>
              <input
                type="time"
                value={formData.blockOff}
                onChange={(e) => handleChange('blockOff', e.target.value)}
                style={inputStyle}
              />
            </div>
            
            <div>
              <label style={labelStyle}>Décollage</label>
              <input
                type="time"
                value={formData.takeOff}
                onChange={(e) => handleChange('takeOff', e.target.value)}
                style={inputStyle}
              />
            </div>
            
            <div>
              <label style={labelStyle}>Atterrissage</label>
              <input
                type="time"
                value={formData.landing}
                onChange={(e) => handleChange('landing', e.target.value)}
                style={inputStyle}
              />
            </div>
            
            <div>
              <label style={labelStyle}>Block On</label>
              <input
                type="time"
                value={formData.blockOn}
                onChange={(e) => handleChange('blockOn', e.target.value)}
                style={inputStyle}
              />
            </div>
            
            <div>
              <label style={labelStyle}>Temps total *</label>
              <input
                type="number"
                value={formData.totalTime}
                onChange={(e) => handleChange('totalTime', e.target.value)}
                step="0.1"
                style={{...inputStyle, backgroundColor: '#fef3c7'}}
                required
              />
            </div>
          </div>

          {/* Fonction à bord */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Fonction à bord</label>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {[
                { key: 'pic', label: 'CDB/P1' },
                { key: 'copilot', label: 'OPL/P2' },
                { key: 'dualCommand', label: 'Double commande' },
                { key: 'dualReceived', label: 'Instruction reçue' },
                { key: 'instructor', label: 'Instructeur' },
                { key: 'examiner', label: 'Examinateur' }
              ].map(item => (
                <label key={item.key} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData[item.key]}
                    onChange={(e) => handleChange(item.key, e.target.checked)}
                    style={{ marginRight: '6px' }}
                  />
                  <span style={{ fontSize: '14px' }}>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Type d'avion */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Type d'avion</label>
            <div style={{ display: 'flex', gap: '16px' }}>
              {[
                { key: 'singleEngine', label: 'Monomoteur' },
                { key: 'multiEngine', label: 'Multimoteur' },
                { key: 'turboprop', label: 'Turboprop' },
                { key: 'jet', label: 'Jet' }
              ].map(item => (
                <label key={item.key} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData[item.key]}
                    onChange={(e) => handleChange(item.key, e.target.checked)}
                    style={{ marginRight: '6px' }}
                  />
                  <span style={{ fontSize: '14px' }}>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Conditions de vol */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={labelStyle}>Att. jour</label>
              <input
                type="number"
                value={formData.dayLandings}
                onChange={(e) => handleChange('dayLandings', e.target.value)}
                min="0"
                style={inputStyle}
              />
            </div>
            
            <div>
              <label style={labelStyle}>Att. nuit</label>
              <input
                type="number"
                value={formData.nightLandings}
                onChange={(e) => handleChange('nightLandings', e.target.value)}
                min="0"
                style={inputStyle}
              />
            </div>
            
            <div>
              <label style={labelStyle}>Temps nuit</label>
              <input
                type="number"
                value={formData.nightTime}
                onChange={(e) => handleChange('nightTime', e.target.value)}
                step="0.1"
                min="0"
                style={inputStyle}
              />
            </div>
            
            <div>
              <label style={labelStyle}>Temps IFR</label>
              <input
                type="number"
                value={formData.ifrTime}
                onChange={(e) => handleChange('ifrTime', e.target.value)}
                step="0.1"
                min="0"
                style={inputStyle}
              />
            </div>
            
            <div>
              <label style={labelStyle}>IMC réel</label>
              <input
                type="number"
                value={formData.actualIMC}
                onChange={(e) => handleChange('actualIMC', e.target.value)}
                step="0.1"
                min="0"
                style={inputStyle}
              />
            </div>
            
            <div>
              <label style={labelStyle}>IMC simulé</label>
              <input
                type="number"
                value={formData.simulatedIMC}
                onChange={(e) => handleChange('simulatedIMC', e.target.value)}
                step="0.1"
                min="0"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Approches */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={labelStyle}>ILS</label>
              <input
                type="number"
                value={formData.ilsApproaches}
                onChange={(e) => handleChange('ilsApproaches', e.target.value)}
                min="0"
                style={inputStyle}
              />
            </div>
            
            <div>
              <label style={labelStyle}>VOR</label>
              <input
                type="number"
                value={formData.vorApproaches}
                onChange={(e) => handleChange('vorApproaches', e.target.value)}
                min="0"
                style={inputStyle}
              />
            </div>
            
            <div>
              <label style={labelStyle}>NDB</label>
              <input
                type="number"
                value={formData.ndbApproaches}
                onChange={(e) => handleChange('ndbApproaches', e.target.value)}
                min="0"
                style={inputStyle}
              />
            </div>
            
            <div>
              <label style={labelStyle}>GPS/RNAV</label>
              <input
                type="number"
                value={formData.gpsApproaches}
                onChange={(e) => handleChange('gpsApproaches', e.target.value)}
                min="0"
                style={inputStyle}
              />
            </div>
            
            <div>
              <label style={{ display: 'flex', alignItems: 'center', marginTop: '24px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.crossCountry}
                  onChange={(e) => handleChange('crossCountry', e.target.checked)}
                  style={{ marginRight: '6px' }}
                />
                <span style={{ fontSize: '14px' }}>Vol voyage</span>
              </label>
            </div>
          </div>

          {/* Remarques */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Remarques</label>
            <textarea
              value={formData.remarks}
              onChange={(e) => handleChange('remarks', e.target.value)}
              placeholder="Conditions météo, observations, exercices..."
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Boutons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSubmit}
              style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
            >
              {editingEntry ? 'Modifier' : 'Enregistrer'}
            </button>
            
            <button
              onClick={resetForm}
              style={{ padding: '8px 16px', backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Filtres et recherche */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher..."
                style={{...inputStyle, paddingLeft: '36px', width: '200px'}}
              />
            </div>
            
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="all">Tous les vols</option>
              <option value="pic">CDB uniquement</option>
              <option value="night">Vols de nuit</option>
              <option value="ifr">Vols IFR</option>
              <option value="crossCountry">Vols voyage</option>
            </select>
          </div>
          
          <p style={{ fontSize: '14px' }}>
            {filteredEntries.length} vol(s) trouvé(s)
          </p>
        </div>
      </div>

      {/* Liste des vols */}
      {filteredEntries.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredEntries.map(entry => (
            <div key={entry.id} style={{ backgroundColor: 'white', padding: '12px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <strong style={{ marginRight: '12px' }}>{entry.date}</strong>
                  <span style={{ fontSize: '16px', marginRight: '12px' }}>
                    {entry.departure} → {entry.arrival}
                  </span>
                  <span style={{ color: '#6b7280', fontSize: '14px' }}>
                    {entry.aircraft} ({entry.aircraftType})
                  </span>
                </div>
                
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => handleEdit(entry)}
                    style={{ padding: '4px 8px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    style={{ padding: '4px 8px', backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              
              <div style={{ fontSize: '14px', display: 'flex', gap: '16px' }}>
                <span>
                  <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  {entry.totalTime}h
                </span>
                
                {entry.pic && <span style={{ color: '#3b82f6' }}>CDB</span>}
                {entry.copilot && <span>OPL</span>}
                {entry.instructor && <span style={{ color: '#10b981' }}>FI</span>}
                
                {entry.nightTime > 0 && (
                  <span>
                    <Moon size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    {entry.nightTime}h nuit
                  </span>
                )}
                
                {entry.ifrTime > 0 && (
                  <span>IFR {entry.ifrTime}h</span>
                )}
                
                {(entry.dayLandings > 0 || entry.nightLandings > 0) && (
                  <span>
                    {entry.dayLandings > 0 && `${entry.dayLandings} att. jour`}
                    {entry.dayLandings > 0 && entry.nightLandings > 0 && ', '}
                    {entry.nightLandings > 0 && `${entry.nightLandings} att. nuit`}
                  </span>
                )}
                
                {entry.crossCountry && <span>✈️ Voyage</span>}
              </div>
              
              {entry.remarks && (
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  💬 {entry.remarks}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ backgroundColor: 'white', textAlign: 'center', padding: '32px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <Plane size={48} style={{ margin: '0 auto 16px', color: '#9ca3af' }} />
          <p style={{ fontSize: '16px' }}>Aucun vol enregistré</p>
          <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>
            Cliquez sur "Nouveau vol" pour commencer à remplir votre carnet
          </p>
        </div>
      )}
    </div>
  );
};

export default PilotLogbook;