// src/features/aircraft/components/ManexImporter.jsx
import React, { memo, useState, useRef, useEffect } from 'react';
import { Upload, FileText, X, Download, Trash2 } from 'lucide-react';
import { showNotification } from '../../../shared/components/Notification';
import { getManexWithPdf } from '../../../core/stores/manexStore';

export const ManexImporter = memo(({
  aircraft,
  onManexUpdate,
  onClose
}) => {
  const [loading, setLoading] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [manexData, setManexData] = useState(null);
  const fileInputRef = useRef(null);

  // Charger le MANEX depuis IndexedDB au montage
  useEffect(() => {
    const loadManexData = async () => {
      if (aircraft.manex && aircraft.id) {
        try {
          const data = await getManexWithPdf(aircraft.id);
          if (data) {
            setManexData(data);
          }
        } catch (error) {
          console.error('Erreur lors du chargement du MANEX:', error);
        }
      }
    };
    loadManexData();
  }, [aircraft.id, aircraft.manex]);

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
    reader.onload = () => {
      const manexData = {
        fileName: file.name,
        fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        uploadDate: new Date().toISOString(),
        pdfData: reader.result // Base64 du PDF
      };

      // Sauvegarder directement
      try {
        onManexUpdate(aircraft.id, manexData);
        showNotification(
          `✅ MANEX "${file.name}" enregistré pour ${aircraft.registration}`,
          'success',
          5000
        );
        setLoading(false);
        setTimeout(() => onClose(), 1500);
      } catch (error) {
        console.error('Erreur lors de l\'enregistrement du MANEX:', error);
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
      console.log('🔍 handleViewManex - Début');
      console.log('Aircraft:', aircraft);
      console.log('ManexData actuel:', manexData);

      let pdfDataToView = null;

      // Si on a déjà chargé les données depuis IndexedDB
      if (manexData?.pdfData) {
        console.log('✅ PDF trouvé dans manexData');
        pdfDataToView = manexData.pdfData;
      }
      // Sinon, essayer de les récupérer
      else if (aircraft.id) {
        console.log('📥 Récupération depuis IndexedDB pour aircraft.id:', aircraft.id);
        const data = await getManexWithPdf(aircraft.id);
        console.log('📊 Données récupérées:', data);

        if (data?.pdfData) {
          pdfDataToView = data.pdfData;
          setManexData(data);
        }
      }

      console.log('📄 pdfDataToView:', pdfDataToView ? 'Présent' : 'Absent');
      console.log('📄 Type de pdfDataToView:', typeof pdfDataToView);
      console.log('📄 Format (100 premiers caractères):', pdfDataToView ? pdfDataToView.substring(0, 100) : 'N/A');

      if (pdfDataToView) {
        // Si c'est un objet File ou Blob, on le convertit
        if (pdfDataToView instanceof File || pdfDataToView instanceof Blob) {
          console.log('📄 Type détecté: File ou Blob');
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
            console.log('🔧 Format corrigé');
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
        console.log('❌ Aucun PDF trouvé');
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
        {aircraft.manex && !loading && (
          <div style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #3b82f6',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
              <FileText size={20} style={{ marginRight: '8px', color: '#3b82f6' }} />
              <div>
                <p style={{ fontWeight: '600', marginBottom: '4px' }}>{aircraft.manex.fileName}</p>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>
                  {aircraft.manex.fileSize} • Importé le {new Date(aircraft.manex.uploadDate).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleDownloadManex}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Download size={16} />
                Télécharger
              </button>

              <button
                onClick={handleRemoveManex}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Trash2 size={16} />
                Supprimer
              </button>
            </div>
          </div>
        )}

        {/* Zone d'upload */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            disabled={loading}
          />

          <div
            onClick={() => !loading && fileInputRef.current?.click()}
            style={{
              border: '2px dashed #d1d5db',
              borderRadius: '8px',
              padding: '32px',
              textAlign: 'center',
              cursor: loading ? 'not-allowed' : 'pointer',
              backgroundColor: '#fafafa',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.backgroundColor = '#f0f9ff';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db';
              e.currentTarget.style.backgroundColor = '#fafafa';
            }}
          >
            <Upload size={40} style={{ margin: '0 auto 12px', color: '#9ca3af' }} />
            <p style={{ fontSize: '16px', marginBottom: '8px', fontWeight: '500' }}>
              {aircraft.manex ? 'Remplacer le MANEX' : 'Importer le MANEX'}
            </p>
            <p style={{ fontSize: '14px', color: '#6b7280' }}>
              Cliquez pour sélectionner un fichier PDF
            </p>
          </div>

          {/* Message de chargement */}
          {loading && (
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <p style={{ color: '#3b82f6', fontWeight: '500' }}>
                Enregistrement du MANEX en cours...
              </p>
            </div>
          )}
        </div>

        {/* Note informative */}
        <div style={{
          marginTop: '20px',
          padding: '12px',
          backgroundColor: '#f3f4f6',
          borderRadius: '6px',
          fontSize: '14px',
          color: '#6b7280'
        }}>
          <p style={{ display: 'flex', alignItems: 'flex-start' }}>
            <span style={{ marginRight: '8px' }}>ℹ️</span>
            Le MANEX sera stocké avec l'avion pour référence future.
            Vous pourrez le consulter ou le télécharger à tout moment depuis la fiche de l'avion.
          </p>
        </div>
      </div>
    </div>
  );
});

ManexImporter.displayName = 'ManexImporter';

export default ManexImporter;