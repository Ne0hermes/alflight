// src/features/vac/components/VacQuickImport.jsx
// ============================================================================
// 🗺️ IMPORT RAPIDE D'UNE CARTE VAC — depuis la préparation de vol
// ----------------------------------------------------------------------------
// Demande César (16/08) : quand une carte VAC manque à l'étape « aérodromes et
// météo », le pilote doit pouvoir l'ajouter SUR PLACE, sans quitter « je prépare
// mon vol ». Ce composant reprend exactement le mécanisme du module Cartes VAC
// (stockage du PDF + inscription au registre local) et y ajoute la copie
// serveur du Lot 2.0 : la carte est rattachée AU PROFIL du pilote.
//
// Responsabilité : chaque pilote télécharge SA carte depuis la source
// officielle (SIA) puis l'importe ici. L'application ne redistribue rien ; elle
// conserve la copie personnelle du commandant de bord, à qui il revient de
// vérifier qu'elle est à jour.
// ============================================================================

import React, { useRef, useState } from 'react';
import { Upload, Check, ExternalLink } from 'lucide-react';
import { useVACStore } from '@core/stores/vacStore';
import { vacPdfStorage } from '@services/vacPdfStorage';

const SIA_URL = 'https://www.sia.aviation-civile.gouv.fr/vaip';

const VacQuickImport = ({ icao, onImported }) => {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const addCustomChart = useVACStore((s) => s.addCustomChart);

  const upperIcao = String(icao || '').toUpperCase();

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.type !== 'application/pdf') {
      setError('La carte VAC doit être un fichier PDF.');
      event.target.value = '';
      return;
    }

    // 🛡️ Sécurité : une carte importée sous le mauvais terrain serait un piège
    // en vol. On alerte si le nom du fichier désigne un AUTRE aérodrome.
    const found = (file.name.toUpperCase().match(/\b[A-Z]{4}\b/g) || []);
    if (found.length > 0 && !found.includes(upperIcao)) {
      const ok = window.confirm(
        `⚠️ Vérification\n\nVous importez une carte pour ${upperIcao}, ` +
        `mais le nom du fichier mentionne : ${found.join(', ')}.\n\n` +
        `Confirmer l'import malgré tout ?`
      );
      if (!ok) { event.target.value = ''; return; }
    }

    setBusy(true);
    try {
      // 1. Copie locale (hors ligne en vol) — même stockage que le module VAC
      await vacPdfStorage.storePDF(upperIcao, file);
      const fileUrl = URL.createObjectURL(file);
      await addCustomChart(upperIcao, {
        name: file.name,
        url: fileUrl,
        fileName: file.name,
        fileSize: (file.size / 1024).toFixed(1) + ' KB',
        fileType: file.type,
        hasPdf: true,
        isDownloaded: true,
        downloadDate: new Date().toISOString(),
        needsManualExtraction: true,
      });

      // 2. Copie serveur rattachée au profil (Lot 2.0) — non bloquante :
      //    hors ligne, la carte reste disponible localement.
      import('@services/vacProfileService')
        .then(({ uploadChartToProfile }) => uploadChartToProfile(upperIcao, file))
        .catch(() => { /* renvoi possible plus tard */ });

      setDone(true);
      if (onImported) onImported(upperIcao);
    } catch (e) {
      console.error('[VacQuickImport] Import échoué :', e);
      setError(`Import impossible : ${e?.message || 'erreur inconnue'}`);
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  };

  if (done) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        color: 'var(--color-green-success, #10b981)', fontSize: 'var(--fs-body)', fontWeight: 600
      }}>
        <Check size={15} /> Carte {upperIcao} ajoutée à votre profil
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '6px 12px', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--accent-primary)', backgroundColor: 'var(--bg-overlay)',
          color: 'var(--accent-primary)', fontWeight: 600,
          cursor: busy ? 'wait' : 'pointer', fontSize: 'var(--fs-body)'
        }}
      >
        <Upload size={15} />
        {busy ? 'Import en cours…' : `Ajouter la carte ${upperIcao}`}
      </button>
      <a
        href={SIA_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)'
        }}
      >
        <ExternalLink size={12} /> Télécharger depuis le SIA
      </a>
      <input ref={inputRef} type="file" accept="application/pdf"
        style={{ display: 'none' }} onChange={handleFile} />
      {error && (
        <span style={{ color: 'var(--color-red-critical)', fontSize: 'var(--fs-caption)' }}>{error}</span>
      )}
    </span>
  );
};

export default VacQuickImport;
