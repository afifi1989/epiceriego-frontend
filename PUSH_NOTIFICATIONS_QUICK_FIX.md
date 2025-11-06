# 🚀 Guide de Correction Rapide - Push Notifications

## 🎯 Problème Identifié

Le device token pour les notifications push **n'est pas sauvegardé** sur le backend lors de la connexion.

**Cause :** Le backend reçoit le `fcmToken` via `/auth/login` mais ne le sauvegarde pas en base de données.

---

## ✅ Solution Rapide (15 minutes)

Modifier le backend pour sauvegarder le token lors du login.

---

## 📋 Étapes de Correction

### Étape 1 : Modifier LoginRequest.java

**Fichier :** `src/main/java/com/epiceriego/dto/LoginRequest.java`

```java
public class LoginRequest {
    private String email;
    private String password;
    
    // ✅ AJOUTER CES CHAMPS
    private String fcmToken;
    private String deviceType;
    private String platform;

    // Getters et Setters
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    // ✅ NOUVEAUX GETTERS/SETTERS
    public String getFcmToken() { return fcmToken; }
    public void setFcmToken(String fcmToken) { this.fcmToken = fcmToken; }

    public String getDeviceType() { return deviceType; }
    public void setDeviceType(String deviceType) { this.deviceType = deviceType; }

    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }
}
```

---

### Étape 2 : Modifier AuthController.java

**Fichier :** `src/main/java/com/epiceriego/controller/AuthController.java`

```java
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AuthService authService;
    
    // ✅ AJOUTER CETTE DÉPENDANCE
    @Autowired
    private PushNotificationDeviceService pushNotificationDeviceService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            // 1. Authentifier l'utilisateur
            User user = authService.authenticate(
                request.getEmail(), 
                request.getPassword()
            );

            // ✅ 2. AJOUTER CETTE SECTION - Enregistrer le device token
            if (request.getFcmToken() != null && !request.getFcmToken().isEmpty()) {
                try {
                    pushNotificationDeviceService.registerDevice(
                        user.getEmail(),
                        request.getFcmToken(),
                        request.getDeviceType() != null ? request.getDeviceType() : "Unknown",
                        request.getPlatform() != null ? request.getPlatform() : "Unknown"
                    );
                    System.out.println("[AuthController] ✅ Device token enregistré pour: " + user.getEmail());
                } catch (Exception e) {
                    // Ne pas bloquer la connexion si l'enregistrement échoue
                    System.err.println("[AuthController] ⚠️ Erreur enregistrement token: " + e.getMessage());
                }
            } else {
                System.out.println("[AuthController] ⚠️ Aucun FCM token fourni");
            }

            // 3. Générer le JWT et retourner
            String jwtToken = jwtTokenProvider.generateToken(user);
            
            LoginResponse response = new LoginResponse();
            response.setToken(jwtToken);
            response.setEmail(user.getEmail());
            response.setRole(user.getRole().name());
            response.setId(user.getId());
            response.setNom(user.getNom());
            response.setPrenom(user.getPrenom());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("message", "Email ou mot de passe incorrect"));
        }
    }
}
```

---

### Étape 3 : Créer PushNotificationDevice Entity

**Fichier :** `src/main/java/com/epiceriego/entity/PushNotificationDevice.java`

```java
package com.epiceriego.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "push_notification_devices")
public class PushNotificationDevice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 500)
    private String expoPushToken;

    @Column(nullable = false, length = 100)
    private String deviceType;

    @Column(nullable = false, length = 50)
    private String platform;

    @Column(nullable = false)
    private Boolean isActive = true;

    @Column(nullable = false)
    private LocalDateTime dateRegistered;

    @Column
    private LocalDateTime lastUsed;

    // Constructeurs
    public PushNotificationDevice() {
        this.dateRegistered = LocalDateTime.now();
        this.isActive = true;
    }

    // Getters et Setters
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

---

### Étape 4 : Créer PushNotificationDeviceRepository

**Fichier :** `src/main/java/com/epiceriego/repository/PushNotificationDeviceRepository.java`

```java
package com.epiceriego.repository;

import com.epiceriego.entity.PushNotificationDevice;
import com.epiceriego.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PushNotificationDeviceRepository extends JpaRepository<PushNotificationDevice, Long> {

    // Trouver tous les devices actifs pour un utilisateur
    List<PushNotificationDevice> findByUserAndIsActiveTrue(User user);

    // Trouver un device spécifique
    Optional<PushNotificationDevice> findByExpoPushToken(String token);

    // Trouver par utilisateur et token
    Optional<PushNotificationDevice> findByUserAndExpoPushToken(User user, String token);

    // Compter les devices actifs
    long countByUserAndIsActiveTrue(User user);
}
```

---

### Étape 5 : Créer PushNotificationDeviceService

**Fichier :** `src/main/java/com/epiceriego/service/PushNotificationDeviceService.java`

```java
package com.epiceriego.service;

import com.epiceriego.entity.PushNotificationDevice;
import com.epiceriego.entity.User;
import com.epiceriego.repository.PushNotificationDeviceRepository;
import com.epiceriego.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class PushNotificationDeviceService {

    @Autowired
    private PushNotificationDeviceRepository deviceRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * Enregistrer ou mettre à jour un device
     */
    @Transactional
    public PushNotificationDevice registerDevice(
        String username, 
        String expoPushToken,
        String deviceType, 
        String platform
    ) {
        User user = userRepository.findByEmail(username)
            .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));

        // Vérifier si le device existe déjà
        Optional<PushNotificationDevice> existing = 
            deviceRepository.findByUserAndExpoPushToken(user, expoPushToken);

        if (existing.isPresent()) {
            // Mettre à jour le device existant
            PushNotificationDevice device = existing.get();
            device.setIsActive(true);
            device.setLastUsed(LocalDateTime.now());
            device.setDeviceType(deviceType);
            device.setPlatform(platform);
            return deviceRepository.save(device);
        }

        // Créer un nouveau device
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
     * Désactiver un device
     */
    @Transactional
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
     * Obtenir les devices actifs d'un utilisateur
     */
    public List<PushNotificationDevice> getUserDevices(String username) {
        User user = userRepository.findByEmail(username)
            .orElseThrow(() -> new UsernameNotFoundException("User not found"));

        return deviceRepository.findByUserAndIsActiveTrue(user);
    }
}
```

---

### Étape 6 : Créer la Table en Base de Données

**SQL :**

```sql
CREATE TABLE push_notification_devices (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    expo_push_token VARCHAR(500) NOT NULL,
    device_type VARCHAR(100) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    date_registered TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_user_active (user_id, is_active),
    INDEX idx_token (expo_push_token)
);
```

**OU avec Liquibase :**

```xml
<changeSet id="create-push-notification-devices" author="epiceriego">
    <createTable tableName="push_notification_devices">
        <column name="id" type="BIGINT" autoIncrement="true">
            <constraints primaryKey="true" nullable="false"/>
        </column>
        <column name="user_id" type="BIGINT">
            <constraints nullable="false"/>
        </column>
        <column name="expo_push_token" type="VARCHAR(500)">
            <constraints nullable="false"/>
        </column>
        <column name="device_type" type="VARCHAR(100)">
            <constraints nullable="false"/>
        </column>
        <column name="platform" type="VARCHAR(50)">
            <constraints nullable="false"/>
        </column>
        <column name="is_active" type="BOOLEAN" defaultValueBoolean="true">
            <constraints nullable="false"/>
        </column>
        <column name="date_registered" type="TIMESTAMP" defaultValueComputed="CURRENT_TIMESTAMP">
            <constraints nullable="false"/>
        </column>
        <column name="last_used" type="TIMESTAMP"/>
    </createTable>
    
    <addForeignKeyConstraint 
        constraintName="fk_push_devices_user"
        baseTableName="push_notification_devices"
        baseColumnNames="user_id"
        referencedTableName="users"
        referencedColumnNames="id"
        onDelete="CASCADE"/>
    
    <createIndex tableName="push_notification_devices" indexName="idx_user_id">
        <column name="user_id"/>
    </createIndex>
    
    <createIndex tableName="push_notification_devices" indexName="idx_user_active">
        <column name="user_id"/>
        <column name="is_active"/>
    </createIndex>
</changeSet>
```

---

## 🧪 Test de la Correction

### 1. Redémarrer le Backend

```bash
mvn clean install
mvn spring-boot:run
```

### 2. Tester depuis l'App Mobile

1. Ouvrir l'app
2. Se connecter avec un compte client
3. Observer les logs

**Logs Backend attendus :**
```
[AuthController] Email: client@test.com
[AuthController] ✅ Device token enregistré pour: client@test.com
```

**Logs Frontend attendus :**
```
[LoginScreen] 🔔 Récupération du push token...
[LoginScreen] Token obtenu: OUI ✅
[LoginScreen] 🔐 Tentative de connexion...
[LoginScreen] ✅ Connexion réussie
```

### 3. Vérifier en Base de Données

```sql
SELECT 
    d.id,
    u.email,
    d.expo_push_token,
    d.device_type,
    d.platform,
    d.is_active,
    d.date_registered
FROM push_notification_devices d
JOIN users u ON d.user_id = u.id
WHERE u.email = 'client@test.com';
```

**Résultat attendu :**
- ✅ Une ligne avec le token push
- ✅ `is_active = true`
- ✅ `date_registered` = maintenant

---

## 📝 Checklist de Vérification

- [ ] ✅ Modifier `LoginRequest.java` (ajout des champs fcmToken, deviceType, platform)
- [ ] ✅ Modifier `AuthController.java` (injection + appel du service)
- [ ] ✅ Créer `PushNotificationDevice.java` (entity)
- [ ] ✅ Créer `PushNotificationDeviceRepository.java` (repository)
- [ ] ✅ Créer `PushNotificationDeviceService.java` (service)
- [ ] ✅ Créer la table `push_notification_devices` en base
- [ ] ✅ Redémarrer le backend
- [ ] ✅ Tester la connexion depuis l'app
- [ ] ✅ Vérifier les logs backend
- [ ] ✅ Vérifier la base de données

---

## 🎉 Résultat Final

Après ces modifications :

1. ✅ Le token push est **automatiquement enregistré** lors de la connexion
2. ✅ Fonctionne pour **tous les clients** sans modification frontend
3. ✅ Le token est **sauvegardé en base de données**
4. ✅ Prêt pour **envoyer des notifications push**

---

## 📚 Prochaines Étapes

Une fois le token enregistré, vous pouvez :

1. **Envoyer des notifications push** via le `PushNotificationSenderService`
2. **Notifier sur les commandes** (changement de statut)
3. **Envoyer des promotions** aux clients
4. **Alertes de livraison**

Voir le fichier `PUSH_NOTIFICATIONS_BACKEND.md` pour le code complet d'envoi de notifications.

---

**Temps estimé : 15 minutes**
**Difficulté : Facile** 
**Impact : Critique pour les notifications push**
