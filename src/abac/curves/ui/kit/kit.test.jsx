/**
 * Tests légers du kit visuel de l'atelier abaques (Lot 1-B).
 *
 * @testing-library/react n'est PAS dans les devDependencies → rendu pur via
 * react-dom/server (renderToStaticMarkup), suffisant en environnement node :
 * on vérifie la présence des libellés, le respect des niveaux (primary porte
 * var(--accent-primary)), la raison de désactivation rendue, et les
 * invariants du système (grille de 8, hauteurs 32/26, rayon 6).
 */
// vitest.config.js n'embarque pas @vitejs/plugin-react : la transform JSX
// d'esbuild est en mode classique → l'import React explicite est requis.
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SPACING,
  FONT,
  RADIUS,
  CONTROL_HEIGHT,
  KitButton,
  KitBadge,
  KitPanel,
  ModeBanner,
  ChecklistRail,
} from './index';

describe('tokens', () => {
  it('respecte la grille de 8 (4/8/16/24/32)', () => {
    expect(Object.values(SPACING)).toEqual([4, 8, 16, 24, 32]);
  });

  it('expose 3 corps de texte (--fs-*) + le corps des contrôles (12px, aligné champs)', () => {
    expect(FONT).toEqual({
      title: 'var(--fs-title)',
      body: 'var(--fs-body)',
      note: 'var(--fs-caption)',
      control: '12px',
    });
  });

  it('fixe le rayon à 6 et les 2 hauteurs de contrôle à 28/24 (compact = hauteur des champs, demande pilote 20/08)', () => {
    expect(RADIUS).toBe(6);
    expect(CONTROL_HEIGHT).toEqual({ normal: 28, compact: 24 });
  });
});

describe('KitButton', () => {
  it('primary : fond var(--accent-primary), libellé stable rendu tel quel', () => {
    const html = renderToStaticMarkup(
      <KitButton level="primary" onClick={() => {}}>Calibrer les axes</KitButton>
    );
    expect(html).toContain('Calibrer les axes');
    expect(html).toContain('background-color:var(--accent-primary)');
    expect(html).toContain('height:28px');
  });

  it('secondary : fond transparent, contour accent', () => {
    const html = renderToStaticMarkup(
      <KitButton level="secondary" onClick={() => {}}>Ajouter une courbe</KitButton>
    );
    expect(html).toContain('background-color:transparent');
    expect(html).toContain('border:1px solid var(--accent-primary)');
    expect(html).not.toContain('background-color:var(--accent-primary)');
  });

  it('tertiary : texte seul, sans fond ni contour accent', () => {
    const html = renderToStaticMarkup(
      <KitButton level="tertiary" onClick={() => {}}>Réinitialiser</KitButton>
    );
    expect(html).toContain('Réinitialiser');
    expect(html).toContain('background-color:transparent');
    expect(html).not.toContain('var(--accent-primary)');
  });

  it('compact : hauteur 24px — exactement celle des champs de saisie', () => {
    const html = renderToStaticMarkup(
      <KitButton level="secondary" size="compact" onClick={() => {}}>OK</KitButton>
    );
    expect(html).toContain('height:24px');
  });

  it('désactivé : la raison est rendue en title ET en texte accessible', () => {
    const html = renderToStaticMarkup(
      <KitButton level="primary" disabled disabledReason="Calibrez d’abord les 2 axes">
        Poser des points
      </KitButton>
    );
    // Libellé inchangé (stable) même désactivé
    expect(html).toContain('Poser des points');
    // title = info-bulle
    expect(html).toMatch(/title="Calibrez d.abord les 2 axes"/);
    // span accessible relié par aria-describedby
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('aria-describedby');
    const occurrences = html.split('Calibrez d’abord les 2 axes').length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it('icône rendue et masquée aux lecteurs d’écran', () => {
    const html = renderToStaticMarkup(
      <KitButton level="secondary" icon="✚" onClick={() => {}}>Nouveau cadre</KitButton>
    );
    expect(html).toContain('✚');
    expect(html).toContain('aria-hidden="true"');
  });
});

describe('KitBadge', () => {
  it.each([
    ['ok', 'var(--status-success)'],
    ['warn', 'var(--status-warning)'],
    ['crit', 'var(--status-error)'],
    ['neutral', 'var(--text-secondary)'],
  ])('tone %s : libellé rendu avec la couleur de statut %s', (tone, cssVar) => {
    const html = renderToStaticMarkup(<KitBadge tone={tone}>calibré ✓</KitBadge>);
    expect(html).toContain('calibré ✓');
    expect(html).toContain(`color:${cssVar}`);
  });
});

describe('KitPanel', () => {
  it('rend titre, badge, action et contenu dans l’anatomie unique', () => {
    const html = renderToStaticMarkup(
      <KitPanel
        title="Cas de référence"
        badge={<KitBadge tone="ok">3/4 OK</KitBadge>}
        action={<KitButton level="secondary" size="compact" onClick={() => {}}>Vérifier</KitButton>}
      >
        <p>Contenu du panneau</p>
      </KitPanel>
    );
    expect(html).toContain('Cas de référence');
    expect(html).toContain('3/4 OK');
    expect(html).toContain('Vérifier');
    expect(html).toContain('Contenu du panneau');
    expect(html).toContain('border:1px solid var(--border-subtle)');
    expect(html).toContain(`padding:${SPACING.md}px`);
  });

  it('tone attention : contour accent', () => {
    const html = renderToStaticMarkup(
      <KitPanel title="À corriger" tone="attention">
        <span>x</span>
      </KitPanel>
    );
    expect(html).toContain('border:1px solid var(--accent-primary)');
  });

  // Lot 1-G — variante repliable : même anatomie, en <details>/<summary>.
  it('collapsible : rend un <details> fermé par défaut, titre et badge dans le <summary>', () => {
    const html = renderToStaticMarkup(
      <KitPanel collapsible title="Banc de test" badge={<KitBadge tone="ok">3/4 OK</KitBadge>}>
        <p>Cas du manuel</p>
      </KitPanel>
    );
    expect(html).toContain('<details');
    expect(html).not.toMatch(/<details[^>]* open/);
    expect(html).toContain('<summary');
    expect(html).toContain('Banc de test');
    expect(html).toContain('3/4 OK');
    expect(html).toContain('Cas du manuel');
    expect(html).toContain('border:1px solid var(--border-subtle)');
  });

  it('collapsible : defaultOpen / open contrôlé posent l’attribut open', () => {
    const opened = renderToStaticMarkup(
      <KitPanel collapsible defaultOpen title="Testeur"><span>x</span></KitPanel>
    );
    expect(opened).toMatch(/<details[^>]* open/);
    const controlled = renderToStaticMarkup(
      <KitPanel collapsible open onToggle={() => {}} title="Banc"><span>x</span></KitPanel>
    );
    expect(controlled).toMatch(/<details[^>]* open/);
  });
});

describe('ModeBanner', () => {
  it('nomme le mode, l’instruction, la progression et la sortie Échap', () => {
    const html = renderToStaticMarkup(
      <ModeBanner
        mode="Calibration Y"
        instruction="Cliquez sur la graduation 2000 de l’image"
        progress="3 / 7"
        onCancel={() => {}}
      />
    );
    expect(html).toContain('Calibration Y');
    expect(html).toContain('Cliquez sur la graduation 2000');
    expect(html).toContain('3 / 7');
    expect(html).toContain('Annuler');
    expect(html).toContain('Échap pour annuler');
    // Visuel hérité de la bannière de calibration réussie
    expect(html).toContain('background-color:var(--accent-soft)');
    expect(html).toContain('border:2px solid var(--accent-primary)');
  });
});

describe('ChecklistRail', () => {
  const steps = [
    { id: 'img', label: 'Image importée', state: 'done' },
    { id: 'axes', label: 'Axes calibrés', state: 'current', onClick: () => {} },
    { id: 'pts', label: 'Points posés', state: 'blocked', detail: 'Calibration incomplète' },
    { id: 'check', label: 'Cas de référence', state: 'todo' },
  ];

  it('vertical : rend les 4 états avec leurs marqueurs et couleurs', () => {
    const html = renderToStaticMarkup(<ChecklistRail steps={steps} />);
    expect(html).toContain('Image importée');
    expect(html).toContain('Axes calibrés');
    expect(html).toContain('Points posés');
    expect(html).toContain('Cas de référence');
    expect(html).toContain('✓');
    expect(html).toContain('var(--status-success)');
    expect(html).toContain('aria-current="step"');
    // blocked : rouge + détail visible
    expect(html).toContain('Calibration incomplète');
    expect(html).toContain('var(--status-error)');
    // l’étape cliquable est un vrai bouton
    expect(html).toContain('<button');
  });

  it('horizontal : variante pour écrans étroits avec séparateurs', () => {
    const html = renderToStaticMarkup(<ChecklistRail steps={steps} orientation="horizontal" />);
    expect(html).toContain('flex-direction:row');
    expect(html).toContain('›');
    expect(html).toContain('Axes calibrés');
  });
});
