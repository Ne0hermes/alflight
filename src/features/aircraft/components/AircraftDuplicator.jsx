// Composant pour dupliquer un avion existant
import React, { useState, useEffect } from 'react';
import { Copy, Plane, Check, AlertCircle } from 'lucide-react';
import { duplicateAircraft, getAvailableAircraftForDuplication } from '@utils/duplicateAircraft';
import { theme } from '../../../styles/theme';

const styles = {
  container: {
    padding: '24px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    maxWidth: '800px',
    margin: '0 auto'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: `2px solid ${theme.colors.primary[100]}`
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: theme.colors.textPrimary,
    margin: 0
  },
  section: {
    marginBottom: '24px'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: '8px'
  },
  select: {
    width: '100%',
    padding: '12px',
    fontSize: '14px',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '6px',
    backgroundColor: 'white',
    cursor: 'pointer',
    outline: 'none',
    transition: 'border-color 0.2s',
    ':focus': {
      borderColor: theme.colors.primary[500]
    }
  },
  input: {
    width: '100%',
    padding: '12px',
    fontSize: '14px',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '16px'
  },
  button: {
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '600',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    justifyContent: 'center',
    transition: 'all 0.2s'
  },
  buttonPrimary: {
    backgroundColor: theme.colors.primary[500],
    color: 'white',
    ':hover': {
      backgroundColor: theme.colors.primary[600]
    }
  },
  buttonDisabled: {
    backgroundColor: theme.colors.border,
    color: theme.colors.textSecondary,
    cursor: 'not-allowed'
  },
  alert: {
    padding: '12px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px'
  },
  alertSuccess: {
    backgroundColor: theme.colors.success[50],
    color: theme.colors.success[900],
    border: `1px solid ${theme.colors.success[200]}`
  },
  alertError: {
    backgroundColor: theme.colors.danger[50],
    color: theme.colors.danger[900],
    border: `1px solid ${theme.colors.danger[200]}`
  },
  alertInfo: {
    backgroundColor: theme.colors.info[50],
    color: theme.colors.info[900],
    border: `1px solid ${theme.colors.info[200]}`
  },
  sourceInfo: {
    padding: '16px',
    backgroundColor: theme.colors.primary[50],
    borderRadius: '6px',
    border: `1px solid ${theme.colors.primary[200]}`,
    marginTop: '16px'
  },
  sourceInfoTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: theme.colors.primary[700],
    marginBottom: '8px'
  },
  sourceInfoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
    fontSize: '13px',
    color: theme.colors.textSecondary
  }
};

export const AircraftDuplicator = ({ onSuccess }) => {
  const [availableAircrafts, setAvailableAircrafts] = useState([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [selectedSource, setSelectedSource] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [newDetails, setNewDetails] = useState({
    registration: '',
    model: '',
    manufacturer: '',
    category: 'SEP',
    aircraftType: 'Avion'
  });

  // Charger les avions disponibles au montage
  useEffect(() => {
    loadAvailableAircrafts();
  }, []);

  const loadAvailableAircrafts = async () => {
    try {
      setIsLoading(true);
      const aircrafts = await getAvailableAircraftForDuplication();
      setAvailableAircrafts(aircrafts);
    } catch (err) {
      setError('Erreur lors du chargement des avions: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSourceChange = (e) => {
    const sourceId = e.target.value;
    setSelectedSourceId(sourceId);

    const source = availableAircrafts.find(a => a.id === sourceId);
    setSelectedSource(source);

    // Réinitialiser les champs
    setNewDetails({
      registration: '',
      model: source?.model || '',
      manufacturer: source?.manufacturer || '',
      category: source?.category || 'SEP',
      aircraftType: 'Avion'
    });

    setError(null);
    setSuccess(false);
  };

  const handleInputChange = (field, value) => {
    setNewDetails(prev => ({
      ...prev,
      [field]: value
    }));
    setError(null);
    setSuccess(false);
  };

  const handleDuplicate = async () => {
    // Validation
    if (!selectedSourceId) {
      setError('Veuillez sélectionner un avion source');
      return;
    }

    if (!newDetails.registration) {
      setError('L\'immatriculation est obligatoire');
      return;
    }

    if (!newDetails.model) {
      setError('Le modèle est obligatoire');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSuccess(false);

      await duplicateAircraft(selectedSourceId, newDetails);

      setSuccess(true);

      // Réinitialiser le formulaire
      setSelectedSourceId('');
      setSelectedSource(null);
      setNewDetails({
        registration: '',
        model: '',
        manufacturer: '',
        category: 'SEP',
        aircraftType: 'Avion'
      });

      // Callback de succès
      if (onSuccess) {
        onSuccess();
      }

      // Recharger la liste des avions
      setTimeout(() => {
        loadAvailableAircrafts();
      }, 1000);

    } catch (err) {
      setError('Erreur lors de la duplication: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = selectedSourceId && newDetails.registration && newDetails.model;

  return (
    <div style={styles.container}>
      {/* En-tête */}
      <div style={styles.header}>
        <Copy size={28} color={theme.colors.primary[500]} />
        <div>
          <h2 style={styles.title}>Dupliquer un Avion</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: theme.colors.textSecondary }}>
            Créer un nouvel avion à partir d'un avion existant
          </p>
        </div>
      </div>

      {/* Alertes */}
      {success && (
        <div style={{ ...styles.alert, ...styles.alertSuccess }}>
          <Check size={20} />
          <span><strong>Succès!</strong> L'avion a été dupliqué avec succès.</span>
        </div>
      )}

      {error && (
        <div style={{ ...styles.alert, ...styles.alertError }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Info */}
      <div style={{ ...styles.alert, ...styles.alertInfo }}>
        <AlertCircle size={20} />
        <span>
          Sélectionnez un avion existant comme modèle, puis personnalisez les informations pour créer un nouvel avion.
        </span>
      </div>

      {/* Sélection de l'avion source */}
      <div style={styles.section}>
        <label style={styles.label}>
          <Plane size={16} style={{ display: 'inline', marginRight: '8px' }} />
          Avion source (modèle)
        </label>
        <select
          style={styles.select}
          value={selectedSourceId}
          onChange={handleSourceChange}
          disabled={isLoading}
        >
          <option value="">-- Sélectionner un avion --</option>
          {availableAircrafts.map(aircraft => (
            <option key={aircraft.id} value={aircraft.id}>
              {aircraft.registration} - {aircraft.manufacturer} {aircraft.model} ({aircraft.category})
            </option>
          ))}
        </select>

        {/* Informations de l'avion source */}
        {selectedSource && (
          <div style={styles.sourceInfo}>
            <div style={styles.sourceInfoTitle}>📋 Informations de l'avion source</div>
            <div style={styles.sourceInfoGrid}>
              <div><strong>Immatriculation:</strong> {selectedSource.registration}</div>
              <div><strong>Modèle:</strong> {selectedSource.model}</div>
              <div><strong>Constructeur:</strong> {selectedSource.manufacturer}</div>
              <div><strong>Catégorie:</strong> {selectedSource.category}</div>
              <div><strong>MANEX:</strong> {selectedSource.hasManex ? '✅ Oui' : '❌ Non'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Formulaire de duplication */}
      {selectedSourceId && (
        <>
          <div style={styles.section}>
            <label style={styles.label}>Immatriculation du nouvel avion *</label>
            <input
              type="text"
              style={styles.input}
              placeholder="F-XXXX"
              value={newDetails.registration}
              onChange={(e) => handleInputChange('registration', e.target.value.toUpperCase())}
              disabled={isLoading}
            />
          </div>

          <div style={styles.row}>
            <div>
              <label style={styles.label}>Modèle *</label>
              <input
                type="text"
                style={styles.input}
                placeholder="DA40 NG"
                value={newDetails.model}
                onChange={(e) => handleInputChange('model', e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <label style={styles.label}>Constructeur</label>
              <input
                type="text"
                style={styles.input}
                placeholder="Diamond"
                value={newDetails.manufacturer}
                onChange={(e) => handleInputChange('manufacturer', e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div style={styles.row}>
            <div>
              <label style={styles.label}>Catégorie</label>
              <select
                style={styles.select}
                value={newDetails.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                disabled={isLoading}
              >
                <option value="SEP">SEP (Monomoteur Piston)</option>
                <option value="MEP">MEP (Multimoteur Piston)</option>
                <option value="SET">SET (Monomoteur Turbine)</option>
                <option value="MET">MET (Multimoteur Turbine)</option>
                <option value="TMG">TMG (Motoplaneur)</option>
              </select>
            </div>
            <div>
              <label style={styles.label}>Type</label>
              <select
                style={styles.select}
                value={newDetails.aircraftType}
                onChange={(e) => handleInputChange('aircraftType', e.target.value)}
                disabled={isLoading}
              >
                <option value="Avion">Avion</option>
                <option value="Hélicoptère">Hélicoptère</option>
                <option value="ULM">ULM</option>
              </select>
            </div>
          </div>

          {/* Bouton de duplication */}
          <button
            style={{
              ...styles.button,
              ...(isFormValid && !isLoading ? styles.buttonPrimary : styles.buttonDisabled)
            }}
            onClick={handleDuplicate}
            disabled={!isFormValid || isLoading}
          >
            <Copy size={20} />
            <span>{isLoading ? 'Duplication en cours...' : 'Dupliquer l\'avion'}</span>
          </button>

          <div style={{ marginTop: '16px', fontSize: '13px', color: theme.colors.textSecondary }}>
            ℹ️ <strong>Note:</strong> Toutes les données de l'avion source (masse, centrage, performances, etc.)
            seront copiées. Vous pourrez les modifier après la création dans l'éditeur d'avion.
          </div>
        </>
      )}
    </div>
  );
};

export default AircraftDuplicator;
