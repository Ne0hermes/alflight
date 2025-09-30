#!/bin/bash

# Script de build iOS pour TestFlight
echo "🚀 Build iOS pour TestFlight"

# 1. Build de production
echo "📦 Build de production..."
npm run build

# 2. Synchronisation avec Capacitor
echo "🔄 Synchronisation Capacitor..."
npx cap sync ios

# 3. Mise à jour des plugins
echo "🔌 Mise à jour des plugins iOS..."
npx cap update ios

# 4. Afficher les instructions
echo ""
echo "✅ Build prêt pour Xcode!"
echo ""
echo "📱 Prochaines étapes:"
echo "1. Ouvrir Xcode: npx cap open ios"
echo "2. Dans Xcode:"
echo "   - Sélectionner 'Any iOS Device (arm64)'"
echo "   - Product → Archive"
echo "   - Distribute App → App Store Connect"
echo ""
echo "💡 Tips:"
echo "- Vérifier le Bundle ID: com.alflight.app"
echo "- Incrémenter le Build Number pour chaque upload"
echo "- Activer 'Automatically manage signing'"