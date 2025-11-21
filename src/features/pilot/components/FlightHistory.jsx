import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar, Plane, MapPin, ExternalLink } from 'lucide-react';
import { validatedPdfService } from '../../../services/validatedPdfService';

/**
 * Composant pour afficher l'historique des vols validés d'un pilote
 * Affiche la liste des PDFs de plans de vol avec accès direct
 */
export const FlightHistory = ({ pilotName, callsign }) => {
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    loadFlightHistory();
  }, [pilotName, callsign]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadFlightHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      // Rechercher les vols par nom de pilote ou callsign
      const searchFilters = {};
      if (pilotName) searchFilters.pilotName = pilotName;
      if (callsign) searchFilters.callsign = callsign;

      const result = await validatedPdfService.searchValidatedPdfs(searchFilters);

      console.log('✅ [FlightHistory] Vols chargés:', result.length);
      setFlights(result);
    } catch (err) {
      console.error('❌ [FlightHistory] Erreur chargement historique:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async (flight) => {
    try {
      // Obtenir l'URL signée (valide 1h)
      const signedUrl = await validatedPdfService.getPdfSignedUrl(flight.pdf_storage_path, 3600);

      if (signedUrl) {
        // Ouvrir dans un nouvel onglet
        window.open(signedUrl, '_blank');
      } else {
        alert('❌ Impossible de récupérer le PDF');
      }
    } catch (err) {
      console.error('❌ [FlightHistory] Erreur téléchargement PDF:', err);
      alert('❌ Erreur lors du téléchargement du PDF');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatFileSize = (bytes) => {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Chargement de l'historique des vols...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>❌ Erreur : {error}</p>
        <button onClick={loadFlightHistory} style={styles.retryButton}>
          Réessayer
        </button>
      </div>
    );
  }

  if (flights.length === 0) {
    return (
      <div style={styles.emptyContainer}>
        <FileText size={48} color="#cbd5e1" />
        <p style={styles.emptyText}>Aucun vol enregistré</p>
        <p style={styles.emptySubtext}>
          Vos vols validés apparaîtront ici après génération du PDF
        </p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={{
        ...styles.flightList,
        maxHeight: isMobile ? '500px' : '600px',
        overflowY: 'auto'
      }}>
        {/* Lignes du tableau */}
        {flights.map((flight) => (
          <div key={flight.id} style={{
            ...styles.flightRow,
            display: isMobile ? 'flex' : 'grid',
            flexDirection: isMobile ? 'column' : 'row',
            gridTemplateColumns: isMobile ? 'none' : '120px 110px 180px 1fr 120px',
            gap: isMobile ? '8px' : '12px',
            padding: isMobile ? '12px' : '14px 16px'
          }}>
            {/* Numéro de vol et Date sur la même ligne sur mobile */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              ...(isMobile ? {} : styles.colFlightNumber)
            }}>
              {isMobile ? (
                <>
                  <span style={styles.badgeSmall}>{flight.flight_number || 'N/A'}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569' }}>
                    <Calendar size={14} style={styles.iconInline} />
                    {formatDate(flight.flight_date)}
                  </div>
                </>
              ) : (
                <span style={styles.badgeSmall}>{flight.flight_number || 'N/A'}</span>
              )}
            </div>

            {/* Date (desktop seulement) */}
            {!isMobile && (
              <div style={styles.colDate}>
                <Calendar size={14} style={styles.iconInline} />
                {formatDate(flight.flight_date)}
              </div>
            )}

            {/* Avion */}
            <div style={isMobile ? {} : styles.colAircraft}>
              <Plane size={14} style={styles.iconInline} />
              {flight.aircraft_registration}
              {flight.aircraft_type && (
                <span style={styles.aircraftType}>({flight.aircraft_type})</span>
              )}
            </div>

            {/* Trajet complet */}
            <div style={isMobile ? {} : styles.colRoute}>
              <MapPin size={14} style={styles.iconInline} />
              <span style={styles.routeText}>
                {flight.full_route || `${flight.departure_icao}→${flight.arrival_icao}`}
              </span>
              {flight.tags && flight.tags.length > 0 && (
                <span style={styles.tagsInline}>
                  {flight.tags.map((tag, idx) => (
                    <span key={idx} style={styles.tagSmall}>{tag}</span>
                  ))}
                </span>
              )}
            </div>

            {/* Actions */}
            <div style={isMobile ? { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } : styles.colActions}>
              <button
                onClick={() => handleDownloadPdf(flight)}
                style={styles.pdfButton}
                title="Télécharger le PDF"
              >
                <Download size={16} />
                {isMobile ? ' PDF' : <ExternalLink size={12} style={styles.externalIconSmall} />}
              </button>
              <span style={styles.fileSizeSmall}>
                {formatFileSize(flight.pdf_size_bytes)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '0',
    backgroundColor: 'transparent',
    borderRadius: '8px'
  },
  flightList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    scrollBehavior: 'smooth',
    WebkitOverflowScrolling: 'touch'
  },
  flightRow: {
    display: 'grid',
    gridTemplateColumns: '120px 110px 180px 1fr 120px',
    gap: '12px',
    padding: '14px 16px',
    borderBottom: '1px solid #f1f5f9',
    alignItems: 'center',
    transition: 'background-color 0.2s',
    ':hover': {
      backgroundColor: '#f8fafc'
    }
  },
  colFlightNumber: {
    display: 'flex',
    alignItems: 'center'
  },
  colDate: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#475569'
  },
  colAircraft: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#1e293b',
    fontWeight: '500'
  },
  colRoute: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#1e293b',
    flexWrap: 'wrap'
  },
  colActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    justifyContent: 'flex-end'
  },
  badgeSmall: {
    backgroundColor: '#3b82f6',
    color: 'white',
    padding: '3px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
    whiteSpace: 'nowrap'
  },
  iconInline: {
    color: '#94a3b8',
    flexShrink: 0
  },
  aircraftType: {
    color: '#64748b',
    fontSize: '12px',
    marginLeft: '4px'
  },
  routeText: {
    color: '#1e293b',
    fontWeight: '500',
    fontSize: '13px'
  },
  tagsInline: {
    display: 'flex',
    gap: '4px',
    marginLeft: '8px'
  },
  tagSmall: {
    backgroundColor: '#f1f5f9',
    color: '#64748b',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '11px',
    fontWeight: '500',
    whiteSpace: 'nowrap'
  },
  pdfButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 10px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    whiteSpace: 'nowrap',
    ':hover': {
      backgroundColor: '#2563eb'
    }
  },
  externalIconSmall: {
    opacity: 0.7
  },
  fileSizeSmall: {
    fontSize: '11px',
    color: '#94a3b8',
    whiteSpace: 'nowrap'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    gap: '16px'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e2e8f0',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    color: '#64748b',
    fontSize: '14px',
    margin: 0
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
    gap: '16px'
  },
  errorText: {
    color: '#dc2626',
    fontSize: '14px',
    margin: 0
  },
  retryButton: {
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  },
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px 20px',
    gap: '12px'
  },
  emptyText: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#475569',
    margin: '8px 0 0 0'
  },
  emptySubtext: {
    fontSize: '14px',
    color: '#94a3b8',
    margin: 0,
    textAlign: 'center',
    maxWidth: '300px'
  }
};

// Ajout de l'animation CSS pour le spinner
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

export default FlightHistory;
