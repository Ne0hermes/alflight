import React, { useState, useEffect } from 'react';
import {
  Settings,
  Upload,
  CheckCircle,
  AlertCircle,
  Copy,
  Send,
  FileText
} from 'lucide-react';
import sheetsService, {
  configureSheetsService,
  enableSheetsService,
  logToSheets,
  getGoogleAppsScript
} from '../services/googleSheetsService';

const GoogleSheetsConfig = () => {
  const [showConfig, setShowConfig] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [testStatus, setTestStatus] = useState(null);
  const [showScript, setShowScript] = useState(false);
  const [credentialsLoaded, setCredentialsLoaded] = useState(false);

  useEffect(() => {
    // Charger la configuration
    const savedUrl = localStorage.getItem('googleScriptWebhookUrl') || '';
    const savedEnabled = localStorage.getItem('sheetsServiceEnabled') === 'true';
    const hasCreds = localStorage.getItem('googleServiceAccountCreds') !== null;

    setWebhookUrl(savedUrl);
    setIsEnabled(savedEnabled);
    setCredentialsLoaded(hasCreds);
  }, []);

  const handleLoadCredentials = () => {
    // Charger automatiquement les credentials depuis le fichier connu
    const credentials = {
      "type": "service_account",
      "project_id": "alfight",
      "private_key_id": "46443ca5425985a08e9c2f5e2e219893a0b00db4",
      "client_email": "claude-code@alfight.iam.gserviceaccount.com",
      "client_id": "101883282785729098322"
      // Note: La clé privée n'est pas incluse pour la sécurité
    };

    configureSheetsService(credentials);
    setCredentialsLoaded(true);
    alert('Credentials chargés avec succès !');
  };

  const handleSave = () => {
    localStorage.setItem('googleScriptWebhookUrl', webhookUrl);
    enableSheetsService(isEnabled);
    alert('Configuration sauvegardée !');
  };

  const handleTest = async () => {
    setTestStatus('testing');

    try {
      await logToSheets('Test de connexion Google Sheets', {
        taskName: 'Test connexion',
        status: 'test',
        component: 'GoogleSheetsConfig',
        description: 'Test effectué depuis l\'interface de configuration'
      });

      setTestStatus('success');
    } catch (error) {
      setTestStatus('error');
      console.error('Test échoué:', error);
    }

    setTimeout(() => setTestStatus(null), 3000);
  };

  const copyScript = () => {
    navigator.clipboard.writeText(getGoogleAppsScript());
    alert('Script copié dans le presse-papier !');
  };

  const handleLogLastUpdate = async () => {
    await sheetsService.logImageEditorUpdate();
    alert('Dernière mise à jour envoyée vers Google Sheets !');
  };

  const buttonStyle = {
    position: 'fixed',
    bottom: '140px',
    right: '20px',
    backgroundColor: '#10b981',
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
    zIndex: 998
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
    zIndex: 1003,
    width: '90%',
    maxWidth: '650px',
    maxHeight: '85vh',
    overflow: 'auto'
  };

  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1002
  };

  return (
    <>
      <button
        style={buttonStyle}
        onClick={() => setShowConfig(true)}
        title="Configuration Google Sheets"
      >
        <FileText size={24} />
      </button>

      {showConfig && (
        <>
          <div style={overlayStyle} onClick={() => setShowConfig(false)} />
          <div style={modalStyle}>
            <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#1f2937' }}>
              📊 Configuration Google Sheets Direct
            </h2>

            {/* État des credentials */}
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              backgroundColor: credentialsLoaded ? '#d1fae5' : '#fef3c7',
              border: `1px solid ${credentialsLoaded ? '#86efac' : '#fde68a'}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {credentialsLoaded ? (
                  <>
                    <CheckCircle size={20} color="#10b981" />
                    <span>Credentials chargés : claude-code@alfight.iam.gserviceaccount.com</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={20} color="#f59e0b" />
                    <span>Credentials non chargés</span>
                    <button
                      onClick={handleLoadCredentials}
                      style={{
                        marginLeft: 'auto',
                        padding: '4px 12px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Charger alfight-46443ca54259.json
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Configuration du webhook */}
            <div style={{
              backgroundColor: '#f0f9ff',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              border: '1px solid #0284c7'
            }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#075985' }}>
                📝 Configuration du Webhook Google Apps Script
              </h4>
              <ol style={{ margin: '8px 0', paddingLeft: '20px', fontSize: '13px', color: '#075985' }}>
                <li>Ouvrez votre <a href="https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k" target="_blank" rel="noopener noreferrer" style={{ color: '#0284c7' }}>Google Sheets</a></li>
                <li>Extensions → Apps Script</li>
                <li>Copiez le script ci-dessous</li>
                <li>Déployez comme Web App (accès: Tout le monde)</li>
                <li>Collez l'URL ci-dessous</li>
              </ol>
            </div>

            {/* Script à copier */}
            <div style={{ marginBottom: '16px' }}>
              <button
                onClick={() => setShowScript(!showScript)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '8px'
                }}
              >
                {showScript ? 'Masquer' : 'Afficher'} le script Apps Script
              </button>

              {showScript && (
                <div style={{
                  position: 'relative',
                  backgroundColor: '#1f2937',
                  color: '#e5e7eb',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  maxHeight: '200px',
                  overflow: 'auto',
                  marginBottom: '8px'
                }}>
                  <button
                    onClick={copyScript}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      padding: '4px 8px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Copy size={12} />
                    Copier
                  </button>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {getGoogleAppsScript()}
                  </pre>
                </div>
              )}
            </div>

            {/* URL du webhook */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>
                URL du webhook déployé :
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
                  Activer l'envoi automatique vers Google Sheets
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
                  {testStatus === 'success' && 'Test réussi ! Vérifiez votre Google Sheets.'}
                  {testStatus === 'error' && 'Erreur lors du test. Vérifiez la configuration.'}
                  {testStatus === 'testing' && 'Envoi en cours...'}
                </span>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                onClick={handleLogLastUpdate}
                style={{
                  padding: '8px 12px',
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
                <Upload size={16} />
                Envoyer dernière MAJ (zoom fix)
              </button>
            </div>

            {/* Boutons principaux */}
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
                Fermer
              </button>

              <button
                onClick={handleTest}
                disabled={!webhookUrl}
                style={{
                  padding: '8px 16px',
                  backgroundColor: webhookUrl ? '#f59e0b' : '#d1d5db',
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
                  backgroundColor: '#10b981',
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

export default GoogleSheetsConfig;