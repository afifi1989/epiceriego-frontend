# 🚀 Guide d'Implémentation Backend - Espace Livreur

Documentation complète pour implémenter les 5 endpoints backend utilisés par l'interface livreur.

---

## 📡 Endpoints à Implémenter

| # | Méthode | Endpoint | Description |
|---|---------|----------|-------------|
| 1 | **GET** | `/livreurs/my-deliveries` | Récupérer les livraisons du livreur |
| 2 | **PUT** | `/livreurs/availability` | Mettre en ligne/hors ligne |
| 3 | **PUT** | `/livreurs/location` | Mettre à jour la position GPS |
| 4 | **PUT** | `/livreurs/delivery/{orderId}/start` | Démarrer une livraison |
| 5 | **PUT** | `/livreurs/delivery/{orderId}/complete` | Compléter une livraison |

---

## 1️⃣ GET /livreurs/my-deliveries

### Description
Récupère toutes les livraisons assignées au livreur connecté.

### CURL

```bash
# Sans filtre (toutes les livraisons)
curl -X GET "http://localhost:8090/api/livreurs/my-deliveries" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Avec filtre par statut
curl -X GET "http://localhost:8090/api/livreurs/my-deliveries?status=pending" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Paramètres Query

| Paramètre | Type | Optionnel | Description |
|-----------|------|-----------|-------------|
| status | string | ✅ Oui | pending, in_progress, completed, cancelled |

### Backend (Spring Boot / Node.js)

**Spring Boot:**
```java
@GetMapping("/my-deliveries")
public ResponseEntity<List<DeliveryDTO>> getMyDeliveries(
    @RequestParam(required = false) String status,
    @AuthenticationPrincipal User user) {

    List<Delivery> deliveries;

    if (status != null && !status.isEmpty()) {
        deliveries = deliveryRepository.findByLivreurIdAndStatus(
            user.getId(),
            DeliveryStatus.valueOf(status.toUpperCase())
        );
    } else {
        deliveries = deliveryRepository.findByLivreurId(user.getId());
    }

    List<DeliveryDTO> result = deliveries.stream()
        .map(this::toDTO)
        .collect(Collectors.toList());

    return ResponseEntity.ok(result);
}

private DeliveryDTO toDTO(Delivery delivery) {
    return DeliveryDTO.builder()
        .orderId(delivery.getId())
        .total(delivery.getTotal())
        .status(delivery.getStatus().toString())
        .adresseLivraison(delivery.getAdresseLivraison())
        .latitudeLivraison(delivery.getLatitudeLivraison())
        .longitudeLivraison(delivery.getLongitudeLivraison())
        .telephoneLivraison(delivery.getTelephoneLivraison())
        .clientNom(delivery.getClient().getNom())
        .clientTelephone(delivery.getClient().getTelephone())
        .epicerieNom(delivery.getEpicerie().getNom())
        .nombreItems(delivery.getItems().size())
        .createdAt(delivery.getCreatedAt())
        .build();
}
```

**Node.js/Express:**
```javascript
router.get('/my-deliveries', authMiddleware, async (req, res) => {
    try {
        const { status } = req.query;
        const livreurId = req.user.id;

        let query = { livreurId };
        if (status) {
            query.status = status.toUpperCase();
        }

        const deliveries = await Delivery.find(query)
            .populate('client', 'nom telephone')
            .populate('epicerie', 'nomEpicerie')
            .sort({ createdAt: -1 });

        const result = deliveries.map(d => ({
            orderId: d._id,
            total: d.total,
            status: d.status,
            adresseLivraison: d.adresseLivraison,
            latitudeLivraison: d.latitudeLivraison,
            longitudeLivraison: d.longitudeLivraison,
            telephoneLivraison: d.telephoneLivraison,
            clientNom: d.client.nom,
            clientTelephone: d.client.telephone,
            epicerieNom: d.epicerie.nomEpicerie,
            nombreItems: d.items.length,
            createdAt: d.createdAt
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
```

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
  }
]
```

---

## 2️⃣ PUT /livreurs/availability

### Description
Change le statut du livreur (En ligne/Hors ligne) et met à jour sa position GPS.

### CURL

```bash
curl -X PUT "http://localhost:8090/api/livreurs/availability" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isAvailable": true,
    "latitude": 33.5731,
    "longitude": -7.5898
  }'
```

### Body

| Champ | Type | Optionnel | Description |
|-------|------|-----------|-------------|
| isAvailable | boolean | ❌ Non | true = en ligne, false = hors ligne |
| latitude | number | ✅ Oui | Position GPS |
| longitude | number | ✅ Oui | Position GPS |

### Backend

**Spring Boot:**
```java
@PutMapping("/availability")
public ResponseEntity<Map<String, String>> updateAvailability(
    @RequestBody AvailabilityRequest request,
    @AuthenticationPrincipal User user) {

    Livreur livreur = livreurRepository.findById(user.getId())
        .orElseThrow(() -> new NotFoundException("Livreur non trouvé"));

    livreur.setIsAvailable(request.isAvailable());

    if (request.getLatitude() != null && request.getLongitude() != null) {
        livreur.setLatitude(request.getLatitude());
        livreur.setLongitude(request.getLongitude());
    }

    livreur.setLastLocationUpdate(LocalDateTime.now());
    livreurRepository.save(livreur);

    return ResponseEntity.ok(Map.of(
        "message", "Disponibilité mise à jour avec succès"
    ));
}
```

**Node.js/Express:**
```javascript
router.put('/availability', authMiddleware, async (req, res) => {
    try {
        const { isAvailable, latitude, longitude } = req.body;

        if (isAvailable === undefined) {
            return res.status(400).json({ message: "isAvailable est requis" });
        }

        const livreur = await Livreur.findById(req.user.id);
        if (!livreur) {
            return res.status(404).json({ message: "Livreur non trouvé" });
        }

        livreur.isAvailable = isAvailable;
        if (latitude && longitude) {
            livreur.latitude = latitude;
            livreur.longitude = longitude;
        }
        livreur.lastLocationUpdate = new Date();

        await livreur.save();

        res.json({ message: "Disponibilité mise à jour avec succès" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
```

### Réponse (200 OK)

```json
{
  "message": "Disponibilité mise à jour avec succès"
}
```

---

## 3️⃣ PUT /livreurs/location

### Description
Met à jour uniquement la position GPS du livreur en temps réel.

### CURL

```bash
curl -X PUT "http://localhost:8090/api/livreurs/location" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 33.5731,
    "longitude": -7.5898
  }'
```

### Body

| Champ | Type | Optionnel | Description |
|-------|------|-----------|-------------|
| latitude | number | ❌ Non | Position GPS latitude (-90 à 90) |
| longitude | number | ❌ Non | Position GPS longitude (-180 à 180) |

### Backend

**Spring Boot:**
```java
@PutMapping("/location")
public ResponseEntity<Map<String, String>> updateLocation(
    @RequestBody LocationRequest request,
    @AuthenticationPrincipal User user) {

    if (request.getLatitude() < -90 || request.getLatitude() > 90) {
        return ResponseEntity.badRequest().body(Map.of(
            "message", "Latitude invalide"
        ));
    }

    if (request.getLongitude() < -180 || request.getLongitude() > 180) {
        return ResponseEntity.badRequest().body(Map.of(
            "message", "Longitude invalide"
        ));
    }

    Livreur livreur = livreurRepository.findById(user.getId())
        .orElseThrow(() -> new NotFoundException("Livreur non trouvé"));

    livreur.setLatitude(request.getLatitude());
    livreur.setLongitude(request.getLongitude());
    livreur.setLastLocationUpdate(LocalDateTime.now());
    livreurRepository.save(livreur);

    return ResponseEntity.ok(Map.of(
        "message", "Position mise à jour avec succès"
    ));
}
```

**Node.js/Express:**
```javascript
router.put('/location', authMiddleware, async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({
                message: "Latitude et longitude sont requises"
            });
        }

        if (latitude < -90 || latitude > 90) {
            return res.status(400).json({ message: "Latitude invalide" });
        }

        if (longitude < -180 || longitude > 180) {
            return res.status(400).json({ message: "Longitude invalide" });
        }

        const livreur = await Livreur.findByIdAndUpdate(
            req.user.id,
            {
                latitude,
                longitude,
                lastLocationUpdate: new Date()
            },
            { new: true }
        );

        if (!livreur) {
            return res.status(404).json({ message: "Livreur non trouvé" });
        }

        res.json({ message: "Position mise à jour avec succès" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
```

### Réponse (200 OK)

```json
{
  "message": "Position mise à jour avec succès"
}
```

---

## 4️⃣ PUT /livreurs/delivery/{orderId}/start

### Description
Marque une livraison comme en cours (pending → in_progress).

### CURL

```bash
curl -X PUT "http://localhost:8090/api/livreurs/delivery/123/start" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### URL Parameters

| Paramètre | Type | Description |
|-----------|------|-------------|
| orderId | number | ID de la commande |

### Backend

**Spring Boot:**
```java
@PutMapping("/delivery/{orderId}/start")
public ResponseEntity<?> startDelivery(
    @PathVariable Long orderId,
    @AuthenticationPrincipal User user) {

    Delivery delivery = deliveryRepository.findById(orderId)
        .orElseThrow(() -> new NotFoundException("Livraison non trouvée"));

    // Vérifier que le livreur est assigné à cette livraison
    if (!delivery.getLivreur().getId().equals(user.getId())) {
        return ResponseEntity.status(403).body(Map.of(
            "message", "Vous n'êtes pas autorisé à accéder cette livraison"
        ));
    }

    // Vérifier le statut actuel
    if (!delivery.getStatus().equals(DeliveryStatus.PENDING)) {
        return ResponseEntity.badRequest().body(Map.of(
            "message", "Impossible de démarrer une livraison avec ce statut"
        ));
    }

    delivery.setStatus(DeliveryStatus.IN_PROGRESS);
    delivery.setStartedAt(LocalDateTime.now());
    deliveryRepository.save(delivery);

    return ResponseEntity.ok(toDeliveryDTO(delivery));
}
```

**Node.js/Express:**
```javascript
router.put('/delivery/:orderId/start', authMiddleware, async (req, res) => {
    try {
        const { orderId } = req.params;

        const delivery = await Delivery.findById(orderId)
            .populate('client', 'nom telephone')
            .populate('epicerie', 'nomEpicerie')
            .populate('livreur', 'id');

        if (!delivery) {
            return res.status(404).json({ message: "Livraison non trouvée" });
        }

        // Vérifier que le livreur est assigné
        if (delivery.livreur._id.toString() !== req.user.id) {
            return res.status(403).json({
                message: "Non autorisé à accéder cette livraison"
            });
        }

        // Vérifier le statut
        if (delivery.status !== 'PENDING') {
            return res.status(400).json({
                message: "Impossible de démarrer une livraison avec ce statut"
            });
        }

        delivery.status = 'IN_PROGRESS';
        delivery.startedAt = new Date();
        await delivery.save();

        res.json({
            orderId: delivery._id,
            total: delivery.total,
            status: delivery.status,
            adresseLivraison: delivery.adresseLivraison,
            latitudeLivraison: delivery.latitudeLivraison,
            longitudeLivraison: delivery.longitudeLivraison,
            telephoneLivraison: delivery.telephoneLivraison,
            clientNom: delivery.client.nom,
            epicerieNom: delivery.epicerie.nomEpicerie,
            nombreItems: delivery.items.length,
            createdAt: delivery.createdAt
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
```

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

---

## 5️⃣ PUT /livreurs/delivery/{orderId}/complete

### Description
Marque une livraison comme complétée (in_progress → completed).

### CURL

```bash
curl -X PUT "http://localhost:8090/api/livreurs/delivery/123/complete" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### URL Parameters

| Paramètre | Type | Description |
|-----------|------|-------------|
| orderId | number | ID de la commande |

### Backend

**Spring Boot:**
```java
@PutMapping("/delivery/{orderId}/complete")
public ResponseEntity<?> completeDelivery(
    @PathVariable Long orderId,
    @AuthenticationPrincipal User user) {

    Delivery delivery = deliveryRepository.findById(orderId)
        .orElseThrow(() -> new NotFoundException("Livraison non trouvée"));

    // Vérifier que le livreur est assigné
    if (!delivery.getLivreur().getId().equals(user.getId())) {
        return ResponseEntity.status(403).body(Map.of(
            "message", "Vous n'êtes pas autorisé à accéder cette livraison"
        ));
    }

    // Vérifier le statut
    if (!delivery.getStatus().equals(DeliveryStatus.IN_PROGRESS)) {
        return ResponseEntity.badRequest().body(Map.of(
            "message", "Impossible de compléter une livraison avec ce statut"
        ));
    }

    delivery.setStatus(DeliveryStatus.COMPLETED);
    delivery.setCompletedAt(LocalDateTime.now());
    deliveryRepository.save(delivery);

    // Mettre à jour les statistiques du livreur
    Livreur livreur = delivery.getLivreur();
    livreur.setTotalDeliveries(livreur.getTotalDeliveries() + 1);
    livreurRepository.save(livreur);

    return ResponseEntity.ok(toDeliveryDTO(delivery));
}
```

**Node.js/Express:**
```javascript
router.put('/delivery/:orderId/complete', authMiddleware, async (req, res) => {
    try {
        const { orderId } = req.params;

        const delivery = await Delivery.findById(orderId)
            .populate('client', 'nom telephone')
            .populate('epicerie', 'nomEpicerie')
            .populate('livreur', 'id');

        if (!delivery) {
            return res.status(404).json({ message: "Livraison non trouvée" });
        }

        // Vérifier que le livreur est assigné
        if (delivery.livreur._id.toString() !== req.user.id) {
            return res.status(403).json({
                message: "Non autorisé à accéder cette livraison"
            });
        }

        // Vérifier le statut
        if (delivery.status !== 'IN_PROGRESS') {
            return res.status(400).json({
                message: "Impossible de compléter une livraison avec ce statut"
            });
        }

        delivery.status = 'COMPLETED';
        delivery.completedAt = new Date();
        await delivery.save();

        // Mettre à jour les stats du livreur
        const livreur = await Livreur.findById(req.user.id);
        livreur.totalDeliveries = (livreur.totalDeliveries || 0) + 1;
        await livreur.save();

        res.json({
            orderId: delivery._id,
            total: delivery.total,
            status: delivery.status,
            adresseLivraison: delivery.adresseLivraison,
            latitudeLivraison: delivery.latitudeLivraison,
            longitudeLivraison: delivery.longitudeLivraison,
            telephoneLivraison: delivery.telephoneLivraison,
            clientNom: delivery.client.nom,
            epicerieNom: delivery.epicerie.nomEpicerie,
            nombreItems: delivery.items.length,
            createdAt: delivery.createdAt
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
```

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

---

## 🛠️ Modèles de Base de Données

### Livreur Entity/Model

**Spring Boot JPA:**
```java
@Entity
@Table(name = "livreurs")
public class Livreur {
    @Id
    private Long id;

    @Column(nullable = false)
    private String nom;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private String telephone;

    @Column
    private String adresse;

    @Column
    private Double latitude;

    @Column
    private Double longitude;

    @Column(nullable = false)
    private Boolean isAvailable = false;

    @Column
    private LocalDateTime lastLocationUpdate;

    @Column
    private Integer totalDeliveries = 0;

    @Column
    private Double rating = 0.0;

    @Column(nullable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;
}
```

**MongoDB Schema (Node.js):**
```javascript
const livreurSchema = new Schema({
    nom: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    telephone: { type: String, required: true },
    adresse: String,
    latitude: Number,
    longitude: Number,
    isAvailable: { type: Boolean, default: false },
    lastLocationUpdate: Date,
    totalDeliveries: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});
```

### Delivery Entity/Model

**Spring Boot JPA:**
```java
@Entity
@Table(name = "deliveries")
public class Delivery {
    @Id
    private Long id;

    @ManyToOne
    @JoinColumn(name = "order_id")
    private Order order;

    @ManyToOne
    @JoinColumn(name = "livreur_id")
    private Livreur livreur;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DeliveryStatus status = DeliveryStatus.PENDING;

    @Column
    private String adresseLivraison;

    @Column
    private Double latitudeLivraison;

    @Column
    private Double longitudeLivraison;

    @Column
    private String telephoneLivraison;

    @Column
    private Double total;

    @Column
    private LocalDateTime startedAt;

    @Column
    private LocalDateTime completedAt;

    @Column(nullable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;
}

enum DeliveryStatus {
    PENDING, IN_PROGRESS, COMPLETED, CANCELLED
}
```

**MongoDB Schema (Node.js):**
```javascript
const deliverySchema = new Schema({
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    livreurId: { type: Schema.Types.ObjectId, ref: 'Livreur' },
    status: {
        type: String,
        enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
        default: 'PENDING'
    },
    adresseLivraison: String,
    latitudeLivraison: Number,
    longitudeLivraison: Number,
    telephoneLivraison: String,
    total: Number,
    items: [{ type: Schema.Types.ObjectId, ref: 'OrderItem' }],
    startedAt: Date,
    completedAt: Date,
    createdAt: { type: Date, default: Date.now }
});
```

---

## 🔒 Middleware d'Authentification

**Spring Boot:**
```java
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                   HttpServletResponse response,
                                   FilterChain filterChain) throws ServletException, IOException {

        String token = getTokenFromRequest(request);

        if (token != null && validateToken(token)) {
            String userId = getUserIdFromToken(token);
            UserDetails userDetails = userDetailsService.loadUserById(userId);

            Authentication auth = new UsernamePasswordAuthenticationToken(
                userDetails, null, userDetails.getAuthorities()
            );
            SecurityContextHolder.getContext().setAuthentication(auth);
        }

        filterChain.doFilter(request, response);
    }

    private String getTokenFromRequest(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }
}
```

**Node.js/Express:**
```javascript
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: "Token manquant" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: "Token invalide" });
    }
};
```

---

## 📊 Structure de Réponse Standard

### Success (200)
```json
{
  "orderId": 123,
  "total": 250.50,
  "status": "completed",
  ...
}
```

### Error (400/401/403/404/500)
```json
{
  "message": "Description de l'erreur"
}
```

---

## 🧪 Script de Test Complet

```bash
#!/bin/bash

BASE_URL="http://localhost:8090/api"

# 1. Login pour obtenir le token
TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "livreur@example.com",
    "password": "password123"
  }' | jq -r '.token')

echo "✅ Token obtenu"

# 2. Se mettre en ligne
curl -X PUT "$BASE_URL/livreurs/availability" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isAvailable": true,
    "latitude": 33.5731,
    "longitude": -7.5898
  }' | jq

echo "✅ Livreur en ligne"

# 3. Récupérer les livraisons
curl -X GET "$BASE_URL/livreurs/my-deliveries" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq

echo "✅ Livraisons récupérées"

# 4. Démarrer une livraison
curl -X PUT "$BASE_URL/livreurs/delivery/123/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq

echo "✅ Livraison démarrée"

# 5. Mettre à jour la position
curl -X PUT "$BASE_URL/livreurs/location" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 33.5750,
    "longitude": -7.5920
  }' | jq

echo "✅ Position mise à jour"

# 6. Compléter la livraison
curl -X PUT "$BASE_URL/livreurs/delivery/123/complete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq

echo "✅ Livraison complétée"
```

---

**Dernière mise à jour:** 14 novembre 2024
**Status:** ✅ PRÊT POUR IMPLÉMENTATION
