// src/core/stores/aircraftStore.js
// Store chargé UNIQUEMENT depuis Supabase - AUCUNE DONNÉE LOCALE
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import communityService from '@services/communityService';
import { createModuleLogger } from '@utils/logger';
import { validateAndRepairAircraft } from '@utils/aircraftValidation';
import { useUnitsStore } from '@core/stores/unitsStore';
import { supabase } from '../../lib/supabaseClient';
import { recordSupabaseError } from '../../lib/persistentErrorLog';

// Récupère l'userId Supabase courant pour tagger les écritures.
// Retourne null si l'utilisateur n'est pas authentifié (les RLS doivent alors refuser l'écriture).
async function getCurrentUserId() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  } catch (e) {
    console.warn('[AircraftStore] Impossible de récupérer la session Supabase:', e?.message);
    return null;
  }
}

// Convertit le MANEX d'un avion en { blob, fileName } uploadable vers Supabase Storage.
// Source : aircraft.manex.pdfData|file (data URL base64 OU Blob/File), sinon la copie
// IndexedDB de l'avion. Retourne null si aucun PDF exploitable n'est trouvé.
// Centralise la persistance MANEX : add/update passent ce blob au service pour que
// la ligne POSSÉDÉE reçoive le fichier + manex_file_id (sinon : has_manex sans fichier
// → MANEX « fantôme » perdu au reload/suppression).
async function resolveManexFile(aircraft) {
  if (!aircraft) return null;
  let manex = aircraft.manex;
  if (!manex || (!manex.pdfData && !manex.file)) {
    try {
      const dbm = await import('@utils/dataBackupManager').then(m => m.default);
      const full = aircraft.id ? await dbm.getAircraftData(aircraft.id) : null;
      if (full?.manex) manex = full.manex;
    } catch (_) { /* pas de copie locale */ }
  }
  if (!manex) return null;
  const raw = manex.pdfData || manex.file;
  if (!raw) return null;
  const fileName = manex.fileName || `${aircraft.registration || 'aircraft'} - manex.pdf`;
  // Déjà un Blob/File
  if (typeof Blob !== 'undefined' && raw instanceof Blob) {
    return { blob: raw, fileName };
  }
  // Data URL base64 → Blob
  if (typeof raw === 'string' && raw.includes('base64,')) {
    try {
      const base64 = raw.split('base64,')[1];
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { blob: new Blob([bytes], { type: 'application/pdf' }), fileName };
    } catch (e) {
      console.warn('[AircraftStore] resolveManexFile: conversion base64 échouée:', e?.message);
      return null;
    }
  }
  return null;
}

// Dédoublonne une liste d'avions par immatriculation (modèle « clone possédé » :
// la ligne communautaire d'origine et ta copie possédée coexistent en base).
// TOUJOURS effondre une immatriculation à une seule entrée (même sans utilisateur
// connu) → empêche d'afficher/éditer par erreur la mauvaise ligne et de créer des
// clones en cascade. Gagnant : la copie possédée si l'utilisateur est connu,
// sinon la première rencontrée (déterministe).
function dedupeAircraftByRegistration(list, myUid) {
  const byReg = new Map();
  for (const ac of (list || [])) {
    const reg = (ac?.registration || '').toString().trim().toUpperCase();
    if (!reg) { byReg.set(`__noreg__${ac?.id}`, ac); continue; } // sans immat → jamais fusionné
    const existing = byReg.get(reg);
    if (!existing) { byReg.set(reg, ac); continue; }
    const acMine = !!myUid && ac.submitted_by === myUid;
    const exMine = !!myUid && existing.submitted_by === myUid;
    if (acMine && !exMine) byReg.set(reg, ac); // la copie possédée éclipse la communautaire
    // sinon on garde l'existant (premier vu) — effondrement déterministe
  }
  return Array.from(byReg.values());
}

const logger = createModuleLogger('AircraftStore');


// 🧹 NETTOYAGE AU DÉMARRAGE - Supprimer les anciennes clés uniquement
if (typeof window !== 'undefined') {
  // Nettoyer les anciennes clés obsolètes (pas aircraft-store-v2!)
  localStorage.removeItem('aircraft-storage');
  localStorage.removeItem('aircraft_wizard_draft');
  localStorage.removeItem('wizard_performance_temp');
}

// Store pour la gestion des avions depuis Supabase UNIQUEMENT
export const useAircraftStore = create(
  subscribeWithSelector((set, get) => ({
      // État
      aircraftList: [],
      selectedAircraftId: null,
      isLoading: false,
      isInitialized: false,
      error: null,
      lastSync: null,

    // Charger les avions depuis Supabase
    loadFromSupabase: async () => {
            set({ isLoading: true, error: null });

      try {
        const presets = await communityService.getAllPresets();

        if (!presets || presets.length === 0) {
          const errorMsg = '⚠️ Aucun avion trouvé dans la base Supabase';
                    set({
            aircraftList: [],
            selectedAircraftId: null,
            isLoading: false,
            isInitialized: true,
            error: errorMsg,
            lastSync: new Date().toISOString()
          });
          return [];
        }

        // 🔧 Importer la fonction de conversion AVANT le .map()
        const { convertAircraftUnits } = await import('@utils/aircraftNormalizer');

        // Transformer les presets en format avion
        const aircraftList = presets.map(preset => {
          // Utiliser aircraftData directement s'il existe
          const aircraft = preset.aircraftData ? {
            ...preset.aircraftData,
            id: preset.id,
            aircraftId: preset.id,
            // Propriétaire (colonne submitted_by) : nécessaire pour décider
            // UPDATE-en-place vs CLONE possédé, et pour la dédup ci-dessous.
            submitted_by: preset.addedBy || null,
            // 🔧 FIX: Propager hasManex depuis le preset (n'est pas dans aircraftData)
            hasManex: preset.hasManex || false,
            // Propage le flag rapport de pesée (si aircraftData contient
            // weighingReport, la base64 est trop lourde — on conserve un flag
            // et le contenu sera rechargé via IndexedDB au moment de l'édition).
            hasWeighingReport: !!(preset.aircraftData?.weighingReport?.hasData)
          } : {
            id: preset.id,
            aircraftId: preset.id,
            submitted_by: preset.addedBy || null,
            registration: preset.registration,
            model: preset.model,
            manufacturer: preset.manufacturer,
            aircraftType: preset.type || preset.aircraftType,
            category: preset.category,
            hasManex: preset.hasManex || false,
            hasWeighingReport: false
          };

          // 🔧 FIX: Mapper weights.emptyWeight → emptyWeight pour les anciens avions
          // Les avions créés avant la correction ont weights.emptyWeight mais pas emptyWeight
          if (!aircraft.emptyWeight && aircraft.weights?.emptyWeight) {
            aircraft.emptyWeight = parseFloat(aircraft.weights.emptyWeight);
            console.log(`✅ [AircraftStore] Mapped weights.emptyWeight → emptyWeight for ${aircraft.registration}: ${aircraft.emptyWeight} kg`);
          }
          if (!aircraft.maxTakeoffWeight && aircraft.weights?.mtow) {
            aircraft.maxTakeoffWeight = parseFloat(aircraft.weights.mtow);
          }

          // ═══════════════════════════════════════════════════════════════
          // CONVENTION : LES DONNÉES EN MÉMOIRE SONT TOUJOURS EN CANONIQUE
          // ═══════════════════════════════════════════════════════════════
          // Supabase = canonique. App state = canonique. IndexedDB = canonique.
          // La conversion vers les unités utilisateur se fait UNIQUEMENT au
          // rendu UI via le helper `unitsDisplay.js`.
          //
          // → AUCUNE conversion automatique ici.
          //
          // Migration légère : si l'avion vient d'un ancien _metadata.units
          // NON-canonique (ex: ancien export en gph), on le convertit UNE FOIS
          // vers canonique avant de l'écrire en state. Sinon on laisse tel quel.
          let processedAircraft = aircraft;
          const meta = aircraft._metadata?.units;
          const isLegacyNonCanonical = meta && (
            (meta.fuel && meta.fuel !== 'ltr') ||
            (meta.fuelConsumption && meta.fuelConsumption !== 'lph') ||
            (meta.weight && meta.weight !== 'kg') ||
            (meta.armLength && meta.armLength !== 'mm') ||
            (meta.speed && meta.speed !== 'kt')
          );
          if (isLegacyNonCanonical) {
            console.warn('🔁 [AircraftStore] Avion en unités legacy non-canoniques, migration one-shot vers canonique:', {
              registration: aircraft.registration,
              from: meta
            });
            const canonicalUnits = {
              fuel: 'ltr', fuelConsumption: 'lph', weight: 'kg',
              armLength: 'mm', speed: 'kt', altitude: 'ft', distance: 'nm'
            };
            processedAircraft = convertAircraftUnits(aircraft, meta, canonicalUnits);
            // Mettre à jour le tag pour ne plus migrer la prochaine fois
            processedAircraft._metadata = { ...aircraft._metadata, units: canonicalUnits };
          }

          // Valider et réparer. quiet:true → ce sont des SQUELETTES de liste (sans
          // aircraft_data) ; on évite le mur d'avertissements « M&C indisponibles »
          // (normaux ici : les vraies données arrivent à l'ouverture de l'avion).
          const validated = validateAndRepairAircraft(processedAircraft, { quiet: true });

          return validated;
        });


        // 🔧 FIX: Ne PAS télécharger automatiquement les MANEX au démarrage
        // Les MANEX seront téléchargés à la demande (quand l'utilisateur clique sur le bouton)
        // Cela améliore les performances au démarrage et évite de télécharger des fichiers inutiles
        const aircraftWithManex = aircraftList.filter(a => a.hasManex);
        if (aircraftWithManex.length > 0) {
          console.log('ℹ️ [AircraftStore] MANEX disponibles pour:', aircraftWithManex.map(a => a.registration).join(', '));
          console.log('💡 [AircraftStore] Les MANEX seront téléchargés à la demande (clic sur bouton MANEX)');
        }

        // 🧹 Dédup par immatriculation (modèle « clone possédé ») : la ligne
        // communautaire d'origine et ta copie possédée coexistent en base. On
        // n'affiche qu'UNE entrée par immat — TOUJOURS (même si la session n'est
        // pas encore prête), pour éviter d'éditer la mauvaise ligne → clones en
        // cascade. La copie possédée gagne quand l'utilisateur est connu.
        let finalList = aircraftList;
        try {
          const myUid = await getCurrentUserId();
          finalList = dedupeAircraftByRegistration(aircraftList, myUid);
          if (finalList.length !== aircraftList.length) {
            console.log(`🧹 [AircraftStore] Dédup immatriculation : ${aircraftList.length} → ${finalList.length} (uid ${myUid ? 'connu' : 'inconnu'})`);
          }
        } catch (dedupErr) {
          console.warn('[AircraftStore] Dédup ignorée:', dedupErr?.message);
          finalList = aircraftList;
        }

        set({
          aircraftList: finalList,
          selectedAircraftId: finalList[0]?.id || null,
          isLoading: false,
          isInitialized: true,
          error: null,
          lastSync: new Date().toISOString()
        });

        return finalList;
      } catch (error) {
        const errorMessage = `❌ ERREUR CONNEXION SUPABASE: ${error.message}`;
        console.error(errorMessage, error);

        set({
          aircraftList: [],
          selectedAircraftId: null,
          isLoading: false,
          isInitialized: true,
          error: errorMessage,
          lastSync: null
        });

        throw error;
      }
    },

    // Recharger depuis Supabase
    refreshFromSupabase: async () => {
            return get().loadFromSupabase();
    },

    // Sélectionner un avion
    setSelectedAircraft: (aircraft) => {
      logger.debug('setSelectedAircraft called with:', aircraft);
      set({ selectedAircraftId: aircraft?.id || null });
    },

    // Ajouter un avion (soumettre à Supabase)
    addAircraft: async (aircraftData) => {
            set({ isLoading: true, error: null });

      try {
        // 🔧 DEBUG: Vérifier les performanceTables reçues
        console.log('🔍 [AircraftStore.addAircraft] Données reçues:', {
          registration: aircraftData.registration,
          hasPerformanceTables: !!aircraftData.performanceTables,
          performanceTablesCount: aircraftData.performanceTables?.length || 0,
          performanceTablesTypes: aircraftData.performanceTables?.map(t => t.type) || [],
          hasAdvancedPerformance: !!aircraftData.advancedPerformance,
          advancedPerformanceTablesCount: aircraftData.advancedPerformance?.tables?.length || 0,
          advancedPerformanceTypes: aircraftData.advancedPerformance?.tables?.map(t => t.type) || []
        });

        // Valider les données
        const validatedAircraft = validateAndRepairAircraft(aircraftData);

        // Récupérer les préférences d'unités de l'utilisateur
        const userUnits = useUnitsStore.getState().units;

        // ═══════════════════════════════════════════════════════════════
        // CONVENTION : LES DONNÉES EN MÉMOIRE SONT TOUJOURS EN CANONIQUE
        // ═══════════════════════════════════════════════════════════════
        // Les valeurs en state local sont supposées EN CANONIQUE déjà
        // (toutes les saisies utilisateur passent par useEditableValue qui
        // convertit vers canonique avant écriture). Donc à l'envoi vers
        // Supabase, AUCUNE conversion supplémentaire n'est nécessaire.
        //
        // On ajoute juste le tag _metadata.units = CANONIQUE pour signaler
        // explicitement le format aux autres clients.
        const normalizedAircraft = {
          ...validatedAircraft,
          _metadata: {
            version: '2.0.0',
            units: {
              fuel: 'ltr', fuelConsumption: 'lph', weight: 'kg',
              armLength: 'mm', speed: 'kt', altitude: 'ft', distance: 'nm'
            },
            exportedAt: new Date().toISOString()
          }
        };

        console.log('📤 [AircraftStore] Normalized aircraft for Supabase (STORAGE units):', {
          registration: normalizedAircraft.registration,
          fuelConsumption: normalizedAircraft.fuelConsumption,
          fuelCapacity: normalizedAircraft.fuelCapacity,
          sourceUnits: userUnits,
          storageUnits: 'lph/ltr/kg/kt'
        });

        // Récupérer l'userId Supabase pour tagger la création
        const currentUserId = await getCurrentUserId();

        // Préparer les données pour Supabase (avec unités NORMALISÉES)
        const presetData = {
          id: aircraftData.id || aircraftData.aircraftId,  // 🔧 FIX: Passer l'ID pour détecter les variants
          registration: normalizedAircraft.registration,
          model: normalizedAircraft.model,
          manufacturer: normalizedAircraft.manufacturer || 'Inconnu',
          aircraft_type: normalizedAircraft.aircraftType || 'Avion',
          category: normalizedAircraft.category || 'SEP',
          aircraft_data: normalizedAircraft,  // Données normalisées (L, L/h, kg, kt) + _metadata
          description: `Configuration ${normalizedAircraft.model} - ${normalizedAircraft.registration}`,
          submitted_by: currentUserId,  // null = anonyme/non authentifié (les RLS doivent filtrer)
          isVariant: aircraftData.isVariant || false  // 🔧 FIX: Flag variant
        };

        // Résoudre le MANEX (fichier uploadable) pour le persister dans Supabase Storage
        // + lier manex_file_id sur la ligne. Sans ça : has_manex sans fichier → MANEX perdu.
        const manexResolved = (normalizedAircraft.hasManex || normalizedAircraft.manex)
          ? await resolveManexFile({ ...normalizedAircraft, id: aircraftData.id || aircraftData.aircraftId })
          : null;

        // Soumettre à Supabase — modèle « fiche unique partagée » : submitPreset
        // met à jour la fiche existante EN PLACE (par immatriculation) ou la crée
        // si elle n'existe pas. PLUS de clone (plus de doublon).
        const result = await communityService.submitPreset(
          presetData,
          manexResolved?.blob || null,
          currentUserId
        );

        console.log('✅ [AircraftStore] Preset créé dans Supabase:', result?.id);
        console.log('🔍 [AircraftStore] Result complet:', {
          hasResult: !!result,
          hasId: !!result?.id,
          id: result?.id,
          registration: result?.registration
        });

        // 🔧 FIX: Optimistic update - Ajouter l'avion à la liste locale IMMÉDIATEMENT
        // Cela permet à l'UI de se mettre à jour instantanément sans attendre le rechargement
        if (result && result.id) {
          const state = get();

          // Créer l'objet avion pour la liste locale (en STORAGE units)
          // La conversion vers USER units se fera automatiquement via format() lors de l'affichage
          // 🔧 IMPORTANT: Filtrer les données volumineuses (photo, manex, weighingReport)
          // pour la liste légère — elles sont rechargées à la demande depuis IndexedDB.
          const { photo, profilePhoto, manex, weighingReport, ...lightAircraft } = normalizedAircraft;

          const newAircraft = {
            ...lightAircraft,
            id: result.id,
            aircraftId: result.id,
            // Owner (pour dédup + remplacement silencieux de la version communautaire)
            submitted_by: result.submitted_by || currentUserId,
            // 🔧 FIX: Ajouter les flags pour le chargement des données volumineuses depuis IndexedDB
            hasPhoto: !!(photo || profilePhoto),
            hasManex: !!manex,
            hasWeighingReport: !!weighingReport,
            _metadata: {
              ...normalizedAircraft._metadata,
              supabaseId: result.id
            }
          };

          // 🔧 FIX: Vérifier si l'avion existe déjà dans la liste (éviter doublons)
          // Vérifier DEUX critères : ID ET registration
          const existingByIdIndex = state.aircraftList.findIndex(a => a.id === newAircraft.id);
          const existingByRegIndex = state.aircraftList.findIndex(a =>
            a.registration &&
            newAircraft.registration &&
            a.registration.trim().toUpperCase() === newAircraft.registration.trim().toUpperCase()
          );

          let newList;

          // Cas 1: Même ID → Mise à jour (modification d'un preset existant)
          if (existingByIdIndex >= 0) {
            newList = [...state.aircraftList];
            newList[existingByIdIndex] = newAircraft;
            console.log('🔄 [AircraftStore] Avion mis à jour dans la liste locale (même ID):', {
              id: newAircraft.id,
              registration: newAircraft.registration,
              listLength: newList.length
            });
          }
          // Cas 2: Même registration mais ID différent → DOUBLON détecté !
          else if (existingByRegIndex >= 0) {
            const existing = state.aircraftList[existingByRegIndex];
            const existingIsMine = !!currentUserId && existing.submitted_by === currentUserId;

            // Modèle « clone possédé » : si l'existant est la version COMMUNAUTAIRE
            // (pas à moi), ma copie possédée la remplace SILENCIEUSEMENT — c'est le
            // comportement attendu, pas un doublon initié par l'utilisateur. On ne
            // demande confirmation QUE pour un vrai conflit entre DEUX copies à moi.
            const shouldReplace = existingIsMine
              ? confirm(
                  `Un avion avec l'immatriculation "${newAircraft.registration}" existe déjà dans votre liste.\n\n` +
                  `Voulez-vous le remplacer par cette nouvelle version ?\n\n` +
                  `✓ OUI : Remplacer l'avion existant\n` +
                  `✗ NON : Annuler l'ajout (garder l'ancien)`
                )
              : true;

            if (shouldReplace) {
              // Remplacer l'ancien par le nouveau
              newList = [...state.aircraftList];
              newList[existingByRegIndex] = newAircraft;
              console.log('🔄 [AircraftStore] Avion remplacé (même registration):', {
                oldId: existing.id,
                newId: newAircraft.id,
                registration: newAircraft.registration,
                silencieux: !existingIsMine,
                listLength: newList.length
              });

              // Supprimer l'ancien de IndexedDB si l'ID a changé
              try {
                if (existing.id && existing.id !== newAircraft.id) {
                  const dataBackupManager = await import('@utils/dataBackupManager').then(m => m.default);
                  await dataBackupManager.deleteAircraftData(existing.id);
                  console.log('🗑️ [AircraftStore] Ancien avion supprimé de IndexedDB:', existing.id);
                }
              } catch (error) {
                console.error('❌ [AircraftStore] Erreur suppression ancien avion:', error);
              }
            } else {
              // Annuler l'ajout - garder la liste actuelle
              console.log('❌ [AircraftStore] Ajout annulé par l\'utilisateur (doublon)');
              return null; // Retourner null pour signaler l'annulation
            }
          }
          // Cas 3: Nouvel avion (pas de doublon)
          else {
            newList = [...state.aircraftList, newAircraft];
            console.log('✅ [AircraftStore] Avion ajouté à la liste locale (STORAGE units):', {
              id: newAircraft.id,
              registration: newAircraft.registration,
              listLength: newList.length
            });
          }

          // 🔧 Si l'utilisateur a annulé (doublon refusé), arrêter ici
          if (!newList) {
            set({ isLoading: false, error: null });
            return null;
          }

          set({
            aircraftList: newList,
            isLoading: false,
            error: null
          });

          // 🔧 FIX CRITIQUE: Sauvegarder dans IndexedDB en STORAGE units (ltr/lph/kg/kt)
          // IMPORTANT: Sauvegarder normalizedAircraft (avec photo/manex) PAS newAircraft (sans photo)
          try {
            const dataBackupManager = await import('@utils/dataBackupManager').then(m => m.default);
            const storageAircraft = {
              ...normalizedAircraft,  // ✅ normalizedAircraft contient photo + manex
              id: result.id,
              aircraftId: result.id,
              _metadata: {
                ...normalizedAircraft._metadata,
                supabaseId: result.id,
                savedAt: new Date().toISOString(),
                storageFormat: 'STORAGE_UNITS (ltr/lph/kg/kt)'
              }
            };
            await dataBackupManager.saveAircraftData(storageAircraft);
            console.log('✅ [AircraftStore] Avion sauvegardé dans IndexedDB (STORAGE units):', storageAircraft.registration);
          } catch (error) {
            console.error('❌ [AircraftStore] Erreur sauvegarde IndexedDB:', error);
          }

          // 🔧 FIX: Ne PAS recharger depuis Supabase pour éviter les doublons
          // L'optimistic update suffit. Si besoin de sync, l'utilisateur peut rafraîchir manuellement
          console.log('ℹ️ [AircraftStore] Optimistic update appliqué - Pas de rechargement auto pour éviter doublons');

          // 🔧 FIX: Retourner l'avion complet (newAircraft) au lieu de juste result
          // Pour que le wizard puisse sélectionner l'avion après ajout
          return newAircraft;
        } else {
          console.error('❌ [AircraftStore] Impossible d\'ajouter à la liste - result invalide:', {
            hasResult: !!result,
            hasId: !!result?.id,
            result: result
          });
          // Si pas de result.id, on recharge quand même pour récupérer l'avion
          console.warn('⚠️ [AircraftStore] Pas d\'ID retourné - Rechargement Supabase nécessaire');
          await get().loadFromSupabase();
          return null;
        }
      } catch (error) {
        const errorMessage = `❌ Erreur lors de l'ajout: ${error.message}`;
        console.error(errorMessage, error);
        // Bandeau persistant — survit aux reloads/HMR/navigation
        recordSupabaseError('addAircraft', error, {
          registration: aircraftData?.registration,
          model: aircraftData?.model
        });
        set({ isLoading: false, error: errorMessage });
        throw error;
      }
    },

    // Mettre à jour un avion (soumettre à Supabase)
    updateAircraft: async (aircraftData) => {
      set({ isLoading: true, error: null });

      try {
        const state = get();
        const index = state.aircraftList.findIndex(a => a.id === aircraftData.id);

        if (index === -1) {
          set({ isLoading: false, error: 'Avion non trouvé' });
          return null;
        }

        // 1. Valider les données
        const validatedAircraft = validateAndRepairAircraft(aircraftData);

        // 2. Mettre à jour localement d'abord (optimistic update)
        const newList = [...state.aircraftList];
        newList[index] = validatedAircraft;
        set({ aircraftList: newList, isLoading: false });

        // 2bis. 🔧 FIX CRITIQUE (bug A) : persister AUSSI dans IndexedDB, indépendamment de Supabase.
        // IndexedDB est la source de vérité au boot ; sans cette écriture, toute édition d'un avion
        // existant (masse à vide, capacité carburant, réservoirs) était PERDUE au reload — car le bloc
        // Supabase ci-dessous rethrow sans session (RLS) et rien n'était écrit en local.
        // saveAircraftData fait un put() (upsert par id) → pas de doublon. Symétrique d'addAircraft.
        try {
          const dataBackupManager = await import('@utils/dataBackupManager').then(m => m.default);
          const storageAircraft = {
            ...validatedAircraft,
            aircraftId: validatedAircraft.id,
            _metadata: {
              ...validatedAircraft._metadata,
              savedAt: new Date().toISOString(),
              storageFormat: 'STORAGE_UNITS (ltr/lph/kg/kt)'
            }
          };
          await dataBackupManager.saveAircraftData(storageAircraft);
          console.log('✅ [AircraftStore] Avion mis à jour dans IndexedDB (STORAGE units):', storageAircraft.registration);
        } catch (idbError) {
          console.error('❌ [AircraftStore] Erreur sauvegarde IndexedDB (update):', idbError);
        }

        // 3. Persister dans Supabase — modèle « FICHE UNIQUE PARTAGÉE » (prototype).
        // On ÉCRASE la fiche existante EN PLACE (UPDATE), quel que soit le
        // propriétaire — PLUS de clone (donc plus de doublon : une seule fiche
        // par avion). ⚠️ Suppose que la policy RLS UPDATE de community_presets a été
        // OUVERTE (voir supabase-prototype-open-write.sql). Sinon l'UPDATE touche
        // 0 ligne → erreur explicite (les modifs restent locales en attendant).
        const currentUserId = await getCurrentUserId(); // peut être null (RLS ouverte → OK)

        // Résoudre le MANEX (fichier uploadable) pour le réattacher à la fiche.
        const manexResolved = (validatedAircraft.hasManex || validatedAircraft.manex)
          ? await resolveManexFile(validatedAircraft)
          : null;

        try {
          console.log('📤 [updateAircraft] UPDATE en place (fiche partagée):', validatedAircraft.registration);
          await communityService.updateCommunityPreset(
            validatedAircraft.id,
            validatedAircraft,
            manexResolved?.blob || null,
            manexResolved?.fileName || null,
            currentUserId
          );
          console.log('✅ [updateAircraft] Fiche Supabase écrasée en place avec succès');
          return validatedAircraft;
        } catch (supabaseError) {
          const blockedByRls = supabaseError?.code === 'UPDATE_NO_ROWS';
          console.error('🚨 [updateAircraft] ÉCHEC UPDATE Supabase — modifications LOCALES uniquement:', supabaseError);
          recordSupabaseError('updateAircraft', supabaseError, {
            aircraftId: validatedAircraft.id,
            registration: validatedAircraft.registration,
            model: validatedAircraft.model
          });
          set({
            error: blockedByRls
              ? '⚠ La base refuse l\'écrasement de cette fiche (RLS). Applique supabase-prototype-open-write.sql dans Supabase pour autoriser la mise à jour en place. Tes modifications restent locales pour l\'instant.'
              : `⚠ Sauvegarde Supabase échouée : ${supabaseError.message || 'erreur inconnue'}. Tes modifications sont uniquement locales pour l'instant.`
          });
          throw supabaseError;
        }
      } catch (error) {
        const errorMessage = `❌ Erreur lors de la mise à jour: ${error.message}`;
        console.error(errorMessage, error);
        set({ isLoading: false, error: errorMessage });
        return null;
      }
    },

    // Mettre à jour / supprimer le MANEX d'un avion (utilisé par ManexImporter).
    // Persiste la copie locale (IndexedDB) puis délègue à updateAircraft pour
    // l'upload Supabase Storage + le lien manex_file_id sur la ligne possédée.
    updateAircraftManex: async (aircraftId, manexData) => {
      const state = get();
      const aircraft = state.aircraftList.find(a => a.id === aircraftId);
      if (!aircraft) {
        console.warn('[AircraftStore] updateAircraftManex: avion introuvable', aircraftId);
        return null;
      }
      try {
        const dbm = await import('@utils/dataBackupManager').then(m => m.default);
        const full = (await dbm.getAircraftData(aircraftId)) || { ...aircraft };
        const updated = { ...full, hasManex: !!manexData };
        if (manexData) updated.manex = manexData; else delete updated.manex;
        await dbm.saveAircraftData(updated);
      } catch (e) {
        console.error('[AircraftStore] updateAircraftManex: IndexedDB échoué', e?.message);
      }
      // Persister vers Supabase (upload + lien manex_file_id) via le chemin unique updateAircraft.
      return get().updateAircraft({ ...aircraft, manex: manexData || null, hasManex: !!manexData });
    },

    // Supprimer un avion
    deleteAircraft: async (id) => {
            set({ isLoading: true, error: null });

      try {
        const state = get();
        const aircraft = state.aircraftList.find(a => a.id === id);

        if (!aircraft) {
                    set({ isLoading: false });
          return false;
        }

        // 1. Supprimer de la liste locale immédiatement (optimistic update)
        const newList = state.aircraftList.filter(a => a.id !== id);
        const newSelectedId = state.selectedAircraftId === id
          ? (newList[0]?.id || null)
          : state.selectedAircraftId;

        set({
          aircraftList: newList,
          selectedAircraftId: newSelectedId,
          isLoading: false
        });

        
        // 2. ❌ NE PAS supprimer de Supabase — SUPPRESSION LOCALE UNIQUEMENT.
        // Choix prototype (demande explicite) : le bouton « Supprimer » retire
        // l'avion de la liste locale (+ cache IndexedDB ci-dessous) mais CONSERVE
        // la fiche dans Supabase. Donc un avion retiré revient au prochain
        // rechargement / réimport → IMPOSSIBLE de perdre des données cloud par ce
        // bouton (c'était la cause de la perte des 4 avions).
        // → Pour supprimer DÉFINITIVEMENT du cloud : le faire depuis le dashboard
        //   Supabase (ou via une action dédiée explicite si on en ajoute une plus tard).
        console.log('🗑️ [AircraftStore] Suppression LOCALE uniquement — fiche Supabase conservée:', id);

        // 3. Supprimer les données volumineuses d'IndexedDB (photo, manex)
        try {
          const { default: dataBackupManager } = await import('@utils/dataBackupManager');
          await dataBackupManager.deleteAircraftData(id);
        } catch (error) {
          console.warn('[AircraftStore] deleteAircraft — purge IndexedDB échouée (non bloquante):', error?.message);
        }

        return true;
      } catch (error) {
        const errorMessage = `❌ Erreur lors de la suppression: ${error.message}`;
        console.error(errorMessage, error);
        set({ isLoading: false, error: errorMessage });
        return false;
      }
    },

    // Actions compatibles avec l'ancien système
    importAircraftList: (list) => {

      set({
        aircraftList: list,
        selectedAircraftId: list[0]?.id || null
      });
    },

    resetToDefault: async () => {
            return get().loadFromSupabase();
    },

    // Getter pour l'avion sélectionné
    get selectedAircraft() {
      const state = get();
      // 🔧 FIX: Protection contre rehydratation - state peut être undefined/incomplet
      if (!state || !state.aircraftList) {
        return null;
      }
      const id = state.selectedAircraftId;
      let aircraft = state.aircraftList.find(a => a.id === id) || null;

      if (aircraft) {
        aircraft = validateAndRepairAircraft(aircraft);
      }

      return aircraft;
    }
  }))
);

// Fonction d'initialisation automatique
let isInitializing = false;

export const initializeAircraftStore = async () => {
  if (isInitializing) {
        return;
  }

  isInitializing = true;

  try {
    await useAircraftStore.getState().loadFromSupabase();
      } catch (error) {
    console.error('❌ Échec de l\'initialisation:', error);
    throw error;
  } finally {
    isInitializing = false;
  }
};

// 🔧 LISTENER : Reconvertir les avions quand les préférences d'unités changent
// Cela garantit que les valeurs affichées sont TOUJOURS dans les unités préférées
let unitsSubscription = null;

if (typeof window !== 'undefined') {
  // Souscrire aux changements de préférences d'unités
  unitsSubscription = useUnitsStore.subscribe(
    (state) => state.units,
    async (newUnits, prevUnits) => {
      // Vérifier si les unités ont vraiment changé
      const unitsChanged =
        newUnits.fuel !== prevUnits.fuel ||
        newUnits.fuelConsumption !== prevUnits.fuelConsumption ||
        newUnits.weight !== prevUnits.weight ||
        newUnits.speed !== prevUnits.speed;

      if (unitsChanged) {
        console.log('🔄 [AircraftStore] Units preferences changed - Reconverting aircraft...', {
          from: prevUnits,
          to: newUnits
        });

        // Recharger tous les avions depuis Supabase avec les nouvelles unités
        const aircraftStore = useAircraftStore.getState();
        if (aircraftStore.isInitialized) {
          try {
            await aircraftStore.loadFromSupabase();
            console.log('✅ [AircraftStore] Aircraft reconverted to new units');
          } catch (error) {
            console.error('❌ [AircraftStore] Failed to reconvert aircraft:', error);
          }
        }
      }
    }
  );
}

// 🔧 HELPER: Corriger la masse à vide de F-HSTR
export const fixFHSTREmptyWeight = async () => {
  try {
    console.log('🔧 Correction de la masse à vide de F-HSTR...');

    const state = useAircraftStore.getState();
    const fhstr = state.aircraftList.find(a => a.registration === 'F-HSTR');

    if (!fhstr) {
      console.error('❌ F-HSTR non trouvé dans le store');
      return false;
    }

    console.log('📋 Masse à vide actuelle:', fhstr.weights?.emptyWeight || fhstr.emptyWeight);

    // Corriger la masse à vide
    const updatedFHSTR = {
      ...fhstr,
      weights: {
        ...fhstr.weights,
        emptyWeight: '900'
      },
      emptyWeight: '900' // pour rétrocompatibilité
    };

    // Utiliser updateAircraft pour sauvegarder dans Supabase
    const result = await useAircraftStore.getState().updateAircraft(updatedFHSTR);

    if (result) {
      console.log('✅ F-HSTR corrigé avec succès - Nouvelle masse à vide: 900 kg');
      return true;
    } else {
      console.error('❌ Échec de la correction');
      return false;
    }
  } catch (error) {
    console.error('❌ Erreur lors de la correction de F-HSTR:', error);
    return false;
  }
};

// 🧹 Nettoyage one-shot des DOUBLONS POSSÉDÉS (modèle « clone possédé »).
// Pour chaque immatriculation, garde la copie la plus récente et supprime les
// autres copies POSSÉDÉES (jamais les lignes d'autrui). Aperçu d'abord, puis exec.
// Usage console :
//   await window.alflightCleanupDuplicates()                  → APERÇU (ne supprime rien)
//   await window.alflightCleanupDuplicates({ execute: true }) → SUPPRIME réellement
export const cleanupOwnedAircraftDuplicates = async ({ execute = false } = {}) => {
  const uid = await getCurrentUserId();
  if (!uid) {
    console.error('❌ [Cleanup] Connexion requise (les doublons sont identifiés par propriétaire).');
    return null;
  }
  const res = await communityService.cleanupOwnedDuplicates(uid, { dryRun: !execute });
  if (!execute) {
    console.log(`ℹ️ [Cleanup] APERÇU : ${res.toDeleteCount} doublon(s) possédé(s) à supprimer (sur ${res.totalOwned} lignes, ${res.registrations} immat).`);
    if (res.toDelete?.length) console.table(res.toDelete);
    console.log('➡️ Pour supprimer réellement : await window.alflightCleanupDuplicates({ execute: true })');
  } else {
    console.log(`✅ [Cleanup] ${res.deleted} doublon(s) supprimé(s). Rechargement de la liste…`);
    try { await useAircraftStore.getState().loadFromSupabase(); } catch (e) { console.warn(e?.message); }
  }
  return res;
};

if (typeof window !== 'undefined') {
  window.alflightCleanupDuplicates = cleanupOwnedAircraftDuplicates;
  console.log('🧹 [AircraftStore] window.alflightCleanupDuplicates() prêt — aperçu par défaut, {execute:true} pour supprimer');
}

// 🔎 DIAGNOSTIC : que reste-t-il dans Supabase vs IndexedDB vs backups ?
// Usage : await window.alflightDiagnose()
export const alflightDiagnose = async () => {
  const dbm = await import('@utils/dataBackupManager').then(m => m.default);
  let supa = [];
  try { supa = await communityService.getAllPresets(); } catch (e) { console.warn('[Diagnose] getAllPresets:', e?.message); }
  let idb = [];
  try { idb = (await dbm.getAllFromStore('aircraftData')) || []; } catch (e) { console.warn('[Diagnose] IndexedDB:', e?.message); }
  let backups = [];
  try { backups = (await dbm.getAllBackups()) || []; } catch (_) { /* pas de backups */ }

  const supaRegs = supa.map(p => p.registration);
  const supaUpper = supaRegs.map(x => (x || '').toUpperCase());
  const idbRows = idb.map(a => ({
    reg: a.registration, id: a.id,
    hasArms: !!(a.arms || a.weightBalance),
    hasWeights: !!(a.emptyWeight || a.weights?.emptyWeight),
    hasManex: !!a.manex,
    lastModified: a.lastModified
  }));
  const missing = [...new Set(idbRows
    .filter(r => r.reg && !supaUpper.includes((r.reg || '').toUpperCase()))
    .map(r => r.reg))];

  console.log(`🔎 [Diagnose] SUPABASE (${supa.length}) :`, supaRegs);
  console.log(`🔎 [Diagnose] INDEXEDDB (${idb.length}) :`);
  console.table(idbRows);
  console.log(`🔎 [Diagnose] BACKUPS (auto/manuels) : ${backups.length}`);
  console.log('🔎 [Diagnose] En IndexedDB mais ABSENTS de Supabase (récupérables) :', missing);
  return { supabase: supaRegs, supabaseCount: supa.length, indexedDB: idbRows, indexedDBCount: idb.length, backupsCount: backups.length, missingFromSupabase: missing };
};

// 🛟 RÉCUPÉRATION : ré-uploade vers Supabase les avions présents en IndexedDB
// mais ABSENTS de Supabase (1 par immat, le plus complet/récent). Aperçu par défaut.
// Usage : await window.alflightRestoreAircraft()  puis  ({ execute: true })
export const alflightRestoreAircraft = async ({ execute = false } = {}) => {
  const dbm = await import('@utils/dataBackupManager').then(m => m.default);
  const userId = await getCurrentUserId();
  let supa = [];
  try { supa = await communityService.getAllPresets(); } catch (_) { /* vide */ }
  const supaRegs = new Set(supa.map(p => (p.registration || '').toUpperCase()));
  let idb = [];
  try { idb = (await dbm.getAllFromStore('aircraftData')) || []; } catch (_) { /* vide */ }

  const cand = idb.filter(a => a.registration && !supaRegs.has(a.registration.toUpperCase()));
  // 1 par immat : le plus complet (arms/weights) puis le plus récent
  const score = (a) => (a.arms || a.weightBalance ? 2 : 0) + (a.emptyWeight || a.weights?.emptyWeight ? 1 : 0);
  const byReg = new Map();
  for (const a of cand) {
    const k = a.registration.toUpperCase();
    const cur = byReg.get(k);
    if (!cur) { byReg.set(k, a); continue; }
    const better = score(a) > score(cur) ||
      (score(a) === score(cur) && new Date(a.lastModified || 0) > new Date(cur.lastModified || 0));
    if (better) byReg.set(k, a);
  }
  const toRestore = [...byReg.values()];
  const summary = { execute, toRestore: toRestore.map(a => a.registration), count: toRestore.length };
  if (!execute || toRestore.length === 0) {
    console.log('🛟 [Restore] APERÇU (relance avec { execute: true } pour ré-uploader) :', summary);
    return summary;
  }

  const restored = [];
  for (const a of toRestore) {
    try {
      const manex = (a.manex && (a.manex.pdfData || a.manex.file)) ? await resolveManexFile(a) : null;
      const r = await communityService.submitPreset(
        { ...a, aircraft_data: a, aircraftType: a.aircraftType || a.type },
        manex?.blob || null,
        userId
      );
      restored.push({ reg: a.registration, id: r?.id });
    } catch (e) { console.warn('🛟 [Restore] échec', a.registration, e?.message); }
  }
  summary.restored = restored;
  try { await useAircraftStore.getState().loadFromSupabase(); } catch (_) { /* ignore */ }
  console.log('🛟 [Restore] terminé :', summary);
  return summary;
};

if (typeof window !== 'undefined') {
  window.alflightDiagnose = alflightDiagnose;
  window.alflightRestoreAircraft = alflightRestoreAircraft;
  console.log('🔎 [AircraftStore] window.alflightDiagnose() / window.alflightRestoreAircraft() prêts');
}

// Sélecteurs optimisés
export const aircraftSelectors = {
  useAircraftList: () => useAircraftStore(state => state.aircraftList),

  useSelectedAircraft: () => useAircraftStore(state => {
    const id = state.selectedAircraftId;
    return state.aircraftList.find(a => a.id === id) || null;
  }),

  useSelectedAircraftId: () => useAircraftStore(state => state.selectedAircraftId),

  useAircraftById: (id) => useAircraftStore(
    state => state.aircraftList.find(a => a.id === id)
  ),

  useIsLoading: () => useAircraftStore(state => state.isLoading),
  useError: () => useAircraftStore(state => state.error),
  useIsInitialized: () => useAircraftStore(state => state.isInitialized),

  useAircraftActions: () => useAircraftStore(
    state => ({
      setSelectedAircraft: state.setSelectedAircraft,
      addAircraft: state.addAircraft,
      updateAircraft: state.updateAircraft,
      deleteAircraft: state.deleteAircraft,
      loadFromSupabase: state.loadFromSupabase,
      refreshFromSupabase: state.refreshFromSupabase,
      resetToDefault: state.resetToDefault
    }),
    (a, b) => Object.is(a, b))
};
