# Endpoints Backend pour le Badge de Notifications

Ce document décrit les endpoints backend nécessaires pour le bon fonctionnement du badge de notifications dans le header de l'application client.

## 📊 Endpoint Principal

### GET /api/notifications/unread/count
Récupère le nombre de notifications non lues pour l'utilisateur authentifié.

**Headers requis:**
- `Authorization: Bearer {token}`

**Réponse:**
```json
{
  "count": 5
}
```

**Code d'état:**
- `200 OK`: Succès
- `401 Unauthorized`: Token invalide ou manquant
- `500 Internal Server Error`: Erreur serveur

---

## 🔧 Exemples CURL

### 1. Obtenir le nombre de notifications non lues

```bash
curl -X GET "http://localhost:8080/api/notifications/unread/count" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Réponse attendue:**
```json
{
  "count": 3
}
```

---

### 2. Obtenir toutes les notifications non lues (détails)

```bash
curl -X GET "http://localhost:8080/api/notifications/unread" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Réponse attendue:**
```json
[
  {
    "id": 1,
    "userId": 123,
    "titre": "Nouvelle commande",
    "message": "Votre commande #456 a été confirmée",
    "type": "ORDER",
    "isRead": false,
    "dateCreated": "2025-01-07T22:30:00Z",
    "data": {
      "orderId": 456
    }
  },
  {
    "id": 2,
    "userId": 123,
    "titre": "Promotion",
    "message": "Profitez de -20% sur tous les produits",
    "type": "PROMOTION",
    "isRead": false,
    "dateCreated": "2025-01-07T21:15:00Z"
  }
]
```

---

### 3. Marquer toutes les notifications comme lues

```bash
curl -X PUT "http://localhost:8080/api/notifications/mark-all-read" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Réponse attendue:**
```json
{
  "message": "Toutes les notifications ont été marquées comme lues",
  "updatedCount": 5
}
```

---

### 4. Marquer une notification spécifique comme lue

```bash
curl -X PUT "http://localhost:8080/api/notifications/1/read" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Réponse attendue:**
```json
{
  "id": 1,
  "userId": 123,
  "titre": "Nouvelle commande",
  "message": "Votre commande #456 a été confirmée",
  "type": "ORDER",
  "isRead": true,
  "dateCreated": "2025-01-07T22:30:00Z",
  "dateRead": "2025-01-07T23:05:00Z",
  "data": {
    "orderId": 456
  }
}
```

---

### 5. Obtenir toutes les notifications (paginées)

```bash
curl -X GET "http://localhost:8080/api/notifications?page=0&size=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Réponse attendue:**
```json
[
  {
    "id": 1,
    "userId": 123,
    "titre": "Nouvelle commande",
    "message": "Votre commande #456 a été confirmée",
    "type": "ORDER",
    "isRead": true,
    "dateCreated": "2025-01-07T22:30:00Z",
    "dateRead": "2025-01-07T23:05:00Z"
  },
  {
    "id": 2,
    "userId": 123,
    "titre": "Livraison en cours",
    "message": "Votre commande est en cours de livraison",
    "type": "DELIVERY",
    "isRead": false,
    "dateCreated": "2025-01-07T20:00:00Z"
  }
]
```

---

## 🏗️ Structure du Modèle Backend (Java)

### NotificationController.java

```java
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    
    @Autowired
    private NotificationService notificationService;
    
    /**
     * Obtenir le nombre de notifications non lues
     */
    @GetMapping("/unread/count")
    public ResponseEntity<Map<String, Integer>> getUnreadCount(
            @AuthenticationPrincipal UserDetails userDetails) {
        
        Long userId = getUserIdFromUserDetails(userDetails);
        int count = notificationService.getUnreadCount(userId);
        
        return ResponseEntity.ok(Map.of("count", count));
    }
    
    /**
     * Obtenir toutes les notifications non lues
     */
    @GetMapping("/unread")
    public ResponseEntity<List<Notification>> getUnreadNotifications(
            @AuthenticationPrincipal UserDetails userDetails) {
        
        Long userId = getUserIdFromUserDetails(userDetails);
        List<Notification> notifications = notificationService.getUnreadNotifications(userId);
        
        return ResponseEntity.ok(notifications);
    }
    
    /**
     * Marquer toutes les notifications comme lues
     */
    @PutMapping("/mark-all-read")
    public ResponseEntity<Map<String, Object>> markAllAsRead(
            @AuthenticationPrincipal UserDetails userDetails) {
        
        Long userId = getUserIdFromUserDetails(userDetails);
        int updatedCount = notificationService.markAllAsRead(userId);
        
        return ResponseEntity.ok(Map.of(
            "message", "Toutes les notifications ont été marquées comme lues",
            "updatedCount", updatedCount
        ));
    }
    
    /**
     * Marquer une notification comme lue
     */
    @PutMapping("/{id}/read")
    public ResponseEntity<Notification> markAsRead(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        Long userId = getUserIdFromUserDetails(userDetails);
        Notification notification = notificationService.markAsRead(id, userId);
        
        return ResponseEntity.ok(notification);
    }
    
    /**
     * Obtenir toutes les notifications (paginées)
     */
    @GetMapping
    public ResponseEntity<List<Notification>> getAllNotifications(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        Long userId = getUserIdFromUserDetails(userDetails);
        List<Notification> notifications = notificationService.getAllNotifications(userId, page, size);
        
        return ResponseEntity.ok(notifications);
    }
    
    /**
     * Supprimer une notification
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNotification(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        Long userId = getUserIdFromUserDetails(userDetails);
        notificationService.deleteNotification(id, userId);
        
        return ResponseEntity.noContent().build();
    }
    
    private Long getUserIdFromUserDetails(UserDetails userDetails) {
        // Implémentation selon votre système d'authentification
        return ((CustomUserDetails) userDetails).getUserId();
    }
}
```

### NotificationService.java

```java
@Service
public class NotificationService {
    
    @Autowired
    private NotificationRepository notificationRepository;
    
    public int getUnreadCount(Long userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }
    
    public List<Notification> getUnreadNotifications(Long userId) {
        return notificationRepository.findByUserIdAndIsReadFalseOrderByDateCreatedDesc(userId);
    }
    
    public int markAllAsRead(Long userId) {
        List<Notification> notifications = notificationRepository.findByUserIdAndIsReadFalse(userId);
        
        for (Notification notification : notifications) {
            notification.setIsRead(true);
            notification.setDateRead(LocalDateTime.now());
        }
        
        notificationRepository.saveAll(notifications);
        return notifications.size();
    }
    
    public Notification markAsRead(Long id, Long userId) {
        Notification notification = notificationRepository
            .findByIdAndUserId(id, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
        
        notification.setIsRead(true);
        notification.setDateRead(LocalDateTime.now());
        
        return notificationRepository.save(notification);
    }
    
    public List<Notification> getAllNotifications(Long userId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("dateCreated").descending());
        return notificationRepository.findByUserId(userId, pageable).getContent();
    }
    
    public void deleteNotification(Long id, Long userId) {
        Notification notification = notificationRepository
            .findByIdAndUserId(id, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
        
        notificationRepository.delete(notification);
    }
}
```

### NotificationRepository.java

```java
@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    
    int countByUserIdAndIsReadFalse(Long userId);
    
    List<Notification> findByUserIdAndIsReadFalseOrderByDateCreatedDesc(Long userId);
    
    List<Notification> findByUserIdAndIsReadFalse(Long userId);
    
    Optional<Notification> findByIdAndUserId(Long id, Long userId);
    
    Page<Notification> findByUserId(Long userId, Pageable pageable);
}
```

### Notification.java (Entity)

```java
@Entity
@Table(name = "notifications")
public class Notification {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private Long userId;
    
    @Column(nullable = false, length = 255)
    private String titre;
    
    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private NotificationType type; // ORDER, PROMOTION, DELIVERY, ALERT, INFO
    
    @Column(nullable = false)
    private Boolean isRead = false;
    
    @Column(nullable = false)
    private LocalDateTime dateCreated;
    
    @Column
    private LocalDateTime dateRead;
    
    @Column(columnDefinition = "JSON")
    private String data; // JSON avec des données supplémentaires
    
    // Getters et Setters...
}
```

---

## 🧪 Tests avec curl (Développement Local)

### Configuration
Assurez-vous que votre backend tourne sur `http://localhost:8080`

### 1. Obtenir un token JWT
```bash
curl -X POST "http://localhost:8080/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "client@test.com",
    "password": "password123"
  }'
```

Copiez le token reçu pour les requêtes suivantes.

### 2. Tester le badge de notifications
```bash
# Définir le token (remplacer par votre token)
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Obtenir le count
curl -X GET "http://localhost:8080/api/notifications/unread/count" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Obtenir les notifications non lues
curl -X GET "http://localhost:8080/api/notifications/unread" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

---

## 📱 Comportement Frontend

Le badge de notifications:
- 🔄 Se rafraîchit automatiquement toutes les 30 secondes
- 🔄 Se rafraîchit à chaque changement d'écran dans l'application
- 🔔 Affiche un badge rouge avec le nombre de notifications non lues
- 🔔 Affiche "99+" si le nombre dépasse 99
- 👆 Redirige vers la page de notifications au clic
- ✅ Disparaît quand il n'y a plus de notifications non lues

---

## ⚠️ Notes Importantes

1. **Sécurité**: Tous les endpoints doivent vérifier que l'utilisateur authentifié ne peut accéder qu'à ses propres notifications
2. **Performance**: Utiliser des index sur `userId` et `isRead` dans la base de données
3. **Temps réel**: Pour des mises à jour en temps réel, considérez l'utilisation de WebSockets ou Server-Sent Events
4. **Cache**: Implémenter un cache côté backend pour les counts fréquemment demandés

---

## 🔍 Vérification Backend

Pour vérifier que votre backend est correctement configuré:

1. L'endpoint `/api/notifications/unread/count` doit exister
2. Il doit retourner un objet JSON avec la clé `count`
3. Il doit nécessiter une authentification JWT
4. Il doit filtrer les notifications par l'utilisateur authentifié
5. Il doit compter uniquement les notifications avec `isRead = false`
