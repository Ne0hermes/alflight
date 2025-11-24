import React, { useEffect, useState } from 'react';
import PerformanceWizard from '../PerformanceWizard';
import AdvancedPerformanceAnalyzer from '../AdvancedPerformanceAnalyzer';
import { Button, Box } from '@mui/material';
import { ChevronRight as ChevronRightIcon, ChevronLeft as ChevronLeftIcon } from '@mui/icons-material';

const Step4Performance = ({ data, updateData, errors = {}, setIsEditingAbaque, setOnConstruireCourbes, setCurrentStep, onNext, onPrevious }) => {
  // État local pour stocker les données de performance temporaires
  const [savedPerformanceData, setSavedPerformanceData] = useState(null);
  const [wizardStep, setWizardStep] = useState(2); // Démarrer à l'étape 2 (Step 1 retiré)
  const [showExistingData, setShowExistingData] = useState(false);
  const [forceShowSummary, setForceShowSummary] = useState(false);
  const [performanceWizardRef, setPerformanceWizardRef] = useState(null);
  // Utiliser un ref au lieu d'un state pour stocker la référence AbacBuilder
  const abacBuilderRef = React.useRef(null);

  // Ref pour ignorer le premier appel automatique de onPerformanceUpdate
  const isFirstAutoCallRef = React.useRef(true);

  
  

  // Mettre à jour le callback "Construire les courbes" quand setOnConstruireCourbes change
  useEffect(() => {
    if (setOnConstruireCourbes) {
      
      setOnConstruireCourbes(() => () => {
        
        if (abacBuilderRef.current) {
          
          abacBuilderRef.current.goToNextStep();
        } else {
          
        }
      });
    }
  }, [setOnConstruireCourbes]); // Ne pas inclure abacBuilderRef dans les dépendances

  // Restaurer les données sauvegardées au montage du composant
  useEffect(() => {
    
    // Désactiver le mode édition quand on monte le composant avec des données existantes
    if (setIsEditingAbaque && (data.advancedPerformance || data.performanceTables || data.performanceModels)) {
      setIsEditingAbaque(false);
    }
    // Vérifier si des données existent déjà dans le wizard
    if (data.advancedPerformance || data.performanceTables || data.performanceModels) {
      // 🔧 Migration: Normaliser les types de modèles anciens 'abac' vers 'abaque'
      const normalizedModels = data.performanceModels?.map(model => {
        if (model.type === 'abac') {
          
          return { ...model, type: 'abaque' };
        }
        return model;
      });

      setSavedPerformanceData({
        advancedPerformance: data.advancedPerformance,
        performanceTables: data.performanceTables,
        performanceModels: normalizedModels || data.performanceModels,
        flightManual: data.flightManual
      });

      // Mettre à jour les données normalisées dans le wizard
      if (normalizedModels && normalizedModels !== data.performanceModels) {
        updateData('performanceModels', normalizedModels);
        
      }

      // Si on a déjà des données, afficher la vue récapitulative
      
      setShowExistingData(true);
      
    } else {
      // Sinon, essayer de récupérer depuis le localStorage
      const storedData = localStorage.getItem('wizard_performance_temp');
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData);

          // 🔧 Migration: Normaliser les types de modèles anciens 'abac' vers 'abaque'
          const normalizedModels = parsedData.performanceModels?.map(model => {
            if (model.type === 'abac') {
              
              return { ...model, type: 'abaque' };
            }
            return model;
          });

          const normalizedData = {
            ...parsedData,
            performanceModels: normalizedModels || parsedData.performanceModels
          };

          setSavedPerformanceData(normalizedData);

          // Restaurer dans le wizard
          if (normalizedData.advancedPerformance) {
            updateData('advancedPerformance', normalizedData.advancedPerformance);
          }
          if (normalizedData.performanceTables) {
            updateData('performanceTables', normalizedData.performanceTables);
          }
          if (normalizedData.performanceModels) {
            updateData('performanceModels', normalizedData.performanceModels);
          }
          if (normalizedData.flightManual) {
            updateData('flightManual', normalizedData.flightManual);
          }
          // Si on a restauré des données, rester à l'étape 2 (déjà par défaut)
          if (normalizedData.advancedPerformance || normalizedData.performanceTables) {
            
            // setWizardStep(2) n'est plus nécessaire car c'est déjà la valeur par défaut
          }
        } catch (e) {
          console.error('Erreur lors de la restauration des données:', e);
        }
      }
    }
  }, []);

  // Créer un callback mémorisé pour recevoir le ref d'AbacBuilder
  // IMPORTANT: Doit être placé AVANT tout retour conditionnel (règle des hooks React)
  const handleAbacBuilderRefCallback = React.useCallback((ref) => {
    
    // Stocker directement dans le ref sans déclencher de re-render
    abacBuilderRef.current = ref;
  }, []);

  // Gestionnaire pour sauvegarder les données de performance
  const handlePerformanceUpdate = (performanceData) => {
    
    
    
    

    // Créer un objet pour stocker toutes les données
    const dataToSave = {
      advancedPerformance: data.advancedPerformance,
      performanceTables: data.performanceTables,
      performanceModels: data.performanceModels,
      flightManual: data.flightManual
    };
    // Mise à jour des données selon le type
    if (performanceData.advancedPerformance) {
      console.log('📊 Nouveaux tableaux reçus:', performanceData.advancedPerformance.tables?.length || 0);

      // 🔧 FIX: Fusionner les nouveaux tableaux avec les existants au lieu de les remplacer
      const existingTables = data.advancedPerformance?.tables || [];
      const newTables = performanceData.advancedPerformance.tables || [];

      console.log('📊 Tableaux existants:', existingTables.length);
      console.log('📊 Fusion en cours...');

      // Fusionner les tableaux (éviter les doublons par page + type + nom)
      const mergedTables = [...existingTables];
      newTables.forEach(newTable => {
        // 🔧 FIX: Identifiant unique combinant pageNumber + type + nom
        // Plusieurs tableaux peuvent venir de la même page
        const newTableId = `${newTable.pageNumber || 'nopage'}_${newTable.table_type || 'notype'}_${newTable.table_name || 'noname'}`;

        // Chercher un tableau avec le même identifiant unique
        const existingIndex = mergedTables.findIndex(t => {
          const existingId = `${t.pageNumber || 'nopage'}_${t.table_type || 'notype'}_${t.table_name || 'noname'}`;
          return existingId === newTableId;
        });

        if (existingIndex >= 0) {
          // Remplacer le tableau existant (ré-analyse)
          console.log(`📊 Remplacement tableau ${newTable.table_name} (page ${newTable.pageNumber})`);
          mergedTables[existingIndex] = newTable;
        } else {
          // Ajouter le nouveau tableau
          console.log(`📊 Ajout nouveau tableau ${newTable.table_name} (page ${newTable.pageNumber})`);
          mergedTables.push(newTable);
        }
      });

      console.log('✅ Tableaux après fusion:', mergedTables.length);

      // Créer l'objet advancedPerformance fusionné
      const mergedAdvancedPerformance = {
        ...performanceData.advancedPerformance,
        tables: mergedTables,
        extractionMetadata: {
          ...(data.advancedPerformance?.extractionMetadata || {}),
          ...performanceData.advancedPerformance.extractionMetadata,
          totalTables: mergedTables.length,
          lastModified: new Date().toISOString()
        }
      };

      updateData('advancedPerformance', mergedAdvancedPerformance);
      dataToSave.advancedPerformance = mergedAdvancedPerformance;
    }

    if (performanceData.abacCurves) {
      
      
      

      // Vérifier si on modifie un abaque existant
      if (performanceData.editingModelIndex !== undefined) {
        
        const newModels = [...(data.performanceModels || [])];
        newModels[performanceData.editingModelIndex] = {
          ...newModels[performanceData.editingModelIndex],
          name: performanceData.classification || performanceData.abacCurves.name || newModels[performanceData.editingModelIndex].name,
          type: performanceData.systemType || newModels[performanceData.editingModelIndex].type || 'abaque',
          classification: performanceData.classification,
          classificationValue: performanceData.classificationValue,
          data: performanceData.abacCurves,
          updatedAt: new Date().toISOString()
        };
        
        updateData('performanceModels', newModels);
        dataToSave.performanceModels = newModels;
      } else {
        // Sinon, créer un nouveau modèle
        
        
                const newModels = [
          ...(data.performanceModels || []),
          {
            id: `model_${Date.now()}`,
            name: performanceData.classification || performanceData.abacCurves.name || 'Nouveau modèle ABAC',
            type: performanceData.systemType || 'abaque', // Utiliser le systemType si disponible
            classification: performanceData.classification,
            classificationValue: performanceData.classificationValue,
            data: performanceData.abacCurves,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ];
        newModels.forEach((model, idx) => {
        });

        updateData('performanceModels', newModels);
        dataToSave.performanceModels = newModels;
      }
    }

    if (performanceData.tables) {
      updateData('performanceTables', performanceData.tables);
      dataToSave.performanceTables = performanceData.tables;
    }

    // Sauvegarder le manuel de vol avec la configuration
    if (performanceData.flightManual) {
      const manualData = {
        file: performanceData.flightManual,
        uploadDate: new Date().toISOString(),
        version: performanceData.manualVersion || 'Version non spécifiée'
      };
      updateData('flightManual', manualData);
      dataToSave.flightManual = manualData;
    }

    // Sauvegarder dans le localStorage pour persistance
    try {
      localStorage.setItem('wizard_performance_temp', JSON.stringify(dataToSave));
      
    } catch (e) {
      console.error('Erreur lors de la sauvegarde:', e);
    }

    // Navigation automatique vers l'étape suivante (équipement)
    if (performanceData.abacCurves) {
      // Dans les deux cas (création ou modification), naviguer vers l'étape équipement
      const action = performanceData.editingModelIndex !== undefined ? 'modifié' : 'créé';
      
      if (onNext) {
        onNext();
      }
    }

    // Navigation automatique pour les performances avancées (tables)
    if (performanceData.advancedPerformance?.extractionMetadata?.completedAt) {
      
      if (onNext) {
        setTimeout(() => onNext(), 500); // Petit délai pour laisser la sauvegarde se terminer
      }
    }
  };

  // Données de l'avion pour contexte
  const aircraft = {
    registration: data.registration,
    model: data.model,
    manufacturer: data.manufacturer,
    type: data.aircraftType,
    category: data.category,
    manex: data.manex // Passer le MANEX existant
  };

  
  
  
  
  

  // Si des données existent, afficher une vue récapitulative avec option de modifier
  if ((showExistingData || forceShowSummary) && savedPerformanceData) {
    return (
      <div>
        <h3 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: 'bold' }}>
          Données de Performance Configurées
        </h3>

        {/* Abaques de performance */}
        {savedPerformanceData.performanceModels && savedPerformanceData.performanceModels.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
              Abaques de Performance ({savedPerformanceData.performanceModels.length})
            </h4>
            {savedPerformanceData.performanceModels.map((model, index) => {
              // Log pour debug
              

              return (
              <div key={index} style={{
                backgroundColor: '#f0f9ff',
                border: '1px solid #3b82f6',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '8px',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                    {model.classification || model.name || `Abaque ${index + 1}`}
                  </div>
                  {model.data?.graphs && (
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>
                      {model.data.graphs.length} graphique(s) configuré(s)
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => {

                      // Stocker l'abaque à modifier et ouvrir le wizard
                      setSavedPerformanceData({
                        ...savedPerformanceData,
                        editingModel: model,
                        editingModelIndex: index
                      });
                      setShowExistingData(false);
                      setForceShowSummary(false);
                      setWizardStep(2); // Démarrer à l'étape 2 (le wizard redirigera automatiquement vers l'étape 4 en mode édition)
                      // Notifier le wizard principal qu'on est en mode édition
                      if (setIsEditingAbaque) {
                        setIsEditingAbaque(true);
                      }
                      // Fournir une fonction pour avancer dans le wizard de performance
                      if (setOnConstruireCourbes) {
                        setOnConstruireCourbes(() => () => {
                          // Cette fonction sera appelée par le bouton "Construire les courbes"

                          if (abacBuilderRef.current) {

                            abacBuilderRef.current.goToNextStep();
                          } else {

                          }
                        });
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      backgroundColor: 'white',
                      border: '1px solid #3b82f6',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      color: '#3b82f6',
                      fontWeight: '500'
                    }}
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Voulez-vous vraiment supprimer l'abaque "${model.name || `Abaque ${index + 1}`}" ?`)) {
                        const newModels = savedPerformanceData.performanceModels.filter((_, i) => i !== index);
                        updateData('performanceModels', newModels);
                        setSavedPerformanceData({
                          ...savedPerformanceData,
                          performanceModels: newModels
                        });


                        // Si plus d'abaques, revenir au wizard
                        if (newModels.length === 0) {
                          setShowExistingData(false);
                        }
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      backgroundColor: '#fee2e2',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      color: '#991b1b',
                      fontWeight: '500'
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {/* Tableaux de performance */}
        {savedPerformanceData.advancedPerformance && (() => {
          // Grouper les tableaux par classification
          const groupedByClassification = {};
          savedPerformanceData.advancedPerformance.tables?.forEach(table => {
            const classification = table.classification || 'non-classified';
            if (!groupedByClassification[classification]) {
              groupedByClassification[classification] = [];
            }
            groupedByClassification[classification].push(table);
          });

          const classificationsCount = Object.keys(groupedByClassification).length;

          return (
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                Tableaux de performance ({classificationsCount})
              </h4>
              {Object.entries(groupedByClassification).map(([classification, tables], index) => {
                // Trouver le label de la classification
                const performanceTypes = [
                  { value: '', label: 'Non classifié' },
                  { value: 'takeoff-normal', label: 'Distance de décollage' },
                  { value: 'takeoff-climb', label: 'Montée au décollage' },
                  { value: 'cruise-climb', label: 'Montée en croisière' },
                  { value: 'landing-normal', label: 'Distance d\'atterrissage' },
                  { value: 'landing-abnormal', label: 'Atterrissage en position anormale' }
                ];

                const typeInfo = performanceTypes.find(t => t.value === classification);
                const displayName = typeInfo?.label || classification;

                // Utiliser le nom du premier tableau comme titre principal
                const mainTableName = tables[0]?.table_name || displayName;

                return (
                  <div key={index} style={{
                    backgroundColor: '#f0f9ff',
                    border: '1px solid #3b82f6',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '8px',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: '15px' }}>
                        {mainTableName}
                      </div>
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>
                        {tables.length} tableau(x) extrait(s)
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => {

                          // Filtrer les tableaux pour cette classification
                          const tablesToEdit = savedPerformanceData.advancedPerformance.tables.filter(
                            t => (t.classification || 'non-classified') === classification
                          );

                          // Réinitialiser le flag pour ignorer le premier appel automatique
                          isFirstAutoCallRef.current = true;

                          // Stocker les données à modifier
                          setSavedPerformanceData({
                            ...savedPerformanceData,
                            editingTables: {
                              classification: classification,
                              tables: tablesToEdit,
                              allTables: savedPerformanceData.advancedPerformance.tables
                            }
                          });

                          // Cacher la vue récapitulative pour afficher le wizard
                          setShowExistingData(false);
                          setForceShowSummary(false);
                        }}
                        style={{
                          flex: 1,
                          padding: '4px 8px',
                          backgroundColor: 'white',
                          border: '1px solid #3b82f6',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          color: '#3b82f6',
                          fontWeight: '500'
                        }}
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Voulez-vous vraiment supprimer les tableaux "${displayName}" ?`)) {
                            // Filtrer les tableaux pour retirer ceux de cette classification
                            const remainingTables = savedPerformanceData.advancedPerformance.tables.filter(
                              t => (t.classification || 'non-classified') !== classification
                            );

                            if (remainingTables.length === 0) {
                              // Si plus de tableaux, supprimer complètement advancedPerformance
                              updateData('advancedPerformance', null);
                              setSavedPerformanceData({
                                ...savedPerformanceData,
                                advancedPerformance: null
                              });


                              // Si plus de données, revenir au wizard
                              if (!savedPerformanceData.performanceModels?.length && !savedPerformanceData.performanceTables) {
                                setShowExistingData(false);
                              }
                            } else {
                              // Sinon, mettre à jour avec les tableaux restants
                              const updatedPerformance = {
                                ...savedPerformanceData.advancedPerformance,
                                tables: remainingTables,
                                extractionMetadata: {
                                  ...savedPerformanceData.advancedPerformance.extractionMetadata,
                                  totalTables: remainingTables.length,
                                  lastModified: new Date().toISOString()
                                }
                              };
                              updateData('advancedPerformance', updatedPerformance);
                              setSavedPerformanceData({
                                ...savedPerformanceData,
                                advancedPerformance: updatedPerformance
                              });

                            }
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '4px 8px',
                          backgroundColor: '#fee2e2',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          color: '#991b1b',
                          fontWeight: '500'
                        }}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Tables de performance */}
        {savedPerformanceData.performanceTables && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
              Tables de Performance
            </h4>
            <div style={{
              backgroundColor: '#f0f9ff',
              border: '1px solid #3b82f6',
              borderRadius: '8px',
              padding: '12px'
            }}>
              Configurées
            </div>
          </div>
        )}

        {/* Bouton pour modifier */}
        <button
          onClick={() => {
            setShowExistingData(false);
            setForceShowSummary(false);
          }}
          style={{
            marginTop: '8px',
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
            fontWeight: '500'
          }}
        >
          Ajouter des données de performance
        </button>

        {/* Boutons de navigation */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
          {/* Bouton Précédent */}
          {onPrevious && (
            <Button
              variant="outlined"
              color="primary"
              size="large"
              onClick={onPrevious}
              startIcon={<ChevronLeftIcon />}
            >
              Précédent
            </Button>
          )}

          {/* Bouton Suivant */}
          {onNext && (
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={onNext}
              endIcon={<ChevronRightIcon />}
            >
              Suivant
            </Button>
          )}
        </Box>
      </div>
    );
  }

  // Sinon, afficher le wizard de création/édition
  // Si on édite un abaque existant, passer ses données
  // Si on édite des tableaux, passer les données des tableaux
  // Sinon, ne pas passer de données initiales pour éviter le saut automatique à l'étape 4
  const wizardInitialData = savedPerformanceData?.editingModel
    ? {
        abacCurves: savedPerformanceData.editingModel.data,
        editingModelIndex: savedPerformanceData.editingModelIndex
      }
    : savedPerformanceData?.editingTables
    ? {
        advancedPerformance: {
          tables: savedPerformanceData.editingTables.tables,
          extractionMetadata: {
            classification: savedPerformanceData.editingTables.classification,
            editMode: true
          }
        }
      }
    : null;

  
  
  
    // Si on édite des tableaux, afficher directement l'AdvancedPerformanceAnalyzer
  if (savedPerformanceData?.editingTables) {
    // Callback pour retour
    const handleRetour = () => {
      
      setSavedPerformanceData({
        ...savedPerformanceData,
        editingTables: null
      });
      setShowExistingData(true);
      setForceShowSummary(true);
    };

    return (
      <div style={{ padding: '20px' }}>
        <AdvancedPerformanceAnalyzer
          aircraft={aircraft}
          initialData={wizardInitialData}
          onRetourClick={handleRetour}
          onPerformanceUpdate={(updatedData) => {
            

            // Ignorer le premier appel automatique au montage
            if (isFirstAutoCallRef.current) {
              
              isFirstAutoCallRef.current = false;
              return;
            }

            // Vérifier si c'est une sauvegarde finale (bouton "Suivant" cliqué)
            const isCompleted = updatedData.advancedPerformance?.extractionMetadata?.completedAt;

            if (isCompleted) {
              

              // Remplacer les tableaux de cette classification par les nouveaux
              const allTables = savedPerformanceData.editingTables.allTables;
              const classification = savedPerformanceData.editingTables.classification;

              // Retirer les anciens tableaux de cette classification
              const otherTables = allTables.filter(
                t => (t.classification || 'non-classified') !== classification
              );

              // Ajouter les nouveaux tableaux
              const updatedAllTables = [
                ...otherTables,
                ...(updatedData.advancedPerformance?.tables || [])
              ];

              // Mettre à jour dans le wizard
              updateData('advancedPerformance', {
                tables: updatedAllTables,
                extractionMetadata: {
                  ...updatedData.advancedPerformance.extractionMetadata,
                  totalTables: updatedAllTables.length
                }
              });

              // Navigation vers l'étape équipement
              if (onNext) {
                setTimeout(() => onNext(), 500); // Petit délai pour laisser la sauvegarde se terminer
              }
            } else {
              // Mode édition normale - retour à la vue récapitulative
              // Remplacer les tableaux de cette classification par les nouveaux
              const allTables = savedPerformanceData.editingTables.allTables;
              const classification = savedPerformanceData.editingTables.classification;

              // Retirer les anciens tableaux de cette classification
              const otherTables = allTables.filter(
                t => (t.classification || 'non-classified') !== classification
              );

              // Ajouter les nouveaux tableaux
              const updatedAllTables = [
                ...otherTables,
                ...(updatedData.advancedPerformance?.tables || [])
              ];

              // Mettre à jour dans le wizard
              updateData('advancedPerformance', {
                tables: updatedAllTables,
                extractionMetadata: {
                  ...savedPerformanceData.advancedPerformance?.extractionMetadata,
                  totalTables: updatedAllTables.length,
                  lastModified: new Date().toISOString()
                }
              });

              // Mettre à jour savedPerformanceData et retourner à la vue récapitulative
              setSavedPerformanceData({
                ...savedPerformanceData,
                advancedPerformance: {
                  tables: updatedAllTables,
                  extractionMetadata: {
                    ...savedPerformanceData.advancedPerformance?.extractionMetadata,
                    totalTables: updatedAllTables.length,
                    lastModified: new Date().toISOString()
                  }
                },
                editingTables: null
              });

              setShowExistingData(true);
              setForceShowSummary(true);
            }
          }}
        />
      </div>
    );
  }

  // Sinon, afficher le wizard de création/édition
  return (
    <div>
      <PerformanceWizard
        aircraft={aircraft}
        onPerformanceUpdate={handlePerformanceUpdate}
        initialData={wizardInitialData}
        startAtStep={wizardStep}
        abacBuilderRefCallback={handleAbacBuilderRefCallback}
        onCancel={() => {
          
          // Si on a des données de performance, revenir à la vue récapitulative
          if (savedPerformanceData && (data.performanceModels?.length > 0 || data.advancedPerformance || data.performanceTables)) {
            setShowExistingData(true);
            setForceShowSummary(true);
            // Nettoyer le mode édition
            setSavedPerformanceData({
              ...savedPerformanceData,
              editingModel: null,
              editingModelIndex: null
            });
            // Désactiver le mode édition dans le wizard principal
            if (setIsEditingAbaque) {
              setIsEditingAbaque(false);
            }
          }
        }}
      />

      {/* Bouton "← Précédent" déplacé dans la navigation du wizard principal */}
    </div>
  );
};

export default Step4Performance;