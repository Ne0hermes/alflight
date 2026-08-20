// src/features/aircraft/components/ImportPerformanceFromAircraftDialog.jsx
// ============================================================================
// ✈️ IMPORT DES PERFORMANCES DEPUIS UN AUTRE AVION DE LA BASE COMMUNAUTAIRE
// ----------------------------------------------------------------------------
// Cas d'usage pilote (F-GBTU / F-GIEA, deux PA-28-161 du même club) : quand un
// avion est EXACTEMENT le même qu'un autre déjà renseigné, recopier ses
// performances au lieu de tout ressaisir depuis le manuel.
//
// Décisions de conception :
// - La liste vient de communityService.getAllPresets() (métadonnées SEULEMENT,
//   politique mémoire assumée du service : aircraft_data n'est chargé qu'à la
//   sélection). Le RÉSUMÉ des performances d'un avion s'affiche donc quand le
//   pilote le sélectionne (un seul getPresetById), pas pour toute la liste —
//   charger 18 fiches complètes (photos base64 comprises) ferait replonger
//   dans les crashs mémoire documentés dans core/contexts/index.jsx.
// - Tri : même modèle d'abord (comparaison SOUPLE — « PA-28-161 » ≡ « PA28-161 »),
//   puis alphabétique par immatriculation. L'avion en cours d'édition est exclu.
// - Modèles différents → bandeau d'avertissement explicite : les performances
//   d'un manuel ne valent que pour son type exact. Le pilote peut continuer
//   (il est responsable), mais en connaissance de cause.
// - Import par GROUPE coché (abaques / tableaux / facteurs correctifs /
//   certifications « absent du manuel ») : copie profonde, id de modèle
//   régénérés (anti-collision), id internes de graphes/courbes CONSERVÉS
//   (cohérence linkedTo / cascadeOrder). Provenance posée sur chaque élément
//   (importedPerformanceFrom = { registration, presetId, date }).
// - Les images d'atelier (metadata.workshop.image) font partie de la structure
//   de l'abaque : elles SUIVENT (URL Storage depuis R20/B, ou base64 legacy).
//   En revanche les images d'extraction MANEX des tableaux (sourceImage) ne
//   servent qu'à la relecture sur l'avion source : elles sont strippées.
// - Les certifications performance.* de bypassedFields affirment quelque chose
//   sur LE manuel de l'avion source : la case n'est pré-cochée QUE si les
//   modèles concordent.
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Chip,
  CircularProgress,
  Alert,
  Checkbox,
  FormControlLabel,
  TextField,
  Divider
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Flight as FlightIcon
} from '@mui/icons-material';
import communityService from '../../../services/communityService';
import { getPresentOperationIds, PERF_BYPASS_PREFIX } from '../utils/performanceCoverage';
import { getOperation } from '../../../abac/curves/core/operationCatalog';

// Comparaison SOUPLE de modèles : on ignore casse, espaces, tirets et
// ponctuation — « PA-28-161 », « PA28-161 » et « pa 28 161 » sont le MÊME type.
export const normalizeModelName = (m) =>
  String(m || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// Copie PROFONDE : les données viennent de Supabase (JSON pur), le
// round-trip JSON est donc sans perte et casse toute référence partagée
// avec la fiche source.
const deepCopy = (obj) => (obj === undefined ? obj : JSON.parse(JSON.stringify(obj)));

// Clés performance.* de bypassedFields = certifications « absent du manuel ».
export const getPerfBypassKeys = (aircraft) =>
  (Array.isArray(aircraft?.bypassedFields) ? aircraft.bypassedFields : [])
    .filter((k) => typeof k === 'string' && k.startsWith(PERF_BYPASS_PREFIX));

// Strippe les images d'extraction MANEX (sourceImage) et tout gros base64
// résiduel d'un objet advancedPerformance. Les tableaux eux-mêmes (data,
// conditions, operationId…) passent intacts. Seuil 100 KB : en dessous, un
// data: URL est une vignette inoffensive ; au-dessus, c'est une page scannée.
const stripHeavyFromAdvancedPerformance = (node) => {
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(stripHeavyFromAdvancedPerformance);
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === 'sourceImage') continue; // image de relecture, propre à l'avion source
    if (typeof v === 'string' && v.startsWith('data:') && v.length > 100_000) {
      continue; // gros base64 (page scannée) : inutile sur l'avion cible
    }
    out[k] = stripHeavyFromAdvancedPerformance(v);
  }
  return out;
};

// ── Préparation des groupes importés (copie profonde + provenance) ──────────

// Abaques : id de MODÈLE régénéré (anti-collision entre avions), mais id
// INTERNES (graphes, courbes) conservés — linkedTo et cascadeOrder pointent
// dessus. Les images d'atelier (metadata.workshop.image) suivent telles
// quelles : elles font partie de la structure de l'abaque.
export const prepareImportedModels = (models, provenance) =>
  (models || []).map((m, i) => {
    const copy = deepCopy(m);
    copy.id = `model_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`;
    copy.importedPerformanceFrom = { ...provenance };
    copy.updatedAt = new Date().toISOString();
    return copy;
  });

// Tableaux : l'objet advancedPerformance entier, hors images/base64 volumineuses.
export const prepareImportedAdvancedPerformance = (ap, provenance) => {
  const stripped = stripHeavyFromAdvancedPerformance(deepCopy(ap)) || {};
  const tables = (stripped.tables || []).map((t) => ({
    ...t,
    importedPerformanceFrom: { ...provenance }
  }));
  return {
    ...stripped,
    tables,
    extractionMetadata: {
      ...(stripped.extractionMetadata || {}),
      totalTables: tables.length,
      lastModified: new Date().toISOString(),
      importedPerformanceFrom: { ...provenance }
    }
  };
};

// Facteurs correctifs : id régénérés (même motif anti-collision que les modèles).
export const prepareImportedCorrections = (corrections, provenance) =>
  (corrections || []).map((c, i) => ({
    ...deepCopy(c),
    id: `corr-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
    importedPerformanceFrom: { ...provenance }
  }));

const ImportPerformanceFromAircraftDialog = ({ open, onClose, currentData, onImport }) => {
  const [presets, setPresets] = useState(null); // null = chargement en cours
  const [loadError, setLoadError] = useState(null);
  const [filter, setFilter] = useState('');

  const [selected, setSelected] = useState(null); // métadonnées du preset choisi
  const [source, setSource] = useState(null); // extrait perf de la fiche complète
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState(null);
  const [checks, setChecks] = useState({ models: false, tables: false, corrections: false, bypass: false });

  // Cache des fiches déjà téléchargées (extrait perf SEULEMENT — pas de photo
  // ni de MANEX en mémoire) : re-sélectionner un avion est instantané.
  const cacheRef = useRef(new Map());

  const currentModelKey = normalizeModelName(currentData?.model);
  const isSameModel = (p) => !!currentModelKey && normalizeModelName(p?.model) === currentModelKey;

  // ── Chargement de la liste à l'ouverture ────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setSource(null);
    setSourceError(null);
    setFilter('');
    setPresets(null);
    setLoadError(null);
    let cancelled = false;
    (async () => {
      try {
        const all = await communityService.getAllPresets();
        if (cancelled) return;
        const curReg = String(currentData?.registration || '').trim().toUpperCase();
        // Exclure l'avion EN COURS d'édition : par preset lié, ou par immat.
        const filtered = all.filter((p) => {
          if (currentData?.communityPresetId && p.id === currentData.communityPresetId) return false;
          if (curReg && String(p.registration || '').trim().toUpperCase() === curReg) return false;
          return true;
        });
        // Tri : même modèle d'abord, puis alphabétique par immatriculation.
        filtered.sort((a, b) => {
          const sa = isSameModel(a) ? 0 : 1;
          const sb = isSameModel(b) ? 0 : 1;
          if (sa !== sb) return sa - sb;
          return String(a.registration || '').localeCompare(String(b.registration || ''));
        });
        setPresets(filtered);
      } catch (e) {
        if (!cancelled) {
          console.error('[ImportPerf] Chargement des presets impossible:', e);
          setLoadError(e?.message || 'Chargement impossible');
          setPresets([]);
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Sélection d'un avion source : téléchargement de sa fiche complète ───
  const handleSelect = async (preset) => {
    setSelected(preset);
    setSourceError(null);
    const cached = cacheRef.current.get(preset.id);
    if (cached) {
      setSource(cached);
      initChecks(cached, preset);
      return;
    }
    setSourceLoading(true);
    try {
      const full = await communityService.getPresetById(preset.id);
      // Extrait PERFORMANCE seulement — la photo et le MANEX (plusieurs MB)
      // ne servent à rien ici et ne doivent pas rester en mémoire.
      const slim = {
        registration: full.registration || preset.registration,
        model: full.model || preset.model,
        performanceModels: full.performanceModels || [],
        advancedPerformance: full.advancedPerformance || null,
        performanceTables: full.performanceTables || null,
        performanceCorrections: full.performanceCorrections || [],
        bypassedFields: Array.isArray(full.bypassedFields) ? full.bypassedFields : []
      };
      cacheRef.current.set(preset.id, slim);
      setSource(slim);
      initChecks(slim, preset);
    } catch (e) {
      console.error('[ImportPerf] Chargement de la fiche source impossible:', e);
      setSourceError(e?.message || 'Téléchargement impossible');
    } finally {
      setSourceLoading(false);
    }
  };

  // Cases cochées par défaut si la source possède le groupe ; la case
  // « certifications » ne l'est QUE si les modèles concordent (elle affirme
  // quelque chose sur LE manuel, donc seulement pertinente à type identique).
  const initChecks = (slim, preset) => {
    const same = isSameModel(preset);
    setChecks({
      models: (slim.performanceModels?.length || 0) > 0,
      tables: (slim.advancedPerformance?.tables?.length || 0) > 0,
      corrections: (slim.performanceCorrections?.length || 0) > 0,
      bypass: same && getPerfBypassKeys(slim).length > 0
    });
  };

  const handleBackToList = () => {
    setSelected(null);
    setSource(null);
    setSourceError(null);
  };

  // ── Confirmation : construction du payload et remise au parent ──────────
  const handleConfirm = () => {
    if (!source || !selected) return;
    const provenance = {
      registration: source.registration || selected.registration,
      presetId: selected.id,
      date: new Date().toISOString()
    };
    const payload = { provenance, sourceModel: selected.model, sameModel: isSameModel(selected) };
    if (checks.models && source.performanceModels?.length) {
      payload.performanceModels = prepareImportedModels(source.performanceModels, provenance);
    }
    if (checks.tables && source.advancedPerformance?.tables?.length) {
      payload.advancedPerformance = prepareImportedAdvancedPerformance(source.advancedPerformance, provenance);
    }
    if (checks.corrections && source.performanceCorrections?.length) {
      payload.performanceCorrections = prepareImportedCorrections(source.performanceCorrections, provenance);
    }
    if (checks.bypass) {
      const keys = getPerfBypassKeys(source);
      if (keys.length) payload.bypassedPerformanceKeys = keys;
    }
    // Le parent confirme le remplacement d'éventuelles données existantes ;
    // s'il renvoie false (pilote a annulé), le dialogue reste ouvert.
    const applied = onImport?.(payload);
    if (applied !== false) onClose();
  };

  // ── Rendu ────────────────────────────────────────────────────────────────
  const filterKey = filter.trim().toUpperCase();
  const visiblePresets = (presets || []).filter((p) =>
    !filterKey ||
    String(p.registration || '').toUpperCase().includes(filterKey) ||
    String(p.model || '').toUpperCase().includes(filterKey) ||
    String(p.manufacturer || '').toUpperCase().includes(filterKey)
  );

  const nbModels = source?.performanceModels?.length || 0;
  const nbTables = source?.advancedPerformance?.tables?.length || 0;
  const nbCorrections = source?.performanceCorrections?.length || 0;
  const perfBypassKeys = source ? getPerfBypassKeys(source) : [];
  const operationLabels = source
    ? Array.from(getPresentOperationIds(source)).map((id) => getOperation(id)?.labelFr || id)
    : [];
  const sameModel = selected ? isSameModel(selected) : true;
  const nothingToImport = source && nbModels === 0 && nbTables === 0 && nbCorrections === 0 && perfBypassKeys.length === 0;
  const nothingChecked = !checks.models && !checks.tables && !checks.corrections && !checks.bypass;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FlightIcon fontSize="small" />
        Importer les performances d'un autre avion
      </DialogTitle>

      <DialogContent dividers>
        {/* ── Phase 1 : choix de l'avion source ── */}
        {!selected && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Choisissez l'avion de la base communautaire dont vous voulez recopier les
              performances. Les avions du même modèle ({currentData?.model || '—'}) sont listés en premier.
            </Typography>
            <TextField
              size="small"
              fullWidth
              placeholder="Filtrer par immatriculation, modèle ou constructeur…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              sx={{ mb: 1 }}
            />
            {presets === null && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={28} />
              </Box>
            )}
            {loadError && (
              <Alert severity="error" sx={{ mb: 1 }}>
                Impossible de charger la base communautaire : {loadError}
              </Alert>
            )}
            {presets !== null && !loadError && visiblePresets.length === 0 && (
              <Alert severity="info">Aucun autre avion disponible dans la base communautaire.</Alert>
            )}
            <List dense sx={{ maxHeight: 340, overflowY: 'auto' }}>
              {visiblePresets.map((p) => (
                <ListItemButton key={p.id} onClick={() => handleSelect(p)} divider>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <strong>{p.registration || '—'}</strong>
                        <span>{p.model || 'Modèle inconnu'}</span>
                        {isSameModel(p) && (
                          <Chip label="même modèle" size="small" color="success" variant="outlined" />
                        )}
                      </Box>
                    }
                    secondary={p.manufacturer || null}
                  />
                </ListItemButton>
              ))}
            </List>
            <Typography variant="caption" color="text.secondary">
              Le détail des performances (abaques, tableaux, facteurs) s'affiche après sélection
              d'un avion — la fiche complète n'est téléchargée qu'à ce moment-là.
            </Typography>
          </>
        )}

        {/* ── Phase 2 : résumé de la source + choix de ce qu'on importe ── */}
        {selected && (
          <>
            <Button size="small" startIcon={<ArrowBackIcon />} onClick={handleBackToList} sx={{ mb: 1 }}>
              Choisir un autre avion
            </Button>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {selected.registration} — {selected.model || 'Modèle inconnu'}
            </Typography>

            {/* Avertissement de TYPE : les performances d'un manuel ne valent
                que pour son type exact. Le pilote reste responsable. */}
            {!sameModel && (
              <Alert severity="warning" sx={{ my: 1 }}>
                ⚠ Modèles différents ({selected.model || '?'} vs {currentData?.model || '?'}) —
                les performances d'un manuel ne valent que pour son type exact ;
                vérifiez l'édition du manuel de vol.
              </Alert>
            )}

            {sourceLoading && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
                <CircularProgress size={20} />
                <Typography variant="body2">Téléchargement de la fiche complète…</Typography>
              </Box>
            )}
            {sourceError && (
              <Alert severity="error" sx={{ my: 1 }}>
                Téléchargement impossible : {sourceError}
              </Alert>
            )}

            {source && !sourceLoading && (
              <>
                {operationLabels.length > 0 && (
                  <Box sx={{ my: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Opérations couvertes :
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                      {operationLabels.map((label) => (
                        <Chip key={label} label={label} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </Box>
                )}
                <Divider sx={{ my: 1 }} />
                {nothingToImport ? (
                  <Alert severity="info">Cet avion n'a aucune donnée de performance à importer.</Alert>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={checks.models}
                          disabled={nbModels === 0}
                          onChange={(e) => setChecks((c) => ({ ...c, models: e.target.checked }))}
                        />
                      }
                      label={`Abaques (${nbModels}) — images d'atelier incluses`}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={checks.tables}
                          disabled={nbTables === 0}
                          onChange={(e) => setChecks((c) => ({ ...c, tables: e.target.checked }))}
                        />
                      }
                      label={`Tableaux du manuel (${nbTables})`}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={checks.corrections}
                          disabled={nbCorrections === 0}
                          onChange={(e) => setChecks((c) => ({ ...c, corrections: e.target.checked }))}
                        />
                      }
                      label={`Facteurs correctifs (${nbCorrections})`}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={checks.bypass}
                          disabled={perfBypassKeys.length === 0}
                          onChange={(e) => setChecks((c) => ({ ...c, bypass: e.target.checked }))}
                        />
                      }
                      label={`Certifications « absent du manuel » (${perfBypassKeys.length})`}
                    />
                    {perfBypassKeys.length > 0 && !sameModel && (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 4 }}>
                        Non pré-cochée : ces certifications portent sur le manuel du
                        {' '}{selected.model || 'modèle source'}, pas sur celui de votre avion.
                      </Typography>
                    )}
                  </Box>
                )}
              </>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!source || sourceLoading || !!nothingToImport || nothingChecked}
        >
          Importer
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportPerformanceFromAircraftDialog;
