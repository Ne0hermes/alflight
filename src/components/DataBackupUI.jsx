// src/components/DataBackupUI.jsx

import React, { useState, useEffect } from 'react';
import { Download, Upload, Shield, ShieldOff, Save, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import dataBackupManager from '@utils/dataBackupManager';
import { sx } from '@shared/styles/styleSystem';

export const DataBackupUI = () => {
  const [isProtected, setIsProtected] = useState(true);
  const [backups, setBackups] = useState([]);
  const [showBackupList, setShowBackupList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    // Charger l'\u00e9tat de protection au montage
    setIsProtected(dataBackupManager.isProtected());
    loadBackups();
  }, []);

  const loadBackups = async () => {
    try {
      const allBackups = await dataBackupManager.getAllBackups();
      setBackups(allBackups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    } catch (error) {
      console.error('Erreur chargement des sauvegardes:', error);
    }
  };

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleToggleProtection = () => {
    const newState = !isProtected;
    dataBackupManager.setProtection(newState);
    setIsProtected(newState);
    showMessage(
      newState 
        ? 'Protection des donn\u00e9es activ\u00e9e' 
        : 'Protection des donn\u00e9es d\u00e9sactiv\u00e9e - Attention !',
      newState ? 'success' : 'warning'
  };

  const handleManualBackup = async () => {
    setLoading(true);
    try {
      const name = prompt('Nom de la sauvegarde:', `Sauvegarde du ${new Date().toLocaleDateString('fr-FR')}`);
      if (name) {
        await dataBackupManager.createManualBackup(name);
        await loadBackups();
        showMessage('Sauvegarde manuelle cr\u00e9\u00e9e avec succ\u00e8s');
      }
    } catch (error) {
      console.error('Erreur cr\u00e9ation sauvegarde:', error);
      showMessage('Erreur lors de la cr\u00e9ation de la sauvegarde', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    setLoading(true);
    try {
      await dataBackupManager.exportAllData();
      showMessage('Donn\u00e9es export\u00e9es avec succ\u00e8s');
    } catch (error) {
      console.error('Erreur export:', error);
      showMessage('Erreur lors de l\'export des donn\u00e9es', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImportData = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        setLoading(true);
        try {
          const text = await file.text();
          await dataBackupManager.importData(text);
          showMessage('Donn\u00e9es import\u00e9es avec succ\u00e8s - Rechargement...');
          // La page sera recharg\u00e9e automatiquement par dataBackupManager
        } catch (error) {
          console.error('Erreur import:', error);
          showMessage('Erreur lors de l\'import des donn\u00e9es', 'error');
        } finally {
          setLoading(false);
        }
      }
    };
    
    input.click();
  };

  const handleRestoreBackup = async (backupId) => {
    if (confirm('\u00cates-vous s\u00fbr de vouloir restaurer cette sauvegarde ? Les donn\u00e9es actuelles seront remplac\u00e9es.')) {
      setLoading(true);
      try {
        await dataBackupManager.restoreBackup(backupId);
        showMessage('Sauvegarde restaur\u00e9e avec succ\u00e8s - Rechargement...');
        // La page sera recharg\u00e9e automatiquement
      } catch (error) {
        console.error('Erreur restauration:', error);
        showMessage('Erreur lors de la restauration', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div style={{
      padding: '16px',
      background: 'var(--bg-surface)',
      color: 'var(--text-primary)',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border-subtle)',
      marginBottom: '16px'
    }}>
      {/* En-t\u00eate */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '16px',
          fontWeight: '600',
          color: 'var(--text-primary)'
        }}>
          Gestion des donn\u00e9es permanentes
        </h3>
        
        {/* Indicateur de protection */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          background: isProtected ? 'var(--bg-overlay)' : 'rgba(242, 105, 33, 0.10)',
          borderRadius: 'var(--radius-sm)'
        }}>
          {isProtected ? (
            <>
              <Shield size={16} color="var(--text-primary)" />
              <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>
                Protection activ\u00e9e
              </span>
            </>
          ) : (
            <>
              <ShieldOff size={16} color="var(--accent-primary)" />
              <span style={{ fontSize: '13px', color: 'var(--accent-primary)', fontWeight: '500' }}>
                Protection d\u00e9sactiv\u00e9e
              </span>
            </>
          )}
        </div>
      </div>

      {/* Message de notification */}
      {message && (
        <div style={{
          padding: '12px',
          marginBottom: '16px',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: message.type === 'success' ? 'var(--bg-overlay)' : 
                     message.type === 'warning' ? 'rgba(242, 105, 33, 0.10)' : 'var(--bg-overlay)',
          color: message.type === 'success' ? 'var(--text-primary)' : 
                 message.type === 'warning' ? 'var(--accent-primary)' : '#C04534'
        }}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span style={{ fontSize: '13px' }}>{message.text}</span>
        </div>
      )}

      {/* Boutons d'action principaux */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '8px',
        marginBottom: '16px'
      }}>
        <button
          onClick={handleManualBackup}
          disabled={loading}
          style={sx.combine(
            sx.components.button.base,
            sx.components.button.primary,
            {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px',
              fontSize: '13px',
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }
          )}
        >
          <Save size={14} />
          Sauvegarde manuelle
        </button>

        <button
          onClick={handleExportData}
          disabled={loading}
          style={sx.combine(
            sx.components.button.base,
            sx.components.button.secondary,
            {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px',
              fontSize: '13px',
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }
          )}
        >
          <Download size={14} />
          Exporter tout
        </button>

        <button
          onClick={handleImportData}
          disabled={loading}
          style={sx.combine(
            sx.components.button.base,
            sx.components.button.secondary,
            {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px',
              fontSize: '13px',
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }
          )}
        >
          <Upload size={14} />
          Importer
        </button>

        <button
          onClick={handleToggleProtection}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '10px',
            fontSize: '13px',
            border: '1px solid',
            borderColor: isProtected ? 'var(--text-primary)' : 'var(--accent-primary)',
            background: isProtected ? 'var(--bg-overlay)' : 'rgba(242, 105, 33, 0.06)',
            color: isProtected ? 'var(--text-primary)' : 'var(--accent-primary)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          {isProtected ? <ShieldOff size={14} /> : <Shield size={14} />}
          {isProtected ? 'D\u00e9sactiver' : 'Activer'} protection
        </button>
      </div>

      {/* Liste des sauvegardes */}
      <div style={{
        borderTop: '1px solid var(--border-subtle)',
        paddingTop: '12px'
      }}>
        <button
          onClick={() => setShowBackupList(!showBackupList)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            padding: '4px',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            fontWeight: '500',
            width: '100%',
            textAlign: 'left'
          }}
        >
          <RefreshCw size={14} />
          Historique des sauvegardes ({backups.length})
          <span style={{ marginLeft: 'auto' }}>
            {showBackupList ? '\u25b2' : '\u25bc'}
          </span>
        </button>

        {showBackupList && (
          <div style={{
            marginTop: '12px',
            maxHeight: '200px',
            overflowY: 'auto',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px'
          }}>
            {backups.length === 0 ? (
              <p style={{
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: '13px',
                margin: '16px 0'
              }}>
                Aucune sauvegarde disponible
              </p>
            ) : (
              backups.slice(0, 10).map(backup => (
                <div
                  key={backup.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px',
                    marginBottom: '4px',
                    background: 'var(--bg-overlay)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '500', color: 'var(--text-secondary)' }}>
                      {backup.name || (backup.type === 'auto' ? 'Sauvegarde auto' : 'Sauvegarde manuelle')}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                      {formatDate(backup.timestamp)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRestoreBackup(backup.id)}
                    disabled={loading}
                    style={{
                      padding: '4px 8px',
                      background: 'var(--text-secondary)',
                      color: 'var(--text-primary)',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '11px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.6 : 1
                    }}
                  >
                    Restaurer
                  </button>
                </div>
            )}
          </div>
        )}
      </div>

      {/* Information */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        background: 'var(--bg-overlay)',
        borderRadius: 'var(--radius-sm)',
        fontSize: '12px',
        color: 'var(--text-secondary)'
      }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: '500' }}>
          \ud83d\udd12 Syst\u00e8me de protection des donn\u00e9es
        </p>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li>Les donn\u00e9es avions et points VFR sont sauvegard\u00e9es automatiquement</li>
          <li>Sauvegarde automatique toutes les 5 minutes</li>
          <li>Protection contre la suppression accidentelle</li>
          <li>Export/Import pour transfert entre appareils</li>
        </ul>
      </div>
    </div>

export default DataBackupUI;