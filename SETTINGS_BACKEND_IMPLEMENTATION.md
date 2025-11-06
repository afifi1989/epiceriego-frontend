# ⚙️ Implémentation Backend - Paramètres Client

## 📋 Endpoints Requis pour la Page Settings

Ce document contient **tous les endpoints** nécessaires pour faire fonctionner la page de paramètres, avec les curl de test et le code Java complet.

---

## 🎯 Liste des Endpoints

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/users/settings/notifications` | GET | Récupérer les préférences de notifications |
| `/api/users/settings/notifications` | PUT | Mettre à jour les préférences de notifications |
| `/api/users/settings/preferences` | GET | Récupérer les préférences utilisateur |
| `/api/users/settings/preferences` | PUT | Mettre à jour les préférences utilisateur |
| `/api/users/password` | PUT | Changer le mot de passe |
| `/api/users/account` | DELETE | Supprimer le compte |

---

## 📍 1. Notifications Settings

### GET /api/users/settings/notifications

Récupère les préférences de notifications de l'utilisateur connecté.

#### cURL

```bash
curl -X GET "https://afifi-mostafa.com:8443/api/users/settings/notifications" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

#### Réponse Success (200 OK)

```json
{
  "pushNotifications": true,
  "emailNotifications": true,
  "orderNotifications": true,
  "promoNotifications": false,
  "deliveryNotifications": true
}
```

#### Réponse si Pas de Préférences (200 OK - Valeurs par défaut)

```json
{
  "pushNotifications": true,
  "emailNotifications": true,
  "orderNotifications": true,
  "promoNotifications": true,
  "deliveryNotifications": true
}
```

---

### PUT /api/users/settings/notifications

Met à jour les préférences de notifications.

#### cURL

```bash
curl -X PUT "https://afifi-mostafa.com:8443/api/users/settings/notifications" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "pushNotifications": true,
    "emailNotifications": false,
    "orderNotifications": true,
    "promoNotifications": false,
    "deliveryNotifications": true
  }'
```

#### Réponse Success (200 OK)

```json
{
  "message": "Préférences de notifications mises à jour",
  "data": {
    "pushNotifications": true,
    "emailNotifications": false,
    "orderNotifications": true,
    "promoNotifications": false,
    "deliveryNotifications": true
  }
}
```

---

## 📍 2. User Preferences

### GET /api/users/settings/preferences

Récupère les préférences utilisateur (langue, thème, etc.).

#### cURL

```bash
curl -X GET "https://afifi-mostafa.com:8443/api/users/settings/preferences" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

#### Réponse Success (200 OK)

```json
{
  "language": "fr",
  "darkMode": false,
  "currency": "EUR",
  "timezone": "Europe/Paris"
}
```

---

### PUT /api/users/settings/preferences

Met à jour les préférences utilisateur.

#### cURL

```bash
curl -X PUT "https://afifi-mostafa.com:8443/api/users/settings/preferences" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "en",
    "darkMode": true,
    "currency": "USD",
    "timezone": "America/New_York"
  }'
```

#### Réponse Success (200 OK)

```json
{
  "message": "Préférences mises à jour",
  "data": {
    "language": "en",
    "darkMode": true,
    "currency": "USD",
    "timezone": "America/New_York"
  }
}
```

---

## 📍 3. Change Password

### PUT /api/users/password

Change le mot de passe de l'utilisateur.

#### cURL

```bash
curl -X PUT "https://afifi-mostafa.com:8443/api/users/password" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "oldPassword123",
    "newPassword": "newSecurePassword456",
    "confirmPassword": "newSecurePassword456"
  }'
```

#### Réponse Success (200 OK)

```json
{
  "message": "Mot de passe modifié avec succès"
}
```

#### Réponse Error (400 Bad Request)

```json
{
  "message": "Mot de passe actuel incorrect"
}
```

---

## 📍 4. Delete Account

### DELETE /api/users/account

Supprime définitivement le compte utilisateur.

#### cURL

```bash
curl -X DELETE "https://afifi-mostafa.com:8443/api/users/account" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "userPassword123",
    "confirmation": "DELETE_MY_ACCOUNT"
  }'
```

#### Réponse Success (200 OK)

```json
{
  "message": "Compte supprimé avec succès"
}
```

#### Réponse Error (400 Bad Request)

```json
{
  "message": "Mot de passe incorrect ou confirmation invalide"
}
```

---

## 🗄️ Structure SQL

### Table: user_notification_settings

```sql
CREATE TABLE user_notification_settings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    email_notifications BOOLEAN DEFAULT TRUE,
    order_notifications BOOLEAN DEFAULT TRUE,
    promo_notifications BOOLEAN DEFAULT TRUE,
    delivery_notifications BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
);
```

### Table: user_preferences

```sql
CREATE TABLE user_preferences (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    language VARCHAR(10) DEFAULT 'fr',
    dark_mode BOOLEAN DEFAULT FALSE,
    currency VARCHAR(3) DEFAULT 'EUR',
    timezone VARCHAR(50) DEFAULT 'Europe/Paris',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
);
```

---

## 🔧 Implémentation Java

### 1. DTOs

#### NotificationSettingsDTO.java

```java
package com.epiceriego.dto;

public class NotificationSettingsDTO {
    private Boolean pushNotifications;
    private Boolean emailNotifications;
    private Boolean orderNotifications;
    private Boolean promoNotifications;
    private Boolean deliveryNotifications;

    // Constructeurs
    public NotificationSettingsDTO() {
        // Valeurs par défaut
        this.pushNotifications = true;
        this.emailNotifications = true;
        this.orderNotifications = true;
        this.promoNotifications = true;
        this.deliveryNotifications = true;
    }

    // Getters et Setters
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
}
```

#### UserPreferencesDTO.java

```java
package com.epiceriego.dto;

public class UserPreferencesDTO {
    private String language;
    private Boolean darkMode;
    private String currency;
    private String timezone;

    // Constructeurs
    public UserPreferencesDTO() {
        // Valeurs par défaut
        this.language = "fr";
        this.darkMode = false;
        this.currency = "EUR";
        this.timezone = "Europe/Paris";
    }

    // Getters et Setters
    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public Boolean getDarkMode() { return darkMode; }
    public void setDarkMode(Boolean darkMode) { this.darkMode = darkMode; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }
}
```

#### ChangePasswordRequest.java

```java
package com.epiceriego.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

public class ChangePasswordRequest {
    
    @NotBlank(message = "Le mot de passe actuel est requis")
    private String currentPassword;
    
    @NotBlank(message = "Le nouveau mot de passe est requis")
    @Size(min = 8, message = "Le mot de passe doit contenir au moins 8 caractères")
    private String newPassword;
    
    @NotBlank(message = "La confirmation est requise")
    private String confirmPassword;

    // Getters et Setters
    public String getCurrentPassword() { return currentPassword; }
    public void setCurrentPassword(String currentPassword) { 
        this.currentPassword = currentPassword; 
    }

    public String getNewPassword() { return newPassword; }
    public void setNewPassword(String newPassword) { 
        this.newPassword = newPassword; 
    }

    public String getConfirmPassword() { return confirmPassword; }
    public void setConfirmPassword(String confirmPassword) { 
        this.confirmPassword = confirmPassword; 
    }
}
```

#### DeleteAccountRequest.java

```java
package com.epiceriego.dto;

import javax.validation.constraints.NotBlank;

public class DeleteAccountRequest {
    
    @NotBlank(message = "Le mot de passe est requis")
    private String password;
    
    @NotBlank(message = "La confirmation est requise")
    private String confirmation;

    // Getters et Setters
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getConfirmation() { return confirmation; }
    public void setConfirmation(String confirmation) { 
        this.confirmation = confirmation; 
    }
}
```

---

### 2. Entities

#### UserNotificationSettings.java

```java
package com.epiceriego.
