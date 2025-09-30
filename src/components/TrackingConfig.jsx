import React, { useState, useEffect } from 'react';
import { Settings, Send, CheckCircle, AlertCircle, Info } from 'lucide-react';
import tracker, { setTrackingUrl, enableTracking, logClaudeSummary } from '../services/simpleTrackingService';

const TrackingConfig = () => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [testStatus, setTestStatus] = useState(null);

  useEffect(() => {
    // Charger la configuration existante
    const savedUrl = localStorage.getItem('googleScriptUrl') || '';
    const savedEnabled = localStorage.getItem('trackingEnabled') === 'true';

    setWebhookUrl(savedUrl);
    setIsEnabled(savedEnabled);
  }, []);

  const handleSave = () => {
    setTrackingUrl(webhookUrl);
    enableTracking(isEnabled);
    alert('Configuration sauvegardée !');
  };

  const handleTest = async () => {
    setTestStatus('testing');

    try {
      await logClaudeSummary('Test de connexion avec Google Sheets');
      setTestStatus('success');
      setTimeout(() => setTestStatus(null), 3000);
    } catch (error) {
      setTestStatus('error');
      setTimeout(() => setTestStatus(null), 3000);
    }
  };

  const buttonStyle = {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    backgroundColor: '#3b82f6',
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
    zIndex: 1000
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
    zIndex: 1001,
    width: '90%',
    maxWidth: '600px'
  };

  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000
  };

  return (
    <>
      {/* Bouton flottant de configuration */}
      <button
        style={buttonStyle}
        onClick={() => setShowConfig(true)}
        title="Configuration du tracking Google Sheets"
      >
        <Settings size={24} />
      </button>

      {/* Modal de configuration */}
      {showConfig && (
        <>
          <div style={overlayStyle} onClick={() => setShowConfig(false)} />
          <div style={modalStyle}>
            <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#1f2937' }}>
              Configuration du Tracking Google Sheets
            </h2>

            {/* Instructions */}
            <div style={{
              backgroundColor: '#eff6ff',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #3b82f6'
            }}>
              <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                <Info size={20} color="#3b82f6" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '14px', color: '#1e40af' }}>
                  <strong>Instructions pour configurer Google Apps Script :</strong>
                  <ol style={{ marginTop: '8px', paddingLeft: '20px' }}>
                    <li>Ouvrez votre <a href="https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>Google Sheets de tracking</a></li>
                    <li>Allez dans Extensions → Apps Script</li>
                    <li>Copiez le code du fichier <code>googleAppsScript.gs</code></li>
                    <li>Déployez comme "Application Web" avec accès "Tout le monde"</li>
                    <li>Copiez l'URL de déploiement ci-dessous</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Champ URL */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>
                URL du webhook Google Apps Script :
              </label>
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* Activation */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '14px', color: '#374151' }}>
                  Activer le tracking automatique des résumés
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
                {testStatus === 'testing' && <Send size={20} color="#f59e0b" />}
                <span style={{ fontSize: '14px' }}>
                  {testStatus === 'success' && 'Test réussi ! Les données sont envoyées vers Google Sheets.'}
                  {testStatus === 'error' && 'Erreur lors du test. Vérifiez l\'URL et réessayez.'}
                  {testStatus === 'testing' && 'Test en cours...'}
                </span>
              </div>
            )}

            {/* Boutons d'action */}
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
                disabled={!webhookUrl}
                style={{
                  padding: '8px 16px',
                  backgroundColor: webhookUrl ? '#10b981' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: webhookUrl ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Send size={16} />
                Tester
              </button>

              <button
                onClick={handleSave}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Sauvegarder
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default TrackingConfig;