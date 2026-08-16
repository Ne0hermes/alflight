// src/features/aircraft/components/AircraftRequestsPanel.jsx
// ============================================================================
// 📥 SUIVI DES DEMANDES D'AJOUT D'AVION (2026-08-16, demande César)
// ----------------------------------------------------------------------------
// Un seul composant, deux visages (la RLS fait le tri des lignes) :
//  • UTILISATEUR : la liste de SES demandes avec statut (En attente / Ajoutée /
//    Refusée) + bannière de notification quand une demande vient d'être
//    traitée (« votre avion a été ajouté — importez-le »).
//  • ADMIN : TOUTES les demandes, avec téléchargement du manuel (URL signée
//    du bucket privé) et boutons « Marquer traitée » / « Refuser ».
// Prérequis : supabase-aircraft-requests.sql.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Inbox, Download, CheckCircle, XCircle, Clock, PartyPopper, Wand2, MapPin, X } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { storeRequestHandoff, getRequestContext, clearRequestContext } from '../services/aircraftRequestWorkflow';

// Clé de « dernier statut vu » (partitionnée par compte via accountDataIsolation)
const SEEN_KEY = 'aircraftRequestsSeen';
// Notifications masquées d'une croix (César 16/08) — ids de demandes cachés
// LOCALEMENT (la ligne reste en base) ; partitionnée par compte elle aussi.
const HIDDEN_KEY = 'aircraftRequestsHidden';
const readHiddenIds = () => {
  try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]'); } catch { return []; }
};

const STATUS_UI = {
  pending:   { label: 'En attente de traitement', color: '#b45309', bg: 'rgba(242,105,33,0.10)', Icon: Clock },
  processed: { label: 'Ajoutée à la base ✔', color: '#065f46', bg: 'rgba(16,185,129,0.10)', Icon: CheckCircle },
  rejected:  { label: 'Refusée', color: 'var(--color-red-critical)', bg: 'rgba(220,38,38,0.08)', Icon: XCircle },
};

const AircraftRequestsPanel = ({ isAdmin }) => {
  const [requests, setRequests] = useState(null); // null = chargement
  const [justProcessed, setJustProcessed] = useState([]); // notifications
  const [busyId, setBusyId] = useState(null);
  const [hiddenIds, setHiddenIds] = useState(readHiddenIds);

  const hideRequest = (id) => {
    const next = [...new Set([...hiddenIds, id])];
    setHiddenIds(next);
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)); } catch { /* best effort */ }
  };

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('aircraft_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      // Table pas encore créée (SQL non exécuté) : panneau silencieux
      console.warn('[Requests] lecture impossible:', error.message);
      setRequests([]);
      return;
    }
    setRequests(data || []);

    // 🔔 Notification utilisateur : demandes passées à « processed » depuis la
    // dernière consultation (comparaison avec les statuts vus, stockés en local)
    if (!isAdmin) {
      let seen = {};
      try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch { /* vide */ }
      const fresh = (data || []).filter((r) => r.status === 'processed' && seen[r.id] !== 'processed');
      setJustProcessed(fresh);
      const next = {};
      for (const r of data || []) next[r.id] = r.status;
      try { localStorage.setItem(SEEN_KEY, JSON.stringify(next)); } catch { /* best effort */ }
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const downloadManual = async (req) => {
    setBusyId(req.id);
    try {
      const { data, error } = await supabase.storage
        .from('aircraft-requests')
        .createSignedUrl(req.file_path, 300); // 5 min
      if (error) throw error;
      window.open(data.signedUrl, '_blank', 'noopener');
    } catch (e) {
      alert('Téléchargement impossible : ' + (e?.message || e));
    } finally {
      setBusyId(null);
    }
  };

  const setStatus = async (req, status) => {
    setBusyId(req.id);
    try {
      // 🛡️ « Traitée » déclenche côté demandeur la bannière « ajouté à la base —
      // importez-le » : le statut ne peut donc passer à processed QUE si la fiche
      // existe réellement dans la base communautaire (bug F-HSTS, César 16/08).
      if (status === 'processed') {
        const { data: existing, error: checkErr } = await supabase
          .from('community_presets')
          .select('id')
          .ilike('registration', (req.registration || '').trim())
          .limit(1);
        if (checkErr) throw checkErr;
        if (!existing || existing.length === 0) {
          alert(`⛔ ${req.registration} n'est pas encore dans la base communautaire.\n\nCréez d'abord la fiche avion (Configurer un avion → Importer depuis un manuel de vol), puis marquez la demande « Traitée » : le demandeur sera alors prévenu que son avion est disponible.`);
          return;
        }
      }
      const { error } = await supabase
        .from('aircraft_requests')
        .update({ status, processed_at: new Date().toISOString() })
        .eq('id', req.id);
      if (error) throw error;
      // Revue 16/08 : statuer à la main annule tout handoff « Créer la fiche »
      // en cours sur cette demande — le contexte ne doit pas survivre.
      if (getRequestContext()?.requestId === req.id) clearRequestContext();
      await load();
    } catch (e) {
      alert('Mise à jour impossible : ' + (e?.message || e));
    } finally {
      setBusyId(null);
    }
  };

  if (requests === null) return null;             // chargement silencieux

  // Notifications masquées à la croix : filtrées de l'affichage (base intacte)
  const visibleRequests = requests.filter((r) => !hiddenIds.includes(r.id));
  const visibleProcessed = justProcessed.filter((r) => !hiddenIds.includes(r.id));

  if (!isAdmin && visibleRequests.length === 0 && visibleProcessed.length === 0) return null;
  if (isAdmin && visibleRequests.length === 0) return null; // rien à traiter → discret

  return (
    <div style={{
      margin: '16px 0', padding: '14px 16px',
      border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
      backgroundColor: 'var(--bg-overlay)'
    }}>
      <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--fs-body)', fontWeight: 700, marginBottom: '10px' }}>
        <Inbox size={16} />
        {isAdmin ? `Demandes d'ajout reçues (${visibleRequests.length})` : 'Mes demandes d\'ajout'}
      </h4>

      {/* 🔔 Bannière utilisateur : avion(s) fraîchement ajouté(s) */}
      {!isAdmin && visibleProcessed.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 12px', marginBottom: '10px',
          backgroundColor: 'rgba(16,185,129,0.12)', border: '1px solid #10b981',
          borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-body)'
        }}>
          <PartyPopper size={18} color="#065f46" />
          <span>
            <strong>{visibleProcessed.map((r) => r.registration).join(', ')}</strong>
            {visibleProcessed.length > 1 ? ' ont été ajoutés' : ' a été ajouté'} à la base
            communautaire — importez-{visibleProcessed.length > 1 ? 'les' : 'le'} depuis la recherche ci-dessus !
          </span>
          <button
            type="button"
            onClick={() => setJustProcessed([])}
            aria-label="Fermer la notification"
            title="Fermer"
            style={dismissBtn}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {visibleRequests.map((req) => {
          const ui = STATUS_UI[req.status] || STATUS_UI.pending;
          const Icon = ui.Icon;
          return (
            <div key={req.id} style={{
              display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
              padding: '8px 10px', borderRadius: 'var(--radius-sm)',
              backgroundColor: ui.bg, border: '1px solid var(--border-subtle)'
            }}>
              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{req.registration}</strong>
              {req.home_base && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--text-secondary)', fontSize: 'var(--fs-caption)' }}>
                  <MapPin size={12} /> {req.home_base}
                </span>
              )}
              {req.manufacturer_model && (
                <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-caption)' }}>{req.manufacturer_model}</span>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: ui.color, fontSize: 'var(--fs-caption)', fontWeight: 600 }}>
                <Icon size={13} /> {ui.label}
              </span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-caption)' }}>
                {new Date(req.created_at).toLocaleDateString('fr-FR')}
              </span>
              {isAdmin && (
                <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-caption)' }}>
                  {req.user_email}
                </span>
              )}

              {/* ✖ Masquer la notification — UNIQUEMENT les demandes déjà statuées
                  (revue 16/08 : masquer une demande « pending » l'enterrait sans
                  retour possible — l'admin ne la voyait plus, le demandeur perdait
                  sa future bannière). La demande reste en base dans tous les cas. */}
              {!isAdmin && req.status !== 'pending' && (
                <button
                  type="button"
                  onClick={() => hideRequest(req.id)}
                  aria-label="Masquer cette notification"
                  title="Masquer"
                  style={{ ...dismissBtn, marginLeft: 'auto' }}
                >
                  <X size={14} />
                </button>
              )}
              {isAdmin && (
                <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '6px' }}>
                  <button type="button" onClick={() => downloadManual(req)} disabled={busyId === req.id}
                    style={adminBtn('var(--accent-primary)')}>
                    <Download size={13} /> Manuel
                  </button>
                  {req.status === 'pending' && (
                    <>
                      {/* 🪄 Lance le wizard pré-rempli : immat + base d'attache de la
                          demande, extraction automatique du manuel téléversé. La
                          sauvegarde finale clôturera la demande (processed). */}
                      <button type="button" onClick={() => storeRequestHandoff(req)} disabled={busyId === req.id}
                        style={adminBtn('#7c3aed')}>
                        <Wand2 size={13} /> Créer la fiche
                      </button>
                      <button type="button" onClick={() => setStatus(req, 'processed')} disabled={busyId === req.id}
                        style={adminBtn('#10b981')}>
                        <CheckCircle size={13} /> Traitée
                      </button>
                      <button type="button" onClick={() => setStatus(req, 'rejected')} disabled={busyId === req.id}
                        style={adminBtn('var(--color-red-critical)')}>
                        <XCircle size={13} /> Refuser
                      </button>
                    </>
                  )}
                  {req.status !== 'pending' && (
                    <button
                      type="button"
                      onClick={() => hideRequest(req.id)}
                      aria-label="Masquer cette notification"
                      title="Masquer"
                      style={dismissBtn}
                    >
                      <X size={14} />
                    </button>
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const adminBtn = (bg) => ({
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  padding: '5px 9px', borderRadius: 'var(--radius-sm)', border: 'none',
  backgroundColor: bg, color: '#ffffff', fontWeight: 600,
  fontSize: 'var(--fs-caption)', cursor: 'pointer'
});

// Croix de masquage : discrète, même hauteur que les boutons d'action
const dismissBtn = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: '26px', height: '26px', padding: 0,
  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
  backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer'
};

export default AircraftRequestsPanel;
