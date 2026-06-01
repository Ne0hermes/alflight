// ============================================================================
//  ModuleHero — Primitive éditoriale ALFlight
//  ----------------------------------------------------------------------------
//  Reproduit FIDÈLEMENT le pattern hero de la page "Mes Avions" (référence
//  visuelle), pour être appliqué uniformément sur chaque module de l'app.
//
//  Composition :
//    1. Photo cinematic en background (cover, position center)
//    2. Overlay sombre dégradé pour lisibilité du texte au-dessus
//    3. Liseré orange 2px en bas du hero
//    4. <EditorialHeading level={1} eyebrow="…">titre</EditorialHeading>
//    5. Tagline mono ALL CAPS "Perita Per Preparatem" (ou custom)
//    6. Slot optionnel à droite (KPI, badge, action)
//
//  Si la photo n'est pas trouvée (404), CSS gère le fallback automatiquement
//  via le dégradé d'overlay qui couvre déjà tout le hero.
//
//  Usage minimal :
//    <ModuleHero
//      image="/assets/photos/hero-weather.jpg"
//      eyebrow="MÉTÉO · CONDITIONS DE VOL"
//      title="Briefing météorologique"
//    />
//
//  Usage avec slot KPI :
//    <ModuleHero
//      image="/assets/photos/hero-pilot.jpg"
//      eyebrow="PILOT · IDENTITÉ & EXPÉRIENCE"
//      title="Espace pilote"
//      slot={<DataReadout value={1247} unit="HOURS" />}
//    />
// ============================================================================

import React from 'react';
import { EditorialHeading } from './EditorialHeading';
import { tokens } from '../../styles/designSystem';

export const ModuleHero = ({
  image,
  eyebrow,
  title,
  tagline = 'Perita Per Preparatem',
  slot,
  imagePosition = 'center 35%',
  level = 1,
}) => {
  return (
    <section
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 'clamp(220px, 32vh, 380px)',
        marginBottom: tokens.spacing[6],
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        // Fallback : dégradé noir profond → orange subtle si la photo manque.
        // Le backgroundImage cumule l'image (au-dessus) + le gradient (dessous)
        // pour qu'un 404 sur la photo laisse un visuel cohérent.
        backgroundImage: image
          ? `url("${image}"), linear-gradient(135deg, var(--bg-surface) 0%, var(--app-bg) 80%)`
          : 'linear-gradient(135deg, var(--bg-surface) 0%, var(--app-bg) 80%)',
        backgroundSize: 'cover, cover',
        backgroundPosition: `${imagePosition}, center`,
        backgroundRepeat: 'no-repeat',
        display: 'flex',
        alignItems: 'stretch',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: `clamp(${tokens.spacing[5]}, 3vw, ${tokens.spacing[8]})`,
      }}
    >
      {/* Overlay sombre dégradé pour lisibilité du texte au-dessus */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, var(--app-bg-alpha-55) 0%, var(--app-bg-alpha-75) 60%, var(--app-bg-alpha-92) 100%)',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />
      {/* Liseré orange en bas — signature ALFlight */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '2px',
          background: 'var(--accent-primary)',
          opacity: 0.55,
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />

      {/* Contenu superposé : header (titre + tagline) + slot droite */}
      <header
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: tokens.spacing[6],
        }}
      >
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <EditorialHeading level={level} eyebrow={eyebrow}>
            {title}
          </EditorialHeading>
          {tagline && (
            <div
              style={{
                marginTop: tokens.spacing[3],
                fontFamily: tokens.fontFamily.mono,
                fontSize: '11px',
                letterSpacing: '0.30em',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
              }}
            >
              {tagline}
            </div>
          )}
        </div>
        {slot && (
          <div style={{ flex: '0 1 auto', display: 'flex', alignItems: 'flex-end' }}>
            {slot}
          </div>
        )}
      </header>
    </section>
  );
};

export default ModuleHero;
