import React, { useState, useEffect, useCallback, memo } from 'react';
import { Clock, Calendar, User, Plane, Fuel, FileText, Download, Plus, Trash2, Save } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';

const TechnicalLog = memo(({ selectedAircraft }) => {
  // État pour les entrées du log
  const [currentEntry, setCurrentEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    pilotName: '',
    aircraftReg: selectedAircraft?.registration || '',
    blockOffTime: '',
    blockOnTime: '',
    takeoffTime: '',
    landingTime: '',
    departureAirport: '',
    arrivalAirport: '',
    hobbsStart: '',
    hobbsEnd: '',
    tachStart: '',
    tachEnd: '',
    oilAdded: '',
    fuelAdded: '',
    remarks: ''
  });

  const [logs, setLogs] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Charger les logs depuis localStorage
  useEffect(() => {
    const savedLogs = localStorage.getItem('technicalLogs');
    if (savedLogs) {
      setLogs(JSON.parse(savedLogs));
    }
  }, []);

  // Mettre à jour l'immatriculation quand l'avion change
  useEffect(() => {
    if (selectedAircraft?.registration) {
      setCurrentEntry(prev => ({
        ...prev,
        aircraftReg: selectedAircraft.registration
      }));
    }
  }, [selectedAircraft]);

  // Calculer automatiquement les temps
  const calculateFlightTime = useCallback(() => {
    if (currentEntry.takeoffTime && currentEntry.landingTime) {
      const takeoff = new Date(`1970-01-01T${currentEntry.takeoffTime}`);
      const landing = new Date(`1970-01-01T${currentEntry.landingTime}`);
      const diff = (landing - takeoff) / (1000 * 60); // en minutes
      
      if (diff > 0) {
        const hours = Math.floor(diff / 60);
        const minutes = diff % 60;
        return `${hours}h${String(minutes).padStart(2, '0')}`;
      }
    }
    return '';
  }, [currentEntry.takeoffTime, currentEntry.landingTime]);

  const calculateBlockTime = useCallback(() => {
    if (currentEntry.blockOffTime && currentEntry.blockOnTime) {
      const blockOff = new Date(`1970-01-01T${currentEntry.blockOffTime}`);
      const blockOn = new Date(`1970-01-01T${currentEntry.blockOnTime}`);
      const diff = (blockOn - blockOff) / (1000 * 60); // en minutes
      
      if (diff > 0) {
        const hours = Math.floor(diff / 60);
        const minutes = diff % 60;
        return `${hours}h${String(minutes).padStart(2, '0')}`;
      }
    }
    return '';
  }, [currentEntry.blockOffTime, currentEntry.blockOnTime]);

  // Handlers
  const handleInputChange = (field, value) => {
    setCurrentEntry(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveEntry = () => {
    if (!currentEntry.pilotName || !currentEntry.date) {
      alert('Veuillez remplir au minimum la date et le nom du pilote');
      return;
    }

    const newEntry = {
      ...currentEntry,
      id: Date.now(),
      flightTime: calculateFlightTime(),
      blockTime: calculateBlockTime(),
      hobbsTime: currentEntry.hobbsEnd && currentEntry.hobbsStart ? 
        (parseFloat(currentEntry.hobbsEnd) - parseFloat(currentEntry.hobbsStart)).toFixed(1) : '',
      tachTime: currentEntry.tachEnd && currentEntry.tachStart ? 
        (parseFloat(currentEntry.tachEnd) - parseFloat(currentEntry.tachStart)).toFixed(1) : ''
    };

    const updatedLogs = [...logs, newEntry];
    setLogs(updatedLogs);
    localStorage.setItem('technicalLogs', JSON.stringify(updatedLogs));

    // Réinitialiser le formulaire
    setCurrentEntry({
      date: new Date().toISOString().split('T')[0],
      pilotName: currentEntry.pilotName, // Garder le nom du pilote
      aircraftReg: selectedAircraft?.registration || '',
      blockOffTime: '',
      blockOnTime: '',
      takeoffTime: '',
      landingTime: '',
      departureAirport: '',
      arrivalAirport: '',
      hobbsStart: '',
      hobbsEnd: '',
      tachStart: '',
      tachEnd: '',
      oilAdded: '',
      fuelAdded: '',
      remarks: ''
    });

    alert('Entrée sauvegardée avec succès !');
  };

  const handleDeleteLog = (id) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette entrée ?')) {
      const updatedLogs = logs.filter(log => log.id !== id);
      setLogs(updatedLogs);
      localStorage.setItem('technicalLogs', JSON.stringify(updatedLogs));
    }
  };

  const handleExportLogs = () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `technical-logs-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const flightTime = calculateFlightTime();
  const blockTime = calculateBlockTime();

  return (
    <div>
      <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
        <h4 style={sx.combine(sx.text.lg, sx.text.bold)}>
          <FileText size={20} style={{ display: 'inline', marginRight: '8px' }} />
          Log technique
        </h4>
        
        <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
          >
            {showHistory ? 'Masquer' : 'Afficher'} l'historique ({logs.length})
          </button>
          
          {logs.length > 0 && (
            <button
              onClick={handleExportLogs}
              style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
            >
              <Download size={16} />
              Exporter
            </button>
          )}
        </div>
      </div>

      {/* Formulaire de saisie */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
        {/* Informations générales */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div>
            <label style={sx.components.label.base}>
              <Calendar size={14} /> Date
            </label>
            <input
              type="date"
              value={currentEntry.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              style={sx.components.input.base}
            />
          </div>
          
          <div>
            <label style={sx.components.label.base}>
              <User size={14} /> Pilote
            </label>
            <input
              type="text"
              value={currentEntry.pilotName}
              onChange={(e) => handleInputChange('pilotName', e.target.value)}
              placeholder="Nom du pilote"
              style={sx.components.input.base}
            />
          </div>
          
          <div>
            <label style={sx.components.label.base}>
              <Plane size={14} /> Immatriculation
            </label>
            <input
              type="text"
              value={currentEntry.aircraftReg}
              onChange={(e) => handleInputChange('aircraftReg', e.target.value)}
              placeholder="F-XXXX"
              style={sx.components.input.base}
            />
          </div>
        </div>

        {/* Temps de vol */}
        <h5 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>Temps de vol</h5>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div>
            <label style={sx.components.label.base}>
              <Clock size={14} /> Block Off / Block On
            </label>
            <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
              <input
                type="time"
                value={currentEntry.blockOffTime}
                onChange={(e) => handleInputChange('blockOffTime', e.target.value)}
                style={sx.components.input.base}
              />
              <input
                type="time"
                value={currentEntry.blockOnTime}
                onChange={(e) => handleInputChange('blockOnTime', e.target.value)}
                style={sx.components.input.base}
              />
            </div>
            {blockTime && (
              <p style={sx.combine(sx.text.xs, sx.text.success, sx.spacing.mt(1))}>
                Temps block: {blockTime}
              </p>
            )}
          </div>
          
          <div>
            <label style={sx.components.label.base}>
              <Plane size={14} /> Décollage / Atterrissage
            </label>
            <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
              <input
                type="time"
                value={currentEntry.takeoffTime}
                onChange={(e) => handleInputChange('takeoffTime', e.target.value)}
                style={sx.components.input.base}
              />
              <input
                type="time"
                value={currentEntry.landingTime}
                onChange={(e) => handleInputChange('landingTime', e.target.value)}
                style={sx.components.input.base}
              />
            </div>
            {flightTime && (
              <p style={sx.combine(sx.text.xs, sx.text.success, sx.spacing.mt(1))}>
                Temps de vol: {flightTime}
              </p>
            )}
          </div>
        </div>

        {/* Aérodromes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div>
            <label style={sx.components.label.base}>Départ</label>
            <input
              type="text"
              value={currentEntry.departureAirport}
              onChange={(e) => handleInputChange('departureAirport', e.target.value)}
              placeholder="LFXX"
              style={sx.components.input.base}
            />
          </div>
          
          <div>
            <label style={sx.components.label.base}>Arrivée</label>
            <input
              type="text"
              value={currentEntry.arrivalAirport}
              onChange={(e) => handleInputChange('arrivalAirport', e.target.value)}
              placeholder="LFXX"
              style={sx.components.input.base}
            />
          </div>
        </div>

        {/* Compteurs */}
        <h5 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>Compteurs</h5>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div>
            <label style={sx.components.label.base}>Hobbs (Début / Fin)</label>
            <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
              <input
                type="number"
                step="0.1"
                value={currentEntry.hobbsStart}
                onChange={(e) => handleInputChange('hobbsStart', e.target.value)}
                placeholder="0000.0"
                style={sx.components.input.base}
              />
              <input
                type="number"
                step="0.1"
                value={currentEntry.hobbsEnd}
                onChange={(e) => handleInputChange('hobbsEnd', e.target.value)}
                placeholder="0000.0"
                style={sx.components.input.base}
              />
            </div>
          </div>
          
          <div>
            <label style={sx.components.label.base}>Tach (Début / Fin)</label>
            <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
              <input
                type="number"
                step="0.1"
                value={currentEntry.tachStart}
                onChange={(e) => handleInputChange('tachStart', e.target.value)}
                placeholder="0000.0"
                style={sx.components.input.base}
              />
              <input
                type="number"
                step="0.1"
                value={currentEntry.tachEnd}
                onChange={(e) => handleInputChange('tachEnd', e.target.value)}
                placeholder="0000.0"
                style={sx.components.input.base}
              />
            </div>
          </div>
        </div>

        {/* Huile et carburant */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div>
            <label style={sx.components.label.base}>
              <Fuel size={14} /> Huile ajoutée (L)
            </label>
            <input
              type="number"
              step="0.1"
              value={currentEntry.oilAdded}
              onChange={(e) => handleInputChange('oilAdded', e.target.value)}
              placeholder="0.0"
              style={sx.components.input.base}
            />
          </div>
          
          <div>
            <label style={sx.components.label.base}>
              <Fuel size={14} /> Carburant ajouté (L)
            </label>
            <input
              type="number"
              step="0.1"
              value={currentEntry.fuelAdded}
              onChange={(e) => handleInputChange('fuelAdded', e.target.value)}
              placeholder="0.0"
              style={sx.components.input.base}
            />
          </div>
        </div>

        {/* Remarques */}
        <div style={{ marginBottom: '24px' }}>
          <label style={sx.components.label.base}>Remarques</label>
          <textarea
            value={currentEntry.remarks}
            onChange={(e) => handleInputChange('remarks', e.target.value)}
            placeholder="Conditions de vol, observations..."
            rows={3}
            style={sx.combine(sx.components.input.base, { resize: 'vertical' })}
          />
        </div>

        {/* Bouton sauvegarder */}
        <button
          onClick={handleSaveEntry}
          style={sx.combine(sx.components.button.base, sx.components.button.primary)}
        >
          <Save size={16} />
          Enregistrer l'entrée
        </button>
      </div>

      {/* Historique */}
      {showHistory && logs.length > 0 && (
        <div style={sx.combine(sx.spacing.mt(6))}>
          <h5 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
            Historique des vols
          </h5>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {logs.slice().reverse().map(log => (
              <div key={log.id} style={sx.combine(sx.components.card.base, sx.spacing.p(3))}>
                <div style={sx.combine(sx.flex.between, sx.spacing.mb(2))}>
                  <div>
                    <strong>{log.date}</strong> - {log.pilotName} - {log.aircraftReg}
                  </div>
                  <button
                    onClick={() => handleDeleteLog(log.id)}
                    style={sx.combine(sx.components.button.base, sx.components.button.danger, { padding: '4px 8px' })}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                
                <div style={sx.combine(sx.text.sm, sx.text.secondary)}>
                  {log.departureAirport && log.arrivalAirport && (
                    <div>{log.departureAirport} → {log.arrivalAirport}</div>
                  )}
                  {log.flightTime && <div>Temps de vol: {log.flightTime}</div>}
                  {log.blockTime && <div>Temps block: {log.blockTime}</div>}
                  {(log.fuelAdded || log.oilAdded) && (
                    <div>
                      {log.fuelAdded && `Carburant: ${log.fuelAdded}L`}
                      {log.fuelAdded && log.oilAdded && ' - '}
                      {log.oilAdded && `Huile: ${log.oilAdded}L`}
                    </div>
                  )}
                  {log.remarks && <div style={sx.spacing.mt(1)}>"{log.remarks}"</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

TechnicalLog.displayName = 'TechnicalLog';

export default TechnicalLog;