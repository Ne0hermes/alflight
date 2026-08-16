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
import { Inbox, Download, CheckCircle, XCircle, Clock, PartyPopper } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';

// Clé de « dernier statut vu » (partitionnée par compte via accountDataIsolation)
const SEEN_KEY = 'aircraftRequestsSeen';

const STATUS_UI = {
  pending:   { label: 'En attente de traitement', color: '#b45309', bg: 'rgba(242,105,33,0.10)', Icon: Clock },
  processed: { label: 'Ajoutée à la base ✔', color: '#065f46', bg: 'rgba(16,185,129,0.10)', Icon: CheckCircle },
  rejected:  { label: 'Refusée', color: 'var(--color-red-critical)', bg: 'rgba(220,38,38,0.08)', Icon: XCircle },
};

const AircraftRequestsPanel = ({ isAdmin }) => {
  const [requests, setRequests] = useState(null); // null = chargement
  const [justProcessed, setJustProcessed] = useState([]); // notifications
  const [busyId, setBusyId] = useState(null);

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
      const { error } = await supabase
        .from('aircraft_requests')
        .update({ status, processed_at: new Date().toISOString() })
        .eq('id', req.id);
      if (error) throw error;
      await load();
    } catch (e) {
      alert('Mise à jour impossible : ' + (e?.message || e));
    } finally {
      setBusyId(null);
    }
  };

  if (requests === null) return null;             // chargement silencieux
  if (!isAdmin && requests.length === 0 && justProcessed.length === 0) return null;
  if (isAdmin && requests.length === 0) return null; // rien à traiter → discret

  return (
    <div style={{
      margin: '16px 0', padding: '14px 16px',
      border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
      backgroundColor: 'var(--bg-overlay)'
    }}>
      <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--fs-body)', fontWeight: 700, marginBottom: '10px' }}>
        <Inbox size={16} />
        {isAdmin ? `Demandes d'ajout reçues (${requests.length})` : 'Mes demandes d\'ajout'}
      </h4>

      {/* 🔔 Bannière utilisateur : avion(s) fraîchement ajouté(s) */}
      {!isAdmin && justProcessed.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 12px', marginBottom: '10px',
          backgroundColor: 'rgba(16,185,129,0.12)', border: '1px solid #10b981',
          borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-body)'
        }}>
          <PartyPopper size={18} color="#065f46" />
          <span>
            <strong>{justProcessed.map((r) => r.registration).join(', ')}</strong>
            {justProcessed.length > 1 ? ' ont été ajoutés' : ' a été ajouté'} à la base
            communautaire — importez-{justProcessed.length > 1 ? 'les' : 'le'} depuis la recherche ci-dessus !
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {requests.map((req) => {
          const ui = STATUS_UI[req.status] || STATUS_UI.pending;
          const Icon = ui.Icon;
          return (
            <div key={req.id} style={{
              display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
              padding: '8px 10px', borderRadius: 'var(--radius-sm)',
              backgroundColor: ui.bg, border: '1px solid var(--border-subtle)'
            }}>
              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{req.registration}</strong>
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

              {isAdmin && (
                <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '6px' }}>
                  <button type="button" onClick={() => downloadManual(req)} disabled={busyId === req.id}
                    style={adminBtn('var(--accent-primary)')}>
                    <Download size={13} /> Manuel
                  </button>
                  {req.status === 'pending' && (
                    <>
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

export default AircraftRequestsPanel;
