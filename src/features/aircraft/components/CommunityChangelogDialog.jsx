// src/features/aircraft/components/CommunityChangelogDialog.jsx
// ============================================================================
// 📜 JOURNAL DES MISES À JOUR de la base communautaire (demande César, 25/08/2026)
// ----------------------------------------------------------------------------
// Un log COMMUN à tous les avions, consultable par l'admin comme par les
// pilotes : chaque entrée = date + immatriculation + version + la note de mise
// à jour saisie par l'admin à l'enregistrement + les champs modifiés (libellés
// français). Source : les _updateHistory embarqués dans les fiches, agrégés
// par communityService.getCommunityChangelog() (requête légère — le journal
// seul descend, jamais les fiches complètes).
// Limite assumée : chaque avion garde ses 10 dernières mises à jour.
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, IconButton,
  Select, MenuItem, FormControl, InputLabel, CircularProgress
} from '@mui/material';
import { ScrollText, X } from 'lucide-react';
import communityService from '@services/communityService';
import { libelleChamps } from '../utils/updateFieldLabels';

const TOUS = '__tous__';

const CommunityChangelogDialog = ({ open, onClose }) => {
  const [entrees, setEntrees] = useState(null); // null = pas encore chargé
  const [erreur, setErreur] = useState(null);
  const [filtre, setFiltre] = useState(TOUS);

  // Chargement à l'OUVERTURE (et rechargé à chaque ouverture : un journal se
  // consulte à jour, pas depuis un cache de la session).
  useEffect(() => {
    if (!open) return;
    let annule = false;
    setEntrees(null);
    setErreur(null);
    // Revue 25/08 : un journal se ROUVRE non filtré — le composant reste monté
    // dialog fermé, un filtre sur une immatriculation disparue entre-temps
    // laissait sinon une liste vide sans issue (Select masqué si ≤ 1 avion).
    setFiltre(TOUS);
    (async () => {
      try {
        const liste = await communityService.getCommunityChangelog();
        if (!annule) setEntrees(liste);
      } catch (e) {
        // Détail technique en console UNIQUEMENT — le pilote reçoit un message
        // français générique, pas un « JWT expired » ou « Failed to fetch » brut.
        console.warn('[CommunityChangelog] Lecture impossible :', e?.message);
        if (!annule) setErreur(true);
      }
    })();
    return () => { annule = true; };
  }, [open]);

  const immatriculations = useMemo(
    () => [...new Set((entrees || []).map((e) => e.registration).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b), 'fr')),
    [entrees]
  );
  const visibles = useMemo(
    () => (entrees || []).filter((e) => filtre === TOUS || e.registration === filtre),
    [entrees, filtre]
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '52px' }}>
        <ScrollText size={18} />
        Journal des mises à jour
        <IconButton
          aria-label="Fermer"
          onClick={onClose}
          size="small"
          style={{ position: 'absolute', right: 12, top: 12 }}
        >
          <X size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {erreur && (
          <p style={{ color: 'var(--color-red-critical)', fontSize: 'var(--fs-body)' }}>
            Journal indisponible — vérifiez votre connexion puis rouvrez le journal.
          </p>
        )}

        {!erreur && entrees === null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 0' }}>
            <CircularProgress size={18} />
            <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>Chargement du journal…</span>
          </div>
        )}

        {Array.isArray(entrees) && entrees.length === 0 && (
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
            Aucune mise à jour enregistrée pour l'instant — le journal se remplit
            à chaque nouvelle version d'un avion de la base.
          </p>
        )}

        {Array.isArray(entrees) && entrees.length > 0 && (
          <>
            {immatriculations.length > 1 && (
              <FormControl size="small" style={{ minWidth: 220, marginBottom: 14 }}>
                <InputLabel id="changelog-filtre-label">Avion</InputLabel>
                <Select
                  labelId="changelog-filtre-label"
                  label="Avion"
                  value={filtre}
                  onChange={(e) => setFiltre(e.target.value)}
                >
                  <MenuItem value={TOUS}>Tous les avions</MenuItem>
                  {immatriculations.map((r) => (
                    <MenuItem key={r} value={r}>{r}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {visibles.length === 0 && (
              <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
                Aucune entrée pour cet avion.
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {visibles.map((e) => {
                const champs = libelleChamps(e.champs);
                return (
                  <div
                    key={e.cle}
                    style={{
                      padding: '10px 12px',
                      border: '1px solid var(--border-subtle)',
                      borderLeft: '3px solid var(--accent-primary)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-overlay)',
                      fontSize: 'var(--fs-body)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{e.registration}</strong>
                      {e.version != null && (
                        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)', fontSize: 'var(--fs-caption)' }}>
                          v{e.version}
                        </span>
                      )}
                      {e.date && (
                        <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-caption)' }}>
                          {new Date(e.date).toLocaleDateString('fr-FR', {
                            day: 'numeric', month: 'long', year: 'numeric'
                          })}
                        </span>
                      )}
                    </div>
                    {e.note && (
                      <div style={{ fontStyle: 'italic', marginTop: '4px' }}>« {e.note} »</div>
                    )}
                    <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-caption)', marginTop: '4px' }}>
                      {champs
                        ? <>Champs modifiés : {champs}</>
                        : 'Fiche ré-enregistrée (pas de champ de données modifié).'}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CommunityChangelogDialog;
