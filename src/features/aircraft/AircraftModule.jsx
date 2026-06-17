// src/features/aircraft/AircraftModule.jsx
import React, { memo, useState, useEffect, useMemo } from 'react';
import { useAircraft } from '@core/contexts';
import { useAircraftStore } from '@core/stores/aircraftStore';
import { Plus, Edit2, Trash2, Info, AlertTriangle, X, Plane, BookOpen, Scale, Download } from 'lucide-react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { sx } from '@shared/styles/styleSystem';
import { tokens } from '@shared/styles/designSystem';
import {
  EditorialHeading,
  EditorialButton,
  DataReadout,
  TechLabel,
  NightModeAlert,
} from '@shared/components/editorial';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import AccordionButton from '@shared/components/AccordionButton';
import { ManexImporter } from './components/ManexImporter';
import ManexViewer from './components/ManexViewer';
import AdvancedPerformanceAnalyzer from './components/AdvancedPerformanceAnalyzer';
import AircraftCreationWizard from './components/AircraftCreationWizard';
// import APIKeyTest from '../performance/components/APIKeyTest'; // Temporairement désactivé
import { useUnits } from '@hooks/useUnits';
import performanceDataManager from '../../utils/performanceDataManager';
import { useUnitsWatcher } from '@hooks/useUnitsWatcher';
import dataBackupManager from '@utils/dataBackupManager';
import { evaluateAircraft } from './utils/aircraftCompleteness';
// 🔧 FIX persistance bras-de-levier : la liste store ne contient PAS aircraft_data
// (optim mémoire de getAllPresets). On hydrate depuis Supabase au moment de l'édition
// pour récupérer arms, weightBalance, cgEnvelope, armLengths, etc.
import communityService from '@services/communityService';
import { getFuelDensity } from '@utils/fuelDensity';
import { armToMeters } from '@utils/armUnits';
import { getCurrentAiracCycle } from '@/config/airacConfig';

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
        style={{ cursor: 'help', color: 'var(--text-tertiary)' }}
      />
      {showTooltip && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          left: '0',
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          border: `1px solid var(--border-regular)`,
          padding: '8px 12px',
          borderRadius: tokens.radius.sm,
          fontSize: 'var(--fs-body)',
          lineHeight: '1.4',
          zIndex: 10000,
          minWidth: '180px',
          maxWidth: '280px',
          boxShadow: tokens.shadow.lift,
          fontFamily: tokens.fontFamily.sans
        }}>
          {tooltip}
        </div>
      )}
    </span>
  );
});

InfoIcon.displayName = 'InfoIcon';

/* ----------------------------------------------------------------------------
 * Helpers d'affichage éditorial pour les cards d'avion
 * -------------------------------------------------------------------------- */

// Couleur de complétion — palette unifiée orange/blanc, plus de rouge critique
// (le user a explicitement demandé d'éliminer ce ton qui paraît « orange foncé
// sale » à l'écran). L'info critique reste portée par le bouton MANQUANTS.
const completionTone = (percentage, hasCriticalGaps) => {
  if (percentage >= 90) return 'var(--text-primary)';
  return 'var(--accent-primary)';
};

// Petite jauge SVG fine de complétion (mode card)
const CompletionGauge = memo(({ percentage = 0, critical = false }) => {
  const safe = Math.max(0, Math.min(100, Math.round(percentage || 0)));
  // Un seul ton : orange ALFlight officiel. Plus de rouge critique.
  const tone = 'var(--accent-primary)';
  return (
    <div
      role="img"
      aria-label={`Complétion ${safe}%`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '6px',
        minWidth: '110px'
      }}
    >
      <DataReadout
        value={safe}
        unit="%"
        size="sm"
        emphasis={safe >= 90 ? false : true}
      />
      <svg width="110" height="4" viewBox="0 0 110 4" aria-hidden="true">
        <line
          x1="0" y1="2" x2="110" y2="2"
          stroke="var(--border-regular)"
          strokeWidth="2"
        />
        <line
          x1="0" y1="2" x2={Math.max(2, (safe / 100) * 110)} y2="2"
          stroke={tone}
          strokeWidth="2"
        />
      </svg>
    </div>
  );
});
CompletionGauge.displayName = 'CompletionGauge';

// Mapping des surfaces ICAO → label FR
const SURFACE_LABELS = {
  ASPH: 'Asphalte',
  CONC: 'Béton',
  GRASS: 'Herbe',
  GRVL: 'Gravier',
  UNPAVED: 'Terre',
  SAND: 'Sable',
  SNOW: 'Neige',
  WATER: 'Eau'
};

// NOTE: Hack legacy — AircraftForm (Phase 3.2) consomme encore `window.buttonSectionStyle`
// pour styler le bouton d'upload de photo. La home a été refondue sans cette dépendance ;
// on garde le set au niveau du module (au lieu de l'IIFE intra-render initial) pour
// préserver le comportement actuel d'AircraftForm jusqu'à sa propre refonte éditoriale.
if (typeof window !== 'undefined') {
  window.buttonSectionStyle = {
    width: '100%',
    padding: '12px',
    backgroundColor: 'var(--bg-overlay)',
    color: 'var(--text-primary)',
    border: '1px solid rgba(0, 0, 0, 0.7)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--fs-title)',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s',
    background: 'var(--bg-overlay)',
    textTransform: 'none',
    letterSpacing: 'normal'
  };
}

export const AircraftModule = memo(() => {
  const aircraftContext = useAircraft();
  const { getSymbol, format, getUnit, convert } = useUnits();


  // 🔧 FIX rules-of-hooks : destructuration tolérante AVANT tous les hooks.
  // Le garde-fou `if (!aircraftContext)` (qui renvoie une UI d'erreur) a été
  // déplacé APRÈS la déclaration de TOUS les hooks (juste avant le rendu
  // principal), afin que l'ordre d'appel des hooks reste identique à chaque
  // rendu (React Rules of Hooks). `aircraftList` reçoit le défaut `[]` pour que
  // les hooks ci-dessous tolèrent un contexte absent.
  const {
    aircraftList = [],
    selectedAircraft,
    setSelectedAircraft,
    addAircraft,
    updateAircraft,
    deleteAircraft
  } = aircraftContext || {};

  // Importer la fonction de migration depuis le store
  const migrateAircraftSurfaces = useAircraftStore(state => state.migrateAircraftSurfaces);

  // Importer refreshFromSupabase depuis le store pour recharger après sauvegarde
  const refreshFromSupabase = useAircraftStore(state => state.refreshFromSupabase);
  
  // Vérifier les avions ayant des données manquantes
  const [showIncompleteDataAlert, setShowIncompleteDataAlert] = useState(false);
  const [incompleteAircraft, setIncompleteAircraft] = useState([]);
  
  // Vérifier les données manquantes au premier chargement
  useEffect(() => {
    const incomplete = aircraftList.filter(aircraft =>
      !aircraft.compatibleRunwaySurfaces || aircraft.compatibleRunwaySurfaces.length === 0
    );

    if (incomplete.length > 0) {
      console.log('⚠️ Avions avec données manquantes trouvés:', incomplete.map(a => a.registration));
      setIncompleteAircraft(incomplete);
      setShowIncompleteDataAlert(true);
    }
  }, [aircraftList]); // Se réexécute quand la liste change

  // Écouter l'événement pour reprendre l'assistant de création
  useEffect(() => {
    const handleResumeWizard = () => {
      console.log('🔄 Event: resume-aircraft-wizard received');
      const draft = localStorage.getItem('aircraft_wizard_draft');
      if (draft) {
        try {
          const draftData = JSON.parse(draft);
          console.log('📂 Draft loaded:', draftData);

          // Ouvrir l'assistant avec les données du brouillon
          setWizardAircraft(draftData.aircraftData);
          setShowWizard(true);
        } catch (e) {
          console.error('❌ Error loading draft:', e);
        }
      }
    };

    window.addEventListener('resume-aircraft-wizard', handleResumeWizard);

    return () => {
      window.removeEventListener('resume-aircraft-wizard', handleResumeWizard);
    };
  }, []);
  
  
  const [showForm, setShowForm] = useState(false);
  const [editingAircraft, setEditingAircraft] = useState(null);
  const [showManexImporter, setShowManexImporter] = useState(false);
  const [showManexViewer, setShowManexViewer] = useState(false);
  const [manexAircraft, setManexAircraft] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardAircraft, setWizardAircraft] = useState(null);
  const [aircraftPhotos, setAircraftPhotos] = useState({});

  // ─── Recherche dans la BASE COMMUNAUTAIRE (fusion visuelle avec le module) ───
  const [communitySearch, setCommunitySearch] = useState('');   // filtre live
  const [allPresets, setAllPresets] = useState([]);             // toute la base communautaire (métadonnées légères)
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [communityError, setCommunityError] = useState(null);
  // Avion communautaire SÉLECTIONNÉ (métadonnées légères) → on affiche sa fiche
  // + un bouton « Vérifier les données » AVANT de télécharger la config complète,
  // comme dans Step0CommunityCheck. La sélection ≠ import : elle ne déclenche plus
  // l'entrée immédiate dans l'assistant.
  const [selectedPreset, setSelectedPreset] = useState(null);
  // Téléchargement de la config complète (aircraft_data) depuis Supabase en cours
  // → feedback visuel sur le bouton (l'utilisateur voit qu'on va chercher en ligne).
  const [importing, setImporting] = useState(false);
  // Entrée d'ACTION épinglée en BAS du menu déroulant de la base communautaire :
  // si l'avion n'existe pas dans la base, ouvre l'assistant de création — son
  // Étape 0 propose directement l'import du MANEX (PDF).
  const CREATE_FROM_MANEX_OPTION = '__create_from_manex__';

  // 🔁 Charge TOUTE la base communautaire (métadonnées légères, sans aircraft_data)
  // au montage → filtrage DYNAMIQUE côté client, comme le sélecteur d'avion de la
  // prépa de vol : liste complète + filtre au fil de la frappe, SANS bouton.
  const loadAllPresets = async () => {
    setPresetsLoading(true);
    setCommunityError(null);
    try {
      const list = await communityService.getAllPresets();
      setAllPresets(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('❌ [AircraftModule] Chargement base communautaire échoué:', e);
      setCommunityError(e?.message || 'Erreur de chargement');
      setAllPresets([]);
    } finally {
      setPresetsLoading(false);
    }
  };
  useEffect(() => { loadAllPresets(); }, []);

  // Importer un preset communautaire → ouvre le wizard PRÉ-REMPLI (comme aujourd'hui).
  // 🛡️ ID LOCAL NEUF (aircraft-<ts>) au lieu de l'ID Supabase du preset → la
  // sauvegarde crée un NOUVEL avion sans écraser le preset communautaire
  // (même pattern que Step0). communityPresetId est conservé pour le lien.
  const handleImportFromCommunity = async (presetId) => {
    setImporting(true);
    try {
      // ⬇️ TÉLÉCHARGEMENT RÉEL en ligne : getPresetById() va chercher la config
      // COMPLÈTE (aircraft_data : bras, centrage, perfs, photo…) sur Supabase.
      // La liste affichée n'avait que les métadonnées (immat/modèle) → c'est ICI
      // que les vraies données de l'avion descendent de la base.
      const full = await communityService.getPresetById(presetId);
      const ts = Date.now();
      setWizardAircraft({ ...full, id: `aircraft-${ts}`, aircraftId: `aircraft-${ts}` });
      setShowWizard(true);
    } catch (e) {
      console.error('❌ [AircraftModule] Import communautaire échoué:', e);
      alert(`Impossible d'importer cet avion : ${e?.message || 'erreur inconnue'}`);
    } finally {
      setImporting(false);
    }
  };
  // IDs des avions dont la liste "champs manquants" est dépliée sur la carte
  const [expandedMissingIds, setExpandedMissingIds] = useState(new Set());
  // Confirmation de suppression (remplace window.confirm natif)
  const [deletePending, setDeletePending] = useState(null); // { id, registration } | null
  // Recherche dans la flotte
  const [searchQuery, setSearchQuery] = useState('');
  // Erreur métier surfacée via NightModeAlert (remplace alert() natifs)
  const [opError, setOpError] = useState(null); // { title, description, severity } | null
  const updateAircraftManex = useAircraftStore(state => state.updateAircraftManex);

  // Charger les photos depuis 3 sources possibles, avec fallback en cascade :
  //   1. IndexedDB local (rapide, fonctionne offline)
  //   2. Directement sur l'objet aircraft (data fraîchement chargée depuis Supabase)
  //   3. Supabase si on a un ID mais rien en local (avion partagé d'un autre pilote)
  //
  // 🛡️ FIX OOM (Out Of Memory) :
  // L'ancienne implémentation appelait `dataBackupManager.getAircraftData(id)` pour
  // CHAQUE avion de la liste, ce qui chargeait en mémoire la totalité du blob
  // IDB (photo base64 + MANEX PDF base64 + tables performance). Avec 3-5 avions
  // équipés MANEX, ça représentait facilement 50-100 MB temporairement, et
  // Chrome tuait le renderer ("Render process gone, out of memory") avant même
  // l'affichage des cards.
  //
  // Solution :
  //   • on ne lit IDB QUE si l'avion a la flag `hasPhoto` (sinon inutile),
  //   • on libère explicitement la référence `fullData` après extraction de la
  //     photo (sortie du scope, garbage collection rapide),
  //   • on évite de tout charger en parallèle : la boucle reste séquentielle
  //     pour ne pas accumuler N blobs en mémoire au même instant.
  // 🛡️ FIX OOM CRITIQUE — Chargement photos memory-safe.
  //
  // Pourquoi c'est délicat : `dataBackupManager.getAircraftData(id)` retourne
  // le record IDB COMPLET (photo base64 ~3 MB + MANEX PDF base64 ~12 MB +
  // performance tables ~10 MB + weighingReport). On veut seulement la photo.
  //
  // Anciennement on accumulait tout ça en mémoire (le `fullData` restait
  // référencé dans le scope du closure jusqu'à la fin de l'itération) et,
  // combiné aux clones de AircraftProvider.loadFromIndexedDB, le renderer
  // Chrome explosait avec "Render process gone, out of memory".
  //
  // Solution 3-couches :
  //   1. Photos inline (déjà en mémoire sur l'objet aircraft) — priorité.
  //   2. Pour les autres, lecture IDB SÉQUENTIELLE (jamais parallèle), avec
  //      extraction immédiate de la photo puis nullify de la réf au full
  //      record. Le GC peut alors libérer le MANEX/perf tables AVANT la
  //      prochaine itération.
  //   3. Yield explicite entre itérations (`await Promise.resolve()`) pour
  //      laisser au moteur JS l'opportunité de GC.
  //
  // On poste les photos AU FUR ET À MESURE (setState à chaque itération)
  // pour que l'utilisateur voie les images s'afficher progressivement plutôt
  // qu'attendre le chargement complet.
  useEffect(() => {
    if (aircraftList.length === 0) {
      setAircraftPhotos({});
      return;
    }

    let cancelled = false;

    // Pass 1 — photos inline, sans I/O, synchrone.
    const inlineMap = {};
    for (const a of aircraftList) {
      if (a.photo) inlineMap[a.id] = a.photo;
    }
    if (Object.keys(inlineMap).length > 0) {
      setAircraftPhotos((prev) => ({ ...prev, ...inlineMap }));
    }

    // Pass 2 — IDB séquentiel pour les avions sans photo inline.
    const loadFromIDB = async () => {
      for (const aircraft of aircraftList) {
        if (cancelled) return;
        // Skip si déjà inline ou si pas de hasPhoto.
        if (aircraft.photo || !aircraft.hasPhoto) continue;

        let extractedPhoto = null;
        try {
          // Bloc isolé pour que `fullData` sorte de scope dès que la photo
          // est extraite. Important pour libérer le MANEX/perf tables.
          {
            const fullData = await dataBackupManager.getAircraftData(aircraft.id);
            if (fullData && fullData.photo) {
              extractedPhoto = fullData.photo;
            }
            // `fullData` perd sa dernière référence ici → éligible GC.
          }
        } catch (err) {
          // IDB indispo, avion absent, ou enregistrement corrompu.
          // Pas grave, on passe au suivant.
          continue;
        }

        if (cancelled) return;
        if (extractedPhoto) {
          setAircraftPhotos((prev) => ({ ...prev, [aircraft.id]: extractedPhoto }));
        }

        // Yield au moteur JS — permet au GC de tourner entre 2 lectures IDB
        // de 25 MB avant que la suivante alloue à nouveau.
        await new Promise((r) => setTimeout(r, 0));
      }
    };

    loadFromIDB();

    return () => { cancelled = true; };
  }, [aircraftList]);

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

  // R22 — bascule « non applicable » d'une table de performance attendue.
  // On charge le record COMPLET depuis IndexedDB (la liste est « light » :
  // la sauver telle quelle perdrait les blobs), on patche bypassedFields, puis
  // on persiste via le chemin unique updateAircraft (IDB + Supabase).
  const handleTogglePerfBypass = async (aircraft, bypassKey) => {
    try {
      const full = await dataBackupManager.getAircraftData(aircraft.id);
      const base = full || aircraft;
      const current = Array.isArray(base.bypassedFields) ? base.bypassedFields : [];
      const next = current.includes(bypassKey)
        ? current.filter((k) => k !== bypassKey)
        : [...current, bypassKey];
      await updateAircraft({ ...base, id: aircraft.id, bypassedFields: next });
    } catch (err) {
      console.error('[AircraftModule] Toggle bypass perf échoué:', err?.message);
      alert('Impossible de mettre à jour la fiche : ' + (err?.message || 'erreur inconnue'));
    }
  };

  const handleEdit = async (aircraft) => {
    console.log('✏️ AircraftModule - Editing aircraft:', aircraft);
    // Récupérer l'avion le plus récent depuis la liste pour avoir les dernières modifications
    let currentAircraft = aircraftList.find(a => a.id === aircraft.id) || aircraft;

    // 🛡️ FIX CRITIQUE persistance bras-de-levier (M&C):
    // `getAllPresets()` ne charge PAS la colonne aircraft_data pour optimiser
    // la mémoire (les photos base64 sont volumineuses). Le store contient donc
    // un AVION SQUELETTE sans arms / weightBalance / cgEnvelope / armLengths /
    // speeds / advancedPerformance. Si on ouvre le wizard sur ce squelette, les
    // données fraichement saisies (par exemple arms.fuelMain) paraissent perdues
    // alors qu'elles sont bien en base.
    // → On hydrate depuis Supabase APRÈS la lecture de la liste pour récupérer
    //   tous les champs métier complets.
    if (currentAircraft.communityPresetId || currentAircraft.id) {
      try {
        const fullFromSupabase = await communityService.getPresetById(
          currentAircraft.communityPresetId || currentAircraft.id
        );
        if (fullFromSupabase) {
          // On garde les flags/champs déjà résolus dans la liste (ex: hasPhoto)
          // et on superpose les champs métier complets venant de Supabase.
          currentAircraft = { ...currentAircraft, ...fullFromSupabase };
          console.log('🔄 Avion hydraté depuis Supabase (arms/weightBalance/cgEnvelope OK)');
        }
      } catch (err) {
        console.warn('⚠️ Hydratation Supabase échouée:', err?.message || err);
        // 🛡️ Anti-écrasement squelette : getAllPresets() n'embarque pas aircraft_data,
        // donc l'entrée de liste est un SQUELETTE (sans masses/bras/CG). Si
        // l'hydratation échoue ET qu'on n'a aucune donnée métier locale, ouvrir le
        // formulaire puis enregistrer écraserait aircraft_data par un squelette
        // → destruction des données de masse & centrage. On bloque l'édition.
        const looksSkeleton = !currentAircraft.weightBalance &&
          !currentAircraft.arms &&
          (currentAircraft.emptyWeight === undefined || currentAircraft.emptyWeight === null) &&
          !currentAircraft.cgEnvelope;
        if (looksSkeleton) {
          setOpError({
            severity: 'critical',
            title: 'Fiche avion non chargée',
            description: "Impossible de charger la fiche complète depuis le cloud (réseau ou session expirée). Édition bloquée pour éviter d'écraser les données de masse & centrage. Reconnecte-toi puis réessaie."
          });
          return;
        }
      }
    }

    console.log('✏️ AircraftModule - Current aircraft from list (post-hydrate):', currentAircraft);
    console.log('✏️ AircraftModule - Aircraft surfaces:', currentAircraft.compatibleRunwaySurfaces);

    // Si l'avion a des données volumineuses (photo, manex, rapport de pesée),
    // les récupérer depuis IndexedDB avec timeout.
    if (currentAircraft.hasPhoto || currentAircraft.hasManex || currentAircraft.hasWeighingReport) {
      try {
        console.log('🔍 Récupération des données volumineuses depuis IndexedDB...');
        console.log('🔍 ID de l\'avion:', currentAircraft.id);
        console.log('🔍 hasPhoto:', currentAircraft.hasPhoto);
        console.log('🔍 hasManex:', currentAircraft.hasManex);
        console.log('🔍 hasWeighingReport:', currentAircraft.hasWeighingReport);

        // Attendre que la DB soit initialisée
        await dataBackupManager.initPromise;
        console.log('✅ DB initialisée');

        // Ajouter un timeout pour éviter d'attendre indéfiniment
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 5000); // 5 secondes max
        });

        const dataPromise = dataBackupManager.getAircraftData(currentAircraft.id);

        const fullAircraft = await Promise.race([dataPromise, timeoutPromise]);

        console.log('📦 Données récupérées:', fullAircraft ? 'OUI' : 'NON');
        if (fullAircraft) {
          console.log('📸 Photo présente:', !!fullAircraft.photo);
          console.log('📚 Manex présent:', !!fullAircraft.manex);
          console.log('📋 Rapport de pesée présent:', !!fullAircraft.weighingReport);
          currentAircraft = {
            ...currentAircraft,
            photo: fullAircraft.photo || currentAircraft.photo,
            manex: fullAircraft.manex || currentAircraft.manex,
            weighingReport: fullAircraft.weighingReport || currentAircraft.weighingReport
          };
          console.log('✅ Données volumineuses récupérées depuis IndexedDB');
        } else {
          console.log('⚠️ Aucune donnée volumineuse trouvée dans IndexedDB');
        }
      } catch (error) {
        console.error('❌ Erreur ou timeout lors de la récupération des données depuis IndexedDB:', error);
        console.error('❌ Type d\'erreur:', error.name);
        console.error('❌ Message:', error.message);
        console.log('➡️ Continuons sans les données volumineuses');
      }
    }

    console.log('📝 Ouverture du formulaire d\'édition...');

    setEditingAircraft(currentAircraft);
    setShowForm(true);
  };

  const handleOpenWizard = async (aircraft) => {
    console.log('🪄 AircraftModule - Opening wizard for aircraft:', aircraft);
    // Récupérer l'avion le plus récent depuis la liste pour avoir les dernières modifications
    let currentAircraft = aircraftList.find(a => a.id === aircraft.id) || aircraft;

    // 🛡️ FIX CRITIQUE persistance bras-de-levier (M&C) — voir handleEdit ci-dessus.
    // Le wizard est encore plus sensible : il édite arms, weightBalance, cgEnvelope.
    // Sans hydratation Supabase, les valeurs sauvegardées paraissent perdues à
    // chaque réouverture.
    if (currentAircraft.communityPresetId || currentAircraft.id) {
      try {
        const fullFromSupabase = await communityService.getPresetById(
          currentAircraft.communityPresetId || currentAircraft.id
        );
        if (fullFromSupabase) {
          currentAircraft = { ...currentAircraft, ...fullFromSupabase };
          console.log('🔄 Wizard hydraté depuis Supabase (arms/weightBalance/cgEnvelope OK)');
        }
      } catch (err) {
        console.warn('⚠️ Hydratation Supabase échouée pour wizard:', err?.message || err);
      }
    }

    // Si l'avion a des données volumineuses, essayer de les récupérer depuis IndexedDB
    if (currentAircraft.hasPhoto || currentAircraft.hasManex || currentAircraft.hasPerformance) {
      try {
        console.log('🔍 Chargement des données volumineuses (photos/manex/performances) pour le wizard...');
        await dataBackupManager.initPromise;

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 5000);
        });

        const dataPromise = dataBackupManager.getAircraftData(currentAircraft.id);
        const fullAircraft = await Promise.race([dataPromise, timeoutPromise]);

        if (fullAircraft) {
          currentAircraft = {
            ...currentAircraft,
            photo: fullAircraft.photo || currentAircraft.photo,
            manex: fullAircraft.manex || currentAircraft.manex,
            advancedPerformance: fullAircraft.advancedPerformance || currentAircraft.advancedPerformance,
            performanceTables: fullAircraft.performanceTables || currentAircraft.performanceTables,
            performanceModels: fullAircraft.performanceModels || currentAircraft.performanceModels
          };
          console.log('✅ Données volumineuses chargées pour le wizard');
        }
      } catch (error) {
        console.error('❌ Erreur lors du chargement pour le wizard:', error);
      }
    }

    setWizardAircraft(currentAircraft);
    setShowWizard(true);
  };

  const handleGeneratePDF = async (aircraft) => {
    try {
      console.log('📄 Génération du PDF pour:', aircraft.registration);

      // Récupérer toutes les données de l'avion
      let fullAircraft = { ...aircraft };
      if (aircraft.hasPhoto || aircraft.hasManex || aircraft.hasPerformance) {
        try {
          await dataBackupManager.initPromise;
          const data = await dataBackupManager.getAircraftData(aircraft.id);
          if (data) {
            fullAircraft = { ...fullAircraft, ...data };
          }
        } catch (error) {
          console.warn('⚠️ Impossible de charger toutes les données:', error);
        }
      }

      // Créer un nouveau document PDF
      const pdfDoc = await PDFDocument.create();
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Ajouter une page
      let page = pdfDoc.addPage([595, 842]); // A4
      const { width, height } = page.getSize();
      let yPosition = height - 50;

      // Fonction helper pour ajouter du texte
      const addText = (text, x, y, options = {}) => {
        const font = options.bold ? helveticaBold : helveticaFont;
        const size = options.size || 12;
        page.drawText(text, {
          x,
          y,
          size,
          font,
          color: rgb(0, 0, 0),
          ...options
        });
      };

      // Fonction pour ajouter une nouvelle page si nécessaire
      const checkNewPage = (neededSpace = 50) => {
        if (yPosition < neededSpace) {
          page = pdfDoc.addPage([595, 842]);
          yPosition = height - 50;
        }
      };

      // Titre
      addText(`Fiche Technique - ${fullAircraft.registration}`, 50, yPosition, { bold: true, size: 20 });
      yPosition -= 40;

      // Sous-titre : constructeur/modèle + cycle de données de navigation (AIRAC)
      const subtitle = `${fullAircraft.manufacturer || ''} ${fullAircraft.model || ''}`.trim();
      if (subtitle) {
        addText(subtitle, 50, yPosition, { size: 11, color: rgb(0.3, 0.3, 0.3) });
        yPosition -= 18;
      }
      const airacCycle = getCurrentAiracCycle();
      addText(
        `Cycle de données nav (AIRAC) : ${airacCycle?.date || 'N/A'}${airacCycle?.folder ? ` (${airacCycle.folder})` : ''}`,
        50, yPosition, { size: 9, color: rgb(0.45, 0.45, 0.45) }
      );
      yPosition -= 28;

      // Ajouter la photo de l'avion si disponible
      if (fullAircraft.photo) {
        try {
          checkNewPage(200);

          // Convertir la photo base64 en image
          let imageBytes;
          let image;

          if (fullAircraft.photo.startsWith('data:image/png')) {
            imageBytes = fullAircraft.photo.split(',')[1];
            image = await pdfDoc.embedPng(imageBytes);
          } else if (fullAircraft.photo.startsWith('data:image/jpeg') || fullAircraft.photo.startsWith('data:image/jpg')) {
            imageBytes = fullAircraft.photo.split(',')[1];
            image = await pdfDoc.embedJpg(imageBytes);
          }

          if (image) {
            const imageWidth = 200;
            const imageHeight = (image.height / image.width) * imageWidth;

            // Centrer l'image
            const xPos = (width - imageWidth) / 2;

            page.drawImage(image, {
              x: xPos,
              y: yPosition - imageHeight,
              width: imageWidth,
              height: imageHeight,
            });

            yPosition -= imageHeight + 20;
          }
        } catch (error) {
          console.warn('⚠️ Erreur lors de l\'ajout de la photo:', error);
        }
      }

      checkNewPage(50);

      // Informations générales
      addText('INFORMATIONS GÉNÉRALES', 50, yPosition, { bold: true, size: 14 });
      yPosition -= 25;

      // 3e élément optionnel { required: true } => la ligne est imprimée même vide ("N/A"),
      // pour distinguer "non renseigné" de "non applicable" sur un identifiant clé (audit QA).
      const generalInfo = [
        ['Immatriculation', fullAircraft.registration, { required: true }],
        ['Type / Modèle', fullAircraft.model],
        ['Constructeur', fullAircraft.manufacturer],
        ['Numéro de série (MSN)', fullAircraft.serialNumber || fullAircraft.msn || fullAircraft.serial, { required: true }],
        ['Aéroclub d\'attache', fullAircraft.homeAeroclub],
        ['Terrain de base', fullAircraft.homeBase],
        ['Catégorie', fullAircraft.category],
        ['Année', fullAircraft.year],
        ['Propriétaire', fullAircraft.owner],
      ];

      generalInfo.forEach(([label, value, opts]) => {
        const hasValue = value !== undefined && value !== null && value !== '';
        if (hasValue || opts?.required) {
          checkNewPage();
          addText(`${label}:`, 50, yPosition, { bold: true });
          addText(hasValue ? String(value) : 'N/A', 220, yPosition);
          yPosition -= 20;
        }
      });

      yPosition -= 10;
      checkNewPage(50);

      // 🔧 FIX audit QA (D9 — source unique) : valeurs canoniques calculées UNE fois,
      // réutilisées ici ET par "MASSE ET CENTRAGE" → plus de divergence possible.
      const cEmptyWeight = fullAircraft.weights?.emptyWeight ?? fullAircraft.emptyWeight ?? null;
      const cMtow = fullAircraft.weights?.mtow ?? fullAircraft.maxTakeoffWeight ?? null;
      const cMlw = fullAircraft.weights?.mlw ?? null;
      const cMzfw = fullAircraft.weights?.mzfw ?? fullAircraft.weights?.zfm ?? fullAircraft.maxZeroFuelWeight ?? null;
      const cMtw = fullAircraft.weights?.mtw ?? fullAircraft.weights?.maxTaxiWeight ?? fullAircraft.maxTaxiWeight ?? fullAircraft.maxRampWeight ?? null;
      const cFuelCapacity = fullAircraft.fuel?.maxCapacity ?? fullAircraft.fuelCapacity ?? null;
      const cFuelDensity = getFuelDensity(fullAircraft.fuelType);

      // Masses structurales (limites) — N/A explicite si absente (audit QA D3/D4/D10)
      addText('MASSES STRUCTURALES (LIMITES)', 50, yPosition, { bold: true, size: 14 });
      yPosition -= 25;

      const massLimits = [
        ['Masse max roulage (MTW)', cMtw, true],
        ['Masse max décollage (MTOW)', cMtow, true],
        ['Masse max atterrissage (MLW)', cMlw, true],
        ['Masse max sans carburant (MZFW)', cMzfw, true],
        ['Masse à vide équipée (OEW)', cEmptyWeight, true],
        ['Charge utile', fullAircraft.usefulLoad, false],
      ];

      massLimits.forEach(([label, value, required]) => {
        const hasValue = value !== undefined && value !== null && value !== '';
        if (hasValue || required) {
          checkNewPage();
          addText(`${label}:`, 50, yPosition, { bold: true, size: 10 });
          addText(hasValue ? `${value} kg` : 'N/A', 260, yPosition, { size: 10 });
          yPosition -= 18;
        }
      });

      yPosition -= 8;
      checkNewPage(50);

      // Dimensions & carburant (densité de référence — audit QA D5)
      addText('DIMENSIONS & CARBURANT', 50, yPosition, { bold: true, size: 14 });
      yPosition -= 25;

      const dimsInfo = [
        ['Capacité carburant totale', cFuelCapacity != null ? `${cFuelCapacity} L` : null],
        ['Densité de référence', cFuelDensity != null ? `${cFuelDensity} kg/L${fullAircraft.fuelType ? ` (${fullAircraft.fuelType})` : ''}` : null],
        ['Envergure', fullAircraft.wingspan ? `${fullAircraft.wingspan} m` : null],
        ['Longueur', fullAircraft.length ? `${fullAircraft.length} m` : null],
      ];

      dimsInfo.forEach(([label, value]) => {
        if (value) {
          checkNewPage();
          addText(`${label}:`, 50, yPosition, { bold: true });
          addText(value, 260, yPosition);
          yPosition -= 20;
        }
      });

      yPosition -= 10;
      checkNewPage(50);

      // Vitesses caractéristiques
      if (fullAircraft.speeds) {
        addText('VITESSES CARACTÉRISTIQUES', 50, yPosition, { bold: true, size: 14 });
        yPosition -= 25;

        const speedsInfo = [
          ['VSO (Volets sortis)', fullAircraft.speeds.vso],
          ['VS1 (Config lisse)', fullAircraft.speeds.vs1],
          ['VFE Landing', fullAircraft.speeds.vfeLdg],
          ['VFE Takeoff', fullAircraft.speeds.vfeTO],
          ['VNO (Normale)', fullAircraft.speeds.vno],
          ['VNE (Ne jamais excéder)', fullAircraft.speeds.vne],
          ['VA (Manœuvre)', fullAircraft.speeds.va],
          ['V Glide', fullAircraft.speeds.vglide],
          ['VR (Rotation)', fullAircraft.speeds.vr],
          ['V2 (Sécurité)', fullAircraft.speeds.v2],
          ['VREF (Référence)', fullAircraft.speeds.vref],
        ];

        speedsInfo.forEach(([label, value]) => {
          if (value) {
            checkNewPage();
            addText(`${label}:`, 50, yPosition, { bold: true, size: 10 });
            addText(`${value} kt`, 250, yPosition, { size: 10 });
            yPosition -= 18;
          }
        });

        yPosition -= 10;
        checkNewPage(50);
      }

      // Masse et centrage — section enrichie avec moments + arrays
      if (fullAircraft.weights || fullAircraft.arms || fullAircraft.cgEnvelope) {
        addText('MASSE ET CENTRAGE', 50, yPosition, { bold: true, size: 14 });
        yPosition -= 25;

        // 🔧 FIX audit QA (D9) : masses limites et capacité carburant RETIRÉES d'ici
        // (déjà affichées une seule fois en sections "MASSES STRUCTURALES" / "DIMENSIONS").
        // Cette section ne conserve que les données propres au CENTRAGE.
        const massBalanceInfo = [
          ['Bras à vide', fullAircraft.arms?.empty, 'mm'],
          ['Moment à vide', fullAircraft.moments?.empty, 'kg·mm'],
          ['Masse min vol', fullAircraft.weights?.minTakeoffWeight, 'kg'],
          // Sièges (bras seul — moment dépend du passager au chargement)
          ['Bras sièges avant', fullAircraft.arms?.frontSeats, 'mm'],
          ['Bras sièges arrière', fullAircraft.arms?.rearSeats, 'mm']
        ];

        massBalanceInfo.forEach(([label, value, unit]) => {
          if (value) {
            checkNewPage();
            addText(`${label}:`, 50, yPosition, { bold: true, size: 10 });
            addText(`${value} ${unit}`, 250, yPosition, { size: 10 });
            yPosition -= 18;
          }
        });

        // Réservoirs (principal, ailes, optionnels…)
        if (fullAircraft.additionalFuelTanks && fullAircraft.additionalFuelTanks.length > 0) {
          yPosition -= 5;
          checkNewPage(50);
          addText('Réservoirs :', 50, yPosition, { bold: true, size: 11 });
          yPosition -= 18;
          fullAircraft.additionalFuelTanks.forEach((tank, idx) => {
            const name = tank.name || `Réservoir ${idx + 1}`;
            checkNewPage();
            addText(`  ${name}: ${tank.capacity || '?'} L, bras ${tank.arm || '?'} mm, moment ${tank.momentAtFull || '?'} kg·mm`,
              60, yPosition, { size: 10 });
            yPosition -= 16;
          });
        }

        // Sièges additionnels (bras seul)
        if (fullAircraft.additionalSeats && fullAircraft.additionalSeats.length > 0) {
          yPosition -= 5;
          checkNewPage(50);
          addText('Sièges additionnels:', 50, yPosition, { bold: true, size: 11 });
          yPosition -= 18;
          fullAircraft.additionalSeats.forEach((seat, idx) => {
            const name = seat.name || `Siège ${idx + 3}`;
            checkNewPage();
            addText(`  ${name}: bras ${seat.arm || '?'} mm`, 60, yPosition, { size: 10 });
            yPosition -= 16;
          });
        }

        // Compartiments bagages
        if (fullAircraft.baggageCompartments && fullAircraft.baggageCompartments.length > 0) {
          yPosition -= 5;
          checkNewPage(50);
          addText('Compartiments bagages:', 50, yPosition, { bold: true, size: 11 });
          yPosition -= 18;
          fullAircraft.baggageCompartments.forEach((comp, idx) => {
            const name = comp.name || `Compartiment ${idx + 1}`;
            checkNewPage();
            addText(`  ${name}: masse max ${comp.maxWeight || '?'} kg, bras ${comp.arm || '?'} mm, moment max ${comp.momentMax || '?'} kg·mm`,
              60, yPosition, { size: 10 });
            yPosition -= 16;
          });
        }

        // Limites CG et graphique d'enveloppe
        if (fullAircraft.cgEnvelope) {
          yPosition -= 5;
          checkNewPage(50);
          addText('Limites de centrage:', 50, yPosition, { bold: true, size: 11 });
          yPosition -= 15;

          // 🔧 FIX audit QA (D6) + C2 : %MAC = (bras − LEMAC) / corde MAC × 100.
          // HOMOGÉNÉITÉ STRICTE : les 3 longueurs sont ramenées en MÈTRES via
          // armToMeters (couvre le canonique m ET le legacy mm) avant soustraction.
          const macLength = (() => {
            const v = armToMeters(fullAircraft.cgEnvelope.macLength ?? fullAircraft.macLength);
            return Number.isFinite(v) && v > 0 ? v : null;
          })();
          const lemac = armToMeters(fullAircraft.cgEnvelope.lemac ?? fullAircraft.lemac);
          const hasMac = macLength != null && Number.isFinite(lemac);
          const pctMac = (cgValue) => {
            const n = armToMeters(cgValue);
            if (!hasMac || !Number.isFinite(n)) return '';
            return ` (${((n - lemac) / macLength * 100).toFixed(1)} %MAC)`;
          };

          addText(
            hasMac
              ? `(%MAC : corde ${(macLength * 1000).toFixed(0)} mm, LEMAC ${(lemac * 1000).toFixed(0)} mm)`
              : '(%MAC indisponible : corde MAC non renseignee)',
            70, yPosition, { size: 8, color: rgb(0.45, 0.45, 0.45) }
          );
          yPosition -= 18;

          if (fullAircraft.cgEnvelope.forwardPoints && fullAircraft.cgEnvelope.forwardPoints.length > 0) {
            const fwd = fullAircraft.cgEnvelope.forwardPoints[0].cg;
            addText(`CG avant (min): ${fwd} mm${pctMac(fwd)}`, 70, yPosition, { size: 10 });
            yPosition -= 18;
          }
          // Arrière : 2 points indépendants (rétro-compat aftCG)
          const legacyAftCG = fullAircraft.cgEnvelope.aftCG;
          const aftMinCG = fullAircraft.cgEnvelope.aftMinCG || legacyAftCG;
          const aftMaxCG = fullAircraft.cgEnvelope.aftMaxCG || legacyAftCG;
          if (aftMinCG) {
            addText(`CG arrière à masse min (${fullAircraft.cgEnvelope.aftMinWeight || '?'} kg): ${aftMinCG} mm${pctMac(aftMinCG)}`, 70, yPosition, { size: 10 });
            yPosition -= 18;
          }
          if (aftMaxCG && aftMaxCG !== aftMinCG) {
            addText(`CG arrière à masse max (${fullAircraft.cgEnvelope.aftMaxWeight || '?'} kg): ${aftMaxCG} mm${pctMac(aftMaxCG)}`, 70, yPosition, { size: 10 });
            yPosition -= 18;
          }

          // Dessiner le graphique de l'enveloppe de centrage
          yPosition -= 10;
          checkNewPage(250);

          try {
            // Dimensions du graphique
            const chartWidth = 400;
            const chartHeight = 200;
            const chartX = (width - chartWidth) / 2; // Centrer le graphique
            const chartY = yPosition - chartHeight;

            // Collecter tous les points pour déterminer les échelles
            const forwardPoints = fullAircraft.cgEnvelope.forwardPoints || [];
            const aftMinWeight = fullAircraft.cgEnvelope.aftMinWeight || 0;
            const aftMaxWeight = fullAircraft.cgEnvelope.aftMaxWeight || fullAircraft.weights?.mtow || 1000;
            const aftCG = fullAircraft.cgEnvelope.aftCG || 0;

            // Trouver les valeurs min/max pour les échelles
            const allWeights = [...forwardPoints.map(p => p.weight), aftMinWeight, aftMaxWeight].filter(w => w);
            const allCGs = [...forwardPoints.map(p => p.cg), aftCG].filter(cg => cg);

            if (allWeights.length > 0 && allCGs.length > 0) {
              const minWeight = Math.min(...allWeights);
              const maxWeight = Math.max(...allWeights);
              const minCG = Math.min(...allCGs);
              const maxCG = Math.max(...allCGs);

              // Marges pour l'affichage
              const weightMargin = (maxWeight - minWeight) * 0.1 || 50;
              const cgMargin = (maxCG - minCG) * 0.1 || 10;

              const weightRange = {
                min: Math.max(0, minWeight - weightMargin),
                max: maxWeight + weightMargin
              };
              const cgRange = {
                min: minCG - cgMargin,
                max: maxCG + cgMargin
              };

              // Fonction pour convertir les coordonnées données en coordonnées PDF
              const scaleX = (weight) => {
                return chartX + ((weight - weightRange.min) / (weightRange.max - weightRange.min)) * chartWidth;
              };
              const scaleY = (cg) => {
                return chartY + ((cg - cgRange.min) / (cgRange.max - cgRange.min)) * chartHeight;
              };

              // Dessiner les axes
              page.drawLine({
                start: { x: chartX, y: chartY },
                end: { x: chartX, y: chartY + chartHeight },
                thickness: 1,
                color: rgb(0, 0, 0)
              });
              page.drawLine({
                start: { x: chartX, y: chartY },
                end: { x: chartX + chartWidth, y: chartY },
                thickness: 1,
                color: rgb(0, 0, 0)
              });

              // Labels des axes
              addText('Masse (kg)', chartX + chartWidth / 2 - 30, chartY - 20, { size: 10, bold: true });

              // Label axe Y (vertical) - rotation simulée avec texte vertical
              const cgLabelX = chartX - 25;
              const cgLabelY = chartY + chartHeight / 2;
              addText('CG (mm)', cgLabelX - 20, cgLabelY, { size: 10, bold: true });

              // Graduations et labels sur l'axe X (masse)
              const numXTicks = 5;
              for (let i = 0; i <= numXTicks; i++) {
                const weight = weightRange.min + (i / numXTicks) * (weightRange.max - weightRange.min);
                const x = scaleX(weight);
                page.drawLine({
                  start: { x, y: chartY },
                  end: { x, y: chartY - 5 },
                  thickness: 1,
                  color: rgb(0, 0, 0)
                });
                addText(Math.round(weight).toString(), x - 15, chartY - 15, { size: 8 });
              }

              // Graduations et labels sur l'axe Y (CG)
              const numYTicks = 5;
              for (let i = 0; i <= numYTicks; i++) {
                const cg = cgRange.min + (i / numYTicks) * (cgRange.max - cgRange.min);
                const y = scaleY(cg);
                page.drawLine({
                  start: { x: chartX, y },
                  end: { x: chartX - 5, y },
                  thickness: 1,
                  color: rgb(0, 0, 0)
                });
                addText(Math.round(cg).toString(), chartX - 35, y - 3, { size: 8 });
              }

              // Dessiner l'enveloppe de centrage
              // Zone verte pour l'enveloppe acceptable
              if (forwardPoints.length >= 2) {
                // Ligne limite avant (forward CG)
                forwardPoints.sort((a, b) => a.weight - b.weight);
                for (let i = 0; i < forwardPoints.length - 1; i++) {
                  const p1 = forwardPoints[i];
                  const p2 = forwardPoints[i + 1];
                  page.drawLine({
                    start: { x: scaleX(p1.weight), y: scaleY(p1.cg) },
                    end: { x: scaleX(p2.weight), y: scaleY(p2.cg) },
                    thickness: 2,
                    color: rgb(0, 0.6, 0),
                    opacity: 0.8
                  });
                }
              }

              // Ligne limite arrière (aft CG)
              if (aftMinWeight && aftMaxWeight && aftCG) {
                page.drawLine({
                  start: { x: scaleX(aftMinWeight), y: scaleY(aftCG) },
                  end: { x: scaleX(aftMaxWeight), y: scaleY(aftCG) },
                  thickness: 2,
                  color: rgb(0.8, 0, 0),
                  opacity: 0.8
                });
              }

              // Légende
              const legendX = chartX + chartWidth - 120;
              const legendY = chartY + chartHeight - 30;

              // Ligne verte
              page.drawLine({
                start: { x: legendX, y: legendY },
                end: { x: legendX + 20, y: legendY },
                thickness: 2,
                color: rgb(0, 0.6, 0)
              });
              addText('Limite avant', legendX + 25, legendY - 3, { size: 8 });

              // Ligne rouge
              page.drawLine({
                start: { x: legendX, y: legendY - 15 },
                end: { x: legendX + 20, y: legendY - 15 },
                thickness: 2,
                color: rgb(0.8, 0, 0)
              });
              addText('Limite arrière', legendX + 25, legendY - 18, { size: 8 });

              yPosition = chartY - 30;

              addText('Graphique: Enveloppe de centrage', chartX, yPosition, { size: 9, bold: true });
              yPosition -= 25;
            }
          } catch (error) {
            console.warn('⚠️ Erreur lors de la génération du graphique CG:', error);
            addText('(Graphique non disponible)', 70, yPosition, { size: 9 });
            yPosition -= 20;
          }
        }

        yPosition -= 10;
        checkNewPage(50);
      }

      // Performances générales
      addText('PERFORMANCES GÉNÉRALES', 50, yPosition, { bold: true, size: 14 });
      yPosition -= 25;

      const perfInfo = [
        ['Vitesse de croisière', fullAircraft.cruiseSpeed || fullAircraft.cruiseSpeedKt, 'kt'],
        ['Vitesse max', fullAircraft.maxSpeed, 'kt'],
        ['Plafond', fullAircraft.ceiling, 'ft'],
        ['Autonomie', fullAircraft.range, 'NM'],
        ['Taux de montée', fullAircraft.climbRate, 'ft/min'],
        ['Consommation', fullAircraft.fuelConsumption, 'L/h'],
      ];

      perfInfo.forEach(([label, value, unit]) => {
        if (value) {
          checkNewPage();
          addText(`${label}:`, 50, yPosition, { bold: true });
          addText(`${value} ${unit}`, 200, yPosition);
          yPosition -= 20;
        }
      });

      yPosition -= 10;
      checkNewPage(50);

      // Moteur et hélice
      addText('MOTEUR ET HÉLICE', 50, yPosition, { bold: true, size: 14 });
      yPosition -= 25;

      const engineInfo = [
        ['Type moteur', fullAircraft.engineType],
        ['Modèle moteur', fullAircraft.engineModel],
        ['Puissance', fullAircraft.enginePower ? `${fullAircraft.enginePower} HP` : null],
        ['Nombre de moteurs', fullAircraft.engineCount],
        ['Type hélice', fullAircraft.propellerType],
      ];

      engineInfo.forEach(([label, value]) => {
        if (value) {
          checkNewPage();
          addText(`${label}:`, 50, yPosition, { bold: true });
          addText(String(value), 200, yPosition);
          yPosition -= 20;
        }
      });

      yPosition -= 10;
      checkNewPage(50);

      // Équipements
      if (fullAircraft.avionics || fullAircraft.equipment) {
        addText('ÉQUIPEMENTS', 50, yPosition, { bold: true, size: 14 });
        yPosition -= 25;

        if (fullAircraft.avionics) {
          checkNewPage();
          addText('Avionique:', 50, yPosition, { bold: true });
          yPosition -= 20;
          const avionicsText = fullAircraft.avionics.split('\n');
          avionicsText.forEach(line => {
            checkNewPage();
            addText(line, 70, yPosition, { size: 10 });
            yPosition -= 15;
          });
        }

        yPosition -= 10;
      }

      // Surfaces compatibles
      if (fullAircraft.compatibleRunwaySurfaces && fullAircraft.compatibleRunwaySurfaces.length > 0) {
        checkNewPage(50);
        addText('SURFACES DE PISTE COMPATIBLES', 50, yPosition, { bold: true, size: 14 });
        yPosition -= 25;

        const surfaces = fullAircraft.compatibleRunwaySurfaces.join(', ');
        addText(surfaces, 50, yPosition);
        yPosition -= 20;
        yPosition -= 10;
      }

      // Opérations approuvées
      if (fullAircraft.approvedOperations) {
        checkNewPage(100);
        addText('OPÉRATIONS APPROUVÉES', 50, yPosition, { bold: true, size: 14 });
        yPosition -= 25;

        const ops = fullAircraft.approvedOperations;
        const approvedOps = [];

        if (ops.vfrDay) approvedOps.push('VFR Jour');
        if (ops.vfrNight) approvedOps.push('VFR Nuit');
        if (ops.ifrDay) approvedOps.push('IFR Jour');
        if (ops.ifrNight) approvedOps.push('IFR Nuit');
        if (ops.aerobatics) approvedOps.push('Voltige');
        if (ops.spinning) approvedOps.push('Vrille');
        if (ops.waterOperations) approvedOps.push('Opérations sur eau');
        if (ops.skiOperations) approvedOps.push('Opérations sur skis');
        if (ops.icingConditions) approvedOps.push('Conditions givrantes');

        if (approvedOps.length > 0) {
          addText('Règles de vol et opérations spéciales:', 50, yPosition, { bold: true, size: 11 });
          yPosition -= 20;

          approvedOps.forEach(op => {
            checkNewPage();
            addText(`• ${op}`, 70, yPosition, { size: 10 });
            yPosition -= 18;
          });
        } else {
          addText('Aucune opération spécifique approuvée', 50, yPosition, { size: 10 });
          yPosition -= 18;
        }

        // Approbations spéciales RVSM / PBN / ETOPS (audit QA D7) — N/A explicite si absentes
        checkNewPage(40);
        const specialApprovals = [];
        if (ops.rvsm) specialApprovals.push('RVSM');
        if (ops.pbn) specialApprovals.push(typeof ops.pbn === 'string' ? `PBN (${ops.pbn})` : 'PBN');
        if (ops.etops) specialApprovals.push(typeof ops.etops === 'string' ? `ETOPS (${ops.etops})` : 'ETOPS');
        yPosition -= 4;
        addText('Approbations spéciales (RVSM / PBN / ETOPS):', 50, yPosition, { bold: true, size: 11 });
        yPosition -= 18;
        addText(specialApprovals.length ? specialApprovals.join('  •  ') : 'Non renseignées', 70, yPosition, { size: 10 });
        yPosition -= 18;

        yPosition -= 10;
      }

      // Performances de décollage/atterrissage si disponibles
      if (fullAircraft.performance) {
        checkNewPage(70);
        addText('DONNÉES DE PERFORMANCE', 50, yPosition, { bold: true, size: 14 });
        yPosition -= 25;

        if (fullAircraft.performance.takeoff) {
          addText('Décollage:', 50, yPosition, { bold: true });
          yPosition -= 20;
          const takeoff = fullAircraft.performance.takeoff;
          if (takeoff.tod) {
            addText(`  TOD: ${takeoff.tod} m`, 70, yPosition);
            yPosition -= 18;
          }
          if (takeoff.toda15m) {
            addText(`  15m: ${takeoff.toda15m} m`, 70, yPosition);
            yPosition -= 18;
          }
          if (takeoff.toda50ft) {
            addText(`  50ft: ${takeoff.toda50ft} m`, 70, yPosition);
            yPosition -= 18;
          }
          yPosition -= 10;
        }

        if (fullAircraft.performance.landing) {
          checkNewPage(70);
          addText('Atterrissage:', 50, yPosition, { bold: true });
          yPosition -= 20;
          const landing = fullAircraft.performance.landing;
          if (landing.ld) {
            addText(`  LD: ${landing.ld} m`, 70, yPosition);
            yPosition -= 18;
          }
          if (landing.lda15m) {
            addText(`  15m: ${landing.lda15m} m`, 70, yPosition);
            yPosition -= 18;
          }
          if (landing.lda50ft) {
            addText(`  50ft: ${landing.lda50ft} m`, 70, yPosition);
            yPosition -= 18;
          }
        }
      }

      // Remarques
      if (fullAircraft.notes) {
        checkNewPage(50);
        yPosition -= 10;
        addText('REMARQUES', 50, yPosition, { bold: true, size: 14 });
        yPosition -= 25;

        const notesLines = fullAircraft.notes.split('\n');
        notesLines.forEach(line => {
          checkNewPage();
          addText(line, 50, yPosition, { size: 10 });
          yPosition -= 15;
        });
      }

      // Pied de page sur toutes les pages (audit QA L3 : + horodatage UTC + immat.)
      const pages = pdfDoc.getPages();
      const genUtcStamp = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;
      const genLocalStamp = `Généré le ${new Date().toLocaleString('fr-FR')}`;
      pages.forEach((p, index) => {
        // Gauche : immatriculation + horodatage UTC
        p.drawText(`${fullAircraft.registration || ''} — ${genUtcStamp}`, {
          x: 50, y: 30, size: 8, font: helveticaFont, color: rgb(0.5, 0.5, 0.5)
        });
        // Centre : pagination
        p.drawText(`Page ${index + 1}/${pages.length}`, {
          x: width / 2 - 30, y: 30, size: 10, font: helveticaFont, color: rgb(0.5, 0.5, 0.5)
        });
        // Droite : horodatage local (aligné à droite via mesure de largeur)
        const lw = helveticaFont.widthOfTextAtSize(genLocalStamp, 8);
        p.drawText(genLocalStamp, {
          x: width - 50 - lw, y: 30, size: 8, font: helveticaFont, color: rgb(0.5, 0.5, 0.5)
        });
      });

      // Sauvegarder le PDF
      const pdfBytes = await pdfDoc.save();

      // Télécharger le PDF
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Fiche_${fullAircraft.registration}_${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      console.log('✅ PDF généré avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de la génération du PDF:', error);
      setOpError({
        severity: 'critical',
        title: 'Échec de génération du PDF',
        description: error?.message || 'Consultez la console pour plus de détails.'
      });
    }
  };

  // Helper générique : télécharge un PDF base64 depuis aircraft.<field>.pdfData,
  // avec fallback IndexedDB si la donnée volumineuse n'est pas en mémoire.
  const downloadAircraftPdf = async (aircraft, field, defaultPrefix) => {
    if (!aircraft) return;
    let pdfData = aircraft?.[field]?.pdfData;
    let fileName = aircraft?.[field]?.fileName;
    // Fallback IndexedDB
    if (!pdfData) {
      try {
        await dataBackupManager.initPromise;
        const full = await Promise.race([
          dataBackupManager.getAircraftData(aircraft.id),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        pdfData = full?.[field]?.pdfData;
        fileName = fileName || full?.[field]?.fileName;
      } catch (err) {
        console.warn(`⚠️ Échec rechargement ${field} depuis IndexedDB :`, err.message);
      }
    }
    if (!pdfData) {
      setOpError({
        severity: 'warn',
        title: 'Fichier indisponible',
        description: `Aucun PDF stocké localement pour cet avion (${field}). Réimporte-le via le wizard.`
      });
      return;
    }
    const link = document.createElement('a');
    link.href = pdfData;
    link.download = fileName || `${defaultPrefix}_${aircraft.registration || aircraft.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadManex = (aircraft) => downloadAircraftPdf(aircraft, 'manex', 'MANEX');
  const handleDownloadWeighingReport = (aircraft) => downloadAircraftPdf(aircraft, 'weighingReport', 'Pesee');

  // Demande de suppression : ouvre le dialogue de confirmation éditorial
  const handleDelete = (aircraft) => {
    console.log('🗑️ AircraftModule - Requesting delete for aircraft:', aircraft);
    if (!aircraft) return;
    setDeletePending({
      id: aircraft.id,
      registration: aircraft.registration || '—',
      model: aircraft.model || ''
    });
  };

  // Confirmation effective de la suppression
  const confirmDelete = () => {
    if (!deletePending) return;
    console.log('🗑️ AircraftModule - Confirming delete:', deletePending.id);
    deleteAircraft(deletePending.id);
    console.log('✅ AircraftModule - Aircraft deleted:', deletePending.id);
    setDeletePending(null);
  };

  // Annulation de la demande de suppression
  const cancelDelete = () => {
    setDeletePending(null);
  };



  // ---------------------------------------------------------------------------
  // Données dérivées pour le header / KPI flotte + filtrage recherche
  // ---------------------------------------------------------------------------
  const safeList = aircraftList || [];

  const filteredAircraftList = useMemo(() => {
    const query = (searchQuery || '').trim().toLowerCase();
    if (!query) return safeList;
    return safeList.filter((a) => {
      const fields = [
        a.registration,
        a.model,
        a.manufacturer,
        a.homeAeroclub,
        a.homeBase
      ];
      return fields.some((f) => String(f || '').toLowerCase().includes(query));
    });
  }, [safeList, searchQuery]);

  // KPI flotte — réévalués à chaque rendu (peu d'avions, OK)
  const fleetKPI = useMemo(() => {
    const total = safeList.length;
    let criticalCount = 0;
    let percentageSum = 0;
    let latestUpdateMs = 0;
    safeList.forEach((a) => {
      const ev = evaluateAircraft(a);
      if (ev.hasCriticalGaps) criticalCount += 1;
      percentageSum += ev.percentage || 0;
      const ts = new Date(a.updatedAt || a.updated_at || a.createdAt || 0).getTime();
      if (Number.isFinite(ts) && ts > latestUpdateMs) latestUpdateMs = ts;
    });
    const avgCompletion = total > 0 ? Math.round(percentageSum / total) : 0;
    return {
      total,
      criticalCount,
      avgCompletion,
      latestUpdateMs
    };
  }, [safeList]);

  const formatLatest = (ms) => {
    if (!ms || ms <= 0) return '—';
    try {
      const d = new Date(ms);
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    } catch {
      return '—';
    }
  };

  // 🔧 FIX rules-of-hooks : garde-fou d'UI APRÈS la déclaration de TOUS les
  // hooks (déplacé depuis le début du composant). Si le contexte Aircraft est
  // absent, on affiche l'erreur d'initialisation — les hooks ci-dessus ont déjà
  // tous été appelés, donc leur ordre d'appel reste stable à chaque rendu.
  if (!aircraftContext) {
    console.error('❌ AircraftModule - useAircraft returned null/undefined');
    return (
      <div
        style={{
          padding: tokens.spacing[6],
          backgroundColor: 'var(--bg-surface)',
          border: `${tokens.border.accent} solid var(--color-red-critical)`,
          borderRadius: tokens.radius.sm,
          fontFamily: tokens.fontFamily.sans,
          color: 'var(--text-primary)'
        }}
      >
        <TechLabel style={{ color: 'var(--color-red-critical)' }}>ERREUR · INITIALISATION</TechLabel>
        <h3 style={{ marginTop: tokens.spacing[3], marginBottom: tokens.spacing[2], fontWeight: 600 }}>
          Contexte Aircraft non disponible
        </h3>
        <p style={{ color: 'var(--text-secondary)' }}>
          Vérifiez que AircraftProvider enveloppe bien votre application.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        fontFamily: tokens.fontFamily.sans,
        minHeight: '100vh',
        padding: `clamp(${tokens.spacing[6]}, 4vw, ${tokens.spacing[9]}) clamp(${tokens.spacing[5]}, 3vw, ${tokens.spacing[8]})`,
        boxSizing: 'border-box'
      }}
    >
      {/* ===== HERO ÉDITORIAL : photo + header + KPI superposés ===== */}
      <section
        style={{
          position: 'relative',
          width: '100%',
          minHeight: 'clamp(280px, 38vh, 440px)',
          marginBottom: tokens.spacing[6],
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          backgroundImage: 'url("/assets/photos/hero-warbird.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center 35%',
          display: 'flex',
          alignItems: 'stretch',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: `clamp(${tokens.spacing[5]}, 3vw, ${tokens.spacing[8]})`
        }}
      >
        {/* Overlay sombre dégradé pour lisibilité du texte au-dessus */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, var(--app-bg-alpha-55) 0%, var(--app-bg-alpha-75) 60%, var(--app-bg-alpha-92) 100%)',
            pointerEvents: 'none'
          }}
          aria-hidden="true"
        />
        {/* Liseré orange en bas */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '2px',
            background: 'var(--accent-primary)',
            opacity: 0.55,
            pointerEvents: 'none'
          }}
          aria-hidden="true"
        />

        {/* Contenu superposé : header + KPI */}
        <header
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: tokens.spacing[6]
          }}
        >
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <EditorialHeading level={1} eyebrow="MES AVIONS · FLOTTE">
              Aéronefs
            </EditorialHeading>
            <div
              style={{
                marginTop: tokens.spacing[3],
                fontFamily: tokens.fontFamily.mono,
                fontSize: 'var(--fs-caption)',
                letterSpacing: '0.30em',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)'
              }}
            >
              Perita Per Preparatem
            </div>
          </div>
        </header>
      </section>

      {/* ===== ALERTE CONFIGURATION INCOMPLÈTE (bannière sobre, pas cookie banner) ===== */}
      {showIncompleteDataAlert && incompleteAircraft.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: tokens.spacing[4],
            backgroundColor: 'var(--bg-surface)',
            borderLeft: `${tokens.border.accent} solid var(--accent-primary)`,
            borderTop: `${tokens.border.thin} solid var(--border-subtle)`,
            borderRight: `${tokens.border.thin} solid var(--border-subtle)`,
            borderBottom: `${tokens.border.thin} solid var(--border-subtle)`,
            padding: tokens.spacing[5],
            marginBottom: tokens.spacing[7],
            borderRadius: tokens.radius.sm
          }}
        >
          <AlertTriangle
            size={20}
            style={{ color: 'var(--accent-primary)', marginTop: '2px', flexShrink: 0 }}
            aria-hidden="true"
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <TechLabel style={{ color: 'var(--accent-primary)' }}>ATTENTION · DONNÉES</TechLabel>
            <h4
              style={{
                margin: `${tokens.spacing[2]} 0 ${tokens.spacing[2]}`,
                fontFamily: tokens.fontFamily.sans,
                fontSize: 'var(--fs-title)',
                fontWeight: 600,
                color: 'var(--text-primary)'
              }}
            >
              Configuration incomplète détectée
            </h4>
            <p
              style={{
                margin: `0 0 ${tokens.spacing[4]}`,
                fontSize: 'var(--fs-body)',
                lineHeight: 1.55,
                color: 'var(--text-secondary)'
              }}
            >
              {incompleteAircraft.length} avion{incompleteAircraft.length > 1 ? 's' : ''} n'a{incompleteAircraft.length > 1 ? 'ont' : ''}{' '}
              pas de surfaces compatibles définies. Information requise pour la sélection automatique des aérodromes.
            </p>
            <ul
              style={{
                margin: `0 0 ${tokens.spacing[4]}`,
                paddingLeft: tokens.spacing[5],
                fontSize: 'var(--fs-body)',
                color: 'var(--text-tertiary)',
                fontFamily: tokens.fontFamily.mono,
                letterSpacing: '0.04em'
              }}
            >
              {incompleteAircraft.slice(0, 5).map((a) => (
                <li key={a.id}>
                  {a.registration} — {a.model}
                </li>
              ))}
              {incompleteAircraft.length > 5 && (
                <li style={{ color: 'var(--text-tertiary)' }}>
                  … +{incompleteAircraft.length - 5}
                </li>
              )}
            </ul>
            <div style={{ display: 'flex', gap: tokens.spacing[3], flexWrap: 'wrap' }}>
              <EditorialButton
                variant="primary"
                size="sm"
                onClick={() => {
                  if (incompleteAircraft.length > 0) {
                    handleEdit(incompleteAircraft[0]);
                  }
                }}
              >
                Configurer
              </EditorialButton>
              <EditorialButton
                variant="ghost"
                size="sm"
                onClick={() => setShowIncompleteDataAlert(false)}
              >
                Ignorer
              </EditorialButton>
            </div>
          </div>
        </div>
      )}

      {/* ===== BASE COMMUNAUTAIRE — recherche + import sur la page flotte
            (fusion visuelle : on cherche/choisit un avion partagé puis on entre
            dans l'assistant pré-rempli, comme avant). ===== */}
      <div
        style={{
          marginBottom: tokens.spacing[6],
          padding: tokens.spacing[4],
          backgroundColor: 'var(--bg-overlay)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)'
        }}
      >
        <div style={{ fontSize: 'var(--fs-title)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: tokens.spacing[2] }}>
          Base communautaire
        </div>
        <p style={{ margin: `0 0 ${tokens.spacing[3]}`, fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
          Cherchez un avion partagé (immatriculation, modèle, constructeur) puis importez-le : vous entrez dans l'assistant pré-rempli, comme pour un nouvel avion.
        </p>
        {/* Recherche communautaire = MUI Autocomplete (MÊME composant/UX que
            Step0CommunityCheck « Rechercher par immatriculation ») : menu déroulant
            de toute la base, filtré au fil de la frappe ; sélection → import. */}
        <Autocomplete
          fullWidth
          value={null}
          inputValue={communitySearch}
          onInputChange={(e, v) => {
            if (v === CREATE_FROM_MANEX_OPTION) return; // action, pas une valeur
            setCommunitySearch(v);
          }}
          onChange={(e, newValue) => {
            // Entrée d'action en bas du menu : avion absent de la base →
            // ouvre l'assistant de création (Étape 0 = import MANEX PDF).
            if (newValue === CREATE_FROM_MANEX_OPTION) {
              setSelectedPreset(null);
              setWizardAircraft(null);
              setShowWizard(true);
              return;
            }
            // Sélection ≠ import : on affiche d'abord la fiche de l'avion
            // (métadonnées chargées depuis Supabase) + le bouton « Vérifier les
            // données ». Le téléchargement de la config complète n'a lieu qu'au clic.
            if (!newValue) { setSelectedPreset(null); return; }
            const found = allPresets.find((p) => p.registration === newValue);
            setSelectedPreset(found || null);
          }}
          options={[...allPresets.map((p) => p.registration), CREATE_FROM_MANEX_OPTION]}
          filterOptions={(options, state) => {
            const input = (state.inputValue || '').trim().toUpperCase();
            const matches = options.filter(
              (o) => o !== CREATE_FROM_MANEX_OPTION && (!input || o.toUpperCase().includes(input))
            );
            // L'action reste TOUJOURS visible en bas — y compris quand AUCUNE
            // immatriculation ne correspond (avion absent de la base).
            return [...matches, CREATE_FROM_MANEX_OPTION];
          }}
          renderOption={(props, option) => {
            // eslint-disable-next-line no-unused-vars
            const { key, ...optionProps } = props; // évite un key dupliqué via le spread
            if (option === CREATE_FROM_MANEX_OPTION) {
              return (
                <li
                  key={option}
                  {...optionProps}
                  style={{
                    ...optionProps.style,
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: tokens.spacing[2],
                    paddingTop: tokens.spacing[2],
                    paddingBottom: tokens.spacing[2]
                  }}
                >
                  <Plus size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} aria-hidden="true" />
                  <span>
                    <span style={{ display: 'block', fontWeight: 600, color: 'var(--accent-primary)', fontSize: 'var(--fs-body)' }}>
                      Mon avion n'est pas dans la liste
                    </span>
                    <span style={{ display: 'block', fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
                      Créer la fiche en important le MANEX (PDF)
                    </span>
                  </span>
                </li>
              );
            }
            return (
              <li key={option} {...optionProps}>
                {option}
              </li>
            );
          }}
          loading={presetsLoading}
          size="small"
          disableClearable
          disablePortal
          forcePopupIcon={false}
          sx={{
            mb: 2,
            width: '100%',
            '& .MuiAutocomplete-endAdornment': { right: '8px', top: '50%', transform: 'translateY(-50%)' },
            '& .MuiAutocomplete-popupIndicator': {
              padding: '4px', width: '28px', height: '28px',
              '& .MuiSvgIcon-root': { fontSize: 'var(--fs-title)' },
              '& .MuiTouchRipple-root': { width: '28px', height: '28px' },
            },
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Rechercher par immatriculation"
              placeholder="Ex: F-GBYU"
              size="small"
              sx={{ '& .MuiOutlinedInput-root': { paddingRight: '40px' } }}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {presetsLoading ? <CircularProgress color="inherit" size={16} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />

        {/* ── FICHE de l'avion sélectionné + bouton « Vérifier les données » ──
            MÊME logique que Step0CommunityCheck : la liste ne contient que des
            métadonnées (immat/modèle, déjà chargées) ; on les affiche ici puis,
            au clic, on TÉLÉCHARGE la config complète (aircraft_data) depuis
            Supabase et on entre dans l'assistant pré-rempli. */}
        {selectedPreset && (
          <div
            style={{
              marginTop: tokens.spacing[3],
              padding: tokens.spacing[4],
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--accent-primary)',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2], marginBottom: tokens.spacing[3], flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--fs-title)', fontWeight: 600, color: 'var(--text-primary)' }}>
                {selectedPreset.registration}
              </span>
              {(selectedPreset.adminVerified || selectedPreset.verified) && (
                <span style={{
                  fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--status-success)',
                  border: '1px solid var(--status-success)', borderRadius: 'var(--radius-sm)', padding: '1px 8px'
                }}>
                  ✓ {selectedPreset.adminVerified ? 'Vérifié admin' : 'Vérifié'}
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: tokens.spacing[2], marginBottom: tokens.spacing[4] }}>
              {selectedPreset.model && (
                <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Modèle :</strong> {selectedPreset.model}
                </div>
              )}
              {selectedPreset.manufacturer && (
                <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Constructeur :</strong> {selectedPreset.manufacturer}
                </div>
              )}
              {selectedPreset.type && (
                <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Type :</strong> {selectedPreset.type}
                </div>
              )}
              {selectedPreset.category && (
                <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Catégorie :</strong> {selectedPreset.category}
                </div>
              )}
              <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Version :</strong> {selectedPreset.version}
              </div>
              <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Téléchargements :</strong> {selectedPreset.downloads}
              </div>
              <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Votes :</strong>{' '}
                <span style={{ whiteSpace: 'nowrap' }}>{selectedPreset.votes?.up ?? 0} ✓ / {selectedPreset.votes?.down ?? 0} ✗</span>
              </div>
              <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>MANEX :</strong> {selectedPreset.hasManex ? 'Oui' : 'Non'}
              </div>
            </div>

            <EditorialButton
              variant="primary"
              size="sm"
              loading={importing}
              onClick={() => handleImportFromCommunity(selectedPreset.id)}
            >
              {importing ? 'Téléchargement…' : 'Vérifier les données'}
            </EditorialButton>
          </div>
        )}

        {communityError && (
          <div style={{ marginTop: tokens.spacing[2], color: 'var(--color-red-critical)', fontSize: 'var(--fs-body)' }}>
            ⚠️ {communityError}
          </div>
        )}
      </div>

      {/* Barre « RECHERCHE » flotte retirée (demande pilote) — le filtre
          searchQuery reste neutre (toujours vide ⇒ toute la flotte affichée). */}

      {/* ===== GRID DES AVIONS ===== */}
      <div
        style={{
          display: 'grid',
          gap: tokens.spacing[5],
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))'
        }}
      >
        {filteredAircraftList.length > 0 ? (
          filteredAircraftList.map((aircraft) => {
            const isSelected = selectedAircraft && selectedAircraft.id === aircraft.id;
            // Évaluation complète : % de complétion + champs manquants + criticité
            const completeness = evaluateAircraft(aircraft);
            const { percentage, missing, hasCriticalGaps } = completeness;
            const isMissingExpanded = expandedMissingIds.has(aircraft.id);
            const photoUrl = aircraftPhotos[aircraft.id];
            const manexLoaded = !!(aircraft.hasManex || aircraft.manex);
            const weighingLoaded = !!(aircraft.hasWeighingReport || aircraft.weighingReport?.hasData);

            // Bordure de la card : orange si sélectionné, sinon TRANSPARENT.
            // La card se distingue par son fond surélevé var(--bg-surface) sur
            // le canvas var(--bg-canvas) — pas besoin de bordure claire (qui
            // créait un « cadre blanc » résiduel) ni de bordure rouge critique
            // (orange foncé pollueur). L'info « critique » est déjà transmise
            // par :
            //   • le % en rouge dans CompletionGauge,
            //   • le bouton MANQUANTS avec son texte/icône rouge.
            const cardBorderColor = isSelected
              ? 'var(--accent-primary)'
              : 'transparent';

            return (
              <div
                key={aircraft.id}
                onClick={(e) => {
                  if (e.target.closest('button')) return;
                  handleSelectAircraft(aircraft);
                }}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: '320px',
                  backgroundColor: 'var(--bg-surface)',
                  border: `${tokens.border.thin} solid ${cardBorderColor}`,
                  borderRadius: tokens.radius.sm,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: `border-color ${tokens.motion.base}, transform ${tokens.motion.base}`,
                  // Demande utilisateur : éliminer le "flash bleu" au tap
                  // sur mobile/tablette (overlay natif WebKit/Chrome qui
                  // s'affiche par défaut sur tap d'élément cliquable).
                  WebkitTapHighlightColor: 'transparent',
                  // Garantir aussi qu'aucun outline focus bleu natif ne
                  // s'affiche (on a déjà notre indicateur orange via
                  // border-color au hover).
                  outline: 'none',
                  userSelect: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = cardBorderColor;
                }}
              >
                {/* Background photo : on rend via <img> avec loading="lazy"
                    + decoding="async" plutôt que background-image:url(base64),
                    car Chrome conserve un bitmap RGBA décodé en mémoire pour
                    chaque background-image. Avec 2 photos en pleine résolution
                    caméra (4000×3000), ça représente ~100 MB de bitmap qui
                    saturait le renderer ("Render process gone, out of memory").
                    Le <img> permet au moteur de gérer la mémoire de manière
                    plus agressive (drop si non visible, downsampling natif). */}
                {photoUrl && (
                  <>
                    <img
                      src={photoUrl}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center',
                        filter: 'grayscale(0.45)',
                        zIndex: 0,
                        pointerEvents: 'none'
                      }}
                    />
                    {/* Gradient sombre par-dessus la photo, sans background-image
                        sur la photo elle-même → pas de double bitmap en mémoire. */}
                    <div
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage:
                          'linear-gradient(180deg, var(--app-bg-alpha-35) 0%, var(--app-bg-alpha-92) 100%)',
                        zIndex: 0,
                        pointerEvents: 'none'
                      }}
                    />
                  </>
                )}
                {!photoUrl && (
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: 'var(--bg-overlay)',
                      zIndex: 0
                    }}
                  >
                    <Plane
                      size={120}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        color: 'var(--border-subtle)',
                        opacity: 0.6
                      }}
                      aria-hidden="true"
                    />
                  </div>
                )}

                {/* Contenu de la card */}
                <div
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    padding: tokens.spacing[5],
                    gap: tokens.spacing[4]
                  }}
                >
                  {/* Coins haut : IMMAT + COMPLÉTION */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: tokens.spacing[4]
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[2], minWidth: 0 }}>
                      {/* IMMATRICULATION : libellé en orange (marque ALFlight), valeur en ivoire */}
                      <TechLabel style={{ color: 'var(--accent-primary)' }}>IMMATRICULATION</TechLabel>
                      <div
                        style={{
                          fontFamily: tokens.fontFamily.mono,
                          fontSize: 'var(--fs-title)',
                          fontWeight: 500,
                          letterSpacing: '0.04em',
                          color: 'var(--text-primary)',
                          lineHeight: 1.1,
                          fontVariantNumeric: 'tabular-nums'
                        }}
                      >
                        {aircraft.registration || '—'}
                      </div>
                      {aircraft.wakeTurbulenceCategory && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            alignSelf: 'flex-start',
                            padding: '2px 6px',
                            border: `${tokens.border.thin} solid var(--border-subtle)`,
                            color: 'var(--text-tertiary)',
                            fontFamily: tokens.fontFamily.mono,
                            fontSize: 'var(--fs-caption)',
                            letterSpacing: '0.18em',
                            textTransform: 'uppercase',
                            borderRadius: tokens.radius.sm
                          }}
                        >
                          CAT {aircraft.wakeTurbulenceCategory}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: tokens.spacing[2] }}>
                      <TechLabel active={hasCriticalGaps}>COMPLÉTION</TechLabel>
                      <CompletionGauge percentage={percentage} critical={hasCriticalGaps} />
                    </div>
                  </div>

                  {/* Spacer flex pour pousser le contenu vers le bas */}
                  <div style={{ flex: 1 }} />

                  {/* Indicateurs MANEX / PESÉE — sobres : titre gris, statut en vert si chargé */}
                  {(() => {
                    const okColor = 'var(--accent-primary)'; // vert sapin sémantique (chargé)
                    return (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: tokens.spacing[4],
                          paddingTop: tokens.spacing[3],
                          borderTop: `${tokens.border.thin} solid var(--border-subtle)`
                        }}
                      >
                        {/* MANEX */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <TechLabel>MANEX</TechLabel>
                          <div
                            style={{
                              fontFamily: tokens.fontFamily.mono,
                              fontSize: 'var(--fs-body)',
                              fontWeight: 600,
                              letterSpacing: '0.06em',
                              color: manexLoaded ? okColor : 'var(--text-tertiary)'
                            }}
                          >
                            {manexLoaded ? 'CHARGÉ' : 'ABSENT'}
                          </div>
                          {manexLoaded && aircraft.manex?.pageCount && (
                            <span
                              style={{
                                fontFamily: tokens.fontFamily.mono,
                                fontSize: 'var(--fs-caption)',
                                letterSpacing: '0.10em',
                                color: 'var(--text-tertiary)',
                                textTransform: 'uppercase'
                              }}
                            >
                              {aircraft.manex.pageCount} P.
                            </span>
                          )}
                        </div>

                        {/* PESÉE */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <TechLabel>PESÉE</TechLabel>
                          <div
                            style={{
                              fontFamily: tokens.fontFamily.mono,
                              fontSize: 'var(--fs-body)',
                              fontWeight: 600,
                              letterSpacing: '0.06em',
                              color: weighingLoaded ? okColor : 'var(--text-tertiary)'
                            }}
                          >
                            {weighingLoaded ? 'CHARGÉE' : 'ABSENTE'}
                          </div>
                          {weighingLoaded && aircraft.weighingReport?.weighingDate && (
                            <span
                              style={{
                                fontFamily: tokens.fontFamily.mono,
                                fontSize: 'var(--fs-caption)',
                                letterSpacing: '0.10em',
                                color: 'var(--text-tertiary)',
                                textTransform: 'uppercase'
                              }}
                            >
                              {new Date(aircraft.weighingReport.weighingDate).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: '2-digit'
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Coins bas : MARQUE · MODÈLE · PUISSANCE · AÉROCLUB en grille datasheet.
                      Style unifié sur les 4 champs (factorisé via `fieldValueStyle`) :
                      14px / text-primary / line-height 1.3, pour donner à l'aéroclub
                      la même présence visuelle que la marque/modèle/puissance et
                      éviter qu'il paraisse « secondaire » ou rétréci. */}
                  {(() => {
                    const fieldValueStyle = {
                      fontFamily: tokens.fontFamily.sans,
                      fontSize: 'var(--fs-body)',
                      fontWeight: 400,
                      color: 'var(--text-primary)',
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    };
                    const fieldWrapStyle = { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 };
                    return (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                          gap: tokens.spacing[3]
                        }}
                      >
                        {/* MARQUE */}
                        <div style={fieldWrapStyle}>
                          <TechLabel>MARQUE</TechLabel>
                          <div style={fieldValueStyle}>
                            {aircraft.manufacturer && !['inconnu', 'unknown', 'n/a'].includes(String(aircraft.manufacturer).trim().toLowerCase())
                              ? aircraft.manufacturer
                              : '—'}
                          </div>
                        </div>

                        {/* MODÈLE */}
                        <div style={fieldWrapStyle}>
                          <TechLabel>MODÈLE</TechLabel>
                          <div style={fieldValueStyle}>
                            {aircraft.model || '—'}
                          </div>
                        </div>

                        {/* PUISSANCE */}
                        <div style={fieldWrapStyle}>
                          <TechLabel>PUISSANCE</TechLabel>
                          <div style={fieldValueStyle}>
                            {aircraft.horsepower ? `${aircraft.horsepower} CV` : '—'}
                          </div>
                        </div>

                        {/* AÉROCLUB / BASE */}
                        <div style={fieldWrapStyle}>
                          <TechLabel>{aircraft.homeAeroclub ? 'AÉROCLUB' : 'BASE'}</TechLabel>
                          <div style={fieldValueStyle}>
                            {aircraft.homeAeroclub || aircraft.homeBase || '—'}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Actions — barre centrée : dropdown manquants + 5 boutons d'action.
                      Helper local pour homogénéiser les boutons icônes. */}
                  {(() => {
                    // baseBtn — utilise --border-subtle (très discret) plutôt
                    // que --border-regular (ivoire visible) pour éviter
                    // l'effet « contours blancs » sur la card. Hover révèle
                    // l'orange ALFlight pour signaler l'interactivité.
                    const baseBtn = {
                      minWidth: '44px',
                      minHeight: '44px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'transparent',
                      border: `${tokens.border.thin} solid var(--border-subtle)`,
                      borderRadius: tokens.radius.sm,
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: `border-color ${tokens.motion.fast}, color ${tokens.motion.fast}, background-color ${tokens.motion.fast}`
                    };
                    const hoverIn = (e, color = 'var(--accent-primary)') => {
                      e.currentTarget.style.borderColor = color;
                      e.currentTarget.style.color = color;
                    };
                    const hoverOut = (e) => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    };
                    return (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          justifyContent: 'center',
                          alignItems: 'center',
                          gap: tokens.spacing[2],
                          paddingTop: tokens.spacing[3],
                          borderTop: `${tokens.border.thin} solid var(--border-subtle)`
                        }}
                      >
                        {/* Bouton MANQUANTS — aligné visuellement et typographiquement
                            sur les boutons d'action (MANEX, PESÉE, FICHE) :
                            fond transparent, bordure subtile, libellé mono dans
                            un <span> avec font-size 11px / letter-spacing 0.08em.
                            Pas d'icône décorative (triangle), pas de gras 600,
                            pas de pill rouge — l'info « X manquants » suffit. */}
                        {missing.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedMissingIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(aircraft.id)) next.delete(aircraft.id);
                                else next.add(aircraft.id);
                                return next;
                              });
                            }}
                            title={`${missing.length} champ${missing.length > 1 ? 's' : ''} manquant${missing.length > 1 ? 's' : ''}`}
                            aria-label={`${missing.length} manquant${missing.length > 1 ? 's' : ''}`}
                            aria-expanded={isMissingExpanded}
                            style={{
                              ...baseBtn,
                              padding: `0 ${tokens.spacing[2]}`,
                              gap: '6px',
                              color: 'var(--accent-primary)'
                            }}
                            onMouseEnter={(e) => hoverIn(e)}
                            onMouseLeave={hoverOut}
                          >
                            <span
                              style={{
                                fontFamily: tokens.fontFamily.mono,
                                fontSize: 'var(--fs-caption)',
                                letterSpacing: '0.08em'
                              }}
                            >
                              {missing.length} MANQUANT{missing.length > 1 ? 'S' : ''}
                            </span>
                          </button>
                        )}

                        {/* Helper render bouton avec icône + libellé court mono pour clarté */}
                        {/* 1. MANEX — icône Book = manuel d'utilisation, plus reconnaissable */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadManex(aircraft);
                          }}
                          title={manexLoaded ? 'Télécharger le MANEX (manuel de vol)' : 'Aucun MANEX disponible'}
                          aria-label="Télécharger le MANEX"
                          disabled={!manexLoaded}
                          style={{
                            ...baseBtn,
                            padding: `0 ${tokens.spacing[2]}`,
                            gap: '6px',
                            color: manexLoaded ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                            opacity: manexLoaded ? 1 : 0.4,
                            cursor: manexLoaded ? 'pointer' : 'not-allowed'
                          }}
                          onMouseEnter={manexLoaded ? (e) => hoverIn(e) : undefined}
                          onMouseLeave={manexLoaded ? hoverOut : undefined}
                        >
                          <BookOpen size={16} aria-hidden="true" />
                          <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: 'var(--fs-caption)', letterSpacing: '0.08em' }}>MANEX</span>
                        </button>

                        {/* 2. Fiche de pesée — icône Scale = balance, sémantique aviation */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadWeighingReport(aircraft);
                          }}
                          title={weighingLoaded ? 'Télécharger la fiche de pesée (PDF)' : 'Aucune fiche de pesée disponible'}
                          aria-label="Télécharger la fiche de pesée"
                          disabled={!weighingLoaded}
                          style={{
                            ...baseBtn,
                            padding: `0 ${tokens.spacing[2]}`,
                            gap: '6px',
                            color: weighingLoaded ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                            opacity: weighingLoaded ? 1 : 0.4,
                            cursor: weighingLoaded ? 'pointer' : 'not-allowed'
                          }}
                          onMouseEnter={weighingLoaded ? (e) => hoverIn(e) : undefined}
                          onMouseLeave={weighingLoaded ? hoverOut : undefined}
                        >
                          <Scale size={16} aria-hidden="true" />
                          <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: 'var(--fs-caption)', letterSpacing: '0.08em' }}>PESÉE</span>
                        </button>

                        {/* 3. Fiche PDF avion (rapport complet) — icône Download distincte */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGeneratePDF(aircraft);
                          }}
                          title="Générer la fiche PDF complète de l'avion"
                          aria-label="Générer la fiche PDF complète"
                          style={{ ...baseBtn, padding: `0 ${tokens.spacing[2]}`, gap: '6px' }}
                          onMouseEnter={(e) => hoverIn(e)}
                          onMouseLeave={hoverOut}
                        >
                          <Download size={16} aria-hidden="true" />
                          <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: 'var(--fs-caption)', letterSpacing: '0.08em' }}>FICHE</span>
                        </button>

                        {/* 4. Modifier */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenWizard(aircraft);
                          }}
                          title="Modifier l'avion"
                          aria-label="Modifier l'avion"
                          style={baseBtn}
                          onMouseEnter={(e) => hoverIn(e)}
                          onMouseLeave={hoverOut}
                        >
                          <Edit2 size={16} aria-hidden="true" />
                        </button>

                        {/* 5. Supprimer */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(aircraft);
                          }}
                          title="Supprimer l'avion"
                          aria-label="Supprimer l'avion"
                          style={baseBtn}
                          onMouseEnter={(e) => hoverIn(e, 'var(--color-red-critical)')}
                          onMouseLeave={hoverOut}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })()}

                  {/* Panel des champs manquants — s'ouvre EN BAS de la card */}
                  {isMissingExpanded && missing.length > 0 && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        marginTop: tokens.spacing[2],
                        backgroundColor: 'var(--bg-overlay)',
                        border: `${tokens.border.thin} solid var(--border-subtle)`,
                        borderRadius: tokens.radius.sm,
                        padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
                        maxHeight: '240px',
                        overflowY: 'auto'
                      }}
                    >
                      <TechLabel style={{ marginBottom: tokens.spacing[2], display: 'block' }}>
                        À compléter
                      </TechLabel>
                      {['CRITICAL', 'REQUIRED', 'OPTIONAL'].map((sev) => {
                        // R22 — les tables de performance ont leur propre bloc
                        // « Performances » (plus bas) : on les exclut des
                        // groupes génériques par criticité.
                        const items = missing.filter((m) => m.severity === sev && m.group !== 'PERFORMANCE');
                        if (items.length === 0) return null;
                        const labelMap = { CRITICAL: 'Critiques', REQUIRED: 'Obligatoires', OPTIONAL: 'Optionnels' };
                        // Palette unifiée — plus de rouge critique parasite.
                        // L'ordre du dropdown (CRITICAL > REQUIRED > OPTIONAL)
                        // et le libellé suffisent à porter la hiérarchie.
                        const sevColor =
                          sev === 'OPTIONAL'
                            ? 'var(--text-tertiary)'
                            : 'var(--accent-primary)';
                        return (
                          <div key={sev} style={{ marginBottom: tokens.spacing[3] }}>
                            <div
                              style={{
                                fontFamily: tokens.fontFamily.mono,
                                fontSize: 'var(--fs-caption)',
                                letterSpacing: '0.18em',
                                textTransform: 'uppercase',
                                color: sevColor,
                                fontWeight: 600,
                                marginBottom: '4px'
                              }}
                            >
                              {labelMap[sev]} · {items.length}
                            </div>
                            {items.map((item) => (
                              <div
                                key={item.path}
                                style={{
                                  display: 'flex',
                                  gap: tokens.spacing[2],
                                  paddingLeft: tokens.spacing[3],
                                  color: 'var(--text-secondary)',
                                  fontSize: 'var(--fs-body)',
                                  lineHeight: 1.5
                                }}
                              >
                                <span style={{ color: sevColor }}>·</span>
                                <span>{item.label}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })}

                      {/* R22 — bloc dédié « Performances » : liste NOMINATIVE des
                          tables manquantes (décollage/atterrissage × volets),
                          chacune marquable « non applicable » (bypass). */}
                      {(() => {
                        const perfItems = missing.filter((m) => m.group === 'PERFORMANCE');
                        if (perfItems.length === 0) return null;
                        return (
                          <div style={{ marginBottom: tokens.spacing[3] }}>
                            <div
                              style={{
                                fontFamily: tokens.fontFamily.mono,
                                fontSize: 'var(--fs-caption)',
                                letterSpacing: '0.18em',
                                textTransform: 'uppercase',
                                color: 'var(--accent-primary)',
                                fontWeight: 600,
                                marginBottom: '4px'
                              }}
                            >
                              Performances — tables manquantes · {perfItems.length}
                            </div>
                            {perfItems.map((item) => (
                              <div
                                key={item.path}
                                style={{
                                  display: 'flex',
                                  gap: tokens.spacing[2],
                                  alignItems: 'center',
                                  paddingLeft: tokens.spacing[3],
                                  color: 'var(--text-secondary)',
                                  fontSize: 'var(--fs-body)',
                                  lineHeight: 1.5
                                }}
                              >
                                <span style={{ color: 'var(--accent-primary)' }}>·</span>
                                <span style={{ flex: 1 }}>{item.label}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleTogglePerfBypass(aircraft, item.path); }}
                                  title="Marquer cette table comme non applicable à cet avion (ex. pas de cran volets concerné)"
                                  style={{
                                    padding: '1px 8px',
                                    fontSize: 'var(--fs-caption)',
                                    cursor: 'pointer',
                                    backgroundColor: 'transparent',
                                    color: 'var(--text-tertiary)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: tokens.radius.sm,
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  non applicable
                                </button>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          // État vide : photo cinematic + texte centré par-dessus
          <div
            style={{
              gridColumn: '1 / -1',
              position: 'relative',
              minHeight: 'clamp(360px, 50vh, 520px)',
              padding: `${tokens.spacing[10]} ${tokens.spacing[6]}`,
              textAlign: 'center',
              backgroundColor: 'var(--bg-surface)',
              border: `${tokens.border.thin} solid var(--border-subtle)`,
              borderRadius: tokens.radius.sm,
              backgroundImage: 'url("/assets/photos/empty-dark.jpg")',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {/* Overlay sombre pour lisibilité du texte */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(180deg, var(--app-bg-alpha-55) 0%, var(--app-bg-alpha-85) 100%)'
              }}
              aria-hidden="true"
            />
            {/* Contenu au-dessus de l'overlay */}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <TechLabel style={{ display: 'block', marginBottom: tokens.spacing[3] }}>
                {searchQuery ? 'AUCUN RÉSULTAT' : 'FLOTTE VIDE'}
              </TechLabel>
              <p
                style={{
                  margin: `0 0 ${tokens.spacing[5]}`,
                  fontSize: 'var(--fs-body)',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.55,
                  maxWidth: '420px'
                }}
              >
                {searchQuery
                  ? `Aucun avion ne correspond à « ${searchQuery} ».`
                  : 'Aucun avion enregistré. Ajoutez votre premier aéronef pour commencer.'}
              </p>
              {!searchQuery && (
                <EditorialButton
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setWizardAircraft(null);
                    setShowWizard(true);
                  }}
                >
                  <Plus size={14} aria-hidden="true" />
                  Nouvel avion
                </EditorialButton>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer éditorial sobre */}
      <footer
        style={{
          marginTop: tokens.spacing[10],
          paddingTop: tokens.spacing[6],
          borderTop: `${tokens.border.thin} solid var(--border-subtle)`,
          textAlign: 'center',
          fontFamily: tokens.fontFamily.mono,
          fontSize: 'var(--fs-caption)',
          letterSpacing: '0.30em',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)'
        }}
      >
        ALFLIGHT · PERITA PER PREPARATEM
      </footer>

      {/* API Key Test Component - Temporairement désactivé */}
      {/* <APIKeyTest /> */}

      {/* ===== Dialogue de confirmation de suppression (remplace window.confirm) ===== */}
      {deletePending && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="aircraft-delete-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: tokens.palette?.alpha?.overlay || 'var(--app-bg-alpha-72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: tokens.zIndex.modal,
            padding: tokens.spacing[5]
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelDelete();
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: `${tokens.border.thin} solid var(--border-regular)`,
              borderLeft: `${tokens.border.accent} solid var(--color-red-critical)`,
              borderRadius: tokens.radius.sm,
              padding: tokens.spacing[6],
              maxWidth: '460px',
              width: '100%',
              boxShadow: tokens.shadow.lift
            }}
          >
            <TechLabel style={{ color: 'var(--color-red-critical)' }}>SUPPRESSION · CONFIRMATION</TechLabel>
            <h3
              id="aircraft-delete-title"
              style={{
                margin: `${tokens.spacing[3]} 0 ${tokens.spacing[3]}`,
                fontFamily: tokens.fontFamily.sans,
                fontSize: 'var(--fs-title)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                lineHeight: 1.3
              }}
            >
              Supprimer l'aéronef ?
            </h3>
            <p
              style={{
                margin: `0 0 ${tokens.spacing[5]}`,
                fontSize: 'var(--fs-body)',
                color: 'var(--text-secondary)',
                lineHeight: 1.55
              }}
            >
              <DataReadout value={deletePending.registration} size="sm" />
              {deletePending.model ? ` — ${deletePending.model}` : ''} sera retiré de votre flotte.
              Cette action est irréversible.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: tokens.spacing[3] }}>
              <EditorialButton variant="ghost" size="md" onClick={cancelDelete}>
                Annuler
              </EditorialButton>
              <EditorialButton variant="critical" size="md" onClick={confirmDelete}>
                Supprimer
              </EditorialButton>
            </div>
          </div>
        </div>
      )}

      {/* ===== Alerte d'erreur éditoriale (NightModeAlert) ===== */}
      {opError && (
        <NightModeAlert
          severity={opError.severity || 'warn'}
          title={opError.title}
          description={opError.description}
          onClose={() => setOpError(null)}
        />
      )}

      {/* Modal formulaire */}
      {showForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: tokens.palette?.alpha?.overlay || 'var(--app-bg-alpha-72)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: tokens.zIndex.modal
        }}>
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: `${tokens.border.thin} solid var(--border-regular)`,
            borderRadius: tokens.radius.sm,
            padding: tokens.spacing[6],
            maxWidth: '800px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            position: 'relative',
            boxShadow: tokens.shadow.lift,
            color: 'var(--text-primary)',
            fontFamily: tokens.fontFamily.sans
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: tokens.spacing[6],
              position: 'sticky',
              top: `-${tokens.spacing[6]}`,
              backgroundColor: 'var(--bg-surface)',
              paddingBottom: tokens.spacing[3],
              borderBottom: `${tokens.border.thin} solid var(--border-subtle)`,
              zIndex: 10
            }}>
              <div style={{ textAlign: 'center' }}>
                <TechLabel>{editingAircraft ? 'ÉDITION · AÉRONEF' : 'CRÉATION · AÉRONEF'}</TechLabel>
                <h3 style={{
                  margin: `${tokens.spacing[2]} 0 0`,
                  fontFamily: tokens.fontFamily.sans,
                  fontSize: 'var(--fs-title)',
                  fontWeight: 500,
                  color: 'var(--text-primary)'
                }}>
                  {editingAircraft ? `Informations ${editingAircraft.registration}` : 'Nouvel avion'}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => {
                  setShowForm(false);
                  setEditingAircraft(null);
                }}
                style={{
                  position: 'absolute',
                  right: 0,
                  padding: tokens.spacing[2],
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                  transition: `color ${tokens.motion.fast}`,
                  minWidth: '44px',
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <AircraftForm
              aircraft={editingAircraft}
              onSubmit={async (processedData) => {
                console.log('💾 AircraftModule - Form submitted with processed data:', processedData);
                console.log('💾 AircraftModule - Speeds in processed data:', processedData.speeds);
                console.log('💾 AircraftModule - Surfaces compatibles:', processedData.compatibleRunwaySurfaces);
                
                try {
                  // Séparer les données volumineuses (photo, manex, weighingReport)
                  // pour éviter de polluer la liste en mémoire avec des base64 lourds.
                  const { photo, manex, weighingReport, ...lightData } = processedData;

                  if (editingAircraft) {
                    const updatedAircraft = {...lightData, id: editingAircraft.id};

                    // Marquer si l'avion a des données volumineuses (flags pour
                    // re-chargement lazy depuis IndexedDB lors d'une édition future)
                    if (photo) updatedAircraft.hasPhoto = true;
                    if (manex) updatedAircraft.hasManex = true;
                    if (weighingReport) updatedAircraft.hasWeighingReport = true;

                    console.log('💾 AircraftModule - Updating aircraft with speeds:', updatedAircraft.speeds);

                    // Sauvegarder les données volumineuses dans IndexedDB si elles existent
                    if (photo || manex || weighingReport) {
                      const fullAircraft = {
                        ...updatedAircraft,
                        photo: photo || null,
                        manex: manex || null,
                        weighingReport: weighingReport || null
                      };
                      await dataBackupManager.saveAircraftData(fullAircraft);
                      console.log('✅ Données volumineuses sauvegardées dans IndexedDB');
                    }
                    
                    // Mettre à jour avec les données légères.
                    // ⚠️ await OBLIGATOIRE : updateAircraft rejette si la persistance
                    // cloud échoue (RLS/session). Sans await, le rejet était avalé et
                    // le formulaire se fermait en affichant un faux « succès ».
                    await updateAircraft(updatedAircraft);
                    console.log('✅ AircraftModule - Aircraft updated with speeds');
                  } else {
                    console.log('💾 AircraftModule - Adding new aircraft');
                    console.log('💾 AircraftModule - Données complètes à ajouter:', lightData);
                    
                    // Utiliser l'ID existant ou en créer un nouveau
                    if (!lightData.id) {
                      lightData.id = `aircraft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    }
                    
                    // Marquer si l'avion a des données volumineuses
                    if (photo) lightData.hasPhoto = true;
                    if (manex) lightData.hasManex = true;
                    if (weighingReport) lightData.hasWeighingReport = true;

                    // Sauvegarder les données volumineuses dans IndexedDB si elles existent
                    if (photo || manex || weighingReport) {
                      const fullAircraft = {
                        ...lightData,
                        photo: photo || null,
                        manex: manex || null,
                        weighingReport: weighingReport || null
                      };
                      await dataBackupManager.saveAircraftData(fullAircraft);
                      console.log('✅ Données volumineuses sauvegardées dans IndexedDB');
                    }
                    
                    // ⚠️ await OBLIGATOIRE : laisser le rejet remonter au catch
                    // englobant pour afficher l'erreur réelle (au lieu de l'avaler
                    // ici et de fermer le formulaire sur un faux succès).
                    const result = await addAircraft(lightData);
                    console.log('✅ AircraftModule - addAircraft result:', result);
                    console.log('✅ AircraftModule - New aircraft added');
                  }
                  setShowForm(false);
                  setEditingAircraft(null);
                } catch (error) {
                  console.error('❌ AircraftModule - Erreur lors de la sauvegarde:', error);

                  // Si c'est une erreur de quota, on nettoie automatiquement et on demande de réessayer
                  if (error.name === 'QuotaExceededError' || (error.message || '').includes('quota')) {
                    try {
                      await dataBackupManager.cleanupLocalStorage();
                      setOpError({
                        severity: 'warn',
                        title: 'Stockage local saturé',
                        description: 'Le cache local a été nettoyé automatiquement. Veuillez réessayer la sauvegarde.'
                      });
                    } catch (cleanupErr) {
                      console.error('❌ Nettoyage du stockage échoué:', cleanupErr);
                      setOpError({
                        severity: 'critical',
                        title: 'Stockage local saturé',
                        description: 'Impossible de nettoyer le stockage. Libérez de l\'espace puis réessayez.'
                      });
                    }
                  } else {
                    setOpError({
                      severity: 'critical',
                      title: 'Sauvegarde impossible',
                      description: error?.message || 'Une erreur inattendue est survenue.'
                    });
                  }
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

      {/* Modal Assistant de création/modification */}
      {showWizard && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: tokens.palette?.alpha?.overlay || 'var(--app-bg-alpha-72)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: tokens.zIndex.modal
        }}>
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: `${tokens.border.thin} solid var(--border-regular)`,
            borderRadius: tokens.radius.sm,
            maxWidth: '1200px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            position: 'relative',
            boxShadow: tokens.shadow.lift
          }}>
            <AircraftCreationWizard
              existingAircraft={wizardAircraft}
              onClose={() => {
                setShowWizard(false);
                setWizardAircraft(null);
              }}
              onComplete={async (aircraftData) => {
                console.log('✅ Wizard completed with data:', aircraftData);

                try {
                  // Séparer les données volumineuses
                  const { photo, manex, ...lightData } = aircraftData;

                  if (wizardAircraft) {
                    // Mode édition : mettre à jour l'avion existant
                    const updatedAircraft = {
                      ...lightData,
                      id: wizardAircraft.id,
                      photo: photo || null,
                      manex: manex || null
                    };

                    // Marquer si l'avion a des données volumineuses
                    if (photo) updatedAircraft.hasPhoto = true;
                    if (manex) updatedAircraft.hasManex = true;
                    if (updatedAircraft.advancedPerformance || updatedAircraft.performanceTables || updatedAircraft.performanceModels) {
                      updatedAircraft.hasPerformance = true;
                      console.log('✅ Wizard - Données de performance détectées et marquées');
                    }

                    console.log('💾 Wizard - Updating aircraft with photo:', !!photo, 'manex:', !!manex);

                    if (manex) {
                      console.log('📦 MANEX à sauvegarder (update):', {
                        fileName: manex.fileName,
                        hasPdfData: !!manex.pdfData,
                        hasFile: !!manex.file,
                        pdfDataLength: manex.pdfData ? manex.pdfData.length : 0,
                        fileLength: manex.file ? manex.file.length : 0,
                        keys: Object.keys(manex)
                      });
                    }

                    // Sauvegarder les données volumineuses dans IndexedDB
                    await dataBackupManager.saveAircraftData(updatedAircraft);
                    console.log('✅ Wizard - Données volumineuses sauvegardées dans IndexedDB');

                    // Mettre à jour avec l'objet complet (photo/manex inclus)
                    updateAircraft(updatedAircraft);
                    console.log('✅ Wizard - Aircraft updated');
                  } else {
                    // Mode création : ajouter un nouvel avion
                    console.log('💾 Wizard - Adding new aircraft');

                    // Utiliser l'ID existant ou en créer un nouveau
                    if (!lightData.id) {
                      lightData.id = `aircraft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    }

                    // Marquer si l'avion a des données volumineuses
                    if (photo) lightData.hasPhoto = true;
                    if (manex) lightData.hasManex = true;
                    if (lightData.advancedPerformance || lightData.performanceTables || lightData.performanceModels) {
                      lightData.hasPerformance = true;
                      console.log('✅ Wizard - Données de performance détectées et marquées (nouveau)');
                    }

                    console.log('💾 Wizard - New aircraft photo:', !!photo, 'manex:', !!manex);

                    // Sauvegarder les données volumineuses dans IndexedDB si elles existent
                    if (photo || manex || lightData.hasPerformance) {
                      const fullAircraft = {
                        ...lightData,
                        photo: photo || null,
                        manex: manex || null
                      };
                      await dataBackupManager.saveAircraftData(fullAircraft);
                      console.log('✅ Wizard - Données volumineuses sauvegardées dans IndexedDB');
                    }

                    addAircraft(lightData);
                    console.log('✅ Wizard - New aircraft added');
                  }

                  // 🔧 FIX: Recharger la liste des avions depuis Supabase pour synchroniser
                  console.log('🔄 Rechargement de la liste des avions depuis Supabase...');
                  await refreshFromSupabase();
                  console.log('✅ Liste des avions rechargée');

                  // 🔧 FIX CRITIQUE: Copier les données volumineuses de l'ID temporaire vers l'ID Supabase
                  const tempId = wizardAircraft?.id || lightData?.id;
                  const aircraftRegistration = wizardAircraft?.registration || lightData?.registration;

                  // Récupérer la liste à jour depuis le store (pas depuis le contexte qui n'est pas encore mis à jour)
                  const updatedAircraftList = useAircraftStore.getState().aircraftList;
                  const supabaseAircraft = updatedAircraftList.find(a => a.registration === aircraftRegistration);
                  const supabaseId = supabaseAircraft?.id;

                  console.log('🔄 Migration données volumineuses:', {
                    tempId,
                    aircraftRegistration,
                    supabaseId,
                    hasPhoto: !!photo,
                    hasManex: !!manex,
                    updatedListLength: updatedAircraftList.length
                  });

                  if (tempId && supabaseId && tempId !== supabaseId && (photo || manex)) {
                    try {
                      // Récupérer les données de l'ID temporaire
                      const tempData = await dataBackupManager.getAircraftData(tempId);
                      console.log('📦 Données temp récupérées:', {
                        hasData: !!tempData,
                        hasPhoto: !!tempData?.photo,
                        hasManex: !!tempData?.manex
                      });

                      if (tempData) {
                        // Sauvegarder avec le nouvel ID Supabase
                        const migratedData = {
                          ...tempData,
                          id: supabaseId
                        };
                        await dataBackupManager.saveAircraftData(migratedData);
                        console.log('✅ Données migrées vers ID Supabase:', supabaseId);

                        // Supprimer l'ancienne entrée avec l'ID temporaire
                        await dataBackupManager.deleteAircraftData(tempId);
                        console.log('🗑️ Anciennes données temp supprimées:', tempId);
                      }
                    } catch (err) {
                      console.error('⚠️ Erreur migration données volumineuses:', err);
                    }
                  }

                  setShowWizard(false);
                  setWizardAircraft(null);
                } catch (error) {
                  console.error('❌ Wizard - Erreur lors de la sauvegarde:', error);
                  setOpError({
                    severity: 'critical',
                    title: 'Sauvegarde impossible',
                    description: error?.message || 'Une erreur inattendue est survenue.'
                  });
                }
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
});

AircraftModule.displayName = 'AircraftModule';

// Composant de formulaire pour ajouter/modifier un avion
const AircraftForm = memo(({ aircraft, onSubmit, onCancel }) => {
  const { format, convert, getSymbol, toStorage, getUnit } = useUnits();
  const units = useUnitsWatcher(); // Force re-render on units change
  const massUnit = getSymbol('weight');
  const fuelUnit = getSymbol('fuel');
  const armUnit = getSymbol('armLength');
  const consumptionUnit = getUnit('fuel') === 'ltr' ? 'L/h' : getUnit('fuel') === 'gal' ? 'gal/h' : `${getSymbol('fuel')}/h`;
  // États pour les sections collapsibles
  const [showGeneral, setShowGeneral] = useState(false);
  const [showPerformances, setShowPerformances] = useState(false);
  const [showMasseCentrage, setShowMasseCentrage] = useState(false);
  const [showEquipements, setShowEquipements] = useState(false);
  const [showOperations, setShowOperations] = useState(false);
  const [showRemarques, setShowRemarques] = useState(false);
  const [showPerformancesIA, setShowPerformancesIA] = useState(false);
  const [aircraftPhoto, setAircraftPhoto] = useState(aircraft?.photo || null);

  // DEBUG : Afficher l'avion reçu en props
  // console.log('🛩️ AircraftForm - aircraft reçu:', aircraft);
  // console.log('🛩️ AircraftForm - surfaces compatibles de l\'avion:', aircraft?.compatibleRunwaySurfaces);
  // console.log('🛩️ AircraftForm - ID de l\'avion:', aircraft?.id);

  // Valider et normaliser les surfaces compatibles
  const getValidSurfaces = (surfaces) => {
    // Pour un nouvel avion (aircraft est null), pas de valeurs par défaut
    if (!aircraft) return [];
    
    // Pour un avion existant, préserver ses surfaces ou utiliser un tableau vide
    if (!surfaces) return [];
    if (!Array.isArray(surfaces)) return [];
    
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
    baseFactor: aircraft?.baseFactor || '',  // Facteur de base calculé automatiquement
    fuelConsumption: aircraft?.fuelConsumption || '',
    maxTakeoffWeight: aircraft?.maxTakeoffWeight || '',
    wakeTurbulenceCategory: aircraft?.wakeTurbulenceCategory || 'L', // L=Light, M=Medium, H=Heavy, J=Super
    compatibleRunwaySurfaces: getValidSurfaces(aircraft?.compatibleRunwaySurfaces), // Valider les surfaces
    // Section Performances - Vitesses caractéristiques
    speeds: {
      vso: aircraft?.speeds?.vso || aircraft?.manex?.performances?.vso || '',  // Vitesse de décrochage volets sortis
      vs1: aircraft?.speeds?.vs1 || aircraft?.manex?.performances?.vs1 || '',  // Vitesse de décrochage volets rentrés
      vr: aircraft?.speeds?.vr || '',    // Vitesse de rotation
      vfe: aircraft?.speeds?.vfe || aircraft?.manex?.performances?.vfe || '',  // Vitesse max volets sortis (compatibilité ancienne)
      vfeLdg: aircraft?.speeds?.vfeLdg || '',    // Vitesse max volets LDG (atterrissage)
      vfeTO: aircraft?.speeds?.vfeTO || '',      // Vitesse max volets T/O (décollage)
      vno: aircraft?.speeds?.vno || aircraft?.manex?.performances?.vno || '',  // Vitesse max en air calme
      vne: aircraft?.speeds?.vne || aircraft?.manex?.performances?.vne || '',  // Vitesse à ne jamais dépasser
      vx: aircraft?.speeds?.vx || aircraft?.manex?.performances?.vx || '',    // Vitesse de montée max (pente)
      vy: aircraft?.speeds?.vy || aircraft?.manex?.performances?.vy || '',    // Vitesse de montée optimale (taux)
      vapp: aircraft?.speeds?.vapp || '',  // Vitesse d'approche
      vle: aircraft?.speeds?.vle || '',  // Vitesse max train sorti
      vlo: aircraft?.speeds?.vlo || '',  // Vitesse max manœuvre train
      initialClimb: aircraft?.speeds?.initialClimb || '',  // Vitesse de montée initiale
      vglide: aircraft?.speeds?.vglide || '',  // Vitesse de plané optimal
      // VO - Operating manoeuvring speed (variable selon la masse)
      voWeight1: aircraft?.speeds?.voWeight1 || '',     // Masse max pour VO1
      voSpeed1: aircraft?.speeds?.voSpeed1 || '',       // VO1
      voWeight2Min: aircraft?.speeds?.voWeight2Min || '', // Masse min pour VO2
      voWeight2Max: aircraft?.speeds?.voWeight2Max || '', // Masse max pour VO2
      voSpeed2: aircraft?.speeds?.voSpeed2 || '',       // VO2
      voWeight3: aircraft?.speeds?.voWeight3 || '',     // Masse min pour VO3
      voSpeed3: aircraft?.speeds?.voSpeed3 || ''        // VO3
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
      climbGradient: aircraft?.climb?.climbGradient || ''  // Gradient de montée (%)
    },
    // Section Limitations de vent
    windLimits: {
      maxCrosswind: aircraft?.windLimits?.maxCrosswind || aircraft?.manex?.limitations?.maxCrosswind || '',
      maxTailwind: aircraft?.windLimits?.maxTailwind || aircraft?.manex?.limitations?.maxTailwind || '',
      maxCrosswindWet: aircraft?.windLimits?.maxCrosswindWet || ''
    },
    masses: {
      emptyMass: aircraft?.masses?.emptyMass || '',
      minTakeoffMass: aircraft?.masses?.minTakeoffMass || '',
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
    // Enveloppe de centrage
    cgEnvelope: {
      // Points CG avant (forward) - tableau dynamique
      forwardPoints: aircraft?.cgEnvelope?.forwardPoints && aircraft.cgEnvelope.forwardPoints.length > 0
        ? aircraft.cgEnvelope.forwardPoints
        : [{ weight: '', cg: '', id: Date.now() + Math.random() }],
      // CG arrière (aft)
      aftMinWeight: aircraft?.cgEnvelope?.aftMinWeight || '',  // Masse min pour CG arrière
      aftCG: aircraft?.cgEnvelope?.aftCG || '',  // CG arrière (constant ou à masse min)
      aftMaxWeight: aircraft?.cgEnvelope?.aftMaxWeight || '',  // Masse max pour CG arrière (si différente)
    },
    // Sièges supplémentaires dynamiques
    additionalSeats: aircraft?.additionalSeats || [],
    // Compartiments bagages dynamiques
    baggageCompartments: aircraft?.baggageCompartments && aircraft.baggageCompartments.length > 0
      ? aircraft.baggageCompartments
      : [
          { 
            id: Date.now() + Math.random(), 
            name: 'Compartiment standard', 
            arm: aircraft?.armLengths?.standardBaggageArm || '', 
            maxWeight: aircraft?.limitations?.maxBaggageLest || '' 
          }
        ],
    // Remarques du manuel
    manualRemarks: aircraft?.manualRemarks || '',
    emergencyNotes: aircraft?.emergencyNotes || '',
    maintenanceNotes: aircraft?.maintenanceNotes || '',
    // Analyse IA des performances
    performance: aircraft?.performance || null,
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
    },
    // Opérations approuvées
    approvedOperations: {
      vfrDay: aircraft?.approvedOperations?.vfrDay !== false,  // VFR jour (par défaut true)
      vfrNight: aircraft?.approvedOperations?.vfrNight || false,  // VFR nuit
      ifrDay: aircraft?.approvedOperations?.ifrDay || false,  // IFR jour
      ifrNight: aircraft?.approvedOperations?.ifrNight || false,  // IFR nuit
      svfr: aircraft?.approvedOperations?.svfr || false,  // Special VFR
      formation: aircraft?.approvedOperations?.formation || false,  // Vol en formation
      aerobatics: aircraft?.approvedOperations?.aerobatics || false,  // Voltige
      banner: aircraft?.approvedOperations?.banner || false,  // Remorquage de bannière
      glider: aircraft?.approvedOperations?.glider || false,  // Remorquage de planeur
      parachute: aircraft?.approvedOperations?.parachute || false,  // Largage de parachutistes
      agricultural: aircraft?.approvedOperations?.agricultural || false,  // Épandage agricole
      aerial: aircraft?.approvedOperations?.aerial || false,  // Photographie/surveillance aérienne
      training: aircraft?.approvedOperations?.training || false,  // École de pilotage
      charter: aircraft?.approvedOperations?.charter || false,  // Transport public
      mountainous: aircraft?.approvedOperations?.mountainous || false,  // Vol en montagne
      seaplane: aircraft?.approvedOperations?.seaplane || false,  // Hydravion
      skiPlane: aircraft?.approvedOperations?.skiPlane || false,  // Avion sur skis
      icing: aircraft?.approvedOperations?.icing || false  // Vol en conditions givrantes
    }
  });

  // Réinitialiser le formulaire quand l'avion change
  React.useEffect(() => {
    // console.log('🔄 AircraftForm - useEffect triggered, aircraft changed:', aircraft?.id);
    if (aircraft) {
      // console.log('🔄 AircraftForm - Réinitialisation avec les nouvelles surfaces:', aircraft.compatibleRunwaySurfaces);
      setFormData({
        registration: aircraft?.registration || '',
        model: aircraft?.model || '',
        fuelType: aircraft?.fuelType || 'AVGAS',
        fuelCapacity: aircraft?.fuelCapacity || '',
        cruiseSpeedKt: aircraft?.cruiseSpeedKt || aircraft?.cruiseSpeed || '',
        baseFactor: aircraft?.baseFactor || '',
        fuelConsumption: aircraft?.fuelConsumption || '',
        maxTakeoffWeight: aircraft?.maxTakeoffWeight || '',
        wakeTurbulenceCategory: aircraft?.wakeTurbulenceCategory || 'L',
        engineType: aircraft?.engineType || 'singleEngine',
        compatibleRunwaySurfaces: getValidSurfaces(aircraft?.compatibleRunwaySurfaces),
        speeds: {
          vso: aircraft?.speeds?.vso || aircraft?.manex?.performances?.vso || '',
          vs1: aircraft?.speeds?.vs1 || aircraft?.manex?.performances?.vs1 || '',
          vfe: aircraft?.speeds?.vfe || aircraft?.manex?.performances?.vfe || '',
          vfeLdg: aircraft?.speeds?.vfeLdg || '',
          vfeTO: aircraft?.speeds?.vfeTO || '',
          vno: aircraft?.speeds?.vno || aircraft?.manex?.performances?.vno || '',
          vne: aircraft?.speeds?.vne || aircraft?.manex?.performances?.vne || '',
          vx: aircraft?.speeds?.vx || aircraft?.manex?.performances?.vx || '',
          vy: aircraft?.speeds?.vy || aircraft?.manex?.performances?.vy || '',
          vapp: aircraft?.speeds?.vapp || '',
          vle: aircraft?.speeds?.vle || '',
          vlo: aircraft?.speeds?.vlo || '',
          initialClimb: aircraft?.speeds?.initialClimb || '',
          vglide: aircraft?.speeds?.vglide || '',
          // VO - Operating manoeuvring speed
          voWeight1: aircraft?.speeds?.voWeight1 || '',
          voSpeed1: aircraft?.speeds?.voSpeed1 || '',
          voWeight2Min: aircraft?.speeds?.voWeight2Min || '',
          voWeight2Max: aircraft?.speeds?.voWeight2Max || '',
          voSpeed2: aircraft?.speeds?.voSpeed2 || '',
          voWeight3: aircraft?.speeds?.voWeight3 || '',
          voSpeed3: aircraft?.speeds?.voSpeed3 || ''
        },
        distances: {
          takeoffRoll: aircraft?.distances?.takeoffRoll || aircraft?.manex?.performances?.takeoffRoll || '',
          takeoffDistance15m: aircraft?.distances?.takeoffDistance15m || '',
          takeoffDistance50ft: aircraft?.distances?.takeoffDistance50ft || aircraft?.manex?.performances?.takeoffDistance || '',
          landingRoll: aircraft?.distances?.landingRoll || aircraft?.manex?.performances?.landingRoll || '',
          landingDistance15m: aircraft?.distances?.landingDistance15m || '',
          landingDistance50ft: aircraft?.distances?.landingDistance50ft || aircraft?.manex?.performances?.landingDistance || ''
        },
        climb: {
          rateOfClimb: aircraft?.climb?.rateOfClimb || '',
          serviceCeiling: aircraft?.climb?.serviceCeiling || '',
          climbGradient: aircraft?.climb?.climbGradient || ''
        },
        windLimits: {
          maxCrosswind: aircraft?.windLimits?.maxCrosswind || aircraft?.manex?.limitations?.maxCrosswind || '',
          maxTailwind: aircraft?.windLimits?.maxTailwind || aircraft?.manex?.limitations?.maxTailwind || '',
          maxCrosswindWet: aircraft?.windLimits?.maxCrosswindWet || ''
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
        // Enveloppe de centrage
        cgEnvelope: {
          forwardPoints: aircraft?.cgEnvelope?.forwardPoints && aircraft.cgEnvelope.forwardPoints.length > 0
            ? aircraft.cgEnvelope.forwardPoints
            : [{ weight: '', cg: '', id: Date.now() + Math.random() }],
          aftMinWeight: aircraft?.cgEnvelope?.aftMinWeight || '',
          aftCG: aircraft?.cgEnvelope?.aftCG || '',
          aftMaxWeight: aircraft?.cgEnvelope?.aftMaxWeight || '',
        },
        // Compartiments bagages dynamiques
        baggageCompartments: aircraft?.baggageCompartments && aircraft.baggageCompartments.length > 0
          ? aircraft.baggageCompartments
          : [
              { 
                id: Date.now() + Math.random(), 
                name: 'Compartiment standard', 
                arm: aircraft?.armLengths?.standardBaggageArm || '', 
                maxWeight: aircraft?.limitations?.maxBaggageLest || '' 
              }
            ],
        // Remarques du manuel
        manualRemarks: aircraft?.manualRemarks || '',
        emergencyNotes: aircraft?.emergencyNotes || '',
        maintenanceNotes: aircraft?.maintenanceNotes || '',
        equipmentCom: aircraft?.equipmentCom || {
          vhf1: true,
          vhf2: true,
          hf: false,
          satcom: false,
          elt: true,
          acars: false,
          cpdlc: false
        },
        equipmentNav: aircraft?.equipmentNav || {
          vor: true,
          dme: true,
          adf: false,
          gnss: true,
          ils: true,
          mls: false,
          rnav: false,
          rnavTypes: '',
          rnp: false,
          rnpTypes: '',
          gbas: false,
          lnav: false,
          vnav: false,
          lpv: false
        },
        equipmentSurv: aircraft?.equipmentSurv || {
          transponderMode: 'C',
          adsb: false,
          adsbIn: false,
          tcas: 'None',
          gpws: false,
          egpws: false,
          taws: false,
          cvr: false,
          fdr: false,
          ras: false,
          flarm: false
        },
        specialCapabilities: aircraft?.specialCapabilities || {
          rvsm: false,
          mnps: false,
          etops: false,
          etopsMinutes: '',
          catII: false,
          catIII: false,
          pbn: false,
          remarks: ''
        },
        approvedOperations: aircraft?.approvedOperations || {
          vfrDay: true,
          vfrNight: false,
          ifrDay: false,
          ifrNight: false,
          svfr: false,
          formation: false,
          aerobatics: false,
          banner: false,
          glider: false,
          parachute: false,
          agricultural: false,
          aerial: false,
          training: false,
          charter: false,
          mountainous: false,
          seaplane: false,
          skiPlane: false,
          icing: false
        },
        // Ajouter les performances avancées si elles existent
        advancedPerformance: aircraft?.advancedPerformance || null
      });
    }
  }, [aircraft?.id]); // Se déclenche SEULEMENT quand l'ID de l'avion change

  // Fonctions pour gérer les compartiments bagages dynamiques
  const addBaggageCompartment = () => {
    setFormData(prev => {
      const currentCompartments = prev.baggageCompartments || [];
      return {
        ...prev,
        baggageCompartments: [
          ...currentCompartments,
          { 
            id: Date.now() + Math.random(), 
            name: `Compartiment ${currentCompartments.length + 1}`, 
            arm: '', 
            maxWeight: '' 
          }
        ]
      };
    });
  };

  const removeBaggageCompartment = (compartmentId) => {
    setFormData(prev => ({
      ...prev,
      baggageCompartments: (prev.baggageCompartments || []).filter(c => c.id !== compartmentId)
    }));
  };

  const updateBaggageCompartment = (compartmentId, field, value) => {
    setFormData(prev => ({
      ...prev,
      baggageCompartments: (prev.baggageCompartments || []).map(c => 
        c.id === compartmentId ? { ...c, [field]: value } : c
      )
    }));
  };

  // Fonctions pour gérer les sièges supplémentaires
  const addAdditionalSeat = () => {
    setFormData(prev => {
      const currentSeats = prev.additionalSeats || [];
      return {
        ...prev,
        additionalSeats: [
          ...currentSeats,
          { 
            id: Date.now() + Math.random(), 
            name: `Siège ${currentSeats.length + 5}`, // +5 car on a déjà 4 sièges standard
            arm: ''
          }
        ]
      };
    });
  };

  const removeAdditionalSeat = (seatId) => {
    setFormData(prev => ({
      ...prev,
      additionalSeats: (prev.additionalSeats || []).filter(s => s.id !== seatId)
    }));
  };

  const updateAdditionalSeat = (seatId, field, value) => {
    setFormData(prev => ({
      ...prev,
      additionalSeats: (prev.additionalSeats || []).map(s => 
        s.id === seatId ? { ...s, [field]: value } : s
      )
    }));
  };

  // Fonctions pour gérer les points CG avant
  const addForwardPoint = () => {
    setFormData(prev => ({
      ...prev,
      cgEnvelope: {
        ...prev.cgEnvelope,
        forwardPoints: [
          ...prev.cgEnvelope.forwardPoints,
          { weight: '', cg: '', id: Date.now() + Math.random() }
        ]
      }
    }));
  };

  const removeForwardPoint = (pointId) => {
    setFormData(prev => ({
      ...prev,
      cgEnvelope: {
        ...prev.cgEnvelope,
        forwardPoints: prev.cgEnvelope.forwardPoints.filter(point => point.id !== pointId)
      }
    }));
  };

  const updateForwardPoint = (pointId, field, value) => {
    setFormData(prev => ({
      ...prev,
      cgEnvelope: {
        ...prev.cgEnvelope,
        forwardPoints: prev.cgEnvelope.forwardPoints.map(point => 
          point.id === pointId 
            ? { ...point, [field]: value }
            : point
        )
      }
    }));
  };

  const handleChange = (field, value, index = null) => {
    if (field === 'cruiseSpeedKt') {
      // Calculer automatiquement le facteur de base
      const speed = parseFloat(value);
      const baseFactor = speed > 0 ? (60 / speed).toFixed(3) : '';
      
      setFormData(prev => ({
        ...prev,
        cruiseSpeedKt: value,
        baseFactor: baseFactor
      }));
    } else if (field === 'maxTakeoffWeight') {
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
      // console.log('🔄 Toggle surface:', value);
      // console.log('🔄 Surfaces actuelles:', formData.compatibleRunwaySurfaces);
      
      setFormData(prev => {
        const surfaces = prev.compatibleRunwaySurfaces || [];
        let newSurfaces;
        
        if (surfaces.includes(value)) {
          // Retirer la surface
          newSurfaces = surfaces.filter(s => s !== value);
          // console.log('🔄 Surface retirée:', value);
        } else {
          // Ajouter la surface
          newSurfaces = [...surfaces, value];
          // console.log('🔄 Surface ajoutée:', value);
        }
        
        // console.log('🔄 Nouvelles surfaces après toggle:', newSurfaces);
        // console.log('🔄 Type du nouveau tableau:', typeof newSurfaces);
        // console.log('🔄 Est un tableau:', Array.isArray(newSurfaces));
        
        const newFormData = {
          ...prev,
          compatibleRunwaySurfaces: newSurfaces
        };
        
        // console.log('🔄 Nouveau formData surfaces:', newFormData.compatibleRunwaySurfaces);
        
        return newFormData;
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
    console.log('🟢 handleSubmit APPELÉ !');
    e.preventDefault();
    
    console.log('📋 handleSubmit - Début de la validation');
    console.log('📋 handleSubmit - Registration:', formData.registration);
    console.log('📋 handleSubmit - Model:', formData.model);
    console.log('📋 handleSubmit - FormData complet:', formData);
    console.log('📋 handleSubmit - Surfaces:', formData.compatibleRunwaySurfaces);
    
    if (!formData.registration || !formData.model) {
      alert('L\'immatriculation et le modèle sont obligatoires');
      return;
    }
    
    // Valider que l'immatriculation n'a pas de caractères spéciaux problématiques
    if (!/^[A-Za-z0-9-]+$/.test(formData.registration)) {
      alert('L\'immatriculation ne peut contenir que des lettres, chiffres et tirets');
      return;
    }
    if (!formData.compatibleRunwaySurfaces || formData.compatibleRunwaySurfaces.length === 0) {
      console.log('❌ handleSubmit - Validation des surfaces échouée');
      console.log('❌ handleSubmit - Surfaces actuelles:', formData.compatibleRunwaySurfaces);
      alert('Vous devez sélectionner au moins un type de piste compatible');
      return;
    }
    
    console.log('✅ handleSubmit - Toutes les validations passées');

    // DEBUG : Afficher les surfaces compatibles avant de sauvegarder
    console.log('🛩️ Surfaces compatibles sélectionnées:', formData.compatibleRunwaySurfaces);

    // Fonction helper pour valider et convertir les nombres
    const toValidNumber = (value, defaultValue = 0) => {
      const num = Number(value);
      return isNaN(num) ? defaultValue : num;
    };

    // DEBUG : Vérifier les surfaces avant traitement
    console.log('💾 handleSubmit - formData.compatibleRunwaySurfaces:', formData.compatibleRunwaySurfaces);
    console.log('💾 handleSubmit - Type:', typeof formData.compatibleRunwaySurfaces);
    console.log('💾 handleSubmit - Est un tableau:', Array.isArray(formData.compatibleRunwaySurfaces));

    const processedData = {
      ...formData,
      fuelCapacity: toValidNumber(formData.fuelCapacity, 0),
      cruiseSpeed: toValidNumber(formData.cruiseSpeedKt, 0), // Ajouter cruiseSpeed pour compatibilité
      cruiseSpeedKt: toValidNumber(formData.cruiseSpeedKt, 0),
      baseFactor: formData.baseFactor || (formData.cruiseSpeedKt ? (60 / parseFloat(formData.cruiseSpeedKt)).toFixed(3) : ''),
      fuelConsumption: toValidNumber(formData.fuelConsumption, 0),
      maxTakeoffWeight: toValidNumber(formData.maxTakeoffWeight, 0),
      wakeTurbulenceCategory: formData.wakeTurbulenceCategory,
      compatibleRunwaySurfaces: formData.compatibleRunwaySurfaces || [],
      // Nouvelles sections de performances
      speeds: Object.values(formData.speeds).some(v => v)
        ? {
            vso: toValidNumber(formData.speeds.vso, 0),
            vs1: toValidNumber(formData.speeds.vs1, 0),
            vr: toValidNumber(formData.speeds.vr, 0),
            vfe: toValidNumber(formData.speeds.vfe, 0), // Garder pour compatibilité
            vfeLdg: toValidNumber(formData.speeds.vfeLdg, 0),
            vfeTO: toValidNumber(formData.speeds.vfeTO, 0),
            vno: toValidNumber(formData.speeds.vno, 0),
            vne: toValidNumber(formData.speeds.vne, 0),
            vx: toValidNumber(formData.speeds.vx, 0),
            vy: toValidNumber(formData.speeds.vy, 0),
            vapp: toValidNumber(formData.speeds.vapp, 0),
            vle: toValidNumber(formData.speeds.vle, 0),
            vlo: toValidNumber(formData.speeds.vlo, 0),
            initialClimb: toValidNumber(formData.speeds.initialClimb, 0),
            vglide: toValidNumber(formData.speeds.vglide, 0),
            // VO - Operating manoeuvring speed
            voWeight1: toValidNumber(formData.speeds.voWeight1, 0),
            voSpeed1: toValidNumber(formData.speeds.voSpeed1, 0),
            voWeight2Min: toValidNumber(formData.speeds.voWeight2Min, 0),
            voWeight2Max: toValidNumber(formData.speeds.voWeight2Max, 0),
            voSpeed2: toValidNumber(formData.speeds.voSpeed2, 0),
            voWeight3: toValidNumber(formData.speeds.voWeight3, 0),
            voSpeed3: toValidNumber(formData.speeds.voSpeed3, 0)
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
            climbGradient: toValidNumber(formData.climb.climbGradient, 0)
          }
        : undefined,
      windLimits: Object.values(formData.windLimits).some(v => v)
        ? {
            maxCrosswind: toValidNumber(formData.windLimits.maxCrosswind, 0),
            maxTailwind: toValidNumber(formData.windLimits.maxTailwind, 0),
            maxCrosswindWet: toValidNumber(formData.windLimits.maxCrosswindWet, 0)
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
      // Enveloppe de centrage - TOUJOURS sauvegarder pour préserver les points en cours de saisie
      cgEnvelope: {
        forwardPoints: formData.cgEnvelope.forwardPoints.map(point => ({
          weight: point.weight || '',
          cg: point.cg || '',
          id: point.id
        })),
        aftMinWeight: formData.cgEnvelope.aftMinWeight || '',
        aftCG: formData.cgEnvelope.aftCG || '',
        aftMaxWeight: formData.cgEnvelope.aftMaxWeight || '',
      },
      
      // Mettre à jour weightBalance avec les données armLengths ET cgLimits
      weightBalance: {
        ...aircraft?.weightBalance,
        // Mapper les bras de levier depuis armLengths vers la structure attendue par WeightBalance
        emptyWeightArm: toValidNumber(formData.armLengths.emptyMassArm, 2.00),
        frontLeftSeatArm: toValidNumber(formData.armLengths.frontSeat1Arm, 2.00),
        frontRightSeatArm: toValidNumber(formData.armLengths.frontSeat2Arm, 2.00),
        rearLeftSeatArm: toValidNumber(formData.armLengths.rearSeat1Arm, 2.90),
        rearRightSeatArm: toValidNumber(formData.armLengths.rearSeat2Arm, 2.90),
        baggageArm: toValidNumber(formData.armLengths.standardBaggageArm, 3.50),
        auxiliaryArm: toValidNumber(formData.armLengths.aftBaggageExtensionArm || formData.armLengths.baggageTubeArm, 3.70),
        fuelArm: toValidNumber(formData.armLengths.fuelArm, 2.18),
        // CG Limits
        ...((formData.cgEnvelope.forwardPoints.some(p => p.weight && p.cg) || 
             formData.cgEnvelope.aftCG) ? {
          cgLimits: {
            forward: formData.cgEnvelope.forwardPoints.length > 0 ? 
              toValidNumber(formData.cgEnvelope.forwardPoints[0].cg, aircraft?.weightBalance?.cgLimits?.forward || 2.00) :
              aircraft?.weightBalance?.cgLimits?.forward || 2.00,
            aft: toValidNumber(formData.cgEnvelope.aftCG, aircraft?.weightBalance?.cgLimits?.aft || 2.45),
            forwardVariable: formData.cgEnvelope.forwardPoints
              .filter(point => point.weight && point.cg)
              .map(point => ({
                weight: toValidNumber(point.weight, 0),
                cg: toValidNumber(point.cg, 0)
              }))
              .filter(point => point.weight > 0 && point.cg > 0)
              .sort((a, b) => a.weight - b.weight)
          }
        } : {
          cgLimits: {
            forward: 2.00,
            aft: 2.45
          }
        })
      },
      // Ajouter aussi les masses importantes pour le module Weight & Balance
      emptyWeight: toValidNumber(formData.masses.emptyMass, 600),
      minTakeoffWeight: toValidNumber(formData.masses.minTakeoffMass, 600),
      maxBaggageWeight: toValidNumber(formData.limitations.maxBaggageLest, 50),
      maxAuxiliaryWeight: 20, // Valeur par défaut pour rangement annexe
      // Équipements
      equipmentCom: formData.equipmentCom,
      equipmentNav: formData.equipmentNav,
      equipmentSurv: formData.equipmentSurv,
      specialCapabilities: formData.specialCapabilities,
      // Opérations approuvées
      approvedOperations: formData.approvedOperations,
      // Sièges supplémentaires
      additionalSeats: formData.additionalSeats || [],
      // Compartiments bagages dynamiques
      baggageCompartments: formData.baggageCompartments || [],
      // Remarques du manuel
      manualRemarks: formData.manualRemarks || '',
      emergencyNotes: formData.emergencyNotes || '',
      maintenanceNotes: formData.maintenanceNotes || '',
      // Analyse IA des performances
      performance: formData.performance || null,
      // Performances avancées extraites par IA
      advancedPerformance: formData.advancedPerformance || null,
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
    { display: 'flex', alignItems: 'center', color: 'var(--text-primary)' }
  );

  const buttonSectionStyle = {
    width: '100%',
    padding: '12px !important',
    backgroundColor: 'var(--bg-overlay) !important',
    color: 'white !important',
    border: '1px solid rgba(0, 0, 0, 0.7) !important',
    borderRadius: '8px !important',
    fontSize: '16px !important',
    fontWeight: 'bold !important',
    cursor: 'pointer !important',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s !important',
    background: 'var(--bg-overlay) !important',
    textTransform: 'none !important',
    letterSpacing: 'normal !important'
  };

  return (
    <form onSubmit={handleSubmit} style={{ color: 'var(--text-primary)' }}>
      {/* Section Général */}
      <div style={{ marginBottom: '16px' }}>
        <AccordionButton
          isOpen={showGeneral}
          onClick={() => setShowGeneral(!showGeneral)}
          icon="📋"
          title="Général"
        />
      </div>

      {showGeneral && (
        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--bg-overlay)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}>
          <>
            {/* Informations de base */}
            <div style={{ color: 'var(--text-primary)' }}>
              <h4 style={{ fontSize: 'var(--fs-title)', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)', WebkitTextFillColor: 'var(--text-primary)', opacity: 1, filter: 'none' }}>
                Informations générales
              </h4>
              
              {/* Photo de l'avion */}
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Photo de l'avion</label>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
                  {aircraftPhoto ? (
                    <div style={{ position: 'relative', width: '200px', height: '150px' }}>
                      <img 
                        src={aircraftPhoto} 
                        alt="Aircraft" 
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover', 
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--text-tertiary)'
                        }} 
                      />
                      <button
                        type="button"
                        onClick={() => setAircraftPhoto(null)}
                        style={{
                          position: 'absolute',
                          top: '5px',
                          right: '5px',
                          backgroundColor: 'var(--color-red-critical)',
                          color: 'var(--text-primary)',
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
                      border: '2px dashed var(--text-tertiary)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'var(--bg-overlay)'
                    }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
                        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginTop: '8px' }}>Aucune photo</p>
                    </div>
                  )}
                  <div style={{ textAlign: 'center' }}>
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
                        ...window.buttonSectionStyle,
                        cursor: 'pointer',
                        display: 'inline-block'
                      }}
                    >
                      {aircraftPhoto ? 'Changer la photo' : 'Ajouter une photo'}
                    </label>
                    <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', marginTop: '4px', textAlign: 'center' }}>
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

          {/* Type de moteur */}
          <div style={{ marginTop: '16px' }}>
            <label style={labelStyle}>
              Type de moteur *
              <InfoIcon tooltip="Type de motorisation de l'aéronef" />
            </label>
            <select
              value={formData.engineType || 'singleEngine'}
              onChange={(e) => handleChange('engineType', e.target.value)}
              style={inputStyle}
              required
            >
              <option value="singleEngine">Monomoteur à pistons</option>
              <option value="multiEngine">Multimoteur à pistons</option>
              <option value="turboprop">Turbopropulseur</option>
              <option value="jet">Réacteur (Jet)</option>
              <option value="electric">Électrique</option>
            </select>
          </div>

          {/* Catégorie de turbulence de sillage */}
          <div style={{ marginTop: '16px' }}>
            <label style={labelStyle}>
              Catégorie de turbulence de sillage *
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
          </div>
        </div>

        {/* Carburant */}
        <div style={{ color: 'var(--text-primary)' }}>
          <h4 style={{ fontSize: 'var(--fs-title)', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)', WebkitTextFillColor: 'var(--text-primary)', opacity: 1, filter: 'none' }}>
            Carburant
          </h4>
          {/* Première ligne : Type et capacités */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px', alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>Capacité ({fuelUnit})</label>
              <input
                type="number"
                value={getUnit('fuel') !== 'ltr' ? convert(formData.fuelCapacity, 'fuel', 'ltr', { toUnit: getUnit('fuel') }).toFixed(1) : formData.fuelCapacity}
                onChange={(e) => {
                  const valueInStorageUnit = getUnit('fuel') !== 'ltr' ? toStorage(parseFloat(e.target.value) || 0, 'fuel') : e.target.value;
                  handleChange('fuelCapacity', valueInStorageUnit);
                }}
                placeholder={getUnit('fuel') === 'gal' ? "53" : getUnit('fuel') === 'kg' ? "160" : "200"}
                min="0"
                step="0.1"
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>Consommation ({consumptionUnit})</label>
              <input
                type="number"
                value={getUnit('fuel') !== 'ltr' ? convert(formData.fuelConsumption, 'fuel', 'ltr', { toUnit: getUnit('fuel') }).toFixed(1) : formData.fuelConsumption}
                onChange={(e) => {
                  const valueInStorageUnit = getUnit('fuel') !== 'ltr' ? toStorage(parseFloat(e.target.value) || 0, 'fuel') : e.target.value;
                  handleChange('fuelConsumption', valueInStorageUnit);
                }}
                placeholder={getUnit('fuel') === 'gal' ? "9.2" : getUnit('fuel') === 'kg' ? "28" : "35"}
                min="0"
                step="0.1"
                style={inputStyle}
              />
            </div>
          </div>
          
          {/* Deuxième ligne : Vitesse et facteur de base */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>
                Vitesse de croisière (kt)
                <InfoIcon tooltip="Vitesse de croisière en nœuds (knots)" />
              </label>
              <input
                type="number"
                value={formData.cruiseSpeedKt}
                onChange={(e) => handleChange('cruiseSpeedKt', e.target.value)}
                placeholder="120"
                min="0"
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>
                Facteur de base (min/NM)
                <InfoIcon tooltip="Calculé automatiquement : 60 / vitesse de croisière" />
              </label>
              <div>
                <input
                  type="text"
                  value={formData.baseFactor || (formData.cruiseSpeedKt ? (60 / parseFloat(formData.cruiseSpeedKt)).toFixed(3) : '')}
                  readOnly
                  style={{
                    ...inputStyle, 
                    backgroundColor: 'var(--bg-overlay)', 
                    cursor: 'not-allowed',
                    fontWeight: '600',
                    color: formData.baseFactor ? 'var(--text-primary)' : 'var(--text-tertiary)'
                  }}
                  placeholder="Auto"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Types de pistes compatibles */}
        <div style={{ color: 'var(--text-primary)' }}>
          <h4 style={{ fontSize: 'var(--fs-title)', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)', WebkitTextFillColor: 'var(--text-primary)', opacity: 1, filter: 'none' }}>
            Types de pistes compatibles
          </h4>
          <div>
            <label style={labelStyle}>Type de surfaces compatibles *</label>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)', 
              gap: '8px',
              marginTop: '8px'
            }}>
              {[
                { code: 'ASPH', name: 'Asphalte', icon: '🛣️' },
                { code: 'CONC', name: 'Béton', icon: '🏗️' },
                { code: 'GRASS', name: 'Herbe', icon: '🌱' },
                { code: 'GRVL', name: 'Gravier', icon: '🪨' },
                { code: 'UNPAVED', name: 'Terre', icon: '🏜️' },
                { code: 'SAND', name: 'Sable', icon: '🏖️' },
                { code: 'SNOW', name: 'Neige', icon: '❄️' },
                { code: 'WATER', name: 'Eau', icon: '💧' }
              ].map(surface => (
                <label
                  key={surface.code}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px',
                    backgroundColor: formData.compatibleRunwaySurfaces?.includes(surface.code) ? 'var(--text-secondary)' : 'white',
                    color: formData.compatibleRunwaySurfaces?.includes(surface.code) ? 'white' : 'var(--text-secondary)',
                    border: `1px solid ${formData.compatibleRunwaySurfaces?.includes(surface.code) ? 'var(--text-secondary)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: 'var(--fs-body)'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData.compatibleRunwaySurfaces?.includes(surface.code) || false}
                    onChange={() => handleChange('compatibleRunwaySurfaces', surface.code)}
                    style={{ display: 'none' }}
                  />
                  <span style={{ marginRight: '6px' }}>{surface.icon}</span>
                  <span>{surface.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
          </>
        </div>
      )}

      {/* Section Performances */}
      <div style={{ marginBottom: '16px' }}>
        <AccordionButton
          isOpen={showPerformances}
          onClick={() => setShowPerformances(!showPerformances)}
          icon="✈️"
          title="Vitesses et Limitations"
        />
      </div>

      {showPerformances && (
        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--bg-overlay)', borderRadius: 'var(--radius-sm)' }}>
          <>
            {/* Section Performances - Vitesses caractéristiques */}
        <div>
          <h4 style={{ fontSize: 'var(--fs-title)', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '8px' }}>✈️</span>
            Vitesses caractéristiques (kt)
            <InfoIcon tooltip="Vitesses de référence pour les différentes phases de vol" />
          </h4>
          
          {/* Vitesses critiques pour les arcs de l'indicateur */}
          <div style={{
            backgroundColor: 'var(--bg-overlay)',
            padding: '16px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '16px',
            border: '2px solid var(--text-secondary)'
          }}>
            <h5 style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>
              Vitesses critiques de l'indicateur de vitesse
            </h5>
            
            {/* Arcs de limitation de vitesse (Airspeed Indicator Markings) */}
            <div style={{
              backgroundColor: 'var(--text-primary)',
              padding: '16px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '16px'
            }}>
              <h6 style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>
                🎯 Arcs de limitation de vitesse (Airspeed Indicator Markings)
              </h6>
              
              {/* Indicateur visuel des arcs */}
              <div style={{
                backgroundColor: 'var(--text-secondary)',
                padding: '20px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '16px',
                position: 'relative',
                minHeight: '120px'
              }}>
                {/* Calcul et affichage des arcs */}
                {(() => {
                  const vso = parseFloat(formData.speeds.vso) || 0;
                  const vs1 = parseFloat(formData.speeds.vs1) || 0;
                  const vfeLdg = parseFloat(formData.speeds.vfeLdg) || 0;
                  const vfeTO = parseFloat(formData.speeds.vfeTO) || 0;
                  const vno = parseFloat(formData.speeds.vno) || 0;
                  const vne = parseFloat(formData.speeds.vne) || 0;
                  
                  // VO - Déterminer la vitesse VO basée sur la masse actuelle (utiliser la plus restrictive par défaut)
                  const voSpeed1 = parseFloat(formData.speeds.voSpeed1) || 0;
                  const voSpeed2 = parseFloat(formData.speeds.voSpeed2) || 0;
                  const voSpeed3 = parseFloat(formData.speeds.voSpeed3) || 0;
                  // Afficher la VO la plus élevée (la plus restrictive)
                  const vo = Math.max(voSpeed1, voSpeed2, voSpeed3);
                  
                  // Calculer la vitesse max pour l'échelle
                  const maxSpeed = Math.max(vne * 1.1, 200);
                  const scale = 100 / maxSpeed;
                  
                  return (
                    <>
                      {/* Échelle de vitesse */}
                      <div style={{
                        position: 'absolute',
                        bottom: '10px',
                        left: '20px',
                        right: '20px',
                        height: '4px',
                        backgroundColor: 'var(--text-secondary)',
                        borderRadius: 'var(--radius-sm)'
                      }}>
                        {/* Arc blanc - Volets sortis (Vso à VfeLdg) */}
                        {vso > 0 && vfeLdg > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${vso * scale}%`,
                              width: `${(vfeLdg - vso) * scale}%`,
                              height: '20px',
                              backgroundColor: 'var(--bg-overlay)',
                              bottom: '0',
                              borderRadius: 'var(--radius-sm)',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                            }}
                            title={`Arc blanc: ${vso} - ${vfeLdg} kt (Plage volets)`}
                          />
                        )}
                        
                        {/* Arc vert - Vol normal (Vs1 à Vno) */}
                        {vs1 > 0 && vno > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${vs1 * scale}%`,
                              width: `${(vno - vs1) * scale}%`,
                              height: '20px',
                              backgroundColor: 'var(--text-primary)',
                              bottom: '25px',
                              borderRadius: 'var(--radius-sm)',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                            }}
                            title={`Arc vert: ${vs1} - ${vno} kt (Plage normale)`}
                          />
                        )}
                        
                        {/* Arc jaune - Précaution (Vno à Vne) */}
                        {vno > 0 && vne > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${vno * scale}%`,
                              width: `${(vne - vno) * scale}%`,
                              height: '20px',
                              backgroundColor: 'var(--accent-primary)',
                              bottom: '25px',
                              borderRadius: 'var(--radius-sm)',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                            }}
                            title={`Arc jaune: ${vno} - ${vne} kt (Précaution)`}
                          />
                        )}
                        
                        {/* Trait rouge - Vne */}
                        {vne > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${vne * scale}%`,
                              width: '3px',
                              height: '40px',
                              backgroundColor: 'var(--color-red-critical)',
                              bottom: '15px',
                              borderRadius: 'var(--radius-sm)',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                            }}
                            title={`Trait rouge: ${vne} kt (Ne jamais dépasser)`}
                          />
                        )}
                        
                        {/* Trait blanc - VFE T/O */}
                        {vfeTO > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${vfeTO * scale}%`,
                              width: '2px',
                              height: '30px',
                              backgroundColor: 'var(--bg-overlay)',
                              bottom: '10px',
                              borderRadius: 'var(--radius-sm)',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                            }}
                            title={`VFE T/O: ${vfeTO} kt (Max volets décollage)`}
                          />
                        )}
                        
                        {/* Trait blanc pointillé - VO (Operating manoeuvring speed) */}
                        {vo > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${vo * scale}%`,
                              width: '2px',
                              height: '35px',
                              background: 'repeating-linear-gradient(to bottom, white 0px, white 4px, transparent 4px, transparent 8px)',
                              bottom: '12px',
                              borderRadius: 'var(--radius-sm)',
                              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
                            }}
                            title={`VO: ${vo} kt (Operating manoeuvring speed - ne pas faire de mouvements brusques au-dessus)`}
                          />
                        )}
                      </div>
                      
                      {/* Labels de vitesse */}
                      <div style={{
                        position: 'absolute',
                        bottom: '-5px',
                        left: '20px',
                        right: '20px',
                        height: '20px',
                        fontSize: 'var(--fs-caption)',
                        color: 'var(--text-tertiary)'
                      }}>
                        {vso > 0 && (
                          <span style={{
                            position: 'absolute',
                            left: `${vso * scale}%`,
                            transform: 'translateX(-50%)'
                          }}>
                            {vso}
                          </span>
                        )}
                        {vs1 > 0 && (
                          <span style={{
                            position: 'absolute',
                            left: `${vs1 * scale}%`,
                            transform: 'translateX(-50%)'
                          }}>
                            {vs1}
                          </span>
                        )}
                        {vno > 0 && (
                          <span style={{
                            position: 'absolute',
                            left: `${vno * scale}%`,
                            transform: 'translateX(-50%)'
                          }}>
                            {vno}
                          </span>
                        )}
                        {vne > 0 && (
                          <span style={{
                            position: 'absolute',
                            left: `${vne * scale}%`,
                            transform: 'translateX(-50%)',
                            color: 'var(--color-red-critical)',
                            fontWeight: 'bold'
                          }}>
                            {vne}
                          </span>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
              
              {/* Légende des arcs */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                fontSize: 'var(--fs-body)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '30px',
                    height: '8px',
                    backgroundColor: 'var(--bg-overlay)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--text-secondary)'
                  }} />
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    <strong>Arc blanc:</strong> Plage volets (Vso - Vfe LDG)
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '30px',
                    height: '8px',
                    backgroundColor: 'var(--text-primary)',
                    borderRadius: 'var(--radius-sm)'
                  }} />
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    <strong>Arc vert:</strong> Plage normale (Vs1 - Vno)
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '30px',
                    height: '8px',
                    backgroundColor: 'var(--accent-primary)',
                    borderRadius: 'var(--radius-sm)'
                  }} />
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    <strong>Arc jaune:</strong> Air calme (Vno - Vne)
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '30px',
                    height: '8px',
                    backgroundColor: 'var(--color-red-critical)',
                    borderRadius: 'var(--radius-sm)'
                  }} />
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    <strong>Trait rouge:</strong> Ne jamais dépasser (Vne)
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '2px',
                    height: '20px',
                    backgroundColor: 'var(--bg-overlay)',
                    marginLeft: '14px',
                    marginRight: '14px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.5)'
                  }} />
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    <strong>Trait blanc:</strong> VFE T/O (Max volets décollage)
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '30px',
                    height: '20px',
                    background: 'repeating-linear-gradient(to bottom, white 0px, white 3px, transparent 3px, transparent 6px)',
                    borderRadius: 'var(--radius-sm)'
                  }} />
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    <strong>Trait pointillé:</strong> VO (Manœuvre max)
                  </span>
                </div>
              </div>
              
              {/* Avertissement si des vitesses manquent */}
              {(!formData.speeds.vso || !formData.speeds.vs1 || !formData.speeds.vno || !formData.speeds.vne) && (
                <div style={{
                  backgroundColor: 'var(--color-red-critical)',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  marginTop: '12px'
                }}>
                  <p style={{ fontSize: 'var(--fs-body)', color: 'var(--bg-overlay)', margin: 0 }}>
                    ⚠️ Certaines vitesses critiques ne sont pas définies. Remplissez les vitesses pour afficher les arcs complets.
                  </p>
                </div>
              )}
            </div>
            
            {/* Configuration volets sortis */}
            <div style={{
              backgroundColor: 'var(--bg-overlay)',
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '12px',
              border: '1px solid var(--border-subtle)'
            }}>
              <h6 style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-primary)' }}>
                Configuration volets sortis
              </h6>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>
                    Vso - Décrochage volets sortis
                    <InfoIcon tooltip="Vitesse de décrochage en configuration atterrissage" />
                  </label>
                  <input
                    type="number"
                    value={formData.speeds.vso}
                    onChange={(e) => handleChange('speeds.vso', e.target.value)}
                    placeholder="60"
                    min="0"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Vfe LDG - Volets atterrissage
                    <InfoIcon tooltip="Vitesse max volets en position atterrissage" />
                  </label>
                  <input
                    type="number"
                    value={formData.speeds.vfeLdg}
                    onChange={(e) => handleChange('speeds.vfeLdg', e.target.value)}
                    placeholder="98"
                    min="0"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Vfe T/O - Volets décollage
                    <InfoIcon tooltip="Vitesse max volets en position décollage" />
                  </label>
                  <input
                    type="number"
                    value={formData.speeds.vfeTO}
                    onChange={(e) => handleChange('speeds.vfeTO', e.target.value)}
                    placeholder="110"
                    min="0"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
            
            {/* Configuration lisse */}
            <div style={{
              backgroundColor: 'var(--bg-overlay)',
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '12px',
              border: '1px solid var(--bg-overlay)'
            }}>
              <h6 style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-primary)' }}>
                Configuration lisse
              </h6>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>
                    Vs1 - Décrochage volets rentrés
                    <InfoIcon tooltip="Vitesse de décrochage en configuration lisse" />
                  </label>
                  <input
                    type="number"
                    value={formData.speeds.vs1}
                    onChange={(e) => handleChange('speeds.vs1', e.target.value)}
                    placeholder="66"
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
                    placeholder="130"
                    min="0"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
            
            {/* Vitesse limite absolue */}
            <div style={{
              backgroundColor: 'var(--bg-overlay)',
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '12px',
              border: '1px solid var(--bg-overlay)'
            }}>
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
            </div>
            
            {/* VO - Operating manoeuvring speed (variable selon la masse) */}
            <div style={{
              backgroundColor: 'var(--accent-soft)',
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--bg-overlay)'
            }}>
              <h6 style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-primary)' }}>
                VO - Operating Manoeuvring Speed (variable selon la masse)
              </h6>
              <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--accent-primary)', marginBottom: '8px' }}>
                Ne pas effectuer de mouvements complets ou brusques des commandes au-dessus de ces vitesses
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', alignItems: 'end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <label style={{ ...labelStyle, fontSize: 'var(--fs-caption)', color: 'var(--text-primary)' }}>
                    Jusqu'à ({massUnit})
                    <InfoIcon tooltip="Masse max pour cette VO" />
                  </label>
                  <input
                    type="number"
                    value={formData.speeds.voWeight1}
                    onChange={(e) => handleChange('speeds.voWeight1', e.target.value)}
                    placeholder="1080"
                    min="0"
                    style={{ ...inputStyle, marginBottom: '4px' }}
                  />
                  <label style={{ ...labelStyle, fontSize: 'var(--fs-caption)', color: 'var(--text-primary)' }}>VO (KIAS)</label>
                  <input
                    type="number"
                    value={formData.speeds.voSpeed1}
                    onChange={(e) => handleChange('speeds.voSpeed1', e.target.value)}
                    placeholder="101"
                    min="0"
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <label style={{ ...labelStyle, fontSize: 'var(--fs-caption)', color: 'var(--text-primary)' }}>
                    De ({massUnit}) à ({massUnit})
                    <InfoIcon tooltip="Plage de masse intermédiaire" />
                  </label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input
                      type="number"
                      value={formData.speeds.voWeight2Min}
                      onChange={(e) => handleChange('speeds.voWeight2Min', e.target.value)}
                      placeholder="1080"
                      min="0"
                      style={{ ...inputStyle, marginBottom: '4px', flex: 1 }}
                    />
                    <input
                      type="number"
                      value={formData.speeds.voWeight2Max}
                      onChange={(e) => handleChange('speeds.voWeight2Max', e.target.value)}
                      placeholder="1180"
                      min="0"
                      style={{ ...inputStyle, marginBottom: '4px', flex: 1 }}
                    />
                  </div>
                  <label style={{ ...labelStyle, fontSize: 'var(--fs-caption)', color: 'var(--text-primary)' }}>VO (KIAS)</label>
                  <input
                    type="number"
                    value={formData.speeds.voSpeed2}
                    onChange={(e) => handleChange('speeds.voSpeed2', e.target.value)}
                    placeholder="108"
                    min="0"
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <label style={{ ...labelStyle, fontSize: 'var(--fs-caption)', color: 'var(--text-primary)' }}>
                    Au-dessus de ({massUnit})
                    <InfoIcon tooltip="Masse min pour cette VO" />
                  </label>
                  <input
                    type="number"
                    value={formData.speeds.voWeight3}
                    onChange={(e) => handleChange('speeds.voWeight3', e.target.value)}
                    placeholder="1180"
                    min="0"
                    style={{ ...inputStyle, marginBottom: '4px' }}
                  />
                  <label style={{ ...labelStyle, fontSize: 'var(--fs-caption)', color: 'var(--text-primary)' }}>VO (KIAS)</label>
                  <input
                    type="number"
                    value={formData.speeds.voSpeed3}
                    onChange={(e) => handleChange('speeds.voSpeed3', e.target.value)}
                    placeholder="113"
                    min="0"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          </div>


          {/* Vitesses de montée et plané */}
          <div style={{
            backgroundColor: 'var(--bg-overlay)',
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            marginTop: '16px',
            marginBottom: '16px'
          }}>
            <h5 style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>
              Vitesses de montée et plané
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div>
                <label style={labelStyle}>
                  VR - Vitesse de rotation
                  <InfoIcon tooltip="Vitesse à laquelle le pilote tire sur le manche pour décoller" />
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
                  VApp - Vitesse d'approche
                  <InfoIcon tooltip="Vitesse d'approche en finale" />
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
              <div>
                <label style={labelStyle}>
                  Montée initiale
                  <InfoIcon tooltip="Vitesse de montée après décollage" />
                </label>
                <input
                  type="number"
                  value={formData.speeds.initialClimb}
                  onChange={(e) => handleChange('speeds.initialClimb', e.target.value)}
                  placeholder="65"
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
              
              <div>
                <label style={labelStyle}>
                  VLE - Train sorti
                  <InfoIcon tooltip="Vitesse maximale train sorti" />
                </label>
                <input
                  type="number"
                  value={formData.speeds.vle}
                  onChange={(e) => handleChange('speeds.vle', e.target.value)}
                  placeholder="140"
                  min="0"
                  style={inputStyle}
                />
              </div>
              
              <div>
                <label style={labelStyle}>
                  VLO - Manœuvre train
                  <InfoIcon tooltip="Vitesse maximale pour manœuvrer le train" />
                </label>
                <input
                  type="number"
                  value={formData.speeds.vlo}
                  onChange={(e) => handleChange('speeds.vlo', e.target.value)}
                  placeholder="120"
                  min="0"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

        </div>

        {/* Section Limitations de vent */}
        <div>
          <h4 style={{ fontSize: 'var(--fs-title)', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '8px' }}>💨</span>
            Limitations de vent (kt)
            <InfoIcon tooltip="Limites maximales démontrées" />
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <label style={labelStyle}>
                Vent de travers sur piste mouillée
                <InfoIcon tooltip="Vent de travers max sur piste mouillée" />
              </label>
              <input
                type="number"
                value={formData.windLimits.maxCrosswindWet}
                onChange={(e) => handleChange('windLimits.maxCrosswindWet', e.target.value)}
                placeholder="15"
                min="0"
                style={inputStyle}
              />
            </div>
          </div>
        </div>
          </>

        </div>
      )}

      {/* Section Masse & Centrage */}
      <div style={{ marginBottom: '16px' }}>
        <AccordionButton
          isOpen={showMasseCentrage}
          onClick={() => setShowMasseCentrage(!showMasseCentrage)}
          icon="⚖️"
          title="Masse & Centrage"
        />
      </div>

      {showMasseCentrage && (
        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--bg-overlay)', borderRadius: 'var(--radius-sm)' }}>
          <>

            {/* Masses et Centrage */}
        <div>
          <h4 style={{ fontSize: 'var(--fs-title)', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>
            ⚖️ Masses et Centrage
          </h4>
          
          {/* Masse à vide et son bras de levier */}
          <div style={{ 
            backgroundColor: 'var(--bg-overlay)', 
            padding: '12px', 
            borderRadius: 'var(--radius-sm)', 
            marginBottom: '16px',
            border: '1px solid var(--border-subtle)'
          }}>
            <h5 style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-primary)' }}>
              Masse à vide
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>
                  Masse ({massUnit})
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
                  Bras de levier ({armUnit})
                  <InfoIcon tooltip="Distance du CG de la masse à vide par rapport à la référence" />
                </label>
                <input
                  type="number"
                  value={formData.armLengths.emptyMassArm}
                  onChange={(e) => handleChange('armLengths.emptyMassArm', e.target.value)}
                  placeholder="2.15"
                  min="0"
                  step="0.01"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Carburant et son bras de levier */}
          <div style={{ 
            backgroundColor: 'var(--bg-overlay)', 
            padding: '12px', 
            borderRadius: 'var(--radius-sm)', 
            marginBottom: '16px',
            border: '1px solid var(--border-subtle)'
          }}>
            <h5 style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-primary)' }}>
              Carburant
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>
                  Capacité max ({fuelUnit})
                  <InfoIcon tooltip="Capacité maximale des réservoirs" />
                </label>
                <input
                  type="number"
                  value={getUnit('fuel') !== 'ltr' ? convert(formData.fuelCapacity, 'fuel', 'ltr', { toUnit: getUnit('fuel') }).toFixed(1) : formData.fuelCapacity}
                  onChange={(e) => {
                    const valueInStorageUnit = getUnit('fuel') !== 'ltr' ? toStorage(parseFloat(e.target.value) || 0, 'fuel') : e.target.value;
                    handleChange('fuelCapacity', valueInStorageUnit);
                  }}
                  placeholder={getUnit('fuel') === 'gal' ? "40" : getUnit('fuel') === 'kg' ? "120" : "150"}
                  min="0"
                  step="0.1"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Bras de levier ({armUnit})
                  <InfoIcon tooltip="Distance du CG du carburant par rapport à la référence" />
                </label>
                <input
                  type="number"
                  value={formData.armLengths.fuelArm}
                  onChange={(e) => handleChange('armLengths.fuelArm', e.target.value)}
                  placeholder="2.18"
                  min="0"
                  step="0.01"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Sièges et leurs bras de levier */}
          <div style={{ 
            backgroundColor: 'var(--bg-overlay)', 
            padding: '12px', 
            borderRadius: 'var(--radius-sm)', 
            marginBottom: '16px',
            border: '1px solid var(--border-subtle)'
          }}>
            <h5 style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-primary)' }}>
              Sièges (bras de levier en m)
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>
                  Siège avant gauche (Pilote) - Bras (m)
                  <InfoIcon tooltip="Distance du siège pilote par rapport à la référence (en mètres)" />
                </label>
                <input
                  type="number"
                  value={formData.armLengths.frontSeat1Arm}
                  onChange={(e) => handleChange('armLengths.frontSeat1Arm', e.target.value)}
                  placeholder="2.00"
                  min="0"
                  step="0.01"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Siège avant droit - Bras (m)
                  <InfoIcon tooltip="Distance du siège passager avant par rapport à la référence (en mètres)" />
                </label>
                <input
                  type="number"
                  value={formData.armLengths.frontSeat2Arm}
                  onChange={(e) => handleChange('armLengths.frontSeat2Arm', e.target.value)}
                  placeholder="2.00"
                  min="0"
                  step="0.01"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Siège arrière gauche - Bras (m)
                  <InfoIcon tooltip="Distance du siège arrière gauche par rapport à la référence (en mètres)" />
                </label>
                <input
                  type="number"
                  value={formData.armLengths.rearSeat1Arm}
                  onChange={(e) => handleChange('armLengths.rearSeat1Arm', e.target.value)}
                  placeholder="2.30"
                  min="0"
                  step="0.01"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Siège arrière droit - Bras (m)
                  <InfoIcon tooltip="Distance du siège arrière droit par rapport à la référence (en mètres)" />
                </label>
                <input
                  type="number"
                  value={formData.armLengths.rearSeat2Arm}
                  onChange={(e) => handleChange('armLengths.rearSeat2Arm', e.target.value)}
                  placeholder="2.30"
                  min="0"
                  step="0.01"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Sièges supplémentaires dynamiques */}
          <div style={{ 
            backgroundColor: 'var(--bg-overlay)', 
            padding: '12px', 
            borderRadius: 'var(--radius-sm)', 
            marginBottom: '16px',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h5 style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>
                💺 Sièges supplémentaires
              </h5>
              <button
                type="button"
                onClick={addAdditionalSeat}
                style={{
                  padding: '4px 12px',
                  backgroundColor: 'var(--text-secondary)',
                  color: 'var(--text-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--fs-body)',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                + Ajouter un siège
              </button>
            </div>
            
            {!formData.additionalSeats || formData.additionalSeats.length === 0 ? (
              <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', margin: '8px 0' }}>
                Aucun siège supplémentaire. Cliquez sur "Ajouter un siège" pour les configurations 6+ places.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(formData.additionalSeats || []).map((seat) => (
                  <div key={seat.id} style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '2fr 1fr auto', 
                    gap: '12px',
                    padding: '8px',
                    backgroundColor: 'var(--bg-overlay)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <div>
                      <label style={{...labelStyle, fontSize: 'var(--fs-caption)', color: 'var(--text-primary)'}}>
                        Nom du siège
                        <InfoIcon tooltip="Identifiant du siège (ex: Rangée 3 gauche)" />
                      </label>
                      <input
                        type="text"
                        value={seat.name}
                        onChange={(e) => updateAdditionalSeat(seat.id, 'name', e.target.value)}
                        placeholder="Ex: Rangée 3 gauche"
                        style={{...inputStyle, fontSize: 'var(--fs-body)'}}
                      />
                    </div>
                    <div>
                      <label style={{...labelStyle, fontSize: 'var(--fs-caption)', color: 'var(--text-primary)'}}>
                        Bras de levier ({armUnit})
                        <InfoIcon tooltip="Distance par rapport à la référence" />
                      </label>
                      <input
                        type="number"
                        value={seat.arm}
                        onChange={(e) => updateAdditionalSeat(seat.id, 'arm', e.target.value)}
                        placeholder="2.50"
                        min="0"
                        step="0.01"
                        style={{...inputStyle, fontSize: 'var(--fs-body)'}}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAdditionalSeat(seat.id)}
                      style={{
                        padding: '4px',
                        backgroundColor: 'var(--color-red-critical)',
                        color: 'var(--text-primary)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        alignSelf: 'end',
                        marginBottom: '4px'
                      }}
                      title="Supprimer ce siège"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', marginTop: '8px', marginBottom: 0 }}>
              Utile pour les avions 6+ places, les configurations club ou les sièges additionnels
            </p>
          </div>

          {/* Compartiments bagages dynamiques */}
          <div style={{ 
            backgroundColor: 'var(--bg-overlay)', 
            padding: '12px', 
            borderRadius: 'var(--radius-sm)', 
            marginBottom: '16px',
            border: '1px solid var(--accent-primary)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h5 style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>
                🏎️ Compartiments bagages
              </h5>
              <button
                type="button"
                onClick={addBaggageCompartment}
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--app-bg)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 12px',
                  fontSize: 'var(--fs-body)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Plus size={16} />
                Ajouter un compartiment
              </button>
            </div>
            
            {formData.baggageCompartments && formData.baggageCompartments.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {formData.baggageCompartments.map((compartment, index) => (
                  <div key={compartment.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr auto',
                    gap: '12px',
                    padding: '12px',
                    backgroundColor: 'var(--bg-overlay)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <div>
                      <label style={{...labelStyle, fontSize: 'var(--fs-caption)', color: 'var(--text-primary)'}}>
                        Nom du compartiment
                      </label>
                      <input
                        type="text"
                        value={compartment.name}
                        onChange={(e) => updateBaggageCompartment(compartment.id, 'name', e.target.value)}
                        placeholder="Nom du compartiment"
                        style={{...inputStyle, fontSize: 'var(--fs-body)'}}
                      />
                    </div>
                    <div>
                      <label style={{...labelStyle, fontSize: 'var(--fs-caption)', color: 'var(--text-primary)'}}>
                        Bras de levier ({armUnit})
                        <InfoIcon tooltip="Distance par rapport à la référence" />
                      </label>
                      <input
                        type="number"
                        value={compartment.arm}
                        onChange={(e) => updateBaggageCompartment(compartment.id, 'arm', e.target.value)}
                        placeholder="2.45"
                        min="0"
                        step="0.01"
                        style={{...inputStyle, fontSize: 'var(--fs-body)'}}
                      />
                    </div>
                    <div>
                      <label style={{...labelStyle, fontSize: 'var(--fs-caption)', color: 'var(--text-primary)'}}>
                        Masse max ({massUnit})
                        <InfoIcon tooltip="Masse maximale autorisée" />
                      </label>
                      <input
                        type="number"
                        value={getUnit('weight') !== 'kg' ?
                          (Number(convert(compartment.maxWeight || 0, 'weight', 'kg', { toUnit: getUnit('weight') })) || 0).toFixed(1) :
                          compartment.maxWeight}
                        onChange={(e) => {
                          const valueInStorageUnit = getUnit('weight') !== 'kg' ? 
                            toStorage(parseFloat(e.target.value) || 0, 'weight') : 
                            e.target.value;
                          updateBaggageCompartment(compartment.id, 'maxWeight', valueInStorageUnit);
                        }}
                        placeholder={getUnit('weight') === 'lbs' ? "110" : "50"}
                        min="0"
                        style={{...inputStyle, fontSize: 'var(--fs-body)'}}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'end' }}>
                      {formData.baggageCompartments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBaggageCompartment(compartment.id)}
                          style={{
                            backgroundColor: 'var(--color-red-critical)',
                            color: 'var(--text-primary)',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            padding: '8px',
                            fontSize: 'var(--fs-body)',
                            cursor: 'pointer',
                            height: '32px',
                            width: '32px'
                          }}
                          title="Supprimer ce compartiment"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '20px',
                color: 'var(--text-tertiary)',
                fontStyle: 'italic'
              }}>
                Aucun compartiment défini. Cliquez sur "Ajouter un compartiment" pour commencer.
              </div>
            )}
          </div>

          {/* Masses limites */}
          <div style={{ 
            backgroundColor: 'var(--bg-overlay)', 
            padding: '12px', 
            borderRadius: 'var(--radius-sm)', 
            marginBottom: '16px',
            border: '1px solid var(--bg-overlay)'
          }}>
            <h5 style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-primary)' }}>
              Masses limites ({massUnit})
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div>
                <label style={labelStyle}>
                  Masse min décollage
                  <InfoIcon tooltip="Masse minimale pour le décollage" />
                </label>
                <input
                  type="number"
                  value={formData.masses.minTakeoffMass}
                  onChange={(e) => handleChange('masses.minTakeoffMass', e.target.value)}
                  placeholder="900"
                  min="0"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Masse max décollage
                  <InfoIcon tooltip="Masse maximale au décollage (MTOW)" />
                </label>
                <input
                  type="number"
                  value={formData.maxTakeoffWeight}
                  onChange={(e) => handleChange('maxTakeoffWeight', e.target.value)}
                  placeholder="1200"
                  min="0"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Masse max atterrissage
                  <InfoIcon tooltip="Masse maximale à l'atterrissage (MLW)" />
                </label>
                <input
                  type="number"
                  value={formData.limitations.maxLandingMass}
                  onChange={(e) => handleChange('limitations.maxLandingMass', e.target.value)}
                  placeholder="1150"
                  min="0"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* CENTER OF GRAVITY - Enveloppe de centrage */}
          <div style={{ 
            backgroundColor: 'var(--bg-overlay)', 
            padding: '16px', 
            borderRadius: 'var(--radius-sm)', 
            marginBottom: '16px',
            border: '2px solid var(--color-red-critical)',
            marginTop: '24px'
          }}>
            <h5 style={{ fontSize: 'var(--fs-title)', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>
              ⚠️ CENTER OF GRAVITY - Enveloppe de centrage
            </h5>

            {/* CG Avant (Most forward) - Points dynamiques */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h6 style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                  📍 Most Forward CG (Limite avant)
                </h6>
                <button
                  type="button"
                  onClick={addForwardPoint}
                  style={{
                    backgroundColor: 'var(--text-primary)',
                    color: 'var(--text-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 12px',
                    fontSize: 'var(--fs-body)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  ➕ Ajouter un point
                </button>
              </div>
              
              <div style={{
                backgroundColor: 'var(--bg-overlay)',
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)'
              }}>
                <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-tertiary)', marginBottom: '12px', margin: '0 0 12px 0' }}>
                  💡 <strong>Astuce:</strong> Ajoutez plusieurs points pour définir une courbe de limite CG avant. Les points seront connectés par ordre croissant de masse.
                </p>
                
                {formData.cgEnvelope.forwardPoints.map((point, index) => (
                  <div key={point.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr auto',
                    gap: '12px',
                    marginBottom: '12px',
                    padding: '12px',
                    backgroundColor: 'var(--bg-overlay)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <div>
                      <label style={{...labelStyle, fontSize: 'var(--fs-caption)', color: 'var(--text-primary)'}}>
                        Masse ({massUnit})
                        <InfoIcon tooltip={`Point ${index + 1} - Masse pour la limite CG avant`} />
                      </label>
                      <input
                        type="number"
                        value={point.weight}
                        onChange={(e) => updateForwardPoint(point.id, 'weight', e.target.value)}
                        placeholder="940"
                        min="0"
                        style={{...inputStyle, fontSize: 'var(--fs-body)'}}
                      />
                    </div>
                    <div>
                      <label style={{...labelStyle, fontSize: 'var(--fs-caption)', color: 'var(--text-primary)'}}>
                        CG (m)
                        <InfoIcon tooltip={`Point ${index + 1} - Position CG avant à cette masse`} />
                      </label>
                      <input
                        type="number"
                        value={point.cg}
                        onChange={(e) => updateForwardPoint(point.id, 'cg', e.target.value)}
                        placeholder="2.4000"
                        min="0"
                        step="0.0001"
                        style={{...inputStyle, fontSize: 'var(--fs-body)'}}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'end', gap: '4px' }}>
                      {formData.cgEnvelope.forwardPoints.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeForwardPoint(point.id)}
                          style={{
                            backgroundColor: 'var(--color-red-critical)',
                            color: 'var(--text-primary)',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            padding: '8px',
                            fontSize: 'var(--fs-body)',
                            cursor: 'pointer',
                            minWidth: '32px',
                            height: '32px'
                          }}
                          title="Supprimer ce point"
                        >
                          🗑️
                        </button>
                      )}
                      <span style={{ 
                        fontSize: 'var(--fs-caption)', 
                        color: 'var(--text-secondary)', 
                        alignSelf: 'center',
                        minWidth: '40px',
                        textAlign: 'center'
                      }}>
                        Point {index + 1}
                      </span>
                    </div>
                  </div>
                ))}
                
                {formData.cgEnvelope.forwardPoints.length === 0 && (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    color: 'var(--text-tertiary)',
                    fontStyle: 'italic'
                  }}>
                    Aucun point défini. Cliquez sur "Ajouter un point" pour commencer.
                  </div>
                )}
              </div>
            </div>

            {/* CG Arrière (Most rearward) */}
            <div>
              <h6 style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>
                📍 Most Rearward CG (Limite arrière)
              </h6>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>
                    Masse min ({massUnit})
                    <InfoIcon tooltip="Masse minimale pour la limite CG arrière" />
                  </label>
                  <input
                    type="number"
                    value={formData.cgEnvelope.aftMinWeight}
                    onChange={(e) => handleChange('cgEnvelope.aftMinWeight', e.target.value)}
                    placeholder="940"
                    min="0"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    CG arrière constant (m)
                    <InfoIcon tooltip="Position CG arrière (constante sur toute la plage)" />
                  </label>
                  <input
                    type="number"
                    value={formData.cgEnvelope.aftCG}
                    onChange={(e) => handleChange('cgEnvelope.aftCG', e.target.value)}
                    placeholder="2.5300"
                    min="0"
                    step="0.0001"
                    style={inputStyle}
                  />
                </div>
                
                <div>
                  <label style={labelStyle}>
                    Masse max ({massUnit})
                    <InfoIcon tooltip="Masse maximale pour la limite CG arrière" />
                  </label>
                  <input
                    type="number"
                    value={formData.cgEnvelope.aftMaxWeight}
                    onChange={(e) => handleChange('cgEnvelope.aftMaxWeight', e.target.value)}
                    placeholder="1310"
                    min="0"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Visualisation graphique de l'enveloppe */}
            {(() => {
              // Récupérer les points avant dynamiques
              const forwardPoints = formData.cgEnvelope.forwardPoints
                .filter(point => parseFloat(point.weight) > 0 && parseFloat(point.cg) > 0)
                .map(point => ({
                  w: parseFloat(point.weight),
                  cg: parseFloat(point.cg),
                  label: 'Forward'
                }))
                .sort((a, b) => a.w - b.w); // Trier par masse croissante

              // Points arrière
              const aftMinWeight = parseFloat(formData.cgEnvelope.aftMinWeight) || 0;
              const aftCG = parseFloat(formData.cgEnvelope.aftCG) || 0;
              const aftMaxWeight = parseFloat(formData.cgEnvelope.aftMaxWeight) || 0;

              // Calculer les échelles pour le graphique
              const forwardWeights = forwardPoints.map(p => p.w);
              const forwardCGs = forwardPoints.map(p => p.cg);
              const aftWeights = [aftMinWeight, aftMaxWeight].filter(w => w > 0);
              const aftCGs = [aftCG].filter(cg => cg > 0);

              const allWeights = [...forwardWeights, ...aftWeights];
              const allCGs = [...forwardCGs, ...aftCGs];
              
              const minWeight = allWeights.length > 0 ? Math.min(...allWeights) - 50 : 900;
              const maxWeight = allWeights.length > 0 ? Math.max(...allWeights) + 50 : 1400;
              const minCG = allCGs.length > 0 ? Math.min(...allCGs) - 0.1 : 2.0;
              const maxCG = allCGs.length > 0 ? Math.max(...allCGs) + 0.1 : 2.8;

              const toSvgX = (cg) => 50 + (cg - minCG) / (maxCG - minCG) * 400;
              const toSvgY = (weight) => 250 - (weight - minWeight) / (maxWeight - minWeight) * 200;

              // Créer les points de l'enveloppe
              const envelopePoints = [];
              
              // Ajouter tous les points avant (déjà triés)
              forwardPoints.forEach((point, index) => {
                envelopePoints.push({ 
                  ...point, 
                  label: `Forward ${index + 1}` 
                });
              });
              
              // Points arrière (ordre décroissant de masse)
              if (aftMaxWeight > 0 && aftCG > 0) {
                envelopePoints.push({ w: aftMaxWeight, cg: aftCG, label: 'Aft Max' });
              }
              if (aftMinWeight > 0 && aftCG > 0 && aftMinWeight !== aftMaxWeight) {
                envelopePoints.push({ w: aftMinWeight, cg: aftCG, label: 'Aft Min' });
              }

              return (
                <div style={{
                  backgroundColor: 'var(--bg-overlay)',
                  padding: '20px',
                  borderRadius: 'var(--radius-sm)',
                  marginTop: '20px',
                  border: '2px solid var(--text-secondary)',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ 
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: '16px',
                    padding: '20px',
                    backgroundColor: 'var(--bg-overlay)',
                    borderRadius: 'var(--radius-sm)',
                    border: '2px solid var(--border-subtle)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{
                      position: 'relative',
                      width: '100%',
                      maxWidth: '600px',
                      aspectRatio: '5/3'
                    }}>
                      <svg 
                        viewBox="0 0 500 300" 
                        style={{ 
                          width: '100%',
                          height: '100%',
                          border: '1px solid var(--border-subtle)', 
                          borderRadius: 'var(--radius-sm)', 
                          backgroundColor: 'var(--bg-overlay)'
                        }}>
                      {/* Grille */}
                      <defs>
                        <pattern id="cgGrid" width="25" height="25" patternUnits="userSpaceOnUse">
                          <path d="M 25 0 L 0 0 0 25" fill="none" stroke="var(--border-subtle)" strokeWidth="1"/>
                        </pattern>
                      </defs>
                      <rect width="500" height="300" fill="url(#cgGrid)" />
                      
                      {/* Axes */}
                      <line x1="50" y1="250" x2="450" y2="250" stroke="var(--text-secondary)" strokeWidth="2" />
                      <line x1="50" y1="50" x2="50" y2="250" stroke="var(--text-secondary)" strokeWidth="2" />
                      
                      {/* Labels des axes */}
                      <text x="250" y="280" textAnchor="middle" fontSize="12" fill="var(--text-secondary)">Centre de Gravité (m)</text>
                      <text x="20" y="150" textAnchor="middle" fontSize="12" fill="var(--text-secondary)" transform="rotate(-90 20 150)">Masse ({massUnit})</text>
                      
                      {/* Graduations X (CG) */}
                      {(() => {
                        const ticks = [];
                        for (let i = 0; i <= 4; i++) {
                          const cgValue = minCG + (maxCG - minCG) * (i / 4);
                          const x = 50 + (400 * i) / 4;
                          ticks.push(
                            <g key={`x-${i}`}>
                              <line x1={x} y1="250" x2={x} y2="255" stroke="var(--text-secondary)" strokeWidth="1" />
                              <text x={x} y="270" textAnchor="middle" fontSize="10" fill="var(--text-secondary)">
                                {cgValue.toFixed(2)}
                              </text>
                            </g>
                          );
                        }
                        return ticks;
                      })()}
                      
                      {/* Graduations Y (Masse) */}
                      {(() => {
                        const ticks = [];
                        for (let i = 0; i <= 4; i++) {
                          const weightValue = minWeight + (maxWeight - minWeight) * (i / 4);
                          const y = 250 - (200 * i) / 4;
                          ticks.push(
                            <g key={`y-${i}`}>
                              <line x1="45" y1={y} x2="50" y2={y} stroke="var(--text-secondary)" strokeWidth="1" />
                              <text x="40" y={y + 3} textAnchor="end" fontSize="10" fill="var(--text-secondary)">
                                {Math.round(weightValue)}
                              </text>
                            </g>
                          );
                        }
                        return ticks;
                      })()}
                      
                      {/* Enveloppe */}
                      {envelopePoints.length >= 3 && (
                        <polygon 
                          points={envelopePoints.map(p => `${toSvgX(p.cg)},${toSvgY(p.w)}`).join(' ')}
                          fill="var(--accent-soft)" 
                          stroke="var(--text-primary)" 
                          strokeWidth="2"
                        />
                      )}
                      
                      {/* Points de l'enveloppe */}
                      {envelopePoints.map((point, index) => (
                        <g key={index}>
                          <circle 
                            cx={toSvgX(point.cg)} 
                            cy={toSvgY(point.w)} 
                            r="4" 
                            fill="var(--color-red-critical)" 
                            stroke="white" 
                            strokeWidth="2"
                          />
                          <text 
                            x={toSvgX(point.cg)} 
                            y={toSvgY(point.w) + 20} 
                            textAnchor="middle" 
                            fontSize="8" 
                            fill="var(--text-secondary)"
                          >
                            {point.w}kg / {point.cg}m
                          </text>
                        </g>
                      ))}
                      
                      {/* Message si pas assez de données */}
                      {envelopePoints.length < 3 && (
                        <text x="250" y="150" textAnchor="middle" fontSize="14" fill="var(--text-tertiary)">
                          Saisissez au moins 3 points pour visualiser l'enveloppe
                        </text>
                      )}
                    </svg>
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
        </div>

          </>

        </div>
      )}

      {/* Section Équipements */}
      <div style={{ marginBottom: '16px' }}>
        <AccordionButton
          isOpen={showEquipements}
          onClick={() => setShowEquipements(!showEquipements)}
          icon="📡"
          title="Équipements"
        />
      </div>

      {showEquipements && (
        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--bg-overlay)', borderRadius: 'var(--radius-sm)' }}>
          <>

            {/* Section Communication */}
            <div>
              <h4 style={{ fontSize: 'var(--fs-title)', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
                <span style={{ marginRight: '8px' }}>📻</span>
                Équipements de radiocommunication (COM)
                <InfoIcon tooltip="Équipements de communication avec l'ATC et autres aéronefs" />
              </h4>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '12px',
                backgroundColor: 'var(--bg-overlay)',
                padding: '16px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)'
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
              <h4 style={{ fontSize: 'var(--fs-title)', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
                <span style={{ marginRight: '8px' }}>🧭</span>
                Équipements de navigation et approche (NAV/APP)
                <InfoIcon tooltip="Systèmes de navigation et capacités d'approche aux instruments" />
              </h4>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '12px',
                backgroundColor: 'var(--bg-overlay)',
                padding: '16px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
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
              <h4 style={{ fontSize: 'var(--fs-title)', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
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
                backgroundColor: 'var(--bg-overlay)',
                padding: '16px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)'
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
              <h4 style={{ fontSize: 'var(--fs-title)', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
                <span style={{ marginRight: '8px' }}>🌟</span>
                Capacités spéciales et approbations
                <InfoIcon tooltip="Approbations opérationnelles spéciales" />
              </h4>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '12px',
                backgroundColor: 'var(--bg-overlay)',
                padding: '16px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
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
        
        </div>
      )}

      {/* Section Opérations */}
      <div style={{ marginBottom: '16px' }}>
        <AccordionButton
          isOpen={showOperations}
          onClick={() => setShowOperations(!showOperations)}
          icon="✈️"
          title="Opérations"
        />
      </div>

      {showOperations && (
        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--bg-overlay)', borderRadius: 'var(--radius-sm)' }}>
          <>

            {/* Opérations de base */}
            <div>
              <h4 style={{ fontSize: 'var(--fs-title)', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>
                📋 Règles de vol
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.vfrDay}
                    onChange={(e) => handleChange('approvedOperations.vfrDay', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>☀️ VFR Jour</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.vfrNight}
                    onChange={(e) => handleChange('approvedOperations.vfrNight', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>🌙 VFR Nuit</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.ifrDay}
                    onChange={(e) => handleChange('approvedOperations.ifrDay', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>☁️ IFR Jour</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.ifrNight}
                    onChange={(e) => handleChange('approvedOperations.ifrNight', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>🌙☁️ IFR Nuit</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.svfr}
                    onChange={(e) => handleChange('approvedOperations.svfr', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>🌫️ VFR Spécial (SVFR)</span>
                </label>
              </div>
            </div>

            {/* Opérations spéciales */}
            <div>
              <h4 style={{ fontSize: 'var(--fs-title)', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>
                🎯 Opérations spéciales
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.formation}
                    onChange={(e) => handleChange('approvedOperations.formation', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>✈️✈️ Vol en formation</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.aerobatics}
                    onChange={(e) => handleChange('approvedOperations.aerobatics', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>🎪 Voltige aérienne</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.banner}
                    onChange={(e) => handleChange('approvedOperations.banner', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>🏴 Remorquage bannière</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.glider}
                    onChange={(e) => handleChange('approvedOperations.glider', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>🪂 Remorquage planeur</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.parachute}
                    onChange={(e) => handleChange('approvedOperations.parachute', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>🪂 Largage parachutistes</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.agricultural}
                    onChange={(e) => handleChange('approvedOperations.agricultural', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>🚜 Épandage agricole</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.aerial}
                    onChange={(e) => handleChange('approvedOperations.aerial', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>📷 Photo/Surveillance</span>
                </label>
              </div>
            </div>

            {/* Opérations commerciales et environnement */}
            <div>
              <h4 style={{ fontSize: 'var(--fs-title)', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>
                🏔️ Environnement et usage
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.training}
                    onChange={(e) => handleChange('approvedOperations.training', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>🎓 École de pilotage</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.charter}
                    onChange={(e) => handleChange('approvedOperations.charter', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>🎫 Transport public</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.mountainous}
                    onChange={(e) => handleChange('approvedOperations.mountainous', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>⛰️ Vol en montagne</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.seaplane}
                    onChange={(e) => handleChange('approvedOperations.seaplane', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>🌊 Hydravion</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.skiPlane}
                    onChange={(e) => handleChange('approvedOperations.skiPlane', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>⛷️ Avion sur skis</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.icing}
                    onChange={(e) => handleChange('approvedOperations.icing', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>❄️ Conditions givrantes</span>
                </label>
              </div>
            </div>
          </>

        </div>
      )}

      {/* Section Remarques */}
      <div style={{ marginBottom: '16px' }}>
        <AccordionButton
          isOpen={showRemarques}
          onClick={() => setShowRemarques(!showRemarques)}
          icon="📋"
          title="Remarques"
        />
      </div>

      {showRemarques && (
        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--bg-overlay)', borderRadius: 'var(--radius-sm)' }}>
          <>

            <div>
              <h4 style={{ fontSize: 'var(--fs-title)', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>
                Notes et remarques
              </h4>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>
                  Remarques générales
                  <InfoIcon tooltip="Ajoutez ici toute information pertinente du manuel de vol non couverte dans les autres sections" />
                </label>
                <textarea
                  value={formData.manualRemarks || ''}
                  onChange={(e) => handleChange('manualRemarks', e.target.value)}
                  placeholder="Exemple : Limitations spécifiques, procédures particulières, notes sur les performances, recommandations du constructeur..."
                  style={{
                    ...inputStyle,
                    minHeight: '150px',
                    resize: 'vertical',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: 'var(--fs-body)',
                    lineHeight: '1.5'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>
                  Procédures d'urgence spécifiques
                  <InfoIcon tooltip="Notes sur les procédures d'urgence particulières à cet aéronef" />
                </label>
                <textarea
                  value={formData.emergencyNotes || ''}
                  onChange={(e) => handleChange('emergencyNotes', e.target.value)}
                  placeholder="Procédures d'urgence spécifiques non standards..."
                  style={{
                    ...inputStyle,
                    minHeight: '100px',
                    resize: 'vertical',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: 'var(--fs-body)',
                    lineHeight: '1.5'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>
                  Notes de maintenance
                  <InfoIcon tooltip="Informations de maintenance importantes pour le pilote" />
                </label>
                <textarea
                  value={formData.maintenanceNotes || ''}
                  onChange={(e) => handleChange('maintenanceNotes', e.target.value)}
                  placeholder="Points de vigilance, intervalles de maintenance critiques..."
                  style={{
                    ...inputStyle,
                    minHeight: '100px',
                    resize: 'vertical',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: 'var(--fs-body)',
                    lineHeight: '1.5'
                  }}
                />
              </div>

            </div>
          </>
        
        </div>
      )}

      {/* Section Performances IA */}
      <div style={{ marginBottom: '16px' }}>
        <AccordionButton
          isOpen={showPerformancesIA}
          onClick={() => setShowPerformancesIA(!showPerformancesIA)}
          icon="🤖"
          title="Analyse Avancée des Performances"
        />
      </div>

      {showPerformancesIA && (
        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--bg-overlay)', borderRadius: 'var(--radius-sm)' }}>
          <>
            <div style={{ marginTop: '20px' }}>
              <AdvancedPerformanceAnalyzer 
                aircraft={{
                  ...formData,
                  id: aircraft?.id,
                  performance: aircraft?.performance,
                  advancedPerformance: aircraft?.advancedPerformance
                }}
                onPerformanceUpdate={async (performanceData) => {
                  // Mettre à jour les données de performance dans le formulaire
                  console.log('📊 Mise à jour des performances IA avancées:', performanceData);
                  
                  try {
                    // Stocker avec le gestionnaire optimisé pour éviter QuotaExceededError
                    if (aircraft?.id) {
                      await performanceDataManager.storePerformanceData(aircraft.id, performanceData);
                      console.log('✅ Données de performance stockées avec le gestionnaire optimisé');
                    }
                    
                    // Mettre à jour le formulaire avec des données allégées (sans images base64)
                    const lightweightData = {
                      advancedPerformance: performanceData.advancedPerformance ? {
                        tables: performanceData.advancedPerformance.tables?.map(table => ({
                          table_name: table.table_name,
                          table_type: table.table_type,
                          conditions: table.conditions,
                          units: table.units,
                          data: table.data,
                          confidence: table.confidence
                        })) || [],
                        extractionMetadata: {
                          analyzedAt: performanceData.advancedPerformance.extractionMetadata?.analyzedAt,
                          totalTables: performanceData.advancedPerformance.extractionMetadata?.totalTables
                        }
                      } : null
                    };
                    
                    setFormData(prev => ({
                      ...prev,
                      ...lightweightData,
                      // S'assurer que advancedPerformance est bien ajouté au formData
                      advancedPerformance: lightweightData.advancedPerformance || prev.advancedPerformance
                    }));
                    
                  } catch (error) {
                    console.error('❌ Erreur lors de la sauvegarde des performances:', error);
                    // Afficher une notification à l'utilisateur
                    alert('Erreur lors de la sauvegarde des données de performance. Les données sont trop volumineuses.');
                  }
                }}
              />
            </div>
          </>
        </div>
      )}

      {/* Boutons d'action (toujours visibles) */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
        <button
          type="submit"
          style={{
            ...buttonSectionStyle,
            padding: '12px 32px'
          }}
          onClick={() => console.log('🔴 BOUTON CLIQUÉ - Type:', aircraft ? 'UPDATE' : 'CREATE')}
        >
          {aircraft ? 'Mettre à jour' : 'Créer'}
        </button>
      </div>
    </form>
  );
});

AircraftForm.displayName = 'AircraftForm';

export default AircraftModule;
