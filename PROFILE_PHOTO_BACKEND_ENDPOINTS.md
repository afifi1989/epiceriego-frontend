# Endpoints Backend pour la Photo de Profil

Ce document décrit les endpoints backend nécessaires pour la gestion de la photo de profil des utilisateurs.

## 📸 Endpoints Principaux

### 1. POST /api/users/profile/photo
Upload une nouvelle photo de profil pour l'utilisateur authentifié.

**Headers requis:**
- `Authorization: Bearer {token}`
- `Content-Type: multipart/form-data`

**Body (FormData):**
- `file`: Fichier image (JPEG/PNG)

**Réponse:**
```json
{
  "photoUrl": "https://your-domain.com/uploads/profiles/user-123-1699999999.jpg"
}
```

**Code d'état:**
- `200 OK`: Upload réussi
- `400 Bad Request`: Fichier invalide ou manquant
- `401 Unauthorized`: Token invalide
- `413 Payload Too Large`: Fichier trop volumineux
- `415 Unsupported Media Type`: Format de fichier non supporté
- `500 Internal Server Error`: Erreur serveur

---

### 2. DELETE /api/users/profile/photo
Supprime la photo de profil de l'utilisateur authentifié.

**Headers requis:**
- `Authorization: Bearer {token}`

**Réponse:**
```json
{
  "message": "Photo de profil supprimée avec succès"
}
```

**Code d'état:**
- `200 OK`: Suppression réussie
- `401 Unauthorized`: Token invalide
- `404 Not Found`: Aucune photo à supprimer
- `500 Internal Server Error`: Erreur serveur

---

### 3. GET /api/users/profile
Récupère le profil complet incluant l'URL de la photo (endpoint existant, à mettre à jour).

**Headers requis:**
- `Authorization: Bearer {token}`

**Réponse mise à jour:**
```json
{
  "id": 123,
  "nom": "Jean Dupont",
  "email": "jean.dupont@example.com",
  "telephone": "+33612345678",
  "adresse": "123 Rue de la Paix, Paris",
  "role": "CLIENT",
  "photoUrl": "https://your-domain.com/uploads/profiles/user-123-1699999999.jpg"
}
```

---

## 🔧 Exemples CURL

### 1. Upload d'une photo de profil

```bash
curl -X POST "http://localhost:8080/api/users/profile/photo" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -F "file=@/path/to/profile-photo.jpg"
```

**Réponse attendue:**
```json
{
  "photoUrl": "http://localhost:8080/uploads/profiles/user-123-1699999999.jpg"
}
```

---

### 2. Upload avec curl verbose (pour debugging)

```bash
curl -v -X POST "http://localhost:8080/api/users/profile/photo" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -F "file=@/path/to/profile-photo.jpg"
```

---

### 3. Supprimer la photo de profil

```bash
curl -X DELETE "http://localhost:8080/api/users/profile/photo" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

**Réponse attendue:**
```json
{
  "message": "Photo de profil supprimée avec succès"
}
```

---

### 4. Récupérer le profil avec la photo

```bash
curl -X GET "http://localhost:8080/api/users/profile" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Réponse attendue:**
```json
{
  "id": 123,
  "nom": "Jean Dupont",
  "email": "jean.dupont@example.com",
  "telephone": "+33612345678",
  "adresse": "123 Rue de la Paix, Paris",
  "role": "CLIENT",
  "photoUrl": "http://localhost:8080/uploads/profiles/user-123-1699999999.jpg"
}
```

---

## 🏗️ Implémentation Backend (Java Spring Boot)

### UserController.java

```java
@RestController
@RequestMapping("/api/users")
public class UserController {
    
    @Autowired
    private UserService userService;
    
    @Autowired
    private FileStorageService fileStorageService;
    
    /**
     * Upload une photo de profil
     */
    @PostMapping("/profile/photo")
    public ResponseEntity<Map<String, String>> uploadProfilePhoto(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        try {
            Long userId = getUserIdFromUserDetails(userDetails);
            
            // Validation du fichier
            if (file.isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "Le fichier est vide"));
            }
            
            // Vérifier le type de fichier
            String contentType = file.getContentType();
            if (!isValidImageType(contentType)) {
                return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                    .body(Map.of("error", "Format de fichier non supporté. Utilisez JPEG ou PNG"));
            }
            
            // Vérifier la taille (max 5MB)
            if (file.getSize() > 5 * 1024 * 1024) {
                return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                    .body(Map.of("error", "Le fichier est trop volumineux (max 5MB)"));
            }
            
            // Supprimer l'ancienne photo si elle existe
            User user = userService.getUserById(userId);
            if (user.getPhotoUrl() != null) {
                fileStorageService.deleteFile(user.getPhotoUrl());
            }
            
            // Sauvegarder le nouveau fichier
            String filename = fileStorageService.storeProfilePhoto(file, userId);
            String photoUrl = fileStorageService.getFileUrl(filename);
            
            // Mettre à jour l'utilisateur
            user.setPhotoUrl(photoUrl);
            userService.updateUser(user);
            
            return ResponseEntity.ok(Map.of("photoUrl", photoUrl));
            
        } catch (Exception e) {
            log.error("Erreur lors de l'upload de la photo de profil", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Erreur lors de l'upload de la photo"));
        }
    }
    
    /**
     * Supprime la photo de profil
     */
    @DeleteMapping("/profile/photo")
    public ResponseEntity<Map<String, String>> deleteProfilePhoto(
            @AuthenticationPrincipal UserDetails userDetails) {
        
        try {
            Long userId = getUserIdFromUserDetails(userDetails);
            User user = userService.getUserById(userId);
            
            if (user.getPhotoUrl() == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Aucune photo de profil à supprimer"));
            }
            
            // Supprimer le fichier
            fileStorageService.deleteFile(user.getPhotoUrl());
            
            // Mettre à jour l'utilisateur
            user.setPhotoUrl(null);
            userService.updateUser(user);
            
            return ResponseEntity.ok(Map.of("message", "Photo de profil supprimée avec succès"));
            
        } catch (Exception e) {
            log.error("Erreur lors de la suppression de la photo de profil", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Erreur lors de la suppression de la photo"));
        }
    }
    
    /**
     * Récupère le profil de l'utilisateur (endpoint existant à mettre à jour)
     */
    @GetMapping("/profile")
    public ResponseEntity<UserDTO> getMyProfile(
            @AuthenticationPrincipal UserDetails userDetails) {
        
        Long userId = getUserIdFromUserDetails(userDetails);
        User user = userService.getUserById(userId);
        
        // Mapper vers DTO incluant photoUrl
        UserDTO userDTO = UserDTO.builder()
            .id(user.getId())
            .nom(user.getNom())
            .email(user.getEmail())
            .telephone(user.getTelephone())
            .adresse(user.getAdresse())
            .role(user.getRole())
            .photoUrl(user.getPhotoUrl())  // Nouveau champ
            .build();
        
        return ResponseEntity.ok(userDTO);
    }
    
    private boolean isValidImageType(String contentType) {
        return contentType != null && (
            contentType.equals("image/jpeg") ||
            contentType.equals("image/jpg") ||
            contentType.equals("image/png")
        );
    }
    
    private Long getUserIdFromUserDetails(UserDetails userDetails) {
        return ((CustomUserDetails) userDetails).getUserId();
    }
}
```

### FileStorageService.java

```java
@Service
public class FileStorageService {
    
    @Value("${file.upload-dir:uploads/profiles}")
    private String uploadDir;
    
    @Value("${app.base-url:http://localhost:8080}")
    private String baseUrl;
    
    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(Paths.get(uploadDir));
        } catch (IOException e) {
            throw new RuntimeException("Impossible de créer le dossier d'upload", e);
        }
    }
    
    /**
     * Sauvegarde une photo de profil
     */
    public String storeProfilePhoto(MultipartFile file, Long userId) throws IOException {
        // Générer un nom de fichier unique
        String extension = getFileExtension(file.getOriginalFilename());
        String filename = "user-" + userId + "-" + System.currentTimeMillis() + extension;
        
        // Chemin complet
        Path targetLocation = Paths.get(uploadDir).resolve(filename);
        
        // Copier le fichier
        Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);
        
        return filename;
    }
    
    /**
     * Supprime un fichier
     */
    public void deleteFile(String fileUrl) {
        try {
            // Extraire le nom du fichier de l'URL
            String filename = fileUrl.substring(fileUrl.lastIndexOf('/') + 1);
            Path filePath = Paths.get(uploadDir).resolve(filename);
            
            Files.deleteIfExists(filePath);
        } catch (IOException e) {
            log.error("Erreur lors de la suppression du fichier: " + fileUrl, e);
        }
    }
    
    /**
     * Génère l'URL publique du fichier
     */
    public String getFileUrl(String filename) {
        return baseUrl + "/uploads/profiles/" + filename;
    }
    
    private String getFileExtension(String filename) {
        if (filename == null) return ".jpg";
        int dotIndex = filename.lastIndexOf('.');
        return (dotIndex == -1) ? ".jpg" : filename.substring(dotIndex);
    }
}
```

### User.java (Entity - mise à jour)

```java
@Entity
@Table(name = "users")
public class User {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String nom;
    
    @Column(nullable = false, unique = true)
    private String email;
    
    @Column
    private String telephone;
    
    @Column
    private String adresse;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole role;
    
    @Column(length = 500)
    private String photoUrl;  // NOUVEAU CHAMP
    
    // Getters et Setters...
}
```

### application.properties

```properties
# Configuration du stockage des fichiers
file.upload-dir=uploads/profiles
spring.servlet.multipart.max-file-size=5MB
spring.servlet.multipart.max-request-size=5MB

# URL de base de l'application
app.base-url=http://localhost:8080
```

### Configuration pour servir les fichiers statiques

```java
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {
    
    @Value("${file.upload-dir:uploads/profiles}")
    private String uploadDir;
    
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Servir les fichiers uploadés
        registry.addResourceHandler("/uploads/profiles/**")
                .addResourceLocations("file:" + uploadDir + "/");
    }
}
```

---

## 📊 Migration Base de Données

### SQL pour ajouter le champ photoUrl

```sql
-- PostgreSQL / MySQL
ALTER TABLE users ADD COLUMN photo_url VARCHAR(500);

-- Créer un index pour améliorer les performances
CREATE INDEX idx_users_photo_url ON users(photo_url);
```

---

## 🧪 Tests avec curl (Développement Local)

### Configuration complète
```bash
# Définir les variables
API_URL="http://localhost:8080/api"
TOKEN="" # À remplir après login

# 1. Login pour obtenir le token
curl -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "client@test.com",
    "password": "password123"
  }'

# Copier le token reçu et l'assigner à TOKEN
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 2. Upload d'une photo
curl -X POST "$API_URL/users/profile/photo" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/your/photo.jpg"

# 3. Vérifier le profil
curl -X GET "$API_URL/users/profile" \
  -H "Authorization: Bearer $TOKEN"

# 4. Supprimer la photo
curl -X DELETE "$API_URL/users/profile/photo" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📱 Comportement Frontend

L'application mobile:
- 📸 Permet de prendre une photo ou de choisir depuis la galerie
- ✂️ Recadre automatiquement l'image en format carré (1:1)
- 📏 Redimensionne l'image à 400x400 pixels
- 🗜️ Compresse l'image à 80% de qualité
- 📤 Upload au format JPEG
- 🔄 Affiche un loader pendant l'upload
- ✅ Met à jour l'interface après succès
- 🗑️ Permet de supprimer la photo existante

---

## ⚠️ Bonnes Pratiques

### Sécurité
1. **Validation stricte des fichiers**: Vérifier le type MIME et l'extension
2. **Limitation de taille**: Max 5MB par fichier
3. **Nom de fichier sécurisé**: Utiliser un nom généré, pas le nom original
4. **Stockage sécurisé**: Ne pas stocker dans le dossier web root directement
5. **Authentification**: Toujours vérifier que l'utilisateur est authentifié

### Performance
1. **Compression**: Les images sont déjà compressées côté mobile (80%)
2. **Redimensionnement**: Images redimensionnées à 400x400 côté mobile
3. **Cache**: Implémenter un cache CDN pour les photos fréquemment accédées
4. **Nettoyage**: Supprimer les anciennes photos lors du remplacement

### Stockage
1. **Organisation**: `uploads/profiles/user-{id}-{timestamp}.jpg`
2. **Backup**: Sauvegarder régulièrement le dossier uploads
3. **CDN**: Considérer l'utilisation d'un CDN (CloudFront, Cloudinary, etc.)
4. **Cloud Storage**: Pour la production, utiliser S3, Google Cloud Storage, etc.

---

## 🔍 Vérification Backend

Pour vérifier que votre backend est correctement configuré:

1. ✅ L'endpoint `/api/users/profile/photo` (POST) doit exister
2. ✅ L'endpoint `/api/users/profile/photo` (DELETE) doit exister
3. ✅ Le champ `photoUrl` doit être ajouté à la table `users`
4. ✅ Le dossier `uploads/profiles` doit être créé et accessible
5. ✅ La configuration multipart doit permettre max 5MB
6. ✅ Les fichiers uploadés doivent être servables via URL
7. ✅ L'authentification JWT doit fonctionner

---

## 🚀 Déploiement Production

### Considérations importantes:

1. **Stockage Cloud**: Utiliser S3, Google Cloud Storage, ou Azure Blob
2. **CDN**: Configurer un CDN pour servir les images
3. **HTTPS**: Toutes les URLs doivent être en HTTPS
4. **Sécurité**: Implémenter des règles CORS appropriées
5. **Monitoring**: Logger les uploads et suppressions
6. **Backup**: Système de backup automatique des images

### Exemple avec AWS S3:

```java
@Service
public class S3FileStorageService {
    
    @Autowired
    private AmazonS3 s3Client;
    
    @Value("${aws.s3.bucket}")
    private String bucketName;
    
    public String uploadToS3(MultipartFile file, Long userId) {
        String key = "profiles/user-" + userId + "-" + System.currentTimeMillis() + ".jpg";
        
        ObjectMetadata metadata = new ObjectMetadata();
        metadata.setContentType(file.getContentType());
        metadata.setContentLength(file.getSize());
        
        s3Client.putObject(bucketName, key, file.getInputStream(), metadata);
        
        return s3Client.getUrl(bucketName, key).toString();
    }
}
```

---

## 📝 Notes Importantes

1. **Format d'image**: L'app envoie toujours du JPEG compressé
2. **Ratio**: Les images sont carrées (1:1)
3. **Taille**: 400x400 pixels maximum
4. **Qualité**: Compression à 80%
5. **Permissions**: L'app demande les permissions caméra/galerie automatiquement
