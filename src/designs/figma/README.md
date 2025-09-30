# Exports Figma

Ce dossier contient les composants et styles exportés depuis Figma.

## Structure des fichiers

- `components/` - Composants React exportés
- `styles/` - Styles CSS/CSS-in-JS
- `tokens/` - Design tokens (couleurs, espacements, etc.)

## Comment exporter depuis Figma

1. Dans VS Code, ouvrez la palette de commandes (Ctrl+Shift+P)
2. Tapez "Figma: Export"
3. Sélectionnez le composant dans Figma
4. Les fichiers seront créés dans ce dossier

## Intégration dans l'app

Les composants exportés peuvent être importés ainsi :

```jsx
import { ComponentName } from '@/designs/figma/components/ComponentName';
```

## Notes

- Les exports sont automatiquement formatés pour React
- Les styles utilisent le thème ALFlight existant
- Les couleurs sont mappées vers notre palette Bordeaux