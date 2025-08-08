#!/bin/bash
echo "Nettoyage du cache et redémarrage..."

# Arrêter les processus Node existants
echo "Arrêt des processus Node..."
pkill -f node || true

# Supprimer le cache de Vite
echo "Suppression du cache Vite..."
rm -rf node_modules/.vite 2>/dev/null
rm -rf .vite 2>/dev/null

# Supprimer les fichiers temporaires
echo "Suppression des fichiers temporaires..."
rm -f *.log 2>/dev/null

# Redémarrer le serveur de développement
echo "Redémarrage du serveur..."
npm run dev