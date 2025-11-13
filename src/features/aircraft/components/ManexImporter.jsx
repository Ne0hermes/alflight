// src/features/aircraft/components/ManexImporter.jsx
import React, { memo, useState, useRef, useEffect } from 'react';
import { Upload, FileText, X, Download, Trash2, Eye, Cloud } from 'lucide-react';
import { showNotification } from '../../../shared/components/Notification';
import { getManexWithPdf } from '../../../core/stores/manexStore';
import dataBackupManager from '../../../utils/dataBackupManager';
import communityService from '../../../services/communityService';
import SupabaseUpdater from './SupabaseUpdater';

export const ManexImporter = memo(({
  aircraft,
  onManexUpdate,
  onClose
}) => {
  const [loading, setLoading] = useState(false);
  const [uploadingToSupabase, setUploadingToSupabase] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [manexData, setManexData] = useState(null);
  const fileInputRef = useRef(null);

  // Charger le MANEX depuis IndexedDB au montage
  useEffect(() => {
    console.log('🔍 [ManexImporter] useEffect triggered for aircraft:', aircraft?.id, aircraft?.registration);

    const loadManexData = async () => {
      if (aircraft?.id) {
        try {
          console.log('⏳ [ManexImporter] Loading MANEX data from IndexedDB...');
          await dataBackupManager.initPromise;
          const fullAircraft = await dataBackupManager.getAircraftData(aircraft.id);

          console.log('📦 [ManexImporter] Full aircraft data:', {
            hasData: !!fullAircraft,
            hasManex: !!fullAircraft?.manex,
            hasPdfData: !!fullAircraft?.manex?.pdfData,
            hasRemoteUrl: !!fullAircraft?.manex?.remoteUrl,
            manexKeys: fullAircraft?.manex ? Object.keys(fullAircraft.manex) : []
          });

          if (fullAircraft && fullAircraft.manex) {
            console.log('✅ [ManexImporter] MANEX found in IndexedDB');
            setManexData(fullAircraft.manex);

            // 🔧 FIX: Ne PAS télécharger automatiquement le MANEX
            // L'utilisateur doit cliquer manuellement sur "Télécharger depuis Supabase"
            if (!fullAircraft.manex.pdfData && fullAircraft.manex.remoteUrl) {
              console.log('ℹ️ [ManexImporter] MANEX disponible sur Supabase (pas de téléchargement auto)');
              console.log('💡 [ManexImporter] Cliquez sur "Télécharger depuis Supabase" pour obtenir le PDF');
            }
          } else {
            console.warn('⚠️ [ManexImporter] No MANEX data found in IndexedDB');
          }
        } catch (error) {
          console.error('❌ [ManexImporter] Erreur lors du chargement du MANEX:', error);
        }
      } else {
        console.warn('⚠️ [ManexImporter] No aircraft ID provided');
      }
    };
    loadManexData();
  }, [aircraft?.id]);

  // Fonction pour télécharger un MANEX distant
  const downloadRemoteManex = async (remoteUrl, fullAircraft) => {
    try {
      setLoading(true);
      
      const response = await fetch(remoteUrl);
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const blob = await response.blob();
      console.log('Downloaded MANEX, size:', (blob.size / 1024 / 1024).toFixed(2), 'MB');

      // Convertir en base64
      const reader = new FileReader();
      reader.onload = async () => {
        const updatedManexData = {
          ...fullAircraft.manex,
          pdfData: reader.result,
          downloadedAt: new Date().toISOString()
        };

        // Sauvegarder dans IndexedDB
        const updatedAircraft = {
          ...fullAircraft,
          manex: updatedManexData
        };
        await dataBackupManager.saveAircraftData(updatedAircraft);

        setManexData(updatedManexData);
                showNotification('✅ MANEX téléchargé avec succès', 'success', 3000);
        setLoading(false);
      };
      reader.onerror = () => {
        console.error('❌ Erreur lors de la lecture du blob');
        setLoading(false);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('❌ Erreur lors du téléchargement du MANEX:', error);
      showNotification(`❌ Erreur lors du téléchargement: ${error.message}`, 'error', 5000);
      setLoading(false);
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      showNotification('Veuillez sélectionner un fichier PDF', 'error', 4000);
      return;
    }

    setLoading(true);
    setPdfFile(file);

    // Créer URL de prévisualisation
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Lire le fichier et le convertir en base64 pour sauvegarde
    const reader = new FileReader();
    reader.onload = async () => {
      const manexData = {
        fileName: file.name,
        fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        uploadDate: new Date().toISOString(),
        pdfData: reader.result // Base64 du PDF
      };

                  
      // Sauvegarder directement
      try {
                await onManexUpdate(aircraft.id, manexData);
        
        showNotification(
          `✅ MANEX "${file.name}" enregistré pour ${aircraft.registration}`,
          'success',
          5000
        );
        setLoading(false);
        setTimeout(() => onClose(), 1500);
      } catch (error) {
        console.error('❌ Erreur lors de l\'enregistrement du MANEX:', error);
        showNotification(
          `❌ Erreur lors de l'enregistrement: ${error.message || 'Erreur inconnue'}`,
          'error',
          7000
        );
        setLoading(false);
      }
    };

    reader.onerror = () => {
      showNotification('❌ Erreur lors de la lecture du fichier', 'error', 5000);
      setLoading(false);
    };

    reader.readAsDataURL(file);
  };

  const handleRemoveManex = () => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer le MANEX ?')) {
      try {
        onManexUpdate(aircraft.id, null);
        showNotification(
          `🗑️ MANEX supprimé pour ${aircraft.registration}`,
          'info',
          4000
        );
        onClose();
      } catch (error) {
        console.error('Erreur lors de la suppression du MANEX:', error);
        showNotification(
          `❌ Erreur lors de la suppression du MANEX`,
          'error',
          5000
        );
      }
    }
  };

  const handleViewManex = async () => {
    try {
                  
      let pdfDataToView = null;

      // Si on a déjà chargé les données depuis IndexedDB
      if (manexData?.pdfData) {
                pdfDataToView = manexData.pdfData;
      }
      // Sinon, essayer de les récupérer
      else if (aircraft.id) {
                const data = await getManexWithPdf(aircraft.id);
        
        if (data?.pdfData) {
          pdfDataToView = data.pdfData;
          setManexData(data);
        }
      }

      if (pdfDataToView) {
        // Si c'est un objet File ou Blob, on le convertit
        if (pdfDataToView instanceof File || pdfDataToView instanceof Blob) {
                    const reader = new FileReader();
          reader.onload = function(e) {
            const dataUrl = e.target.result;
            const newWindow = window.open('', '_blank');
            if (newWindow) {
              newWindow.document.write(
                `<!DOCTYPE html>
                <html style="height: 100%; margin: 0;">
                <head><title>MANEX - ${aircraft.registration}</title></head>
                <body style="height: 100%; margin: 0;">
                  <embed src="${dataUrl}" type="application/pdf" style="width:100%; height:100%;" />
                </body>
                </html>`
              );
              newWindow.document.close();
            }
          };
          reader.readAsDataURL(pdfDataToView);
          return;
        }

        // Vérifier que c'est bien une URL data
        if (!pdfDataToView.startsWith('data:')) {
          console.error('❌ Format PDF invalide - ne commence pas par data:', pdfDataToView.substring(0, 50));

          // Essayer de corriger le format si possible
          if (pdfDataToView.includes('base64,')) {
            // Il manque peut-être juste le début
            pdfDataToView = 'data:application/pdf;base64,' + pdfDataToView.split('base64,')[1];
                      } else {
            showNotification('❌ Format PDF invalide', 'error', 3000);
            return;
          }
        }

        // Ouvrir le PDF dans un nouvel onglet avec embed au lieu d'iframe
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(
            `<!DOCTYPE html>
            <html style="height: 100%; margin: 0;">
            <head><title>MANEX - ${aircraft.registration}</title></head>
            <body style="height: 100%; margin: 0;">
              <embed src="${pdfDataToView}" type="application/pdf" style="width:100%; height:100%;" />
            </body>
            </html>`
          );
          newWindow.document.close();
        } else {
          showNotification('❌ Impossible d\'ouvrir une nouvelle fenêtre', 'error', 3000);
        }
      } else {
                showNotification('❌ Impossible de charger le PDF', 'error', 3000);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la visualisation du MANEX:', error);
      showNotification('❌ Erreur lors de la visualisation', 'error', 3000);
    }
  };

  const handleDownloadManex = async () => {
    try {
      let pdfDataToDownload = null;

      // Si on a déjà chargé les données depuis IndexedDB
      if (manexData?.pdfData) {
        pdfDataToDownload = manexData.pdfData;
      }
      // Sinon, essayer de les récupérer
      else if (aircraft.id) {
        const data = await getManexWithPdf(aircraft.id);
        if (data?.pdfData) {
          pdfDataToDownload = data.pdfData;
          setManexData(data);
        }
      }

      if (pdfDataToDownload) {
        // Si c'est un File ou Blob, on le convertit en URL
        if (pdfDataToDownload instanceof File || pdfDataToDownload instanceof Blob) {
          const reader = new FileReader();
          reader.onload = function(e) {
            const link = document.createElement('a');
            link.href = e.target.result;
            link.download = manexData?.fileName || aircraft.manex?.fileName || `MANEX_${aircraft.registration}.pdf`;
            link.click();
          };
          reader.readAsDataURL(pdfDataToDownload);
        } else {
          // Vérifier le format et corriger si nécessaire
          if (!pdfDataToDownload.startsWith('data:')) {
            if (pdfDataToDownload.includes('base64,')) {
              pdfDataToDownload = 'data:application/pdf;base64,' + pdfDataToDownload.split('base64,')[1];
            }
          }
          const link = document.createElement('a');
          link.href = pdfDataToDownload;
          link.download = manexData?.fileName || aircraft.manex?.fileName || `MANEX_${aircraft.registration}.pdf`;
          link.click();
        }
      } else {
        showNotification('❌ Impossible de télécharger le PDF', 'error', 3000);
      }
    } catch (error) {
      console.error('Erreur lors du téléchargement du MANEX:', error);
      showNotification('❌ Erreur lors du téléchargement', 'error', 3000);
    }
  };

  // Upload vers Supabase Storage
  const handleUploadToSupabase = async () => {
    if (!aircraft.registration) {
      showNotification('❌ Immatriculation manquante', 'error', 3000);
      return;
    }

    if (!manexData?.pdfData) {
      showNotification('❌ Aucun PDF à uploader', 'error', 3000);
      return;
    }

    try {
      setUploadingToSupabase(true);

      // Convertir base64 en Blob
      const base64Data = manexData.pdfData.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      // Upload vers Supabase
      const result = await communityService.uploadManex(aircraft.registration, blob);

      // Mettre à jour les données
      const updatedManexData = {
        ...manexData,
        remoteUrl: result.publicUrl,
        filePath: result.filePath,
        uploadedToSupabase: true
      };

      setManexData(updatedManexData);

      // Sauvegarder dans IndexedDB
      const fullAircraft = await dataBackupManager.getAircraftData(aircraft.id);
      const updatedAircraft = {
        ...fullAircraft,
        manex: updatedManexData
      };
      await dataBackupManager.saveAircraftData(updatedAircraft);

      showNotification('✅ MANEX uploadé sur Supabase!', 'success', 3000);
          } catch (error) {
      console.error('❌ Erreur upload Supabase:', error);
      showNotification(`❌ Erreur: ${error.message}`, 'error', 5000);
    } finally {
      setUploadingToSupabase(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        {/* En-tête */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
            <FileText size={24} style={{ marginRight: '8px', color: '#3b82f6' }} />
            Manuel de Vol (MANEX)
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: '#6b7280'
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Affichage du MANEX existant */}
        {(manexData || aircraft.manex) && !loading && (
          <div style={{
            backgroundColor: manexData?.pdfData ? '#f0f9ff' : '#fef3c7',
            border: `1px solid ${manexData?.pdfData ? '#3b82f6' : '#f59e0b'}`,
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
              <FileText size={20} style={{ marginRight: '8px', color: manexData?.pdfData ? '#3b82f6' : '#f59e0b' }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: '600', marginBottom: '4px' }}>{manexData?.fileName || aircraft.manex?.fileName || 'MANEX'}</p>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>
                  {manexData?.fileSize || aircraft.manex?.fileSize} • Importé le {new Date(manexData?.uploadDate || aircraft.manex?.uploadDate || Date.now()).toLocaleDateString('fr-FR')}
                </p>
                {!manexData?.pdfData && (
                  <div style={{
                    backgroundColor: '#fef3c7',
                    border: '1px solid #f59e0b',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    marginTop: '4px'
                  }}>
                    <p style={{ fontSize: '13px', color: '#92400e', fontWeight: '500', margin: 0 }}>
                      ⚠️ PDF non disponible localement
                    </p>
                    <p style={{ fontSize: '12px', color: '#78350f', margin: '4px 0 0 0' }}>
                      {(manexData?.remoteUrl || aircraft.manex?.remoteUrl)
                        ? '→ Cliquez sur "Récupérer le PDF" pour le télécharger, puis vous pourrez l\'uploader sur Supabase'
                        : '→ Cliquez sur "Remplacer le MANEX" pour réimporter le PDF, puis vous pourrez l\'uploader sur Supabase'
                      }
                    </p>
                  </div>
                )}
                {manexData?.pdfData && !manexData?.uploadedToSupabase && (
                  <div style={{
                    backgroundColor: '#dbeafe',
                    border: '1px solid #3b82f6',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    marginTop: '4px'
                  }}>
                    <p style={{ fontSize: '13px', color: '#1e40af', fontWeight: '500', margin: 0 }}>
                      📤 Prêt pour l'upload
                    </p>
                    <p style={{ fontSize: '12px', color: '#1e3a8a', margin: '4px 0 0 0' }}>
                      → Cliquez sur "Uploader sur Supabase" ci-dessous pour partager ce MANEX avec la communauté
                    </p>
                  </div>
                )}
                {manexData?.uploadedToSupabase && (
                  <div>
                    <p style={{ fontSize: '13px', color: '#10b981', marginTop: '4px', fontWeight: '500' }}>
                      ✅ MANEX disponible sur Supabase
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {/* Bouton Visualiser */}
              <button
                onClick={handleViewManex}
                disabled={!manexData?.pdfData}
                style={{
                  padding: '6px 12px',
                  backgroundColor: manexData?.pdfData ? '#10b981' : 'white',
                  color: manexData?.pdfData ? 'white' : '#6b7280',
                  border: `1px solid ${manexData?.pdfData ? '#10b981' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: manexData?.pdfData ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: manexData?.pdfData ? 1 : 0.5
                }}
                title={manexData?.pdfData ? 'Ouvrir le PDF dans un nouvel onglet' : 'PDF non disponible'}
              >
                <Eye size={16} />
                Visualiser
              </button>

              {/* Bouton Télécharger / Récupérer */}
              <button
                onClick={async () => {
                  if (manexData?.pdfData) {
                    handleDownloadManex();
                  } else if (manexData?.remoteUrl || aircraft.manex?.remoteUrl) {
                    const fullAircraft = await dataBackupManager.getAircraftData(aircraft.id);
                    await downloadRemoteManex(manexData?.remoteUrl || aircraft.manex?.remoteUrl, fullAircraft);
                  }
                }}
                disabled={!manexData?.pdfData && !(manexData?.remoteUrl || aircraft.manex?.remoteUrl)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: (manexData?.pdfData || manexData?.remoteUrl || aircraft.manex?.remoteUrl) ? '#3b82f6' : 'white',
                  color: (manexData?.pdfData || manexData?.remoteUrl || aircraft.manex?.remoteUrl) ? 'white' : '#6b7280',
                  border: `1px solid ${(manexData?.pdfData || manexData?.remoteUrl || aircraft.manex?.remoteUrl) ? '#3b82f6' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: (manexData?.pdfData || manexData?.remoteUrl || aircraft.manex?.remoteUrl) ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: (manexData?.pdfData || manexData?.remoteUrl || aircraft.manex?.remoteUrl) ? 1 : 0.5
                }}
                title={
                  manexData?.pdfData
                    ? 'Télécharger le PDF'
                    : (manexData?.remoteUrl || aircraft.manex?.remoteUrl)
                      ? 'Télécharger le PDF depuis le serveur'
                      : 'Fichier PDF manquant - Cliquez sur Remplacer pour réimporter le PDF'
                }
              >
                <Download size={16} />
                {loading ? 'Téléchargement...' : (manexData?.pdfData ? 'Télécharger' : 'Récupérer le PDF')}
              </button>

              {/* 🔧 DÉSACTIVÉ: Boutons de modification (Upload, Remplacer, Supprimer) */}
              {/* Ces actions se font dans le wizard de création/édition d'avion */}
              {/* Ici on affiche uniquement le MANEX en lecture seule */}
            </div>
          </div>
        )}

        {/* 🔧 DÉSACTIVÉ: Bouton d'import */}
        {/* L'import se fait uniquement dans le wizard de création/édition d'avion */}
        {!manexData && !aircraft.manex && (
          <div style={{
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center'
          }}>
            <p style={{ color: '#92400e', fontWeight: '500', marginBottom: '8px' }}>
              ⚠️ Aucun MANEX importé pour cet avion
            </p>
            <p style={{ fontSize: '14px', color: '#78350f', margin: 0 }}>
              → Utilisez le wizard de création/édition d'avion pour importer un MANEX
            </p>
          </div>
        )}

        {/* 🔧 DÉSACTIVÉ: Input file et SupabaseUpdater */}
        {/* Ces fonctionnalités sont uniquement dans le wizard */}
      </div>
    </div>
  );
});

ManexImporter.displayName = 'ManexImporter';

export default ManexImporter;
