# Push Notifications - Guide de Débogage

## 🎯 Comment Vérifier que Ça Fonctionne

Nous avons ajouté beaucoup de logs pour vous aider à déboguer. Voici comment les utiliser.

---

## 📱 Étape 1: Ouvrir la Console

### Sur Android (Emulateur)
```bash
npm start
# Puis press 'a' pour Android
```

### Sur iOS (Simulator)
```bash
npm start
# Puis press 'i' pour iOS
```

### Dans Expo Go
```bash
npm start
# Scanner le QR code avec Expo Go
```

---

## 🔍 Étape 2: Chercher les Logs

Cherchez les messages commençant par:
- `[usePushNotifications]`
- `[PushNotificationService]`

### Exemple de Logs Réussis

```
╔════════════════════════════════════════════════════════╗
║ INITIALISATION DES PUSH NOTIFICATIONS                   ║
╚════════════════════════════════════════════════════════╝
[usePushNotifications] Démarrage...
[usePushNotifications] 1️⃣  Configuration handler avant-plan...
[usePushNotifications] ✅ Handler configuré
[usePushNotifications] 2️⃣  Configuration des catégories...
[usePushNotifications] ✅ Catégories configurées
[usePushNotifications] 3️⃣  S'enregistrer pour les notifications...

========== ENREGISTREMENT PUSH ==========
[PushNotificationService] Enregistrement aux notifications push...
[PushNotificationService] Device.isDevice: true/false
[PushNotificationService] Vérification des permissions...
[PushNotificationService] Statut permission actuel: granted/denied
[PushNotificationService] ✅ Permissions accordées
[PushNotificationService] Récupération du token Expo...
[PushNotificationService] ✅ Token reçu: ExponentPushToken[abc123...]
[PushNotificationService] ========== ENREGISTREMENT RÉUSSI ==========

[usePushNotifications] ✅ Token obtenu: ExponentPushToken[abc123...]
[usePushNotifications] 4️⃣  Envoi du token au serveur...

========== ENVOI TOKEN AU SERVEUR ==========
[PushNotificationService] Token: ExponentPushToken[abc123...]
[PushNotificationService] DeviceType: Android 14 (ou iOS version)
[PushNotificationService] Platform: Pixel 4 (ou iPhone model)
[PushNotificationService] Envoi payload: {...}
[PushNotificationService] ✅ RÉPONSE DU SERVEUR: {...}
[PushNotificationService] ✅ Token enregistré sur serveur avec succès!
[PushNotificationService] ========== ENVOI RÉUSSI ==========

[usePushNotifications] ✅ Token envoyé avec succès au serveur
[usePushNotifications] 5️⃣  Tentative d'envoi des tokens en attente...
[usePushNotifications] 6️⃣  Configuration des handlers de réception...
[usePushNotifications] ✅ Handlers configurés

╔════════════════════════════════════════════════════════╗
║ ✅ PUSH NOTIFICATIONS INITIALISÉES AVEC SUCCÈS        ║
╚════════════════════════════════════════════════════════╝
```

---

## ❌ Problèmes Courants et Solutions

### 1. **❌ Device.isDevice: false**

**Problème**: Vous êtes sur un emulateur/simulator, pas sur un appareil physique.

**Solution**:
- Sur emulateur/simulator, un token de test est généré: `ExponentPushToken[TEST_...]`
- C'est normal et le code continue
- Les vraies notifications ne fonctionnent QUE sur appareils physiques

**Expected Log**:
```
[PushNotificationService] Device.isDevice: false
[PushNotificationService] ⚠️ Non sur un dispositif physique - Skip pour emulateur/simulator
[PushNotificationService] Génération d'un token de test...
[PushNotificationService] ✅ Token reçu: ExponentPushToken[TEST_...]
```

---

### 2. **❌ Pas de token envoyé au serveur**

**Problème**: Le token n'est pas envoyé au backend.

**Check List**:
1. ✅ Voir les logs "ENVOI TOKEN AU SERVEUR"?
   - Si NON: Token n'a pas été obtenu (voir problème #1)
   - Si OUI: Continuer à l'étape suivante

2. ✅ Voir "✅ Token enregistré sur serveur"?
   - Si OUI: Tout fonctionne! ✅
   - Si NON: Voir problème #3

---

### 3. **❌ Erreur lors de l'envoi au serveur**

**Logs Expected**:
```
[PushNotificationService] ❌ ERREUR ENVOI AU SERVEUR: ...
[PushNotificationService] Status: 404/500/...
[PushNotificationService] Data: {...}
```

**Solutions possibles**:

#### A. Endpoint non implémenté (404)
```
Status: 404
Message: "Not Found"
```
**Solution**: L'endpoint `/notifications/register-device` n'existe pas sur le backend
- Vous DEVEZ implémenter cet endpoint
- Voir: `PUSH_NOTIFICATIONS_BACKEND.md`

#### B. Erreur serveur (500)
```
Status: 500
Message: "Internal Server Error"
```
**Solution**:
- Vérifier les logs du serveur
- Vérifier que la base de données est accessible
- Vérifier les permissions

#### C. Erreur d'authentification (401/403)
```
Status: 401 ou 403
Message: "Unauthorized"
```
**Solution**:
- L'utilisateur n'est pas authentifié
- Le token JWT a expiré
- Vérifier que `AsyncStorage.getItem('auth_token')` retourne un token valide

#### D. Erreur réseau
```
Message: "Network error" ou "Cannot reach server"
```
**Solution**:
- Vérifier que le backend est en cours d'exécution
- Vérifier l'URL du backend dans `src/constants/config.ts`
- Vérifier les logs: "⚠️ Token sauvegardé localement (sera renvoyé plus tard)"
  - Le token est en attente et sera renvoyé quand le serveur sera accessible

---

### 4. **⚠️ "Pas de token obtenu"**

**Log Expected**:
```
[usePushNotifications] ⚠️  Pas de token obtenu
```

**Raisons possibles**:
1. ❌ Permissions refusées par l'utilisateur
2. ❌ Dispositif ne supporte pas les notifications
3. ❌ Erreur lors de la récupération du token

**Check List**:
- Voir le log: `[PushNotificationService] ❌ PERMISSIONS REFUSÉES`?
  - Si OUI: Accordez les permissions à l'app dans les paramètres

- Voir le log: `[PushNotificationService] ❌ ERREUR enregistrement: ...`?
  - Si OUI: Regarder le message d'erreur détaillé

---

## 📊 Tableau de Débogage

| Log | Signification | Action |
|-----|-------------|--------|
| ✅ Token reçu: ExponentPushToken[...] | Token obtenu avec succès | OK |
| ⚠️ Non sur un dispositif physique | Emulateur/simulator | OK (token test généré) |
| ❌ PERMISSIONS REFUSÉES | User a refusé les permissions | Permettre dans paramètres |
| ❌ ERREUR enregistrement: | Erreur lors de la récupération du token | Vérifier les logs d'erreur |
| ❌ ERREUR ENVOI AU SERVEUR | Problème lors de l'envoi au backend | Vérifier endpoint |
| ⚠️ Token sauvegardé localement | Serveur non accessible | Sera renvoyé plus tard |
| ✅ Token enregistré sur serveur | Token envoyé avec succès | ✅ SUCCÈS |

---

## 🧪 Test Complet

### Appareil Physique (Recommandé)

1. **Installer l'app**
   ```bash
   npm run android
   # ou
   npm run ios
   ```

2. **Donner les permissions**
   - Quand l'app demande, cliquez "Permettre"

3. **Vérifier les logs**
   - Ouvrir la console Expo
   - Chercher les logs `[usePushNotifications]` et `[PushNotificationService]`
   - Vérifier que vous voyez "✅ PUSH NOTIFICATIONS INITIALISÉES AVEC SUCCÈS"

4. **Vérifier dans le backend**
   - Ouvrir la base de données
   - Vérifier que la table `push_notification_devices` a une nouvelle ligne
   - Vérifier que le token est enregistré

5. **Envoyer un test push**
   ```bash
   curl -X POST "https://exp.host/--/api/v2/push/send" \
     -H "Content-Type: application/json" \
     -d '{
       "to": "ExponentPushToken[...]",
       "sound": "default",
       "title": "Test",
       "body": "Cela fonctionne!",
       "data": {
         "type": "ORDER",
         "orderId": 123
       }
     }'
   ```

6. **Vérifier que la notification arrive**
   - Vous devriez voir la notification sur votre téléphone
   - Cliquer dessus pour test la redirection

---

## 💾 Vérifier AsyncStorage

Si le serveur n'est pas accessible, le token est sauvegardé localement.

```bash
# Dans React Native Debugger:
# Chercher: pending_push_token
# Devrait contenir: ExponentPushToken[...]
```

Le token sera envoyé au serveur dès qu'il sera accessible.

---

## 📞 Support

Si vous avez toujours des problèmes:

1. ✅ Vérifier les logs détaillés (voir ci-dessus)
2. ✅ Vérifier que le backend implémente l'endpoint
3. ✅ Vérifier que l'appareil a les permissions
4. ✅ Vérifier la connexion réseau
5. ✅ Lire `PUSH_NOTIFICATIONS_BACKEND.md` pour implémenter le backend

---

## 🚀 Résumé

### Tout Fonctionne Si:
✅ Vous voyez "✅ PUSH NOTIFICATIONS INITIALISÉES AVEC SUCCÈS"
✅ Vous voyez "✅ Token enregistré sur serveur"
✅ Le token est dans la base de données

### Prochaine Étape:
1. Implémenter l'endpoint `/notifications/register-device` si pas fait
2. Envoyer un push test pour vérifier la réception
3. Vérifier la redirection quand on clique

---

**Tous les logs sont là pour vous aider à déboguer!** 🔍✅
