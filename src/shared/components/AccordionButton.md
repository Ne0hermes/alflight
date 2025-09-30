# AccordionButton - Composant Global pour Boutons Déroulants

## Description
Composant réutilisable pour créer des boutons d'accordéon/déroulants uniformes dans toute l'application ALFlight.

## Installation
```javascript
import AccordionButton from '@shared/components/AccordionButton';
```

## Props

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `isOpen` | boolean | false | État ouvert/fermé de l'accordéon |
| `onClick` | function | - | Fonction appelée lors du clic |
| `icon` | ReactNode | - | Icône à afficher (optionnel) |
| `title` | string | - | Titre du bouton |
| `color` | string | '#3b82f6' | Couleur du bouton |
| `fullWidth` | boolean | true | Prendre toute la largeur |
| `style` | object | {} | Styles CSS additionnels |
| `variant` | string | 'default' | Variante: 'default', 'minimal', 'outlined' |
| `disabled` | boolean | false | Désactiver le bouton |
| `children` | ReactNode | - | Contenu alternatif au titre |

## Variantes

### Default
Bouton avec fond coloré quand ouvert, blanc quand fermé.

### Minimal
Bouton transparent avec couleur de texte uniquement.

### Outlined
Bouton avec bordure colorée.

## Exemples d'utilisation

### Basique
```javascript
<AccordionButton
  isOpen={showSection}
  onClick={() => setShowSection(!showSection)}
  title="Ma Section"
/>
```

### Avec icône et couleur personnalisée
```javascript
import { Settings } from 'lucide-react';

<AccordionButton
  isOpen={showSettings}
  onClick={() => toggleSettings()}
  icon={<Settings size={20} />}
  title="Paramètres"
  color="#10b981"
/>
```

### Variante minimale
```javascript
<AccordionButton
  isOpen={expanded}
  onClick={handleToggle}
  title="Options avancées"
  variant="minimal"
/>
```

### Avec style personnalisé
```javascript
<AccordionButton
  isOpen={isOpen}
  onClick={toggle}
  title="Section personnalisée"
  style={{ marginTop: '10px', fontSize: '18px' }}
/>
```

## Migration depuis les anciens boutons

### Avant (ancien code)
```javascript
<button
  onClick={() => setShowSection(!showSection)}
  style={{
    width: '100%',
    padding: '12px',
    backgroundColor: showSection ? '#3b82f6' : '#f3f4f6',
    color: showSection ? 'white' : '#374151',
    // ... beaucoup de styles
  }}
>
  <Icon />
  {showSection ? 'Masquer' : 'Afficher'} la section
</button>
```

### Après (avec AccordionButton)
```javascript
<AccordionButton
  isOpen={showSection}
  onClick={() => setShowSection(!showSection)}
  icon={<Icon />}
  title="La section"
  color="#3b82f6"
/>
```

## Avantages

1. **Uniformité** : Style cohérent dans toute l'application
2. **Maintenance** : Modifications centralisées
3. **Simplicité** : Moins de code répétitif
4. **Accessibilité** : Gestion des états disabled intégrée
5. **Flexibilité** : Trois variantes et styles personnalisables
6. **Performance** : Composant optimisé avec transitions CSS

## Intégration avec les stores

Pour une meilleure gestion d'état, utilisez avec les stores Zustand :

```javascript
const { expandedSections, toggleSection } = useUIStore();

<AccordionButton
  isOpen={expandedSections.includes('mySection')}
  onClick={() => toggleSection('mySection')}
  title="Ma Section"
/>
```

## Notes

- Le chevron (flèche) est automatiquement ajouté et change selon l'état
- Le texte "Afficher/Masquer" n'est plus nécessaire
- Les transitions sont gérées automatiquement
- Compatible avec tous les navigateurs modernes