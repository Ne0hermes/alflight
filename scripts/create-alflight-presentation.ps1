# Script PowerShell pour créer une présentation PowerPoint ALFlight
# Nécessite PowerPoint installé sur Windows

param(
    [string]$OutputPath = "D:\Applicator\alflight\ALFlight_Presentation.pptx"
)

Write-Host "🎨 Création de la présentation PowerPoint ALFlight..." -ForegroundColor Cyan

# Créer l'objet PowerPoint
try {
    $powerpoint = New-Object -ComObject PowerPoint.Application
    $powerpoint.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue

    # Créer une nouvelle présentation
    $presentation = $powerpoint.Presentations.Add()

    # Définir la taille de la diapositive (16:9)
    $presentation.PageSetup.SlideWidth = 960
    $presentation.PageSetup.SlideHeight = 540

    Write-Host "✅ PowerPoint ouvert" -ForegroundColor Green

    # Couleurs ALFlight (conversion RGB directe)
    # Bordeaux #93163C = R:147, G:22, B:60
    $colorBordeauxRGB = 147 + (22 * 256) + (60 * 256 * 256)
    $colorWhite = 16777215
    # Gray #6B7280 = R:107, G:114, B:128
    $colorGrayRGB = 107 + (114 * 256) + (128 * 256 * 256)

    # ======================
    # SLIDE 1 : Page de titre
    # ======================
    Write-Host "📄 Création Slide 1 : Page de titre..." -ForegroundColor Yellow
    $slide1 = $presentation.Slides.Add(1, 12) # ppLayoutBlank

    # Fond dégradé bordeaux
    $slide1.Background.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue
    $slide1.Background.Fill.ForeColor.RGB = $colorBordeauxRGB
    $slide1.Background.Fill.Solid()

    # Titre principal
    $titleBox1 = $slide1.Shapes.AddTextbox(1, 100, 150, 760, 100)
    $titleBox1.TextFrame.TextRange.Text = "ALFlight"
    $titleBox1.TextFrame.TextRange.Font.Size = 72
    $titleBox1.TextFrame.TextRange.Font.Bold = [Microsoft.Office.Core.MsoTriState]::msoTrue
    $titleBox1.TextFrame.TextRange.Font.Color.RGB = $colorWhite
    $titleBox1.TextFrame.TextRange.ParagraphFormat.Alignment = 2 # ppAlignCenter
    $titleBox1.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $titleBox1.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    # Sous-titre
    $subtitleBox1 = $slide1.Shapes.AddTextbox(1, 100, 270, 760, 60)
    $subtitleBox1.TextFrame.TextRange.Text = "Votre assistant de préparation de vol VFR"
    $subtitleBox1.TextFrame.TextRange.Font.Size = 28
    $subtitleBox1.TextFrame.TextRange.Font.Color.RGB = $colorWhite
    $subtitleBox1.TextFrame.TextRange.ParagraphFormat.Alignment = 2
    $subtitleBox1.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $subtitleBox1.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    # Footer
    $footerBox1 = $slide1.Shapes.AddTextbox(1, 100, 460, 760, 40)
    $footerBox1.TextFrame.TextRange.Text = "Solution professionnelle pour pilotes privés • Version Beta"
    $footerBox1.TextFrame.TextRange.Font.Size = 16
    $footerBox1.TextFrame.TextRange.Font.Color.RGB = $colorWhite
    $footerBox1.TextFrame.TextRange.ParagraphFormat.Alignment = 2
    $footerBox1.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $footerBox1.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    # ======================
    # SLIDE 2 : Problématique
    # ======================
    Write-Host "📄 Création Slide 2 : Problématique..." -ForegroundColor Yellow
    $slide2 = $presentation.Slides.Add(2, 12)

    # Titre
    $titleBox2 = $slide2.Shapes.AddTextbox(1, 50, 30, 860, 60)
    $titleBox2.TextFrame.TextRange.Text = "La Préparation de Vol : Un Défi Complexe"
    $titleBox2.TextFrame.TextRange.Font.Size = 36
    $titleBox2.TextFrame.TextRange.Font.Bold = [Microsoft.Office.Core.MsoTriState]::msoTrue
    $titleBox2.TextFrame.TextRange.Font.Color.RGB = $colorBordeauxRGB
    $titleBox2.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $titleBox2.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    # Contenu : problèmes
    $contentBox2 = $slide2.Shapes.AddTextbox(1, 80, 120, 800, 350)
    $problems = @"
❌  Sources de données multiples et dispersées
    • SIA, Météo France, NOTAM, cartes VAC...
    • Pas de vue centralisée

❌  Calculs manuels fastidieux et sources d'erreurs
    • Navigation, carburant, masse et centrage
    • Performances décollage/atterrissage

❌  Risque d'oublis critiques
    • Checklists, terrains de déroutement
    • Vérifications réglementaires

❌  Temps de préparation important
    • 45-90 minutes par vol en moyenne
    • Perte de temps précieux
"@
    $contentBox2.TextFrame.TextRange.Text = $problems
    $contentBox2.TextFrame.TextRange.Font.Size = 18
    $contentBox2.TextFrame.TextRange.Font.Color.RGB = $colorGrayRGB
    $contentBox2.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $contentBox2.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    # ======================
    # SLIDE 3 : Solution ALFlight
    # ======================
    Write-Host "📄 Création Slide 3 : Solution ALFlight..." -ForegroundColor Yellow
    $slide3 = $presentation.Slides.Add(3, 12)

    # Titre
    $titleBox3 = $slide3.Shapes.AddTextbox(1, 50, 30, 860, 60)
    $titleBox3.TextFrame.TextRange.Text = "ALFlight : La Solution Tout-en-Un"
    $titleBox3.TextFrame.TextRange.Font.Size = 36
    $titleBox3.TextFrame.TextRange.Font.Bold = [Microsoft.Office.Core.MsoTriState]::msoTrue
    $titleBox3.TextFrame.TextRange.Font.Color.RGB = $colorBordeauxRGB
    $titleBox3.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $titleBox3.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    # Contenu
    $contentBox3 = $slide3.Shapes.AddTextbox(1, 80, 120, 800, 350)
    $solution = @"
✅  Plateforme web progressive (PWA)
    • Accessible sur ordinateur, tablette et smartphone
    • Installation sur écran d'accueil iOS/Android

✅  Données officielles synchronisées
    • SIA, AIXM 4.5, OpenAIP, CheckWX
    • Mise à jour automatique (cycle AIRAC)

✅  Calculs automatisés et précis
    • Navigation, carburant, masse et centrage
    • Performances décollage/atterrissage avec abaques

✅  Sécurité renforcée
    • Détection zones dangereuses
    • Terrains de déroutement intelligents
    • Checklists personnalisées
"@
    $contentBox3.TextFrame.TextRange.Text = $solution
    $contentBox3.TextFrame.TextRange.Font.Size = 18
    $contentBox3.TextFrame.TextRange.Font.Color.RGB = $colorGrayRGB
    $contentBox3.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $contentBox3.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    # ======================
    # SLIDE 4 : Modules Principaux (1/3)
    # ======================
    Write-Host "📄 Création Slide 4 : Modules Navigation & Météo..." -ForegroundColor Yellow
    $slide4 = $presentation.Slides.Add(4, 12)

    $titleBox4 = $slide4.Shapes.AddTextbox(1, 50, 30, 860, 60)
    $titleBox4.TextFrame.TextRange.Text = "Modules Principaux : Navigation & Météo"
    $titleBox4.TextFrame.TextRange.Font.Size = 32
    $titleBox4.TextFrame.TextRange.Font.Bold = [Microsoft.Office.Core.MsoTriState]::msoTrue
    $titleBox4.TextFrame.TextRange.Font.Color.RGB = $colorBordeauxRGB
    $titleBox4.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $titleBox4.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    $contentBox4 = $slide4.Shapes.AddTextbox(1, 80, 110, 800, 380)
    $modules1 = @"
🧭  MODULE NAVIGATION
• Sélection aérodromes + points VFR (493 aérodromes FR)
• Calcul automatique routes, caps, temps de vol
• Navigation circulaire (retour au départ)
• Carte interactive temps réel avec waypoints
• Analyse vent en route (vent effectif, dérive)
• Détection automatique zones dangereuses (P, D, R)

🌤️  MODULE MÉTÉO
• METAR/TAF temps réel (API CheckWX)
• Décodage automatique (vent, visibilité, QNH, température)
• Météo départ, arrivée, déroutements
• Suggestion piste selon vent
• Historique et actualisation manuelle
• Alertes conditions météo dégradées
"@
    $contentBox4.TextFrame.TextRange.Text = $modules1
    $contentBox4.TextFrame.TextRange.Font.Size = 16
    $contentBox4.TextFrame.TextRange.Font.Color.RGB = $colorGrayRGB
    $contentBox4.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $contentBox4.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    # ======================
    # SLIDE 5 : Modules Principaux (2/3)
    # ======================
    Write-Host "📄 Création Slide 5 : Modules Carburant & Performances..." -ForegroundColor Yellow
    $slide5 = $presentation.Slides.Add(5, 12)

    $titleBox5 = $slide5.Shapes.AddTextbox(1, 50, 30, 860, 60)
    $titleBox5.TextFrame.TextRange.Text = "Modules Principaux : Carburant & Performances"
    $titleBox5.TextFrame.TextRange.Font.Size = 32
    $titleBox5.TextFrame.TextRange.Font.Bold = [Microsoft.Office.Core.MsoTriState]::msoTrue
    $titleBox5.TextFrame.TextRange.Font.Color.RGB = $colorBordeauxRGB
    $titleBox5.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $titleBox5.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    $contentBox5 = $slide5.Shapes.AddTextbox(1, 80, 110, 800, 380)
    $modules2 = @"
⛽  MODULE CARBURANT
• Calcul automatique Trip Fuel (consommation en route)
• Contingency Fuel (5% du trip, min 1 gal)
• Final Reserve (30/45 min selon règles VFR/IFR)
• Alternate Fuel (carburant déroutements)
• Vérification FOB (Fuel On Board) suffisant
• Support multi-unités (L, gal, kg, lbs)

✈️  MODULE PERFORMANCES
• Calcul performances décollage/atterrissage
• Abaques numériques personnalisés par avion
• Facteurs correctifs (altitude, température, vent, pente)
• Températures depuis METAR (sécurité critique)
• Distance nécessaire vs disponible
• Alertes pistes trop courtes
"@
    $contentBox5.TextFrame.TextRange.Text = $modules2
    $contentBox5.TextFrame.TextRange.Font.Size = 16
    $contentBox5.TextFrame.TextRange.Font.Color.RGB = $colorGrayRGB
    $contentBox5.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $contentBox5.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    # ======================
    # SLIDE 6 : Modules Principaux (3/3)
    # ======================
    Write-Host "📄 Création Slide 6 : Modules Avion & Sécurité..." -ForegroundColor Yellow
    $slide6 = $presentation.Slides.Add(6, 12)

    $titleBox6 = $slide6.Shapes.AddTextbox(1, 50, 30, 860, 60)
    $titleBox6.TextFrame.TextRange.Text = "Modules Principaux : Avion & Sécurité"
    $titleBox6.TextFrame.TextRange.Font.Size = 32
    $titleBox6.TextFrame.TextRange.Font.Bold = [Microsoft.Office.Core.MsoTriState]::msoTrue
    $titleBox6.TextFrame.TextRange.Font.Color.RGB = $colorBordeauxRGB
    $titleBox6.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $titleBox6.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    $contentBox6 = $slide6.Shapes.AddTextbox(1, 80, 110, 800, 380)
    $modules3 = @"
⚖️  MODULE MASSE & CENTRAGE
• Calcul automatique poids total et CG
• Scénarios : au décollage, à l'atterrissage, zéro fuel
• Graphique enveloppe de centrage temps réel
• Alertes hors limites (avant/arrière)
• Compartiments bagages configurables

🛩️  MODULE AVION
• Gestion multi-avions (immatriculation, type)
• Import manuel des abaques (MANEX PDF)
• Extraction IA des performances (à venir)
• Photos et documents techniques
• Limites de masse, consommation, vitesses

🔧  MODULE CARNET TECHNIQUE
• Suivi entretiens et maintenances
• Log technique MEL/CDL
• Équipements de survie SAR
• Détection zones dangereuses (P, D, R)
"@
    $contentBox6.TextFrame.TextRange.Text = $modules3
    $contentBox6.TextFrame.TextRange.Font.Size = 16
    $contentBox6.TextFrame.TextRange.Font.Color.RGB = $colorGrayRGB
    $contentBox6.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $contentBox6.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    # ======================
    # SLIDE 7 : Modules Complémentaires
    # ======================
    Write-Host "📄 Création Slide 7 : Modules Complémentaires..." -ForegroundColor Yellow
    $slide7 = $presentation.Slides.Add(7, 12)

    $titleBox7 = $slide7.Shapes.AddTextbox(1, 50, 30, 860, 60)
    $titleBox7.TextFrame.TextRange.Text = "Modules Complémentaires"
    $titleBox7.TextFrame.TextRange.Font.Size = 32
    $titleBox7.TextFrame.TextRange.Font.Bold = [Microsoft.Office.Core.MsoTriState]::msoTrue
    $titleBox7.TextFrame.TextRange.Font.Color.RGB = $colorBordeauxRGB
    $titleBox7.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $titleBox7.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    $contentBox7 = $slide7.Shapes.AddTextbox(1, 80, 110, 800, 380)
    $modules4 = @"
📋  MODULE CHECKLIST
• Checklists personnalisables par avion
• Phases : pré-vol, démarrage, roulage, décollage, etc.
• Suivi progression avec items cochables
• Alertes items critiques oubliés

✈️  MODULE DÉROUTEMENTS
• Sélection intelligente terrains de dégagement
• Calcul automatique distances, carburant, temps
• Critères : longueur piste, services, proximité
• Météo temps réel pour alternates
• Carte interactive avec rayon d'action

📖  MODULE CARNET DE VOL
• Enregistrement automatique des vols
• Suivi heures de vol pilote
• Statistiques : heures totales, types d'avions
• Export PDF pour DGAC

📚  MODULE VAC & RÉFÉRENCES
• Cartes VAC aérodromes français (SIA)
• Références réglementaires aéronautiques
• Accès rapide documentation technique
"@
    $contentBox7.TextFrame.TextRange.Text = $modules4
    $contentBox7.TextFrame.TextRange.Font.Size = 16
    $contentBox7.TextFrame.TextRange.Font.Color.RGB = $colorGrayRGB
    $contentBox7.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $contentBox7.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    # ======================
    # SLIDE 8 : Architecture Technique
    # ======================
    Write-Host "📄 Création Slide 8 : Architecture Technique..." -ForegroundColor Yellow
    $slide8 = $presentation.Slides.Add(8, 12)

    $titleBox8 = $slide8.Shapes.AddTextbox(1, 50, 30, 860, 60)
    $titleBox8.TextFrame.TextRange.Text = "Architecture Technique"
    $titleBox8.TextFrame.TextRange.Font.Size = 32
    $titleBox8.TextFrame.TextRange.Font.Bold = [Microsoft.Office.Core.MsoTriState]::msoTrue
    $titleBox8.TextFrame.TextRange.Font.Color.RGB = $colorBordeauxRGB
    $titleBox8.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $titleBox8.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    $contentBox8 = $slide8.Shapes.AddTextbox(1, 80, 110, 800, 380)
    $tech = @"
🔧  STACK TECHNIQUE
• Frontend : React 18 + Vite 7 + Material-UI 7
• State Management : Zustand 4.5 + Context API
• Backend : Supabase (PostgreSQL + Auth + Storage)
• Mobile : Capacitor 7.4 (iOS/Android)
• Cartes : Leaflet.js + OpenLayers
• Build : PWA installable (Service Worker)

📊  DONNÉES AÉRONAUTIQUES
• AIXM 4.5 France (SIA - cycle AIRAC 2025-10-02)
• OpenAIP (aérodromes, espaces aériens)
• CheckWX API (METAR/TAF temps réel)
• Mise à jour automatique tous les 28 jours

🔐  SÉCURITÉ & PERFORMANCE
• Authentification Supabase (JWT tokens)
• Stockage local IndexedDB (offline-first)
• Cache intelligent (Service Worker)
• Chiffrement données sensibles
• Backup automatique cloud
"@
    $contentBox8.TextFrame.TextRange.Text = $tech
    $contentBox8.TextFrame.TextRange.Font.Size = 16
    $contentBox8.TextFrame.TextRange.Font.Color.RGB = $colorGrayRGB
    $contentBox8.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $contentBox8.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    # ======================
    # SLIDE 9 : Modèle Économique
    # ======================
    Write-Host "📄 Création Slide 9 : Modèle Économique..." -ForegroundColor Yellow
    $slide9 = $presentation.Slides.Add(9, 12)

    $titleBox9 = $slide9.Shapes.AddTextbox(1, 50, 30, 860, 60)
    $titleBox9.TextFrame.TextRange.Text = "Modèle Économique"
    $titleBox9.TextFrame.TextRange.Font.Size = 32
    $titleBox9.TextFrame.TextRange.Font.Bold = [Microsoft.Office.Core.MsoTriState]::msoTrue
    $titleBox9.TextFrame.TextRange.Font.Color.RGB = $colorBordeauxRGB
    $titleBox9.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $titleBox9.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    $contentBox9 = $slide9.Shapes.AddTextbox(1, 80, 110, 800, 380)
    $business = @"
💎  APPLICATION PREMIUM PAYANTE

✅  Abonnement requis dès le début
    • Toutes les fonctionnalités incluses
    • Qualité professionnelle garantie
    • Support prioritaire
    • Mises à jour continues

🎯  PUBLIC CIBLE
    • Pilotes privés VFR (France)
    • Aéro-clubs et écoles de pilotage
    • Propriétaires d'avions
    • Estimé : 40 000+ pilotes en France

📈  PROPOSITION DE VALEUR
    • Gain de temps : 45-90 min → 15-20 min par vol
    • Sécurité accrue : vérifications automatiques
    • Données officielles toujours à jour
    • Alternative moderne aux solutions obsolètes
    • Accessible partout (PC, tablette, smartphone)

💰  TARIFICATION (à définir selon phase Beta)
    • Abonnement mensuel ou annuel
    • Tarif préférentiel testeurs Beta
"@
    $contentBox9.TextFrame.TextRange.Text = $business
    $contentBox9.TextFrame.TextRange.Font.Size = 16
    $contentBox9.TextFrame.TextRange.Font.Color.RGB = $colorGrayRGB
    $contentBox9.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $contentBox9.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    # ======================
    # SLIDE 10 : Roadmap
    # ======================
    Write-Host "📄 Création Slide 10 : Roadmap..." -ForegroundColor Yellow
    $slide10 = $presentation.Slides.Add(10, 12)

    $titleBox10 = $slide10.Shapes.AddTextbox(1, 50, 30, 860, 60)
    $titleBox10.TextFrame.TextRange.Text = "Roadmap & Évolutions Futures"
    $titleBox10.TextFrame.TextRange.Font.Size = 32
    $titleBox10.TextFrame.TextRange.Font.Bold = [Microsoft.Office.Core.MsoTriState]::msoTrue
    $titleBox10.TextFrame.TextRange.Font.Color.RGB = $colorBordeauxRGB
    $titleBox10.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $titleBox10.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    $contentBox10 = $slide10.Shapes.AddTextbox(1, 80, 110, 800, 380)
    $roadmap = @"
🚀  PHASE BETA (EN COURS)
✅  13 modules fonctionnels opérationnels
✅  Authentification et stockage cloud
✅  Données aéronautiques officielles FR
✅  Interface PWA responsive (PC/tablette/mobile)
🔄  Tests utilisateurs et corrections bugs
🔄  Optimisations performances et UX

📅  PHASE 1 - Q2 2025
🎯  Extraction automatique abaques IA (MANEX PDF)
🎯  Cartes météo aéronautiques (WINTEM/TEMSI)
🎯  Partage plans de vol communauté
🎯  Export DGAC officiel (carnet de vol)

📅  PHASE 2 - Q3-Q4 2025
🎯  Support IFR (SID, STAR, approches)
🎯  Intégration NOTAM temps réel
🎯  Planification multi-étapes avancée
🎯  Synchronisation multi-appareils
🎯  API publique pour tiers (clubs, écoles)

🌍  PHASE 3 - 2026
🎯  Extension pays européens (UK, DE, ES, IT)
🎯  Communauté pilotes (partage expériences, photos)
🎯  Mode offline complet (sans connexion)
"@
    $contentBox10.TextFrame.TextRange.Text = $roadmap
    $contentBox10.TextFrame.TextRange.Font.Size = 16
    $contentBox10.TextFrame.TextRange.Font.Color.RGB = $colorGrayRGB
    $contentBox10.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $contentBox10.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    # ======================
    # SLIDE 11 : Capture d'écran / Démo (placeholder)
    # ======================
    Write-Host "📄 Création Slide 11 : Captures d'écran..." -ForegroundColor Yellow
    $slide11 = $presentation.Slides.Add(11, 12)

    $titleBox11 = $slide11.Shapes.AddTextbox(1, 50, 30, 860, 60)
    $titleBox11.TextFrame.TextRange.Text = "Interface & Expérience Utilisateur"
    $titleBox11.TextFrame.TextRange.Font.Size = 32
    $titleBox11.TextFrame.TextRange.Font.Bold = [Microsoft.Office.Core.MsoTriState]::msoTrue
    $titleBox11.TextFrame.TextRange.Font.Color.RGB = $colorBordeauxRGB
    $titleBox11.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $titleBox11.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    $contentBox11 = $slide11.Shapes.AddTextbox(1, 100, 150, 760, 300)
    $ui = @"
🎨  DESIGN MODERNE & INTUITIF
• Interface épurée, navigation simple
• Couleurs professionnelles (bordeaux #93163C)
• Dark mode disponible
• Responsive design (PC, tablette, mobile)
• Typographie : Space Grotesk + Inter

📱  EXPÉRIENCE UTILISATEUR
• Assistant de préparation de vol guidé (7 étapes)
• Formulaires intelligents avec suggestions
• Feedback temps réel (calculs instantanés)
• Alertes visuelles et sonores (sécurité)
• Mode hors-ligne partiel (données en cache)

💡  ACCESSIBILITÉ
• Contraste élevé, lisibilité optimale
• Navigation clavier complète
• Tooltips et aides contextuelles
• Support multi-unités (métrique/impérial)

[Espace réservé pour captures d'écran ou vidéo démo]
"@
    $contentBox11.TextFrame.TextRange.Text = $ui
    $contentBox11.TextFrame.TextRange.Font.Size = 16
    $contentBox11.TextFrame.TextRange.Font.Color.RGB = $colorGrayRGB
    $contentBox11.TextFrame.TextRange.ParagraphFormat.Alignment = 1
    $contentBox11.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $contentBox11.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    # ======================
    # SLIDE 12 : Conclusion & Contact
    # ======================
    Write-Host "📄 Création Slide 12 : Conclusion..." -ForegroundColor Yellow
    $slide12 = $presentation.Slides.Add(12, 12)

    # Fond bordeaux
    $slide12.Background.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue
    $slide12.Background.Fill.ForeColor.RGB = $colorBordeauxRGB
    $slide12.Background.Fill.Solid()

    $titleBox12 = $slide12.Shapes.AddTextbox(1, 100, 120, 760, 80)
    $titleBox12.TextFrame.TextRange.Text = "Prêt à Révolutionner Votre Préparation de Vol ?"
    $titleBox12.TextFrame.TextRange.Font.Size = 36
    $titleBox12.TextFrame.TextRange.Font.Bold = [Microsoft.Office.Core.MsoTriState]::msoTrue
    $titleBox12.TextFrame.TextRange.Font.Color.RGB = $colorWhite
    $titleBox12.TextFrame.TextRange.ParagraphFormat.Alignment = 2
    $titleBox12.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $titleBox12.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    $contentBox12 = $slide12.Shapes.AddTextbox(1, 150, 240, 660, 180)
    $conclusion = @"
✈️  ALFlight : La solution professionnelle pour pilotes VFR

📧  Contact : contact@alflight.fr
🌐  Web : www.alflight.fr (à venir)

🎯  Rejoignez la Beta et participez à l'évolution d'ALFlight !

Merci de votre attention.
Questions / Échanges
"@
    $contentBox12.TextFrame.TextRange.Text = $conclusion
    $contentBox12.TextFrame.TextRange.Font.Size = 20
    $contentBox12.TextFrame.TextRange.Font.Color.RGB = $colorWhite
    $contentBox12.TextFrame.TextRange.ParagraphFormat.Alignment = 2
    $contentBox12.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $contentBox12.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse

    # Sauvegarder la présentation
    Write-Host "💾 Sauvegarde de la présentation..." -ForegroundColor Cyan
    $presentation.SaveAs($OutputPath)

    Write-Host "✅ Présentation créée avec succès !" -ForegroundColor Green
    Write-Host "📁 Emplacement : $OutputPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📝 Contenu de la présentation :" -ForegroundColor Yellow
    Write-Host "  • 12 slides professionnelles" -ForegroundColor White
    Write-Host "  • Problématique et solution" -ForegroundColor White
    Write-Host "  • 13 modules détaillés" -ForegroundColor White
    Write-Host "  • Architecture technique" -ForegroundColor White
    Write-Host "  • Modèle économique premium" -ForegroundColor White
    Write-Host "  • Roadmap 2025-2026" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 Prochaines étapes :" -ForegroundColor Yellow
    Write-Host "  1. Ajouter des captures d'écran sur slide 11" -ForegroundColor White
    Write-Host "  2. Personnaliser les informations de contact" -ForegroundColor White
    Write-Host "  3. Ajuster les tarifs si disponibles" -ForegroundColor White

} catch {
    Write-Host "❌ Erreur lors de la création de la présentation :" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Vérifications :" -ForegroundColor Yellow
    Write-Host "  • Microsoft PowerPoint est installé ?" -ForegroundColor White
    Write-Host "  • PowerPoint peut être contrôlé via COM ?" -ForegroundColor White
    Write-Host "  • Le chemin de sortie est valide ?" -ForegroundColor White
}
