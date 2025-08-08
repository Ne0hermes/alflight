// src/features/aircraft/AircraftModule.jsx
import React, { memo, useState, useEffect } from 'react';
import { useAircraft } from '@core/contexts';
import { useAircraftStore } from '@core/stores/aircraftStore';
import { Plus, Edit2, Trash2, Download, Upload, Info, AlertTriangle, FileText, Eye, BookOpen } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { ManexImporter } from './components/ManexImporter';
import { ManexViewer } from './components/ManexViewer';

// Composant pour l'aide contextuelle
const InfoIcon = memo(({ tooltip }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  return (
    <span 
      style={{ 
        position: 'relative', 
        display: 'inline-flex', 
        marginLeft: '4px',
        alignItems: 'center'
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Info
        size={14}
        style={{ cursor: 'help', color: '#9CA3AF' }}
      />
      {showTooltip && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          left: '0',
          backgroundColor: '#1F2937',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          lineHeight: '1.4',
          zIndex: 10000,
          minWidth: '180px',
          maxWidth: '280px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          {tooltip}
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '12px',
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderTop: '4px solid #1F2937',
          }} />
        </div>
      )}
    </span>
  );
});

InfoIcon.displayName = 'InfoIcon';

export const AircraftModule = memo(() => {
  const aircraftContext = useAircraft();
  
  // DEBUG: Afficher le contexte complet
  console.log('🔍 AircraftModule - Full Context:', aircraftContext);
  
  // Vérifier si le contexte est valide
  if (!aircraftContext) {
    console.error('❌ AircraftModule - useAircraft returned null/undefined');
    return (
      <div style={{ padding: '20px', backgroundColor: '#FEF2F2', border: '1px solid #F87171', borderRadius: '8px' }}>
        <h3 style={{ color: '#B91C1C', marginBottom: '10px' }}>Erreur: Contexte Aircraft non disponible</h3>
        <p style={{ color: '#DC2626' }}>Vérifiez que AircraftProvider enveloppe bien votre application.</p>
      </div>
    );
  }
  
  const { aircraftList, selectedAircraft, setSelectedAircraft, addAircraft, updateAircraft, deleteAircraft } = aircraftContext;
  
  // DEBUG: Afficher l'état actuel
  console.log('✈️ AircraftModule - aircraftList:', aircraftList);
  console.log('✅ AircraftModule - selectedAircraft:', selectedAircraft);
  console.log('📊 AircraftModule - aircraftList length:', aircraftList?.length || 0);
  
  const [showForm, setShowForm] = useState(false);
  const [editingAircraft, setEditingAircraft] = useState(null);
  const [showManexImporter, setShowManexImporter] = useState(false);
  const [showManexViewer, setShowManexViewer] = useState(false);
  const [manexAircraft, setManexAircraft] = useState(null);
  const updateAircraftManex = useAircraftStore(state => state.updateAircraftManex);

  const handleSelectAircraft = (aircraft) => {
    console.log('🎯 AircraftModule - Selecting aircraft:', aircraft);
    console.log('🔧 AircraftModule - Aircraft ID:', aircraft.id);
    console.log('📝 AircraftModule - Aircraft Registration:', aircraft.registration);
    console.log('🔍 AircraftModule - Current selectedAircraft before:', selectedAircraft);
    console.log('🔍 AircraftModule - Type of setSelectedAircraft:', typeof setSelectedAircraft);
    
    // Appel réel de la fonction
    setSelectedAircraft(aircraft);
    console.log('✅ AircraftModule - setSelectedAircraft called');
    
    // Vérifier après un court délai
    setTimeout(() => {
      console.log('⏱️ AircraftModule - Checking selectedAircraft after 100ms:', selectedAircraft);
    }, 100);
  };

  const handleEdit = (aircraft) => {
    console.log('✏️ AircraftModule - Editing aircraft:', aircraft);
    console.log('✏️ AircraftModule - Aircraft surfaces:', aircraft.compatibleRunwaySurfaces);
    setEditingAircraft(aircraft);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    console.log('🗑️ AircraftModule - Attempting to delete aircraft:', id);
    if (window.confirm('Êtes-vous sûr de supprimer cet avion ?')) {
      deleteAircraft(id);
      console.log('✅ AircraftModule - Aircraft deleted:', id);
    }
  };

  const handleExport = () => {
    console.log('📤 AircraftModule - Exporting aircraft list');
    const dataStr = JSON.stringify(aircraftList, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `aircraft-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    console.log('✅ AircraftModule - Export completed');
  };

  const handleImport = (event) => {
    console.log('📥 AircraftModule - Importing aircraft');
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target.result);
          console.log('📋 AircraftModule - Imported data:', importedData);
          
          if (Array.isArray(importedData)) {
            if (window.confirm(`Voulez-vous importer ${importedData.length} avion(s) ?`)) {
              importedData.forEach(aircraft => {
                addAircraft(aircraft);
              });
              alert('Import réussi !');
              console.log('✅ AircraftModule - Import successful');
            }
          } else {
            alert('Format de fichier invalide');
            console.error('❌ AircraftModule - Invalid file format');
          }
        } catch (error) {
          alert('Erreur lors de l\'import : ' + error.message);
          console.error('❌ AircraftModule - Import error:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  // Fonction pour tester manuellement la sélection
  window.debugSelectAircraft = (index) => {
    if (aircraftList && aircraftList[index]) {
      console.log('🧪 DEBUG - Manually selecting aircraft at index:', index);
      handleSelectAircraft(aircraftList[index]);
    }
  };

  // Test direct du store
  window.debugStoreSelect = (index) => {
    if (aircraftList && aircraftList[index]) {
      console.log('🧪 DEBUG - Direct store selection at index:', index);
      const { setSelectedAircraft: storeSetSelectedAircraft } = useAircraftStore.getState();
      storeSetSelectedAircraft(aircraftList[index]);
    }
  };

  // Test de création d'un avion de debug
  window.debugCreateTestAircraft = () => {
    const testAircraft = {
      registration: 'DEBUG-TEST',
      model: 'Test Aircraft',
      fuelType: 'AVGAS',
      fuelCapacity: 100,
      cruiseSpeedKt: 100,
      fuelConsumption: 10,
      maxTakeoffWeight: 1000,
      compatibleRunwaySurfaces: ['ASPH', 'CONC', 'GRASS']
    };
    console.log('🧪 Creating test aircraft with surfaces:', testAircraft.compatibleRunwaySurfaces);
    addAircraft(testAircraft);
  };

  // Fonction pour forcer la mise à jour des surfaces d'un avion
  window.debugUpdateAircraftSurfaces = (index, surfaces) => {
    try {
      if (!aircraftList || !aircraftList[index]) {
        console.error('❌ Avion non trouvé à l\'index:', index);
        return;
      }
      
      // Valider que surfaces est un tableau
      if (!Array.isArray(surfaces)) {
        console.error('❌ Les surfaces doivent être un tableau, reçu:', typeof surfaces);
        return;
      }
      
      const aircraft = aircraftList[index];
      const updated = {
        ...aircraft,
        compatibleRunwaySurfaces: surfaces,
        // S'assurer que les autres champs obligatoires sont présents
        cruiseSpeed: aircraft.cruiseSpeed || aircraft.cruiseSpeedKt || 100,
        cruiseSpeedKt: aircraft.cruiseSpeedKt || aircraft.cruiseSpeed || 100
      };
      
      console.log('🔧 Updating aircraft surfaces:', {
        aircraft: aircraft.registration,
        oldSurfaces: aircraft.compatibleRunwaySurfaces,
        newSurfaces: surfaces,
        fullUpdate: updated
      });
      
      updateAircraft(updated);
      console.log('✅ Surfaces mises à jour avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour des surfaces:', error);
    }
  };

  // Fonction pour afficher l'état complet d'un avion
  window.debugShowAircraft = (index) => {
    if (aircraftList && aircraftList[index]) {
      const aircraft = aircraftList[index];
      console.group(`✈️ État complet de l'avion ${aircraft.registration}`);
      console.log('Données brutes:', aircraft);
      console.log('Surfaces compatibles:', aircraft.compatibleRunwaySurfaces);
      console.log('Type de compatibleRunwaySurfaces:', typeof aircraft.compatibleRunwaySurfaces);
      console.log('Est un tableau?', Array.isArray(aircraft.compatibleRunwaySurfaces));
      if (aircraft.compatibleRunwaySurfaces) {
        console.log('Contenu des surfaces:');
        aircraft.compatibleRunwaySurfaces.forEach((s, i) => {
          console.log(`  [${i}]: "${s}" (type: ${typeof s})`);
        });
      }
      console.groupEnd();
    } else {
      console.error('❌ Avion non trouvé à l\'index:', index);
    }
  };

  // Fonction pour tester la sauvegarde
  window.debugTestSave = () => {
    console.group('🧪 Test de sauvegarde');
    
    const testData = {
      registration: 'TEST-SAVE',
      model: 'Test Save Model',
      fuelType: 'AVGAS',
      fuelCapacity: 100,
      cruiseSpeed: 120,
      cruiseSpeedKt: 120,
      fuelConsumption: 30,
      maxTakeoffWeight: 1000,
      compatibleRunwaySurfaces: ['ASPH', 'CONC', 'GRASS']
    };
    
    console.log('📋 Données de test:', testData);
    
    try {
      addAircraft(testData);
      console.log('✅ Sauvegarde réussie');
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
      console.error('Stack trace:', error.stack);
    }
    
    console.groupEnd();
  };

  // Fonction pour migrer tous les avions sans surfaces compatibles
  window.debugMigrateAllAircraft = () => {
    console.group('🔄 Migration des avions');
    let migratedCount = 0;
    
    aircraftList.forEach((aircraft, index) => {
      if (!aircraft.compatibleRunwaySurfaces || aircraft.compatibleRunwaySurfaces.length === 0) {
        console.log(`📌 Migration de ${aircraft.registration}...`);
        const updated = {
          ...aircraft,
          compatibleRunwaySurfaces: ['ASPH', 'CONC'], // Valeurs par défaut
          cruiseSpeed: aircraft.cruiseSpeed || aircraft.cruiseSpeedKt || 100,
          cruiseSpeedKt: aircraft.cruiseSpeedKt || aircraft.cruiseSpeed || 100
        };
        updateAircraft(updated);
        migratedCount++;
      }
    });
    
    console.log(`✅ Migration terminée: ${migratedCount} avion(s) mis à jour`);
    console.groupEnd();
  };

  return (
    <div>
      <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold)}>
          ✈️ Gestion des avions
        </h3>
        <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
          <label style={sx.combine(sx.components.button.base, sx.components.button.secondary, { cursor: 'pointer' })}>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
            <Upload size={16} />
            Importer
          </label>
          <button
            onClick={handleExport}
            style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
          >
            <Download size={16} />
            Exporter
          </button>
          <button
            onClick={() => {
              console.log('➕ AircraftModule - Opening new aircraft form');
              setEditingAircraft(null);
              setShowForm(true);
            }}
            style={sx.combine(sx.components.button.base, sx.components.button.primary)}
          >
            <Plus size={16} />
            Nouvel avion
          </button>
        </div>
      </div>

      {/* Section de débogage - VISIBLE UNIQUEMENT EN DEV */}
      <div style={{ 
        marginBottom: '16px', 
        padding: '12px', 
        backgroundColor: '#F3F4F6', 
        borderRadius: '8px',
        border: '1px solid #E5E7EB'
      }}>
        <h4 style={{ margin: 0, marginBottom: '8px', fontSize: '14px', color: '#374151' }}>
          🔧 Debug Info:
        </h4>
        
        {/* Alerte si des avions n'ont pas de surfaces compatibles */}
        {aircraftList.some(a => !a.compatibleRunwaySurfaces || a.compatibleRunwaySurfaces.length === 0) && (
          <div style={{
            backgroundColor: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: '6px',
            padding: '8px',
            marginBottom: '8px',
            fontSize: '12px'
          }}>
            <strong>⚠️ Attention :</strong> Certains avions n'ont pas de surfaces compatibles définies.
            <br/>
            <button
              onClick={() => window.debugMigrateAllAircraft()}
              style={{
                marginTop: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                backgroundColor: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Migrer tous les avions
            </button>
          </div>
        )}
        
        <div style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1.6' }}>
          <p style={{ margin: '4px 0' }}>
            • Nombre d'avions: <strong>{aircraftList?.length || 0}</strong>
          </p>
          <p style={{ margin: '4px 0' }}>
            • Avion sélectionné: <strong>
              {selectedAircraft 
                ? `${selectedAircraft.registration} (ID: ${selectedAircraft.id})` 
                : 'Aucun'}
            </strong>
          </p>
          <p style={{ margin: '4px 0' }}>
            • État du contexte: <strong style={{ color: aircraftContext ? '#10B981' : '#EF4444' }}>
              {aircraftContext ? 'Connecté' : 'Déconnecté'}
            </strong>
          </p>
          <p style={{ margin: '4px 0', fontSize: '11px', color: '#9CA3AF' }}>
            Console: window.debugSelectAircraft(0) pour sélectionner le premier avion
          </p>
          <p style={{ margin: '4px 0', fontSize: '11px', color: '#9CA3AF' }}>
            Console: window.debugStoreSelect(1) pour sélectionner directement via le store
          </p>
          <p style={{ margin: '4px 0', fontSize: '11px', color: '#9CA3AF' }}>
            Console: window.debugCreateTestAircraft() pour créer un avion de test
          </p>
          <p style={{ margin: '4px 0', fontSize: '11px', color: '#9CA3AF' }}>
            Console: window.debugUpdateAircraftSurfaces(0, ['ASPH', 'GRASS']) pour forcer les surfaces
          </p>
          <p style={{ margin: '4px 0', fontSize: '11px', color: '#9CA3AF' }}>
            Console: window.debugShowAircraft(0) pour voir l'état complet d'un avion
          </p>
          <p style={{ margin: '4px 0', fontSize: '11px', color: '#9CA3AF' }}>
            Console: window.debugMigrateAllAircraft() pour migrer tous les avions sans surfaces
          </p>
          <p style={{ margin: '4px 0', fontSize: '11px', color: '#9CA3AF' }}>
            Console: window.debugTestSave() pour tester la sauvegarde
          </p>
        </div>
        <div style={{ marginTop: '8px' }}>
          <button
            onClick={() => {
              console.log('🔬 Testing direct store access...');
              const store = useAircraftStore.getState();
              console.log('🔬 Store state:', store);
              console.log('🔬 Store setSelectedAircraft:', store.setSelectedAircraft);
              if (aircraftList.length > 1) {
                const targetAircraft = selectedAircraft?.id === aircraftList[0].id ? aircraftList[1] : aircraftList[0];
                console.log('🔬 Switching to:', targetAircraft);
                store.setSelectedAircraft(targetAircraft);
              }
            }}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              backgroundColor: '#10B981',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Test Direct Store Selection
          </button>
        </div>
      </div>

      {/* Liste des avions */}
      <div style={{ display: 'grid', gap: '12px' }}>
        {aircraftList && aircraftList.length > 0 ? (
          aircraftList.map((aircraft, index) => {
            const isSelected = selectedAircraft && selectedAircraft.id === aircraft.id;
            
            console.log(`🔍 Rendering aircraft ${index}:`, {
              aircraftId: aircraft.id,
              selectedId: selectedAircraft?.id,
              isSelected: isSelected,
              strictEquality: selectedAircraft?.id === aircraft.id,
              typeOfAircraftId: typeof aircraft.id,
              typeOfSelectedId: typeof selectedAircraft?.id
            });
            
            return (
              <div
                key={aircraft.id}
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  border: isSelected ? '2px solid #3182CE' : '1px solid #E5E7EB',
                  backgroundColor: isSelected ? '#EBF8FF' : 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  marginBottom: '8px',
                  boxShadow: isSelected ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
                }}
                onClick={(e) => {
                  console.log(`🖱️ AircraftModule - Card clicked for aircraft index ${index}`);
                  if (e.target.closest('button')) {
                    console.log('⚠️ AircraftModule - Click on button, stopping propagation');
                    return;
                  }
                  handleSelectAircraft(aircraft);
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                  {/* Photo de l'avion */}
                  {aircraft.photo && (
                    <div style={{ 
                      flexShrink: 0,
                      width: '120px',
                      height: '90px',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      border: '1px solid #e5e7eb'
                    }}>
                      <img 
                        src={aircraft.photo} 
                        alt={`${aircraft.registration}`}
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover' 
                        }}
                      />
                    </div>
                  )}
                  
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>
                      {aircraft.registration} - {aircraft.model}
                      {aircraft.wakeTurbulenceCategory && (
                        <span style={{
                          marginLeft: '8px',
                          padding: '2px 6px',
                          backgroundColor: 
                            aircraft.wakeTurbulenceCategory === 'L' ? '#DBEAFE' :
                            aircraft.wakeTurbulenceCategory === 'M' ? '#FEF3C7' :
                            aircraft.wakeTurbulenceCategory === 'H' ? '#FED7AA' :
                            '#FECACA',
                          color: 
                            aircraft.wakeTurbulenceCategory === 'L' ? '#1E40AF' :
                            aircraft.wakeTurbulenceCategory === 'M' ? '#92400E' :
                            aircraft.wakeTurbulenceCategory === 'H' ? '#9A3412' :
                            '#991B1B',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          CAT {aircraft.wakeTurbulenceCategory}
                        </span>
                      )}
                      {isSelected && (
                        <span style={{ fontSize: '14px', color: '#6B7280', marginLeft: '8px' }}>
                          (sélectionné)
                        </span>
                      )}
                    </h4>
                    <div style={{ fontSize: '14px', color: '#6B7280' }}>
                      <p>Carburant: {aircraft.fuelType} • Capacité: {aircraft.fuelCapacity}L</p>
                      <p>Vitesse: {aircraft.cruiseSpeed || aircraft.cruiseSpeedKt}kt • Conso: {aircraft.fuelConsumption}L/h</p>
                      <p>MTOW: {aircraft.maxTakeoffWeight}kg</p>
                      {/* Affichage des informations MANEX si présent */}
                      {aircraft.manex && (
                        <p style={{ color: '#059669', fontSize: '12px', marginTop: '4px' }}>
                          📚 MANEX: {aircraft.manex.fileName} ({aircraft.manex.pageCount} pages)
                        </p>
                      )}
                      {/* DEBUG: Afficher les surfaces compatibles */}
                      <p style={{ color: '#059669', fontSize: '12px' }}>
                        🛬 Surfaces compatibles: {aircraft.compatibleRunwaySurfaces && Array.isArray(aircraft.compatibleRunwaySurfaces) && aircraft.compatibleRunwaySurfaces.length > 0 ? 
                          `[${aircraft.compatibleRunwaySurfaces.join(', ')}]` : 
                          <span style={{ color: '#dc2626' }}>Non définies ⚠️</span>}
                      </p>
                      {aircraft.masses?.emptyMass && (
                        <p style={{ color: '#3182CE' }}>
                          ⚖️ Masse à vide: {aircraft.masses.emptyMass}kg • MLM: {aircraft.limitations?.maxLandingMass || 'N/A'}kg
                        </p>
                      )}
                      {aircraft.armLengths?.emptyMassArm && (
                        <p style={{ color: '#7C3AED' }}>
                          📏 Bras masse à vide: {aircraft.armLengths.emptyMassArm}mm • Carburant: {aircraft.armLengths.fuelArm}mm
                        </p>
                      )}
                      {/* Types de pistes compatibles */}
                      {aircraft.compatibleRunwaySurfaces && aircraft.compatibleRunwaySurfaces.length > 0 && (
                        <p style={{ color: '#059669', fontSize: '13px', marginTop: '4px' }}>
                          🛬 Pistes compatibles: {(() => {
                            const surfaceMap = {
                              'ASPH': 'Asphalte',
                              'CONC': 'Béton',
                              'GRASS': 'Herbe',
                              'GRVL': 'Gravier',
                              'UNPAVED': 'Terre',
                              'SAND': 'Sable',
                              'SNOW': 'Neige',
                              'WATER': 'Eau'
                            };
                            return aircraft.compatibleRunwaySurfaces
                              .map(s => surfaceMap[s] || s)
                              .join(', ');
                          })()}
                        </p>
                      )}
                      {/* Debug info spécifique à cet avion */}
                      <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>
                        ID: {aircraft.id} | Index: {index} | Selected: {isSelected ? 'YES' : 'NO'}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('📚 AircraftModule - MANEX button clicked');
                        setManexAircraft(aircraft);
                        setShowManexImporter(true);
                      }}
                      style={sx.combine(
                        sx.components.button.base, 
                        sx.components.button.secondary, 
                        { 
                          padding: '8px',
                          backgroundColor: aircraft.manex ? '#fef3c7' : undefined,
                          borderColor: aircraft.manex ? '#fbbf24' : undefined
                        }
                      )}
                      title={aircraft.manex ? "MANEX importé - Cliquer pour modifier" : "Importer le MANEX"}
                    >
                      <FileText size={16} color={aircraft.manex ? '#f59e0b' : undefined} />
                    </button>
                    
                    {/* Bouton pour visualiser le MANEX (si existant) */}
                    {aircraft.manex && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setManexAircraft(aircraft);
                          setShowManexViewer(true);
                        }}
                        style={sx.combine(
                          sx.components.button.base, 
                          { 
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '14px',
                            backgroundColor: '#e0f2fe',
                            borderColor: '#0284c7',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }
                        )}
                        title="Consulter les données du MANEX"
                      >
                        <BookOpen size={16} color="#0284c7" />
                      </button>
                    )}
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('✏️ AircraftModule - Edit button clicked');
                        handleEdit(aircraft);
                      }}
                      style={sx.combine(sx.components.button.base, sx.components.button.secondary, { padding: '8px' })}
                      title="Modifier"
                    >
                      <Edit2 size={16} />
                    </button>
                    {aircraftList.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('🗑️ AircraftModule - Delete button clicked');
                          handleDelete(aircraft.id);
                        }}
                        style={sx.combine(sx.components.button.base, sx.components.button.danger, { padding: '8px' })}
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ 
            padding: '40px', 
            textAlign: 'center', 
            backgroundColor: 'white', 
            borderRadius: '8px', 
            border: '1px solid #E5E7EB' 
          }}>
            <p style={{ marginBottom: '16px', fontSize: '16px', color: '#6B7280' }}>Aucun avion enregistré.</p>
            <p style={{ color: '#6B7280' }}>Cliquez sur "Nouvel avion" pour commencer.</p>
          </div>
        )}
      </div>

      {/* Modal formulaire */}
      {showForm && (
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
            maxWidth: '800px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={sx.combine(sx.text.xl, sx.text.bold, sx.spacing.mb(4))}>
              {editingAircraft ? 'Modifier l\'avion' : 'Nouvel avion'}
            </h3>
            
            <AircraftForm
              aircraft={editingAircraft}
              onSubmit={(formData) => {
                console.log('💾 AircraftModule - Form submitted with data:', formData);
                console.log('💾 AircraftModule - Surfaces compatibles:', formData.compatibleRunwaySurfaces);
                
                try {
                  if (editingAircraft) {
                    const updatedAircraft = {...formData, id: editingAircraft.id};
                    console.log('💾 AircraftModule - Updating aircraft:', updatedAircraft);
                    updateAircraft(updatedAircraft);
                    console.log('✅ AircraftModule - Aircraft updated');
                  } else {
                    console.log('💾 AircraftModule - Adding new aircraft');
                    addAircraft(formData);
                    console.log('✅ AircraftModule - New aircraft added');
                  }
                  setShowForm(false);
                  setEditingAircraft(null);
                } catch (error) {
                  console.error('❌ AircraftModule - Erreur lors de la sauvegarde:', error);
                  alert(`Erreur lors de la sauvegarde: ${error.message}`);
                }
              }}
              onCancel={() => {
                console.log('❌ AircraftModule - Form cancelled');
                setShowForm(false);
                setEditingAircraft(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Modal MANEX Importer */}
      {showManexImporter && manexAircraft && (
        <ManexImporter
          aircraft={manexAircraft}
          onManexUpdate={updateAircraftManex}
          onClose={() => {
            setShowManexImporter(false);
            setManexAircraft(null);
          }}
        />
      )}
      
      {/* Modal MANEX Viewer */}
      {showManexViewer && manexAircraft && (
        <ManexViewer
          aircraft={manexAircraft}
          onClose={() => {
            setShowManexViewer(false);
            setManexAircraft(null);
          }}
        />
      )}
    </div>
  );
});

AircraftModule.displayName = 'AircraftModule';

// Composant de formulaire pour ajouter/modifier un avion
const AircraftForm = memo(({ aircraft, onSubmit, onCancel }) => {
  const massUnit = 'kg';
  const [activeTab, setActiveTab] = useState('general'); // État pour l'onglet actif
  const [aircraftPhoto, setAircraftPhoto] = useState(aircraft?.photo || null);

  // DEBUG : Afficher l'avion reçu en props
  console.log('🛩️ AircraftForm - aircraft reçu:', aircraft);
  console.log('🛩️ AircraftForm - surfaces compatibles de l\'avion:', aircraft?.compatibleRunwaySurfaces);

  // Valider et normaliser les surfaces compatibles
  const getValidSurfaces = (surfaces) => {
    if (!surfaces) return ['ASPH', 'CONC'];
    if (!Array.isArray(surfaces)) return ['ASPH', 'CONC'];
    if (surfaces.length === 0) return ['ASPH', 'CONC'];
    // S'assurer que toutes les surfaces sont des chaînes valides
    return surfaces.filter(s => typeof s === 'string' && s.trim().length > 0);
  };
  
  // Fonction pour gérer l'upload de photo
  const handlePhotoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // Limite à 5MB
        alert('La photo est trop volumineuse. Veuillez choisir une image de moins de 5MB.');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setAircraftPhoto(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const [formData, setFormData] = useState({
    registration: aircraft?.registration || '',
    model: aircraft?.model || '',
    fuelType: aircraft?.fuelType || 'AVGAS',
    fuelCapacity: aircraft?.fuelCapacity || '',
    cruiseSpeedKt: aircraft?.cruiseSpeedKt || aircraft?.cruiseSpeed || '',
    fuelConsumption: aircraft?.fuelConsumption || '',
    maxTakeoffWeight: aircraft?.maxTakeoffWeight || '',
    wakeTurbulenceCategory: aircraft?.wakeTurbulenceCategory || 'L', // L=Light, M=Medium, H=Heavy, J=Super
    compatibleRunwaySurfaces: getValidSurfaces(aircraft?.compatibleRunwaySurfaces), // Valider les surfaces
    // Section Performances - Vitesses caractéristiques
    speeds: {
      vso: aircraft?.speeds?.vso || aircraft?.manex?.performances?.vso || '',  // Vitesse de décrochage volets sortis
      vs1: aircraft?.speeds?.vs1 || aircraft?.manex?.performances?.vs1 || '',  // Vitesse de décrochage volets rentrés
      vfe: aircraft?.speeds?.vfe || aircraft?.manex?.performances?.vfe || '',  // Vitesse max volets sortis
      vno: aircraft?.speeds?.vno || aircraft?.manex?.performances?.vno || '',  // Vitesse max en air turbulent
      vne: aircraft?.speeds?.vne || aircraft?.manex?.performances?.vne || '',  // Vitesse à ne jamais dépasser
      va: aircraft?.speeds?.va || aircraft?.manex?.performances?.va || '',    // Vitesse de manœuvre
      vx: aircraft?.speeds?.vx || aircraft?.manex?.performances?.vx || '',    // Vitesse de montée max (pente)
      vy: aircraft?.speeds?.vy || aircraft?.manex?.performances?.vy || '',    // Vitesse de montée optimale (taux)
      vr: aircraft?.speeds?.vr || aircraft?.manex?.performances?.vr || '',    // Vitesse de rotation
      vref: aircraft?.speeds?.vref || aircraft?.manex?.performances?.vref || '', // Vitesse de référence
      vapp: aircraft?.speeds?.vapp || aircraft?.manex?.performances?.vapp || '', // Vitesse d'approche
      vglide: aircraft?.speeds?.vglide || ''  // Vitesse de plané optimal
    },
    // Section Performances - Distances
    distances: {
      takeoffRoll: aircraft?.distances?.takeoffRoll || aircraft?.manex?.performances?.takeoffRoll || '',
      takeoffDistance15m: aircraft?.distances?.takeoffDistance15m || '',
      takeoffDistance50ft: aircraft?.distances?.takeoffDistance50ft || aircraft?.manex?.performances?.takeoffDistance || '',
      landingRoll: aircraft?.distances?.landingRoll || aircraft?.manex?.performances?.landingRoll || '',
      landingDistance15m: aircraft?.distances?.landingDistance15m || '',
      landingDistance50ft: aircraft?.distances?.landingDistance50ft || aircraft?.manex?.performances?.landingDistance || ''
    },
    // Section Performances - Montée et plafonds
    climb: {
      rateOfClimb: aircraft?.climb?.rateOfClimb || '',  // Taux de montée (ft/min)
      serviceCeiling: aircraft?.climb?.serviceCeiling || '',  // Plafond pratique (ft)
      absoluteCeiling: aircraft?.climb?.absoluteCeiling || '',  // Plafond absolu (ft)
      climbGradient: aircraft?.climb?.climbGradient || ''  // Gradient de montée (%)
    },
    // Section Limitations de vent
    windLimits: {
      maxCrosswind: aircraft?.windLimits?.maxCrosswind || aircraft?.manex?.limitations?.maxCrosswind || '',
      maxTailwind: aircraft?.windLimits?.maxTailwind || aircraft?.manex?.limitations?.maxTailwind || '',
      maxHeadwind: aircraft?.windLimits?.maxHeadwind || aircraft?.manex?.limitations?.maxHeadwind || ''
    },
    masses: {
      emptyMass: aircraft?.masses?.emptyMass || '',
      minTakeoffMass: aircraft?.masses?.minTakeoffMass || '',
      baseFactor: aircraft?.masses?.baseFactor || '',
      maxBaggageTube: aircraft?.masses?.maxBaggageTube || '',
      maxAftBaggageExtension: aircraft?.masses?.maxAftBaggageExtension || ''
    },
    armLengths: {
      emptyMassArm: aircraft?.armLengths?.emptyMassArm || '',
      fuelArm: aircraft?.armLengths?.fuelArm || '',
      frontSeat1Arm: aircraft?.armLengths?.frontSeat1Arm || '',
      frontSeat2Arm: aircraft?.armLengths?.frontSeat2Arm || '',
      rearSeat1Arm: aircraft?.armLengths?.rearSeat1Arm || '',
      rearSeat2Arm: aircraft?.armLengths?.rearSeat2Arm || '',
      standardBaggageArm: aircraft?.armLengths?.standardBaggageArm || '',
      baggageTubeArm: aircraft?.armLengths?.baggageTubeArm || '',
      aftBaggageExtensionArm: aircraft?.armLengths?.aftBaggageExtensionArm || ''
    },
    limitations: {
      maxLandingMass: aircraft?.limitations?.maxLandingMass || '',
      maxBaggageLest: aircraft?.limitations?.maxBaggageLest || ''
    },
    // Section Équipements COM/NAV/APP
    equipmentCom: {
      vhf1: aircraft?.equipmentCom?.vhf1 !== false,  // VHF COM 1
      vhf2: aircraft?.equipmentCom?.vhf2 !== false,  // VHF COM 2
      hf: aircraft?.equipmentCom?.hf || false,  // HF
      satcom: aircraft?.equipmentCom?.satcom || false,  // SATCOM
      elt: aircraft?.equipmentCom?.elt !== false,  // ELT (Emergency Locator Transmitter)
      acars: aircraft?.equipmentCom?.acars || false,  // ACARS
      cpdlc: aircraft?.equipmentCom?.cpdlc || false  // CPDLC (Controller-Pilot Data Link)
    },
    equipmentNav: {
      vor: aircraft?.equipmentNav?.vor !== false,  // VOR
      dme: aircraft?.equipmentNav?.dme !== false,  // DME
      adf: aircraft?.equipmentNav?.adf || false,  // ADF
      gnss: aircraft?.equipmentNav?.gnss !== false,  // GNSS/GPS
      ils: aircraft?.equipmentNav?.ils !== false,  // ILS
      mls: aircraft?.equipmentNav?.mls || false,  // MLS
      rnav: aircraft?.equipmentNav?.rnav || false,  // RNAV
      rnavTypes: aircraft?.equipmentNav?.rnavTypes || '',  // Types RNAV (ex: "RNAV 10, RNAV 5, RNAV 1")
      rnp: aircraft?.equipmentNav?.rnp || false,  // RNP
      rnpTypes: aircraft?.equipmentNav?.rnpTypes || '',  // Types RNP (ex: "RNP 4, RNP 1, RNP APCH")
      gbas: aircraft?.equipmentNav?.gbas || false,  // GBAS Landing System
      lnav: aircraft?.equipmentNav?.lnav || false,  // LNAV
      vnav: aircraft?.equipmentNav?.vnav || false,  // VNAV
      lpv: aircraft?.equipmentNav?.lpv || false  // LPV approach
    },
    // Section Équipements de surveillance
    equipmentSurv: {
      transponderMode: aircraft?.equipmentSurv?.transponderMode || 'C',  // A, C, S ou None
      adsb: aircraft?.equipmentSurv?.adsb || false,  // ADS-B Out
      adsbIn: aircraft?.equipmentSurv?.adsbIn || false,  // ADS-B In
      tcas: aircraft?.equipmentSurv?.tcas || 'None',  // None, TCAS I, TCAS II
      gpws: aircraft?.equipmentSurv?.gpws || false,  // GPWS/TAWS
      egpws: aircraft?.equipmentSurv?.egpws || false,  // Enhanced GPWS
      taws: aircraft?.equipmentSurv?.taws || false,  // TAWS
      cvr: aircraft?.equipmentSurv?.cvr || false,  // Cockpit Voice Recorder
      fdr: aircraft?.equipmentSurv?.fdr || false,  // Flight Data Recorder
      ras: aircraft?.equipmentSurv?.ras || false,  // Runway Awareness System
      flarm: aircraft?.equipmentSurv?.flarm || false  // FLARM (collision avoidance)
    },
    // Capacités spéciales et remarques
    specialCapabilities: {
      rvsm: aircraft?.specialCapabilities?.rvsm || false,  // RVSM approved
      mnps: aircraft?.specialCapabilities?.mnps || false,  // MNPS approved
      etops: aircraft?.specialCapabilities?.etops || false,  // ETOPS
      etopsMinutes: aircraft?.specialCapabilities?.etopsMinutes || '',  // ETOPS time (60, 120, 180, etc.)
      catII: aircraft?.specialCapabilities?.catII || false,  // CAT II approach
      catIII: aircraft?.specialCapabilities?.catIII || false,  // CAT III approach
      pbn: aircraft?.specialCapabilities?.pbn || false,  // Performance Based Navigation
      remarks: aircraft?.specialCapabilities?.remarks || ''  // Remarques additionnelles
    }
  });

  const handleChange = (field, value, index = null) => {
    if (field === 'maxTakeoffWeight') {
      // Auto-déterminer la catégorie de turbulence basée sur MTOW
      const mtow = parseFloat(value);
      let category = formData.wakeTurbulenceCategory;
      
      if (!isNaN(mtow)) {
        if (mtow <= 7000) {
          category = 'L';
        } else if (mtow <= 136000) {
          category = 'M';
        } else {
          category = 'H';
        }
      }
      
      setFormData(prev => ({
        ...prev,
        maxTakeoffWeight: value,
        wakeTurbulenceCategory: category
      }));
    } else if (field === 'compatibleRunwaySurfaces') {
      // Gestion des surfaces compatibles (toggle)
      console.log('🔄 Toggle surface:', value);
      console.log('🔄 Surfaces actuelles:', formData.compatibleRunwaySurfaces);
      
      setFormData(prev => {
        const surfaces = prev.compatibleRunwaySurfaces || [];
        let newSurfaces;
        
        if (surfaces.includes(value)) {
          // Retirer la surface
          newSurfaces = surfaces.filter(s => s !== value);
        } else {
          // Ajouter la surface
          newSurfaces = [...surfaces, value];
        }
        
        console.log('🔄 Nouvelles surfaces:', newSurfaces);
        
        return {
          ...prev,
          compatibleRunwaySurfaces: newSurfaces
        };
      });
    } else if (field.includes('.')) {
      const parts = field.split('.');
      if (parts.length === 2) {
        const [parent, child] = parts;
        setFormData(prev => ({
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: value
          }
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.registration || !formData.model) {
      alert('L\'immatriculation et le modèle sont obligatoires');
      return;
    }
    
    // Valider que l'immatriculation n'a pas de caractères spéciaux problématiques
    if (!/^[A-Za-z0-9\-]+$/.test(formData.registration)) {
      alert('L\'immatriculation ne peut contenir que des lettres, chiffres et tirets');
      return;
    }
    
    if (!formData.compatibleRunwaySurfaces || formData.compatibleRunwaySurfaces.length === 0) {
      alert('Vous devez sélectionner au moins un type de piste compatible');
      return;
    }

    // DEBUG : Afficher les surfaces compatibles avant de sauvegarder
    console.log('🛩️ Surfaces compatibles sélectionnées:', formData.compatibleRunwaySurfaces);

    // Fonction helper pour valider et convertir les nombres
    const toValidNumber = (value, defaultValue = 0) => {
      const num = Number(value);
      return isNaN(num) ? defaultValue : num;
    };

    const processedData = {
      ...formData,
      fuelCapacity: toValidNumber(formData.fuelCapacity, 0),
      cruiseSpeed: toValidNumber(formData.cruiseSpeedKt, 0), // Ajouter cruiseSpeed pour compatibilité
      cruiseSpeedKt: toValidNumber(formData.cruiseSpeedKt, 0),
      fuelConsumption: toValidNumber(formData.fuelConsumption, 0),
      maxTakeoffWeight: toValidNumber(formData.maxTakeoffWeight, 0),
      wakeTurbulenceCategory: formData.wakeTurbulenceCategory,
      compatibleRunwaySurfaces: formData.compatibleRunwaySurfaces || ['ASPH', 'CONC'],
      // Nouvelles sections de performances
      speeds: Object.values(formData.speeds).some(v => v)
        ? {
            vso: toValidNumber(formData.speeds.vso, 0),
            vs1: toValidNumber(formData.speeds.vs1, 0),
            vfe: toValidNumber(formData.speeds.vfe, 0),
            vno: toValidNumber(formData.speeds.vno, 0),
            vne: toValidNumber(formData.speeds.vne, 0),
            va: toValidNumber(formData.speeds.va, 0),
            vx: toValidNumber(formData.speeds.vx, 0),
            vy: toValidNumber(formData.speeds.vy, 0),
            vr: toValidNumber(formData.speeds.vr, 0),
            vref: toValidNumber(formData.speeds.vref, 0),
            vapp: toValidNumber(formData.speeds.vapp, 0),
            vglide: toValidNumber(formData.speeds.vglide, 0)
          }
        : undefined,
      distances: Object.values(formData.distances).some(v => v)
        ? {
            takeoffRoll: toValidNumber(formData.distances.takeoffRoll, 0),
            takeoffDistance15m: toValidNumber(formData.distances.takeoffDistance15m, 0),
            takeoffDistance50ft: toValidNumber(formData.distances.takeoffDistance50ft, 0),
            landingRoll: toValidNumber(formData.distances.landingRoll, 0),
            landingDistance15m: toValidNumber(formData.distances.landingDistance15m, 0),
            landingDistance50ft: toValidNumber(formData.distances.landingDistance50ft, 0)
          }
        : undefined,
      climb: Object.values(formData.climb).some(v => v)
        ? {
            rateOfClimb: toValidNumber(formData.climb.rateOfClimb, 0),
            serviceCeiling: toValidNumber(formData.climb.serviceCeiling, 0),
            absoluteCeiling: toValidNumber(formData.climb.absoluteCeiling, 0),
            climbGradient: toValidNumber(formData.climb.climbGradient, 0)
          }
        : undefined,
      windLimits: Object.values(formData.windLimits).some(v => v)
        ? {
            maxCrosswind: toValidNumber(formData.windLimits.maxCrosswind, 0),
            maxTailwind: toValidNumber(formData.windLimits.maxTailwind, 0),
            maxHeadwind: toValidNumber(formData.windLimits.maxHeadwind, 0)
          }
        : undefined,
      masses: Object.values(formData.masses).some(v => v)
        ? {
            emptyMass: toValidNumber(formData.masses.emptyMass, 0),
            minTakeoffMass: toValidNumber(formData.masses.minTakeoffMass, 0),
            baseFactor: toValidNumber(formData.masses.baseFactor, 0),
            maxBaggageTube: toValidNumber(formData.masses.maxBaggageTube, 0),
            maxAftBaggageExtension: toValidNumber(formData.masses.maxAftBaggageExtension, 0)
          }
        : undefined,
      armLengths: Object.values(formData.armLengths).some(v => v)
        ? {
            emptyMassArm: toValidNumber(formData.armLengths.emptyMassArm, 0),
            fuelArm: toValidNumber(formData.armLengths.fuelArm, 0),
            frontSeat1Arm: toValidNumber(formData.armLengths.frontSeat1Arm, 0),
            frontSeat2Arm: toValidNumber(formData.armLengths.frontSeat2Arm, 0),
            rearSeat1Arm: toValidNumber(formData.armLengths.rearSeat1Arm, 0),
            rearSeat2Arm: toValidNumber(formData.armLengths.rearSeat2Arm, 0),
            standardBaggageArm: toValidNumber(formData.armLengths.standardBaggageArm, 0),
            baggageTubeArm: toValidNumber(formData.armLengths.baggageTubeArm, 0),
            aftBaggageExtensionArm: toValidNumber(formData.armLengths.aftBaggageExtensionArm, 0)
          }
        : undefined,
      limitations: Object.values(formData.limitations).some(v => v)
        ? {
            maxLandingMass: toValidNumber(formData.limitations.maxLandingMass, 0),
            maxBaggageLest: toValidNumber(formData.limitations.maxBaggageLest, 0)
          }
        : undefined,
      // Équipements
      equipmentCom: formData.equipmentCom,
      equipmentNav: formData.equipmentNav,
      equipmentSurv: formData.equipmentSurv,
      specialCapabilities: formData.specialCapabilities,
      // Photo de l'avion
      photo: aircraftPhoto
    };

    // DEBUG : Afficher les données complètes avant de sauvegarder
    console.log('💾 AircraftForm - processedData complet:', processedData);
    console.log('💾 AircraftForm - compatibleRunwaySurfaces dans processedData:', processedData.compatibleRunwaySurfaces);

    try {
      onSubmit(processedData);
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
      alert(`Erreur lors de la sauvegarde: ${error.message}`);
    }
  };

  const inputStyle = sx.combine(
    sx.components.input.base,
    sx.spacing.mb(3)
  );

  const labelStyle = sx.combine(
    sx.text.sm,
    sx.text.bold,
    sx.spacing.mb(1),
    { display: 'flex', alignItems: 'center' }
  );

  return (
    <form onSubmit={handleSubmit}>
      {/* Barre d'onglets */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid #e5e7eb',
        marginBottom: '24px',
        gap: '4px'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'general' ? '#3b82f6' : 'transparent',
            color: activeTab === 'general' ? 'white' : '#6b7280',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            fontWeight: activeTab === 'general' ? 'bold' : 'normal',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontSize: '14px'
          }}
        >
          📋 Général
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('performances')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'performances' ? '#3b82f6' : 'transparent',
            color: activeTab === 'performances' ? 'white' : '#6b7280',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            fontWeight: activeTab === 'performances' ? 'bold' : 'normal',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontSize: '14px'
          }}
        >
          ✈️ Performances
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('masse-centrage')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'masse-centrage' ? '#3b82f6' : 'transparent',
            color: activeTab === 'masse-centrage' ? 'white' : '#6b7280',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            fontWeight: activeTab === 'masse-centrage' ? 'bold' : 'normal',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontSize: '14px'
          }}
        >
          ⚖️ Masse & Centrage
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('equipements')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'equipements' ? '#3b82f6' : 'transparent',
            color: activeTab === 'equipements' ? 'white' : '#6b7280',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            fontWeight: activeTab === 'equipements' ? 'bold' : 'normal',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontSize: '14px'
          }}
        >
          📡 Équipements
        </button>
      </div>

      {/* Contenu des onglets */}
      <div style={{ display: 'grid', gap: '16px' }}>
        {/* Onglet Général */}
        {activeTab === 'general' && (
          <>
            {/* Informations de base */}
            <div>
              <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
                Informations générales
              </h4>
              
              {/* Photo de l'avion */}
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Photo de l'avion</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  {aircraftPhoto ? (
                    <div style={{ position: 'relative', width: '200px', height: '150px' }}>
                      <img 
                        src={aircraftPhoto} 
                        alt="Aircraft" 
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover', 
                          borderRadius: '8px',
                          border: '1px solid #d1d5db'
                        }} 
                      />
                      <button
                        type="button"
                        onClick={() => setAircraftPhoto(null)}
                        style={{
                          position: 'absolute',
                          top: '5px',
                          right: '5px',
                          backgroundColor: 'rgba(239, 68, 68, 0.9)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div style={{ 
                      width: '200px', 
                      height: '150px', 
                      border: '2px dashed #d1d5db',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#f9fafb'
                    }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>Aucune photo</p>
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      id="aircraft-photo"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="aircraft-photo"
                      style={{
                        ...sx.components.button.base,
                        ...sx.components.button.secondary,
                        cursor: 'pointer',
                        display: 'inline-block'
                      }}
                    >
                      {aircraftPhoto ? 'Changer la photo' : 'Ajouter une photo'}
                    </label>
                    <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                      Max 5MB • JPG, PNG
                    </p>
                  </div>
                </div>
              </div>
              
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Immatriculation *</label>
              <input
                type="text"
                value={formData.registration}
                onChange={(e) => handleChange('registration', e.target.value)}
                placeholder="F-GXXX"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Modèle *</label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => handleChange('model', e.target.value)}
                placeholder="Cessna 172"
                required
                style={inputStyle}
              />
            </div>
          </div>

          {/* Catégorie de turbulence de sillage */}
          <div style={{ marginTop: '16px' }}>
            <label style={labelStyle}>
              Catégorie de turbulence de sillage *
              <InfoIcon tooltip="Catégorie OACI basée sur la masse maximale au décollage (MTOW)" />
            </label>
            <select
              value={formData.wakeTurbulenceCategory}
              onChange={(e) => handleChange('wakeTurbulenceCategory', e.target.value)}
              style={inputStyle}
              required
            >
              <option value="L">L - Light / Léger (MTOW &lt;= 7 000 kg)</option>
              <option value="M">M - Medium / Moyen (7 000 kg &lt; MTOW &lt;= 136 000 kg)</option>
              <option value="H">H - Heavy / Lourd (MTOW &gt; 136 000 kg)</option>
              <option value="J">J - Super (A380, An-225)</option>
            </select>
            <div style={{
              marginTop: '8px',
              padding: '8px',
              backgroundColor: '#F0F9FF',
              borderRadius: '6px',
              border: '1px solid #BAE6FD'
            }}>
              <p style={sx.combine(sx.text.xs, { color: '#0369A1' })}>
                {formData.wakeTurbulenceCategory === 'L' && '💡 Catégorie Light: Espacement réduit derrière autres aéronefs, mais vulnérable aux turbulences de sillage.'}
                {formData.wakeTurbulenceCategory === 'M' && '💡 Catégorie Medium: Espacement standard. Attention aux aéronefs Heavy devant.'}
                {formData.wakeTurbulenceCategory === 'H' && '💡 Catégorie Heavy: Génère des turbulences importantes. Espacement accru pour les suivants.'}
                {formData.wakeTurbulenceCategory === 'J' && '💡 Catégorie Super: Turbulences extrêmes. Espacements maximaux requis.'}
              </p>
            </div>
          </div>
        </div>

        {/* Carburant */}
        <div>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
            Carburant
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Type de carburant</label>
              <select
                value={formData.fuelType}
                onChange={(e) => handleChange('fuelType', e.target.value)}
                style={inputStyle}
              >
                <option value="AVGAS">AVGAS 100LL</option>
                <option value="JET-A1">JET A-1</option>
                <option value="MOGAS">MOGAS</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Capacité (L)</label>
              <input
                type="number"
                value={formData.fuelCapacity}
                onChange={(e) => handleChange('fuelCapacity', e.target.value)}
                placeholder="200"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Consommation (L/h)</label>
              <input
                type="number"
                value={formData.fuelConsumption}
                onChange={(e) => handleChange('fuelConsumption', e.target.value)}
                placeholder="35"
                min="0"
                step="0.1"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Types de pistes compatibles */}
        <div>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
            Types de pistes compatibles
          </h4>
          <div style={{
            backgroundColor: '#EBF8FF',
            border: '1px solid #90CDF4',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px'
          }}>
            <p style={sx.combine(sx.text.sm, { color: '#2B6CB0' })}>
              🛬 Sélectionnez tous les types de surfaces sur lesquels cet avion peut opérer en sécurité
            </p>
          </div>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
            gap: '12px',
            backgroundColor: '#F9FAFB',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #E5E7EB'
          }}>
            {[
              { code: 'ASPH', name: 'Asphalte/Bitume', icon: '🛣️' },
              { code: 'CONC', name: 'Béton', icon: '🏗️' },
              { code: 'GRASS', name: 'Herbe', icon: '🌱' },
              { code: 'GRVL', name: 'Gravier', icon: '🪨' },
              { code: 'UNPAVED', name: 'Terre/Non revêtu', icon: '🏜️' },
              { code: 'SAND', name: 'Sable', icon: '🏖️' },
              { code: 'SNOW', name: 'Neige', icon: '❄️' },
              { code: 'WATER', name: 'Eau (hydravion)', icon: '💧' }
            ].map(surface => (
              <label
                key={surface.code}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px',
                  backgroundColor: formData.compatibleRunwaySurfaces?.includes(surface.code) ? '#DBEAFE' : 'white',
                  border: `2px solid ${formData.compatibleRunwaySurfaces?.includes(surface.code) ? '#3B82F6' : '#E5E7EB'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: '#3B82F6',
                    backgroundColor: '#F0F9FF'
                  }
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.compatibleRunwaySurfaces?.includes(surface.code) || false}
                  onChange={() => handleChange('compatibleRunwaySurfaces', surface.code)}
                  style={{ marginRight: '8px' }}
                />
                <span style={{ marginRight: '8px', fontSize: '18px' }}>{surface.icon}</span>
                <span style={sx.text.sm}>{surface.name}</span>
              </label>
            ))}
          </div>
          
          {/* Avertissement si aucune surface sélectionnée */}
          {(!formData.compatibleRunwaySurfaces || formData.compatibleRunwaySurfaces.length === 0) && (
            <div style={sx.combine(sx.components.alert.base, sx.components.alert.danger, sx.spacing.mt(2))}>
              <AlertTriangle size={16} />
              <p style={sx.text.sm}>
                ⚠️ Attention : Aucun type de piste sélectionné. L'avion doit être compatible avec au moins un type de surface.
              </p>
            </div>
          )}
        </div>
          </>
        )}

        {/* Onglet Performances */}
        {activeTab === 'performances' && (
          <>
            <div style={{
              backgroundColor: '#EBF8FF',
              border: '1px solid #90CDF4',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '20px'
            }}>
              <p style={sx.combine(sx.text.sm, { color: '#2B6CB0' })}>
                💡 <strong>Conseil :</strong> Les données de performances sont essentielles pour la planification de vol. 
                Si vous avez importé un MANEX, les valeurs seront pré-remplies automatiquement. 
                Sinon, référez-vous au manuel de vol pour obtenir les valeurs exactes.
              </p>
            </div>

            {/* Section Performances - Vitesses caractéristiques */}
        <div>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3), sx.flex.start)}>
            <span style={{ marginRight: '8px' }}>✈️</span>
            Vitesses caractéristiques (kt)
            <InfoIcon tooltip="Vitesses de référence pour les différentes phases de vol" />
          </h4>
          
          <div style={{
            backgroundColor: '#F0FDF4',
            border: '1px solid #86EFAC',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px'
          }}>
            <p style={sx.combine(sx.text.sm, { color: '#166534' })}>
              💡 Ces vitesses sont critiques pour la sécurité. Consultez le manuel de vol pour les valeurs exactes.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {/* Vitesses de décrochage */}
            <div>
              <label style={labelStyle}>
                Vso - Décrochage volets sortis
                <InfoIcon tooltip="Vitesse de décrochage en configuration atterrissage" />
              </label>
              <input
                type="number"
                value={formData.speeds.vso}
                onChange={(e) => handleChange('speeds.vso', e.target.value)}
                placeholder="44"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Vs1 - Décrochage volets rentrés
                <InfoIcon tooltip="Vitesse de décrochage en configuration lisse" />
              </label>
              <input
                type="number"
                value={formData.speeds.vs1}
                onChange={(e) => handleChange('speeds.vs1', e.target.value)}
                placeholder="48"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Va - Vitesse de manœuvre
                <InfoIcon tooltip="Vitesse max pour manœuvres complètes" />
              </label>
              <input
                type="number"
                value={formData.speeds.va}
                onChange={(e) => handleChange('speeds.va', e.target.value)}
                placeholder="99"
                min="0"
                style={inputStyle}
              />
            </div>

            {/* Vitesses limites */}
            <div>
              <label style={labelStyle}>
                Vfe - Max volets sortis
                <InfoIcon tooltip="Vitesse maximale volets sortis" />
              </label>
              <input
                type="number"
                value={formData.speeds.vfe}
                onChange={(e) => handleChange('speeds.vfe', e.target.value)}
                placeholder="85"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Vno - Max en air calme
                <InfoIcon tooltip="Vitesse max de croisière structurale" />
              </label>
              <input
                type="number"
                value={formData.speeds.vno}
                onChange={(e) => handleChange('speeds.vno', e.target.value)}
                placeholder="128"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Vne - Ne jamais dépasser
                <InfoIcon tooltip="Vitesse à ne jamais dépasser" />
              </label>
              <input
                type="number"
                value={formData.speeds.vne}
                onChange={(e) => handleChange('speeds.vne', e.target.value)}
                placeholder="163"
                min="0"
                style={inputStyle}
              />
            </div>

            {/* Vitesses de montée */}
            <div>
              <label style={labelStyle}>
                Vx - Montée max (pente)
                <InfoIcon tooltip="Meilleur angle de montée" />
              </label>
              <input
                type="number"
                value={formData.speeds.vx}
                onChange={(e) => handleChange('speeds.vx', e.target.value)}
                placeholder="59"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Vy - Montée optimale (taux)
                <InfoIcon tooltip="Meilleur taux de montée" />
              </label>
              <input
                type="number"
                value={formData.speeds.vy}
                onChange={(e) => handleChange('speeds.vy', e.target.value)}
                placeholder="73"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Vglide - Plané optimal
                <InfoIcon tooltip="Vitesse de finesse max" />
              </label>
              <input
                type="number"
                value={formData.speeds.vglide}
                onChange={(e) => handleChange('speeds.vglide', e.target.value)}
                placeholder="65"
                min="0"
                style={inputStyle}
              />
            </div>

            {/* Vitesses opérationnelles */}
            <div>
              <label style={labelStyle}>
                Vr - Rotation
                <InfoIcon tooltip="Vitesse de rotation au décollage" />
              </label>
              <input
                type="number"
                value={formData.speeds.vr}
                onChange={(e) => handleChange('speeds.vr', e.target.value)}
                placeholder="55"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Vref - Référence approche
                <InfoIcon tooltip="Vitesse de référence en approche" />
              </label>
              <input
                type="number"
                value={formData.speeds.vref}
                onChange={(e) => handleChange('speeds.vref', e.target.value)}
                placeholder="60"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Vapp - Approche finale
                <InfoIcon tooltip="Vitesse d'approche finale" />
              </label>
              <input
                type="number"
                value={formData.speeds.vapp}
                onChange={(e) => handleChange('speeds.vapp', e.target.value)}
                placeholder="65"
                min="0"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Section Performances - Distances */}
        <div>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3), sx.flex.start)}>
            <span style={{ marginRight: '8px' }}>🛫</span>
            Distances de décollage et atterrissage
            <InfoIcon tooltip="Distances au niveau de la mer, conditions standard" />
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Décollage */}
            <div style={{
              padding: '16px',
              backgroundColor: '#F0F9FF',
              borderRadius: '8px',
              border: '1px solid #BAE6FD'
            }}>
              <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(3))}>
                🛫 Décollage
              </h5>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>
                    Roulage (m)
                    <InfoIcon tooltip="Distance de roulage au sol" />
                  </label>
                  <input
                    type="number"
                    value={formData.distances.takeoffRoll}
                    onChange={(e) => handleChange('distances.takeoffRoll', e.target.value)}
                    placeholder="280"
                    min="0"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Passage 15m/50ft (m)
                    <InfoIcon tooltip="Distance totale pour passer 15m (50ft)" />
                  </label>
                  <input
                    type="number"
                    value={formData.distances.takeoffDistance50ft}
                    onChange={(e) => handleChange('distances.takeoffDistance50ft', e.target.value)}
                    placeholder="485"
                    min="0"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Atterrissage */}
            <div style={{
              padding: '16px',
              backgroundColor: '#FFF7ED',
              borderRadius: '8px',
              border: '1px solid #FED7AA'
            }}>
              <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(3))}>
                🛬 Atterrissage
              </h5>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>
                    Roulage (m)
                    <InfoIcon tooltip="Distance de roulage après toucher" />
                  </label>
                  <input
                    type="number"
                    value={formData.distances.landingRoll}
                    onChange={(e) => handleChange('distances.landingRoll', e.target.value)}
                    placeholder="180"
                    min="0"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Depuis 15m/50ft (m)
                    <InfoIcon tooltip="Distance totale depuis 15m (50ft)" />
                  </label>
                  <input
                    type="number"
                    value={formData.distances.landingDistance50ft}
                    onChange={(e) => handleChange('distances.landingDistance50ft', e.target.value)}
                    placeholder="520"
                    min="0"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section Performances - Montée et plafonds */}
        <div>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3), sx.flex.start)}>
            <span style={{ marginRight: '8px' }}>📈</span>
            Performances en montée et plafonds
            <InfoIcon tooltip="Performances au poids max, conditions standard" />
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div>
              <label style={labelStyle}>
                Taux de montée (ft/min)
                <InfoIcon tooltip="Taux de montée au niveau de la mer" />
              </label>
              <input
                type="number"
                value={formData.climb.rateOfClimb}
                onChange={(e) => handleChange('climb.rateOfClimb', e.target.value)}
                placeholder="730"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Gradient de montée (%)
                <InfoIcon tooltip="Pente de montée en pourcentage" />
              </label>
              <input
                type="number"
                value={formData.climb.climbGradient}
                onChange={(e) => handleChange('climb.climbGradient', e.target.value)}
                placeholder="8.5"
                min="0"
                step="0.1"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Plafond pratique (ft)
                <InfoIcon tooltip="Altitude où le taux de montée = 100 ft/min" />
              </label>
              <input
                type="number"
                value={formData.climb.serviceCeiling}
                onChange={(e) => handleChange('climb.serviceCeiling', e.target.value)}
                placeholder="14000"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Plafond absolu (ft)
                <InfoIcon tooltip="Altitude maximale atteignable" />
              </label>
              <input
                type="number"
                value={formData.climb.absoluteCeiling}
                onChange={(e) => handleChange('climb.absoluteCeiling', e.target.value)}
                placeholder="15000"
                min="0"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Section Limitations de vent */}
        <div>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3), sx.flex.start)}>
            <span style={{ marginRight: '8px' }}>💨</span>
            Limitations de vent (kt)
            <InfoIcon tooltip="Limites maximales démontrées" />
          </h4>

          <div style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px'
          }}>
            <p style={sx.combine(sx.text.sm, { color: '#991B1B' })}>
              ⚠️ Ces limites sont critiques pour la sécurité. Ne jamais les dépasser.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div>
              <label style={labelStyle}>
                Vent traversier max
                <InfoIcon tooltip="Composante traversière maximale démontrée" />
              </label>
              <input
                type="number"
                value={formData.windLimits.maxCrosswind}
                onChange={(e) => handleChange('windLimits.maxCrosswind', e.target.value)}
                placeholder="15"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Vent arrière max
                <InfoIcon tooltip="Vent arrière max pour décollage/atterrissage" />
              </label>
              <input
                type="number"
                value={formData.windLimits.maxTailwind}
                onChange={(e) => handleChange('windLimits.maxTailwind', e.target.value)}
                placeholder="10"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Vent de face max
                <InfoIcon tooltip="Vent de face max démontré" />
              </label>
              <input
                type="number"
                value={formData.windLimits.maxHeadwind}
                onChange={(e) => handleChange('windLimits.maxHeadwind', e.target.value)}
                placeholder="40"
                min="0"
                style={inputStyle}
              />
            </div>
          </div>
        </div>
          </>
        )}

        {/* Onglet Masse & Centrage */}
        {activeTab === 'masse-centrage' && (
          <>
            <div style={{
              backgroundColor: '#F0FDF4',
              border: '1px solid #86EFAC',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '20px'
            }}>
              <p style={sx.combine(sx.text.sm, { color: '#166534' })}>
                ⚖️ <strong>Important :</strong> Les données de masse et centrage sont critiques pour la sécurité. 
                Elles seront utilisées pour calculer le devis de masse et vérifier que l'avion reste dans les limites de centrage.
              </p>
            </div>

            {/* Masses structurelles */}
        <div>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
            Masses structurelles ({massUnit})
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>
                Masse à vide
                <InfoIcon tooltip="Masse de l'avion sans carburant ni charge utile" />
              </label>
              <input
                type="number"
                value={formData.masses.emptyMass}
                onChange={(e) => handleChange('masses.emptyMass', e.target.value)}
                placeholder="650"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Masse max atterrissage
                <InfoIcon tooltip="Masse maximale autorisée à l'atterrissage (MLM)" />
              </label>
              <input
                type="number"
                value={formData.limitations.maxLandingMass}
                onChange={(e) => handleChange('limitations.maxLandingMass', e.target.value)}
                placeholder="1100"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Masse max décollage
                <InfoIcon tooltip="Masse maximale autorisée au décollage (MTOW)" />
              </label>
              <input
                type="number"
                value={formData.maxTakeoffWeight}
                onChange={(e) => handleChange('maxTakeoffWeight', e.target.value)}
                placeholder="1150"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Masse min décollage
                <InfoIcon tooltip="Masse minimale pour le décollage" />
              </label>
              <input
                type="number"
                value={formData.masses.minTakeoffMass}
                onChange={(e) => handleChange('masses.minTakeoffMass', e.target.value)}
                placeholder="700"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Facteur de base
                <InfoIcon tooltip="Facteur utilisé pour les calculs de centrage" />
              </label>
              <input
                type="number"
                value={formData.masses.baseFactor}
                onChange={(e) => handleChange('masses.baseFactor', e.target.value)}
                placeholder="1.0"
                min="0"
                step="0.1"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Max bagages + lest
                <InfoIcon tooltip="Masse maximale cumulée des bagages et du lestage" />
              </label>
              <input
                type="number"
                value={formData.limitations.maxBaggageLest}
                onChange={(e) => handleChange('limitations.maxBaggageLest', e.target.value)}
                placeholder="45"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Max Baggage Tube
                <InfoIcon tooltip="Masse maximale dans le tube à bagages" />
              </label>
              <input
                type="number"
                value={formData.masses.maxBaggageTube}
                onChange={(e) => handleChange('masses.maxBaggageTube', e.target.value)}
                placeholder="10"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Max AFT Baggage Extension
                <InfoIcon tooltip="Masse maximale dans l'extension arrière" />
              </label>
              <input
                type="number"
                value={formData.masses.maxAftBaggageExtension}
                onChange={(e) => handleChange('masses.maxAftBaggageExtension', e.target.value)}
                placeholder="15"
                min="0"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Bras de levier */}
        <div>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
            Bras de levier (mm)
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div>
              <label style={labelStyle}>
                Masse à vide
                <InfoIcon tooltip="Distance du CG de la masse à vide par rapport à la référence" />
              </label>
              <input
                type="number"
                value={formData.armLengths.emptyMassArm}
                onChange={(e) => handleChange('armLengths.emptyMassArm', e.target.value)}
                placeholder="2150"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Carburant
                <InfoIcon tooltip="Distance du CG du carburant par rapport à la référence" />
              </label>
              <input
                type="number"
                value={formData.armLengths.fuelArm}
                onChange={(e) => handleChange('armLengths.fuelArm', e.target.value)}
                placeholder="2180"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Siège avant gauche
                <InfoIcon tooltip="Distance du siège pilote par rapport à la référence" />
              </label>
              <input
                type="number"
                value={formData.armLengths.frontSeat1Arm}
                onChange={(e) => handleChange('armLengths.frontSeat1Arm', e.target.value)}
                placeholder="2000"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Siège avant droit
                <InfoIcon tooltip="Distance du siège passager avant par rapport à la référence" />
              </label>
              <input
                type="number"
                value={formData.armLengths.frontSeat2Arm}
                onChange={(e) => handleChange('armLengths.frontSeat2Arm', e.target.value)}
                placeholder="2000"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Siège arrière gauche
                <InfoIcon tooltip="Distance du siège arrière gauche par rapport à la référence" />
              </label>
              <input
                type="number"
                value={formData.armLengths.rearSeat1Arm}
                onChange={(e) => handleChange('armLengths.rearSeat1Arm', e.target.value)}
                placeholder="2300"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Siège arrière droit
                <InfoIcon tooltip="Distance du siège arrière droit par rapport à la référence" />
              </label>
              <input
                type="number"
                value={formData.armLengths.rearSeat2Arm}
                onChange={(e) => handleChange('armLengths.rearSeat2Arm', e.target.value)}
                placeholder="2300"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Compartiment standard
                <InfoIcon tooltip="Distance du compartiment bagages principal par rapport à la référence" />
              </label>
              <input
                type="number"
                value={formData.armLengths.standardBaggageArm}
                onChange={(e) => handleChange('armLengths.standardBaggageArm', e.target.value)}
                placeholder="2450"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Tube à bagages
                <InfoIcon tooltip="Distance du tube à bagages par rapport à la référence" />
              </label>
              <input
                type="number"
                value={formData.armLengths.baggageTubeArm}
                onChange={(e) => handleChange('armLengths.baggageTubeArm', e.target.value)}
                placeholder="2500"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Extension bagages AR
                <InfoIcon tooltip="Distance de l'extension arrière par rapport à la référence" />
              </label>
              <input
                type="number"
                value={formData.armLengths.aftBaggageExtensionArm}
                onChange={(e) => handleChange('armLengths.aftBaggageExtensionArm', e.target.value)}
                placeholder="2550"
                min="0"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

          </>
        )}

        {/* Onglet Équipements */}
        {activeTab === 'equipements' && (
          <>
            <div style={{
              backgroundColor: '#FEF3C7',
              border: '1px solid #FCD34D',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '20px'
            }}>
              <p style={sx.combine(sx.text.sm, { color: '#92400E' })}>
                📡 <strong>Info :</strong> Ces équipements déterminent les capacités opérationnelles de votre avion. 
                Ils sont essentiels pour la planification des routes et l'approbation des procédures d'approche.
              </p>
            </div>

            {/* Section Communication */}
            <div>
              <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3), sx.flex.start)}>
                <span style={{ marginRight: '8px' }}>📻</span>
                Équipements de radiocommunication (COM)
                <InfoIcon tooltip="Équipements de communication avec l'ATC et autres aéronefs" />
              </h4>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '12px',
                backgroundColor: '#F9FAFB',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #E5E7EB'
              }}>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentCom.vhf1}
                    onChange={(e) => handleChange('equipmentCom.vhf1', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>VHF COM 1</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentCom.vhf2}
                    onChange={(e) => handleChange('equipmentCom.vhf2', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>VHF COM 2</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentCom.hf}
                    onChange={(e) => handleChange('equipmentCom.hf', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>HF (Haute fréquence)</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentCom.satcom}
                    onChange={(e) => handleChange('equipmentCom.satcom', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>SATCOM (Communication satellite)</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentCom.elt}
                    onChange={(e) => handleChange('equipmentCom.elt', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>ELT (Balise de détresse)</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentCom.acars}
                    onChange={(e) => handleChange('equipmentCom.acars', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>ACARS</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentCom.cpdlc}
                    onChange={(e) => handleChange('equipmentCom.cpdlc', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>CPDLC (Datalink)</span>
                </label>
              </div>
            </div>

            {/* Section Navigation et Approche */}
            <div>
              <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3), sx.flex.start)}>
                <span style={{ marginRight: '8px' }}>🧭</span>
                Équipements de navigation et approche (NAV/APP)
                <InfoIcon tooltip="Systèmes de navigation et capacités d'approche aux instruments" />
              </h4>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '12px',
                backgroundColor: '#F0F9FF',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #BAE6FD',
                marginBottom: '16px'
              }}>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentNav.vor}
                    onChange={(e) => handleChange('equipmentNav.vor', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>VOR</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentNav.dme}
                    onChange={(e) => handleChange('equipmentNav.dme', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>DME</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentNav.adf}
                    onChange={(e) => handleChange('equipmentNav.adf', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>ADF/NDB</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentNav.gnss}
                    onChange={(e) => handleChange('equipmentNav.gnss', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>GNSS/GPS</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentNav.ils}
                    onChange={(e) => handleChange('equipmentNav.ils', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>ILS</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentNav.mls}
                    onChange={(e) => handleChange('equipmentNav.mls', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>MLS</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentNav.gbas}
                    onChange={(e) => handleChange('equipmentNav.gbas', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>GBAS</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentNav.lpv}
                    onChange={(e) => handleChange('equipmentNav.lpv', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>LPV (approche GPS)</span>
                </label>
              </div>

              {/* RNAV/RNP capabilities */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={sx.flex.start}>
                    <input
                      type="checkbox"
                      checked={formData.equipmentNav.rnav}
                      onChange={(e) => handleChange('equipmentNav.rnav', e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    <span style={sx.text.sm}>Capacité RNAV</span>
                  </label>
                  {formData.equipmentNav.rnav && (
                    <input
                      type="text"
                      value={formData.equipmentNav.rnavTypes}
                      onChange={(e) => handleChange('equipmentNav.rnavTypes', e.target.value)}
                      placeholder="Ex: RNAV 10, RNAV 5, RNAV 1"
                      style={sx.combine(sx.components.input.base, sx.spacing.mt(2))}
                    />
                  )}
                </div>
                <div>
                  <label style={sx.flex.start}>
                    <input
                      type="checkbox"
                      checked={formData.equipmentNav.rnp}
                      onChange={(e) => handleChange('equipmentNav.rnp', e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    <span style={sx.text.sm}>Capacité RNP</span>
                  </label>
                  {formData.equipmentNav.rnp && (
                    <input
                      type="text"
                      value={formData.equipmentNav.rnpTypes}
                      onChange={(e) => handleChange('equipmentNav.rnpTypes', e.target.value)}
                      placeholder="Ex: RNP 4, RNP 1, RNP APCH"
                      style={sx.combine(sx.components.input.base, sx.spacing.mt(2))}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Section Surveillance */}
            <div>
              <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3), sx.flex.start)}>
                <span style={{ marginRight: '8px' }}>📍</span>
                Équipements de surveillance
                <InfoIcon tooltip="Systèmes de surveillance et anti-collision" />
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Mode transpondeur</label>
                  <select
                    value={formData.equipmentSurv.transponderMode}
                    onChange={(e) => handleChange('equipmentSurv.transponderMode', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="None">Aucun</option>
                    <option value="A">Mode A</option>
                    <option value="C">Mode C (altitude)</option>
                    <option value="S">Mode S</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Système TCAS</label>
                  <select
                    value={formData.equipmentSurv.tcas}
                    onChange={(e) => handleChange('equipmentSurv.tcas', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="None">Aucun</option>
                    <option value="TCAS I">TCAS I</option>
                    <option value="TCAS II">TCAS II</option>
                  </select>
                </div>
              </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '12px',
                backgroundColor: '#FFF7ED',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #FED7AA'
              }}>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentSurv.adsb}
                    onChange={(e) => handleChange('equipmentSurv.adsb', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>ADS-B Out</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentSurv.adsbIn}
                    onChange={(e) => handleChange('equipmentSurv.adsbIn', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>ADS-B In</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentSurv.gpws}
                    onChange={(e) => handleChange('equipmentSurv.gpws', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>GPWS</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentSurv.egpws}
                    onChange={(e) => handleChange('equipmentSurv.egpws', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>Enhanced GPWS</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentSurv.taws}
                    onChange={(e) => handleChange('equipmentSurv.taws', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>TAWS</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentSurv.ras}
                    onChange={(e) => handleChange('equipmentSurv.ras', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>RAS (Runway Awareness)</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentSurv.cvr}
                    onChange={(e) => handleChange('equipmentSurv.cvr', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>CVR (Enregistreur vocal)</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentSurv.fdr}
                    onChange={(e) => handleChange('equipmentSurv.fdr', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>FDR (Enregistreur de vol)</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentSurv.flarm}
                    onChange={(e) => handleChange('equipmentSurv.flarm', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>FLARM (Anti-collision)</span>
                </label>
              </div>
            </div>

            {/* Capacités spéciales */}
            <div>
              <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3), sx.flex.start)}>
                <span style={{ marginRight: '8px' }}>🌟</span>
                Capacités spéciales et approbations
                <InfoIcon tooltip="Approbations opérationnelles spéciales" />
              </h4>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '12px',
                backgroundColor: '#F0FDF4',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #86EFAC',
                marginBottom: '16px'
              }}>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.specialCapabilities.rvsm}
                    onChange={(e) => handleChange('specialCapabilities.rvsm', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>RVSM (FL290-FL410)</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.specialCapabilities.mnps}
                    onChange={(e) => handleChange('specialCapabilities.mnps', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>MNPS (Atlantique Nord)</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.specialCapabilities.catII}
                    onChange={(e) => handleChange('specialCapabilities.catII', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>CAT II (Approche)</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.specialCapabilities.catIII}
                    onChange={(e) => handleChange('specialCapabilities.catIII', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>CAT III (Approche)</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.specialCapabilities.pbn}
                    onChange={(e) => handleChange('specialCapabilities.pbn', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>PBN (Performance Based Nav)</span>
                </label>
                <div>
                  <label style={sx.flex.start}>
                    <input
                      type="checkbox"
                      checked={formData.specialCapabilities.etops}
                      onChange={(e) => handleChange('specialCapabilities.etops', e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    <span style={sx.text.sm}>ETOPS</span>
                  </label>
                  {formData.specialCapabilities.etops && (
                    <input
                      type="text"
                      value={formData.specialCapabilities.etopsMinutes}
                      onChange={(e) => handleChange('specialCapabilities.etopsMinutes', e.target.value)}
                      placeholder="Minutes (60, 120, 180...)"
                      style={sx.combine(sx.components.input.base, sx.spacing.mt(2))}
                    />
                  )}
                </div>
              </div>

              {/* Remarques */}
              <div>
                <label style={labelStyle}>
                  Remarques additionnelles
                  <InfoIcon tooltip="Autres équipements ou capacités spéciales" />
                </label>
                <textarea
                  value={formData.specialCapabilities.remarks}
                  onChange={(e) => handleChange('specialCapabilities.remarks', e.target.value)}
                  placeholder="Ex: Équipé pour le vol en montagne, skis rétractables, etc."
                  style={sx.combine(sx.components.input.base, { minHeight: '80px' })}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Boutons d'action (toujours visibles) */}
      <div style={sx.combine(sx.flex.end, sx.spacing.gap(2), sx.spacing.mt(4))}>
        <button
          type="button"
          onClick={onCancel}
          style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
        >
          Annuler
        </button>
        <button
          type="submit"
          style={sx.combine(sx.components.button.base, sx.components.button.primary)}
        >
          {aircraft ? 'Mettre à jour' : 'Créer'}
        </button>
      </div>
    </form>
  );
});

AircraftForm.displayName = 'AircraftForm';

export default AircraftModule;
