// src/features/pilot/components/PilotCertifications.jsx
import React, { useState, useEffect } from 'react';
import { Upload, Trash2, Eye, FileText, Edit2, AlertCircle } from 'lucide-react';
import {
  safeSetItem,
  compressImage,
  getLocalStorageSize,
  manualCleanStorage
} from '../../../utils/storageUtils';
import { debugCertifications, addTestLicense, addTestRating } from '../../../utils/debugCertifications';
import { runFullTest, resetCertifications, validateStructure } from '../../../utils/testLicensesImportExport';

const PilotCertifications = () => {
  const [certifications, setCertifications] = useState({
    licenses: [],
    ratings: [],
    endorsements: [],
    training: []
  });

  // Hook pour détecter la taille d'écran mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);

  const [formData, setFormData] = useState({
    category: 'licenses',
    type: '',
    name: '',
    issueDate: '',
    expiryDate: '',
    document: null,
    documentName: ''
  });

  // Types prédéfinis
  const certTypes = {
    licenses: [
      'PPL(A) - Private Pilot License (Avion)',
      'PPL(H) - Private Pilot License (Hélicoptère)',
      'CPL(A) - Commercial Pilot License (Avion)',
      'CPL(H) - Commercial Pilot License (Hélicoptère)',
      'ATPL(A) - Airline Transport Pilot License (Avion)',
      'ATPL(H) - Airline Transport Pilot License (Hélicoptère)',
      'LAPL(A) - Light Aircraft Pilot License (Avion)',
      'LAPL(H) - Light Aircraft Pilot License (Hélicoptère)',
      'ULM - Ultra Léger Motorisé',
      'FI(A) - Flight Instructor (Avion)',
      'FI(H) - Flight Instructor (Hélicoptère)',
      'FE(A) - Flight Examiner (Avion)',
      'FE(H) - Flight Examiner (Hélicoptère)'
    ],
    ratings: [
      'SEP - Single Engine Piston',
      'MEP - Multi Engine Piston',
      'SET - Single Engine Turbine',
      'MET - Multi Engine Turbine',
      'IR - Instrument Rating',
      'Night Rating',
      'Mountain Rating',
      'Aerobatic Rating',
      'Towing Rating',
      'Type Rating'
    ],
    endorsements: [
      'Tailwheel',
      'Complex Aircraft',
      'High Performance',
      'Pressurized Aircraft',
      'Glass Cockpit',
      'EFIS',
      'TCAS',
      'RVSM'
    ],
    training: [
      'BFR - Biennial Flight Review',
      'IPC - Instrument Proficiency Check',
      'Line Check',
      'Emergency Procedures',
      'CRM - Crew Resource Management',
      'Dangerous Goods',
      'Security Training',
      'Ditching Training'
    ]
  };

  const categoryLabels = {
    licenses: 'Licences',
    ratings: 'Qualifications',
    endorsements: 'Variantes',
    training: 'Formations'
  };

  const categoryIcons = {
    licenses: '✈️',
    ratings: '🎯',
    endorsements: '📋',
    training: '🎓'
  };

  const categoryColors = {
    licenses: 'var(--text-secondary)',
    ratings: 'var(--text-primary)',
    endorsements: 'var(--accent-primary)',
    training: 'var(--accent-primary)'
  };

  // Charger les certifications depuis localStorage
  useEffect(() => {
        const saved = localStorage.getItem('pilotCertifications');
    
    if (saved) {
      const parsed = JSON.parse(saved);
      setCertifications(parsed);
    }

    // Ajouter les fonctions de debug au window pour faciliter le test
    if (typeof window !== 'undefined') {
      window.debugCert = debugCertifications;
      window.addTestLicense = addTestLicense;
      window.addTestRating = addTestRating;
      window.runFullTest = runFullTest;
      window.resetCert = resetCertifications;
      window.validateCert = validateStructure;
      console.log('window.debugCert() : affiche l\'état des certifications');
      console.log('window.addTestLicense() : ajoute une licence de test');
      console.log('window.addTestRating() : ajoute une qualification de test');
      console.log('window.runFullTest() : lance un test complet avec données');
      console.log('window.resetCert() : réinitialise les certifications');
      console.log('window.validateCert() : valide la structure des données');
    }
  }, []);

  // Durées de validité par type (en mois)
  const validityPeriods = {
    'SEP - Single Engine Piston': 24,
    'MEP - Multi Engine Piston': 24,
    'SET - Single Engine Turbine': 12,
    'MET - Multi Engine Turbine': 12,
    'IR - Instrument Rating': 12,
    'Night Rating': null, // Pas d'expiration
    'Mountain Rating': null,
    'Type Rating': 12,
    'FI(A) - Flight Instructor (Avion)': 36,
    'FI(H) - Flight Instructor (Hélicoptère)': 36,
    'FE(A) - Flight Examiner (Avion)': 36,
    'FE(H) - Flight Examiner (Hélicoptère)': 36,
    'BFR - Biennial Flight Review': 24,
    'IPC - Instrument Proficiency Check': 12,
    'Line Check': 12,
    'CRM - Crew Resource Management': 36,
    'Dangerous Goods': 24,
    'Security Training': 60,
    // Default pour autres
    'default': 12
  };

  const calculateExpiryDate = (issueDate, type, category) => {
    if (!issueDate || category === 'licenses') return '';

    const issue = new Date(issueDate);
    let validityMonths = validityPeriods[type] || validityPeriods.default;

    if (validityMonths === null) return ''; // Pas d'expiration

    issue.setMonth(issue.getMonth() + validityMonths);
    return issue.toISOString().split('T')[0];
  };

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };

      // Auto-calculer la date d'expiration si on change la date d'émission ou le type
      if ((field === 'issueDate' || field === 'type') && prev.category !== 'licenses') {
        const issueDate = field === 'issueDate' ? value : prev.issueDate;
        const type = field === 'type' ? value : prev.type;
        updated.expiryDate = calculateExpiryDate(issueDate, type, prev.category);
      }

      // Si on change de catégorie, recalculer l'expiration
      if (field === 'category' && value !== 'licenses' && prev.issueDate && prev.type) {
        updated.expiryDate = calculateExpiryDate(prev.issueDate, prev.type, value);
      } else if (field === 'category' && value === 'licenses') {
        updated.expiryDate = ''; // Pas d'expiration pour les licences
      }

      return updated;
    });
  };

  const handleDocumentUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Vérifier l'espace disponible avant l'upload
      const currentSize = parseFloat(getLocalStorageSize());
      const fileSizeMB = file.size / (1024 * 1024);
      const base64SizeMB = fileSizeMB * 1.37; // Base64 ajoute ~37% de taille
      const projectedTotal = currentSize + base64SizeMB;

      // Si le fichier est trop gros même après nettoyage complet
      if (base64SizeMB > 4.8) {
        const useReference = confirm(
          `❌ Fichier trop volumineux !\n\n` +
          `Taille du fichier: ${fileSizeMB.toFixed(2)}MB\n` +
          `Après encodage: ~${base64SizeMB.toFixed(2)}MB\n` +
          `Limite maximale: ~4.8MB\n\n` +
          `Voulez-vous enregistrer uniquement une référence au fichier ?\n` +
          `(Le nom du fichier sera sauvegardé, mais pas son contenu)\n\n` +
          `OK = Sauvegarder la référence\n` +
          `Annuler = Ne pas ajouter le document`
        );

        if (useReference) {
          // Sauvegarder juste la référence
          setFormData(prev => ({
            ...prev,
            document: null, // Pas de contenu
            documentName: `[Référence] ${file.name} (${fileSizeMB.toFixed(1)}MB)` // Nom avec indication
          }));
          alert(
            `✅ Référence ajoutée\n\n` +
            `Le nom du document a été enregistré.\n` +
            `Conservez le fichier original sur votre ordinateur.\n\n` +
            `Pour réduire la taille, utilisez:\n` +
            `• smallpdf.com (PDF)\n` +
            `• tinypng.com (images)\n` +
            `• cloudconvert.com (général)`
          );
        } else {
          e.target.value = '';
        }
        return;
      }

      if (projectedTotal > 4.5) {
        // Proposer un nettoyage automatique complet
        const confirmClean = confirm(
          `⚠️ Espace insuffisant !\n\n` +
          `Espace actuel: ${currentSize.toFixed(2)}MB\n` +
          `Fichier (après encodage): ~${base64SizeMB.toFixed(2)}MB\n` +
          `Total prévu: ${projectedTotal.toFixed(2)}MB\n` +
          `Limite: ~5MB\n\n` +
          `Voulez-vous effectuer un nettoyage complet pour faire de la place ?`
        );

        if (confirmClean) {
          // Forcer un nettoyage complet
          const result = manualCleanStorage();
          updateStorageInfo();

          // Revérifier après nettoyage
          const newSize = parseFloat(getLocalStorageSize());
          if (newSize + base64SizeMB > 4.8) {
            alert(`Même après nettoyage, pas assez d'espace. Le fichier doit être compressé.`);
            e.target.value = '';
            return;
          } else {
            alert(`✅ Nettoyage terminé ! ${result.freedMB}MB libérés. Vous pouvez maintenant réessayer.`);
          }
        }
        e.target.value = '';
        return;
      }

      // Limites ajustées pour tenir compte du base64
      let maxSize = 3 * 1024 * 1024; // 3MB par défaut (devient ~4MB en base64)

      // Pour les PDF, limiter selon l'espace disponible
      if (file.type === 'application/pdf') {
        const availableSpace = (4.5 - currentSize) * 1024 * 1024;
        maxSize = Math.min(availableSpace / 1.37, 10 * 1024 * 1024); // Max 10MB ou l'espace disponible
      }
      // Pour les images, limiter à 2MB (devient ~2.7MB en base64)
      else if (file.type.startsWith('image/')) {
        maxSize = 2 * 1024 * 1024;
      }

      if (file.size > maxSize) {
        const maxSizeMB = maxSize / (1024 * 1024);
        alert(`Le fichier est trop volumineux (max ${maxSizeMB}MB). Taille actuelle: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        e.target.value = ''; // Réinitialiser l'input
        return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        let result = reader.result;

        // Compression intelligente basée sur le type et la taille
        if (file.type.startsWith('image/')) {
          let maxWidth = 1200; // Par défaut
          let targetSizeMB = 2; // Cible de compression

          // Compression plus agressive si le fichier est gros
          if (file.size > 3 * 1024 * 1024) {
            maxWidth = 1000;
            targetSizeMB = 1.5;
          }
          if (file.size > 4 * 1024 * 1024) {
            maxWidth = 800;
            targetSizeMB = 1;
          }

          try {
            result = await compressImage(result, maxWidth);
            const compressedSizeMB = (result.length / 1024 / 1024).toFixed(2);
            const originalSizeMB = (file.size / 1024 / 1024).toFixed(2);
                      } catch (error) {
            console.error('Erreur de compression:', error);
          }
        }

        // Vérifier la taille finale après compression
        const resultSizeMB = (result.length / 1024 / 1024).toFixed(2);
        const currentSize = parseFloat(getLocalStorageSize());
        const newTotal = currentSize + parseFloat(resultSizeMB);

        if (newTotal > 4.8) {
          alert(
            `❌ Impossible d'ajouter ce document !\n\n` +
            `Espace actuel: ${currentSize.toFixed(2)}MB\n` +
            `Document: ${resultSizeMB}MB\n` +
            `Total: ${newTotal.toFixed(2)}MB (limite: ~5MB)\n\n` +
            `Solutions:\n` +
            `1. Cliquez sur "Nettoyer le stockage"\n` +
            `2. Supprimez d'anciens documents\n` +
            `3. Compressez le fichier avant l'upload`
          );
          e.target.value = '';

          // Proposer le nettoyage
          if (confirm('Voulez-vous nettoyer le stockage maintenant ?')) {
            handleCleanStorage();
          }
          return;
        } else if (resultSizeMB > 1) {
          // Avertissement pour les fichiers > 1MB
          const confirmSave = confirm(
            `⚠️ Document volumineux: ${resultSizeMB}MB\n\n` +
            `Espace restant après ajout: ${(4.8 - newTotal).toFixed(2)}MB\n\n` +
            `Continuer ?`
          );
          if (!confirmSave) {
            e.target.value = '';
            return;
          }
        }

        setFormData(prev => ({
          ...prev,
          document: result,
          documentName: file.name
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
            
    const item = {
      ...formData,
      id: editingItem ? editingItem.id : Date.now(),
      createdAt: editingItem ? editingItem.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Retirer la catégorie de l'objet item car elle ne doit pas être stockée dans l'item
    const { category, ...itemWithoutCategory } = item;

    const newCertifications = { ...certifications };

    if (editingItem && editingCategory) {
      const index = newCertifications[editingCategory].findIndex(c => c.id === editingItem.id);
      if (index !== -1) {
        newCertifications[editingCategory][index] = itemWithoutCategory;
      }
    } else {
      newCertifications[category].push(itemWithoutCategory);
    }

        
    setCertifications(newCertifications);

    // Utiliser safeSetItem pour gérer les erreurs de quota
    const saved = safeSetItem('pilotCertifications', JSON.stringify(newCertifications));
    
    if (saved) {
      resetForm();
      alert(editingItem ? 'Certification modifiée !' : 'Certification ajoutée !');
    } else {
      alert('Erreur de sauvegarde : espace de stockage insuffisant');
    }
  };

  const resetForm = () => {
    setFormData({
      category: 'licenses',
      type: '',
      name: '',
      issueDate: '',
      expiryDate: '',
      document: null,
      documentName: ''
    });
    setEditingItem(null);
    setEditingCategory(null);
    setShowForm(false);
  };

  const handleEdit = (category, item) => {
    setFormData({
      ...item,
      category: category
    });
    setEditingItem(item);
    setEditingCategory(category);
    setShowForm(true);
  };

  const handleDelete = (category, id) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette certification ?')) {
      const newCertifications = { ...certifications };
      newCertifications[category] = newCertifications[category].filter(c => c.id !== id);
      setCertifications(newCertifications);
      localStorage.setItem('pilotCertifications', JSON.stringify(newCertifications));
    }
  };

  const handleViewDocument = (doc, name) => {
    const link = document.createElement('a');
    link.href = doc;
    link.download = name;
    link.target = '_blank';
    link.click();
  };


  // Style pour les inputs - contraintes fortes pour éviter le débordement sur mobile
  const inputStyle = {
    padding: '8px 12px',
    border: '1px solid var(--text-tertiary)',
    borderRadius: '8px',
    fontSize: '14px',
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
    boxSizing: 'border-box',
    backgroundColor: 'var(--bg-overlay)',
    WebkitAppearance: 'none',  // Supprime le style natif iOS
    MozAppearance: 'none',
    appearance: 'none'
  };

  // Style pour les conteneurs de champs - empêche le débordement
  const fieldContainerStyle = {
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden'
  };

  const labelStyle = {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: '500',
    marginBottom: '4px',
    display: 'block'
  };

  // Compter le total de certifications
  const totalCertifications = Object.values(certifications).reduce((sum, arr) => sum + arr.length, 0);

  // Vérifier les dates d'expiration
  const getExpiryColor = (expiryDate) => {
    if (!expiryDate) return 'var(--text-secondary)';
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) return '#C04534';
    if (daysUntilExpiry <= 30) return 'var(--accent-primary)';
    if (daysUntilExpiry <= 90) return 'var(--accent-primary)';
    return 'var(--text-secondary)';
  };

  const renderCertificationItem = (category, item) => (
    <div key={item.id} style={{ 
      padding: '6px 0',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '16px'
    }}>
      <div style={{ flex: 1 }}>
        <p style={{ 
          fontSize: '14px', 
          fontWeight: '600',
          color: 'var(--text-primary)',
          marginBottom: '4px'
        }}>
          {item.name || item.type}
        </p>
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap',
          gap: '16px', 
          fontSize: '12px', 
          color: 'var(--text-secondary)',
          marginBottom: item.remarks ? '4px' : '0'
        }}>
          {item.number && <span>N° {item.number}</span>}
          {item.issuedBy && <span>{item.issuedBy}</span>}
          {item.issueDate && (
            <span>Délivré: {new Date(item.issueDate).toLocaleDateString()}</span>
          )}
          {item.expiryDate && (
            <span style={{ color: getExpiryColor(item.expiryDate) }}>
              Expire: {new Date(item.expiryDate).toLocaleDateString()}
            </span>
          )}
        </div>
        {item.remarks && (
          <p style={{ 
            fontSize: '12px', 
            color: 'var(--text-tertiary)', 
            fontStyle: 'italic'
          }}>
            {item.remarks}
          </p>
        )}
      </div>
      
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
        {item.document && (
          <button
            onClick={() => handleViewDocument(item.document, item.documentName)}
            style={{ 
              padding: '6px', 
              backgroundColor: 'transparent',
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
            title="Voir le document"
          >
            <Eye size={16} />
          </button>
        )}
        <button
          onClick={() => handleEdit(category, item)}
          style={{ 
            padding: '6px', 
            backgroundColor: 'transparent',
            border: 'none', 
            borderRadius: '8px', 
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            transition: 'all 0.2s'
          }}
          title="Modifier"
        >
          <Edit2 size={16} />
        </button>
        <button
          onClick={() => handleDelete(category, item.id)}
          style={{ 
            padding: '6px', 
            backgroundColor: 'transparent',
            color: '#C04534', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          title="Supprimer"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div
      style={{
        fontFamily: "'Century Gothic', 'Questrial', 'Jost', system-ui, sans-serif",
        color: 'var(--text-primary)',
      }}
    >
      {/* Formulaire unifié */}
      {showForm && (
        <div style={{
          backgroundColor: 'var(--bg-overlay)',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: '16px',
          overflow: 'hidden',
          maxWidth: '100%',
          boxSizing: 'border-box'
        }}>
          <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>
            {editingItem ? 'Modifier la certification' : 'Nouvelle certification'}
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: '16px', marginBottom: '20px', minWidth: 0 }}>
            <div style={fieldContainerStyle}>
              <label style={labelStyle}>Catégorie *</label>
              <select
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                style={inputStyle}
                disabled={editingItem}
              >
                <option value="licenses">Licences</option>
                <option value="ratings">Qualifications</option>
                <option value="endorsements">Variantes</option>
                <option value="training">Formations</option>
              </select>
            </div>

            <div style={fieldContainerStyle}>
              <label style={labelStyle}>Type *</label>
              <select
                value={formData.type}
                onChange={(e) => handleChange('type', e.target.value)}
                style={inputStyle}
                required
              >
                <option value="">Sélectionner...</option>
                {certTypes[formData.category].map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
                <option value="other">Autre</option>
              </select>
            </div>
          </div>

          {formData.type === 'other' && (
            <div style={{ ...fieldContainerStyle, marginBottom: '20px' }}>
              <label style={labelStyle}>Nom personnalisé *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Nom de la certification"
                style={inputStyle}
                required
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '20px', minWidth: 0 }}>
            <div style={fieldContainerStyle}>
              <label style={labelStyle}>Date de délivrance</label>
              <input
                type="date"
                value={formData.issueDate}
                onChange={(e) => handleChange('issueDate', e.target.value)}
                style={inputStyle}
              />
            </div>

            {formData.category !== 'licenses' && (
              <div style={fieldContainerStyle}>
                <label style={labelStyle}>Date d'expiration</label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => handleChange('expiryDate', e.target.value)}
                  style={{...inputStyle, backgroundColor: formData.issueDate && formData.type ? 'rgba(242, 105, 33, 0.10)' : 'white'}}
                  title={formData.issueDate && formData.type ? 'Calculée automatiquement mais modifiable' : ''}
                />
              </div>
            )}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Document (PDF, image)</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ 
                padding: '8px 16px', 
                backgroundColor: 'var(--border-subtle)', 
                color: 'var(--text-secondary)', 
                border: 'none', 
                borderRadius: '8px', 
                fontSize: '14px', 
                fontWeight: '500', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px' 
              }}>
                <Upload size={16} />
                Choisir un fichier
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleDocumentUpload}
                  style={{ display: 'none' }}
                />
              </label>
              {formData.documentName && (
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  <FileText size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  {formData.documentName}
                </span>
              )}
            </div>
          </div>


          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSubmit}
              style={{ 
                padding: '8px 16px', 
                backgroundColor: 'var(--text-secondary)', 
                color: 'var(--text-primary)', 
                border: 'none', 
                borderRadius: '8px', 
                fontSize: '14px', 
                fontWeight: '500', 
                cursor: 'pointer' 
              }}
            >
              {editingItem ? 'Modifier' : 'Ajouter'}
            </button>
            
            <button
              onClick={resetForm}
              style={{ 
                padding: '8px 16px', 
                backgroundColor: 'var(--border-subtle)', 
                color: 'var(--text-secondary)', 
                border: 'none', 
                borderRadius: '8px', 
                fontSize: '14px', 
                fontWeight: '500', 
                cursor: 'pointer' 
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Listes des certifications par catégorie */}
      <div style={{ backgroundColor: 'var(--bg-overlay)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '20px' }}>
        {/* Bouton Ajouter centré */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{ 
              padding: '8px 24px', 
              backgroundColor: showForm ? '#C04534' : 'var(--text-secondary)', 
              color: 'var(--text-primary)', 
              border: 'none', 
              borderRadius: '8px', 
              fontSize: '14px', 
              fontWeight: '500', 
              cursor: 'pointer'
            }}
          >
            {showForm ? 'Fermer' : 'Ajouter'}
          </button>
        </div>
        
        <div style={{ 
          height: '2px',
          backgroundColor: 'var(--text-secondary)',
          marginBottom: '20px'
        }} />
        
        {Object.entries(certifications)
          .filter(([category, items]) => items.length > 0)
          .map(([category, items], categoryIndex, filteredArray) => {
            const isLastCategory = categoryIndex === filteredArray.length - 1;
            
            return (
              <div key={category} style={{ marginBottom: '0' }}>
                {/* En-tête de catégorie */}
                <div style={{ 
                  marginBottom: '8px'
                }}>
                  <h4 style={{ 
                    fontSize: '16px', 
                    fontWeight: '600',
                    color: 'var(--text-primary)'
                  }}>
                    {categoryLabels[category]}
                  </h4>
                </div>

                {/* Liste des éléments */}
                <div>
                  {items.map((item, index) => (
                    <React.Fragment key={item.id}>
                      {renderCertificationItem(category, item)}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            );
          })
        }
        
        {/* Message si aucune certification */}
        {totalCertifications === 0 && (
          <div style={{ 
            padding: '40px',
            textAlign: 'center',
            color: 'var(--text-tertiary)'
          }}>
            <AlertCircle size={48} style={{ color: 'var(--border-subtle)', marginBottom: '16px' }} />
            <p style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
              Aucune certification enregistrée
            </p>
            <p style={{ fontSize: '14px' }}>
              Cliquez sur "Ajouter" pour enregistrer vos licences et qualifications
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PilotCertifications;