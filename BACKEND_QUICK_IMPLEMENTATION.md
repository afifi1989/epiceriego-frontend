# Backend - Implémentation Rapide (Copy-Paste Ready)

## 🚀 Guide Rapide pour Implémenter le Système de Profil Épicier

**Temps estimé:** 2-3 heures
**Complexité:** Moyen
**Prérequis:** Spring Boot, JPA/Hibernate, JWT Auth

---

## ÉTAPE 1: Migration Base de Données

### ✅ Exécuter IMMÉDIATEMENT dans votre DB

**PostgreSQL/MySQL/H2:**
```sql
ALTER TABLE epiceries ADD COLUMN photo_url TEXT;
ALTER TABLE epiceries ADD COLUMN horaires TEXT;
ALTER TABLE epiceries ADD COLUMN delivery_zones TEXT;
```

**Vérifier l'ajout:**
```sql
DESCRIBE epiceries;
-- ou en PostgreSQL:
\d epiceries
```

---

## ÉTAPE 2: Modifier la Classe Epicerie

**Fichier:** `src/main/java/com/example/model/Epicerie.java`

**Ajouter ces 3 champs + getters/setters:**

```java
@Column(name = "photo_url", columnDefinition = "TEXT")
private String photoUrl;

@Column(name = "horaires", columnDefinition = "TEXT")
private String horaires;

@Column(name = "delivery_zones", columnDefinition = "TEXT")
private String deliveryZones;

// Getters
public String getPhotoUrl() {
    return photoUrl;
}

public String getHoraires() {
    return horaires;
}

public String getDeliveryZones() {
    return deliveryZones;
}

// Setters
public void setPhotoUrl(String photoUrl) {
    this.photoUrl = photoUrl;
}

public void setHoraires(String horaires) {
    this.horaires = horaires;
}

public void setDeliveryZones(String deliveryZones) {
    this.deliveryZones = deliveryZones;
}
```

---

## ÉTAPE 3: Modifier le DTO EpicerieUpdateRequest

**Fichier:** `src/main/java/com/example/dto/EpicerieUpdateRequest.java`

**Ajouter ces 3 champs:**

```java
@JsonProperty("photoUrl")
private String photoUrl;

@JsonProperty("horaires")
private String horaires;

@JsonProperty("deliveryZones")
private String deliveryZones;

// Getters & Setters (Auto avec Lombok @Data)
public String getPhotoUrl() { return photoUrl; }
public void setPhotoUrl(String photoUrl) { this.photoUrl = photoUrl; }

public String getHoraires() { return horaires; }
public void setHoraires(String horaires) { this.horaires = horaires; }

public String getDeliveryZones() { return deliveryZones; }
public void setDeliveryZones(String deliveryZones) { this.deliveryZones = deliveryZones; }
```

---

## ÉTAPE 4: Créer le Service de Stockage d'Images

**Fichier:** `src/main/java/com/example/service/StorageService.java`

```java
package com.example.service;

import org.springframework.stereotype.Service;
import java.io.InputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

@Service
public class StorageService {

    private static final String UPLOAD_DIR = "uploads/epiceries/photos/";

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

    public void deleteEpiceriePhoto(Long epicerieId, String filename) throws IOException {
        Path filePath = Paths.get(UPLOAD_DIR + epicerieId + "/" + filename);
        Files.deleteIfExists(filePath);
    }
}
```

---

## ÉTAPE 5: Créer les Classes d'Exception

**Fichier:** `src/main/java/com/example/exception/BadRequestException.java`

```java
package com.example.exception;

public class BadRequestException extends RuntimeException {
    public BadRequestException(String message) {
        super(message);
    }
}
```

**Fichier:** `src/main/java/com/example/exception/ForbiddenException.java`

```java
package com.example.exception;

public class ForbiddenException extends RuntimeException {
    public ForbiddenException(String message) {
        super(message);
    }
}
```

---

## ÉTAPE 6: Ajouter Endpoint POST /epiceries/my-epicerie/photo

**Fichier:** `src/main/java/com/example/controller/EpicerieController.java`

**Ajouter cette méthode:**

```java
import org.springframework.web.multipart.MultipartFile;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;

@PostMapping("/my-epicerie/photo")
public ResponseEntity<Epicerie> uploadProfilePhoto(
    @RequestParam("photo") MultipartFile file,
    @AuthenticationPrincipal UserDetails userDetails
) throws IOException {

    // 1. Vérifier l'utilisateur
    User user = userRepository.findByEmail(userDetails.getUsername())
        .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouvé"));

    // 2. Récupérer l'épicerie
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

    if (file.getSize() > 5 * 1024 * 1024) {
        throw new BadRequestException("La taille de l'image ne doit pas dépasser 5MB");
    }

    // 4. Sauvegarder l'image
    String photoUrl = storageService.saveEpiceriePhoto(
        epicerie.getId(),
        file.getInputStream(),
        contentType
    );

    // 5. Mettre à jour l'épicerie
    epicerie.setPhotoUrl(photoUrl);
    epicerie.setUpdatedAt(LocalDateTime.now());
    epicerieRepository.save(epicerie);

    return ResponseEntity.ok(epicerie);
}
```

---

## ÉTAPE 7: Modifier la Méthode PUT /epiceries/my-epicerie

**Fichier:** `src/main/java/com/example/controller/EpicerieController.java`

**Modifier la méthode updateMyEpicerie existante:**

```java
@PutMapping("/my-epicerie")
public ResponseEntity<Epicerie> updateMyEpicerie(
    @RequestBody EpicerieUpdateRequest request,
    @AuthenticationPrincipal UserDetails userDetails
) {
    User user = userRepository.findByEmail(userDetails.getUsername())
        .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouvé"));

    Epicerie epicerie = epicerieRepository.findByUserId(user.getId())
        .orElseThrow(() -> new ResourceNotFoundException("Épicerie non trouvée"));

    // Mettre à jour les champs existants
    if (request.getNomEpicerie() != null) {
        epicerie.setNomEpicerie(request.getNomEpicerie());
    }
    if (request.getAdresse() != null) {
        epicerie.setAdresse(request.getAdresse());
    }
    if (request.getDescription() != null) {
        epicerie.setDescription(request.getDescription());
    }
    if (request.getLatitude() != null) {
        epicerie.setLatitude(request.getLatitude());
    }
    if (request.getLongitude() != null) {
        epicerie.setLongitude(request.getLongitude());
    }
    if (request.getTelephonePro() != null) {
        epicerie.setTelephonePro(request.getTelephonePro());
    }
    if (request.getTelephonePersonnel() != null) {
        epicerie.setTelephonePersonnel(request.getTelephonePersonnel());
    }
    if (request.getNomGerant() != null) {
        epicerie.setNomGerant(request.getNomGerant());
    }
    if (request.getPrenomGerant() != null) {
        epicerie.setPrenomGerant(request.getPrenomGerant());
    }
    if (request.getEmailGerant() != null) {
        epicerie.setEmailGerant(request.getEmailGerant());
    }

    // ✅ NOUVEAUX: Horaires
    if (request.getHoraires() != null) {
        validateHoraires(request.getHoraires());
        epicerie.setHoraires(request.getHoraires());
    }

    // ✅ NOUVEAUX: Zones de livraison
    if (request.getDeliveryZones() != null) {
        validateDeliveryZones(request.getDeliveryZones());
        epicerie.setDeliveryZones(request.getDeliveryZones());
    }

    epicerie.setUpdatedAt(LocalDateTime.now());
    epicerieRepository.save(epicerie);

    return ResponseEntity.ok(epicerie);
}
```

---

## ÉTAPE 8: Ajouter les Validations

**Dans le même fichier EpicerieController.java, ajouter:**

```java
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

            String openTime = dayObj.get("openTime").asText();
            String closeTime = dayObj.get("closeTime").asText();

            // Validation format HH:MM
            if (!openTime.matches("\\d{2}:\\d{2}") || !closeTime.matches("\\d{2}:\\d{2}")) {
                throw new BadRequestException("Format d'heure invalide pour " + day);
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
    } catch (Exception e) {
        if (e instanceof BadRequestException) throw (BadRequestException) e;
        throw new BadRequestException("Format JSON des horaires invalide: " + e.getMessage());
    }
}

private void validateDeliveryZones(String zonesJson) {
    try {
        ObjectMapper mapper = new ObjectMapper();
        JsonNode root = mapper.readTree(zonesJson);

        if (!root.isArray()) {
            throw new BadRequestException("Les zones doivent être un tableau JSON");
        }

        int count = root.size();
        if (count == 0) {
            throw new BadRequestException("Au moins une zone de livraison est requise");
        }

        boolean hasActiveZone = false;

        for (int i = 0; i < count; i++) {
            JsonNode zone = root.get(i);

            // Vérifier les champs obligatoires
            if (!zone.has("name") || zone.get("name").asText().trim().isEmpty()) {
                throw new BadRequestException("Zone " + i + ": 'name' est requis");
            }

            if (!zone.has("deliveryFee") || !zone.has("maxDistance")) {
                throw new BadRequestException("Zone " + i + ": 'deliveryFee' et 'maxDistance' requis");
            }

            // Valider les valeurs
            double maxDistance = zone.get("maxDistance").asDouble();
            double deliveryFee = zone.get("deliveryFee").asDouble();

            if (maxDistance <= 0) {
                throw new BadRequestException("Zone " + i + ": maxDistance doit être > 0");
            }

            if (deliveryFee < 0) {
                throw new BadRequestException("Zone " + i + ": deliveryFee ne peut pas être négatif");
            }

            // Vérifier s'il y a au moins une zone active
            if (zone.has("isActive") && zone.get("isActive").asBoolean()) {
                hasActiveZone = true;
            }
        }

        if (!hasActiveZone) {
            throw new BadRequestException("Au moins une zone doit être active");
        }

    } catch (Exception e) {
        if (e instanceof BadRequestException) throw (BadRequestException) e;
        throw new BadRequestException("Format JSON des zones invalide: " + e.getMessage());
    }
}
```

---

## ÉTAPE 9: Ajouter le Global Exception Handler

**Fichier:** `src/main/java/com/example/exception/GlobalExceptionHandler.java`

**Ajouter les handlers:**

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

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(404).body(
            new ErrorResponse("NOT_FOUND", ex.getMessage())
        );
    }
}
```

**Créer la classe ErrorResponse si elle n'existe pas:**

```java
package com.example.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ErrorResponse {
    private String code;
    private String message;
}
```

---

## ÉTAPE 10: Injecter le StorageService dans le Controller

**Dans EpicerieController.java, ajouter:**

```java
@RestController
@RequestMapping("/api/epiceries")
public class EpicerieController {

    @Autowired
    private EpicerieRepository epicerieRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StorageService storageService;  // ← AJOUTER CET AUTOWIRE

    // ... rest du code
}
```

---

## ÉTAPE 11: Configuration Web pour Servir les Fichiers (Optional mais Recommandé)

**Fichier:** `src/main/java/com/example/config/WebConfig.java`

```java
package com.example.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry
            .addResourceHandler("/uploads/**")
            .addResourceLocations("file:uploads/");
    }
}
```

---

## ÉTAPE 12: Tester les Endpoints

### Test 1: GET /epiceries/my-epicerie
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:8080/api/epiceries/my-epicerie
```

**Réponse attendue (200 OK):**
```json
{
  "id": 1,
  "nomEpicerie": "Ma Boutique",
  "photoUrl": null,
  "horaires": null,
  "deliveryZones": null
}
```

### Test 2: POST /epiceries/my-epicerie/photo
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "photo=@/path/to/image.jpg" \
  http://localhost:8080/api/epiceries/my-epicerie/photo
```

**Réponse attendue (200 OK):**
```json
{
  "id": 1,
  "photoUrl": "/uploads/epiceries/photos/1/profile-1731123456789.jpg"
}
```

### Test 3: PUT /epiceries/my-epicerie (avec horaires)
```bash
curl -X PUT \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nomEpicerie": "Ma Boutique",
    "horaires": "{\"lundi\":{\"isOpen\":true,\"openTime\":\"08:00\",\"closeTime\":\"20:00\"}}"
  }' \
  http://localhost:8080/api/epiceries/my-epicerie
```

---

## ✅ Checklist Rapide

- [ ] Ajouter colonnes SQL
- [ ] Ajouter champs à Epicerie.java
- [ ] Ajouter champs à EpicerieUpdateRequest.java
- [ ] Créer StorageService.java
- [ ] Créer BadRequestException.java
- [ ] Créer ForbiddenException.java
- [ ] Ajouter endpoint POST photo
- [ ] Modifier endpoint PUT existant
- [ ] Ajouter validations Horaires
- [ ] Ajouter validations Zones
- [ ] Ajouter GlobalExceptionHandler
- [ ] Ajouter @Autowired StorageService
- [ ] Ajouter WebConfig (optional)
- [ ] Tester les 3 endpoints
- [ ] Vérifier les erreurs
- [ ] Déployer en production

---

## 🐛 Troubleshooting Rapide

**Erreur: Column 'photo_url' doesn't exist**
→ Exécuter la migration SQL

**Erreur: StorageService not found**
→ Vérifier @Autowired dans le Controller

**Erreur: Permission denied on upload directory**
→ Vérifier permissions du répertoire `uploads/`

**Erreur: JSON parsing error**
→ Vérifier le format JSON envoyé par le frontend

**Erreur: 401 Unauthorized**
→ Vérifier le JWT token est valide

---

## 📚 Fichiers à Consulter pour Plus de Détails

- `BACKEND_REQUIREMENTS.md` - Spécifications complètes
- `EPICIER_PROFILE_COMPLETE.md` - Vue d'ensemble du système
- Code Frontend: `app/(epicier)/modifier-infos.tsx` - Voir ce qu'il envoie

---

**Prêt à implémenter? Copy-paste les étapes 1-12 et c'est bon! 🚀**
