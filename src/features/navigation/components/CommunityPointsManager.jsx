// src/features/navigation/components/CommunityPointsManager.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, Upload, Search, Download, Plus, Check, AlertCircle, Edit2, Trash2 } from 'lucide-react';
import vfrPointsService from '@services/vfrPointsService';
import { AIRPORT_NAMES } from '@data/airportNames';

/**
 * Composant pour gérer les points VFR communautaires
 * Permet de créer et partager des points avec la communauté
 */
export const CommunityPointsManager = ({ onSelectPoint, mode = 'browse' }) => {
  const [activeMode, setActiveMode] = useState(mode); // 'browse', 'create', ou 'edit'
  const [communityPoints, setCommunityPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadStatus, setUploadStatus] = useState(null); // 'success', 'error', null
  const [tableNotFound, setTableNotFound] = useState(false); // Détecte si la table n'existe pas
  const [errorMessage, setErrorMessage] = useState(''); // Message d'erreur détaillé
  const [editingPoint, setEditingPoint] = useState(null); // Point en cours d'édition
  const [selectedPhoto, setSelectedPhoto] = useState(null); // Fichier photo sélectionné
  const [photoPreview, setPhotoPreview] = useState(null); // URL de prévisualisation de la photo

  // Formulaire pour créer un nouveau point
  const [newPoint, setNewPoint] = useState({
    name: '',
    type: 'VRP',
    lat: '',
    lon: '',
    altitude: '',
    description: '',
    aerodrome: '',
    frequency: '', // Fréquence de référence
    airspace: '', // Espace aérien
    airspaceClass: '', // Classe d'espace aérien (A, B, C, D, E, F)
    country: 'France', // Pays (défaut France)
    aeronauticalRemarks: '' // Remarques aéronautiques
  });

  // Liste triée des aérodromes pour le dropdown
  const sortedAirports = useMemo(() => {
    return Object.entries(AIRPORT_NAMES)
      .map(([icao, name]) => ({ icao, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, []);

  // Charger les points communautaires au montage
  useEffect(() => {
    if (activeMode === 'browse') {
      loadCommunityPoints();
    }
  }, [activeMode]);

  const loadCommunityPoints = async () => {
    setLoading(true);
    setTableNotFound(false);
    try {
      const points = await vfrPointsService.getAllPublicPoints();
      setCommunityPoints(points);
    } catch (error) {
      console.error('Erreur chargement points:', error);
      // Détecter si la table n'existe pas (erreur PGRST205)
      if (error.code === 'PGRST205' || error.message?.includes('vfr_points')) {
        setTableNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePoint = async () => {
    // Validation détaillée
    console.log('📝 Tentative de création avec:', newPoint);

    if (!newPoint.name) {
      setErrorMessage('Le nom du point est obligatoire');
      setUploadStatus('error');
      return;
    }

    if (!newPoint.lat || newPoint.lat === '') {
      setErrorMessage('La latitude est obligatoire');
      setUploadStatus('error');
      return;
    }

    if (!newPoint.lon || newPoint.lon === '') {
      setErrorMessage('La longitude est obligatoire');
      setUploadStatus('error');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      console.log('🚀 Upload vers Supabase...');

      // Upload de la photo d'abord si sélectionnée
      let photoUrl = null;
      if (selectedPhoto) {
        console.log('📸 Upload de la photo...');
        photoUrl = await vfrPointsService.uploadPhoto(selectedPhoto, newPoint.name);
      }

      // Upload du point vers Supabase avec l'URL de la photo
      const result = await vfrPointsService.uploadPoint(newPoint, 'pilot-user', photoUrl);
      console.log('✅ Point créé:', result);

      setUploadStatus('success');

      // Réinitialiser le formulaire
      setNewPoint({
        name: '',
        type: 'VRP',
        lat: '',
        lon: '',
        altitude: '',
        description: '',
        aerodrome: '',
        frequency: '',
        airspace: '',
        airspaceClass: '',
        country: 'France',
        aeronauticalRemarks: ''
      });
      setSelectedPhoto(null);
      setPhotoPreview(null);

      // Recharger la liste
      setTimeout(() => {
        setActiveMode('browse');
        loadCommunityPoints();
        setUploadStatus(null);
      }, 2000);
    } catch (error) {
      console.error('❌ Erreur création point:', error);
      console.error('Code erreur:', error.code);
      console.error('Message:', error.message);
      console.error('Détails:', error.details);

      // Détecter si la table n'existe pas (erreur PGRST205)
      if (error.code === 'PGRST205' || error.message?.includes('vfr_points')) {
        setTableNotFound(true);
        setErrorMessage('La table vfr_points n\'existe pas dans Supabase');
      } else if (error.message?.includes('permission') || error.message?.includes('policy')) {
        setErrorMessage('Erreur de permissions Supabase (RLS). Code: ' + error.code);
      } else {
        setErrorMessage(error.message || 'Erreur inconnue lors de la création');
      }
      setUploadStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCommunityPoint = async (point) => {
    // Enregistrer le téléchargement
    if (point.id) {
      await vfrPointsService.recordDownload(point.id);
    }

    // Retourner le point sélectionné
    onSelectPoint({
      type: 'community',
      data: {
        name: point.name,
        lat: point.lat,
        lon: point.lon,
        altitude: point.altitude,
        description: point.description,
        type: point.type
      }
    });
  };

  const handleEditPoint = (point) => {
    console.log('✏️ Édition du point:', point);
    setEditingPoint(point);
    setNewPoint({
      name: point.name,
      type: point.type,
      lat: point.lat.toString(),
      lon: point.lon.toString(),
      altitude: point.altitude ? point.altitude.toString() : '',
      description: point.description || '',
      aerodrome: point.aerodrome || '',
      frequency: point.frequency || '',
      airspace: point.airspace || '',
      airspaceClass: point.airspace_class || '',
      country: point.country || 'France',
      aeronauticalRemarks: point.aeronautical_remarks || ''
    });

    // Charger la photo existante pour la prévisualisation
    if (point.photo_url) {
      setPhotoPreview(point.photo_url);
    } else {
      setPhotoPreview(null);
    }
    setSelectedPhoto(null); // Pas de nouveau fichier sélectionné

    setActiveMode('edit');
    setUploadStatus(null);
    setErrorMessage('');
  };

  const handleUpdatePoint = async () => {
    console.log('📝 Mise à jour du point:', editingPoint.id);

    if (!newPoint.name || !newPoint.lat || !newPoint.lon) {
      setErrorMessage('Les champs obligatoires doivent être remplis');
      setUploadStatus('error');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      // Upload de la photo d'abord si sélectionnée
      let photoUrl = null;
      if (selectedPhoto) {
        console.log('📸 Upload de la nouvelle photo...');
        photoUrl = await vfrPointsService.uploadPhoto(selectedPhoto, newPoint.name);
        console.log('📸 Photo uploadée, URL:', photoUrl);
      } else {
        console.log('ℹ️ Aucune nouvelle photo sélectionnée');
      }

      console.log('🔄 Envoi UPDATE avec photoUrl:', photoUrl);

      const result = await vfrPointsService.updatePoint(
        editingPoint.id,
        newPoint,
        'pilot-user', // TODO: Récupérer l'ID utilisateur réel
        photoUrl
      );
      console.log('✅ Point mis à jour:', result);
      console.log('✅ Photo URL dans le résultat:', result?.photo_url);

      setUploadStatus('success');
      setEditingPoint(null);
      setSelectedPhoto(null);
      setPhotoPreview(null);

      // Recharger la liste
      setTimeout(() => {
        setActiveMode('browse');
        loadCommunityPoints();
        setUploadStatus(null);
        setNewPoint({
          name: '',
          type: 'VRP',
          lat: '',
          lon: '',
          altitude: '',
          description: '',
          aerodrome: '',
          frequency: '',
          airspace: '',
          airspaceClass: '',
          country: 'France',
          aeronauticalRemarks: ''
        });
      }, 2000);
    } catch (error) {
      console.error('❌ Erreur mise à jour:', error);
      setErrorMessage(error.message || 'Erreur lors de la mise à jour');
      setUploadStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePoint = async (pointId, pointName) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le point "${pointName}" ?`)) {
      return;
    }

    setLoading(true);
    try {
      await vfrPointsService.deletePoint(pointId, 'pilot-user'); // TODO: Récupérer l'ID utilisateur réel
      console.log('✅ Point supprimé');

      // Recharger la liste
      await loadCommunityPoints();
    } catch (error) {
      console.error('❌ Erreur suppression:', error);
      alert('Erreur lors de la suppression du point');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingPoint(null);
    setActiveMode('browse');
    setUploadStatus(null);
    setErrorMessage('');
    setNewPoint({
      name: '',
      type: 'VRP',
      lat: '',
      lon: '',
      altitude: '',
      description: '',
      aerodrome: '',
      frequency: '',
      airspace: '',
      airspaceClass: '',
      country: 'France',
      aeronauticalRemarks: ''
    });
  };

  // Gérer la sélection de photo
  const handlePhotoSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Vérifier le type de fichier
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Le fichier doit être une image (JPEG, PNG, WebP)');
        setUploadStatus('error');
        return;
      }

      // Vérifier la taille (max 5 MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage('L\'image ne doit pas dépasser 5 MB');
        setUploadStatus('error');
        return;
      }

      setSelectedPhoto(file);

      // Créer une prévisualisation
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Filtrer les points par recherche
  const filteredPoints = communityPoints.filter(point =>
    point.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    point.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={styles.container}>
      {/* Header avec recherche et bouton créer */}
      {activeMode === 'browse' && !tableNotFound && (
        <div style={styles.header}>
          <div style={styles.searchBar}>
            <Search size={16} style={{ color: '#9ca3af' }} />
            <input
              type="text"
              placeholder="Rechercher un point VFR..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
          </div>
          <button
            onClick={() => setActiveMode('create')}
            style={styles.createButtonHeader}
            title="Créer un nouveau point"
          >
            <Plus size={18} />
            <span>Créer</span>
          </button>
        </div>
      )}

      {/* Bouton retour en mode create/edit */}
      {(activeMode === 'create' || activeMode === 'edit') && (
        <button
          onClick={() => {
            setActiveMode('browse');
            setSelectedPhoto(null);
            setPhotoPreview(null);
            setEditingPoint(null);
          }}
          style={styles.backButton}
        >
          ← Retour à la liste
        </button>
      )}

      {/* Message d'erreur : Table non trouvée */}
      {tableNotFound && (
        <div style={styles.setupInstructions}>
          <AlertCircle size={48} style={{ color: '#f59e0b', marginBottom: '16px' }} />
          <h3 style={styles.setupTitle}>⚙️ Configuration requise</h3>
          <p style={styles.setupDescription}>
            La table <code>vfr_points</code> n'existe pas encore dans votre base Supabase.
          </p>
          <div style={styles.setupSteps}>
            <p style={styles.setupStep}><strong>1.</strong> Ouvrez le fichier <code>supabase-vfr-points-setup.sql</code></p>
            <p style={styles.setupStep}><strong>2.</strong> Connectez-vous à <a href="https://app.supabase.com" target="_blank" rel="noopener noreferrer" style={styles.setupLink}>Supabase</a></p>
            <p style={styles.setupStep}><strong>3.</strong> Allez dans <strong>SQL Editor</strong> → <strong>New query</strong></p>
            <p style={styles.setupStep}><strong>4.</strong> Copiez-collez le contenu du fichier SQL</p>
            <p style={styles.setupStep}><strong>5.</strong> Cliquez sur <strong>Run</strong></p>
          </div>
          <p style={styles.setupFooter}>
            📖 Guide complet : <code>SUPABASE_VFR_POINTS_SETUP.md</code>
          </p>
          <button
            onClick={() => {
              setTableNotFound(false);
              loadCommunityPoints();
            }}
            style={styles.retryButton}
          >
            🔄 Réessayer après configuration
          </button>
        </div>
      )}

      {/* Mode: Parcourir les points communautaires */}
      {activeMode === 'browse' && !tableNotFound && (
        <div style={styles.browseMode}>
          {/* Liste des points */}
          {loading ? (
            <div style={styles.loadingState}>
              <div style={styles.spinner}></div>
              <p>Chargement des points communautaires...</p>
            </div>
          ) : filteredPoints.length === 0 ? (
            <div style={styles.emptyState}>
              <MapPin size={48} style={{ color: '#d1d5db', marginBottom: '12px' }} />
              <p style={{ color: '#6b7280' }}>
                {searchTerm ? 'Aucun point trouvé' : 'Aucun point communautaire disponible'}
              </p>
            </div>
          ) : (
            <div style={styles.pointsList}>
              {filteredPoints.map((point, idx) => (
                <div
                  key={point.id || idx}
                  style={styles.pointCard}
                >
                  <div onClick={() => handleSelectCommunityPoint(point)} style={{ flex: 1, cursor: 'pointer' }}>
                    {/* Photo du point */}
                    {point.photo_url && (
                      <div style={styles.cardPhotoContainer}>
                        <img src={point.photo_url} alt={point.name} style={styles.cardPhoto} />
                      </div>
                    )}

                    <div style={styles.pointHeader}>
                      <MapPin size={20} style={{ color: '#3b82f6' }} />
                      <div style={styles.pointInfo}>
                        <h4 style={styles.pointName}>{point.name}</h4>
                        <p style={styles.pointType}>{point.type}</p>
                      </div>
                    </div>
                    <div style={styles.pointDetails}>
                      <p style={styles.pointCoords}>
                        📍 {point.lat.toFixed(5)}, {point.lon.toFixed(5)}
                      </p>
                      {point.altitude && (
                        <p style={styles.pointAltitude}>
                          ⬆️ {point.altitude} ft
                        </p>
                      )}
                      {point.description && (
                        <p style={styles.pointDescription}>{point.description}</p>
                      )}
                      <p style={styles.pointMeta}>
                        <Download size={12} /> {point.downloads_count || 0} téléchargements
                      </p>
                    </div>
                  </div>

                  {/* Boutons d'action */}
                  <div style={styles.pointActions}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditPoint(point);
                      }}
                      style={styles.actionButton}
                      title="Modifier"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePoint(point.id, point.name);
                      }}
                      style={{...styles.actionButton, ...styles.deleteButton}}
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mode: Créer ou Éditer un point */}
      {(activeMode === 'create' || activeMode === 'edit') && !tableNotFound && (
        <div style={styles.createMode}>
          <p style={styles.createDescription}>
            {activeMode === 'create'
              ? 'Créez un point VFR et partagez-le avec la communauté des pilotes'
              : `Modification du point: ${editingPoint?.name || ''}`
            }
          </p>

          {/* Formulaire */}
          <div style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Nom du point *</label>
              <input
                type="text"
                placeholder="Ex: Tour Eiffel, Château de Versailles..."
                value={newPoint.name}
                onChange={(e) => setNewPoint({ ...newPoint, name: e.target.value })}
                style={styles.input}
                required
              />
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Type</label>
                <select
                  value={newPoint.type}
                  onChange={(e) => setNewPoint({ ...newPoint, type: e.target.value })}
                  style={styles.select}
                >
                  <option value="VRP">VRP (Point VFR)</option>
                  <option value="Landmark">Repère visuel</option>
                  <option value="Turning Point">Point de virage</option>
                  <option value="Reporting Point">Point de compte-rendu</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Altitude (ft)</label>
                <input
                  type="number"
                  placeholder="Ex: 1500"
                  value={newPoint.altitude}
                  onChange={(e) => setNewPoint({ ...newPoint, altitude: e.target.value })}
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Latitude *</label>
                <input
                  type="number"
                  step="0.00001"
                  placeholder="Ex: 48.8584"
                  value={newPoint.lat}
                  onChange={(e) => setNewPoint({ ...newPoint, lat: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Longitude *</label>
                <input
                  type="number"
                  step="0.00001"
                  placeholder="Ex: 2.2945"
                  value={newPoint.lon}
                  onChange={(e) => setNewPoint({ ...newPoint, lon: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Description</label>
              <textarea
                placeholder="Ajoutez des détails utiles pour identifier ce point..."
                value={newPoint.description}
                onChange={(e) => setNewPoint({ ...newPoint, description: e.target.value })}
                style={styles.textarea}
                rows={3}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Aérodrome associé (optionnel)</label>
              <select
                value={newPoint.aerodrome}
                onChange={(e) => setNewPoint({ ...newPoint, aerodrome: e.target.value })}
                style={styles.select}
              >
                <option value="">-- Aucun aérodrome --</option>
                {sortedAirports.map(({ icao, name }) => (
                  <option key={icao} value={icao}>
                    {icao} - {name}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Fréquence (MHz)</label>
                <input
                  type="text"
                  placeholder="Ex: 118.50, 122.50"
                  value={newPoint.frequency}
                  onChange={(e) => setNewPoint({ ...newPoint, frequency: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Pays</label>
                <select
                  value={newPoint.country}
                  onChange={(e) => setNewPoint({ ...newPoint, country: e.target.value })}
                  style={styles.select}
                >
                  <option value="France">France</option>
                  <option value="Allemagne">Allemagne</option>
                  <option value="Belgique">Belgique</option>
                  <option value="Suisse">Suisse</option>
                  <option value="Italie">Italie</option>
                  <option value="Espagne">Espagne</option>
                  <option value="Luxembourg">Luxembourg</option>
                  <option value="Royaume-Uni">Royaume-Uni</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Espace aérien</label>
                <select
                  value={newPoint.airspace}
                  onChange={(e) => setNewPoint({ ...newPoint, airspace: e.target.value })}
                  style={styles.select}
                >
                  <option value="">-- Non spécifié --</option>
                  <option value="CTR">CTR (Zone de contrôle)</option>
                  <option value="TMA">TMA (Zone terminale)</option>
                  <option value="LTA">LTA (Zone inférieure)</option>
                  <option value="UTA">UTA (Zone supérieure)</option>
                  <option value="CTA">CTA (Zone de contrôle)</option>
                  <option value="D">Zone D (Dangereuse)</option>
                  <option value="P">Zone P (Interdite)</option>
                  <option value="R">Zone R (Réglementée)</option>
                  <option value="TMZ">TMZ (Zone de transponder obligatoire)</option>
                  <option value="RMZ">RMZ (Zone radio obligatoire)</option>
                  <option value="FIS">FIS (Service d'information de vol)</option>
                  <option value="Non contrôlé">Espace non contrôlé</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Classe d'espace aérien</label>
                <select
                  value={newPoint.airspaceClass}
                  onChange={(e) => setNewPoint({ ...newPoint, airspaceClass: e.target.value })}
                  style={styles.select}
                >
                  <option value="">-- Non spécifié --</option>
                  <option value="A">Classe A</option>
                  <option value="B">Classe B</option>
                  <option value="C">Classe C</option>
                  <option value="D">Classe D</option>
                  <option value="E">Classe E</option>
                  <option value="F">Classe F</option>
                  <option value="G">Classe G</option>
                </select>
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Remarques aéronautiques</label>
              <textarea
                placeholder="Informations importantes pour les pilotes (obstacles, procédures spéciales, restrictions...)"
                value={newPoint.aeronauticalRemarks}
                onChange={(e) => setNewPoint({ ...newPoint, aeronauticalRemarks: e.target.value })}
                style={styles.textarea}
                rows={4}
              />
            </div>

            {/* Upload de photo */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Photo du point (optionnel)</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoSelect}
                style={styles.fileInput}
              />
              <p style={styles.fileInputHint}>
                Format: JPEG, PNG ou WebP - Taille max: 5 MB
              </p>

              {/* Prévisualisation de la photo */}
              {photoPreview && (
                <div style={styles.photoPreview}>
                  <img src={photoPreview} alt="Prévisualisation" style={styles.photoPreviewImage} />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPhoto(null);
                      setPhotoPreview(null);
                    }}
                    style={styles.removePhotoButton}
                  >
                    ✕ Supprimer
                  </button>
                </div>
              )}
            </div>

            {/* Statut upload */}
            {uploadStatus === 'success' && (
              <div style={styles.successMessage}>
                <Check size={20} />
                <span>Point créé et partagé avec succès !</span>
              </div>
            )}

            {uploadStatus === 'error' && (
              <div style={styles.errorMessage}>
                <AlertCircle size={20} />
                <div>
                  <strong>Erreur lors de la création</strong>
                  {errorMessage && (
                    <div style={{ marginTop: '4px', fontSize: '12px' }}>
                      {errorMessage}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Boutons d'action */}
            <div style={styles.formActions}>
              <button
                onClick={activeMode === 'create' ? handleCreatePoint : handleUpdatePoint}
                disabled={loading || !newPoint.name || !newPoint.lat || !newPoint.lon}
                style={{
                  ...styles.createButton,
                  ...(loading || !newPoint.name || !newPoint.lat || !newPoint.lon ? styles.createButtonDisabled : {})
                }}
              >
                {loading ? (
                  <>
                    <div style={styles.smallSpinner}></div>
                    {activeMode === 'create' ? 'Création en cours...' : 'Mise à jour...'}
                  </>
                ) : (
                  <>
                    <Upload size={16} style={{ marginRight: '8px' }} />
                    {activeMode === 'create' ? 'Créer et partager' : 'Mettre à jour'}
                  </>
                )}
              </button>

              {activeMode === 'edit' && (
                <button
                  onClick={handleCancelEdit}
                  disabled={loading}
                  style={styles.cancelButton}
                >
                  Annuler
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%'
  },
  header: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
    alignItems: 'center'
  },
  createButtonHeader: {
    padding: '10px 16px',
    backgroundColor: '#3b82f6',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    whiteSpace: 'nowrap'
  },
  backButton: {
    padding: '10px 16px',
    backgroundColor: 'transparent',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    color: '#374151',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginBottom: '16px'
  },
  browseMode: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  searchBar: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    backgroundColor: 'white'
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    color: '#111827'
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    color: '#6b7280',
    fontSize: '14px'
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #e5e7eb',
    borderTop: '3px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '12px'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    textAlign: 'center'
  },
  pointsList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  pointCard: {
    padding: '16px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backgroundColor: 'white'
  },
  cardPhotoContainer: {
    marginBottom: '12px',
    width: '100%',
    borderRadius: '6px',
    overflow: 'hidden'
  },
  cardPhoto: {
    width: '100%',
    height: '150px',
    objectFit: 'cover',
    display: 'block'
  },
  pointHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '12px'
  },
  pointInfo: {
    flex: 1
  },
  pointName: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#111827',
    margin: '0 0 4px 0'
  },
  pointType: {
    fontSize: '12px',
    color: '#6b7280',
    margin: 0
  },
  pointDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    paddingLeft: '32px'
  },
  pointCoords: {
    fontSize: '12px',
    color: '#374151',
    margin: 0
  },
  pointAltitude: {
    fontSize: '12px',
    color: '#374151',
    margin: 0
  },
  pointDescription: {
    fontSize: '13px',
    color: '#6b7280',
    margin: '4px 0 0 0',
    fontStyle: 'italic'
  },
  pointMeta: {
    fontSize: '11px',
    color: '#9ca3af',
    margin: '8px 0 0 0',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  pointActions: {
    display: 'flex',
    gap: '8px',
    padding: '8px 0',
    borderTop: '1px solid #f3f4f6',
    marginTop: '12px'
  },
  actionButton: {
    padding: '8px 12px',
    backgroundColor: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#374151',
    fontSize: '13px',
    fontWeight: '500'
  },
  deleteButton: {
    color: '#ef4444',
    borderColor: '#fca5a5'
  },
  createMode: {
    flex: 1,
    overflowY: 'auto'
  },
  createDescription: {
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '20px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: 1
  },
  formRow: {
    display: 'flex',
    gap: '12px'
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#374151'
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    color: '#111827',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  select: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    color: '#111827',
    outline: 'none',
    backgroundColor: 'white',
    cursor: 'pointer'
  },
  textarea: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    color: '#111827',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit'
  },
  fileInput: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    color: '#111827',
    outline: 'none',
    backgroundColor: 'white',
    cursor: 'pointer'
  },
  fileInputHint: {
    fontSize: '12px',
    color: '#6b7280',
    margin: '4px 0 0 0',
    fontStyle: 'italic'
  },
  photoPreview: {
    marginTop: '12px',
    position: 'relative',
    display: 'inline-block'
  },
  photoPreviewImage: {
    maxWidth: '100%',
    maxHeight: '200px',
    borderRadius: '8px',
    border: '2px solid #e5e7eb'
  },
  removePhotoButton: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    padding: '4px 8px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600'
  },
  createButton: {
    marginTop: '8px',
    padding: '12px 20px',
    backgroundColor: '#3b82f6',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  createButtonDisabled: {
    backgroundColor: '#d1d5db',
    cursor: 'not-allowed'
  },
  formActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '8px'
  },
  cancelButton: {
    padding: '12px 20px',
    backgroundColor: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    color: '#374151',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  smallSpinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTop: '2px solid white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginRight: '8px'
  },
  successMessage: {
    padding: '12px',
    backgroundColor: '#d1fae5',
    border: '1px solid #10b981',
    borderRadius: '6px',
    color: '#065f46',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  errorMessage: {
    padding: '12px',
    backgroundColor: '#fee2e2',
    border: '1px solid #ef4444',
    borderRadius: '6px',
    color: '#991b1b',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  setupInstructions: {
    padding: '32px 24px',
    textAlign: 'center',
    backgroundColor: '#fffbeb',
    border: '2px solid #f59e0b',
    borderRadius: '12px',
    margin: '20px 0'
  },
  setupTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#92400e',
    margin: '0 0 12px 0'
  },
  setupDescription: {
    fontSize: '14px',
    color: '#78350f',
    marginBottom: '20px',
    lineHeight: '1.5'
  },
  setupSteps: {
    textAlign: 'left',
    backgroundColor: 'white',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '20px',
    border: '1px solid #fbbf24'
  },
  setupStep: {
    fontSize: '13px',
    color: '#374151',
    margin: '8px 0',
    lineHeight: '1.6'
  },
  setupLink: {
    color: '#3b82f6',
    textDecoration: 'none',
    fontWeight: '500'
  },
  setupFooter: {
    fontSize: '12px',
    color: '#92400e',
    marginBottom: '16px',
    fontStyle: 'italic'
  },
  retryButton: {
    padding: '12px 24px',
    backgroundColor: '#f59e0b',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s'
  }
};

export default CommunityPointsManager;
