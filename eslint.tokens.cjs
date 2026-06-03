/**
 * ============================================================================
 *  ALFlight — Garde-fou Design Tokens (config ESLint AUTONOME)
 * ============================================================================
 *  Objectif : GELER L'ENTROPIE. Interdire toute NOUVELLE valeur de design
 *  écrite en dur (couleurs hex, rgb/rgba, px d'espacement/typo, poids de
 *  police numériques) dans le code JS/JSX.
 *
 *  Cette config est VOLONTAIREMENT INDÉPENDANTE de eslint.config.js :
 *  - elle ne contient QUE les règles tokens (aucun bruit react/hooks),
 *  - elle s'exécute via `npm run lint:tokens` (fichiers modifiés uniquement)
 *    ou `npm run lint:tokens:all` (audit complet, indicatif).
 *
 *  Format eslintrc (compatible ESLint 8.57.x). Lancée avec --no-eslintrc.
 *
 *  ⚠️ Ne contrôle PAS le code legacy par défaut (≈6000 déviations existantes) :
 *  seul le code nouveau/modifié est vérifié → principe « boy scout ».
 *
 *  Pour une exception légitime ponctuelle (ex. couleur d'une lib tierce) :
 *      // eslint-disable-next-line no-restricted-syntax
 * ============================================================================
 */

const HEX_MESSAGE =
  'Couleur hex en dur interdite. Utiliser var(--accent-primary | --text-* | --bg-* | --border-*) ou tokens.palette.* (src/shared/styles/designSystem.js).';
const RGBA_MESSAGE =
  'rgb()/rgba() en dur interdit. Utiliser une variable CSS (var(--app-bg-alpha-*, --border-*)) ou un token.';
const PX_MESSAGE =
  'Valeur px en dur sur une propriété d’espacement/typo. Utiliser tokens.spacing[n] / tokens.radius.* / tokens.typography.* ou la variable CSS correspondante.';
const FONTWEIGHT_MESSAGE =
  'Poids de police numérique en dur. Utiliser tokens.typography.*.fontWeight (400/500/600/700 centralisés).';

module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  // Le garde-fou ne s'applique pas à la définition des tokens eux-mêmes
  // (ce SONT les valeurs de référence), ni au pont MUI, ni aux fichiers de build.
  ignorePatterns: [
    'dist/**',
    'node_modules/**',
    'src/index.css',
    'src/shared/styles/designSystem.js',
    'src/styles/muiTheme.js',
    'eslint.tokens.cjs',
    'scripts/**',
  ],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        // Couleur hex (#fff, #ffffff, #ffffffff) n'importe où dans une string littérale
        selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
        message: HEX_MESSAGE,
      },
      {
        // rgb()/rgba() dans une string littérale
        selector: "Literal[value=/rgba?\\(/]",
        message: RGBA_MESSAGE,
      },
      {
        // px en dur sur les propriétés ayant une échelle de tokens
        selector:
          "Property[key.name=/^(padding|paddingTop|paddingBottom|paddingLeft|paddingRight|margin|marginTop|marginBottom|marginLeft|marginRight|gap|rowGap|columnGap|fontSize|borderRadius)$/] > Literal[value=/[0-9]+px/]",
        message: PX_MESSAGE,
      },
      {
        // fontWeight numérique en dur (ex. fontWeight: 700)
        selector: "Property[key.name='fontWeight'] > Literal[value=/^[0-9]+$/]",
        message: FONTWEIGHT_MESSAGE,
      },
    ],
  },
};
