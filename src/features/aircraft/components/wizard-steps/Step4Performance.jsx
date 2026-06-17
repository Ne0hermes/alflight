import React, { useEffect, useState, useMemo } from 'react';
import PerformanceWizard from '../PerformanceWizard';
import AdvancedPerformanceAnalyzer from '../AdvancedPerformanceAnalyzer';
import { Button, Box, Checkbox } from '@mui/material';
import {
  ChevronRight as ChevronRightIcon,
  ChevronLeft as ChevronLeftIcon,
  FileDownload as FileDownloadIcon,
  FileUpload as FileUploadIcon
} from '@mui/icons-material';
import { exportPerformanceModelsToExcel } from '../../../../utils/performanceExcelExport';
import { importPerformanceModelsFromExcel, diffPerformanceModels } from '../../../../utils/performanceExcelImport';
// R24 — re-classification des tableaux DÉJÀ convertis : même classifieur
// partagé que les abaques et l'extraction (R23), pour uniformiser les avions
// existants dont la classification était jusqu'ici figée.
import { OperationClassifier } from '../../../../abac/curves/ui/OperationClassifier';
import { getOperation } from '../../../../abac/curves/core/operationCatalog';

const Step4Performance = ({ data, updateData, errors = {}, setIsEditingAbaque, setOnConstruireCourbes, setCurrentStep, onNext, onPrevious, registerStepNav }) => {
  // État local pour stocker les données de performance temporaires
  const [savedPerformanceData, setSavedPerformanceData] = useState(null);
  const [wizardStep, setWizardStep] = useState(2); // Démarrer à l'étape 2 (Step 1 retiré)
  // R5 — « Nouvel abaque » depuis le récap : ouverture directe de l'atelier
  // image unique (bypass du tunnel type/upload/analyse/pages).
  const [directNewAbaque, setDirectNewAbaque] = useState(false);
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

  // ─── Contrat de navigation en cascade (pied de page unique) ────────────────
  // Quand on édite un tableau (vue editingTables), "Précédent"/"Suivant" du
  // pied de page reviennent d'abord à la liste des tableaux. On ne change
  // d'étape principale que depuis la liste/le récapitulatif.
  useEffect(() => {
    if (!registerStepNav) return;
    const inEditor = !!savedPerformanceData?.editingTables;
    const backToList = () => {
      setSavedPerformanceData(prev => (prev ? { ...prev, editingTables: null } : prev));
      setShowExistingData(true);
      setForceShowSummary(true);
    };
    registerStepNav({
      canGoBack: () => inEditor,
      goBack: backToList,
      canGoNext: () => inEditor,
      goNext: backToList,
    });
    return () => registerStepNav(null);
  }, [registerStepNav, savedPerformanceData?.editingTables]);

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

      // Fusionner les tableaux (éviter les doublons).
      // Clé de dédoublonnage (Option B) :
      //   - PRIORITAIRE : operationId + Masse (un seul tableau par opération par masse)
      //   - FALLBACK : pageNumber + table_type + table_name (legacy)
      const mergedTables = [...existingTables];
      newTables.forEach(newTable => {
        // Helper pour calculer la clé d'un tableau
        const tableKey = (t) => {
          if (t.operationId) {
            // Masse depuis data[0] ou nom ou conditions
            const mass = t.data?.[0]?.Masse
                       ?? (t.table_name?.match(/(\d+)\s*kg/i)?.[1])
                       ?? t.conditions?.mass
                       ?? 'nomass';
            return `op:${t.operationId}__m:${mass}`;
          }
          return `legacy:${t.pageNumber || 'nopage'}_${t.table_type || 'notype'}_${t.table_name || 'noname'}`;
        };

        const newKey = tableKey(newTable);
        const existingIndex = mergedTables.findIndex(t => tableKey(t) === newKey);

        if (existingIndex >= 0) {
          console.log(`📊 Remplacement tableau ${newTable.table_name} (key=${newKey})`);
          mergedTables[existingIndex] = newTable;
        } else {
          console.log(`📊 Ajout nouveau tableau ${newTable.table_name} (key=${newKey})`);
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
      // 🔒 R17 — GARDE ANTI-AMBIGUÏTÉ : deux modèles du même avion ne doivent
      // JAMAIS partager la même opération canonique (systemType) — la prépa
      // vol ne saurait pas lequel utiliser (bug du « 533 ft » : deux abaques
      // takeoff_50ft, volets 0° et 25°, dénominations identiques). On ne perd
      // jamais le travail : soit le pilote assume (OK), soit le nom porte un
      // marqueur DOUBLON bien visible à corriger.
      let duplicateNameSuffix = '';
      {
        const newSystemType = performanceData.abacCurves?.metadata?.systemType;
        const twinIndex = (data.performanceModels || []).findIndex((m, i) =>
          i !== performanceData.editingModelIndex &&
          newSystemType &&
          m?.data?.metadata?.systemType === newSystemType
        );
        if (twinIndex >= 0) {
          const keepAsIs = window.confirm(
            `⚠ Un modèle « ${data.performanceModels[twinIndex].name} » existe déjà pour cet avion avec la même opération canonique (${newSystemType}).\n\n` +
            `Deux abaques identiquement dénommés : le calcul peut piocher le MAUVAIS tableau (état des volets ?).\n\n` +
            `OK — enregistrer tel quel (à corriger : précise l'état des volets dans l'identité du graphe, listes Phase / Métrique / Volets).\n` +
            `Annuler — enregistrer avec un marqueur « DOUBLON » bien visible sur le nom.`
          );
          if (!keepAsIs) duplicateNameSuffix = ' ⚠ DOUBLON — préciser les volets';
        }
      }

      // Vérifier si on modifie un abaque existant
      if (performanceData.editingModelIndex !== undefined) {
        
        const newModels = [...(data.performanceModels || [])];
        newModels[performanceData.editingModelIndex] = {
          ...newModels[performanceData.editingModelIndex],
          name: (performanceData.classification || performanceData.abacCurves.name || newModels[performanceData.editingModelIndex].name) + duplicateNameSuffix,
          type: performanceData.systemType || newModels[performanceData.editingModelIndex].type || 'abaque',
          classification: performanceData.classification,
          classificationValue: performanceData.classificationValue,
          data: performanceData.abacCurves,
          updatedAt: new Date().toISOString()
        };
        
        updateData('performanceModels', newModels);
        dataToSave.performanceModels = newModels;
      } else {
        // Sinon, créer un nouveau modèle.
        // 🔧 GARDE ANTI-DOUBLON : si un modèle avec la même signature
        // (operationId du primaire + systemType + nombre de graphes + premier graphId)
        // a été créé il y a < 10 secondes, on le REMPLACE au lieu d'en créer un nouveau.
        // Évite les triples-saves qu'on observait quand handlePerformanceUpdate
        // était invoqué plusieurs fois par re-render.
        const existing = data.performanceModels || [];
        const newAbac = performanceData.abacCurves;
        const newSig = {
          systemType: newAbac?.metadata?.systemType,
          nbGraphs: newAbac?.graphs?.length,
          firstGraphId: newAbac?.graphs?.[0]?.id,
          firstPrimaryOpId: newAbac?.graphs?.find?.(g => (g.role || 'primary') === 'primary')?.operationId
        };
        const tenSecondsAgo = Date.now() - 10_000;
        const dupIndex = existing.findIndex(m => {
          if (!m?.createdAt) return false;
          if (new Date(m.createdAt).getTime() < tenSecondsAgo) return false;
          const sig = {
            systemType: m.data?.metadata?.systemType,
            nbGraphs: m.data?.graphs?.length,
            firstGraphId: m.data?.graphs?.[0]?.id,
            firstPrimaryOpId: m.data?.graphs?.find?.(g => (g.role || 'primary') === 'primary')?.operationId
          };
          return sig.systemType === newSig.systemType
              && sig.nbGraphs === newSig.nbGraphs
              && sig.firstGraphId === newSig.firstGraphId
              && sig.firstPrimaryOpId === newSig.firstPrimaryOpId;
        });

        let newModels;
        if (dupIndex >= 0) {
          // ⚠ Doublon récent détecté → on met à jour l'entrée existante
          console.warn('🛑 [Step4Performance] Doublon détecté (même set créé < 10s) — remplacement de l\'entrée existante au lieu d\'un append :', existing[dupIndex].id);
          newModels = [...existing];
          newModels[dupIndex] = {
            ...newModels[dupIndex],
            name: (performanceData.classification || newAbac.name || newModels[dupIndex].name) + duplicateNameSuffix,
            type: performanceData.systemType || newModels[dupIndex].type || 'abaque',
            classification: performanceData.classification,
            classificationValue: performanceData.classificationValue,
            data: newAbac,
            updatedAt: new Date().toISOString()
          };
        } else {
          // Nouveau modèle légitime
          newModels = [
            ...existing,
            {
              id: `model_${Date.now()}`,
              name: (performanceData.classification || newAbac.name || 'Nouveau modèle ABAC') + duplicateNameSuffix,
              type: performanceData.systemType || 'abaque',
              classification: performanceData.classification,
              classificationValue: performanceData.classificationValue,
              data: newAbac,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ];
        }

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

    // Sauvegarder dans le localStorage pour persistance (brouillon wizard)
    // ⚠ On strippe les données lourdes (points fittés, dataURLs d'images) qui peuvent
    // facilement dépasser la quota localStorage (~5 MB). Ces données sont régénérables
    // ou stockées ailleurs.
    try {
      const stripHeavy = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(stripHeavy);
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
          if (k === 'fitted' && v && typeof v === 'object' && Array.isArray(v.points)) {
            // On garde la méta du fit (rmse, method) mais on dégage les ~200 points fittés
            out[k] = { rmse: v.rmse, method: v.method, _stripped: true };
          } else if (typeof v === 'string' && v.startsWith('data:') && v.length > 5000) {
            // dataURL base64 → on ne persiste pas dans le brouillon
            out[k] = '[stripped_dataurl]';
          } else {
            out[k] = stripHeavy(v);
          }
        }
        return out;
      };

      const lightDraft = stripHeavy(dataToSave);
      const serialized = JSON.stringify(lightDraft);

      // Si même la version allégée dépasse 4 MB, on saute le brouillon plutôt que de planter
      if (serialized.length > 4 * 1024 * 1024) {
        console.warn(`⚠️ [Step4Performance] Brouillon localStorage skip (${(serialized.length / 1024 / 1024).toFixed(2)} MB > 4 MB). L'avion reste persisté correctement via Supabase/IndexedDB.`);
        // On vide quand même la clé existante pour éviter une vieille version
        localStorage.removeItem('wizard_performance_temp');
      } else {
        localStorage.setItem('wizard_performance_temp', serialized);
      }
    } catch (e) {
      // QuotaExceededError ou autre — on ne bloque pas le flow de sauvegarde principale
      // (qui passe par Supabase/IndexedDB et n'a pas besoin du brouillon localStorage).
      console.warn('⚠️ [Step4Performance] Impossible de sauver le brouillon localStorage (non bloquant):', e?.name || 'erreur', e?.message || '');
      try { localStorage.removeItem('wizard_performance_temp'); } catch { /* noop */ }
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
  // ─── Workflow Excel : handlers + banner JSX réutilisables ─────────────
  // Définis ici (hors conditionnels de rendu) pour être accessibles dans les
  // 2 vues : récapitulatif des modèles existants ET wizard de création.
  const currentPerformanceModels = (savedPerformanceData?.performanceModels)
    || data.performanceModels
    || [];
  // hasAnyModel = true si on a soit des modèles abaque, soit des tableaux
  // de performance extraits du MANEX (les 2 formats coexistent).
  const hasAnyModel = currentPerformanceModels.length > 0
    || ((savedPerformanceData?.advancedPerformance?.tables) || data.advancedPerformance?.tables || []).length > 0;

  // ─── Sélection des modèles à exporter (checkboxes) ─────────────────────
  // Set des IDs (ou indices fallback pour legacy) sélectionnés.
  // Par défaut : tout coché. Re-sync auto quand la liste de modèles change.
  const getModelId = (m, idx) => m.id || `__legacy_idx_${idx}`;

  const [selectedModelIds, setSelectedModelIds] = useState(() => {
    return new Set(currentPerformanceModels.map((m, idx) => getModelId(m, idx)));
  });

  useEffect(() => {
    setSelectedModelIds(prev => {
      const next = new Set(prev);
      let changed = false;
      const currentIds = new Set(currentPerformanceModels.map((m, idx) => getModelId(m, idx)));
      currentPerformanceModels.forEach((m, idx) => {
        const id = getModelId(m, idx);
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      });
      // Nettoyer les IDs qui n'existent plus
      next.forEach(id => {
        if (!currentIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [currentPerformanceModels.length, currentPerformanceModels.map(m => m.id || 'noid').join(',')]);

  const toggleModelSelection = (id) => {
    setSelectedModelIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Sélection des CLASSIFICATIONS de tableaux extraits du MANEX ─────
  // Les tableaux sont stockés dans data.advancedPerformance.tables avec
  // un champ `classification`. On les groupe par classification et le
  // pilote coche celles à exporter.
  const advancedTables = (savedPerformanceData?.advancedPerformance?.tables)
    || data.advancedPerformance?.tables
    || [];
  const availableClassifications = useMemo(() => {
    const set = new Set();
    advancedTables.forEach(t => {
      set.add(t.classification || 'non-classified');
    });
    return Array.from(set);
  }, [advancedTables.length, advancedTables.map(t => t.classification || 'non-classified').join(',')]);

  const [selectedClassifications, setSelectedClassifications] = useState(
    () => new Set(availableClassifications)
  );

  useEffect(() => {
    setSelectedClassifications(prev => {
      const next = new Set(prev);
      let changed = false;
      const currentSet = new Set(availableClassifications);
      availableClassifications.forEach(c => {
        if (!next.has(c)) {
          next.add(c);
          changed = true;
        }
      });
      next.forEach(c => {
        if (!currentSet.has(c)) {
          next.delete(c);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [availableClassifications.join(',')]);

  const toggleClassificationSelection = (cls) => {
    setSelectedClassifications(prev => {
      const next = new Set(prev);
      if (next.has(cls)) next.delete(cls);
      else next.add(cls);
      return next;
    });
  };

  // R24 — re-classifie TOUS les tableaux d'un groupe (ancienne classification →
  // nouvel operationId canonique). Met à jour operationId + classification sur
  // chaque tableau, puis persiste (updateData + setSavedPerformanceData, comme
  // la suppression — la sauvegarde de la fiche écrit le tout). Permet de
  // reprendre les avions existants et d'uniformiser la classification.
  const reclassifyTableGroup = (oldClassification, newOperationId) => {
    if (!newOperationId || newOperationId === oldClassification) return;
    const ap = savedPerformanceData?.advancedPerformance || data.advancedPerformance;
    if (!ap?.tables) return;
    const updatedTables = ap.tables.map(t =>
      (t.classification || 'non-classified') === oldClassification
        ? { ...t, operationId: newOperationId, classification: newOperationId }
        : t
    );
    const updatedPerformance = {
      ...ap,
      tables: updatedTables,
      extractionMetadata: {
        ...ap.extractionMetadata,
        lastModified: new Date().toISOString()
      }
    };
    updateData('advancedPerformance', updatedPerformance);
    setSavedPerformanceData(prev => ({ ...(prev || {}), advancedPerformance: updatedPerformance }));
    // Suivre la sélection d'export : l'ancienne clé devient la nouvelle.
    setSelectedClassifications(prev => {
      const next = new Set(prev);
      if (next.has(oldClassification)) { next.delete(oldClassification); next.add(newOperationId); }
      return next;
    });
  };

  // R25 — re-classifie un MODÈLE D'ABAQUE existant (avions créés avant la
  // dernière version de classification). La classification d'un abaque vit à
  // 3 endroits qu'on garde en phase : metadata.systemType, l'operationId du
  // graphe PRIMAIRE, et classification/classificationValue (champs du récap).
  // Persiste comme la re-classification des tableaux (écrit à la sauvegarde).
  const reclassifyAbaqueModel = (index, newOperationId) => {
    if (!newOperationId) return;
    const models = savedPerformanceData?.performanceModels || data.performanceModels;
    if (!models?.[index]) return;
    const op = getOperation(newOperationId);
    const onlyOutput = op && op.acceptedOutputs.length === 1 ? op.acceptedOutputs[0] : null;
    const updated = models.map((m, i) => {
      if (i !== index) return m;
      const graphs = (m.data?.graphs || []).map(g =>
        (g.role || 'primary') === 'primary'
          ? { ...g, operationId: newOperationId, ...(onlyOutput ? { outputKind: onlyOutput.kind, outputUnit: onlyOutput.defaultUnit } : {}) }
          : g
      );
      return {
        ...m,
        classification: op?.labelFr || newOperationId,
        classificationValue: newOperationId,
        data: {
          ...m.data,
          metadata: {
            ...(m.data?.metadata || {}),
            systemType: newOperationId,
            systemName: op?.labelFr || m.data?.metadata?.systemName
          },
          graphs
        }
      };
    });
    updateData('performanceModels', updated);
    setSavedPerformanceData(prev => ({ ...(prev || {}), performanceModels: updated }));
  };

  const selectAllModels = () => {
    setSelectedModelIds(new Set(currentPerformanceModels.map((m, idx) => getModelId(m, idx))));
    setSelectedClassifications(new Set(availableClassifications));
  };

  const selectNoneModels = () => {
    setSelectedModelIds(new Set());
    setSelectedClassifications(new Set());
  };

  const selectedCount = selectedModelIds.size + selectedClassifications.size;
  const totalCount = currentPerformanceModels.length + availableClassifications.length;
  const selectedModels = currentPerformanceModels.filter((m, idx) => selectedModelIds.has(getModelId(m, idx)));
  const selectedTables = advancedTables.filter(t =>
    selectedClassifications.has(t.classification || 'non-classified')
  );

  const handleExportExcel = () => {
    try {
      const hasData = currentPerformanceModels.length > 0 || advancedTables.length > 0;
      if (!hasData) {
        alert('Aucune donnée de performance à exporter. Lance d\'abord une extraction.');
        return;
      }
      if (!selectedModels.length && !selectedTables.length) {
        alert('Aucun élément sélectionné. Coche au moins une case avant d\'exporter.');
        return;
      }

      // Diagnostic : voir la structure des tableaux exportés
      console.log('📊 [Step4] Export Excel — selectedTables structure:', {
        nbTables: selectedTables.length,
        firstTableKeys: selectedTables[0] ? Object.keys(selectedTables[0]) : null,
        firstTable: selectedTables[0] ? {
          table_name: selectedTables[0].table_name,
          operationId: selectedTables[0].operationId,
          classification: selectedTables[0].classification,
          hasData: !!selectedTables[0].data,
          dataLength: Array.isArray(selectedTables[0].data) ? selectedTables[0].data.length : 'N/A',
          dataFirstRow: Array.isArray(selectedTables[0].data) ? selectedTables[0].data[0] : null
        } : null
      });

      // Un seul fichier Excel avec un onglet par modèle/classification sélectionné
      const fileName = exportPerformanceModelsToExcel(
        selectedModels,
        data.registration || 'avion',
        { tables: selectedTables }
      );
      console.log(`✅ [Step4] Export Excel : ${fileName}`, {
        modèles: `${selectedModels.length}/${currentPerformanceModels.length}`,
        tables: `${selectedTables.length}/${advancedTables.length}`
      });
    } catch (err) {
      console.error('[Step4] Export Excel échoué:', err);
      alert(`Erreur export Excel : ${err.message}`);
    }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const {
        models: newModels,
        tables: newTables,
        sheets,
        warnings
      } = await importPerformanceModelsFromExcel(file);

      if (!newModels.length && !newTables.length) {
        alert(`Aucun modèle ou tableau trouvé dans le fichier Excel.\n${warnings.join('\n')}`);
        e.target.value = '';
        return;
      }

      const diff = diffPerformanceModels(currentPerformanceModels, newModels);
      const summary = [
        `Excel parsé : ${sheets} feuille(s).`,
        newModels.length ? `${newModels.length} modèle(s) abaque reconstruit(s).` : '',
        newTables.length ? `${newTables.length} tableau(x) reconstruit(s).` : '',
        diff.added.length ? `+ Modèles ajoutés : ${diff.added.join(', ')}` : '',
        diff.removed.length ? `- Modèles supprimés : ${diff.removed.join(', ')}` : '',
        diff.modified.length ? `~ Modifications : ${diff.modified.join(' ; ')}` : '',
        warnings.length ? `⚠ Warnings : ${warnings.join(' ; ')}` : '',
        '',
        'Remplacer les données performances actuelles par ces valeurs ?'
      ].filter(Boolean).join('\n');

      if (confirm(summary)) {
        // Modèles abaque
        if (newModels.length) {
          updateData('performanceModels', newModels);
        }

        // Tableaux : fusion dans advancedPerformance.tables
        if (newTables.length) {
          const existingTables = data.advancedPerformance?.tables || [];
          // Stratégie : on REMPLACE par classification (un export Excel est
          // une vérité complète pour les classifications qu'il contient).
          const classificationsInExcel = new Set(newTables.map(t => t.classification));
          const keptTables = existingTables.filter(t =>
            !classificationsInExcel.has(t.classification || 'non-classified')
          );
          const mergedTables = [...keptTables, ...newTables];

          const mergedAdvancedPerformance = {
            ...(data.advancedPerformance || {}),
            tables: mergedTables,
            extractionMetadata: {
              ...(data.advancedPerformance?.extractionMetadata || {}),
              totalTables: mergedTables.length,
              lastModified: new Date().toISOString(),
              reimportedFromExcel: true
            }
          };
          updateData('advancedPerformance', mergedAdvancedPerformance);
        }

        // Mettre à jour le snapshot local
        setSavedPerformanceData({
          ...(savedPerformanceData || {}),
          performanceModels: newModels.length ? newModels : savedPerformanceData?.performanceModels,
          advancedPerformance: newTables.length
            ? {
                ...(savedPerformanceData?.advancedPerformance || {}),
                tables: [
                  ...((savedPerformanceData?.advancedPerformance?.tables || []).filter(t =>
                    !new Set(newTables.map(nt => nt.classification)).has(t.classification || 'non-classified')
                  )),
                  ...newTables
                ]
              }
            : savedPerformanceData?.advancedPerformance
        });

        // Forcer l'affichage du récap pour que l'utilisateur voie ses nouvelles données
        setShowExistingData(true);
        setForceShowSummary(true);
        alert(`✅ Import réussi : ${newModels.length} modèle(s) abaque + ${newTables.length} tableau(x).`);
      }
    } catch (err) {
      console.error('[Step4] Import Excel échoué:', err);
      alert(`Erreur import Excel : ${err.message}`);
    }
    e.target.value = ''; // permettre re-import du même fichier
  };

  // Debug — confirme que Step4Performance est bien monté
  console.log('🟦 [Step4Performance] Render branches:', {
    showExistingData,
    forceShowSummary,
    hasSavedData: !!savedPerformanceData,
    editingTables: !!savedPerformanceData?.editingTables,
    nbModels: currentPerformanceModels.length,
    hasAnyModel
  });

  // Actions Excel (Exporter / Réimporter) — affichées en ligne centrée sous le titre.
  const renderExcelActions = () => (
    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap', mb: 2 }}>
      <Button
        variant="contained"
        size="small"
        startIcon={<FileDownloadIcon />}
        onClick={handleExportExcel}
        disabled={!hasAnyModel || selectedCount === 0}
      >
        Exporter Excel{hasAnyModel ? ` (${selectedCount})` : ''}
      </Button>
      <Button
        variant="outlined"
        size="small"
        color="primary"
        startIcon={<FileUploadIcon />}
        component="label"
      >
        Réimporter Excel
        <input
          type="file"
          accept=".xlsx,.xls"
          hidden
          onChange={handleImportExcel}
        />
      </Button>
    </Box>
  );

  if ((showExistingData || forceShowSummary) && savedPerformanceData) {
    return (
      <div>
        <h3 style={{ marginBottom: '12px', fontSize: 'var(--fs-title)', fontWeight: 'bold' }}>
          Données de Performance Configurées
        </h3>

        {/* Boutons Excel (Exporter / Réimporter) centrés, juste sous le titre */}
        {renderExcelActions()}

        {/* Abaques de performance */}
        {savedPerformanceData.performanceModels && savedPerformanceData.performanceModels.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <h4 style={{ fontSize: 'var(--fs-body)', fontWeight: '600', marginBottom: '8px' }}>
              Abaques de Performance ({savedPerformanceData.performanceModels.length})
            </h4>
            {savedPerformanceData.performanceModels.map((model, index) => {
              // Log pour debug
              

              // Fallback ID pour les anciens modèles sans id : on utilise un
              // id synthétique basé sur l'index pour permettre la sélection.
              const modelId = model.id || `__legacy_idx_${index}`;
              const isSelectedForExport = selectedModelIds.has(modelId);
              // R25 — operationId courant du modèle (3 sources gardées en phase ;
              // priorité à systemType / classificationValue / graphe primaire).
              const primaryOpId = model.data?.graphs?.find?.(g => (g.role || 'primary') === 'primary')?.operationId;
              const currentOpId = model.data?.metadata?.systemType || model.classificationValue || primaryOpId || '';
              const modelLabel = getOperation(currentOpId)?.labelFr || model.classification || model.name || `Abaque ${index + 1}`;
              return (
              <div key={modelId} style={{
                backgroundColor: isSelectedForExport ? 'var(--bg-overlay)' : 'var(--bg-overlay)',
                border: `2px solid ${isSelectedForExport ? 'var(--text-secondary)' : 'var(--text-tertiary)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '10px',
                marginBottom: '8px',
                display: 'flex',
                flexDirection: 'column',
                transition: 'background-color 0.15s, border-color 0.15s'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '8px' }}>
                  {/* Checkbox export Excel — visible avec taille standard et
                      couleur explicite pour qu'elle soit bien repérable */}
                  <Checkbox
                    checked={isSelectedForExport}
                    onChange={() => toggleModelSelection(modelId)}
                    sx={{
                      p: 0.5,
                      color: 'var(--text-secondary)',
                      '&.Mui-checked': { color: 'var(--text-secondary)' }
                    }}
                    title="Inclure ce modèle dans l'export Excel"
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                      {modelLabel}
                    </div>
                    {model.data?.graphs && (
                      <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
                        {model.data.graphs.length} graphique(s) configuré(s)
                      </div>
                    )}
                  </div>
                </div>

                {/* R25 — RE-CLASSIFICATION d'un abaque existant : même classifieur
                    partagé que les tableaux (R24). Met à jour systemType +
                    operationId du graphe primaire + classification du modèle. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    Classer :
                  </span>
                  <OperationClassifier
                    value={currentOpId}
                    onChange={(newOpId) => reclassifyAbaqueModel(index, newOpId)}
                  />
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
                      backgroundColor: 'var(--bg-overlay)',
                      border: '1px solid var(--text-secondary)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--fs-body)',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
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
                      backgroundColor: 'var(--bg-overlay)',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--fs-body)',
                      cursor: 'pointer',
                      color: 'var(--color-red-critical)',
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
              <h4 style={{ fontSize: 'var(--fs-body)', fontWeight: '600', marginBottom: '8px' }}>
                Tableaux de performance ({classificationsCount})
              </h4>
              {Object.entries(groupedByClassification).map(([classification, tables], index) => {
                // R24 — libellé via le catalogue canonique (l'ancienne liste
                // codée en dur — takeoff-normal, landing-normal… — ne
                // correspondait plus aux operationId réellement stockés, d'où
                // un affichage brut « takeoff_ground_roll » et aucune édition).
                const op = getOperation(classification);
                const displayName = op?.labelFr
                  || (classification === 'non-classified' ? 'Non classifié' : classification);

                // Utiliser le nom du premier tableau comme titre principal
                const mainTableName = tables[0]?.table_name || displayName;

                const isSelectedForExport = selectedClassifications.has(classification);

                return (
                  <div key={index} style={{
                    backgroundColor: isSelectedForExport ? 'var(--bg-overlay)' : 'var(--bg-overlay)',
                    border: `2px solid ${isSelectedForExport ? 'var(--text-secondary)' : 'var(--text-tertiary)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px',
                    marginBottom: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'background-color 0.15s, border-color 0.15s'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '8px' }}>
                      {/* Checkbox export Excel pour la classification */}
                      <Checkbox
                        checked={isSelectedForExport}
                        onChange={() => toggleClassificationSelection(classification)}
                        sx={{
                          p: 0.5,
                          color: 'var(--text-secondary)',
                          '&.Mui-checked': { color: 'var(--text-secondary)' }
                        }}
                        title="Inclure ces tableaux dans l'export Excel"
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: 'var(--fs-body)' }}>
                          {mainTableName}
                        </div>
                        <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
                          {tables.length} tableau(x) extrait(s)
                        </div>
                      </div>
                    </div>

                    {/* R24 — RE-CLASSIFICATION (uniformisation) : même classifieur
                        partagé que les abaques et l'extraction. Change
                        l'operationId de tous les tableaux du groupe. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        Classer :
                      </span>
                      <OperationClassifier
                        value={classification === 'non-classified' ? '' : classification}
                        onChange={(newOpId) => reclassifyTableGroup(classification, newOpId)}
                      />
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
                          backgroundColor: 'var(--bg-overlay)',
                          border: '1px solid var(--text-secondary)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--fs-body)',
                          cursor: 'pointer',
                          color: 'var(--text-secondary)',
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
                          backgroundColor: 'var(--bg-overlay)',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--fs-body)',
                          cursor: 'pointer',
                          color: 'var(--color-red-critical)',
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
            <h4 style={{ fontSize: 'var(--fs-title)', fontWeight: '600', marginBottom: '12px' }}>
              Tables de Performance
            </h4>
            <div style={{
              backgroundColor: 'var(--bg-overlay)',
              border: '1px solid var(--text-secondary)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px'
            }}>
              Configurées
            </div>
          </div>
        )}

        {/* Bouton pour modifier */}
        {/* R5 — chemin DIRECT vers l'atelier image unique : plus de tunnel
            type/upload/pages pour créer un abaque (l'image s'importe sur le
            canevas). Le bouton « Ajouter des données » reste pour les
            TABLEAUX MANEX (extraction IA) et flux mixtes. */}
        <button
          onClick={() => {
            setDirectNewAbaque(true);
            setShowExistingData(false);
            setForceShowSummary(false);
          }}
          style={{
            marginTop: '8px',
            padding: '10px',
            backgroundColor: 'var(--accent-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--fs-body)',
            cursor: 'pointer',
            fontWeight: '600',
            width: '100%'
          }}
        >
          ➕ Nouvel abaque — atelier image unique
        </button>
        <button
          onClick={() => {
            setShowExistingData(false);
            setForceShowSummary(false);
          }}
          style={{
            marginTop: '8px',
            padding: '10px',
            backgroundColor: 'var(--text-secondary)',
            color: 'var(--text-primary)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--fs-body)',
            cursor: 'pointer',
            fontWeight: '500',
            width: '100%'
          }}
        >
          Ajouter des données de performance (tableaux MANEX / mixte)
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
  // R5 — « Nouvel abaque » : saut DIRECT vers l'atelier image unique (priorité).
  const wizardInitialData = directNewAbaque
    ? { directToBuilder: true }
    : savedPerformanceData?.editingModel
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
      <>
        {renderExcelActions()}
        <AdvancedPerformanceAnalyzer
          aircraft={aircraft}
          initialData={wizardInitialData}
          hideInternalNav={true}
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

              // Retour à la liste des tableaux de performance (au lieu d'avancer
              // automatiquement). Depuis cette vue récapitulative, l'utilisateur
              // choisit ensuite d'avancer à l'étape suivante (bouton Suivant) ou
              // de modifier un autre tableau.
              setSavedPerformanceData({
                ...savedPerformanceData,
                advancedPerformance: {
                  tables: updatedAllTables,
                  extractionMetadata: {
                    ...updatedData.advancedPerformance.extractionMetadata,
                    totalTables: updatedAllTables.length
                  }
                },
                editingTables: null
              });
              setShowExistingData(true);
              setForceShowSummary(true);
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
      </>
    );
  }

  // Sinon, afficher le wizard de création/édition
  // Le banner Excel est affiché EN HAUT pour rester accessible (export
  // possible si des modèles existent, sinon orientation vers l'extraction).
  return (
    <div>
      {renderExcelActions()}
      <PerformanceWizard
        aircraft={aircraft}
        onPerformanceUpdate={handlePerformanceUpdate}
        initialData={wizardInitialData}
        startAtStep={wizardStep}
        abacBuilderRefCallback={handleAbacBuilderRefCallback}
        onCancel={() => {
          // R5 — sortir du mode « Nouvel abaque direct » en quittant l'atelier
          setDirectNewAbaque(false);

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
    </div>
  );
};

export default Step4Performance;