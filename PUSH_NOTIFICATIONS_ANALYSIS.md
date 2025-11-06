# 🔍 Analyse - Problème d'Enregistrement Token Push Notifications

## 📋 Contexte

Vous avez rapporté que sur un **téléphone physique**, l'enregistrement du token push ne fonctionne pas et l'endpoint backend **n'est pas appelé**.

---

## 🔎 Diagnostic - Outil de Debug

J'ai créé un outil de diagnostic **sans impact** sur l'application:

**Fichier**: `src/utils/pushNotificationDiagnostics.ts`

### Comment l'utiliser

#### Option 1: Depuis la console React Native (Recommandé)

1. Ouvrir l'app en dev: `npm start`
2. Ouvrir React Native Debugger ou logs console
3. Exécuter dans la console:

```javascript
import { pushNotificationDiagnostics } from './src/utils/pushNotificationDiagnostics';

// Diagnostic complet
await pushNotificationDiagnostics.fullDiagnostics();

// Identifier le problème
await pushNotificationDiagnostics.identifyProblem();
```

#### Option 2: Ajouter un bouton debug (Optionnel)

Créer `app/(client)/debug-push.tsx`:

```typescript
import { pushNotificationDiagnostics } from '../../src/utils/pushNotificationDiagnostics';

export default function DebugPushScreen() {
  const handleDiagnostics = async () => {
    await pushNotificationDiagnostics.fullDiagnostics();
    await pushNotificationDiagnostics.identifyProblem();
  };

  return (
    <TouchableOpacity onPress={handleDiagnostics}>
      <Text>🔍 Diagnostic Push</Text>
    </TouchableOpacity>
  );
}
```

---

## 🎯 Flux de l'Enregistrement du Token

```
┌─────────────────┐
│  handleLogin    │ (app/(auth)/login.tsx:32)
└────────┬────────┘
         │
         ▼
┌──────────────────────────────────┐
│ getTokenForLogin()               │ (pushNotificationService:19)
│ - Vérifie Device.isDevice        │
│ - Demande permissions (si nécessaire)
│ - Récupère token Expo            │
└────────┬─────────────────────────┘
         │
         ▼ (retourne token)
┌──────────────────────────────────┐
│ authService.login()              │ (authService:34)
│ - Envoie email + password + fcmToken
│ - À l'endpoint /auth/login       │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Backend /auth/login              │
│ - Reçoit fcmToken                │
│ - Enregistre dans DB             │
└──────────────────────────────────┘
```

---

## 🚨 Points de Défaillance Possibles

### 1️⃣ **Device Check**
```javascript
Device.isDevice = false
```

**Symptômes**: Vous êtes sur un émulateur/simulator
**Impact**: Token de test généré, ne fonctionnera jamais réellement

**Diagnostic**: `Device.isDevice` retourne `false`

**Solution**:
- ❌ Émulateur Android/iOS ne peut pas recevoir de vraies notifications
- ✅ Utiliser un téléphone physique

---

### 2️⃣ **Permissions Refusées**
```javascript
Notifications.getPermissionsAsync().status = 'denied'
```

**Symptômes**:
- L'app demande la permission mais vous refusez
- Ou c'était refusé avant

**Impact**: Aucun token obtenu (`null`)

**Diagnostic**:
```
permissions.status = 'denied'
canAskAgain = true/false
```

**Solutions**:
- Si `canAskAgain = true`: Relancer l'app, accepter permissions
- Si `canAskAgain = false`:
  - iOS: Paramètres > Notifications > EpicerieGo > Activer
  - Android: Paramètres > Apps > EpicerieGo > Notifications > Activer

---

### 3️⃣ **ProjectId Manquant**
```javascript
Constants.expoConfig?.extra?.eas?.projectId = undefined
```

**Symptômes**: `Notifications.getExpoPushTokenAsync()` échoue

**Impact**: Token obtenu = `null`

**Diagnostic**: `ProjectId` manquant dans logs

**Solution**:
Ajouter à `app.json`:
```json
{
  "extra": {
    "eas": {
      "projectId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    }
  }
}
```

Récupérer ProjectId: `eas project:info` (doit avoir un compte EAS)

---

### 4️⃣ **Endpoint Backend Non Appelé**

C'est le **problème principal rapporté**.

**Flux attendu**:
1. ✅ `pushNotificationService.getTokenForLogin()` → Récupère token
2. ✅ `authService.login(email, password, **fcmToken**)` → Envoie le token
3. ✅ Backend `POST /auth/login` reçoit le `fcmToken`
4. ✅ Backend enregistre le token en base de données

**Point d'arrêt possible**: Entre étape 1 et 3

**Causes possibles**:

#### A) Token non obtenu (étape 1)
```javascript
fcmToken = null
// Alors le login envoie fcmToken: null
```

**Diagnostic**: Vérifier logs console:
```
[LoginScreen] Token obtenu: NON ❌
```

**Solution**: Résoudre les problèmes 1-3 ci-dessus

#### B) Token obtenu mais endpoint ne reçoit rien
```javascript
fcmToken = 'ExponentPushToken[...]'  // ✅ OK
// Mais backend n'enregistre rien
```

**Diagnostic**: Vérifier logs backend
```bash
# Dans les logs du serveur:
POST /auth/login
Body: { email, password, fcmToken: "ExponentPushToken[...]" }
```

**Solution possible**: Côté backend, vérifier:
- `fcmToken` reçu et non null
- Endpoint enregistre en base de données
- Pas d'erreur SQL

---

## 📝 Checklist de Debug Pas à Pas

### Étape 1: Infos Device
```
✅ Device.isDevice = true          (téléphone physique)
✅ Device.osVersion = "14.5"       (version iOS/Android)
✅ Device.modelName = "iPhone 12"  (modèle)
```

**Si non**: Vous êtes sur émulateur → Utiliser téléphone

---

### Étape 2: Config Expo
```
✅ Constants.expoConfig.extra.eas.projectId = "xxxxxxxx..."
```

**Si non**: Ajouter à app.json

---

### Étape 3: Permissions
```
✅ Notifications.getPermissionsAsync().status = 'granted'
```

**Si non**: Aller dans paramètres téléphone → Autoriser

---

### Étape 4: Token obtenu
```javascript
const token = await Notifications.getExpoPushTokenAsync({ projectId });
console.log(token.data);  // ExponentPushToken[...]
```

**Si null**: Problème dans 1-3

---

### Étape 5: Authentification
```javascript
const jwtToken = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
console.log(jwtToken);  // xxxxxxx.xxxxxxx.xxxxxxx
```

**Si null**: Pas connecté → Se connecter d'abord

---

### Étape 6: Vérifier Logs Backend
```bash
# Sur le serveur:
tail -f /chemin/logs/application.log | grep "fcmToken"
```

Chercher:
```
POST /auth/login
Request body: { email, password, fcmToken: "ExponentPushToken[...]" }
```

---

## 🔧 Solutions Suggérées

### Problème: Permissions Refusées

**Sur Android**:
1. Paramètres > Applications > EpicerieGo
2. Permissions > Notifications
3. Autoriser les notifications

**Sur iOS**:
1. Paramètres > Notifications > EpicerieGo
2. Activer les notifications

---

### Problème: ProjectId Manquant

**Ajouter à app.json**:
```json
{
  "extra": {
    "eas": {
      "projectId": "votre-id"
    }
  }
}
```

Puis rebuild:
```bash
npm start
# Sélectionner plateformme et relancer
```

---

### Problème: Backend Ne Reçoit Rien

**Vérifications côté backend**:

1. Controller `/auth/login` reçoit `fcmToken`?
```java
@PostMapping("/login")
public ResponseEntity<?> login(@RequestBody LoginRequest request) {
    String fcmToken = request.getFcmToken();  // ← Vérifier
    System.out.println("FCM Token reçu: " + fcmToken);
    // ...
}
```

2. Enregistrer en base?
```java
if (fcmToken != null && !fcmToken.isEmpty()) {
    user.setFcmToken(fcmToken);
    userRepository.save(user);
    System.out.println("Token enregistré: " + fcmToken);
}
```

3. Pas d'erreur lors de la sauvegarde?

---

## 📊 Arbre de Décision

```
┌─ Device.isDevice?
│  ├─ NON → Utiliser téléphone physique
│  └─ OUI ↓
├─ ProjectId dans app.json?
│  ├─ NON → Ajouter ProjectId
│  └─ OUI ↓
├─ Permissions accordées?
│  ├─ NON → Aller dans paramètres, autoriser
│  └─ OUI ↓
├─ Token obtenu?
│  ├─ NON → Vérifier erreurs
│  └─ OUI ↓
├─ Connecté (JWT présent)?
│  ├─ NON → Se connecter
│  └─ OUI ↓
└─ Backend reçoit fcmToken?
   ├─ NON → Vérifier logs backend
   └─ OUI ✅ Fonctionne!
```

---

## 🧪 Test Complet

### 1. Déboguer avec le diagnostic

```bash
npm start
# Dans React Native console:
await pushNotificationDiagnostics.fullDiagnostics();
```

### 2. Se connecter

- Email: votre@email.com
- Password: votreMotDePasse

### 3. Vérifier logs

```
[LoginScreen] Token obtenu: OUI ✅
[LoginScreen] ✅ Connexion réussie
[authService.login] Données sauvegardées avec succès
```

### 4. Vérifier backend

```bash
# Sur serveur:
SELECT * FROM users WHERE email = 'votre@email.com';
# Colonne fcmToken doit avoir une valeur
```

---

## 📞 Aide Supplémentaire

### Pour Reproduire le Problème

Envoyez les informations suivantes:

1. Résultats de `fullDiagnostics()` en console
2. Logs backend lors de la connexion
3. Résultat SQL: SELECT fcmToken FROM users WHERE ...

### Fichiers Importants

- Login: `app/(auth)/login.tsx`
- Service Auth: `src/services/authService.ts`
- Service Push: `src/services/pushNotificationService.ts`
- Diagnostic: `src/utils/pushNotificationDiagnostics.ts`

---

## ✅ Résumé

| Point | Statut | Action |
|-------|--------|--------|
| Token obtenu? | ? | Lancer `fullDiagnostics()` |
| Permissions? | ? | Accepter dans paramètres |
| ProjectId? | ? | Ajouter à app.json |
| Backend reçoit? | ? | Vérifier logs serveur |
| Token sauvegardé? | ? | Vérifier base de données |

---

**Note**: Cet outil ne modifie **rien** et ne **casse rien**. C'est du pur diagnostic.
