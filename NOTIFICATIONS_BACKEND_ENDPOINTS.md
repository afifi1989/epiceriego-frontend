# Backend Endpoints Documentation - Notifications Feature

## Overview

This document provides comprehensive API endpoint specifications for the notifications system in EpicerieGo. All endpoints require authentication with a valid JWT token in the Authorization header.

---

## Authentication

All requests must include the following header:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## Endpoints

### 1. Get All Notifications (Paginated)

**Retrieve all notifications for the authenticated user**

#### Request
```bash
curl -X GET "http://localhost:8090/api/notifications?page=0&size=50" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

#### Method
```
GET /api/notifications
```

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 0 | Page number (0-indexed) |
| `size` | integer | No | 50 | Number of notifications per page |
| `sort` | string | No | dateCreated,desc | Sort order |

#### Response (Success - 200 OK)
```json
[
  {
    "id": 1,
    "userId": 123,
    "titre": "Commande confirmée",
    "message": "Votre commande #12345 a été confirmée par l'épicerie",
    "type": "ORDER",
    "isRead": false,
    "dateCreated": "2024-11-02T10:30:00Z",
    "dateRead": null,
    "data": {
      "orderId": 12345,
      "epicerieId": 1
    }
  },
  {
    "id": 2,
    "userId": 123,
    "titre": "Promotion spéciale",
    "message": "30% de réduction sur les fruits frais cette semaine",
    "type": "PROMOTION",
    "isRead": true,
    "dateCreated": "2024-11-01T15:45:00Z",
    "dateRead": "2024-11-01T16:00:00Z",
    "data": {
      "epicerieId": 2,
      "promoCode": "FRUITS30"
    }
  }
]
```

#### Response (Empty - 200 OK)
```json
[]
```

---

### 2. Get Unread Notifications

**Retrieve only unread notifications**

#### Request
```bash
curl -X GET "http://localhost:8090/api/notifications/unread" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

#### Method
```
GET /api/notifications/unread
```

#### Response (Success - 200 OK)
```json
[
  {
    "id": 1,
    "userId": 123,
    "titre": "Commande confirmée",
    "message": "Votre commande #12345 a été confirmée",
    "type": "ORDER",
    "isRead": false,
    "dateCreated": "2024-11-02T10:30:00Z",
    "dateRead": null
  }
]
```

---

### 3. Get Unread Count

**Get the number of unread notifications**

#### Request
```bash
curl -X GET "http://localhost:8090/api/notifications/unread/count" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

#### Method
```
GET /api/notifications/unread/count
```

#### Response (Success - 200 OK)
```json
{
  "count": 5,
  "userId": 123
}
```

---

### 4. Mark Notification as Read

**Mark a specific notification as read**

#### Request
```bash
curl -X PUT "http://localhost:8090/api/notifications/1/read" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

#### Method
```
PUT /api/notifications/{notificationId}/read
```

#### URL Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `notificationId` | number | The ID of the notification to mark as read |

#### Request Body
```json
{}
```

#### Response (Success - 200 OK)
```json
{
  "message": "Notification marquée comme lue",
  "data": {
    "id": 1,
    "isRead": true,
    "dateRead": "2024-11-02T10:35:00Z"
  }
}
```

#### Response (Error - 404 Not Found)
```json
{
  "message": "Notification non trouvée",
  "error": "Not Found"
}
```

---

### 5. Mark All Notifications as Read

**Mark all notifications as read for the user**

#### Request
```bash
curl -X PUT "http://localhost:8090/api/notifications/mark-all-read" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

#### Method
```
PUT /api/notifications/mark-all-read
```

#### Request Body
```json
{}
```

#### Response (Success - 200 OK)
```json
{
  "message": "Toutes les notifications marquées comme lues",
  "data": {
    "count": 5,
    "userId": 123
  }
}
```

---

### 6. Delete Notification

**Delete a specific notification**

#### Request
```bash
curl -X DELETE "http://localhost:8090/api/notifications/1" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

#### Method
```
DELETE /api/notifications/{notificationId}
```

#### URL Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `notificationId` | number | The ID of the notification to delete |

#### Response (Success - 200 OK)
```json
{
  "message": "Notification supprimée",
  "data": {
    "deleted": true,
    "notificationId": 1,
    "timestamp": "2024-11-02T10:40:00Z"
  }
}
```

#### Response (Error - 404 Not Found)
```json
{
  "message": "Notification non trouvée",
  "error": "Not Found"
}
```

---

## Error Codes Reference

| Status | Code | Meaning |
|--------|------|---------|
| 200 | OK | Request successful |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid authentication token |
| 404 | Not Found | Notification not found |
| 500 | Internal Server Error | Server-side error |

---

## Spring Boot Implementation Examples

### Entity
```java
@Entity
@Table(name = "notifications")
public class Notification {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id", nullable = false)
  private User user;

  @Column(nullable = false, length = 100)
  private String titre;

  @Column(nullable = false, columnDefinition = "TEXT")
  private String message;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private NotificationType type; // ORDER, PROMOTION, DELIVERY, ALERT, INFO

  @Column(nullable = false)
  private Boolean isRead = false;

  @Column(nullable = false)
  private LocalDateTime dateCreated;

  @Column
  private LocalDateTime dateRead;

  @Column(columnDefinition = "JSON")
  private String data; // Pour stocker des données supplémentaires en JSON

  // Getters and Setters
  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }

  public User getUser() { return user; }
  public void setUser(User user) { this.user = user; }

  public String getTitre() { return titre; }
  public void setTitre(String titre) { this.titre = titre; }

  public String getMessage() { return message; }
  public void setMessage(String message) { this.message = message; }

  public NotificationType getType() { return type; }
  public void setType(NotificationType type) { this.type = type; }

  public Boolean getIsRead() { return isRead; }
  public void setIsRead(Boolean isRead) { this.isRead = isRead; }

  public LocalDateTime getDateCreated() { return dateCreated; }
  public void setDateCreated(LocalDateTime dateCreated) { this.dateCreated = dateCreated; }

  public LocalDateTime getDateRead() { return dateRead; }
  public void setDateRead(LocalDateTime dateRead) { this.dateRead = dateRead; }

  public String getData() { return data; }
  public void setData(String data) { this.data = data; }
}
```

### Enum
```java
public enum NotificationType {
  ORDER,      // Commande
  PROMOTION,  // Promotion
  DELIVERY,   // Livraison
  ALERT,      // Alerte
  INFO        // Information
}
```

### Repository
```java
public interface NotificationRepository extends JpaRepository<Notification, Long> {

  // Get all notifications for a user, sorted by date
  Page<Notification> findByUserOrderByDateCreatedDesc(User user, Pageable pageable);

  // Get unread notifications for a user
  List<Notification> findByUserAndIsReadFalseOrderByDateCreatedDesc(User user);

  // Count unread notifications for a user
  long countByUserAndIsReadFalse(User user);

  // Find specific notification by ID and user
  Optional<Notification> findByIdAndUser(Long id, User user);

  // Delete notification by ID and user
  void deleteByIdAndUser(Long id, User user);
}
```

### Service
```java
@Service
public class NotificationService {

  @Autowired
  private NotificationRepository notificationRepository;

  @Autowired
  private UserRepository userRepository;

  /**
   * Get all notifications for user (paginated)
   */
  public Page<NotificationDTO> getAllNotifications(String username, Pageable pageable) {
    User user = userRepository.findByEmail(username)
      .orElseThrow(() -> new UsernameNotFoundException("User not found"));

    Page<Notification> notifications = notificationRepository.findByUserOrderByDateCreatedDesc(user, pageable);
    return notifications.map(this::convertToDTO);
  }

  /**
   * Get unread notifications only
   */
  public List<NotificationDTO> getUnreadNotifications(String username) {
    User user = userRepository.findByEmail(username)
      .orElseThrow(() -> new UsernameNotFoundException("User not found"));

    List<Notification> unread = notificationRepository
      .findByUserAndIsReadFalseOrderByDateCreatedDesc(user);

    return unread.stream()
      .map(this::convertToDTO)
      .collect(Collectors.toList());
  }

  /**
   * Get unread count
   */
  public long getUnreadCount(String username) {
    User user = userRepository.findByEmail(username)
      .orElseThrow(() -> new UsernameNotFoundException("User not found"));

    return notificationRepository.countByUserAndIsReadFalse(user);
  }

  /**
   * Mark notification as read
   */
  public NotificationDTO markAsRead(Long notificationId, String username) {
    User user = userRepository.findByEmail(username)
      .orElseThrow(() -> new UsernameNotFoundException("User not found"));

    Notification notification = notificationRepository.findByIdAndUser(notificationId, user)
      .orElseThrow(() -> new EntityNotFoundException("Notification not found"));

    notification.setIsRead(true);
    notification.setDateRead(LocalDateTime.now());

    return convertToDTO(notificationRepository.save(notification));
  }

  /**
   * Mark all notifications as read
   */
  public void markAllAsRead(String username) {
    User user = userRepository.findByEmail(username)
      .orElseThrow(() -> new UsernameNotFoundException("User not found"));

    List<Notification> unread = notificationRepository
      .findByUserAndIsReadFalseOrderByDateCreatedDesc(user);

    LocalDateTime now = LocalDateTime.now();

    unread.forEach(notification -> {
      notification.setIsRead(true);
      notification.setDateRead(now);
    });

    notificationRepository.saveAll(unread);
  }

  /**
   * Delete notification
   */
  public void deleteNotification(Long notificationId, String username) {
    User user = userRepository.findByEmail(username)
      .orElseThrow(() -> new UsernameNotFoundException("User not found"));

    notificationRepository.findByIdAndUser(notificationId, user)
      .ifPresent(notification -> notificationRepository.delete(notification));
  }

  /**
   * Create notification (internal use)
   */
  public NotificationDTO createNotification(User user, String titre, String message,
      NotificationType type, String data) {
    Notification notification = new Notification();
    notification.setUser(user);
    notification.setTitre(titre);
    notification.setMessage(message);
    notification.setType(type);
    notification.setData(data);
    notification.setDateCreated(LocalDateTime.now());
    notification.setIsRead(false);

    return convertToDTO(notificationRepository.save(notification));
  }

  private NotificationDTO convertToDTO(Notification notification) {
    return new NotificationDTO(
      notification.getId(),
      notification.getTitre(),
      notification.getMessage(),
      notification.getType().toString(),
      notification.getIsRead(),
      notification.getDateCreated(),
      notification.getDateRead()
    );
  }
}
```

### Controller
```java
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

  @Autowired
  private NotificationService notificationService;

  /**
   * GET /api/notifications?page=0&size=50
   */
  @GetMapping
  public ResponseEntity<Page<NotificationDTO>> getAllNotifications(
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "50") int size,
    @AuthenticationPrincipal UserDetails userDetails
  ) {
    Pageable pageable = PageRequest.of(page, size, Sort.by("dateCreated").descending());
    Page<NotificationDTO> notifications = notificationService.getAllNotifications(
      userDetails.getUsername(), pageable
    );
    return ResponseEntity.ok(notifications);
  }

  /**
   * GET /api/notifications/unread
   */
  @GetMapping("/unread")
  public ResponseEntity<List<NotificationDTO>> getUnreadNotifications(
    @AuthenticationPrincipal UserDetails userDetails
  ) {
    List<NotificationDTO> unread = notificationService.getUnreadNotifications(
      userDetails.getUsername()
    );
    return ResponseEntity.ok(unread);
  }

  /**
   * GET /api/notifications/unread/count
   */
  @GetMapping("/unread/count")
  public ResponseEntity<?> getUnreadCount(
    @AuthenticationPrincipal UserDetails userDetails
  ) {
    long count = notificationService.getUnreadCount(userDetails.getUsername());
    return ResponseEntity.ok(Map.of("count", count));
  }

  /**
   * PUT /api/notifications/{id}/read
   */
  @PutMapping("/{id}/read")
  public ResponseEntity<NotificationDTO> markAsRead(
    @PathVariable Long id,
    @AuthenticationPrincipal UserDetails userDetails
  ) {
    NotificationDTO dto = notificationService.markAsRead(id, userDetails.getUsername());
    return ResponseEntity.ok(dto);
  }

  /**
   * PUT /api/notifications/mark-all-read
   */
  @PutMapping("/mark-all-read")
  public ResponseEntity<?> markAllAsRead(
    @AuthenticationPrincipal UserDetails userDetails
  ) {
    notificationService.markAllAsRead(userDetails.getUsername());
    return ResponseEntity.ok(Map.of("message", "All notifications marked as read"));
  }

  /**
   * DELETE /api/notifications/{id}
   */
  @DeleteMapping("/{id}")
  public ResponseEntity<?> deleteNotification(
    @PathVariable Long id,
    @AuthenticationPrincipal UserDetails userDetails
  ) {
    notificationService.deleteNotification(id, userDetails.getUsername());
    return ResponseEntity.ok(Map.of("message", "Notification deleted"));
  }
}
```

---

## Database Schema (SQL)

### Create Notifications Table
```sql
CREATE TABLE notifications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  titre VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('ORDER', 'PROMOTION', 'DELIVERY', 'ALERT', 'INFO') NOT NULL,
  is_read BOOLEAN DEFAULT false,
  date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  date_read TIMESTAMP NULL,
  data JSON NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_user_is_read (user_id, is_read),
  INDEX idx_date_created (date_created DESC)
);
```

---

## Testing with cURL

### 1. Get Authentication Token
```bash
curl -X POST "http://localhost:8090/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "client@example.com",
    "password": "password123"
  }'

# Response contains token
```

### 2. Get All Notifications
```bash
TOKEN="eyJhbGciOiJIUzI1NiIs..."

curl -X GET "http://localhost:8090/api/notifications?page=0&size=50" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

### 3. Get Unread Notifications
```bash
curl -X GET "http://localhost:8090/api/notifications/unread" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

### 4. Get Unread Count
```bash
curl -X GET "http://localhost:8090/api/notifications/unread/count" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

### 5. Mark as Read
```bash
curl -X PUT "http://localhost:8090/api/notifications/1/read" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 6. Mark All as Read
```bash
curl -X PUT "http://localhost:8090/api/notifications/mark-all-read" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 7. Delete Notification
```bash
curl -X DELETE "http://localhost:8090/api/notifications/1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

---

## Frontend Integration

### Import Service
```typescript
import { notificationService } from '../../src/services/notificationService';
```

### Get All Notifications
```typescript
const notifications = await notificationService.getAllNotifications(0, 50);
```

### Get Unread Notifications
```typescript
const unread = await notificationService.getUnreadNotifications();
```

### Get Unread Count
```typescript
const count = await notificationService.getUnreadCount();
```

### Mark as Read
```typescript
await notificationService.markAsRead(notificationId);
```

### Mark All as Read
```typescript
await notificationService.markAllAsRead();
```

### Delete Notification
```typescript
await notificationService.deleteNotification(notificationId);
```

---

**Last Updated**: 2024-11-02
**Version**: 1.0.0
