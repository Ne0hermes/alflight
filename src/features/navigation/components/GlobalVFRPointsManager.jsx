/**
 * Gestionnaire des points VFR globaux (non liés à un aérodrome spécifique)
 */

import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2, Edit2, Navigation, Search, Cloud, CloudOff, Upload, Download, RefreshCw } from 'lucide-react';
import { useCustomVFRStore } from '@core/stores/customVFRStore';
import vfrPointsService from '../../../services/vfrPointsService';

const GlobalVFRPointsManager = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingPoint, setEditingPoint] = useState(null);
  const [newPoint, setNewPoint] = useState({
    name: '',
    lat: '',
    lon: '',
    type: 'VRP',
    description: '',
    altitude: ''
  });

  // États Supabase
  const [supabasePoints, setSupabasePoints] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const { 
    getAllCustomVFRPoints, 
    addCustomVFRPoint, 
    updateCustomVFRPoint, 
    deleteCustomVFRPoint 
  } = useCustomVFRStore();

  // Récupérer uniquement les points non liés à un aérodrome
  const allPoints = getAllCustomVFRPoints();
  const localGlobalPoints = allPoints.filter(point => !point.aerodrome);

  // Combiner les points locaux et Supabase (éviter doublons par nom)
  const localPointNames = new Set(localGlobalPoints.map(p => p.name.toLowerCase()));
  const uniqueSupabasePoints = supabasePoints.filter(
    p => !localPointNames.has(p.name.toLowerCase())
  );

  const globalPoints = [...localGlobalPoints, ...uniqueSupabasePoints];

  // Filtrer par terme de recherche
  const filteredPoints = globalPoints.filter(point =>
    point.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    point.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const handleAddPoint = async () => {
    if (!newPoint.name || !newPoint.lat || !newPoint.lon) {
      alert('Nom, latitude et longitude sont requis');
      return;
    }

    await addCustomVFRPoint({
      ...newPoint,
      lat: parseFloat(newPoint.lat),
      lon: parseFloat(newPoint.lon),
      altitude: newPoint.altitude ? parseInt(newPoint.altitude) : null,
      aerodrome: null // Explicitement null pour un point global
    });

    setNewPoint({
      name: '',
      lat: '',
      lon: '',
      type: 'VRP',
      description: '',
      altitude: ''
    });
    setIsAdding(false);
  };

  const handleUpdatePoint = async () => {
    if (!editingPoint) return;

    await updateCustomVFRPoint(editingPoint.id, {
      ...editingPoint,
      lat: parseFloat(editingPoint.lat),
      lon: parseFloat(editingPoint.lon),
      altitude: editingPoint.altitude ? parseInt(editingPoint.altitude) : null
    });

    setEditingPoint(null);
  };

  // Synchroniser avec Supabase (télécharger les points partagés)
  const handleSyncFromSupabase = async () => {
    setIsSyncing(true);
    try {
      const points = await vfrPointsService.getAllPublicPoints();

      // Transformer les points Supabase pour l'affichage local
      const transformedPoints = points.map(point => ({
        id: `supabase-${point.id}`,
        name: point.name,
        type: point.type,
        lat: point.lat,
        lon: point.lon,
        altitude: point.altitude,
        description: point.description,
        fromSupabase: true,
        supabaseId: point.id,
        downloads_count: point.downloads_count,
        uploaded_by: point.uploaded_by
      }));

      setSupabasePoints(transformedPoints);
      setLastSyncTime(new Date());

      alert(`✅ ${points.length} point(s) VFR synchronisé(s) depuis Supabase`);
    } catch (error) {
      console.error('Erreur sync:', error);
      alert('❌ Erreur lors de la synchronisation');
    } finally {
      setIsSyncing(false);
    }
  };

  // Uploader les points locaux vers Supabase
  const handleUploadToSupabase = async () => {
    if (globalPoints.length === 0) {
      alert('Aucun point local à uploader');
      return;
    }

    if (!confirm(`Uploader ${globalPoints.length} point(s) local(aux) vers Supabase ?`)) {
      return;
    }

    setIsUploading(true);
    try {
      // Filtrer les points qui ne viennent pas déjà de Supabase
      const localOnlyPoints = globalPoints.filter(p => !p.fromSupabase);

      if (localOnlyPoints.length === 0) {
        alert('Tous vos points sont déjà sur Supabase');
        setIsUploading(false);
        return;
      }

      // Vérifier les doublons avant d'uploader
      const pointsToUpload = [];
      for (const point of localOnlyPoints) {
        const exists = await vfrPointsService.pointExists(point.name, point.lat, point.lon);
        if (!exists) {
          pointsToUpload.push(point);
        }
      }

      if (pointsToUpload.length === 0) {
        alert('Tous vos points existent déjà sur Supabase');
        setIsUploading(false);
        return;
      }

      // Uploader les points
      const result = await vfrPointsService.uploadMultiplePoints(pointsToUpload);

      alert(`✅ ${result.length} point(s) uploadé(s) vers Supabase`);

      // Re-synchroniser pour afficher les nouveaux points
      await handleSyncFromSupabase();
    } catch (error) {
      console.error('Erreur upload:', error);
      alert('❌ Erreur lors de l\'upload');
    } finally {
      setIsUploading(false);
    }
  };

  const formatCoordinates = (lat, lon) => {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    const absLat = Math.abs(lat);
    const absLon = Math.abs(lon);
    
    const latDeg = Math.floor(absLat);
    const latMin = Math.floor((absLat - latDeg) * 60);
    const latSec = Math.round(((absLat - latDeg) * 60 - latMin) * 60);
    
    const lonDeg = Math.floor(absLon);
    const lonMin = Math.floor((absLon - lonDeg) * 60);
    const lonSec = Math.round(((absLon - lonDeg) * 60 - lonMin) * 60);
    
    return `${latDeg}°${latMin}'${latSec}"${latDir} ${lonDeg}°${lonMin}'${lonSec}"${lonDir}`;
  };

  const vfrTypeColors = {
    'Entry': '#10b981',
    'Exit': '#ef4444',
    'Transit': '#3b82f6',
    'VRP': '#8b5cf6',
    'Custom': '#f59e0b'
  };

  return (
    <div style={{
      padding: '20px',
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    }}>
      {/* En-tête */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '4px'
          }}>
            <Navigation size={20} />
            Points VFR Globaux
          </h2>
          {lastSyncTime && (
            <p style={{
              fontSize: '11px',
              color: '#6b7280',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Cloud size={12} />
              Dernière synchro: {lastSyncTime.toLocaleTimeString()}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={handleSyncFromSupabase}
            disabled={isSyncing}
            style={{
              padding: '8px 16px',
              backgroundColor: isSyncing ? '#9ca3af' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: isSyncing ? 0.6 : 1
            }}
          >
            {isSyncing ? <RefreshCw size={16} className="spin" /> : <Download size={16} />}
            {isSyncing ? 'Synchronisation...' : 'Synchroniser'}
          </button>

          <button
            onClick={handleUploadToSupabase}
            disabled={isUploading || localGlobalPoints.length === 0}
            style={{
              padding: '8px 16px',
              backgroundColor: isUploading || localGlobalPoints.length === 0 ? '#9ca3af' : '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: isUploading || localGlobalPoints.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: isUploading || localGlobalPoints.length === 0 ? 0.6 : 1
            }}
          >
            {isUploading ? <RefreshCw size={16} className="spin" /> : <Upload size={16} />}
            {isUploading ? 'Upload...' : 'Partager'}
          </button>

          <button
            onClick={() => setIsAdding(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={16} />
            Ajouter
          </button>
        </div>
      </div>

      {/* Barre de recherche */}
      <div style={{
        position: 'relative',
        marginBottom: '16px'
      }}>
        <Search size={18} style={{
          position: 'absolute',
          left: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#6b7280'
        }} />
        <input
          type="text"
          placeholder="Rechercher un point VFR..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 8px 8px 36px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '14px'
          }}
        />
      </div>

      {/* Formulaire d'ajout */}
      {isAdding && (
        <div style={{
          marginBottom: '20px',
          padding: '16px',
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
          border: '2px solid #3b82f6'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
            Nouveau point VFR global
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <input
              type="text"
              placeholder="Nom du point *"
              value={newPoint.name}
              onChange={(e) => setNewPoint({ ...newPoint, name: e.target.value })}
              style={{
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
            
            <select
              value={newPoint.type}
              onChange={(e) => setNewPoint({ ...newPoint, type: e.target.value })}
              style={{
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              <option value="VRP">VRP - Point de report</option>
              <option value="Entry">Entrée</option>
              <option value="Exit">Sortie</option>
              <option value="Transit">Transit</option>
              <option value="Custom">Personnalisé</option>
            </select>
            
            <input
              type="number"
              placeholder="Latitude * (ex: 43.6426)"
              value={newPoint.lat}
              onChange={(e) => setNewPoint({ ...newPoint, lat: e.target.value })}
              step="0.0001"
              style={{
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
            
            <input
              type="number"
              placeholder="Longitude * (ex: 1.3678)"
              value={newPoint.lon}
              onChange={(e) => setNewPoint({ ...newPoint, lon: e.target.value })}
              step="0.0001"
              style={{
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
            
            <input
              type="number"
              placeholder="Altitude (ft)"
              value={newPoint.altitude}
              onChange={(e) => setNewPoint({ ...newPoint, altitude: e.target.value })}
              style={{
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
            
            <input
              type="text"
              placeholder="Description"
              value={newPoint.description}
              onChange={(e) => setNewPoint({ ...newPoint, description: e.target.value })}
              style={{
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
          
          <div style={{
            display: 'flex',
            gap: '8px',
            marginTop: '12px'
          }}>
            <button
              onClick={handleAddPoint}
              style={{
                padding: '6px 12px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Enregistrer
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setNewPoint({
                  name: '',
                  lat: '',
                  lon: '',
                  type: 'VRP',
                  description: '',
                  altitude: ''
                });
              }}
              style={{
                padding: '6px 12px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste des points */}
      <div style={{
        display: 'grid',
        gap: '12px'
      }}>
        {filteredPoints.length > 0 ? (
          filteredPoints.map(point => (
            <div
              key={point.id}
              style={{
                padding: '12px',
                backgroundColor: '#f9fafb',
                borderRadius: '6px',
                border: '1px solid #e5e7eb'
              }}
            >
              {editingPoint?.id === point.id ? (
                // Mode édition
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input
                    type="text"
                    value={editingPoint.name}
                    onChange={(e) => setEditingPoint({ ...editingPoint, name: e.target.value })}
                    style={{
                      padding: '6px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  />
                  
                  <select
                    value={editingPoint.type}
                    onChange={(e) => setEditingPoint({ ...editingPoint, type: e.target.value })}
                    style={{
                      padding: '6px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  >
                    <option value="VRP">VRP</option>
                    <option value="Entry">Entrée</option>
                    <option value="Exit">Sortie</option>
                    <option value="Transit">Transit</option>
                    <option value="Custom">Personnalisé</option>
                  </select>
                  
                  <input
                    type="number"
                    value={editingPoint.lat}
                    onChange={(e) => setEditingPoint({ ...editingPoint, lat: e.target.value })}
                    step="0.0001"
                    placeholder="Latitude"
                    style={{
                      padding: '6px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  />
                  
                  <input
                    type="number"
                    value={editingPoint.lon}
                    onChange={(e) => setEditingPoint({ ...editingPoint, lon: e.target.value })}
                    step="0.0001"
                    placeholder="Longitude"
                    style={{
                      padding: '6px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  />
                  
                  <input
                    type="number"
                    value={editingPoint.altitude || ''}
                    onChange={(e) => setEditingPoint({ ...editingPoint, altitude: e.target.value })}
                    placeholder="Altitude"
                    style={{
                      padding: '6px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  />
                  
                  <input
                    type="text"
                    value={editingPoint.description || ''}
                    onChange={(e) => setEditingPoint({ ...editingPoint, description: e.target.value })}
                    placeholder="Description"
                    style={{
                      padding: '6px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  />
                  
                  <div style={{ gridColumn: 'span 2', display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleUpdatePoint}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Enregistrer
                    </button>
                    <button
                      onClick={() => setEditingPoint(null)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                // Mode affichage
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'start'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px',
                      flexWrap: 'wrap'
                    }}>
                      <MapPin size={16} style={{ color: vfrTypeColors[point.type] || '#6b7280' }} />
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '600'
                      }}>
                        {point.name}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        backgroundColor: vfrTypeColors[point.type] || '#6b7280',
                        color: 'white',
                        borderRadius: '4px'
                      }}>
                        {point.type}
                      </span>
                      {point.fromSupabase ? (
                        <span style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          backgroundColor: '#10b981',
                          color: 'white',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}>
                          <Cloud size={10} />
                          Supabase
                        </span>
                      ) : (
                        <span style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          backgroundColor: '#6b7280',
                          color: 'white',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}>
                          <CloudOff size={10} />
                          Local
                        </span>
                      )}
                    </div>
                    
                    <div style={{
                      fontSize: '12px',
                      color: '#6b7280',
                      marginBottom: '2px'
                    }}>
                      {formatCoordinates(point.lat, point.lon)}
                    </div>
                    
                    {point.altitude && (
                      <div style={{
                        fontSize: '12px',
                        color: '#6b7280'
                      }}>
                        Altitude: {point.altitude} ft
                      </div>
                    )}
                    
                    {point.description && (
                      <div style={{
                        fontSize: '12px',
                        color: '#4b5563',
                        marginTop: '4px'
                      }}>
                        {point.description}
                      </div>
                    )}
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    gap: '4px'
                  }}>
                    {!point.fromSupabase && (
                      <>
                        <button
                          onClick={() => setEditingPoint(point)}
                          style={{
                            padding: '4px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#6b7280'
                          }}
                          title="Modifier"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Supprimer le point "${point.name}" ?`)) {
                              deleteCustomVFRPoint(point.id);
                            }
                          }}
                          style={{
                            padding: '4px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#ef4444'
                          }}
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                    {point.fromSupabase && point.downloads_count !== undefined && (
                      <div style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        color: '#6b7280',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <Download size={12} />
                        {point.downloads_count}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
        ) : (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#9ca3af'
          }}>
            <MapPin size={48} style={{ opacity: 0.3, margin: '0 auto 16px' }} />
            <p style={{ fontSize: '14px' }}>
              {searchTerm ? 'Aucun point trouvé' : 'Aucun point VFR global défini'}
            </p>
            <p style={{ fontSize: '12px', marginTop: '8px' }}>
              Les points globaux sont visibles sur toutes les cartes
            </p>
          </div>
        )}
      </div>

      {/* Statistiques */}
      {globalPoints.length > 0 && (
        <div style={{
          marginTop: '20px',
          padding: '12px',
          backgroundColor: '#eff6ff',
          borderRadius: '6px',
          border: '1px solid #3b82f6',
          fontSize: '12px',
          color: '#1e40af'
        }}>
          <div style={{ marginBottom: '8px' }}>
            <strong>{globalPoints.length}</strong> point{globalPoints.length > 1 ? 's' : ''} VFR global{globalPoints.length > 1 ? 'aux' : ''}
            {' • '}
            <strong>{localGlobalPoints.length}</strong> local{localGlobalPoints.length > 1 ? 'aux' : ''}
            {' • '}
            <strong>{uniqueSupabasePoints.length}</strong> depuis Supabase
          </div>
          <div style={{ fontSize: '11px', opacity: 0.8 }}>
            {Object.entries(
              globalPoints.reduce((acc, p) => {
                acc[p.type] = (acc[p.type] || 0) + 1;
                return acc;
              }, {})
            ).map(([type, count]) => `${count} ${type}`).join(' • ')}
          </div>
        </div>
      )}
    </div>

};

export default GlobalVFRPointsManager;