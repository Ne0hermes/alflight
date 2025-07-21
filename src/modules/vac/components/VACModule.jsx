// src/modules/vac/components/VACModule.jsx
import React, { useEffect, useState } from 'react';
import { useVACStore } from '../store/vacStore.js';  // IMPORTANT: .js à la fin
import { Search, Download, Trash2, CheckCircle, AlertCircle, HardDrive, Cloud, Map } from 'lucide-react';
import { VACChartViewer } from './VACChartViewer';
import { VACDataValidator } from './VACDataValidator';

export const VACModule = () => {
  const {
    charts,
    airports,
    selectedAirport,
    downloadQueue,
    isOnline,
    storageUsed,
    storageQuota,
    loadChartsList,
    downloadChart,
    deleteChart,
    searchAirports,
    selectAirport,
    syncCharts,
    checkStorageQuota
  } = useVACStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChart, setSelectedChart] = useState(null);
  const [showValidator, setShowValidator] = useState(false);

  useEffect(() => {
    loadChartsList();
    checkStorageQuota();
    
    // Écouter les changements de connexion
    const handleOnline = () => useVACStore.setState({ isOnline: true });
    const handleOffline = () => useVACStore.setState({ isOnline: false });
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadChartsList, checkStorageQuota]);

  // Filtrer les cartes par aéroport
  const filteredCharts = Array.from(charts.values()).filter(chart => {
    if (selectedAirport) {
      return chart.airportIcao === selectedAirport;
    }
    if (searchQuery) {
      return chart.airportIcao.includes(searchQuery.toUpperCase()) ||
             chart.airportName.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  // Calculer l'utilisation du stockage
  const storagePercentage = storageQuota > 0 ? (storageUsed / storageQuota) * 100 : 0;

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div style={{ display: 'flex', height: '600px', position: 'relative' }}>
      {/* Sidebar avec liste des cartes */}
      <div style={{ 
        width: '350px', 
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f9fafb'
      }}>
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Map size={24} style={{ color: '#3b82f6' }} />
            <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>
              Cartes VAC
            </h2>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
              {isOnline ? (
                <Cloud size={16} style={{ color: '#10b981' }} />
              ) : (
                <HardDrive size={16} style={{ color: '#f59e0b' }} />
              )}
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                {isOnline ? 'En ligne' : 'Hors ligne'}
              </span>
            </div>
          </div>

          {/* Barre de recherche */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ 
              position: 'absolute', 
              left: '12px', 
              top: '50%', 
              transform: 'translateY(-50%)',
              color: '#6b7280'
            }} />
            <input
              type="text"
              placeholder="Rechercher un aéroport..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Stockage */}
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
              <span style={{ color: '#6b7280' }}>Stockage utilisé</span>
              <span style={{ color: '#374151' }}>
                {formatBytes(storageUsed)} / {formatBytes(storageQuota)}
              </span>
            </div>
            <div style={{ 
              width: '100%', 
              height: '4px', 
              backgroundColor: '#e5e7eb',
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{ 
                width: `${storagePercentage}%`,
                height: '100%',
                backgroundColor: storagePercentage > 80 ? '#ef4444' : '#3b82f6',
                transition: 'width 0.3s'
              }} />
            </div>
          </div>
        </div>

        {/* Liste des cartes */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filteredCharts.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>
              <Map size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
              <p>Aucune carte trouvée</p>
            </div>
          ) : (
            filteredCharts.map(chart => (
              <div
                key={chart.id}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  backgroundColor: selectedChart?.id === chart.id ? '#eff6ff' : 'transparent',
                  transition: 'background-color 0.2s'
                }}
                onClick={() => setSelectedChart(chart)}
                onMouseEnter={(e) => {
                  if (selectedChart?.id !== chart.id) {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedChart?.id !== chart.id) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ 
                      margin: '0 0 4px 0', 
                      fontSize: '16px', 
                      fontWeight: '600',
                      color: '#1f2937'
                    }}>
                      {chart.airportIcao} - {chart.airportName}
                    </h4>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      <p style={{ margin: '0 0 2px 0' }}>
                        Type: {chart.type} | Version: {chart.version}
                      </p>
                      <p style={{ margin: '0' }}>
                        Valide: {formatDate(chart.effectiveDate)} - {formatDate(chart.expiryDate)}
                      </p>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                    {chart.isDownloaded ? (
                      <>
                        <CheckCircle size={16} style={{ color: '#10b981' }} />
                        {chart.extractionStatus === 'completed' && (
                          <span style={{ 
                            fontSize: '10px', 
                            padding: '2px 6px',
                            backgroundColor: '#d1fae5',
                            color: '#065f46',
                            borderRadius: '4px'
                          }}>
                            Données extraites
                          </span>
                        )}
                      </>
                    ) : (
                      <Download size={16} style={{ color: '#6b7280' }} />
                    )}
                    {chart.isOutdated && (
                      <AlertCircle size={16} style={{ color: '#f59e0b' }} />
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  {!chart.isDownloaded ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadChart(chart.id);
                      }}
                      disabled={downloadQueue.includes(chart.id) || !isOnline}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: downloadQueue.includes(chart.id) || !isOnline ? 'not-allowed' : 'pointer',
                        opacity: downloadQueue.includes(chart.id) || !isOnline ? 0.5 : 1
                      }}
                    >
                      {downloadQueue.includes(chart.id) ? 'Téléchargement...' : 'Télécharger'}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedChart(chart);
                        }}
                        style={{
                          padding: '4px 12px',
                          fontSize: '12px',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Afficher
                      </button>
                      {chart.extractionStatus === 'completed' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedChart(chart);
                            setShowValidator(true);
                          }}
                          style={{
                            padding: '4px 12px',
                            fontSize: '12px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Valider données
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('Supprimer cette carte ?')) {
                            deleteChart(chart.id);
                          }
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: '12px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Actions globales */}
        <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb' }}>
          <button
            onClick={syncCharts}
            disabled={!isOnline}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: isOnline ? '#3b82f6' : '#e5e7eb',
              color: isOnline ? 'white' : '#9ca3af',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isOnline ? 'pointer' : 'not-allowed'
            }}
          >
            Synchroniser les cartes
          </button>
        </div>
      </div>

      {/* Zone principale */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedChart && selectedChart.isDownloaded ? (
          showValidator ? (
            <VACDataValidator 
              chart={selectedChart} 
              onClose={() => setShowValidator(false)} 
            />
          ) : (
            <VACChartViewer chart={selectedChart} />
          )
        ) : (
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#6b7280'
          }}>
            <div style={{ textAlign: 'center' }}>
              <Map size={64} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
              <p style={{ fontSize: '18px', marginBottom: '8px' }}>
                Sélectionnez une carte à afficher
              </p>
              <p style={{ fontSize: '14px' }}>
                Téléchargez les cartes pour un accès hors ligne
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};