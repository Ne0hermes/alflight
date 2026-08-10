// src/features/weather/components/AerowebCharts.jsx
// 🔧 LOT 6-C (volet images) — cartes officielles TEMSI / WINTEM (AEROWEB,
// Météo-France) dans le briefing de fin de préparation. Tant que le code
// d'accès n'est pas configuré côté Vercel (AEROWEB_USER_CODE), la section
// affiche honnêtement « en attente d'activation » (règle A5).
import React, { useEffect, useState } from 'react';
import { fetchBriefingCharts } from '@services/aerowebAPI';

const noteStyle = {
  fontSize: 'var(--fs-body)',
  color: 'var(--text-secondary)',
  padding: '12px',
  backgroundColor: 'var(--bg-overlay)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  lineHeight: 1.5
};

export const AerowebCharts = () => {
  // undefined = chargement, sinon { status, products }
  const [result, setResult] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchBriefingCharts().then(r => {
      if (!cancelled) setResult(r);
    });
    return () => { cancelled = true; };
  }, []);

  if (result === undefined) {
    return <p style={noteStyle}>Chargement des cartes AEROWEB…</p>;
  }

  if (result.status === 'not_configured') {
    return (
      <div style={{ ...noteStyle, borderLeft: '4px solid var(--accent-primary)' }}>
        <strong>⏳ En attente d'activation AEROWEB.</strong><br />
        La demande de code d'accès a été envoyée à Météo-France
        (convention gratuite). Dès que le code sera configuré, les cartes
        officielles <strong>TEMSI France</strong> et <strong>WINTEM</strong> (FL020 / FL050 / FL100)
        s'afficheront ici et seront jointes automatiquement au PDF du briefing.
        <br />
        En attendant, les tableaux « WINTEM chiffré » et « Phénomènes significatifs »
        ci-dessus fournissent l'équivalent chiffré analysé par l'application.
      </div>
    );
  }

  if (result.status === 'unavailable') {
    return (
      <p style={{ ...noteStyle, borderLeft: '4px solid var(--accent-primary)' }}>
        ⚠ Cartes AEROWEB injoignables (réseau ou proxy indisponible — normal en
        développement local). Les tableaux chiffrés ci-dessus restent disponibles.
      </p>
    );
  }

  if (result.status === 'empty') {
    return (
      <p style={{ ...noteStyle, borderLeft: '4px solid var(--accent-primary)' }}>
        AEROWEB a répondu mais aucune carte TEMSI/WINTEM n'est disponible
        actuellement (run en cours de production ?). Réessayez plus tard.
      </p>
    );
  }

  if (result.status === 'error') {
    return (
      <p style={{ ...noteStyle, borderLeft: '4px solid var(--color-red-critical)' }}>
        ⚠ Cartes AEROWEB indisponibles (service en erreur). Réessayez plus tard —
        les tableaux chiffrés ci-dessus restent disponibles.
      </p>
    );
  }

  return (
    <div>
      {result.products.map((product) => {
        if (product.status !== 'ok' || product.cartes.length === 0) {
          return (
            <p key={product.label} style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-tertiary)', margin: '0 0 8px' }}>
              {product.label} : indisponible.
            </p>
          );
        }
        return product.cartes.map((carte, i) => (
          <figure
            key={`${product.label}-${i}`}
            className="pdf-avoid-break"
            style={{ margin: '0 0 16px', textAlign: 'center' }}
          >
            <img
              src={carte.proxyUrl}
              crossOrigin="anonymous"
              alt={`${product.label} — ${carte.echeance || ''}`}
              style={{
                maxWidth: '100%',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: '#ffffff'
              }}
            />
            <figcaption style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {product.label}
              {carte.echeance ? ` — échéance ${carte.echeance}` : ''}
              {carte.dateRun ? ` (run ${carte.dateRun})` : ''}
              {' '}· Source : Météo-France (AEROWEB)
            </figcaption>
          </figure>
        ));
      })}
    </div>
  );
};

export default AerowebCharts;
