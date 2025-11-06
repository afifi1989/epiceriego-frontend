# Push Notifications - Backend Implementation Guide

## Overview

This guide provides everything needed to implement push notifications on the backend. The frontend is already fully configured and ready to receive notifications.

---

## 📱 How It Works

1. **Client Registration**
   - User logs in
   - App requests push notification permissions
   - Expo generates a push token
   - Token is sent to backend

2. **Storing Token**
   - Backend stores token per user device
   - Multiple tokens per user (for multiple devices)

3. **Sending Notifications**
   - Backend sends push notification via Expo
   - Notification appears on user's phone
   - User clicks notification

4. **Deep Linking**
   - User clicks notification
   - App opens (if closed) or comes to foreground
   - Notification handler redirects to appropriate page
   - If user not logged in → login page
   - If logged in → target page (notifications, order detail, etc.)

---

## 🔌 Backend Endpoints Required

### 1. Register Device for Push Notifications

**Client sends push token to server**

#### cURL
```bash
curl -X POST "http://localhost:8090/api/notifications/register-device" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "expoPushToken": "ExponentPushToken[...]",
    "deviceType": "iPhone 13",
    "platform": "iOS"
  }'
```

#### Method
```
POST /api/notifications/register-device
```

#### Request Body
```json
{
  "expoPushToken": "ExponentPushToken[abc123...]",
  "deviceType": "iPhone 13",
  "platform": "iOS or Android"
}
```

#### Response (Success - 200 OK)
```json
{
  "message": "Device registered successfully",
  "data": {
    "deviceId": 1,
    "userId": 123,
    "expoPushToken": "ExponentPushToken[...]",
    "isActive": true,
    "dateRegistered": "2024-11-02T10:30:00Z"
  }
}
```

#### Response (Error - 400 Bad Request)
```json
{
  "message": "Invalid push token",
  "error": "Bad Request"
}
```

---

### 2. Send Push Notification to User

**Backend internal - called when event occurs**

This endpoint is called internally when:
- Order status changes
- Promotion is available
- Delivery is happening
- Alert needs to be sent

#### Structure (Internal)
```
POST /api/notifications/send-to-user
```

**NOT exposed to clients, used by backend services**

---

## 🔧 Spring Boot Implementation

### 1. Entity - Device

```java
@Entity
@Table(name = "push_notification_devices")
public class PushNotificationDevice {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id", nullable = false)
  private User user;

  @Column(nullable = false, unique = false, length = 500)
  private String expoPushToken;

  @Column(nullable = false)
  private String deviceType; // iPhone 13, Samsung Galaxy S21, etc.

  @Column(nullable = false)
  private String platform; // iOS, Android

  @Column(nullable = false)
  private Boolean isActive = true;

  @Column(nullable = false)
  private LocalDateTime dateRegistered;

  @Column
  private LocalDateTime lastUsed;

  // Getters and Setters
  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }

  public User getUser() { return user; }
  public void setUser(User user) { this.user = user; }

  public String getExpoPushToken() { return expoPushToken; }
  public void setExpoPushToken(String expoPushToken) { this.expoPushToken = expoPushToken; }

  public String getDeviceType() { return deviceType; }
  public void setDeviceType(String deviceType) { this.deviceType = deviceType; }

  public String getPlatform() { return platform; }
  public void setPlatform(String platform) { this.platform = platform; }

  public Boolean getIsActive() { return isActive; }
  public void setIsActive(Boolean isActive) { this.isActive = isActive; }

  public LocalDateTime getDateRegistered() { return dateRegistered; }
  public void setDateRegistered(LocalDateTime dateRegistered) { this.dateRegistered = dateRegistered; }

  public LocalDateTime getLastUsed() { return lastUsed; }
  public void setLastUsed(LocalDateTime lastUsed) { this.lastUsed = lastUsed; }
}
```

### 2. Repository

```java
public interface PushNotificationDeviceRepository extends JpaRepository<PushNotificationDevice, Long> {

  // Find all active devices for a user
  List<PushNotificationDevice> findByUserAndIsActiveTrue(User user);

  // Find specific device
  Optional<PushNotificationDevice> findByExpoPushToken(String token);

  // Find by user and token
  Optional<PushNotificationDevice> findByUserAndExpoPushToken(User user, String token);

  // Delete old devices
  void deleteByDateRegisteredBefore(LocalDateTime date);

  // Count devices per user
  long countByUserAndIsActiveTrue(User user);
}
```

### 3. Service - Push Notification Sender

```java
@Service
public class PushNotificationSenderService {

  @Value("${expo.push.api.url:https://exp.host/--/api/v2/push/send}")
  private String expoPushApiUrl;

  @Autowired
  private PushNotificationDeviceRepository deviceRepository;

  @Autowired
  private RestTemplate restTemplate;

  /**
   * Send push notification to user
   */
  public void sendNotificationToUser(User user, String titre, String message,
      String notificationType, Map<String, Object> data) {
    try {
      List<PushNotificationDevice> devices = deviceRepository.findByUserAndIsActiveTrue(user);

      for (PushNotificationDevice device : devices) {
        sendNotificationToDevice(device, titre, message, notificationType, data);
      }
    } catch (Exception e) {
      System.err.println("[PushNotificationSenderService] Error sending notification: " + e.getMessage());
    }
  }

  /**
   * Send to specific device
   */
  private void sendNotificationToDevice(PushNotificationDevice device, String titre, String message,
      String notificationType, Map<String, Object> data) {
    try {
      Map<String, Object> payload = new HashMap<>();
      payload.put("to", device.getExpoPushToken());
      payload.put("sound", "default");
      payload.put("title", titre);
      payload.put("body", message);

      // Add data for deep linking
      Map<String, Object> notificationData = new HashMap<>(data);
      notificationData.put("type", notificationType);
      payload.put("data", notificationData);

      // Send via Expo API
      restTemplate.postForObject(expoPushApiUrl, payload, Map.class);

      // Update last used
      device.setLastUsed(LocalDateTime.now());
      deviceRepository.save(device);

      System.out.println("[PushNotificationSenderService] Notification sent to device: " + device.getId());
    } catch (Exception e) {
      System.err.println("[PushNotificationSenderService] Error sending to device: " + e.getMessage());
    }
  }

  /**
   * Send order notification
   */
  public void sendOrderNotification(User user, Long orderId, String message) {
    Map<String, Object> data = new HashMap<>();
    data.put("orderId", orderId);
    data.put("type", "ORDER");

    sendNotificationToUser(user, "Commande #" + orderId, message, "ORDER_DETAIL", data);
  }

  /**
   * Send promotion notification
   */
  public void sendPromotionNotification(User user, Long epicerieId, String message) {
    Map<String, Object> data = new HashMap<>();
    data.put("epicerieId", epicerieId);
    data.put("type", "PROMOTION");

    sendNotificationToUser(user, "Promotion spéciale", message, "PROMO", data);
  }

  /**
   * Send delivery notification
   */
  public void sendDeliveryNotification(User user, Long deliveryId, String message) {
    Map<String, Object> data = new HashMap<>();
    data.put("deliveryId", deliveryId);
    data.put("type", "DELIVERY");

    sendNotificationToUser(user, "Livraison", message, "DELIVERY", data);
  }
}
```

### 4. Controller

```java
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

  @Autowired
  private PushNotificationDeviceService deviceService;

  /**
   * POST /api/notifications/register-device
   */
  @PostMapping("/register-device")
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

      return ResponseEntity.ok(
        Map.of(
          "message", "Device registered successfully",
          "data", device
        )
      );
    } catch (Exception e) {
      return ResponseEntity.badRequest().body(
        Map.of("message", "Error registering device")
      );
    }
  }

  /**
   * Other notification endpoints
   * (get all, unread, mark as read, delete)
   * Already implemented in NOTIFICATIONS_BACKEND_ENDPOINTS.md
   */
}
```

### 5. Request DTO

```java
public class RegisterDeviceRequest {
  private String expoPushToken;
  private String deviceType;
  private String platform;

  // Getters and Setters
  public String getExpoPushToken() { return expoPushToken; }
  public void setExpoPushToken(String expoPushToken) { this.expoPushToken = expoPushToken; }

  public String getDeviceType() { return deviceType; }
  public void setDeviceType(String deviceType) { this.deviceType = deviceType; }

  public String getPlatform() { return platform; }
  public void setPlatform(String platform) { this.platform = platform; }
}
```

### 6. Service - Device Management

```java
@Service
public class PushNotificationDeviceService {

  @Autowired
  private PushNotificationDeviceRepository deviceRepository;

  @Autowired
  private UserRepository userRepository;

  /**
   * Register or update device
   */
  public PushNotificationDevice registerDevice(String username, String expoPushToken,
      String deviceType, String platform) {
    User user = userRepository.findByEmail(username)
      .orElseThrow(() -> new UsernameNotFoundException("User not found"));

    // Check if device already registered
    Optional<PushNotificationDevice> existing = deviceRepository.findByUserAndExpoPushToken(user, expoPushToken);

    if (existing.isPresent()) {
      PushNotificationDevice device = existing.get();
      device.setIsActive(true);
      device.setLastUsed(LocalDateTime.now());
      return deviceRepository.save(device);
    }

    // Create new device
    PushNotificationDevice device = new PushNotificationDevice();
    device.setUser(user);
    device.setExpoPushToken(expoPushToken);
    device.setDeviceType(deviceType);
    device.setPlatform(platform);
    device.setDateRegistered(LocalDateTime.now());
    device.setIsActive(true);

    return deviceRepository.save(device);
  }

  /**
   * Unregister device
   */
  public void unregisterDevice(String username, String expoPushToken) {
    User user = userRepository.findByEmail(username)
      .orElseThrow(() -> new UsernameNotFoundException("User not found"));

    deviceRepository.findByUserAndExpoPushToken(user, expoPushToken)
      .ifPresent(device -> {
        device.setIsActive(false);
        deviceRepository.save(device);
      });
  }

  /**
   * Get user's devices
   */
  public List<PushNotificationDevice> getUserDevices(String username) {
    User user = userRepository.findByEmail(username)
      .orElseThrow(() -> new UsernameNotFoundException("User not found"));

    return deviceRepository.findByUserAndIsActiveTrue(user);
  }
}
```

---

## 📨 Sending Notifications from Business Logic

### Example: When Order Status Changes

```java
@Service
public class OrderService {

  @Autowired
  private PushNotificationSenderService pushService;

  public void updateOrderStatus(Long orderId, OrderStatus status) {
    Order order = orderRepository.findById(orderId).orElseThrow();
    order.setStatus(status);

    // Send notification to user
    String message = getStatusMessage(status);
    pushService.sendOrderNotification(order.getUser(), orderId, message);

    // Also save to notification table
    notificationService.createNotification(
      order.getUser(),
      "Commande #" + orderId,
      message,
      NotificationType.ORDER,
      Map.of("orderId", orderId)
    );

    orderRepository.save(order);
  }

  private String getStatusMessage(OrderStatus status) {
    switch (status) {
      case CONFIRMED: return "Votre commande a été confirmée";
      case PREPARING: return "Votre commande est en préparation";
      case READY: return "Votre commande est prête";
      case DELIVERING: return "Votre commande est en livraison";
      case DELIVERED: return "Votre commande a été livrée";
      case CANCELLED: return "Votre commande a été annulée";
      default: return "Mise à jour de statut";
    }
  }
}
```

---

## 🗄️ Database Schema

```sql
CREATE TABLE push_notification_devices (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  expo_push_token VARCHAR(500) NOT NULL,
  device_type VARCHAR(100) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  date_registered TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_user_active (user_id, is_active),
  INDEX idx_token (expo_push_token)
);
```

---

## 🧪 Testing Push Notifications

### 1. Register Device
```bash
TOKEN="eyJhbGciOiJIUzI1NiIs..."
EXPO_TOKEN="ExponentPushToken[abc123...]"

curl -X POST "http://localhost:8090/api/notifications/register-device" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"expoPushToken\": \"$EXPO_TOKEN\",
    \"deviceType\": \"iPhone 13\",
    \"platform\": \"iOS\"
  }"
```

### 2. Send Test Notification (Using Expo)
```bash
curl -X POST "https://exp.host/--/api/v2/push/send" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "ExponentPushToken[abc123...]",
    "sound": "default",
    "title": "Test Notification",
    "body": "This is a test",
    "data": {
      "type": "ORDER",
      "orderId": 123
    }
  }'
```

---

## 🔗 Deep Link Handling

The frontend automatically handles deep links based on notification type:

| Type | Action |
|------|--------|
| ORDER | Redirects to orders page or specific order |
| NOTIFICATION | Redirects to notifications page |
| PROMOTION | Redirects to epicerie details |
| DELIVERY | Redirects to order details |
| ALERT | Redirects to notifications page |
| INFO | Redirects to notifications page |

---

## ⚙️ Configuration

### Add to `application.properties`
```properties
# Expo Push API
expo.push.api.url=https://exp.host/--/api/v2/push/send

# Or for custom configuration
notification.push.enabled=true
notification.push.provider=expo
```

---

## 📊 Workflow Summary

```
1. User logs in
   ↓
2. App requests notification permissions
   ↓
3. Expo generates token
   ↓
4. App sends token to backend
   ↓
5. Backend stores token in database
   ↓
6. Backend event occurs (order status, promotion, etc.)
   ↓
7. Backend sends push notification via Expo
   ↓
8. User receives notification on phone
   ↓
9. User clicks notification
   ↓
10. App opens/comes to foreground
   ↓
11. App checks if user is logged in
   ↓
12. If logged in → Navigate to target page
    If NOT logged in → Show login page
```

---

## 🚀 Summary

### What Frontend Does
- ✅ Requests notification permissions
- ✅ Gets push token from Expo
- ✅ Sends token to backend
- ✅ Listens for incoming notifications
- ✅ Handles notification clicks
- ✅ Checks authentication
- ✅ Redirects to appropriate page

### What Backend Must Do
1. ✅ Create `PushNotificationDevice` entity
2. ✅ Create repository for devices
3. ✅ Create service to register devices
4. ✅ Create service to send notifications
5. ✅ Implement `/register-device` endpoint
6. ✅ Call push notification service from business logic
7. ✅ Send notifications when important events occur

---

**Everything is documented and ready for implementation!** 🚀

Complete code examples provided. Just follow the Spring Boot implementation and integrate into your business logic.
