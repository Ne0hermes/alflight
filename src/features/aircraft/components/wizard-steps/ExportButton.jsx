import React from 'react';
import { Button } from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';

/**
 * Bouton d'export des données du wizard
 * Permet de sauvegarder la progression à tout moment
 */
const ExportButton = ({ aircraftData, currentStep, variant = "outlined", size = "small" }) => {
  // Télécharger en JSON
  const handleDownloadJSON = () => {
    try {
      console.log('📸 ExportButton - Photo présente:', !!aircraftData.photo);
      console.log('📦 ExportButton - Données complètes:', aircraftData);

      const exportData = {
        aircraftData,
        currentStep,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `aircraft_${aircraftData.registration || 'draft'}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('✅ ExportButton - Fichier téléchargé avec succès');
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      startIcon={<DownloadIcon />}
      onClick={handleDownloadJSON}
      sx={{ textTransform: 'none' }}
    >
      Exporter en JSON
    </Button>
  );
};

export default ExportButton;
