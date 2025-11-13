# 📡 API Endpoints - Interface Livreur

Documentation complète de tous les endpoints API utilisés par l'interface livreur d'EpicerieGo.

---

## 🔧 Configuration Générale

### URL de Base
```
Production: http://178.170.49.149:8090/api
Local Dev: http://localhost:8090/api
```

### Headers Requis
```bash
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

---

## 📋 Table des Endpoints

| # | Méthode | Endpoint | Description |
|---|---------|----------|-------------|
| 1 | GET | `/livreurs/my-deliveries` | Récupérer les livraisons |
| 2 | PUT | `/livreurs/availability` | Mettre en ligne/hors ligne |
| 3 | PUT | `/livreurs/location` | Mettre à jour la position GPS |
| 4 | PUT | `/livreurs/delivery/{orderId}/start` | Démarrer une livraison |
| 5 | PUT | `/livreurs/delivery/{orderId}/complete` | Compléter une livraison |

---

## 🔐 Authentification

**Tous les endpoints nécessitent un JWT Token valide.**

### Obtenir un Token

```bash
curl -X POST "http://178.170.49.149:8090/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "livreur@example.com",
    "password": "password123"
  }'
```

**Réponse (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": 1,
  "email": "livreur@example.com",
  "nom": "Ahmed Ben",
  "role": "LIVREUR",
  "livreurId": 5
}
```

---

## 📦 Endpoint 1: Récupérer les Livraisons

### Description
Récupère toutes les livraisons assignées au livreur connecté.

### Requête

```bash
curl -X GET "http://178.170.49.149:8090/api/livreurs/my-deliveries" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Avec Filtrage par Statut (Optionnel)

```bash
# Récupérer uniquement les livraisons en attente
curl -X GET "http://178.170.49.149:8090/api/livreurs/my-deliveries?status=pending" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Valeurs possibles pour status:
# - pending / en attente
# - in_progress / en cours
# - completed / complétée
# - cancelled / annulée
```

### Paramètres de Requête

| Paramètre | Type | Optionnel | Description |
|-----------|------|-----------|-------------|
| status | string | ✅ Oui | Filtrer par statut |

### Réponse (200 OK)

```json
[
  {
    "orderId": 123,
    "total": 250.50,
    "status": "pending",
    "adresseLivraison": "123 Rue de la Paix, Casablanca",
    "latitudeLivraison": 33.5731,
    "longitudeLivraison": -7.5898,
    "telephoneLivraison": "+212 6 12 34 56 78",
    "clientNom": "Ahmed Ben",
    "clientTelephone": "+212 6 12 34 56 78",
    "epicerieNom": "Épicerie du Centre",
    "nombreItems": 5,
    "createdAt": "2024-11-13T10:30:00Z"
  },
  {
    "orderId": 124,
    "total": 180.25,
    "status": "in_progress",
    "adresseLivraison": "456 Bd Mohammed V, Fès",
    "latitudeLivraison": 34.0309,
    "longitudeLivraison": -5.0075,
    "telephoneLivraison": "+212 6 98 76 54 32",
    "clientNom": "Fatima Smith",
    "clientTelephone": "+212 6 98 76 54 32",
    "epicerieNom": "Épicerie Halal",
    "nombreItems": 3,
    "createdAt": "2024-11-13T09:15:00Z"
  }
]
```

### Erreurs Possibles

**401 Unauthorized** - Token invalide ou expiré
```json
{
  "message": "Token invalide ou expiré"
}
```

**500 Internal Server Error**
```json
{
  "message": "Erreur serveur"
}
```

---

## 🟢 Endpoint 2: Mettre à Jour la Disponibilité

### Description
Change le statut du livreur (En ligne/Hors ligne) et met à jour sa position GPS.

### Requête

```bash
curl -X PUT "http://178.170.49.149:8090/api/livreurs/availability" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isAvailable": true,
    "latitude": 33.5731,
    "longitude": -7.5898
  }'
```

### Body Paramètres

| Paramètre | Type | Optionnel | Description |
|-----------|------|-----------|-------------|
| isAvailable | boolean | ❌ Non | Statut (true = en ligne, false = hors ligne) |
| latitude | number | ✅ Oui | Position GPS latitude |
| longitude | number | ✅ Oui | Position GPS longitude |

### Réponse (200 OK)

```json
{
  "message": "Disponibilité mise à jour avec succès"
}
```

### Exemples

**Se mettre en ligne avec position GPS:**
```bash
curl -X PUT "http://178.170.49.149:8090/api/livreurs/availability" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isAvailable": true,
    "latitude": 33.5731,
    "longitude": -7.5898
  }'
```

**Se mettre hors ligne:**
```bash
curl -X PUT "http://178.170.49.149:8090/api/livreurs/availability" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isAvailable": false
  }'
```

### Erreurs Possibles

**400 Bad Request** - Données invalides
```json
{
  "message": "isAvailable est requis"
}
```

**401 Unauthorized** - Token invalide
```json
{
  "message": "Token invalide ou expiré"
}
```

---

## 📍 Endpoint 3: Mettre à Jour la Position GPS

### Description
Met à jour uniquement la position GPS en temps réel du livreur.

### Requête

```bash
curl -X PUT "http://178.170.49.149:8090/api/livreurs/location" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 33.5731,
    "longitude": -7.5898
  }'
```

### Body Paramètres

| Paramètre | Type | Optionnel | Description |
|-----------|------|-----------|-------------|
| latitude | number | ❌ Non | Position GPS latitude |
| longitude | number | ❌ Non | Position GPS longitude |

### Réponse (200 OK)

```json
{
  "message": "Position mise à jour avec succès"
}
```

### Cas d'Usage
- Appelé régulièrement (toutes les 30 secondes) pour suivre la position en temps réel
- Utile pour afficher le livreur sur une carte
- Permet aux clients de suivre leur livraison

### Erreurs Possibles

**400 Bad Request** - Coordonnées invalides
```json
{
  "message": "Latitude et longitude sont requises et valides"
}
```

**401 Unauthorized** - Token invalide
```json
{
  "message": "Token invalide ou expiré"
}
```

---

## 🚀 Endpoint 4: Démarrer une Livraison

### Description
Marque une livraison comme en cours (change le statut pending → in_progress).

### Requête

```bash
curl -X PUT "http://178.170.49.149:8090/api/livreurs/delivery/123/start" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### URL Paramètres

| Paramètre | Type | Description |
|-----------|------|-------------|
| orderId | number | ID de la commande à démarrer |

### Réponse (200 OK)

```json
{
  "orderId": 123,
  "total": 250.50,
  "status": "in_progress",
  "adresseLivraison": "123 Rue de la Paix, Casablanca",
  "latitudeLivraison": 33.5731,
  "longitudeLivraison": -7.5898,
  "telephoneLivraison": "+212 6 12 34 56 78",
  "clientNom": "Ahmed Ben",
  "epicerieNom": "Épicerie du Centre",
  "nombreItems": 5,
  "createdAt": "2024-11-13T10:30:00Z"
}
```

### Exemples

**Démarrer la livraison #123:**
```bash
curl -X PUT "http://178.170.49.149:8090/api/livreurs/delivery/123/start" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Erreurs Possibles

**404 Not Found** - Livraison introuvable
```json
{
  "message": "Livraison non trouvée"
}
```

**400 Bad Request** - Statut invalide
```json
{
  "message": "Impossible de démarrer une livraison avec ce statut"
}
```

**401 Unauthorized** - Token invalide
```json
{
  "message": "Token invalide ou expiré"
}
```

---

## ✅ Endpoint 5: Compléter une Livraison

### Description
Marque une livraison comme complétée (change le statut in_progress → completed).

### Requête

```bash
curl -X PUT "http://178.170.49.149:8090/api/livreurs/delivery/123/complete" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### URL Paramètres

| Paramètre | Type | Description |
|-----------|------|-------------|
| orderId | number | ID de la commande à compléter |

### Réponse (200 OK)

```json
{
  "orderId": 123,
  "total": 250.50,
  "status": "completed",
  "adresseLivraison": "123 Rue de la Paix, Casablanca",
  "latitudeLivraison": 33.5731,
  "longitudeLivraison": -7.5898,
  "telephoneLivraison": "+212 6 12 34 56 78",
  "clientNom": "Ahmed Ben",
  "epicerieNom": "Épicerie du Centre",
  "nombreItems": 5,
  "createdAt": "2024-11-13T10:30:00Z"
}
```

### Exemples

**Compléter la livraison #123:**
```bash
curl -X PUT "http://178.170.49.149:8090/api/livreurs/delivery/123/complete" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Erreurs Possibles

**404 Not Found** - Livraison introuvable
```json
{
  "message": "Livraison non trouvée"
}
```

**400 Bad Request** - Statut invalide
```json
{
  "message": "Impossible de compléter une livraison avec ce statut"
}
```

**401 Unauthorized** - Token invalide
```json
{
  "message": "Token invalide ou expiré"
}
```

---

## 🧪 Exemple de Test Complet

Script bash pour tester tous les endpoints:

```bash
#!/bin/bash

# Configuration
BASE_URL="http://178.170.49.149:8090/api"
EMAIL="livreur@example.com"
PASSWORD="password123"

echo "🚀 EpicerieGo - Test Endpoints Livreur"
echo "======================================"

# 1. Authentification
echo -e "\n1️⃣ AUTHENTIFICATION"
echo "-------------------"
AUTH_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

TOKEN=$(echo $AUTH_RESPONSE | jq -r '.token')
echo "Token obtenu: ${TOKEN:0:50}..."

if [ "$TOKEN" == "null" ]; then
  echo "❌ Erreur d'authentification"
  exit 1
fi

# 2. Récupérer les livraisons
echo -e "\n2️⃣ RÉCUPÉRER LES LIVRAISONS"
echo "----------------------------"
curl -s -X GET "$BASE_URL/livreurs/my-deliveries" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'

# 3. Se mettre en ligne
echo -e "\n3️⃣ MISE EN LIGNE"
echo "----------------"
curl -s -X PUT "$BASE_URL/livreurs/availability" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isAvailable": true,
    "latitude": 33.5731,
    "longitude": -7.5898
  }' | jq '.'

# 4. Mettre à jour la position GPS
echo -e "\n4️⃣ MISE À JOUR POSITION GPS"
echo "---------------------------"
curl -s -X PUT "$BASE_URL/livreurs/location" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 33.5750,
    "longitude": -7.5920
  }' | jq '.'

# 5. Démarrer une livraison (remplacer 123 par un ID réel)
echo -e "\n5️⃣ DÉMARRER LIVRAISON"
echo "---------------------"
curl -s -X PUT "$BASE_URL/livreurs/delivery/123/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'

# 6. Compléter une livraison (remplacer 123 par un ID réel)
echo -e "\n6️⃣ COMPLÉTER LIVRAISON"
echo "---------------------"
curl -s -X PUT "$BASE_URL/livreurs/delivery/123/complete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'

echo -e "\n✅ Test terminé"
```

**Utilisation:**
```bash
chmod +x test_livreur_api.sh
./test_livreur_api.sh
```

---

## 📊 Modèles de Données

### Delivery Object

```typescript
interface Delivery {
  orderId: number;
  total: number;
  status: string;                    // pending, in_progress, completed, cancelled
  adresseLivraison: string;
  latitudeLivraison?: number;
  longitudeLivraison?: number;
  telephoneLivraison?: string;
  clientNom: string;
  clientTelephone?: string;
  epicerieNom: string;
  nombreItems: number;
  createdAt: string;                 // ISO 8601 format
}
```

### Availability Request

```typescript
interface AvailabilityRequest {
  isAvailable: boolean;
  latitude?: number;
  longitude?: number;
}
```

### Location Request

```typescript
interface LocationRequest {
  latitude: number;
  longitude: number;
}
```

### Generic Response

```typescript
interface Response<T> {
  data?: T;
  message?: string;
  error?: string;
}
```

---

## 🔄 Flux de Travail Typique

```
1. Authentification → Obtenir JWT Token
   POST /auth/login

2. Se connecter en tant que livreur
   PUT /livreurs/availability { isAvailable: true }

3. Récupérer les livraisons assignées
   GET /livreurs/my-deliveries

4. Pour chaque livraison:
   a. Mettre à jour la position GPS régulièrement
      PUT /livreurs/location { latitude, longitude }

   b. Démarrer la livraison
      PUT /livreurs/delivery/{orderId}/start

   c. Compléter la livraison
      PUT /livreurs/delivery/{orderId}/complete

5. Se déconnecter
   PUT /livreurs/availability { isAvailable: false }
```

---

## ⚠️ Codes de Statut HTTP

| Code | Signification | Description |
|------|---------------|-------------|
| 200 | OK | Requête réussie |
| 201 | Created | Ressource créée |
| 400 | Bad Request | Données invalides |
| 401 | Unauthorized | Token invalide ou expiré |
| 403 | Forbidden | Accès refusé |
| 404 | Not Found | Ressource non trouvée |
| 500 | Server Error | Erreur serveur |

---

## 🎯 Points Importants

✅ **À faire:**
- Toujours inclure le token JWT dans le header Authorization
- Valider les coordonnées GPS (latitude entre -90 et 90, longitude entre -180 et 180)
- Mettre à jour la position GPS régulièrement (toutes les 30 secondes)
- Gérer les erreurs 401 en redirigeant vers la login

❌ **À éviter:**
- Ne pas exposer le token dans les logs
- Ne pas oublier le header Content-Type: application/json
- Ne pas envoyer des coordonnées invalides
- Ne pas laisser le token expirer sans se reconnecter

---

## 📝 Notes de Développement

- Le livreur doit être authentifié et avoir le rôle `LIVREUR`
- Les timestamps sont en format ISO 8601
- Les statuts de livraison sont: pending, in_progress, completed, cancelled
- La position GPS est optionnelle mais recommandée pour le suivi en temps réel
- Les coordonnées GPS doivent être en format WGS84 (latitude/longitude décimales)

---

**Dernière mise à jour:** 13 novembre 2024
**Version API:** 1.0.0
**Interface Frontend:** React Native / Expo
