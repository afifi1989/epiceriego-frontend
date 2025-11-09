# Backend Requirements - Système de Profil Épicier

## 📋 Vue d'Ensemble

Ce document énumère tous les changements nécessaires côté backend pour supporter les 4 fonctionnalités du système de profil épicier implémenté en frontend.

---

## 1️⃣ Photo de Profil

### 📊 Modification du Modèle Epicerie

**Ajouter le champ:**
```java
@Entity
@Table(name = "epiceries")
public class Epicerie {
    // ... autres champs existants

    @Column(name = "photo_url", columnDefinition = "TEXT")
    private String photoUrl;  // ← NEW: URL de la photo uploadée

    // ... getters/setters
}
```

### 🔧 Endpoint Nouveau: Upload Photo

**POST /api/epiceries/my-epicerie/photo**

**Description:** Upload la photo de profil de l'épicerie connectée

**Authentication:** ✅ Required (JWT Bearer token)

**Content-Type:** `multipart/form-data`

**Request Body:**
```
Form Data:
  - photo: File (image/jpeg ou image/png)
```

**Response (201 Created / 200 OK):**
```json
{
  "id": 1,
  "nomEpicerie": "Ma Boutique",
  "photoUrl": "https://storage.example.com/epiceries/1/profile-photo.jpg",
  "adresse": "123 rue de la Paix",
  "telephone": "0123456789",
  // ... autres champs
}
```

**Validations:**
```java
@PostMapping("/my-epicerie/photo")
public ResponseEntity<Epicerie> uploadProfilePhoto(
    @RequestParam("photo") MultipartFile file,
    @AuthenticationPrincipal UserDetails userDetails
) throws IOException {
    // 1. Vérifier que l'utilisateur est un EPICIER
    User user = userRepository.findByEmail(userDetails.getUsername());
    if (!user.getRole().equals("EPICIER")) {
        throw new ForbiddenException("Seuls les épiciers peuvent upload une photo");
    }

    // 2. Récupérer l'épicerie de l'utilisateur
    Epicerie epicerie = epicerieRepository.findByUserId(user.getId())
        .orElseThrow(() -> new ResourceNotFoundException("Épicerie non trouvée"));

    // 3. Valider le fichier
    if (file.isEmpty()) {
        throw new BadRequestException("Le fichier ne peut pas être vide");
    }

    String contentType = file.getContentType();
    if (!contentType.equals("image/jpeg") && !contentType.equals("image/png")) {
        throw new BadRequestException("Seules les images JPEG et PNG sont acceptées");
    }

    if (file.getSize() > 5 * 1024 * 1024) {  // 5MB max
        throw new BadRequestException("La taille de l'image ne doit pas dépasser 5MB");
    }

    // 4. Sauvegarder l'image
    String photoUrl = storageService.saveEpiceriePhoto(
        epicerie.getId(),
        file.getInputStream(),
        contentType
    );
    // Ou utiliser: S3Service, CloudinaryService, etc.

    // 5. Mettre à jour l'épicerie
    epicerie.setPhotoUrl(photoUrl);
    epicerie.setUpdatedAt(LocalDateTime.now());
    epicerieRepository.save(epicerie);

    return ResponseEntity.ok(epicerie);
}
```

**Implémentation du StorageService (exemple disque local):**
```java
@Service
public class StorageService {

    private static final String UPLOAD_DIR = "/uploads/epiceries/photos/";

    public String saveEpiceriePhoto(Long epicerieId, InputStream fileStream, String contentType)
            throws IOException {

        // Créer le répertoire s'il n'existe pas
        Path uploadPath = Paths.get(UPLOAD_DIR + epicerieId);
        Files.createDirectories(uploadPath);

        // Générer un nom de fichier unique
        String filename = "profile-" + System.currentTimeMillis() +
                         (contentType.equals("image/jpeg") ? ".jpg" : ".png");

        Path filePath = uploadPath.resolve(filename);

        // Sauvegarder le fichier
        Files.copy(fileStream, filePath, StandardCopyOption.REPLACE_EXISTING);

        // Retourner l'URL accessible
        return "/uploads/epiceries/photos/" + epicerieId + "/" + filename;
    }
}
```

**Gestion des erreurs:**
```java
@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<ErrorResponse> handleBadRequest(BadRequestException ex) {
        return ResponseEntity.badRequest().body(
            new ErrorResponse("BAD_REQUEST", ex.getMessage())
        );
    }

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ErrorResponse> handleForbidden(ForbiddenException ex) {
        return ResponseEntity.status(403).body(
            new ErrorResponse("FORBIDDEN", ex.getMessage())
        );
    }
}
```

---

## 2️⃣ Horaires d'Ouverture

### 📊 Modification du Modèle Epicerie

**Ajouter le champ:**
```java
@Entity
@Table(name = "epiceries")
public class Epicerie {
    // ... autres champs existants

    @Column(name = "horaires", columnDefinition = "LONGTEXT")
    private String horaires;  // ← NEW: JSON string avec horaires

    // ... getters/setters
}
```

**Structure JSON stockée:**
```json
{
  "lundi": {
    "isOpen": true,
    "openTime": "08:00",
    "closeTime": "20:00"
  },
  "mardi": {
    "isOpen": true,
    "openTime": "08:00",
    "closeTime": "20:00"
  },
  "mercredi": {
    "isOpen": true,
    "openTime": "08:00",
    "closeTime": "20:00"
  },
  "jeudi": {
    "isOpen": true,
    "openTime": "08:00",
    "closeTime": "20:00"
  },
  "vendredi": {
    "isOpen": true,
    "openTime": "08:00",
    "closeTime": "20:00"
  },
  "samedi": {
    "isOpen": true,
    "openTime": "09:00",
    "closeTime": "20:00"
  },
  "dimanche": {
    "isOpen": false,
    "openTime": "00:00",
    "closeTime": "00:00"
  }
}
```

### 🔧 Modification du DTO EpicerieUpdateRequest

```java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EpicerieUpdateRequest {

    private String nomEpicerie;
    private String description;
    private String adresse;
    private Double latitude;
    private Double longitude;
    private String telephonePro;
    private String telephonePersonnel;
    private String nomGerant;
    private String prenomGerant;
    private String emailGerant;

    @JsonProperty("horaires")  // ← NEW
    private String horaires;   // JSON string

    // ... getters/setters
}
```

### 🔧 Modification du Controller

```java
@PutMapping("/my-epicerie")
public ResponseEntity<Epicerie> updateMyEpicerie(
    @RequestBody EpicerieUpdateRequest request,
    @AuthenticationPrincipal UserDetails userDetails
) {
    User user = userRepository.findByEmail(userDetails.getUsername());
    Epicerie epicerie = epicerieRepository.findByUserId(user.getId())
        .orElseThrow(() -> new ResourceNotFoundException("Épicerie non trouvée"));

    // Mettre à jour les champs
    if (request.getNomEpicerie() != null) {
        epicerie.setNomEpicerie(request.getNomEpicerie());
    }
    if (request.getAdresse() != null) {
        epicerie.setAdresse(request.getAdresse());
    }
    // ... autres champs

    // NEW: Valider et stocker les horaires
    if (request.getHoraires() != null) {
        validateHoraires(request.getHoraires());  // Voir validation ci-dessous
        epicerie.setHoraires(request.getHoraires());
    }

    epicerie.setUpdatedAt(LocalDateTime.now());
    epicerieRepository.save(epicerie);

    return ResponseEntity.ok(epicerie);
}

private void validateHoraires(String horaireJson) {
    try {
        ObjectMapper mapper = new ObjectMapper();
        JsonNode root = mapper.readTree(horaireJson);

        String[] days = {"lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"};

        for (String day : days) {
            if (!root.has(day)) {
                throw new BadRequestException("Jour manquant: " + day);
            }

            JsonNode dayObj = root.get(day);

            if (!dayObj.has("isOpen") || !dayObj.has("openTime") || !dayObj.has("closeTime")) {
                throw new BadRequestException("Structure invalide pour " + day);
            }

            // Validation format HH:MM
            String openTime = dayObj.get("openTime").asText();
            String closeTime = dayObj.get("closeTime").asText();

            if (!openTime.matches("\\d{2}:\\d{2}")) {
                throw new BadRequestException("Format openTime invalide: " + openTime);
            }

            if (!closeTime.matches("\\d{2}:\\d{2}")) {
                throw new BadRequestException("Format closeTime invalide: " + closeTime);
            }

            // Validation: closeTime > openTime si jour ouvert
            if (dayObj.get("isOpen").asBoolean()) {
                int openMinutes = Integer.parseInt(openTime.split(":")[0]) * 60 +
                                Integer.parseInt(openTime.split(":")[1]);
                int closeMinutes = Integer.parseInt(closeTime.split(":")[0]) * 60 +
                                 Integer.parseInt(closeTime.split(":")[1]);

                if (closeMinutes <= openMinutes) {
                    throw new BadRequestException(
                        "Heure de fermeture doit être après l'ouverture pour " + day
                    );
                }
            }
        }
    } catch (JsonProcessingException e) {
        throw new BadRequestException("Format JSON des horaires invalide: " + e.getMessage());
    }
}
```

### 🔍 Migration de la Base de Données (SQL)

```sql
-- Pour PostgreSQL
ALTER TABLE epiceries ADD COLUMN horaires TEXT;

-- Pour MySQL
ALTER TABLE epiceries ADD COLUMN horaires LONGTEXT;

-- Pour H2 (tests)
ALTER TABLE epiceries ADD COLUMN horaires VARCHAR(4000);
```

---

## 3️⃣ Zones de Livraison

### 📊 Modification du Modèle Epicerie

**Ajouter le champ:**
```java
@Entity
@Table(name = "epiceries")
public class Epicerie {
    // ... autres champs existants

    @Column(name = "delivery_zones", columnDefinition = "LONGTEXT")
    private String deliveryZones;  // ← NEW: JSON string avec zones

    // ... getters/setters
}
```

**Structure JSON stockée:**
```json
[
  {
    "id": "1",
    "name": "Zone proche (0-2km)",
    "deliveryFee": 0,
    "maxDistance": 2,
    "estimatedTime": "15-20 min",
    "isActive": true
  },
  {
    "id": "2",
    "name": "Zone standard (2-5km)",
    "deliveryFee": 2.5,
    "maxDistance": 5,
    "estimatedTime": "25-35 min",
    "isActive": true
  },
  {
    "id": "3",
    "name": "Zone étendue (5-10km)",
    "deliveryFee": 5.0,
    "maxDistance": 10,
    "estimatedTime": "40-50 min",
    "isActive": false
  }
]
```

### 🔧 Modification du DTO EpicerieUpdateRequest

```java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EpicerieUpdateRequest {

    // ... champs existants

    @JsonProperty("deliveryZones")  // ← NEW
    private String deliveryZones;   // JSON array string

    // ... getters/setters
}
```

### 🔧 Modification du Controller

```java
@PutMapping("/my-epicerie")
public ResponseEntity<Epicerie> updateMyEpicerie(
    @RequestBody EpicerieUpdateRequest request,
    @AuthenticationPrincipal UserDetails userDetails
) {
    User user = userRepository.findByEmail(userDetails.getUsername());
    Epicerie epicerie = epicerieRepository.findByUserId(user.getId())
        .orElseThrow(() -> new ResourceNotFoundException("Épicerie non trouvée"));

    // ... mise à jour autres champs

    // NEW: Valider et stocker les zones de livraison
    if (request.getDeliveryZones() != null) {
        validateDeliveryZones(request.getDeliveryZones());  // Voir validation ci-dessous
        epicerie.setDeliveryZones(request.getDeliveryZones());
    }

    epicerie.setUpdatedAt(LocalDateTime.now());
    epicerieRepository.save(epicerie);

    return ResponseEntity.ok(epicerie);
}

private void validateDeliveryZones(String zonesJson) {
    try {
        ObjectMapper mapper = new ObjectMapper();
        JsonNode root = mapper.readTree(zonesJson);

        if (!root.isArray()) {
            throw new BadRequestException("Les zones doivent être un tableau JSON");
        }

        List<JsonNode> zones = new ArrayList<>();
        root.forEach(zones::add);

        if (zones.isEmpty()) {
            throw new BadRequestException("Au moins une zone de livraison est requise");
        }

        boolean hasActiveZone = false;

        for (int i = 0; i < zones.size(); i++) {
            JsonNode zone = zones.get(i);

            // Vérifier les champs obligatoires
            if (!zone.has("name") || zone.get("name").asText().trim().isEmpty()) {
                throw new BadRequestException("Zone " + i + ": 'name' est requis");
            }

            if (!zone.has("deliveryFee")) {
                throw new BadRequestException("Zone " + i + ": 'deliveryFee' est requis");
            }

            if (!zone.has("maxDistance")) {
                throw new BadRequestException("Zone " + i + ": 'maxDistance' est requis");
            }

            // Valider les valeurs
            double maxDistance = zone.get("maxDistance").asDouble();
            if (maxDistance <= 0) {
                throw new BadRequestException(
                    "Zone " + i + ": maxDistance doit être > 0"
                );
            }

            double deliveryFee = zone.get("deliveryFee").asDouble();
            if (deliveryFee < 0) {
                throw new BadRequestException(
                    "Zone " + i + ": deliveryFee ne peut pas être négatif"
                );
            }

            // Vérifier s'il y a au moins une zone active
            if (zone.has("isActive") && zone.get("isActive").asBoolean()) {
                hasActiveZone = true;
            }
        }

        if (!hasActiveZone) {
            throw new BadRequestException("Au moins une zone doit être active");
        }

    } catch (JsonProcessingException e) {
        throw new BadRequestException(
            "Format JSON des zones invalide: " + e.getMessage()
        );
    }
}
```

### 🔍 Migration de la Base de Données (SQL)

```sql
-- Pour PostgreSQL
ALTER TABLE epiceries ADD COLUMN delivery_zones TEXT;

-- Pour MySQL
ALTER TABLE epiceries ADD COLUMN delivery_zones LONGTEXT;

-- Pour H2 (tests)
ALTER TABLE epiceries ADD COLUMN delivery_zones VARCHAR(4000);
```

### 🚀 Endpoint Additionnel (Optionnel): Récupérer Zones par Distance

**GET /api/epiceries/{epicerieId}/delivery-zones**

```java
@GetMapping("/{epicerieId}/delivery-zones")
public ResponseEntity<List<DeliveryZoneDTO>> getDeliveryZones(
    @PathVariable Long epicerieId,
    @RequestParam(required = false) Double clientLatitude,
    @RequestParam(required = false) Double clientLongitude
) {
    Epicerie epicerie = epicerieRepository.findById(epicerieId)
        .orElseThrow(() -> new ResourceNotFoundException("Épicerie non trouvée"));

    if (epicerie.getDeliveryZones() == null) {
        return ResponseEntity.ok(new ArrayList<>());
    }

    ObjectMapper mapper = new ObjectMapper();
    List<DeliveryZoneDTO> zones = mapper.readValue(
        epicerie.getDeliveryZones(),
        new TypeReference<List<DeliveryZoneDTO>>() {}
    );

    // Filtrer les zones actives
    zones = zones.stream()
        .filter(DeliveryZoneDTO::isActive)
        .collect(Collectors.toList());

    return ResponseEntity.ok(zones);
}
```

---

## 📝 Réponses GET /api/epiceries/my-epicerie

### Response Exemple Complet (200 OK)

```json
{
  "id": 1,
  "nomEpicerie": "Épicerie du Centre",
  "description": "Une belle épicerie",
  "adresse": "123 rue de la Paix, 75000 Paris",
  "latitude": 48.8566,
  "longitude": 2.3522,
  "telephone": "0123456789",
  "telephonePro": "0123456789",
  "telephonePersonnel": "0687654321",
  "nomGerant": "Dupont",
  "prenomGerant": "Jean",
  "emailGerant": "jean.dupont@example.com",
  "photoUrl": "https://storage.example.com/epiceries/1/profile-photo.jpg",
  "horaires": "{\"lundi\":{\"isOpen\":true,\"openTime\":\"08:00\",\"closeTime\":\"20:00\"},\"dimanche\":{\"isOpen\":false,\"openTime\":\"00:00\",\"closeTime\":\"00:00\"}}",
  "deliveryZones": "[{\"id\":\"1\",\"name\":\"Zone proche\",\"deliveryFee\":0,\"maxDistance\":2,\"estimatedTime\":\"15-20 min\",\"isActive\":true}]",
  "isActive": true,
  "nombreProducts": 42,
  "createdAt": "2025-11-09T10:30:00",
  "updatedAt": "2025-11-09T14:45:00"
}
```

---

## ✅ Checklist d'Implémentation Backend

### Phase 1: Base de Données
- [ ] Ajouter champ `photoUrl` à Epicerie
- [ ] Ajouter champ `horaires` à Epicerie
- [ ] Ajouter champ `deliveryZones` à Epicerie
- [ ] Exécuter migrations de la BD
- [ ] Vérifier schema à jour

### Phase 2: Modèle/DTO
- [ ] Ajouter getters/setters pour `photoUrl`
- [ ] Ajouter getters/setters pour `horaires`
- [ ] Ajouter getters/setters pour `deliveryZones`
- [ ] Mettre à jour `EpicerieUpdateRequest` DTO
- [ ] Mettre à jour `EpicerieResponse` DTO

### Phase 3: Upload Photo
- [ ] Implémenter `StorageService` ou utiliser S3/Cloudinary
- [ ] Créer endpoint `POST /api/epiceries/my-epicerie/photo`
- [ ] Ajouter validations (type, taille)
- [ ] Ajouter gestion d'erreurs
- [ ] Tester avec images réelles

### Phase 4: Horaires
- [ ] Ajouter validation `validateHoraires()`
- [ ] Intégrer validation dans `updateMyEpicerie()`
- [ ] Tester avec JSON invalide
- [ ] Tester avec horaires invalides

### Phase 5: Zones Livraison
- [ ] Ajouter validation `validateDeliveryZones()`
- [ ] Intégrer validation dans `updateMyEpicerie()`
- [ ] Tester avec JSON invalide
- [ ] Créer endpoint optionnel GET zones par distance

### Phase 6: Tests & Documentation
- [ ] Tests unitaires validations
- [ ] Tests d'intégration endpoints
- [ ] Tests upload image
- [ ] Documentation API Swagger/OpenAPI
- [ ] Documentation base de données

---

## 🔒 Sécurité à Implémenter

### 1. Authentification
```java
// ✅ Tous les endpoints REQUIRE JWT Bearer token
@PreAuthorize("hasAnyRole('EPICIER')")
@PostMapping("/my-epicerie/photo")
public ResponseEntity<Epicerie> uploadProfilePhoto(...) { }
```

### 2. Autorisation
```java
// ✅ Vérifier que l'utilisateur accède ses propres données
User user = userRepository.findByEmail(userDetails.getUsername());
Epicerie epicerie = epicerieRepository.findByUserId(user.getId());
// Ne pas permettre accès à d'autres épiceries
```

### 3. Validation des Fichiers
```java
// ✅ Whitelist de types MIME acceptés
String[] allowedTypes = {"image/jpeg", "image/png"};

// ✅ Limite de taille
if (file.getSize() > 5 * 1024 * 1024) {
    throw new BadRequestException("Fichier trop gros");
}

// ✅ Vérifier extension fichier
String filename = file.getOriginalFilename();
String extension = filename.substring(filename.lastIndexOf("."));
if (!extension.matches("\\.(jpg|jpeg|png)$")) {
    throw new BadRequestException("Extension non autorisée");
}
```

### 4. Validation JSON
```java
// ✅ Parser le JSON avec ObjectMapper
// ✅ Vérifier tous les champs requis
// ✅ Vérifier les types de données
// ✅ Vérifier les ranges de valeurs
```

### 5. Rate Limiting (Optionnel)
```java
// ✅ Limiter les uploads (ex: 10 par heure par épicier)
@RateLimiter(value = "10/m", name = "photoUpload")
@PostMapping("/my-epicerie/photo")
public ResponseEntity<Epicerie> uploadProfilePhoto(...) { }
```

---

## 🔗 Dépendances Maven à Ajouter (si nécessaire)

```xml
<!-- Jackson pour JSON processing -->
<dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-databind</artifactId>
    <version>2.15.2</version>
</dependency>

<!-- Commons IO pour file operations -->
<dependency>
    <groupId>commons-io</groupId>
    <artifactId>commons-io</artifactId>
    <version>2.11.0</version>
</dependency>

<!-- AWS S3 (si utilisant S3 pour storage) -->
<dependency>
    <groupId>software.amazon.awssdk</groupId>
    <artifactId>s3</artifactId>
    <version>2.20.0</version>
</dependency>

<!-- Rate limiting -->
<dependency>
    <groupId>io.github.bucket4j</groupId>
    <artifactId>bucket4j-core</artifactId>
    <version>7.6.0</version>
</dependency>
```

---

## 📚 Classes d'Exception à Créer (si inexistantes)

```java
// BadRequestException.java
public class BadRequestException extends RuntimeException {
    public BadRequestException(String message) {
        super(message);
    }
}

// ForbiddenException.java
public class ForbiddenException extends RuntimeException {
    public ForbiddenException(String message) {
        super(message);
    }
}

// ResourceNotFoundException.java
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
```

---

## 🧪 Exemples de Tests

### Test Upload Photo

```java
@SpringBootTest
@AutoConfigureMockMvc
public class EpiceriePhotoUploadTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    public void testUploadValidPhoto() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
            "photo",
            "profile.jpg",
            "image/jpeg",
            new FileInputStream("src/test/resources/test-image.jpg")
        );

        mockMvc.perform(multipart("/api/epiceries/my-epicerie/photo")
            .file(file)
            .header("Authorization", "Bearer " + validToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.photoUrl").exists());
    }

    @Test
    public void testUploadInvalidFileType() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
            "photo",
            "file.txt",
            "text/plain",
            "invalid content".getBytes()
        );

        mockMvc.perform(multipart("/api/epiceries/my-epicerie/photo")
            .file(file)
            .header("Authorization", "Bearer " + validToken))
            .andExpect(status().isBadRequest());
    }
}
```

### Test Validations Horaires

```java
@SpringBootTest
public class HorairesValidationTest {

    @Test
    public void testValidHorairesJson() {
        String validHoraires = "{\"lundi\":{\"isOpen\":true,\"openTime\":\"08:00\",\"closeTime\":\"20:00\"}}";

        // Devrait passer sans exception
        assertDoesNotThrow(() -> epicerieController.validateHoraires(validHoraires));
    }

    @Test
    public void testInvalidCloseTime() {
        String invalidHoraires = "{\"lundi\":{\"isOpen\":true,\"openTime\":\"20:00\",\"closeTime\":\"08:00\"}}";

        // Devrait lancer BadRequestException
        assertThrows(BadRequestException.class, () ->
            epicerieController.validateHoraires(invalidHoraires)
        );
    }
}
```

---

## 📊 Schéma SQL Complet Mis à Jour

### PostgreSQL

```sql
CREATE TABLE epiceries (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    nom_epicerie VARCHAR(255) NOT NULL,
    description TEXT,
    adresse TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    telephone VARCHAR(20),
    telephone_pro VARCHAR(20),
    telephone_personnel VARCHAR(20),
    nom_gerant VARCHAR(255),
    prenom_gerant VARCHAR(255),
    email_gerant VARCHAR(255),

    -- NEW FIELDS
    photo_url TEXT,
    horaires TEXT,
    delivery_zones TEXT,

    is_active BOOLEAN DEFAULT true,
    nombre_products INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for performance
CREATE INDEX idx_epiceries_user_id ON epiceries(user_id);
CREATE INDEX idx_epiceries_is_active ON epiceries(is_active);
```

### MySQL

```sql
CREATE TABLE epiceries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    nom_epicerie VARCHAR(255) NOT NULL,
    description TEXT,
    adresse TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    telephone VARCHAR(20),
    telephone_pro VARCHAR(20),
    telephone_personnel VARCHAR(20),
    nom_gerant VARCHAR(255),
    prenom_gerant VARCHAR(255),
    email_gerant VARCHAR(255),

    -- NEW FIELDS
    photo_url LONGTEXT,
    horaires LONGTEXT,
    delivery_zones LONGTEXT,

    is_active BOOLEAN DEFAULT true,
    nombre_products INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    KEY idx_user_id (user_id),
    KEY idx_is_active (is_active)
);
```

---

## 🚀 Ordre de Déploiement Recommandé

1. **Semaine 1: Base de Données**
   - [ ] Ajouter colonnes à Epicerie
   - [ ] Exécuter migrations
   - [ ] Vérifier intégrité données

2. **Semaine 2: Photo Upload**
   - [ ] Implémenter upload endpoint
   - [ ] Intégrer storage service
   - [ ] Tester end-to-end

3. **Semaine 3: Horaires**
   - [ ] Ajouter validation
   - [ ] Intégrer dans updateMyEpicerie
   - [ ] Tester validations

4. **Semaine 4: Zones Livraison**
   - [ ] Ajouter validation
   - [ ] Intégrer dans updateMyEpicerie
   - [ ] Créer endpoint GET optionnel

5. **Semaine 5: Tests & Documentation**
   - [ ] Tests complets
   - [ ] Documentation API
   - [ ] Déploiement production

---

## 🤝 Points de Contact Frontend/Backend

### Frontend appelle:
1. **POST /epiceries/my-epicerie/photo** (FormData)
2. **PUT /epiceries/my-epicerie** (JSON avec horaires/zones)
3. **GET /epiceries/my-epicerie** (récupère toutes les infos)
4. **GET /orders/my-epicerie** (pour les stats)

### Frontend s'attend à:
- Response 200/201 OK avec Epicerie mise à jour
- Erreur 400 Bad Request si validation échoue
- Erreur 401 Unauthorized si token invalide
- Erreur 403 Forbidden si pas autorisé
- Erreur 404 Not Found si ressource inexistante
- Erreur 500 Internal Server Error + message dans JSON

---

## 📞 Support et Questions

**Si des questions surgissent:**
1. Vérifier ce document
2. Vérifier les examples de code
3. Vérifier les tests unitaires
4. Consulter la documentation EPICIER_PROFILE_COMPLETE.md du frontend

**Issues connues:**
- Aucun à ce stade (document neuf)

---

**Dernière mise à jour:** 2025-11-09
**Version:** 1.0
**Statut:** Prêt pour implémentation
