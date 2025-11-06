# Backend Endpoints Documentation - Favorites Feature

## Overview

This document provides comprehensive API endpoint specifications for the favorites feature in EpicerieGo. All endpoints require authentication with a valid JWT token in the Authorization header.

## Authentication

All requests must include the following header:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## Endpoints

### 1. Get User's Favorite Epiceries

**Retrieve all favorite groceries for the authenticated user**

#### Request
```bash
curl -X GET "http://localhost:8090/api/favorites/epiceries" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

#### Method
```
GET /api/favorites/epiceries
```

#### Authentication
✅ Required (JWT Bearer Token)

#### Request Body
None

#### Query Parameters
None

#### Response (Success - 200 OK)
```json
[
  {
    "id": 1,
    "nomEpicerie": "Carrefour Express",
    "adresse": "123 Rue de la Paix, Paris",
    "telephone": "0123456789",
    "email": "contact@carrefour.fr",
    "latitude": 48.8566,
    "longitude": 2.3522,
    "nombreProducts": 450,
    "dateCreation": "2024-01-15T10:30:00Z"
  },
  {
    "id": 2,
    "nomEpicerie": "Auchan Hypermarché",
    "adresse": "45 Avenue des Champs, Casablanca",
    "telephone": "0234567890",
    "email": "contact@auchan.ma",
    "latitude": 33.5731,
    "longitude": -7.5898,
    "nombreProducts": 800,
    "dateCreation": "2024-02-10T14:45:00Z"
  }
]
```

#### Response (Empty List - 200 OK)
```json
[]
```

#### Response (Error - 401 Unauthorized)
```json
{
  "message": "Token invalide ou expiré",
  "error": "Unauthorized"
}
```

#### Response (Error - 500 Internal Server Error)
```json
{
  "message": "Erreur lors de la récupération des favoris",
  "error": "Internal Server Error"
}
```

#### Notes
- Returns an empty array if the user has no favorites
- Includes all epicerie information for each favorite

---

### 2. Add Epicerie to Favorites

**Add a specific epicerie to the user's favorites**

#### Request
```bash
curl -X POST "http://localhost:8090/api/favorites/epiceries/1" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

#### Method
```
POST /api/favorites/epiceries/{epicerieId}
```

#### Authentication
✅ Required (JWT Bearer Token)

#### URL Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `epicerieId` | number | The ID of the epicerie to add to favorites |

#### Request Body
```json
{}
```

#### Response (Success - 201 Created)
```json
{
  "message": "Epicerie ajoutée aux favoris",
  "data": {
    "id": 1,
    "userId": 123,
    "epicerieId": 1,
    "dateAdded": "2024-11-02T10:15:30Z"
  }
}
```

#### Response (Error - 400 Bad Request)
```json
{
  "message": "Cette épicerie est déjà dans vos favoris",
  "error": "Favorite already exists"
}
```

#### Response (Error - 404 Not Found)
```json
{
  "message": "Épicerie non trouvée",
  "error": "Epicerie not found"
}
```

#### Response (Error - 401 Unauthorized)
```json
{
  "message": "Token invalide ou expiré",
  "error": "Unauthorized"
}
```

#### Notes
- Cannot add the same epicerie twice
- Returns 400 if already favorited
- Requires valid epicerie ID

---

### 3. Remove Epicerie from Favorites

**Remove a specific epicerie from the user's favorites**

#### Request
```bash
curl -X DELETE "http://localhost:8090/api/favorites/epiceries/1" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

#### Method
```
DELETE /api/favorites/epiceries/{epicerieId}
```

#### Authentication
✅ Required (JWT Bearer Token)

#### URL Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `epicerieId` | number | The ID of the epicerie to remove from favorites |

#### Request Body
None

#### Response (Success - 200 OK)
```json
{
  "message": "Épicerie retirée des favoris",
  "data": {
    "removed": true,
    "epicerieId": 1,
    "timestamp": "2024-11-02T10:20:45Z"
  }
}
```

#### Response (Error - 404 Not Found)
```json
{
  "message": "Cette épicerie n'était pas dans vos favoris",
  "error": "Favorite not found"
}
```

#### Response (Error - 401 Unauthorized)
```json
{
  "message": "Token invalide ou expiré",
  "error": "Unauthorized"
}
```

#### Notes
- Safe to call even if epicerie is not in favorites
- Some APIs may return 404, others may return 200 with no action
- Returns HTTP 200 on success

---

### 4. Check if Epicerie is Favorite

**Check if a specific epicerie is in the user's favorites**

#### Request
```bash
curl -X GET "http://localhost:8090/api/favorites/epiceries/1/is-favorite" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

#### Method
```
GET /api/favorites/epiceries/{epicerieId}/is-favorite
```

#### Authentication
✅ Required (JWT Bearer Token)

#### URL Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `epicerieId` | number | The ID of the epicerie to check |

#### Request Body
None

#### Query Parameters
None

#### Response (Success - 200 OK)
```json
{
  "isFavorite": true,
  "epicerieId": 1,
  "userId": 123
}
```

#### Response (Not Favorited - 200 OK)
```json
{
  "isFavorite": false,
  "epicerieId": 1,
  "userId": 123
}
```

#### Response (Error - 404 Not Found)
```json
{
  "message": "Épicerie non trouvée",
  "error": "Epicerie not found"
}
```

#### Response (Error - 401 Unauthorized)
```json
{
  "message": "Token invalide ou expiré",
  "error": "Unauthorized"
}
```

#### Notes
- Returns boolean `isFavorite` field
- Always returns 200 status code for valid requests
- Useful for updating UI before user sees the page

---

## Error Codes Reference

| Status | Code | Meaning |
|--------|------|---------|
| 200 | OK | Request successful |
| 201 | Created | Resource successfully created |
| 400 | Bad Request | Invalid request (e.g., already favorited) |
| 401 | Unauthorized | Missing or invalid authentication token |
| 404 | Not Found | Epicerie or favorite not found |
| 500 | Internal Server Error | Server-side error |

---

## Implementation Examples

### Spring Boot (Java)

#### Controller
```java
@RestController
@RequestMapping("/api/favorites")
public class FavoritesController {

  @Autowired
  private FavoritesService favoritesService;

  // Get all favorites
  @GetMapping("/epiceries")
  public ResponseEntity<List<Epicerie>> getUserFavorites(
    @AuthenticationPrincipal UserDetails userDetails
  ) {
    List<Epicerie> favorites = favoritesService.getUserFavoriteEpiceries(userDetails.getUsername());
    return ResponseEntity.ok(favorites);
  }

  // Add to favorites
  @PostMapping("/epiceries/{epicerieId}")
  public ResponseEntity<?> addFavorite(
    @PathVariable Long epicerieId,
    @AuthenticationPrincipal UserDetails userDetails
  ) {
    try {
      favoritesService.addFavorite(userDetails.getUsername(), epicerieId);
      return ResponseEntity.status(HttpStatus.CREATED).body(
        Map.of("message", "Epicerie ajoutée aux favoris")
      );
    } catch (FavoriteAlreadyExistsException e) {
      return ResponseEntity.badRequest().body(
        Map.of("message", "Cette épicerie est déjà dans vos favoris")
      );
    }
  }

  // Remove from favorites
  @DeleteMapping("/epiceries/{epicerieId}")
  public ResponseEntity<?> removeFavorite(
    @PathVariable Long epicerieId,
    @AuthenticationPrincipal UserDetails userDetails
  ) {
    favoritesService.removeFavorite(userDetails.getUsername(), epicerieId);
    return ResponseEntity.ok(
      Map.of("message", "Épicerie retirée des favoris")
    );
  }

  // Check if favorite
  @GetMapping("/epiceries/{epicerieId}/is-favorite")
  public ResponseEntity<?> isFavorite(
    @PathVariable Long epicerieId,
    @AuthenticationPrincipal UserDetails userDetails
  ) {
    boolean isFavorite = favoritesService.isFavorite(userDetails.getUsername(), epicerieId);
    return ResponseEntity.ok(
      Map.of("isFavorite", isFavorite, "epicerieId", epicerieId)
    );
  }
}
```

#### Service
```java
@Service
public class FavoritesService {

  @Autowired
  private FavoritesRepository favoritesRepository;

  @Autowired
  private UserRepository userRepository;

  @Autowired
  private EpicerieRepository epicerieRepository;

  public List<Epicerie> getUserFavoriteEpiceries(String username) {
    User user = userRepository.findByEmail(username)
      .orElseThrow(() -> new UsernameNotFoundException("Utilisateur non trouvé"));

    return favoritesRepository.findByUser(user)
      .stream()
      .map(Favorite::getEpicerie)
      .collect(Collectors.toList());
  }

  public void addFavorite(String username, Long epicerieId) {
    User user = userRepository.findByEmail(username)
      .orElseThrow(() -> new UsernameNotFoundException("Utilisateur non trouvé"));

    Epicerie epicerie = epicerieRepository.findById(epicerieId)
      .orElseThrow(() -> new EntityNotFoundException("Épicerie non trouvée"));

    if (favoritesRepository.existsByUserAndEpicerie(user, epicerie)) {
      throw new FavoriteAlreadyExistsException("Cette épicerie est déjà dans vos favoris");
    }

    Favorite favorite = new Favorite();
    favorite.setUser(user);
    favorite.setEpicerie(epicerie);
    favorite.setDateAdded(LocalDateTime.now());

    favoritesRepository.save(favorite);
  }

  public void removeFavorite(String username, Long epicerieId) {
    User user = userRepository.findByEmail(username)
      .orElseThrow(() -> new UsernameNotFoundException("Utilisateur non trouvé"));

    Epicerie epicerie = epicerieRepository.findById(epicerieId)
      .orElseThrow(() -> new EntityNotFoundException("Épicerie non trouvée"));

    favoritesRepository.deleteByUserAndEpicerie(user, epicerie);
  }

  public boolean isFavorite(String username, Long epicerieId) {
    User user = userRepository.findByEmail(username)
      .orElseThrow(() -> new UsernameNotFoundException("Utilisateur non trouvé"));

    Epicerie epicerie = epicerieRepository.findById(epicerieId)
      .orElseThrow(() -> new EntityNotFoundException("Épicerie non trouvée"));

    return favoritesRepository.existsByUserAndEpicerie(user, epicerie);
  }
}
```

#### JPA Repository
```java
public interface FavoritesRepository extends JpaRepository<Favorite, Long> {
  List<Favorite> findByUser(User user);

  boolean existsByUserAndEpicerie(User user, Epicerie epicerie);

  void deleteByUserAndEpicerie(User user, Epicerie epicerie);
}
```

#### Entity
```java
@Entity
@Table(name = "favorites")
public class Favorite {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id", nullable = false)
  private User user;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "epicerie_id", nullable = false)
  private Epicerie epicerie;

  @Column(name = "date_added", nullable = false)
  private LocalDateTime dateAdded;

  // Getters and Setters
  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }

  public User getUser() { return user; }
  public void setUser(User user) { this.user = user; }

  public Epicerie getEpicerie() { return epicerie; }
  public void setEpicerie(Epicerie epicerie) { this.epicerie = epicerie; }

  public LocalDateTime getDateAdded() { return dateAdded; }
  public void setDateAdded(LocalDateTime dateAdded) { this.dateAdded = dateAdded; }
}
```

---

## Database Schema (SQL)

### Create Favorites Table
```sql
CREATE TABLE favorites (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  epicerie_id BIGINT NOT NULL,
  date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_epicerie (user_id, epicerie_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (epicerie_id) REFERENCES epiceries(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_epicerie_id (epicerie_id)
);
```

### Indexes for Performance
```sql
-- Get all favorites for a user (most common query)
CREATE INDEX idx_user_id_date ON favorites(user_id, date_added DESC);

-- Check if specific epicerie is favorited
CREATE INDEX idx_user_epicerie ON favorites(user_id, epicerie_id);

-- Find all users who favorited an epicerie
CREATE INDEX idx_epicerie_id_user ON favorites(epicerie_id, user_id);
```

---

## Frontend Integration Guide

### Using favoritesService

#### Get all favorite epiceries
```typescript
const favorites = await favoritesService.getFavoriteEpiceries();
```

#### Add to favorites
```typescript
const success = await favoritesService.addFavorite(epicerieId);
if (success) {
  console.log('Added to favorites');
}
```

#### Remove from favorites
```typescript
const success = await favoritesService.removeFavorite(epicerieId);
if (success) {
  console.log('Removed from favorites');
}
```

#### Check if favorite
```typescript
const isFav = await favoritesService.isFavorite(epicerieId);
if (isFav) {
  setHeartIcon('❤️');
} else {
  setHeartIcon('🤍');
}
```

#### Toggle favorite
```typescript
const isFav = favoriteIds.includes(epicerieId);
const success = await favoritesService.toggleFavorite(epicerieId, isFav);
```

#### Get all favorite IDs for quick checks
```typescript
const favoriteIds = await favoritesService.getFavoriteIds();
const isFav = favoriteIds.includes(epicerieId);
```

---

## Testing with Postman/cURL

### Step 1: Get Authentication Token
```bash
curl -X POST "http://localhost:8090/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "client@example.com",
    "password": "password123"
  }'

# Response contains: { "token": "eyJhbGciOiJIUzI1NiIs..." }
```

### Step 2: Add to Favorites (using token from step 1)
```bash
curl -X POST "http://localhost:8090/api/favorites/epiceries/1" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json"
```

### Step 3: Get All Favorites
```bash
curl -X GET "http://localhost:8090/api/favorites/epiceries" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json"
```

### Step 4: Check if Favorite
```bash
curl -X GET "http://localhost:8090/api/favorites/epiceries/1/is-favorite" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json"
```

### Step 5: Remove from Favorites
```bash
curl -X DELETE "http://localhost:8090/api/favorites/epiceries/1" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json"
```

---

## Features Implemented

✅ **Frontend**
- Favorites service with local fallback (AsyncStorage)
- Favorites page showing all favorited epiceries
- Heart icon on epicery cards to add/remove favorites
- Real-time favorite status updates
- Loading states and error handling

✅ **Backend (Specifications)**
- Get all user favorites
- Add epicerie to favorites
- Remove epicerie from favorites
- Check favorite status
- Unique constraint to prevent duplicates
- Proper error handling and validation

---

## Notes for Backend Developers

1. **Unique Constraint**: Ensure database has unique constraint on (user_id, epicerie_id) to prevent duplicate favorites

2. **Cascade Delete**: When a user or epicerie is deleted, remove associated favorites

3. **Performance**: Add indexes on user_id and (user_id, epicerie_id) for fast lookups

4. **Date Tracking**: Store when favorite was added for potential "trending" features

5. **Pagination**: For users with many favorites, consider adding pagination:
   ```
   GET /api/favorites/epiceries?page=0&size=20
   ```

6. **Sorting**: Consider adding sort options:
   ```
   GET /api/favorites/epiceries?sort=date_added,desc
   ```

---

**Last Updated**: 2024-11-02
**Frontend Version**: Compatible with favoritesService v1.0
