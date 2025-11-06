# 🔍 Diagnostic Push Notifications - Problème d'Enregistrement du Device Token

## 📊 Résumé du Problème

Le device token pour les notifications push n'est **pas enregistré sur le backend** lors de la connexion des clients. Après analyse complète du code, j'ai identifié plusieurs problèmes d'architecture.

---

## 🔴 Problème Principal

### Ce qui se passe actuellement :

1. **Au moment de la connexion** (`login.tsx`) :
   - ✅ Le token push est récupéré avec `getTokenForLogin()`
   - ✅ Le token est envoyé au backend via `/auth/login` avec le paramètre `fcmToken`
   - ❌ **MAIS le backend ne sauvegarde probablement PAS ce token**

2. **Après la connexion** (`_layout.tsx`) :
   - Le code tente d'enregistrer le device pour les notifications
   - Il essaie d'envoyer le token via `sendTokenToServer()`
   - ❌ **Cette fonction échoue car les endpoints n'existent probablement pas**

---

## 🧩 Analyse Détaillée du Code Frontend

### 1. Flux de Connexion (login.tsx)

```typescript
// ✅ Récupère le token AVANT la connexion
const fcmToken = await pushNotificationService.getTokenForLogin();

// ✅ Envoie le token au backend lors de la connexion
const userData = await authService.login(email, password, fcmToken);
```

**Code dans authService.ts :**
```typescript
const response = await api.post<LoginResponse>('/auth/login', {
  email,
  password,
  fcmToken,  // ✅ Token envoyé ici
});
```

**➡️ PROBLÈME :** Le backend reçoit le `fcmToken` mais ne le sauvegarde probablement pas dans la table `push_notification_devices`.

---

### 2. Tentative d'Enregistrement Post-Connexion (_layout.tsx)

```typescript
// Dans le useEffect du ClientLayout
const token = await pushNotificationService.registerForPushNotifications();
if (token) {
  // ❌ Essaie d'envoyer le token via sendTokenToServer
  const success = await pushNotificationService.sendTokenToServer(token);
}
```

**Code dans pushNotificationService.ts :**
```typescript
sendTokenToServer: async (token: string): Promise<boolean> => {
  // Essaie plusieurs endpoints
  const endpointsToTry = [
    '/auth/update-device-token',        // ❌ N'existe probablement pas
    '/notifications/register-device',   // ❌ N'existe probablement pas
    '/devices/register',                // ❌ N'existe probablement pas
  ];
  
  // Tous échouent → return false
}
```

**➡️ PROBLÈME :** Ces endpoints n'existent probablement pas sur le backend (voir documentation PUSH_NOTIFICATIONS_BACKEND.md).

---

## 🔍 Ce que Dit la Documentation Backend

Selon `PUSH_NOTIFICATIONS_BACKEND.md`, l'endpoint devrait être :

```
POST /api/notifications/register-device
```

**Avec le payload :**
```json
{
  "expoPushToken": "ExponentPushToken[...]",
  "deviceType": "iPhone 13",
  "platform": "iOS"
}
```

**MAIS** dans le code frontend, on essaie d'envoyer :
```json
{
  "expoPushToken": "...",
  "fcmToken": "...",        // ❌ Paramètre en double
  "deviceType": "...",
  "platform": "..."
}
```

---

## 🚨 Causes du Problème

### Cause #1 : Backend ne sauvegarde pas le token lors de /auth/login

**Situation actuelle :**
```java
// Dans le backend (supposé)
@PostMapping("/auth/login")
public ResponseEntity<?> login(@RequestBody LoginRequest request) {
  // Authentification
  User user = authenticate(request.getEmail(), request.getPassword());
  
  // ❌ Le fcmToken est reçu mais NON sauvegardé
  // request.getFcmToken() est ignoré !
  
  // Génère le JWT et retourne
  return ResponseEntity.ok(generateTokenResponse(user));
}
```

**Ce qui devrait se passer :**
```java
@PostMapping("/auth/login")
public ResponseEntity<?> login(@RequestBody LoginRequest request) {
  User user = authenticate(request.getEmail(), request.getPassword());
  
  // ✅ Sauvegarder le token push si fourni
  if (request.getFcmToken() != null && !request.getFcmToken().isEmpty()) {
    pushNotificationDeviceService.registerDevice(
      user.getEmail(),
      request.getFcmToken(),
      request.getDeviceType(),
      request.getPlatform()
    );
  }
  
  return ResponseEntity.ok(generateTokenResponse(user));
}
```

---

### Cause #2 : Endpoints de secours n'existent pas

Le code frontend tente d'envoyer le token via plusieurs endpoints de secours :
- `/auth/update-device-token` ❌
- `/notifications/register-device` ❌  
- `/devices/register` ❌

**Aucun de ces endpoints n'est implémenté sur le backend.**

---

## ✅ Solutions Proposées

### 🎯 Solution Recommandée : Modifier le Backend Login

**Avantages :**
- ✅ Simple et efficace
- ✅ Un seul appel API au moment de la connexion
- ✅ Pas besoin de créer de nouveaux endpoints
- ✅ Le token est enregistré immédiatement

**Modifications à faire sur le backend :**

#### 1. Modifier le DTO LoginRequest

```java
public class LoginRequest {
  private String email;
  private String password;
  private String fcmToken;        // ✅ Ajouter ce champ
  private String deviceType;      // ✅ Ajouter ce champ (optionnel)
  private String platform;        // ✅ Ajouter ce champ (optionnel)
  
  // Getters et Setters...
}
```

#### 2. Modifier le AuthController

```java
@RestController
@RequestMapping("/api/auth")
public class AuthController {

  @Autowired
  private AuthService authService;
  
  @Autowired
  private PushNotificationDeviceService pushService;

  @PostMapping("/login")
  public ResponseEntity<?> login(@RequestBody LoginRequest request) {
    try {
      // 1. Authentifier l'utilisateur
      User user = authService.authenticate(
        request.getEmail(), 
        request.getPassword()
      );

      // 2. ✅ Enregistrer le device token si fourni
      if (request.getFcmToken() != null && !request.getFcmToken().isEmpty()) {
        try {
          pushService.registerDevice(
            user.getEmail(),
            request.getFcmToken(),
            request.getDeviceType() != null ? request.getDeviceType() : "Unknown",
            request.getPlatform() != null ? request.getPlatform() : "Unknown"
          );
          System.out.println("[AuthController] ✅ Device token enregistré pour: " + user.getEmail());
        } catch (Exception e) {
          // Ne pas bloquer la connexion si l'enregistrement échoue
          System.err.println("[AuthController] ⚠️ Erreur enregistrement token: " + e.getMessage());
        }
      }

      // 3. Générer le JWT et retourner la réponse
      String jwtToken = jwtTokenProvider.generateToken(user);
      
      LoginResponse response = new LoginResponse();
      response.setToken(jwtToken);
      response.setEmail(user.getEmail());
      response.setRole(user.getRole());
      response.setId(user.getId());
      
      return ResponseEntity.ok(response);
      
    } catch (Exception e) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
        .body(Map.of("message", "Email ou mot de passe incorrect"));
    }
  }
}
```

#### 3. Créer le PushNotificationDeviceService (si pas déjà fait)

Voir le code complet dans `PUSH_NOTIFICATIONS_BACKEND.md`.

---

### 🔄 Solution Alternative : Créer l'Endpoint Dédié

**Si vous ne voulez pas modifier le login**, créez l'endpoint :

```java
@PostMapping("/api/notifications/register-device")
public ResponseEntity<?> registerDevice(
  @RequestBody RegisterDeviceRequest request,
  @AuthenticationPrincipal UserDetails userDetails
) {
  try {
    PushNotificationDevice device = deviceService.registerDevice(
      userDetails.getUsername(),
      request.getExpoPushToken(),
      request.getDeviceType(),
      request.getPlatform()
    );
    
    return ResponseEntity.ok(Map.of(
      "message", "Device registered successfully",
      "data", device
    ));
  } catch (Exception e) {
    return ResponseEntity.badRequest()
      .body(Map.of("message", "Error registering device"));
  }
}
```

**MAIS** il faudra aussi modifier le frontend pour corriger le payload :

```typescript
// Dans pushNotificationService.ts
const payload = {
  expoPushToken: token,  // ✅ Garder seulement expoPushToken
  deviceType: Device.osVersion || 'Unknown',
  platform: Device.modelName || 'Unknown'
};
```

---

## 🧪 Comment Tester

### 1. Tester que le backend reçoit le token lors du login

**Backend - Ajouter des logs :**
```java
@PostMapping("/auth/login")
public ResponseEntity<?> login(@RequestBody LoginRequest request) {
  System.out.println("========================================");
  System.out.println("[AUTH] Email: " + request.getEmail());
  System.out.println("[AUTH] FCM Token reçu: " + request.getFcmToken());
  System.out.println("[AUTH] Device Type: " + request.getDeviceType());
  System.out.println("[AUTH] Platform: " + request.getPlatform());
  System.out.println("========================================");
  
  // ... reste du code
}
```

### 2. Tester depuis l'app mobile

Depuis l'app, connectez-vous et vérifiez les logs :

**Logs attendus côté frontend :**
```
[LoginScreen] 🔔 Récupération du push token...
[LoginScreen] Token obtenu: OUI ✅
[LoginScreen] 🔐 Tentative de connexion...
[authService.login] Tentative de connexion avec: { email: ... }
[API] Requête vers: /auth/login
[LoginScreen] ✅ Connexion réussie
```

**Logs attendus côté backend :**
```
[AUTH] Email: client@test.com
[AUTH] FCM Token reçu: ExponentPushToken[xxxxxx]
[AUTH] Device Type: iOS 16.0
[AUTH] Platform: iPhone 13
[AUTH] ✅ Device token enregistré
```

### 3. Vérifier en base de données

```sql
SELECT * FROM push_notification_devices 
WHERE user_id = (SELECT id FROM users WHERE email = 'client@test.com');
```

**Résultat attendu :**
```
id | user_id | expo_push_token      | device_type | platform | is_active | date_registered
---|---------|----------------------|-------------|----------|-----------|----------------
1  | 123     | ExponentPushToken[..] | iOS 16.0   | iPhone 13| true      | 2024-11-03...
```

---

## 📝 Checklist de Résolution

### Backend (Priorité 1 - Solution Recommandée)

- [ ] Modifier `LoginRequest.java` pour ajouter les champs `fcmToken`, `deviceType`, `platform`
- [ ] Modifier `AuthController.login()` pour appeler `pushService.registerDevice()`
- [ ] Vérifier que `PushNotificationDeviceService` existe (voir PUSH_NOTIFICATIONS_BACKEND.md)
- [ ] Vérifier que la table `push_notification_devices` existe
- [ ] Ajouter des logs pour tracer l'enregistrement
- [ ] Tester avec un client réel

### Backend (Alternative - Si vous préférez l'endpoint dédié)

- [ ] Créer l'endpoint `POST /api/notifications/register-device`
- [ ] Implémenter `RegisterDeviceRequest` DTO
- [ ] Implémenter `PushNotificationDeviceService`
- [ ] Tester l'endpoint avec curl

### Frontend (Si endpoint dédié créé)

- [ ] Modifier le payload dans `sendTokenToServer()` (retirer `fcmToken` en doublon)
- [ ] Garder seulement l'endpoint `/notifications/register-device`
- [ ] Retirer les endpoints de secours qui n'existent pas

---

## 🎯 Résumé Final

### Le Problème
Le token push est **envoyé** au backend lors du login mais **n'est pas sauvegardé** en base de données.

### La Cause
Le backend reçoit le `fcmToken` dans `/auth/login` mais ne fait rien avec (il est ignoré).

### La Solution (Recommandée)
Modifier le backend pour sauvegarder le token lors du login :
1. Ajouter les champs dans `LoginRequest`
2. Appeler `pushService.registerDevice()` dans `login()`
3. Le token est enregistré automatiquement à chaque connexion

### Avantages de cette Solution
✅ Simple et rapide à implémenter
✅ Pas besoin de nouvel endpoint
✅ Fonctionne dès la connexion
✅ Pas besoin de modifier le frontend
✅ Un seul appel API

---

## 🔗 Ressources

- Code complet du backend : `PUSH_NOTIFICATIONS_BACKEND.md`
- Tests curl : `PUSH_NOTIFICATIONS_CURL_EXAMPLES.md`
- Résumé des endpoints : `NOTIFICATIONS_BACKEND_ENDPOINTS.md`

---

**Date du diagnostic :** 3 novembre 2025
**Statut :** ❌ Token push non enregistré sur le backend
**Action requise :** Modifier le backend pour sauvegarder le token lors du login
