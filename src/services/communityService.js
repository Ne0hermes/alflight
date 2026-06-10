// Service pour gérer les interactions avec la base de données communautaire Supabase
//
// IMPORTANT : on importe le SINGLETON `supabase` depuis lib/supabaseClient.js.
// Créer un second `createClient()` ici déclenche "Multiple GoTrueClient instances
// detected" et — surtout — empêche l'auto-refresh du JWT car la session est
// persistée sous une seule clé localStorage ; un second client ne réutilise pas
// les hooks de rafraîchissement automatique, d'où les 401 "JWT expired" sur
// community_presets quand l'app reste ouverte > 1h.

import { supabase } from '../lib/supabaseClient';
import { normalizeAircraftImport } from '@utils/aircraftNormalizer';

// 🛡️ ANTI-ÉCRASEMENT (data-safety). Une valeur "vide" = null / undefined / '' / [].
const isEmptyish = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

// Fusionne `incoming` (données du formulaire) PAR-DESSUS `base` (fiche Supabase
// ACTUELLE), SANS jamais remplacer une valeur existante par une valeur vide — ni
// par un 0 quand l'existant est un nombre non nul. Objectif : ne JAMAIS vider une
// donnée en base parce qu'un champ n'a pas été (re)chargé/saisi dans le wizard.
// Les VRAIES valeurs du formulaire gagnent ; les champs présents en base mais
// absents du formulaire sont conservés.
function deepMergeKeepExisting(base, incoming) {
  if (incoming === undefined) return base;
  if (incoming && typeof incoming === 'object' && !Array.isArray(incoming) &&
      base && typeof base === 'object' && !Array.isArray(base)) {
    const out = { ...base };
    for (const k of Object.keys(incoming)) {
      out[k] = deepMergeKeepExisting(base[k], incoming[k]);
    }
    return out;
  }
  // vide entrant alors que l'existant est renseigné → garder l'existant
  if (isEmptyish(incoming) && !isEmptyish(base)) return base;
  // 0 entrant alors que l'existant est un nombre non nul → garder l'existant
  if ((incoming === 0 || incoming === '0') && !isEmptyish(base) &&
      Number(base) !== 0 && !Number.isNaN(Number(base))) return base;
  return incoming;
}

/**
 * Service pour gérer les presets communautaires
 */
class CommunityService {
  /**
   * Récupérer tous les presets actifs
   * @returns {Promise<Array>} Liste des presets
   */
  async getAllPresets() {
    try {
      // 🔧 FIX MEMORY: Charger SEULEMENT les métadonnées, PAS aircraft_data !
      // aircraft_data peut contenir des photos en base64 (plusieurs MB par avion)
      // Charger aircraft_data complet uniquement lors de getPresetById()
      const presetsSelect = `
        id,
        registration,
        model,
        manufacturer,
        aircraft_type,
        category,
        submitted_by,
        submitted_at,
        downloads_count,
        votes_up,
        votes_down,
        verified,
        admin_verified,
        description,
        version,
        has_manex,
        status
      `;
      const runQuery = () => supabase
        .from('community_presets')
        .select(presetsSelect)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      let { data, error } = await runQuery();

      // PGRST303 = "JWT expired". Peut arriver si l'app était ouverte trop longtemps
      // ou rouverte après expiration sans qu'autoRefreshToken ait eu le temps de
      // tourner. On force un refresh puis on retry une fois.
      if (error && (error.code === 'PGRST303' || /jwt expired/i.test(error.message || ''))) {
        console.warn('⚠️ JWT expiré sur community_presets, refresh session puis retry…');
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.warn('⚠️ Refresh impossible :', refreshError.message);
        } else {
          ({ data, error } = await runQuery());
        }
      }

      if (error) {
        console.error('❌ Erreur Supabase:', error);
        throw error;
      }

      console.log(`✅ [CommunityService] Chargé ${data.length} presets (métadonnées seulement)`);

      // Transformer les données pour correspondre au format attendu
      return data.map(preset => {
        const mapped = {
          id: preset.id,
          registration: preset.registration,
          model: preset.model,
          manufacturer: preset.manufacturer,
          type: preset.aircraft_type,
          category: preset.category,
          addedBy: preset.submitted_by,
          dateAdded: preset.submitted_at,
          downloads: preset.downloads_count || 0,
          votes: {
            up: preset.votes_up || 0,
            down: preset.votes_down || 0
          },
          verified: preset.verified,
          adminVerified: preset.admin_verified,
          description: preset.description,
          // PAS de aircraftData ici - sera chargé à la sélection
          version: preset.version || 1,
          hasManex: preset.has_manex || false,
          // Flag pour indiquer que les données complètes doivent être chargées
          requiresFullDataLoad: true
        };

        return mapped;
      });
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des presets:', error);
      // Retourner un tableau vide au lieu de throw pour éviter le crash
      return [];
    }
  }

  /**
   * Rechercher des presets par immatriculation, modèle ou constructeur
   * @param {string} searchTerm
   * @returns {Promise<Array>}
   */
  async searchPresets(searchTerm) {
    try {
      const { data, error } = await supabase
        .from('presets_with_stats')
        .select('*')
        .or(`registration.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%,manufacturer.ilike.%${searchTerm}%`)
        .order('verified', { ascending: false })
        .order('net_votes', { ascending: false });

      if (error) throw error;

      return data.map(preset => ({
        id: preset.id,
        registration: preset.registration,
        model: preset.model,
        manufacturer: preset.manufacturer,
        type: preset.aircraft_type,
        verified: preset.verified,
        votes: {
          up: preset.votes_up,
          down: preset.votes_down
        }
      }));
    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
      throw error;
    }
  }

  /**
   * Récupérer un preset spécifique avec toutes ses données
   * @param {string} presetId
   * @returns {Promise<Object>}
   */
  async getPresetById(presetId) {
    try {
      const { data, error } = await supabase
        .from('community_presets')
        .select('*, manex_files(filename, file_path, file_size)')
        .eq('id', presetId)
        .single();

      if (error) throw error;

      // 🔧 FIX 2026-05 : on conserve TOUTES les photos à la lecture.
      // L'ancien seuil read=500KB / write=1MB causait un trou : toutes les
      // photos entre 500KB et 1MB étaient stockées sur Supabase mais jamais
      // affichées. Une photo de smartphone fait facilement 700-900KB en
      // base64 → invisible pour le pilote.
      // Le seuil de sécurité (write-side, 1MB) reste en place dans
      // submitPreset() pour éviter de gonfler la DB.
      const aircraftDataCopy = { ...data.aircraft_data };
      if (aircraftDataCopy.photo && typeof aircraftDataCopy.photo === 'string') {
        const photoSizeKB = (aircraftDataCopy.photo.length * 0.75) / 1024;
        console.log(`✅ Photo lue depuis Supabase (${photoSizeKB.toFixed(0)} KB)`);
      }

      // Retourner les données complètes de aircraft_data avec les métadonnées
      const fullAircraft = {
        ...aircraftDataCopy,
        // Ne PAS écraser les données de aircraft_data, les garder intactes
        // Les champs ci-dessous sont uniquement pour référence/tracking
        importedFromCommunity: true,
        communityPresetId: data.id,
        // 🔧 FIX: Propager hasManex depuis Supabase (n'est pas dans aircraft_data)
        hasManex: data.has_manex || false
      };

      // 🔧 FIX MEMORY LEAK: NE PAS télécharger automatiquement le MANEX
      // Le MANEX peut être très volumineux (10-50MB) et causer un crash "out of memory"
      // À la place, stocker seulement les métadonnées pour téléchargement différé
      if (data.has_manex && data.manex_files && data.manex_files.file_path) {
        console.log('📋 MANEX disponible - Métadonnées stockées pour téléchargement différé');
        // Ajouter les métadonnées du MANEX sans le télécharger
        fullAircraft.manexAvailableInSupabase = {
          fileName: data.manex_files.filename,
          filePath: data.manex_files.file_path,
          fileSize: data.manex_files.file_size
        };
        fullAircraft.hasManex = true;
      }

      // 🔧 FIX CRITIQUE: Forcer les métadonnées à STORAGE units
      // Supabase stocke TOUJOURS en lph/ltr/kg/kt (règle absolue)
      // Les métadonnées dans aircraft_data peuvent être incorrectes (legacy/corrupted)
      fullAircraft._metadata = {
        ...fullAircraft._metadata,
        units: {
          fuel: 'ltr',
          fuelConsumption: 'lph',
          weight: 'kg',
          speed: 'kt',
          distance: 'nm',
          altitude: 'ft',
          verticalSpeed: 'fpm'
        },
        loadedFromSupabase: true,
        storageFormat: 'STORAGE_UNITS (ltr/lph/kg/kt)'
      };

      // Normaliser les unités à l'import (aucune conversion car déjà en STORAGE units)
      const normalizedAircraft = normalizeAircraftImport(fullAircraft);

      console.log('📥 [CommunityService] Aircraft imported and normalized:', {
        registration: normalizedAircraft.registration,
        hadMetadata: !!fullAircraft._metadata,
        hasPhoto: !!normalizedAircraft.photo
      });

      return normalizedAircraft;
    } catch (error) {
      console.error('Erreur lors de la récupération du preset:', error);
      throw error;
    }
  }

  /**
   * Obtenir l'URL de téléchargement d'un MANEX
   * @param {string} filePath
   * @returns {string}
   */
  getManexDownloadUrl(filePath) {
    const { data } = supabase.storage
      .from('manex-files')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  /**
   * Télécharger le MANEX et le convertir en base64 (lazy loading)
   * Utilisé pour télécharger le MANEX seulement quand nécessaire
   * @param {string} filePath - Chemin du fichier dans Supabase Storage
   * @returns {Promise<Object>} Objet MANEX avec pdfData en base64
   */
  async downloadManexLazy(filePath) {
    try {
      console.log('📥 Téléchargement différé du MANEX:', filePath);

      // Télécharger le MANEX depuis Supabase Storage
      const manexBlob = await this.downloadManex(filePath);

      // Convertir le blob en base64
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(manexBlob);
      });

      console.log('✅ MANEX téléchargé et converti en base64');

      return {
        pdfData: base64Data,
        hasData: true,
        uploadedToSupabase: true,
        supabasePath: filePath
      };
    } catch (error) {
      console.error('❌ Erreur lors du téléchargement différé du MANEX:', error);
      throw error;
    }
  }

  /**
   * Enregistrer un téléchargement
   * @param {string} presetId
   * @param {string} userId
   */
  async recordDownload(presetId, userId = null) {
    try {
      await supabase
        .from('preset_downloads')
        .insert({ preset_id: presetId, user_id: userId });
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du téléchargement:', error);
      // Ne pas bloquer si ça échoue
    }
  }

  /**
   * Voter pour un preset
   * @param {string} presetId
   * @param {string} userId
   * @param {string} voteType - 'up' ou 'down'
   */
  async votePreset(presetId, userId, voteType) {
    try {
      // Vérifier si l'utilisateur a déjà voté
      const { data: existingVote } = await supabase
        .from('preset_votes')
        .select('*')
        .eq('preset_id', presetId)
        .eq('user_id', userId)
        .single();

      if (existingVote) {
        // Mettre à jour le vote existant
        const { error } = await supabase
          .from('preset_votes')
          .update({ vote_type: voteType })
          .eq('id', existingVote.id);

        if (error) throw error;
      } else {
        // Créer un nouveau vote
        const { error } = await supabase
          .from('preset_votes')
          .insert({ preset_id: presetId, user_id: userId, vote_type: voteType });

        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Erreur lors du vote:', error);
      throw error;
    }
  }

  /**
   * Récupérer le vote de l'utilisateur pour un preset
   * @param {string} presetId
   * @param {string} userId
   * @returns {Promise<string|null>} 'up', 'down' ou null
   */
  async getUserVote(presetId, userId) {
    try {
      const { data, error } = await supabase
        .from('preset_votes')
        .select('vote_type')
        .eq('preset_id', presetId)
        .eq('user_id', userId)
        .single();

      if (error) return null;
      return data?.vote_type || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Soumettre un nouveau preset (crée OU met à jour)
   * @param {Object} presetData
   * @param {File} manexFile
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async submitPreset(presetData, manexFile, userId) {
    try {
      
      // 1. Chercher les lignes existantes pour cette immatriculation.
      //    On récupère TOUTES les lignes actives + leur propriétaire afin de
      //    PRÉFÉRER la copie possédée par l'utilisateur courant (modèle « clone
      //    possédé »). Sans ça, l'ancienne heuristique « id fourni ≠ id trouvé →
      //    variant » prenait l'avion importé pour un variant et créait un NOUVEAU
      //    preset à CHAQUE envoi → doublons à l'infini.
      const { data: existingPresets, error: searchError } = await supabase
        .from('community_presets')
        .select('id, version, has_manex, submitted_by')
        .eq('registration', presetData.registration)
        .eq('status', 'active');

      if (searchError) {
        console.error('❌ Erreur lors de la recherche de presets existants:', searchError);
        throw searchError;
      }

      // 2. Si une ligne existe déjà, décider UPDATE (copie possédée d'abord) vs CREATE.
      if (existingPresets && existingPresets.length > 0) {
        // Modèle « fiche unique partagée » : viser la fiche correspondant à l'id
        // importé (mise à jour EN PLACE exacte) ; à défaut ma copie ; sinon la 1re.
        const existingPreset =
          existingPresets.find(p => presetData.id && p.id === presetData.id) ||
          existingPresets.find(p => userId && p.submitted_by === userId) ||
          existingPresets[0];

        // Variant = choix EXPLICITE de l'utilisateur (vraie copie, gérée en amont
        // avec une immatriculation DIFFÉRENTE — donc absente de cette recherche).
        // On ne déduit PLUS « variant » d'un écart d'id : l'id importé diffère
        // toujours de la copie possédée → c'était la source des doublons.
        const isVariant = presetData.isVariant === true;

        console.log('🔍 [CommunityService] Analyse preset existant:', {
          chosenId: existingPreset.id,
          chosenOwner: existingPreset.submitted_by,
          providedId: presetData.id,
          matchesActCount: existingPresets.length,
          ownedMatch: !!(userId && existingPreset.submitted_by === userId),
          finalIsVariant: isVariant
        });

        if (isVariant) {
          console.log('🔀 Variant explicite - Création d\'un nouveau preset');
          // Ne pas faire UPDATE, continuer vers CREATE
        } else {
          console.log('✅ Ligne existante - Mise à jour (copie possédée prioritaire)');
          if (manexFile) {
            console.log('📤 MANEX fourni — upload vers Supabase Storage (garantit présence du fichier)');
          }

          // Utiliser la méthode updateCommunityPreset existante
          return await this.updateCommunityPreset(
            existingPreset.id,
            presetData.aircraft_data || presetData,
            manexFile || null,
            manexFile?.name,
            userId
          );
        }
      }

      
      let manexFileId = null;

      // 3. Uploader le MANEX si fourni — chemin STABLE par immatriculation.
      // UN seul fichier par avion, écrasé via upsert → plus de dossiers en double
      // (modèle vs immat) ni d'accumulation horodatée.
      if (manexFile) {
        const reg = presetData.registration || 'aircraft';
        const fileName = `${reg} - manex.pdf`;
        const filePath = `${reg}/${fileName}`;

        // Upload vers Supabase Storage (upsert → écrase le fichier existant)
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('manex-files')
          .upload(filePath, manexFile, { cacheControl: '3600', upsert: true });

        if (uploadError) throw uploadError;

        // Enregistrer les métadonnées du fichier
        const { data: fileData, error: fileError } = await supabase
          .from('manex_files')
          .insert({
            filename: fileName,
            file_path: filePath,
            file_size: manexFile.size,
            uploaded_by: userId,
            aircraft_model: presetData.model
          })
          .select()
          .single();

        if (fileError) throw fileError;

        manexFileId = fileData.id;
      }

      // 4. Préparer aircraft_data SANS les fichiers volumineux (MANEX, photo volumineuse)
      const cleanedData = { ...presetData.aircraft_data || presetData };

      // Supprimer le MANEX (stocké séparément dans Supabase Storage)
      delete cleanedData.manex;

      // 🔧 FIX 2026-05 : seuil monté à 5 MB + log explicite quand on strip.
      // Avant : strip silencieux > 1 MB → photos smartphone toutes perdues,
      // sans aucun avertissement utilisateur → bug invisible « photo jamais
      // visible après téléchargement Supabase ». Maintenant : on tente
      // d'abord un downscale, et si toujours trop gros on prévient.
      if (cleanedData.photo && typeof cleanedData.photo === 'string') {
        const photoSizeKB = (cleanedData.photo.length * 0.75) / 1024;
        if (cleanedData.photo.length > 5000000) {
          console.warn(`⚠️ [CommunityService] Photo ${photoSizeKB.toFixed(0)} KB > 5 MB — strippée avant upload Supabase. Le pilote devrait redimensionner l'image avant import.`);
          delete cleanedData.photo;
        } else {
          console.log(`📷 [CommunityService] Photo conservée pour upload Supabase (${photoSizeKB.toFixed(0)} KB)`);
        }
      }

      // Supprimer les métadonnées de tracking inutiles pour la communauté
      delete cleanedData.baseAircraft;
      delete cleanedData.isImportedFromCommunity;
      delete cleanedData.originalCommunityData;
      delete cleanedData.importDate;
      delete cleanedData.id;  // 🔧 FIX: L'ID local n'est pas une colonne de aircraft_data
      delete cleanedData.aircraftId;  // 🔧 FIX: Idem
      delete cleanedData.isVariant;  // 🔧 FIX: Flag temporaire, pas à stocker
      // 🆕 Tracking ajouté par getPresetById / le spread d'init du wizard — PAS une donnée avion
      delete cleanedData.communityPresetId;
      delete cleanedData.importedFromCommunity;
      delete cleanedData.manexAvailableInSupabase;
      delete cleanedData.hasPhoto;
      delete cleanedData.hasWeighingReport;

      // 5. Créer le preset
      const { data, error } = await supabase
        .from('community_presets')
        .insert({
          registration: presetData.registration,
          model: presetData.model,
          manufacturer: presetData.manufacturer,
          aircraft_type: presetData.aircraftType || presetData.type,
          category: presetData.category,
          aircraft_data: cleanedData, // Données nettoyées
          submitted_by: userId,
          description: presetData.description || '',
          manex_file_id: manexFileId,
          has_manex: !!manexFile,
          status: 'active' // Ou 'pending' si modération requise
        })
        .select()
        .single();

      if (error) throw error;

      console.log('✅ [CommunityService] Nouveau preset créé:', {
        id: data?.id,
        registration: data?.registration,
        hasId: !!data?.id
      });

      return data;
    } catch (error) {
      console.error('Erreur lors de la soumission du preset:', error);
      throw error;
    }
  }

  /**
   * Uploader un MANEX vers Supabase Storage
   * @param {string} registration - Immatriculation de l'avion
   * @param {File|Blob} manexFile - Fichier MANEX à uploader
   * @returns {Promise<string>} URL publique du fichier uploadé
   */
  async uploadManex(registration, manexFile) {
    try {
      
      // Créer le nom du fichier: [IMMATRICULATION] - manex.pdf
      const fileName = `${registration} - manex.pdf`;
      const filePath = `${registration}/${fileName}`;

      
      // Uploader vers Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('manex-files')
        .upload(filePath, manexFile, {
          cacheControl: '3600',
          upsert: true // Remplacer si existe déjà
        });

      if (uploadError) {
        console.error('❌ Erreur upload:', uploadError);
        throw uploadError;
      }

      
      // Obtenir l'URL publique
      const { data: urlData } = supabase.storage
        .from('manex-files')
        .getPublicUrl(filePath);

      
      return {
        filePath: filePath,
        publicUrl: urlData.publicUrl,
        fileName: fileName
      };
    } catch (error) {
      console.error('❌ Erreur lors de l\'upload du MANEX:', error);
      throw error;
    }
  }

  /**
   * Télécharger le MANEX d'un preset
   * @param {string} filePath
   * @returns {Promise<Blob>}
   */
  async downloadManex(filePath) {
    if (!filePath) {
      throw new Error('downloadManex appelé sans filePath — impossible de continuer');
    }
    console.log('📥 [downloadManex] Téléchargement MANEX:', filePath);

    let lastDownloadError = null;

    // Récupère un objet par un chemin donné : d'abord .download() (authentifié,
    // marche sur bucket privé + RLS), puis l'URL publique (marche sur bucket
    // public sans policy SELECT). Renvoie le Blob ou null.
    const tryFetch = async (path) => {
      try {
        const { data, error } = await supabase.storage.from('manex-files').download(path);
        if (!error && data) return data;
        if (error) lastDownloadError = error;
      } catch (e) {
        lastDownloadError = e;
      }
      try {
        const { data: u } = supabase.storage.from('manex-files').getPublicUrl(path);
        if (u?.publicUrl) {
          const r = await fetch(u.publicUrl);
          if (r.ok) return await r.blob();
        }
      } catch (e) { /* on tente le fallback suivant */ }
      return null;
    };

    // Méthode 1 : chemin EXACT enregistré (nominal).
    let blob = await tryFetch(filePath);
    if (blob) {
      console.log('✅ [downloadManex] OK (chemin exact):', filePath);
      return blob;
    }

    // Le chemin enregistré en base ne correspond pas toujours à la clé réelle :
    // DEUX conventions de nommage coexistent dans le bucket —
    //   • par modèle : "${modèle}/${timestamp}_${nom}.pdf"
    //   • par immat. : "${immatriculation}/${immatriculation} - manex.pdf"
    // On extrait l'immatriculation du nom de fichier pour tenter l'autre convention.
    const fileOnly = filePath.split('/').pop() || '';
    const folder = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : '';
    const regMatch = fileOnly.match(/\b([A-Z]{1,2}-[A-Z0-9]{3,5})\b/); // ex: F-HSTR, F-GOVE, H-HDIM
    const registration = regMatch ? regMatch[1] : null;

    // Méthode 2 : chemins ALTERNATIFS déduits de l'immatriculation.
    if (registration) {
      for (const cand of [`${registration}/${registration} - manex.pdf`,
                          `${registration}/${registration} - MANEX.pdf`]) {
        if (cand === filePath) continue;
        blob = await tryFetch(cand);
        if (blob) {
          console.warn(`⚠️ [downloadManex] Récupéré via convention immatriculation: "${cand}" (au lieu de "${filePath}")`);
          return blob;
        }
      }
    }

    // Méthode 3 : RÉCUPÉRATION par listing des dossiers candidats (celui du
    // chemin enregistré + celui de l'immatriculation). On retient le PDF dont
    // le nom correspond le mieux.
    const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const wantedBase = norm(fileOnly.replace(/^\d+_/, '')); // sans le préfixe timestamp
    const foldersToScan = [];
    if (folder) foldersToScan.push(folder);
    if (registration && registration !== folder) foldersToScan.push(registration);

    for (const f of foldersToScan) {
      try {
        const { data: list, error: listErr } = await supabase.storage
          .from('manex-files')
          .list(f, { limit: 100 });
        if (listErr) { console.warn(`⚠️ [downloadManex] list("${f}") échec:`, listErr?.message); continue; }
        if (!Array.isArray(list) || list.length === 0) continue;
        const pdfs = list.filter(o => /\.pdf$/i.test(o.name));
        const match =
          pdfs.find(o => norm(o.name) === norm(fileOnly)) ||
          (registration ? pdfs.find(o => norm(o.name).includes(norm(registration))) : null) ||
          (wantedBase.length > 4 ? pdfs.find(o => norm(o.name).includes(wantedBase)) : null) ||
          (pdfs.length === 1 ? pdfs[0] : null);
        if (match) {
          const recovered = `${f}/${match.name}`;
          if (recovered !== filePath) {
            blob = await tryFetch(recovered);
            if (blob) {
              console.warn(`⚠️ [downloadManex] Récupéré via listing du dossier "${f}": "${recovered}"`);
              return blob;
            }
          }
        }
      } catch (e) {
        console.warn(`⚠️ [downloadManex] listing "${f}" échoué:`, e?.message);
      }
    }

    // Échec complet : message explicite et actionnable.
    throw new Error(
      `MANEX introuvable (file_path enregistré: "${filePath}"). ` +
      `Aucun objet correspondant dans le bucket "manex-files" — ni au chemin exact, ` +
      `ni via la convention immatriculation${registration ? ` ("${registration}/…")` : ''}, ` +
      `ni par listing des dossiers. ` +
      `→ Soit le 'file_path' en base est erroné (le fichier existe sous un autre chemin), ` +
      `soit le MANEX n'a jamais été uploadé → ré-importez-le. ` +
      (lastDownloadError ? `Détail .download(): ${lastDownloadError.message || lastDownloadError}. ` : '') +
      `(Vérifiez aussi que le bucket "manex-files" est public ou qu'une policy SELECT autorise l'utilisateur.)`
    );
  }

  /**
   * Mettre à jour un preset communautaire existant avec les modifications locales
   * @param {string} presetId - ID du preset à mettre à jour
   * @param {Object} updatedData - Données mises à jour
   * @param {File|Blob} manexFile - Fichier MANEX optionnel
   * @param {string} manexFileName - Nom du fichier MANEX
   * @param {string} userId - ID de l'utilisateur effectuant la mise à jour
   * @returns {Promise<Object>}
   */
  async updateCommunityPreset(presetId, updatedData, manexFile = null, manexFileName = null, userId) {
    try {
      
      let manexFileId = null;

      // 1. Uploader le nouveau MANEX si fourni — chemin STABLE par immatriculation
      // (UN seul fichier par avion, écrasé via upsert).
      if (manexFile) {
        const reg = updatedData.registration || 'aircraft';
        const fileName = manexFileName || `${reg} - manex.pdf`;
        const filePath = `${reg}/${reg} - manex.pdf`;

        // Upload vers Supabase Storage (upsert → écrase le fichier existant)
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('manex-files')
          .upload(filePath, manexFile, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Enregistrer les métadonnées du fichier
        const { data: fileData, error: fileError } = await supabase
          .from('manex_files')
          .insert({
            filename: fileName,
            file_path: filePath,
            file_size: manexFile.size,
            uploaded_by: userId,
            aircraft_model: updatedData.model
          })
          .select()
          .single();

        if (fileError) throw fileError;

        manexFileId = fileData.id;
              }

      // 2. Préparer aircraft_data SANS les fichiers volumineux (MANEX, photo volumineuse)
      const cleanedData = { ...updatedData };

      // Supprimer le MANEX (stocké séparément dans Supabase Storage)
      delete cleanedData.manex;

      // Supprimer la photo UNIQUEMENT si elle est volumineuse (>1MB en base64)
      // Les petites photos sont conservées car elles sont importantes pour l'UI
      if (cleanedData.photo && typeof cleanedData.photo === 'string') {
        const photoSize = cleanedData.photo.length;
        
        // Supprimer uniquement si > 1MB (1,000,000 caractères en base64)
        if (photoSize > 1000000) {
          delete cleanedData.photo;
        }
      }

      // Supprimer les métadonnées de tracking inutiles pour la communauté
      delete cleanedData.baseAircraft;
      delete cleanedData.isImportedFromCommunity;
      delete cleanedData.originalCommunityData;
      delete cleanedData.importDate;
      delete cleanedData.id;  // 🔧 FIX: L'ID local n'est pas une colonne de aircraft_data
      delete cleanedData.aircraftId;  // 🔧 FIX: Idem
      delete cleanedData.isVariant;  // 🔧 FIX: Flag temporaire, pas à stocker
      // 🆕 Tracking ajouté par getPresetById / le spread d'init du wizard — PAS une donnée avion
      delete cleanedData.communityPresetId;
      delete cleanedData.importedFromCommunity;
      delete cleanedData.manexAvailableInSupabase;
      delete cleanedData.hasPhoto;
      delete cleanedData.hasWeighingReport;

      // 🛡️ ANTI-ÉCRASEMENT : relire la fiche ACTUELLE et fusionner PAR-DESSUS, pour
      // ne JAMAIS vider une valeur existante avec un champ vide/0 du formulaire (ex.
      // sous-champ non rechargé par le wizard). Les vraies valeurs du formulaire gagnent.
      let mergedAircraftData = cleanedData;
      try {
        const { data: cur } = await supabase
          .from('community_presets')
          .select('aircraft_data')
          .eq('id', presetId)
          .single();
        if (cur?.aircraft_data && typeof cur.aircraft_data === 'object') {
          mergedAircraftData = deepMergeKeepExisting(cur.aircraft_data, cleanedData);
        }
      } catch (mergeErr) {
        console.warn('[updateCommunityPreset] Lecture aircraft_data actuelle impossible — écriture directe:', mergeErr?.message);
      }

      // 3. Mettre à jour le preset dans Supabase
      const updatePayload = {
        registration: updatedData.registration,
        model: updatedData.model,
        manufacturer: updatedData.manufacturer || 'Inconnu',
        aircraft_type: updatedData.aircraftType || 'Avion',
        category: updatedData.category || 'SEP',
        aircraft_data: mergedAircraftData, // 🛡️ fusion anti-écrasement (vides → conservent l'existant)
        description: updatedData.description || `Configuration ${updatedData.model} - ${updatedData.registration}`,
        version: (updatedData.version || 1) + 1, // Incrémenter la version
        updated_at: new Date().toISOString()
      };

      // 4. Ajouter le manex_file_id seulement si un nouveau MANEX a été uploadé
      if (manexFileId) {
        updatePayload.manex_file_id = manexFileId;
        updatePayload.has_manex = true;
      } else if (updatedData.hasManex || updatedData.manex) {
        // 🔧 FIX: Préserver le flag has_manex si l'avion avait déjà un MANEX
        // même si on n'en uploade pas un nouveau
        updatePayload.has_manex = true;
        console.log('✅ Préservation du flag has_manex existant');
      }

      // 🚨 FIX B : on récupère un tableau (pas .single()) pour pouvoir détecter
      // les refus RLS silencieux (Supabase JS renvoie data=[] sans error
      // quand la policy bloque l'UPDATE).
      const { data, error } = await supabase
        .from('community_presets')
        .update(updatePayload)
        .eq('id', presetId)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        // 0 ligne renvoyée → soit la ligne n'existe pas, soit RLS a refusé.
        // On enrichit le message avec un diagnostic de session pour gagner du temps.
        const { data: { session } } = await supabase.auth.getSession();
        const sessionInfo = session
          ? `connecté en tant que ${session.user.email || session.user.id}`
          : 'AUCUNE session active (anonyme)';
        const hint = session
          ? `Vérifie que la ligne ${presetId} t'appartient (submitted_by = ${session.user.id}) ou que la politique RLS autorise ton compte à la modifier.`
          : 'Connecte-toi avant de sauvegarder, la RLS interdit les écritures anonymes.';
        // Code machine-lisible : permet au store de basculer en CLONE possédé
        // (modèle « clone possédé sur community_presets ») quand l'avion édité
        // appartient à un autre compte — la RLS owner-only refuse alors l'UPDATE
        // (0 ligne, sans error SQL). On distingue ce cas d'une vraie erreur réseau.
        const noRowsError = new Error(
          `Supabase UPDATE community_presets/${presetId} a affecté 0 ligne. ` +
          `Session : ${sessionInfo}. ${hint}`
        );
        noRowsError.code = 'UPDATE_NO_ROWS';
        throw noRowsError;
      }

      if (data.length > 1) {
        console.warn(`⚠ [updateCommunityPreset] ${data.length} lignes affectées pour id=${presetId} (attendu : 1)`);
      }

      return data[0];
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour du preset:', error);
      throw error;
    }
  }

  /**
   * Cloner un avion comme preset POSSÉDÉ par l'utilisateur courant.
   *
   * Modèle « clone possédé sur community_presets » : quand on édite un avion
   * importé (donc non possédé), la RLS interdit l'UPDATE (submitted_by != auth.uid()).
   * On crée alors une NOUVELLE ligne dont submitted_by = userId → toutes les
   * éditions futures de CETTE copie passent la policy "Owner update presets".
   *
   * @param {Object} updatedData - Données complètes de l'avion (en unités de stockage)
   * @param {string} userId - UUID Supabase du propriétaire (obligatoire)
   * @returns {Promise<Object>} la nouvelle ligne community_presets (avec son id)
   */
  async cloneAsOwnedPreset(updatedData, userId, manexFile = null, manexFileName = null) {
    if (!userId) {
      throw new Error('Clone impossible : aucune session Supabase active (connexion requise).');
    }

    // 0. IDEMPOTENCE : si l'utilisateur POSSÈDE déjà une copie de cette
    //    immatriculation, on la met à jour au lieu d'en créer une nouvelle.
    //    Sans ce garde-fou, chaque édition d'un avion importé (ou chaque dédup
    //    ratée → édition de la mauvaise ligne) crée un clone de plus → doublons.
    if (updatedData.registration) {
      try {
        const { data: owned, error: ownedErr } = await supabase
          .from('community_presets')
          .select('id')
          .eq('registration', updatedData.registration)
          .eq('submitted_by', userId)
          .eq('status', 'active')
          .limit(1);
        if (!ownedErr && owned && owned.length > 0) {
          console.log('♻️ [cloneAsOwnedPreset] Copie possédée existante → UPDATE au lieu de nouveau clone:', owned[0].id);
          return await this.updateCommunityPreset(owned[0].id, updatedData, manexFile, manexFileName, userId);
        }
      } catch (e) {
        console.warn('⚠️ [cloneAsOwnedPreset] Vérification copie possédée échouée, on clone:', e?.message);
      }
    }

    // 1. MANEX : uploader le fichier fourni (Storage + table manex_files). Sinon,
    //    si l'avion source AVAIT un MANEX (PDF non téléchargé localement), on
    //    réutilise son lien manex_file_id pour ne pas le perdre au clonage.
    let manexFileId = null;
    if (manexFile) {
      const reg = updatedData.registration || 'aircraft';
      const fileName = manexFileName || `${reg} - manex.pdf`;
      const filePath = `${reg}/${reg} - manex.pdf`; // chemin STABLE par immatriculation
      const { error: uploadError } = await supabase.storage
        .from('manex-files')
        .upload(filePath, manexFile, { cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;
      const { data: fileData, error: fileError } = await supabase
        .from('manex_files')
        .insert({
          filename: fileName,
          file_path: filePath,
          file_size: manexFile.size,
          uploaded_by: userId,
          aircraft_model: updatedData.model
        })
        .select()
        .single();
      if (fileError) throw fileError;
      manexFileId = fileData.id;
    } else if (updatedData.hasManex && (updatedData.communityPresetId || updatedData.id)) {
      try {
        const srcId = updatedData.communityPresetId || updatedData.id;
        const { data: src } = await supabase
          .from('community_presets')
          .select('manex_file_id')
          .eq('id', srcId)
          .single();
        if (src?.manex_file_id) manexFileId = src.manex_file_id;
      } catch (e) {
        console.warn('⚠️ [cloneAsOwnedPreset] Lien MANEX source non récupéré:', e?.message);
      }
    }

    // 2. Nettoyage symétrique à submitPreset/updateCommunityPreset
    const cleanedData = { ...updatedData };
    delete cleanedData.manex;
    if (cleanedData.photo && typeof cleanedData.photo === 'string' && cleanedData.photo.length > 5000000) {
      console.warn('⚠️ [cloneAsOwnedPreset] Photo > 5 MB strippée avant clone.');
      delete cleanedData.photo;
    }
    delete cleanedData.baseAircraft;
    delete cleanedData.isImportedFromCommunity;
    delete cleanedData.originalCommunityData;
    delete cleanedData.importDate;
    delete cleanedData.id;
    delete cleanedData.aircraftId;
    delete cleanedData.isVariant;
    delete cleanedData.communityPresetId;
    delete cleanedData.submitted_by; // l'owner vit dans la COLONNE, pas dans le JSON

    const { data, error } = await supabase
      .from('community_presets')
      .insert({
        registration: updatedData.registration,
        model: updatedData.model,
        manufacturer: updatedData.manufacturer || 'Inconnu',
        aircraft_type: updatedData.aircraftType || 'Avion',
        category: updatedData.category || 'SEP',
        aircraft_data: cleanedData,
        submitted_by: userId,
        description: updatedData.description || `Configuration ${updatedData.model} - ${updatedData.registration}`,
        manex_file_id: manexFileId,
        has_manex: !!manexFileId || !!(updatedData.hasManex || updatedData.manex),
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;

    console.log('✅ [CommunityService] Clone possédé créé:', {
      id: data?.id,
      registration: data?.registration,
      owner: userId,
      manexLinked: !!manexFileId
    });

    return data;
  }

  /**
   * Supprimer un preset POSSÉDÉ par l'utilisateur (RLS "Owner delete presets" :
   * seules les lignes dont submitted_by = auth.uid() sont réellement supprimées).
   * @param {string} presetId
   * @returns {Promise<Array>} lignes supprimées ([] si aucune : non possédée / déjà absente)
   */
  async deletePreset(presetId) {
    const { data, error } = await supabase
      .from('community_presets')
      .delete()
      .eq('id', presetId)
      .select();
    if (error) throw error;
    return data || [];
  }

  /**
   * Nettoyage one-shot des DOUBLONS POSSÉDÉS : pour chaque immatriculation, garde
   * la copie la plus récente et supprime les autres copies POSSÉDÉES.
   * Ne touche QUE tes lignes (submitted_by = userId) — jamais celles d'autrui.
   * @param {string} userId
   * @param {{dryRun?: boolean}} opts - dryRun (défaut true) = aperçu SANS suppression
   * @returns {Promise<Object>} récap { toDelete, keep, toDeleteCount, deleted? }
   */
  async cleanupOwnedDuplicates(userId, { dryRun = true } = {}) {
    if (!userId) throw new Error('Connexion requise pour le nettoyage des doublons.');

    const { data, error } = await supabase
      .from('community_presets')
      .select('id, registration, submitted_by, created_at, updated_at')
      .eq('submitted_by', userId)
      .eq('status', 'active');
    if (error) throw error;

    const byReg = new Map();
    for (const row of (data || [])) {
      const reg = (row.registration || '').toString().trim().toUpperCase() || `__noreg__${row.id}`;
      if (!byReg.has(reg)) byReg.set(reg, []);
      byReg.get(reg).push(row);
    }

    const tsOf = (r) => new Date(r.updated_at || r.created_at || 0).getTime();
    const keep = [];
    const toDelete = [];
    for (const rows of byReg.values()) {
      rows.sort((a, b) => tsOf(b) - tsOf(a)); // plus récent d'abord
      keep.push(rows[0]);
      toDelete.push(...rows.slice(1));
    }

    const summary = {
      dryRun,
      totalOwned: data?.length || 0,
      registrations: byReg.size,
      toDeleteCount: toDelete.length,
      toDelete: toDelete.map(r => ({ id: r.id, registration: r.registration, created_at: r.created_at })),
      keep: keep.map(r => ({ id: r.id, registration: r.registration }))
    };

    if (dryRun || toDelete.length === 0) {
      if (!dryRun) summary.deleted = 0;
      return summary;
    }

    const ids = toDelete.map(r => r.id);
    const { data: deleted, error: delErr } = await supabase
      .from('community_presets')
      .delete()
      .in('id', ids)
      .select();
    if (delErr) throw delErr;

    summary.deleted = deleted?.length || 0;
    return summary;
  }
}

// Exporter une instance unique
const communityService = new CommunityService();
export default communityService;

// Exporter aussi le client Supabase pour usage avancé
export { supabase };
