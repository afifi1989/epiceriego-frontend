# Script PowerShell pour lancer l'app EpicerieGO
# Sauvegardez ce fichier et exécutez: powershell -ExecutionPolicy Bypass -File RUN_APP.ps1

$projectPath = "d:\projects\EpeceriGo\front\epiceriego-app"
Set-Location $projectPath

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "🚀 Lancement de EpicerieGO Épicier Interface" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""

# Vérifier que npm fonctionne
Write-Host "✓ Vérification de npm..." -ForegroundColor Yellow
npm --version | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ npm n'est pas disponible" -ForegroundColor Red
    exit 1
}

# Vérifier si node_modules existe
Write-Host "✓ Vérification des dépendances..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "  → Installation des dépendances..." -ForegroundColor Cyan
    npm install --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Erreur lors de l'installation" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "✓ Tout est prêt!" -ForegroundColor Green
Write-Host ""
Write-Host "Sélectionnez votre plateforme:" -ForegroundColor Yellow
Write-Host "  1) Android    - npx expo start --android"
Write-Host "  2) iOS        - npx expo start --ios"
Write-Host "  3) Web        - npm run web"
Write-Host "  4) Interactif - npm start"
Write-Host ""

$choice = Read-Host "Choisissez (1-4)"

switch ($choice) {
    "1" {
        Write-Host "Lancement sur Android..." -ForegroundColor Cyan
        & npm run android
    }
    "2" {
        Write-Host "Lancement sur iOS..." -ForegroundColor Cyan
        & npm run ios
    }
    "3" {
        Write-Host "Lancement sur Web..." -ForegroundColor Cyan
        & npm run web
    }
    "4" {
        Write-Host "Mode interactif..." -ForegroundColor Cyan
        & npm start
    }
    default {
        Write-Host "Choix invalide" -ForegroundColor Red
    }
}
