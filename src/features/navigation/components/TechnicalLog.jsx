// src/features/navigation/components/TechnicalLog.jsx
import React, { memo, useState, useEffect } from 'react';
import { FileText, Save, Clock, AlertTriangle, CheckCircle, User, Calendar, Wrench, PlusCircle, X, Edit2 } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';

export const TechnicalLog = memo(({ selectedAircraft }) => {
  const [logEntries, setLogEntries] = useState([]);
  const [currentEntry, setCurrentEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0].substring(0, 5),
    pilot: '',
    hoursBeforeFlight: '',
    hoursAfterFlight: '',
    observations: '',
    technicalStatus: 'OK', // OK, ATTENTION, GROUNDED
    items: []
  });
  const [showForm, setShowForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);

  // Charger les entrées depuis le localStorage
  useEffect(() => {
    if (selectedAircraft) {
      const saved = localStorage.getItem(`technicalLog_${selectedAircraft.id}`);
      if (saved) {
        setLogEntries(JSON.parse(saved));
      }
    }
  }, [selectedAircraft]);

  // Sauvegarder les entrées
  const saveEntries = (entries) => {
    if (selectedAircraft) {
      localStorage.setItem(`technicalLog_${selectedAircraft.id}`, JSON.stringify(entries));
      setLogEntries(entries);
    }
  };

  // Ajouter un item technique
  const addTechnicalItem = () => {
    setCurrentEntry({
      ...currentEntry,
      items: [...currentEntry.items, { description: '', status: 'OK' }]
    });
  };

  // Retirer un item technique
  const removeTechnicalItem = (index) => {
    setCurrentEntry({
      ...currentEntry,
      items: currentEntry.items.filter((_, i) => i !== index)
    });
  };

  // Mettre à jour un item technique
  const updateTechnicalItem = (index, field, value) => {
    const newItems = [...currentEntry.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setCurrentEntry({ ...currentEntry, items: newItems });
  };

  // Sauvegarder l'entrée
  const saveEntry = () => {
    if (!currentEntry.pilot || !currentEntry.hoursAfterFlight) {
      alert('Veuillez remplir au minimum le nom du pilote et les heures moteur après vol');
      return;
    }

    const newEntry = {
      ...currentEntry,
      id: Date.now(),
      timestamp: new Date().toISOString()
    };

    let updatedEntries;
    if (editingIndex !== null) {
      updatedEntries = [...logEntries];
      updatedEntries[editingIndex] = newEntry;
      setEditingIndex(null);
    } else {
      updatedEntries = [newEntry, ...logEntries];
    }

    saveEntries(updatedEntries);
    
    // Réinitialiser le formulaire
    setCurrentEntry({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0].substring(0, 5),
      pilot: '',
      hoursBeforeFlight: '',
      hoursAfterFlight: '',
      observations: '',
      technicalStatus: 'OK',
      items: []
    });
    setShowForm(false);
  };

  // Éditer une entrée
  const editEntry = (index) => {
    setCurrentEntry(logEntries[index]);
    setEditingIndex(index);
    setShowForm(true);
  };

  // Calculer les heures de vol
  const calculateFlightHours = (before, after) => {
    const beforeHours = parseFloat(before);
    const afterHours = parseFloat(after);
    if (!isNaN(beforeHours) && !isNaN(afterHours) && afterHours > beforeHours) {
      return (afterHours - beforeHours).toFixed(1);
    }
    return '-';
  };

  // Obtenir la couleur du statut
  const getStatusColor = (status) => {
    switch (status) {
      case 'OK': return { bg: '#dcfce7', color: '#166534', icon: <CheckCircle size={16} /> };
      case 'ATTENTION': return { bg: '#fef3c7', color: '#92400e', icon: <AlertTriangle size={16} /> };
      case 'GROUNDED': return { bg: '#fee2e2', color: '#991b1b', icon: <X size={16} /> };
      default: return { bg: '#f3f4f6', color: '#374151', icon: <FileText size={16} /> };
    }
  };

  if (!selectedAircraft) {
    return (
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning)}>
        <AlertTriangle size={16} />
        <p style={sx.text.sm}>
          Sélectionnez un avion pour accéder au log technique
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold)}>
          <Wrench size={18} style={{ marginRight: '8px' }} />
          Log Technique - {selectedAircraft.registration}
        </h3>
        
        <button
          onClick={() => setShowForm(!showForm)}
          style={sx.combine(
            sx.components.button.base,
            sx.components.button.primary
          )}
        >
          {showForm ? <X size={16} /> : <PlusCircle size={16} />}
          {showForm ? 'Annuler' : 'Nouvelle entrée'}
        </button>
      </div>

      {/* Formulaire d'ajout/édition */}
      {showForm && (
        <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4))}>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
            {editingIndex !== null ? 'Modifier l\'entrée' : 'Nouvelle entrée'}
          </h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {/* Date et heure */}
            <div>
              <label style={sx.components.label.base}>
                <Calendar size={14} /> Date
              </label>
              <input
                type="date"
                value={currentEntry.date}
                onChange={(e) => setCurrentEntry({ ...currentEntry, date: e.target.value })}
                style={sx.components.input.base}
              />
            </div>
            
            <div>
              <label style={sx.components.label.base}>
                <Clock size={14} /> Heure
              </label>
              <input
                type="time"
                value={currentEntry.time}
                onChange={(e) => setCurrentEntry({ ...currentEntry, time: e.target.value })}
                style={sx.components.input.base}
              />
            </div>
            
            {/* Pilote */}
            <div>
              <label style={sx.components.label.base}>
                <User size={14} /> Pilote *
              </label>
              <input
                type="text"
                value={currentEntry.pilot}
                onChange={(e) => setCurrentEntry({ ...currentEntry, pilot: e.target.value })}
                placeholder="Nom du pilote"
                style={sx.components.input.base}
              />
            </div>
            
            {/* Statut technique */}
            <div>
              <label style={sx.components.label.base}>
                <FileText size={14} /> Statut technique
              </label>
              <select
                value={currentEntry.technicalStatus}
                onChange={(e) => setCurrentEntry({ ...currentEntry, technicalStatus: e.target.value })}
                style={sx.components.input.base}
              >
                <option value="OK">✅ OK - Avion en état</option>
                <option value="ATTENTION">⚠️ ATTENTION - À surveiller</option>
                <option value="GROUNDED">❌ GROUNDED - Immobilisé</option>
              </select>
            </div>
            
            {/* Heures moteur */}
            <div>
              <label style={sx.components.label.base}>
                ⏱️ Heures avant vol
              </label>
              <input
                type="number"
                step="0.1"
                value={currentEntry.hoursBeforeFlight}
                onChange={(e) => setCurrentEntry({ ...currentEntry, hoursBeforeFlight: e.target.value })}
                placeholder="Ex: 1234.5"
                style={sx.components.input.base}
              />
            </div>
            
            <div>
              <label style={sx.components.label.base}>
                ⏱️ Heures après vol *
              </label>
              <input
                type="number"
                step="0.1"
                value={currentEntry.hoursAfterFlight}
                onChange={(e) => setCurrentEntry({ ...currentEntry, hoursAfterFlight: e.target.value })}
                placeholder="Ex: 1235.8"
                style={sx.components.input.base}
              />
            </div>
          </div>
          
          {/* Heures de vol calculées */}
          {currentEntry.hoursBeforeFlight && currentEntry.hoursAfterFlight && (
            <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mt(3))}>
              <Clock size={16} />
              <p style={sx.text.sm}>
                Temps de vol : <strong>
                  {calculateFlightHours(currentEntry.hoursBeforeFlight, currentEntry.hoursAfterFlight)} heures
                </strong>
              </p>
            </div>
          )}
          
          {/* Items techniques */}
          <div style={sx.spacing.mt(4)}>
            <div style={sx.combine(sx.flex.between, sx.spacing.mb(2))}>
              <label style={sx.components.label.base}>
                🔧 Items techniques à signaler
              </label>
              <button
                onClick={addTechnicalItem}
                style={sx.combine(sx.components.button.base, sx.components.button.secondary, { padding: '4px 8px' })}
              >
                <PlusCircle size={14} />
                Ajouter
              </button>
            </div>
            
            {currentEntry.items.map((item, index) => (
              <div key={index} style={sx.combine(sx.flex.row, sx.spacing.gap(2), sx.spacing.mb(2))}>
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateTechnicalItem(index, 'description', e.target.value)}
                  placeholder="Description de l'anomalie..."
                  style={sx.combine(sx.components.input.base, { flex: 1 })}
                />
                <select
                  value={item.status}
                  onChange={(e) => updateTechnicalItem(index, 'status', e.target.value)}
                  style={sx.combine(sx.components.input.base, { width: '150px' })}
                >
                  <option value="OK">✅ Résolu</option>
                  <option value="ATTENTION">⚠️ À surveiller</option>
                  <option value="GROUNDED">❌ Bloquant</option>
                </select>
                <button
                  onClick={() => removeTechnicalItem(index)}
                  style={sx.combine(sx.components.button.base, sx.components.button.danger, { padding: '8px' })}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          
          {/* Observations */}
          <div style={sx.spacing.mt(4)}>
            <label style={sx.components.label.base}>
              📝 Observations générales
            </label>
            <textarea
              value={currentEntry.observations}
              onChange={(e) => setCurrentEntry({ ...currentEntry, observations: e.target.value })}
              placeholder="Observations, remarques, actions à prévoir..."
              rows={4}
              style={sx.combine(sx.components.input.base, { resize: 'vertical' })}
            />
          </div>
          
          {/* Boutons d'action */}
          <div style={sx.combine(sx.flex.row, sx.spacing.gap(2), sx.spacing.mt(4))}>
            <button
              onClick={saveEntry}
              style={sx.combine(sx.components.button.base, sx.components.button.primary)}
            >
              <Save size={16} />
              {editingIndex !== null ? 'Mettre à jour' : 'Enregistrer'}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingIndex(null);
              }}
              style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste des entrées */}
      <div>
        <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
          Historique des entrées
        </h4>
        
        {logEntries.length === 0 ? (
          <div style={sx.combine(sx.components.alert.base, sx.components.alert.info)}>
            <FileText size={16} />
            <p style={sx.text.sm}>
              Aucune entrée dans le log technique. Cliquez sur "Nouvelle entrée" pour commencer.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {logEntries.slice(0, 5).map((entry, index) => {
              const statusInfo = getStatusColor(entry.technicalStatus);
              const flightHours = calculateFlightHours(entry.hoursBeforeFlight, entry.hoursAfterFlight);
              
              return (
                <div key={entry.id} style={sx.combine(sx.components.card.base, { position: 'relative' })}>
                  {/* En-tête avec statut */}
                  <div style={sx.combine(sx.flex.between, sx.spacing.mb(3))}>
                    <div style={sx.flex.row}>
                      <div style={{
                        backgroundColor: statusInfo.bg,
                        color: statusInfo.color,
                        padding: '4px 12px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}>
                        {statusInfo.icon}
                        {entry.technicalStatus}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => editEntry(index)}
                      style={sx.combine(sx.components.button.base, sx.components.button.secondary, { padding: '6px 12px' })}
                    >
                      <Edit2 size={14} />
                      Modifier
                    </button>
                  </div>
                  
                  {/* Informations principales */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '12px' }}>
                    <div>
                      <div style={sx.combine(sx.text.xs, sx.text.secondary)}>Date & Heure</div>
                      <div style={sx.text.sm}>
                        {new Date(entry.date).toLocaleDateString('fr-FR')} à {entry.time}
                      </div>
                    </div>
                    <div>
                      <div style={sx.combine(sx.text.xs, sx.text.secondary)}>Pilote</div>
                      <div style={sx.text.sm}>{entry.pilot}</div>
                    </div>
                    <div>
                      <div style={sx.combine(sx.text.xs, sx.text.secondary)}>Heures moteur</div>
                      <div style={sx.text.sm}>{entry.hoursAfterFlight || '-'}</div>
                    </div>
                    <div>
                      <div style={sx.combine(sx.text.xs, sx.text.secondary)}>Temps de vol</div>
                      <div style={sx.text.sm}>{flightHours} h</div>
                    </div>
                  </div>
                  
                  {/* Items techniques */}
                  {entry.items && entry.items.length > 0 && (
                    <div style={sx.combine(sx.spacing.mt(3), { borderTop: '1px solid #e5e7eb', paddingTop: '12px' })}>
                      <div style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mb(2))}>
                        Items techniques signalés :
                      </div>
                      {entry.items.map((item, idx) => {
                        const itemStatus = getStatusColor(item.status);
                        return (
                          <div key={idx} style={sx.combine(sx.flex.row, sx.spacing.gap(2), sx.spacing.mb(1))}>
                            <span style={{ color: itemStatus.color }}>{itemStatus.icon}</span>
                            <span style={sx.text.sm}>{item.description}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Observations */}
                  {entry.observations && (
                    <div style={sx.combine(sx.spacing.mt(3), { borderTop: '1px solid #e5e7eb', paddingTop: '12px' })}>
                      <div style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mb(1))}>Observations :</div>
                      <p style={sx.combine(sx.text.sm, { fontStyle: 'italic' })}>{entry.observations}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {/* Afficher plus */}
        {logEntries.length > 5 && (
          <div style={sx.combine(sx.text.center, sx.spacing.mt(3))}>
            <button
              style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
            >
              Voir tout l'historique ({logEntries.length} entrées)
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

TechnicalLog.displayName = 'TechnicalLog';

export default TechnicalLog;