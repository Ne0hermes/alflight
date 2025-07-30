// src/features/vac/components/VACDownloadButton.jsx
import React, { memo, useState } from 'react';
import { Download, ExternalLink, Save, Loader, AlertCircle } from 'lucide-react';
import { useVACStore, vacSelectors } from '@core/stores/vacStore';
import { sx } from '@shared/styles/styleSystem';

export const VACDownloadButton = memo(({ icao, size = 'normal' }) => {
  const chart = vacSelectors.useChartByIcao(icao);
  const isDownloading = vacSelectors.useIsDownloading(icao);
  const error = vacSelectors.useError(icao);
  const { downloadChart, openPDF, savePDF } = useVACStore();
  const [showMenu, setShowMenu] = useState(false);

  const handleDownload = async () => {
    if (!chart?.isDownloaded) {
      await downloadChart(icao);
    } else {
      setShowMenu(!showMenu);
    }
  };

  const buttonStyles = {
    small: {
      padding: '6px 12px',
      fontSize: '13px'
    },
    normal: {
      padding: '8px 16px',
      fontSize: '14px'
    },
    large: {
      padding: '12px 24px',
      fontSize: '16px'
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={handleDownload}
        disabled={isDownloading}
        style={sx.combine(
          sx.components.button.base,
          chart?.isDownloaded ? sx.components.button.success : sx.components.button.primary,
          buttonStyles[size],
          isDownloading && { opacity: 0.6, cursor: 'wait' }
        )}
      >
        {isDownloading ? (
          <>
            <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Téléchargement...
          </>
        ) : chart?.isDownloaded ? (
          <>
            <Download size={16} />
            Carte VAC
          </>
        ) : (
          <>
            <Download size={16} />
            Télécharger VAC
          </>
        )}
      </button>

      {/* Menu déroulant si téléchargé */}
      {showMenu && chart?.isDownloaded && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '4px',
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 1000,
          minWidth: '200px'
        }}>
          <button
            onClick={() => {
              openPDF(icao);
              setShowMenu(false);
            }}
            style={styles.menuItem}
          >
            <ExternalLink size={16} />
            Ouvrir le PDF
          </button>
          
          <button
            onClick={() => {
              savePDF(icao);
              setShowMenu(false);
            }}
            style={styles.menuItem}
          >
            <Save size={16} />
            Enregistrer sur PC
          </button>
        </div>
      )}

      {/* Overlay pour fermer le menu */}
      {showMenu && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
          onClick={() => setShowMenu(false)}
        />
      )}

      {/* Erreur */}
      {error && (
        <div style={sx.combine(
          sx.components.alert.base,
          sx.components.alert.danger,
          sx.spacing.mt(2)
        )}>
          <AlertCircle size={16} />
          <span style={sx.text.sm}>{error}</span>
        </div>
      )}
    </div>
  );
});

const styles = {
  menuItem: {
    width: '100%',
    padding: '10px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    transition: 'background-color 0.2s',
    ':hover': {
      backgroundColor: '#f3f4f6'
    }
  }
};

VACDownloadButton.displayName = 'VACDownloadButton';