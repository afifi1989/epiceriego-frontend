# ⚠️ Résolution des Erreurs Play Store

## Erreur 1: Permission CAMERA Sans Politique de Confidentialité

### ❌ Le Problème
```
Votre APK ou votre Android App Bundle utilise des autorisations qui nécessitent
des règles de confidentialité : (android.permission.CAMERA). En savoir plus
```

### 🔍 Cause
L'app utilise la permission `CAMERA` (probablement via un module comme `expo-image-picker` ou `expo-camera`), mais une politique de confidentialité n'est pas déclarée dans Google Play Store.

Vérification des permissions utilisées :
```bash
# Dans AndroidManifest.xml
android.permission.CAMERA  # ⚠️ Non déclarée mais utilisée par dépendance
```

### ✅ Solutions

#### Option 1: Ajouter une Politique de Confidentialité (Recommandée)
1. **Créer une page de politique de confidentialité:**
   - Héberger sur votre site: `https://example.com/privacy`
   - Ou utiliser des services gratuits comme Termly, Privacy Policy Generator

2. **Dans Google Play Console:**
   - Aller à: **Politique relative aux données et sécurité**
   - Ajouter l'URL de votre politique
   - Déclarer toutes les permissions utilisées

3. **Contenu minimum de la politique:**
   ```markdown
   # Politique de Confidentialité - EpicerieGo

   ## Permissions utilisées:
   - CAMERA: Utilisée par la sélection d'images pour profil
   - LOCATION: Suivi en temps réel de la position du livreur
   - NOTIFICATIONS: Notifications de nouvelles commandes
   - INTERNET: Communication avec les serveurs

   ## Collecte de données:
   - Position GPS (avec consentement)
   - Données de livraison (adresse, téléphone client)

   ## Droits utilisateur:
   - Droit d'accès aux données
   - Droit de rectification
   - Droit de suppression
   ```

#### Option 2: Supprimer la Permission CAMERA (Si Non Utilisée)
Si la permission n'est pas vraiment nécessaire, la supprimer du manifest:

```xml
<!-- À RETIRER du AndroidManifest.xml -->
<uses-permission android:name="android.permission.CAMERA"/>
```

**Pour nos modules:**
```bash
# Vérifier les dépendances utilisant CAMERA
grep -r "CAMERA" node_modules/expo-image-picker/
grep -r "CAMERA" node_modules/expo-camera/
```

---

## Erreur 2: Version Code Déjà Utilisée

### ❌ Le Problème
```
Le code de version 2 a déjà été utilisé. Choisissez-en un autre.
```

### 🔍 Cause
Google Play Store enregistre tous les versionCode déjà uploadés. Vous ne pouvez pas réutiliser un versionCode antérieur.

### ✅ Solution: Incrémenter le versionCode

**Avant (❌):**
```gradle
versionCode 2  // Déjà utilisé!
versionName "1.0.0"
```

**Après (✅):**
```gradle
versionCode 3  // Nouveau numéro
versionName "1.0.0"
```

### 📋 Gestion des Versions

```gradle
// Incrémentation logique:
versionCode 1 → 1.0.0  // Version initiale
versionCode 2 → 1.0.1  // Bug fixes
versionCode 3 → 1.1.0  // Nouvelles features
versionCode 4 → 2.0.0  // Release majeure
```

**À faire avant chaque publication:**
1. ✅ Incrémenter versionCode dans `android/app/build.gradle`
2. ✅ Mettre à jour versionName si applicable
3. ✅ Tester le APK/AAB localement
4. ✅ Vérifier les erreurs sur Play Console
5. ✅ Upload et publication

---

## 🔧 Checklist: Correction des Erreurs

### ✅ Erreur CAMERA
- [ ] Créer/héberger une politique de confidentialité
- [ ] Ajouter l'URL dans Google Play Console
- [ ] Déclarer les permissions utilisées
- [ ] Reupload l'AAB

**Ou:**
- [ ] Identifier le module utilisant CAMERA
- [ ] Retirer la permission du manifest si inutile
- [ ] Rebuild et reupload

### ✅ Erreur versionCode
- [x] Incrémenter versionCode de 2 à 3
- [x] Rebuild le AAB
- [ ] Reupload l'AAB

---

## 📤 Instructions pour Reuploader

### 1. Rebuild l'AAB avec nouveau versionCode:
```bash
cd android
./gradlew --stop
./gradlew bundleRelease -Dorg.gradle.jvmargs="-Xmx4096m -XX:MaxMetaspaceSize=1024m"
```

### 2. Vérifier le versionCode:
```bash
# Le fichier généré
ls -lh app/build/outputs/bundle/release/app-release.aab
```

### 3. Dans Google Play Console:
- Aller à: **Versions** → **Internal testing** (ou Test)
- Cliquer: **Créer une release**
- Uploader: `app-release.aab`
- Ajouter les notes de version
- Cliquer: **Vérifier**

### 4. Ajouter la Politique de Confidentialité:
- Aller à: **Données et confidentialité** → **Politique relative aux données et sécurité**
- Ajouter l'URL complète de votre politique
- Sauvegarder

### 5. Soumettre à la révision:
- Cliquer: **Envoyer à la révision**
- Attendre 2-3 jours pour l'approbation

---

## 📚 Ressources Utiles

### Politique de Confidentialité
- **Générateur gratuit:** https://www.termsfeed.com/privacy-policy-generator/
- **Autre générateur:** https://www.privacypolicygenerator.info/
- **Template simple:** Voir ci-dessous

### Google Play Console
- **Documentation:** https://support.google.com/googleplay/android-developer/
- **Policy Hub:** https://support.google.com/googleplay/android-developer/answer/9859455
- **Permission Guidelines:** https://support.google.com/googleplay/android-developer/answer/10964491

---

## 📄 Template: Politique de Confidentialité Minimaliste

```markdown
# Politique de Confidentialité - EpicerieGo

**Dernière mise à jour:** [DATE]

## 1. Introduction
EpicerieGo (l'« Application ») collecte et traite certaines données personnelles.

## 2. Permissions Utilisées
Notre application demande les permissions suivantes :

- **CAMERA** - Permettre aux utilisateurs de prendre des photos
- **ACCESS_FINE_LOCATION** - Localisation GPS précise du livreur
- **ACCESS_COARSE_LOCATION** - Localisation approximative
- **INTERNET** - Connexion aux serveurs
- **POST_NOTIFICATIONS** - Notifications de nouvelles commandes
- **READ_EXTERNAL_STORAGE** - Accès aux images
- **WRITE_EXTERNAL_STORAGE** - Sauvegarde de fichiers

## 3. Données Collectées
- Position GPS du livreur (avec consentement)
- Données de profil utilisateur (nom, email, téléphone)
- Historique de livraisons
- Adresses de livraison

## 4. Durée de Conservation
- Les données sont conservées aussi longtemps que l'account est actif
- Suppression possible à tout moment via les paramètres du compte

## 5. Sécurité
Nous utilisons des mesures de sécurité appropriées pour protéger vos données.

## 6. Modifications
Nous pouvons modifier cette politique. Les modifications seront notifiées via l'application.

## 7. Contact
Pour toute question: **support@epiceriego.ma**
```

---

## 🚀 Prochaines Étapes

1. **Court terme (Maintenant):**
   - [x] Incrémenter versionCode (3)
   - [ ] Créer politique de confidentialité
   - [ ] Ajouter l'URL dans Play Console
   - [ ] Reupload AAB avec versionCode 3

2. **Moyen terme:**
   - [ ] Tester sur Internal Testing
   - [ ] Recueillir les retours
   - [ ] Corriger les bugs éventuels

3. **Long terme:**
   - [ ] Passer à Production
   - [ ] Monitorer les crashs
   - [ ] Planifier les mises à jour

---

**Date:** 14 novembre 2024
**Status:** ✅ PRÊT À REUPLOAD
