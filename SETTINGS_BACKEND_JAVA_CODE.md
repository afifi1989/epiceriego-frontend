# 🔧 Code Java Complet - Paramètres Backend

## Suite de l'implémentation pour SETTINGS_BACKEND_IMPLEMENTATION.md

---

## 2. Entities (suite)

### UserNotificationSettings.java

```java
package com.epiceriego.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_notification_settings")
public class UserNotificationSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "push_notifications", nullable = false)
    private Boolean pushNotifications = true;

    @Column(name = "email_notifications", nullable = false)
    private Boolean emailNotifications = true;

    @Column(name = "order_notifications", nullable = false)
    private Boolean orderNotifications = true;

    @Column(name = "promo_notifications", nullable = false)
    private Boolean promoNotifications = true;

    @Column(name = "delivery_notifications", nullable = false)
    private Boolean deliveryNotifications = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Constructeurs
    public UserNotificationSettings() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // Getters et Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public Boolean getPushNotifications() { return pushNotifications; }
    public void setPushNotifications(Boolean pushNotifications) { 
        this.pushNotifications = pushNotifications; 
    }

    public Boolean getEmailNotifications() { return emailNotifications; }
    public void setEmailNotifications(Boolean emailNotifications) { 
        this.emailNotifications = emailNotifications; 
    }

    public Boolean getOrderNotifications() { return orderNotifications; }
    public void setOrderNotifications(Boolean orderNotifications) { 
        this.orderNotifications = orderNotifications; 
    }

    public Boolean getPromoNotifications() { return promoNotifications; }
    public void setPromoNotifications(Boolean promoNotifications) { 
        this.promoNotifications = promoNotifications; 
    }

    public Boolean getDeliveryNotifications() { return deliveryNotifications; }
    public void setDeliveryNotifications(Boolean deliveryNotifications) { 
        this.deliveryNotifications = deliveryNotifications; 
    }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
```

### UserPreferences.java

```java
package com.epiceriego.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_preferences")
public class UserPreferences {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "language", length = 10, nullable = false)
    private String language = "fr";

    @Column(name = "dark_mode", nullable = false)
    private Boolean darkMode = false;

    @Column(name = "currency", length = 3, nullable = false)
    private String currency = "EUR";

    @Column(name = "timezone", length = 50, nullable = false)
    private String timezone = "Europe/Paris";

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Constructeurs
    public UserPreferences() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // Getters et Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public Boolean getDarkMode() { return darkMode; }
    public void setDarkMode(Boolean darkMode) { this.darkMode = darkMode; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
```

---

## 3. Repositories

### UserNotificationSettingsRepository.java

```java
package com.epiceriego.repository;

import com.epiceriego.entity.User;
import com.epiceriego.entity.UserNotificationSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserNotificationSettingsRepository extends JpaRepository<UserNotificationSettings, Long> {
    
    Optional<UserNotificationSettings> findByUser(User user);
    
    Optional<UserNotificationSettings> findByUserId(Long userId);
    
    boolean existsByUser(User user);
}
```

### UserPreferencesRepository.java

```java
package com.epiceriego.repository;

import com.epiceriego.entity.User;
import com.epiceriego.entity.UserPreferences;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserPreferencesRepository extends JpaRepository<UserPreferences, Long> {
    
    Optional<UserPreferences> findByUser(User user);
    
    Optional<UserPreferences> findByUserId(Long userId);
    
    boolean existsByUser(User user);
}
```

---

## 4. Services

### UserSettingsService.java

```java
package com.epiceriego.service;

import com.epiceriego.dto.NotificationSettingsDTO;
import com.epiceriego.dto.UserPreferencesDTO;
import com.epiceriego.entity.User;
import com.epiceriego.entity.UserNotificationSettings;
import com.epiceriego.entity.UserPreferences;
import com.epiceriego.repository.UserNotificationSettingsRepository;
import com.epiceriego.repository.UserPreferencesRepository;
import com.epiceriego.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserSettingsService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserNotificationSettingsRepository notificationSettingsRepository;

    @Autowired
    private UserPreferencesRepository preferencesRepository;

    /**
     * Récupère les paramètres de notifications de l'utilisateur
     * Crée des préférences par défaut si elles n'existent pas
     */
    @Transactional
    public NotificationSettingsDTO getNotificationSettings(String email) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new UsernameNotFoundException("Utilisateur non trouvé"));

        UserNotificationSettings settings = notificationSettingsRepository.findByUser(user)
            .orElseGet(() -> createDefaultNotificationSettings(user));

        return convertToNotificationDTO(settings);
    }

    /**
     * Met à jour les paramètres de notifications
     */
    @Transactional
    public NotificationSettingsDTO updateNotificationSettings(
        String email, 
        NotificationSettingsDTO dto
    ) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new UsernameNotFoundException("Utilisateur non trouvé"));

        UserNotificationSettings settings = notificationSettingsRepository.findByUser(user)
            .orElseGet(() -> new UserNotificationSettings());

        settings.setUser(user);
        settings.setPushNotifications(dto.getPushNotifications());
        settings.setEmailNotifications(dto.getEmailNotifications());
        settings.setOrderNotifications(dto.getOrderNotifications());
        settings.setPromoNotifications(dto.getPromoNotifications());
        settings.setDeliveryNotifications(dto.getDeliveryNotifications());

        UserNotificationSettings saved = notificationSettingsRepository.save(settings);
        return convertToNotificationDTO(saved);
    }

    /**
     * Récupère les préférences utilisateur
     * Crée des préférences par défaut si elles n'existent pas
     */
    @Transactional
    public UserPreferencesDTO getUserPreferences(String email) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new UsernameNotFoundException("Utilisateur non trouvé"));

        UserPreferences preferences = preferencesRepository.findByUser(user)
            .orElseGet(() => createDefaultPreferences(user));

        return convertToPreferencesDTO(preferences);
    }

    /**
     * Met à jour les préférences utilisateur
     */
    @Transactional
    public UserPreferencesDTO updateUserPreferences(
        String email, 
        UserPreferencesDTO dto
    ) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new UsernameNotFoundException("Utilisateur non trouvé"));

        UserPreferences preferences = preferencesRepository.findByUser(user)
            .orElseGet(() -> new UserPreferences());

        preferences.setUser(user);
        
        if (dto.getLanguage() != null) {
            preferences.setLanguage(dto.getLanguage());
        }
        if (dto.getDarkMode() != null) {
            preferences.setDarkMode(dto.getDarkMode());
        }
        if (dto.getCurrency() != null) {
            preferences.setCurrency(dto.getCurrency());
        }
        if (dto.getTimezone() != null) {
            preferences.setTimezone(dto.getTimezone());
        }

        UserPreferences saved = preferencesRepository.save(preferences);
        return convertToPreferencesDTO(saved);
    }

    /**
     * Crée des paramètres de notifications par défaut
     */
    private UserNotificationSettings createDefaultNotificationSettings(User user) {
        UserNotificationSettings settings = new UserNotificationSettings();
        settings.setUser(user);
        return notificationSettingsRepository.save(settings);
    }

    /**
     * Crée des préférences par défaut
     */
    private UserPreferences createDefaultPreferences(User user) {
        UserPreferences preferences = new UserPreferences();
        preferences.setUser(user);
        return preferencesRepository.save(preferences);
    }

    /**
     * Convertit l'entité en DTO
     */
    private NotificationSettingsDTO convertToNotificationDTO(UserNotificationSettings settings) {
        NotificationSettingsDTO dto = new NotificationSettingsDTO();
        dto.setPushNotifications(settings.getPushNotifications());
        dto.setEmailNotifications(settings.getEmailNotifications());
        dto.setOrderNotifications(settings.getOrderNotifications());
        dto.setPromoNotifications(settings.getPromoNotifications());
        dto.setDeliveryNotifications(settings.getDeliveryNotifications());
        return dto;
    }

    /**
     * Convertit l'entité en DTO
     */
    private UserPreferencesDTO convertToPreferencesDTO(UserPreferences preferences) {
        UserPreferencesDTO dto = new UserPreferencesDTO();
        dto.setLanguage(preferences.getLanguage());
        dto.setDarkMode(preferences.getDarkMode());
        dto.setCurrency(preferences.getCurrency());
        dto.setTimezone(preferences.getTimezone());
        return dto;
    }
}
```

### UserAccountService.java

```java
package com.epiceriego.service;

import com.epiceriego.entity.User;
import com.epiceriego.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserAccountService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    /**
     * Change le mot de passe de l'utilisateur
     */
    @Transactional
    public void changePassword(
        String email, 
        String currentPassword, 
        String newPassword
    ) throws Exception {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new UsernameNotFoundException("Utilisateur non trouvé"));

        // Vérifier le mot de passe actuel
        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new Exception("Mot de passe actuel incorrect");
        }

        // Mettre à jour avec le nouveau mot de passe
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    /**
     * Supprime le compte utilisateur
     */
    @Transactional
    public void deleteAccount(
        String email, 
        String password, 
        String confirmation
    ) throws Exception {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new UsernameNotFoundException("Utilisateur non trouvé"));

        // Vérifier le mot de passe
        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new Exception("Mot de passe incorrect");
        }

        // Vérifier la confirmation
        if (!"DELETE_MY_ACCOUNT".equals(confirmation)) {
            throw new Exception("Confirmation invalide");
        }

        // Supprimer l'utilisateur (cascade supprimera aussi les settings, préférences, etc.)
        userRepository.delete(user);
    }
}
```

---

## 5. Controller

### UserSettingsController.java

```java
package com.epiceriego.controller;

import com.epiceriego.dto.ChangePasswordRequest;
import com.epiceriego.dto.DeleteAccountRequest;
import com.epiceriego.dto.NotificationSettingsDTO;
import com.epiceriego.dto.UserPreferencesDTO;
import com.epiceriego.service.UserAccountService;
import com.epiceriego.service.UserSettingsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserSettingsController {

    @Autowired
    private UserSettingsService settingsService;

    @Autowired
    private UserAccountService accountService;

    /**
     * GET /api/users/settings/notifications
     * Récupère les paramètres de notifications
     */
    @GetMapping("/settings/notifications")
    public ResponseEntity<?> getNotificationSettings(
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        try {
            NotificationSettingsDTO settings = settingsService
                .getNotificationSettings(userDetails.getUsername());
            return ResponseEntity.ok(settings);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("message", "Erreur lors de la récupération des paramètres"));
        }
    }

    /**
     * PUT /api/users/settings/notifications
     * Met à jour les paramètres de notifications
     */
    @PutMapping("/settings/notifications")
    public ResponseEntity<?> updateNotificationSettings(
        @AuthenticationPrincipal UserDetails userDetails,
        @RequestBody @Valid NotificationSettingsDTO request
    ) {
        try {
            NotificationSettingsDTO updated = settingsService
                .updateNotificationSettings(userDetails.getUsername(), request);
            
            return ResponseEntity.ok(Map.of(
                "message", "Préférences de notifications mises à jour",
                "data", updated
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("message", "Erreur lors de la mise à jour"));
        }
    }

    /**
     * GET /api/users/settings/preferences
     * Récupère les préférences utilisateur
     */
    @GetMapping("/settings/preferences")
    public ResponseEntity<?> getUserPreferences(
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        try {
            UserPreferencesDTO preferences = settingsService
                .getUserPreferences(userDetails.getUsername());
            return ResponseEntity.ok(preferences);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("message", "Erreur lors de la récupération des préférences"));
        }
    }

    /**
     * PUT /api/users/settings/preferences
     * Met à jour les préférences utilisateur
     */
    @PutMapping("/settings/preferences")
    public ResponseEntity<?> updateUserPreferences(
        @AuthenticationPrincipal UserDetails userDetails,
        @RequestBody @Valid UserPreferencesDTO request
    ) {
        try {
            UserPreferencesDTO updated = settingsService
                .updateUserPreferences(userDetails.getUsername(), request);
            
            return ResponseEntity.ok(Map.of(
                "message", "Préférences mises à jour",
                "data", updated
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("message", "Erreur lors de la mise à jour"));
        }
    }

    /**
     * PUT /api/users/password
     * Change le mot de passe
     */
    @PutMapping("/password")
    public ResponseEntity<?> changePassword(
        @AuthenticationPrincipal UserDetails userDetails,
        @RequestBody @Valid ChangePasswordRequest request
    ) {
        try {
            // Vérifier que les mots de passe correspondent
            if (!request.getNewPassword().equals(request.getConfirmPassword())) {
                return ResponseEntity.badRequest()
                    .body(Map.of("message", "Les mots de passe ne correspondent pas"));
            }

            accountService.changePassword(
                userDetails.getUsername(),
                request.getCurrentPassword(),
                request.getNewPassword()
            );

            return ResponseEntity.ok(Map.of(
                "message", "Mot de passe modifié avec succès"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                .body(Map.of("message", e.getMessage()));
        }
    }

    /**
     * DELETE /api/users/account
     * Supprime le compte
     */
    @DeleteMapping("/account")
    public ResponseEntity<?> deleteAccount(
        @AuthenticationPrincipal UserDetails userDetails,
        @RequestBody @Valid DeleteAccountRequest request
    ) {
        try {
            accountService.deleteAccount(
                userDetails.getUsername(),
                request.getPassword(),
                request.getConfirmation()
            );

            return ResponseEntity.ok(Map.of(
                "message", "Compte supprimé avec succès"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                .body(Map.of("message", e.getMessage()));
        }
    }
}
```

---

## ✅ Checklist d'Implémentation

### Phase 1: Base de données
- [ ] Créer la table `user_notification_settings`
- [ ] Créer la table `user_preferences`
- [ ] Vérifier les foreign keys

### Phase 2: Entities et DTOs
- [ ] Créer `UserNotificationSettings.java`
- [ ] Créer `UserPreferences.java`
- [ ] Créer `NotificationSettingsDTO.java`
- [ ] Créer `UserPreferencesDTO.java`
- [ ] Créer `ChangePasswordRequest.java`
- [ ] Créer `DeleteAccountRequest.java`

### Phase 3: Repositories
- [ ] Créer `UserNotificationSettingsRepository.java`
- [ ] Créer `UserPreferencesRepository.java`

### Phase 4: Services
- [ ] Créer `UserSettingsService.java`
- [ ] Créer `UserAccountService.java`

### Phase 5: Controller
- [ ] Créer `UserSettingsController.java`
- [ ] Tester chaque endpoint avec curl

### Phase 6: Tests
- [ ] GET /api/users/settings/notifications
- [ ] PUT /api/users/settings/notifications
- [ ] GET /api/users/settings/preferences
- [ ] PUT /api/users/settings/preferences
- [ ] PUT /api/users/password
- [ ] DELETE /api/users/account

---

## 🧪 Ordre de Tests

```bash
# 1. Se connecter
curl -X POST "https://afifi-mostafa.com:8443/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "client@test.com", "password": "password123"}'

# Copier le token reçu

# 2. Récupérer les notifications settings
curl -X GET "https://afifi-mostafa.com:8443/api/users/settings/notifications" \
  -H "Authorization: Bearer <TOKEN>"

# 3. Mettre à jour les notifications
curl -X PUT "https://afifi-mostafa.com:8443/api/users/settings/notifications" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"pushNotifications": true, "emailNotifications": false, "orderNotifications": true, "promoNotifications": false, "deliveryNotifications": true}'

# 4. Récupérer les préférences
curl -X GET "https://afifi-mostafa.com:8443/api/users/settings/preferences" \
  -H "Authorization: Bearer <TOKEN>"

# 5. Mettre à jour les préférences
curl -X PUT "https://afifi-mostafa.com:8443/api/users/settings/preferences" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"language": "en", "darkMode": true}'

# 6. Changer le mot de passe
curl -X PUT "https://afifi-mostafa.com:8443/api/users/password" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword": "password123", "newPassword": "newPassword456", "confirmPassword": "newPassword456"}'
```

---

**Date:** 3 novembre 2025  
**Statut:** Code complet prêt à implémenter ✅
