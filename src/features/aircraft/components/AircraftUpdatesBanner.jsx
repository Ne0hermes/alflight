// src/features/aircraft/components/AircraftUpdatesBanner.jsx
// ============================================================================
// 📣 MISE À JOUR DES AVIONS IMPORTÉS (demande César, 25/08/2026)
// ----------------------------------------------------------------------------
// Les copies locales (IndexedDB) ne se resynchronisent pas au démarrage : quand
// l'admin corrige une fiche communautaire, l'utilisateur volait avec une copie
// périmée SANS LE SAVOIR. AircraftProvider détecte les copies en retard (une
// requête légère id/registration/version) ; cette bannière les affiche avec :
//  • « Voir les changements » — la note de mise à jour de l'admin et la liste
//    des champs modifiés (_updateHistory embarqué dans la fiche) ;
//  • « Mettre à jour ma copie » — retélécharge la fiche fraîche PAR-DESSUS la
//    copie locale (l'ID local et le propriétaire du compte sont CONSERVÉS) ;
//  • « Ignorer » — masque cette version (la bannière reviendra à la suivante).
// Rien à signaler = invisible. Aucune écriture sans clic du pilote.
// ============================================================================

import React, { useState } from 'react';
import { RefreshCw, Eye, X, Loader2, Megaphone } from 'lucide-react';
import { useAircraftUpdatesStore } from '../../../core/stores/aircraftUpdatesStore';
import communityService from '@services/communityService';
import dataBackupManager from '@utils/dataBackupManager';
// Libellés français des champs du journal — partagés avec le journal des
// mises à jour communautaire (CommunityChangelogDialog).
import { libelleChamps } from '../utils/updateFieldLabels';

const AircraftUpdatesBanner = () => {
  const updatesAvailable = useAircraftUpdatesStore((s) => s.updatesAvailable);
  const dismiss = useAircraftUpdatesStore((s) => s.dismiss);
  const remove = useAircraftUpdatesStore((s) => s.remove);

  const [busyId, setBusyId] = useState(null);
  // id du preset dont le détail des changements est déplié
  const [expandedId, setExpandedId] = useState(null);
  // { [presetId]: [{version, date, note, champs}] | 'erreur' }
  const [historique, setHistorique] = useState({});
  const [erreur, setErreur] = useState(null);

  if (updatesAvailable.length === 0) return null;

  const voirChangements = async (u) => {
    if (expandedId === u.id) { setExpandedId(null); return; }
    setExpandedId(u.id);
    if (historique[u.id]) return; // déjà chargé
    try {
      // Le journal vit DANS la fiche : une lecture, filtrée aux versions que
      // cette copie locale n'a pas encore.
      const fiche = await communityService.getPresetById(u.id);
      const entrees = (Array.isArray(fiche?._updateHistory) ? fiche._updateHistory : [])
        .filter((e) => (e?.version || 0) > u.localVersion)
        .reverse(); // la plus récente d'abord
      setHistorique((prev) => ({ ...prev, [u.id]: entrees }));
    } catch (e) {
      console.warn('[AircraftUpdatesBanner] Journal illisible :', e?.message);
      setHistorique((prev) => ({ ...prev, [u.id]: 'erreur' }));
    }
  };

  const mettreAJour = async (u) => {
    setBusyId(u.id);
    setErreur(null);
    try {
      const [{ toLightAircraftRecord }, { useAircraftStore }] = await Promise.all([
        import('../../../core/stores/lightAircraftRecord'),
        import('../../../core/stores/aircraftStore'),
      ]);
      // ⛔ Revue 26/08 : avion retiré de la liste depuis l'affichage de la
      // bannière → on n'écrit PAS (l'ancien code ressuscitait l'avion supprimé
      // dans IndexedDB, invisible jusqu'au prochain démarrage).
      if (!useAircraftStore.getState().aircraftList.some((a) => a.id === u.localId)) {
        remove(u.id);
        setBusyId(null);
        setErreur(`${u.registration} n'est plus dans votre liste — mise à jour annulée.`);
        return;
      }
      const fiche = await communityService.getPresetById(u.id);
      // La copie locale GARDE son identité : ID local (la fiche communautaire
      // n'est jamais écrasée) et propriétaire du compte (cloisonnement 16/08).
      const existante = await dataBackupManager.getAircraftData(u.localId).catch(() => null);
      let ownerAccountId = existante?.ownerAccountId || null;
      if (!ownerAccountId) {
        try { ownerAccountId = localStorage.getItem('alflight:data-owner'); } catch { /* stockage indisponible */ }
      }
      const copie = { ...fiche, id: u.localId, aircraftId: u.localId };
      if (ownerAccountId) copie.ownerAccountId = ownerAccountId;
      await dataBackupManager.saveAircraftData(copie);
      // 🔄 26/08 (retour pilote) : plus de window.location.reload() — le
      // rechargement complet ÉJECTAIT du module Avions. La carte est
      // remplacée EN PLACE : version LÉGÈRE (même stripping anti-OOM que le
      // chargement initial) posée dans le store, la carte se rafraîchit,
      // la page ne bouge pas. IndexedDB porte déjà la copie COMPLÈTE.
      const light = toLightAircraftRecord(copie);
      const store = useAircraftStore.getState();
      store.replaceAircraftLocal(u.localId, light);
      // ⛔ Revue 26/08 — l'ancien reload remettait AUSSI l'état dérivé à zéro.
      // Si c'est l'avion SÉLECTIONNÉ, on réconcilie ce que la fiche fraîche
      // peut avoir invalidé :
      if (store.selectedAircraftId === u.localId) {
        // (a) variante réservoirs choisie disparue/renommée → retour à la
        // configuration par défaut (jamais le catalogue brut silencieux).
        const variantes = Array.isArray(light.tankVariants) ? light.tankVariants : [];
        if (store.selectedTankVariantId != null && !variantes.some((v) => v.id === store.selectedTankVariantId)) {
          store.setSelectedTankVariant(null);
        }
        // (b) config réservoirs du vol : les ids de réservoirs peuvent avoir
        // changé — sans reset, le FOB dérivé retombait à 0 EN SILENCE (litres
        // du pilote perdus). Config redevenue vierge = non engagée, le fobFuel
        // persisté est conservé.
        const { useFuelStore } = await import('../../../core/stores/fuelStore');
        useFuelStore.getState().resetTankConfig();
      }
      remove(u.id);
      setBusyId(null);
    } catch (e) {
      console.error('[AircraftUpdatesBanner] Mise à jour de la copie impossible :', e);
      setErreur(`Mise à jour de ${u.registration} impossible : ${e?.message || 'erreur inconnue'}`);
      setBusyId(null);
    }
  };

  const btn = {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '5px 10px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)',
    color: 'inherit', fontSize: 'var(--fs-caption)', fontWeight: 600, cursor: 'pointer',
  };

  return (
    <div style={{
      margin: '16px 0', padding: '14px 16px',
      border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
      borderLeft: '3px solid var(--accent-primary)',
      backgroundColor: 'var(--bg-overlay)'
    }}>
      {/* Animations locales : la barre de progression de la ligne et le spin
          du loader (la classe « animate-spin » n'existe pas dans ce projet). */}
      <style>{`
        @keyframes alfMajBarre { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }
        @keyframes alfMajSpin { to { transform: rotate(360deg); } }
      `}</style>
      <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--fs-body)', fontWeight: 700, marginBottom: '10px' }}>
        <Megaphone size={16} />
        {updatesAvailable.length > 1
          ? `${updatesAvailable.length} avions ont été mis à jour dans la base communautaire`
          : 'Un avion a été mis à jour dans la base communautaire'}
      </h4>

      {erreur && (
        <div style={{
          padding: '8px 10px', marginBottom: '8px', borderRadius: 'var(--radius-sm)',
          backgroundColor: 'rgba(220,38,38,0.08)', border: '1px solid var(--color-red-critical)',
          fontSize: 'var(--fs-caption)'
        }}>
          {erreur}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {updatesAvailable.map((u) => {
          const entrees = historique[u.id];
          return (
            <div key={u.id} style={{
              padding: '8px 10px', borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{u.registration}</strong>
                <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-caption)', fontVariantNumeric: 'tabular-nums' }}>
                  votre copie v{u.localVersion} → base v{u.remoteVersion}
                </span>
                <span style={{ flex: 1 }} />
                <button type="button" style={btn} onClick={() => voirChangements(u)}>
                  <Eye size={13} /> {expandedId === u.id ? 'Masquer' : 'Voir les changements'}
                </button>
                <button
                  type="button"
                  style={{ ...btn, borderColor: 'var(--accent-primary)' }}
                  // Revue 26/08 : UNE mise à jour à la fois — busyId est
                  // mono-valeur, un 2e clic ailleurs brouillait les indicateurs
                  // et permettait un double téléchargement.
                  disabled={busyId != null}
                  onClick={() => mettreAJour(u)}
                >
                  {busyId === u.id
                    ? <Loader2 size={13} style={{ animation: 'alfMajSpin 1s linear infinite' }} />
                    : <RefreshCw size={13} />} {busyId === u.id ? 'Mise à jour…' : 'Mettre à jour ma copie'}
                </button>
                <button
                  type="button" style={btn} title="Ignorer cette version"
                  aria-label={`Ignorer la mise à jour de ${u.registration}`}
                  disabled={busyId === u.id}
                  onClick={() => dismiss(u.id)}
                >
                  <X size={13} />
                </button>
              </div>

              {/* 🔄 Barre de chargement SUR LA LIGNE pendant le téléchargement
                  de la fiche fraîche (retour pilote 26/08). */}
              {busyId === u.id && (
                <div style={{ marginTop: '6px', height: '3px', borderRadius: '2px', overflow: 'hidden', backgroundColor: 'var(--border-subtle)' }}>
                  <div style={{ height: '100%', width: '35%', borderRadius: '2px', backgroundColor: 'var(--accent-primary)', animation: 'alfMajBarre 1.1s linear infinite' }} />
                </div>
              )}

              {expandedId === u.id && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', fontSize: 'var(--fs-caption)' }}>
                  {entrees === undefined && (
                    <span style={{ color: 'var(--text-secondary)' }}>Chargement du journal…</span>
                  )}
                  {entrees === 'erreur' && (
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Journal de mise à jour indisponible (hors-ligne ?). La mise à jour reste possible.
                    </span>
                  )}
                  {Array.isArray(entrees) && entrees.length === 0 && (
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Pas de note pour ces versions — la fiche a été ré-enregistrée par l'administrateur.
                    </span>
                  )}
                  {Array.isArray(entrees) && entrees.map((e) => {
                    const champs = libelleChamps(e.champs);
                    return (
                      <div key={e.version} style={{ marginBottom: '6px' }}>
                        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>v{e.version}</strong>
                        {e.date && (
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {' — '}{new Date(e.date).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                        {e.note && <div style={{ fontStyle: 'italic', marginTop: '2px' }}>« {e.note} »</div>}
                        {champs && (
                          <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                            Champs modifiés : {champs}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AircraftUpdatesBanner;
