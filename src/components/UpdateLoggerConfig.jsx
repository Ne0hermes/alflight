import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  Save,
  CheckCircle,
  AlertCircle,
  Info,
  FileText,
  Upload,
  Settings,
  Download,
  Eye,
  X
} from 'lucide-react';
import updateLogger, {
  logUpdate,
  configureLogger,
  initializeLogger,
  exportLogs
} from '../services/updateLoggerService';

const UpdateLoggerConfig = () => {
  const [showConfig, setShowConfig] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [clientId, setClientId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [folderId, setFolderId] = useState('');
  const [driveEnabled, setDriveEnabled] = useState(false);
  const [logs, setLogs] = useState([]);
  const [testStatus, setTestStatus] = useState(null);

  useEffect(() => {
    // Charger la configuration
    const savedClientId = localStorage.getItem('googleClientId') || '';
    const savedApiKey = localStorage.getItem('googleApiKey') || '';
    const savedFolderId = localStorage.getItem('driveFolderId') || '';
    const savedEnabled = localStorage.getItem('driveLoggingEnabled') === 'true';

    setClientId(savedClientId);
    setApiKey(savedApiKey);
    setFolderId(savedFolderId);
    setDriveEnabled(savedEnabled);

    // Charger les logs
    const savedLogs = JSON.parse(localStorage.getItem('updateLogs') || '[]');
    setLogs(savedLogs);
  }, []);

  const handleSave = async () => {
    configureLogger({
      clientId,
      apiKey,
      folderId,
      enabled: driveEnabled
    });

    if (driveEnabled && clientId && apiKey) {
      await initializeLogger();
    }

    alert('Configuration sauvegardée !');
    setShowConfig(false);
  };

  const handleTest = async () => {
    setTestStatus('testing');

    try {
      const result = await logUpdate({
        title: 'Test de connexion Google Drive',
        summary: 'Vérification de la connexion et de l\'envoi de logs vers Google Drive',
        features: ['Test de connexion'],
        details: ['Test effectué le ' + new Date().toLocaleString('fr-FR')]
      });

      if (result) {
        setTestStatus('success');
        // Recharger les logs
        const updatedLogs = JSON.parse(localStorage.getItem('updateLogs') || '[]');
        setLogs(updatedLogs);
      } else {
        setTestStatus('error');
      }
    } catch (error) {
      setTestStatus('error');
      console.error('Erreur test:', error);
    }

    setTimeout(() => setTestStatus(null), 3000);
  };

  const handleCreateSummary = async () => {
    // Créer un résumé de la dernière session de travail
    const summary = prompt('Entrez un résumé de vos dernières modifications:');
    if (!summary) return;

    const features = prompt('Nouvelles fonctionnalités (séparez par des virgules):');
    const fixes = prompt('Corrections apportées (séparez par des virgules):');

    await logUpdate({
      title: 'Mise à jour manuelle',
      summary: summary,
      features: features ? features.split(',').map(f => f.trim()) : [],
      fixes: fixes ? fixes.split(',').map(f => f.trim()) : [],
      version: '1.0.0'
    });

    // Recharger les logs
    const updatedLogs = JSON.parse(localStorage.getItem('updateLogs') || '[]');
    setLogs(updatedLogs);

    alert('Résumé créé et envoyé !');
  };

  const buttonStyle = {
    position: 'fixed',
    bottom: '80px',
    right: '20px',
    backgroundColor: '#8b5cf6',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    width: '56px',
    height: '56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    zIndex: 999
  };

  const modalStyle = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    zIndex: 1002,
    width: '90%',
    maxWidth: '700px',
    maxHeight: '80vh',
    overflow: 'auto'
  };

  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1001
  };

  return (
    <>
      {/* Bouton flottant */}
      <button
        style={buttonStyle}
        onClick={() => setShowConfig(true)}
        title="Configuration des logs Google Drive"
      >
        <FileText size={24} />
      </button>

      {/* Modal de configuration */}
      {showConfig && (
        <>
          <div style={overlayStyle} onClick={() => setShowConfig(false)} />
          <div style={modalStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#1f2937' }}>
                📊 Configuration des Logs Google Drive
              </h2>
              <button
                onClick={() => setShowConfig(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Instructions */}
            <div style={{
              backgroundColor: '#f0f9ff',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #0284c7'
            }}>
              <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                <Info size={20} color="#0284c7" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '14px', color: '#075985' }}>
                  <strong>Configuration Google Drive API :</strong>
                  <ol style={{ marginTop: '8px', paddingLeft: '20px' }}>
                    <li>Allez sur <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" style={{ color: '#0284c7' }}>Google Cloud Console</a></li>
                    <li>Créez un projet ou sélectionnez-en un existant</li>
                    <li>Activez Google Drive API et Google Docs API</li>
                    <li>Créez des identifiants OAuth 2.0</li>
                    <li>Ajoutez http://localhost:4001 aux origines autorisées</li>
                    <li>Copiez le Client ID et l'API Key ci-dessous</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Configuration */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>
                Google Client ID :
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="xxxxx.apps.googleusercontent.com"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>
                Google API Key :
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>
                ID du dossier Google Drive (optionnel) :
              </label>
              <input
                type="text"
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                placeholder="ID du dossier de destination"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
              <small style={{ color: '#6b7280', fontSize: '12px' }}>
                Trouvez l'ID dans l'URL du dossier : drive.google.com/drive/folders/[ID]
              </small>
            </div>

            {/* Activation */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={driveEnabled}
                  onChange={(e) => setDriveEnabled(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '14px', color: '#374151' }}>
                  Activer l'envoi automatique des logs vers Google Drive
                </span>
              </label>
            </div>

            {/* Statut du test */}
            {testStatus && (
              <div style={{
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '16px',
                backgroundColor: testStatus === 'success' ? '#d1fae5' : testStatus === 'error' ? '#fee2e2' : '#fef3c7',
                border: `1px solid ${testStatus === 'success' ? '#86efac' : testStatus === 'error' ? '#fecaca' : '#fde68a'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {testStatus === 'success' && <CheckCircle size={20} color="#10b981" />}
                {testStatus === 'error' && <AlertCircle size={20} color="#ef4444" />}
                {testStatus === 'testing' && <Upload size={20} color="#f59e0b" />}
                <span style={{ fontSize: '14px' }}>
                  {testStatus === 'success' && 'Test réussi ! Les logs sont envoyés vers Google Drive.'}
                  {testStatus === 'error' && 'Erreur lors du test. Vérifiez vos identifiants.'}
                  {testStatus === 'testing' && 'Test en cours...'}
                </span>
              </div>
            )}

            {/* Actions rapides */}
            <div style={{
              backgroundColor: '#f9fafb',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#374151' }}>Actions rapides</h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={handleCreateSummary}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#8b5cf6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <FileText size={16} />
                  Créer un résumé
                </button>

                <button
                  onClick={() => setShowLogs(!showLogs)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Eye size={16} />
                  Voir les logs ({logs.length})
                </button>

                <button
                  onClick={exportLogs}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Download size={16} />
                  Exporter JSON
                </button>
              </div>
            </div>

            {/* Liste des logs */}
            {showLogs && logs.length > 0 && (
              <div style={{
                backgroundColor: '#f9fafb',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px',
                maxHeight: '200px',
                overflow: 'auto'
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#374151' }}>
                  Historique des logs
                </h4>
                {logs.slice().reverse().map((log, index) => (
                  <div key={log.id || index} style={{
                    padding: '8px',
                    backgroundColor: 'white',
                    borderRadius: '4px',
                    marginBottom: '8px',
                    fontSize: '13px'
                  }}>
                    <div style={{ fontWeight: 'bold', color: '#1f2937' }}>{log.title}</div>
                    <div style={{ color: '#6b7280', fontSize: '11px' }}>{log.date}</div>
                    <div style={{ color: '#374151', marginTop: '4px' }}>{log.summary}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Boutons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConfig(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Annuler
              </button>

              <button
                onClick={handleTest}
                disabled={!clientId || !apiKey}
                style={{
                  padding: '8px 16px',
                  backgroundColor: clientId && apiKey ? '#f59e0b' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: clientId && apiKey ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Upload size={16} />
                Tester
              </button>

              <button
                onClick={handleSave}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Save size={16} />
                Sauvegarder
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default UpdateLoggerConfig;