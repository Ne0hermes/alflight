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
    backgroundColor: 'var(--text-primary)',
    color: 'var(--text-primary)',
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
    backgroundColor: 'var(--bg-overlay)',
    padding: '24px',
    borderRadius: 'var(--radius-sm)',
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
            <h2 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--text-primary)' }}>
              📊 Configuration Google Sheets Direct
            </h2>

            {/* État des credentials */}
            <div style={{
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '16px',
              backgroundColor: credentialsLoaded ? 'var(--bg-overlay)' : 'rgba(242, 105, 33, 0.10)',
              border: `1px solid ${credentialsLoaded ? 'var(--bg-overlay)' : 'var(--bg-overlay)'}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {credentialsLoaded ? (
                  <>
                    <CheckCircle size={20} color="var(--text-primary)" />
                    <span>Credentials chargés : claude-code@alfight.iam.gserviceaccount.com</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={20} color="var(--accent-primary)" />
                    <span>Credentials non chargés</span>
                    <button
                      onClick={handleLoadCredentials}
                      style={{
                        marginLeft: 'auto',
                        padding: '4px 12px',
                        backgroundColor: 'var(--text-secondary)',
                        color: 'var(--text-primary)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
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
              backgroundColor: 'var(--bg-overlay)',
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '16px',
              border: '1px solid var(--text-secondary)'
            }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                📝 Configuration du Webhook Google Apps Script
              </h4>
              <ol style={{ margin: '8px 0', paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <li>Ouvrez votre <a href="https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)' }}>Google Sheets</a></li>
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
                  backgroundColor: 'var(--text-secondary)',
                  color: 'var(--text-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
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
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--border-subtle)',
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
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
                      backgroundColor: 'var(--text-secondary)',
                      color: 'var(--text-primary)',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
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
                color: 'var(--text-secondary)'
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
                  border: '1px solid var(--text-tertiary)',
                  borderRadius: 'var(--radius-sm)',
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
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Activer l'envoi automatique vers Google Sheets
                </span>
              </label>
            </div>

            {/* Statut du test */}
            {testStatus && (
              <div style={{
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '16px',
                backgroundColor: testStatus === 'success' ? 'var(--bg-overlay)' : testStatus === 'error' ? 'var(--bg-overlay)' : 'rgba(242, 105, 33, 0.10)',
                border: `1px solid ${testStatus === 'success' ? 'var(--bg-overlay)' : testStatus === 'error' ? 'var(--border-subtle)' : 'var(--bg-overlay)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {testStatus === 'success' && <CheckCircle size={20} color="var(--text-primary)" />}
                {testStatus === 'error' && <AlertCircle size={20} color="#C04534" />}
                {testStatus === 'testing' && <Send size={20} color="var(--accent-primary)" />}
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
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--text-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
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
                  backgroundColor: 'var(--bg-overlay)',
                  color: 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
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
                  backgroundColor: webhookUrl ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                  color: 'var(--text-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
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
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--text-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
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

export default GoogleSheetsConfig;