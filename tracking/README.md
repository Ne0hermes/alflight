# 📊 Système de Tracking des Modifications

## Nouveau Format de Rapport (Mis à jour le 16 octobre 2025)

Le système de tracking envoie maintenant des **rapports formatés et lisibles** à Google Sheets au lieu de JSON brut.

### Exemple de Rapport Claude Code

```
📦 Modifications effectuées par Claude Code

🔹 2 fichier(s) modifié(s) (8 opération(s) totale(s)):

1. src/services/vfrPointsService.js ✅ (nouveau)
   └─ Composant: Backend

2. src/features/navigation/components/GlobalVFRPointsManager.jsx 📝 (modifié) (8 modifications)
   └─ Composant: Navigation Module

⏱️  Session démarrée: 16/10/2025 14:08:32
📅 Rapport généré: 16/10/2025 14:10:39

📌 Branche: main
👤 Auteur: Ne0hermes
```

### Structure des Colonnes Google Sheets

| Colonne | Nom        | Contenu                                     |
|---------|------------|---------------------------------------------|
| A       | Date/Heure | Horodatage de la modification               |
| B       | Action     | Type d'action (ex: "CLAUDE_CODE_MODIFICATIONS") |
| C       | Composant  | Module concerné (ex: "Claude Code Assistant") |
| D       | Résumé     | Résumé court (ex: "2 fichier(s) modifié(s) • 8 opération(s)") |
| E       | Détails    | Rapport formaté complet (voir exemple ci-dessus) |
| F       | Fichiers   | Liste des fichiers modifiés (un par ligne)  |
| G       | Statut     | Statut de l'opération (completed, active, etc.) |
| H       | Auteur     | Toujours "Claude Assistant"                 |

### Icônes Utilisées

- ✅ Fichier créé (nouveau)
- 📝 Fichier modifié
- ❌ Fichier supprimé
- 📦 En-tête de section
- 🔹 Liste d'items
- ⏱️  Horodatage
- 📌 Information Git
- 👤 Auteur

### Avantages du Nouveau Format

1. **Lisibilité** : Format texte facile à lire dans Google Sheets
2. **Structure** : Organisation claire avec emojis pour la navigation visuelle
3. **Contexte** : Information Git et horodatage inclus
4. **Tri** : Fichiers triés par nombre de modifications (décroissant)
5. **Détails** : Opérations multiples et composants affichés clairement

### Scripts Concernés

- `scripts/autoTracker.cjs` - Tracking automatique général
- `scripts/claude-code-tracker.cjs` - Tracking spécifique Claude Code
- `server/googleSheetsServer.js` - Serveur backend Google Sheets

### Utilisation

Les modifications sont automatiquement détectées et envoyées à Google Sheets avec un délai de:
- **autoTracker**: 2 secondes (debounce)
- **claude-code-tracker**: 60 secondes (debounce), 5 minutes max

Aucune action manuelle requise - le système est entièrement automatique.

### Lien Google Sheets

📊 [Voir le Tracking en Direct](https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k)
