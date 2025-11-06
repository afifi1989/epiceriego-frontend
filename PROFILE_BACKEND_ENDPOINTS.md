# 📋 Endpoints Backend - Profil Utilisateur

## 🎯 Endpoint Requis

L'application frontend a besoin d'un endpoint pour récupérer le profil complet de l'utilisateur connecté.

---

## 📍 GET /api/users/profile

Récupère le profil complet de l'utilisateur connecté (CLIENT, EPICIER, ou LIVREUR).

### Requête

```bash
curl -X GET "https://afifi-mostafa.com:8443/api/users/profile" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

### Réponse Success (200 OK)

```json
{
  "id": 123,
  "email": "client@test.com",
  "nom": "Dupont Jean",
  "telephone": "0612345678",
  "role": "CLIENT",
  "adresse": "123 Rue de la Paix, 75001 Paris",
  "latitude": 48.8566,
  "longitude": 2.3522
}
```

### Réponse si Téléphone/Adresse non renseignés

```json
{
  "id": 123,
  "email": "client@test.com",
  "nom": "Dupont Jean",
  "telephone": null,
  "role": "CLIENT",
  "adresse": null,
  "latitude": null,
  "longitude": null
}
```

### Codes d'erreur

- **401 Unauthorized** : Token JWT manquant ou invalide
- **404 Not Found** : Utilisateur non trouvé
- **500 Internal Server Error** : Erreur serveur

---

## 📍 PUT /api/users/profile (Optionnel)

Permet de mettre à jour le profil de l'utilisateur.

### Requête

```bash
curl -X PUT "https://afifi-mostafa.com:8443/api/users/profile" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Dupont Jean-Pierre",
    "telephone": "0687654321",
    "adresse": "456 Avenue des Champs, 75008 Paris",
    "latitude": 48.8738,
    "longitude": 2.2950
  }'
```

### Réponse Success (200 OK)

```json
{
  "id": 123,
  "email": "client@test.com",
  "nom": "Dupont Jean-Pierre",
  "telephone": "0687654321",
  "role": "CLIENT",
  "adresse": "456 Avenue des Champs, 75008 Paris",
  "latitude": 48.8738,
  "longitude": 2.2950
}
```

---

## 🔧 Implémentation Backend (Spring Boot)

### 1. Controller

```java
@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserService userService;

    /**
     * GET /api/users/profile
     * Récupère le profil de l'utilisateur connecté
     */
    @GetMapping("/profile")
    public ResponseEntity<?> getMyProfile(@AuthenticationPrincipal UserDetails userDetails) {
        try {
            User user = userService.findByEmail(userDetails.getUsername());
            
            if (user == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "Utilisateur non trouvé"));
            }

            // Créer un DTO pour ne pas exposer le mot de passe
            UserProfileDTO profile = new UserProfileDTO();
            profile.setId(user.getId());
            profile.setEmail(user.getEmail());
            profile.setNom(user.getNom());
            profile.setTelephone(user.getTelephone());
            profile.setRole(user.getRole().name());
            profile.setAdresse(user.getAdresse());
            profile.setLatitude(user.getLatitude());
            profile.setLongitude(user.getLongitude());

            return ResponseEntity.ok(profile);
            
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("message", "Erreur lors de la récupération du profil"));
        }
    }

    /**
     * PUT /api/users/profile
     * Met à jour le profil de l'utilisateur connecté
     */
    @PutMapping("/profile")
    public ResponseEntity<?> updateMyProfile(
        @RequestBody UpdateProfileRequest request,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        try {
            User user = userService.findByEmail(userDetails.getUsername());
            
            if (user == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "Utilisateur non trouvé"));
            }

            // Mettre à jour les champs
            if (request.getNom() != null) {
                user.setNom(request.getNom());
            }
            if (request.getTelephone() != null) {
                user.setTelephone(request.getTelephone());
            }
            if (request.getAdresse() != null) {
                user.setAdresse(request.getAdresse());
            }
            if (request.getLatitude() != null) {
                user.setLatitude(request.getLatitude());
            }
            if (request.getLongitude() != null) {
                user.setLongitude(request.getLongitude());
            }

            User updatedUser = userService.save(user);

            // Retourner le profil mis à jour
            UserProfileDTO profile = new UserProfileDTO();
            profile.setId(updatedUser.getId());
            profile.setEmail(updatedUser.getEmail());
            profile.setNom(updatedUser.getNom());
            profile.setTelephone(updatedUser.getTelephone());
            profile.setRole(updatedUser.getRole().name());
            profile.setAdresse(updatedUser.getAdresse());
            profile.setLatitude(updatedUser.getLatitude());
            profile.setLongitude(updatedUser.getLongitude());

            return ResponseEntity.ok(profile);
            
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("message", "Erreur lors de la mise à jour du profil"));
        }
    }
}
```

### 2. DTO - UserProfileDTO.java

```java
public class UserProfileDTO {
    private Long id;
    private String email;
    private String nom;
    private String telephone;
    private String role;
    private String adresse;
    private Double latitude;
    private Double longitude;

    // Constructeurs
    public UserProfileDTO() {}

    // Getters et Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getNom() { return nom; }
    public void setNom(String nom) { this.nom = nom; }

    public String getTelephone() { return telephone; }
    public void setTelephone(String telephone) { this.telephone = telephone; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getAdresse() { return adresse; }
    public void setAdresse(String adresse) { this.adresse = adresse; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
}
```

### 3. DTO - UpdateProfileRequest.java

```java
public class UpdateProfileRequest {
    private String nom;
    private String telephone;
    private String adresse;
    private Double latitude;
    private Double longitude;

    // Getters et Setters
    public String getNom() { return nom; }
    public void setNom(String nom) { this.nom = nom; }

    public String getTelephone() { return telephone; }
    public void setTelephone(String telephone) { this.telephone = telephone; }

    public String getAdresse() { return adresse; }
    public void setAdresse(String adresse) { this.adresse = adresse; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
}
```

### 4. Service - UserService.java

```java
@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    public User findByEmail(String email) {
        return userRepository.findByEmail(email)
            .orElse(null);
    }

    public User save(User user) {
        return userRepository.save(user);
    }
}
```

---

## 🧪 Tests avec curl

### Test 1: Récupérer son profil

```bash
# 1. D'abord se connecter pour obtenir le JWT
curl -X POST "https://afifi-mostafa.com:8443/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "client@test.com",
    "password": "password123"
  }'

# Réponse attendue:
# { "token": "eyJhbGciOiJIUzI1NiIs...", "email": "client@test.com", ... }

# 2. Utiliser le token pour récupérer le profil
curl -X GET "https://afifi-mostafa.com:8443/api/users/profile" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json"
```

### Test 2: Mettre à jour son profil

```bash
curl -X PUT "https://afifi-mostafa.com:8443/api/users/profile" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Nouveau Nom",
    "telephone": "0698765432",
    "adresse": "789 Boulevard Haussmann, 75009 Paris"
  }'
```

---

## 📝 Notes Importantes

### Sécurité

1. **Ne JAMAIS retourner le mot de passe** dans la réponse
2. **Utiliser un DTO** pour filtrer les champs exposés
3. **Vérifier l'authentification** avec `@AuthenticationPrincipal`
4. **Un utilisateur ne peut voir/modifier que SON propre profil**

### Champs Optionnels

Les champs suivants peuvent être `null`:
- `telephone`
- `adresse`
- `latitude`
- `longitude`

Le frontend affiche "Non renseigné" quand ces champs sont vides.

### Amélioration Future

Vous pouvez ajouter d'autres endpoints utiles:
- `GET /api/users/profile/photo` - Photo de profil
- `PUT /api/users/profile/password` - Changer le mot de passe
- `DELETE /api/users/profile` - Supprimer le compte

---

## ✅ Checklist Backend

- [ ] Créer `UserController` avec endpoint `/api/users/profile`
- [ ] Créer DTO `UserProfileDTO` (sans mot de passe)
- [ ] Créer DTO `UpdateProfileRequest`
- [ ] Implémenter la méthode `GET /api/users/profile`
- [ ] Implémenter la méthode `PUT /api/users/profile` (optionnel)
- [ ] Tester avec curl
- [ ] Vérifier que le JWT est bien validé
- [ ] Vérifier que les champs null sont gérés correctement

---

**Date:** 3 novembre 2025  
**API Version:** v1.0  
**Base URL:** https://afifi-mostafa.com:8443/api
