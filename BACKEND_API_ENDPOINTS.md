# Endpoints API de Paiement - Guide Complet Backend

## 📋 Vue d'ensemble

Ce document fournit tous les endpoints nécessaires pour l'implémentation du système de paiement par carte, avec des exemples cURL pour chaque cas d'usage.

---

## 1️⃣ Récupérer les Cartes Enregistrées du Client

### Endpoint
```
GET /api/payments/saved-methods
```

### Description
Récupère toutes les cartes bancaires enregistrées par le client authentifié.

### Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Response (200 OK)
```json
[
  {
    "id": 1,
    "lastFourDigits": "1234",
    "cardholderName": "JEAN DUPONT",
    "expiryMonth": "12",
    "expiryYear": "25",
    "isDefault": true
  },
  {
    "id": 2,
    "lastFourDigits": "5678",
    "cardholderName": "MARIE MARTIN",
    "expiryMonth": "11",
    "expiryYear": "24",
    "isDefault": false
  }
]
```

### cURL
```bash
curl -X GET "https://afifi-mostafa.com:8443/api/payments/saved-methods" \
  -H "Authorization: Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJjbGllbnRAdGVzdC5jb20iLCJ1c2VySWQiOjIsInJvbGUiOiJDTElFTlQiLCJpYXQiOjE3NjE5NDk5OTUsImV4cCI6MTc2MjAzNjM5NX0.yp_iSJmBSNp_8QTV5QhqPV2QRlY9G3r921KtdYr_HqbcKIKPVCE8XqpkZIfik_9DBQzniSJT6KYgBKwA0NvUVQ" \
  -H "Content-Type: application/json"
```

### Code Backend (Spring Boot Example)
```java
@GetMapping("/saved-methods")
@PreAuthorize("isAuthenticated()")
public ResponseEntity<List<SavedPaymentMethodDTO>> getSavedPaymentMethods(
    @AuthenticationPrincipal UserDetails userDetails) {

  // Récupérer l'utilisateur connecté
  User user = userService.findByEmail(userDetails.getUsername());

  // Récupérer les cartes enregistrées
  List<SavedPaymentMethod> paymentMethods = paymentService.getSavedPaymentMethods(user.getId());

  return ResponseEntity.ok(
    paymentMethods.stream()
      .map(this::convertToDTO)
      .collect(Collectors.toList())
  );
}
```

### Response Codes
- `200 OK` - Liste des cartes retournée
- `401 UNAUTHORIZED` - Token invalide ou expiré
- `404 NOT FOUND` - Aucune carte enregistrée

---

## 2️⃣ Récupérer la Carte Par Défaut

### Endpoint
```
GET /api/payments/default-method
```

### Description
Récupère la carte bancaire définie comme défaut pour le client authentifié.

### Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Response (200 OK)
```json
{
  "id": 1,
  "lastFourDigits": "1234",
  "cardholderName": "JEAN DUPONT",
  "expiryMonth": "12",
  "expiryYear": "25",
  "isDefault": true
}
```

### cURL
```bash
curl -X GET "https://afifi-mostafa.com:8443/api/payments/default-method" \
  -H "Authorization: Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJjbGllbnRAdGVzdC5jb20iLCJ1c2VySWQiOjIsInJvbGUiOiJDTElFTlQiLCJpYXQiOjE3NjE5NDk5OTUsImV4cCI6MTc2MjAzNjM5NX0.yp_iSJmBSNp_8QTV5QhqPV2QRlY9G3r921KtdYr_HqbcKIKPVCE8XqpkZIfik_9DBQzniSJT6KYgBKwA0NvUVQ" \
  -H "Content-Type: application/json"
```

### Code Backend
```java
@GetMapping("/default-method")
@PreAuthorize("isAuthenticated()")
public ResponseEntity<?> getDefaultPaymentMethod(
    @AuthenticationPrincipal UserDetails userDetails) {

  User user = userService.findByEmail(userDetails.getUsername());
  SavedPaymentMethod defaultMethod = paymentService.getDefaultPaymentMethod(user.getId());

  if (defaultMethod == null) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
      .body(new ErrorResponse("Aucune carte par défaut"));
  }

  return ResponseEntity.ok(convertToDTO(defaultMethod));
}
```

### Response Codes
- `200 OK` - Carte par défaut retournée
- `401 UNAUTHORIZED` - Non authentifié
- `404 NOT FOUND` - Pas de carte par défaut

---

## 3️⃣ Enregistrer une Nouvelle Carte

### Endpoint
```
POST /api/payments/save-method
```

### Description
Enregistre une nouvelle carte bancaire pour le client authentifié. Optionnellement la définit comme défaut.

### Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Request Body
```json
{
  "cardNumber": "4532111122223333",
  "cardholderName": "JEAN DUPONT",
  "expiryMonth": "12",
  "expiryYear": "25",
  "cvv": "123",
  "setAsDefault": false
}
```

### Response (201 CREATED)
```json
{
  "id": 3,
  "lastFourDigits": "3333",
  "cardholderName": "JEAN DUPONT",
  "expiryMonth": "12",
  "expiryYear": "25",
  "isDefault": false
}
```

### cURL
```bash
curl -X POST "https://afifi-mostafa.com:8443/api/payments/save-method" \
  -H "Authorization: Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJjbGllbnRAdGVzdC5jb20iLCJ1c2VySWQiOjIsInJvbGUiOiJDTElFTlQiLCJpYXQiOjE3NjE5NDk5OTUsImV4cCI6MTc2MjAzNjM5NX0.yp_iSJmBSNp_8QTV5QhqPV2QRlY9G3r921KtdYr_HqbcKIKPVCE8XqpkZIfik_9DBQzniSJT6KYgBKwA0NvUVQ" \
  -H "Content-Type: application/json" \
  -d '{
    "cardNumber": "4532111122223333",
    "cardholderName": "JEAN DUPONT",
    "expiryMonth": "12",
    "expiryYear": "25",
    "cvv": "123",
    "setAsDefault": false
  }'
```

### Code Backend
```java
@PostMapping("/save-method")
@PreAuthorize("isAuthenticated()")
public ResponseEntity<?> savePaymentMethod(
    @RequestBody @Valid SavePaymentMethodRequest request,
    @AuthenticationPrincipal UserDetails userDetails) {

  // Validation
  if (!isValidCardNumber(request.getCardNumber())) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
      .body(new ErrorResponse("Numéro de carte invalide"));
  }

  if (!isValidCVV(request.getCvv())) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
      .body(new ErrorResponse("CVV invalide"));
  }

  if (isCardExpired(request.getExpiryMonth(), request.getExpiryYear())) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
      .body(new ErrorResponse("Carte expirée"));
  }

  User user = userService.findByEmail(userDetails.getUsername());

  try {
    SavedPaymentMethod savedCard = paymentService.savePaymentMethod(
      user.getId(),
      request,
      request.isSetAsDefault()
    );

    return ResponseEntity.status(HttpStatus.CREATED)
      .body(convertToDTO(savedCard));
  } catch (Exception e) {
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
      .body(new ErrorResponse("Erreur lors de l'enregistrement de la carte"));
  }
}
```

### Validation Requis
- Numéro de carte: 13-19 chiffres (Luhn algorithm)
- Titulaire: Non vide (max 50 caractères)
- Mois: 01-12
- Année: Année future (format 2 chiffres: 24, 25, etc.)
- CVV: 3-4 chiffres

### Response Codes
- `201 CREATED` - Carte enregistrée avec succès
- `400 BAD REQUEST` - Données invalides
- `401 UNAUTHORIZED` - Non authentifié
- `500 INTERNAL_SERVER_ERROR` - Erreur serveur

---

## 4️⃣ Définir une Carte comme Défaut

### Endpoint
```
PUT /api/payments/{paymentMethodId}/set-default
```

### Description
Définit une carte enregistrée comme défaut pour les futures commandes du client.

### Parameters
- `paymentMethodId` (path): ID de la méthode de paiement à définir comme défaut

### Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Response (200 OK)
```json
{
  "id": 2,
  "lastFourDigits": "5678",
  "cardholderName": "MARIE MARTIN",
  "expiryMonth": "11",
  "expiryYear": "24",
  "isDefault": true
}
```

### cURL
```bash
curl -X PUT "https://afifi-mostafa.com:8443/api/payments/2/set-default" \
  -H "Authorization: Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJjbGllbnRAdGVzdC5jb20iLCJ1c2VySWQiOjIsInJvbGUiOiJDTElFTlQiLCJpYXQiOjE3NjE5NDk5OTUsImV4cCI6MTc2MjAzNjM5NX0.yp_iSJmBSNp_8QTV5QhqPV2QRlY9G3r921KtdYr_HqbcKIKPVCE8XqpkZIfik_9DBQzniSJT6KYgBKwA0NvUVQ" \
  -H "Content-Type: application/json"
```

### Code Backend
```java
@PutMapping("/{paymentMethodId}/set-default")
@PreAuthorize("isAuthenticated()")
public ResponseEntity<?> setDefaultPaymentMethod(
    @PathVariable Long paymentMethodId,
    @AuthenticationPrincipal UserDetails userDetails) {

  User user = userService.findByEmail(userDetails.getUsername());

  // Vérifier que la carte appartient au client
  SavedPaymentMethod method = paymentService.getPaymentMethodById(paymentMethodId);

  if (method == null || !method.getUser().getId().equals(user.getId())) {
    return ResponseEntity.status(HttpStatus.FORBIDDEN)
      .body(new ErrorResponse("Accès non autorisé"));
  }

  try {
    SavedPaymentMethod updated = paymentService.setAsDefault(paymentMethodId);
    return ResponseEntity.ok(convertToDTO(updated));
  } catch (Exception e) {
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
      .body(new ErrorResponse("Erreur lors de la mise à jour"));
  }
}
```

### Response Codes
- `200 OK` - Carte définie comme défaut
- `401 UNAUTHORIZED` - Non authentifié
- `403 FORBIDDEN` - Carte n'appartient pas au client
- `404 NOT FOUND` - Carte non trouvée
- `500 INTERNAL_SERVER_ERROR` - Erreur serveur

---

## 5️⃣ Supprimer une Carte Enregistrée

### Endpoint
```
DELETE /api/payments/{paymentMethodId}
```

### Description
Supprime une carte bancaire enregistrée du profil du client.

### Parameters
- `paymentMethodId` (path): ID de la carte à supprimer

### Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Response (204 NO CONTENT)
```
Pas de body
```

### cURL
```bash
curl -X DELETE "https://afifi-mostafa.com:8443/api/payments/3" \
  -H "Authorization: Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJjbGllbnRAdGVzdC5jb20iLCJ1c2VySWQiOjIsInJvbGUiOiJDTElFTlQiLCJpYXQiOjE3NjE5NDk5OTUsImV4cCI6MTc2MjAzNjM5NX0.yp_iSJmBSNp_8QTV5QhqPV2QRlY9G3r921KtdYr_HqbcKIKPVCE8XqpkZIfik_9DBQzniSJT6KYgBKwA0NvUVQ" \
  -H "Content-Type: application/json"
```

### Code Backend
```java
@DeleteMapping("/{paymentMethodId}")
@PreAuthorize("isAuthenticated()")
public ResponseEntity<?> deletePaymentMethod(
    @PathVariable Long paymentMethodId,
    @AuthenticationPrincipal UserDetails userDetails) {

  User user = userService.findByEmail(userDetails.getUsername());

  // Vérifier que la carte appartient au client
  SavedPaymentMethod method = paymentService.getPaymentMethodById(paymentMethodId);

  if (method == null || !method.getUser().getId().equals(user.getId())) {
    return ResponseEntity.status(HttpStatus.FORBIDDEN)
      .body(new ErrorResponse("Accès non autorisé"));
  }

  try {
    paymentService.deletePaymentMethod(paymentMethodId);
    return ResponseEntity.noContent().build();
  } catch (Exception e) {
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
      .body(new ErrorResponse("Erreur lors de la suppression"));
  }
}
```

### Response Codes
- `204 NO CONTENT` - Carte supprimée
- `401 UNAUTHORIZED` - Non authentifié
- `403 FORBIDDEN` - Carte n'appartient pas au client
- `404 NOT FOUND` - Carte non trouvée
- `500 INTERNAL_SERVER_ERROR` - Erreur serveur

---

## 6️⃣ Traiter un Paiement avec une Nouvelle Carte

### Endpoint
```
POST /api/payments/process
```

### Description
Traite un paiement en utilisant les détails d'une nouvelle carte (pas enregistrée préalablement).

### Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Request Body
```json
{
  "cardNumber": "4532111122223333",
  "cardholderName": "JEAN DUPONT",
  "expiryMonth": "12",
  "expiryYear": "25",
  "cvv": "123",
  "amount": 250.50,
  "orderId": 123
}
```

### Response (200 OK)
```json
{
  "success": true,
  "transactionId": "txn_1234567890abcdef",
  "amount": 250.50,
  "currency": "MAD",
  "timestamp": "2025-11-02T10:30:00Z"
}
```

### cURL
```bash
curl -X POST "https://afifi-mostafa.com:8443/api/payments/process" \
  -H "Authorization: Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJjbGllbnRAdGVzdC5jb20iLCJ1c2VySWQiOjIsInJvbGUiOiJDTElFTlQiLCJpYXQiOjE3NjE5NDk5OTUsImV4cCI6MTc2MjAzNjM5NX0.yp_iSJmBSNp_8QTV5QhqPV2QRlY9G3r921KtdYr_HqbcKIKPVCE8XqpkZIfik_9DBQzniSJT6KYgBKwA0NvUVQ" \
  -H "Content-Type: application/json" \
  -d '{
    "cardNumber": "4532111122223333",
    "cardholderName": "JEAN DUPONT",
    "expiryMonth": "12",
    "expiryYear": "25",
    "cvv": "123",
    "amount": 250.50,
    "orderId": 123
  }'
```

### Code Backend
```java
@PostMapping("/process")
@PreAuthorize("isAuthenticated()")
@Transactional
public ResponseEntity<?> processCardPayment(
    @RequestBody @Valid ProcessPaymentRequest request,
    @AuthenticationPrincipal UserDetails userDetails) {

  try {
    // Validations
    if (!isValidCardNumber(request.getCardNumber())) {
      return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(new ErrorResponse("Numéro de carte invalide"));
    }

    if (isCardExpired(request.getExpiryMonth(), request.getExpiryYear())) {
      return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(new ErrorResponse("Carte expirée"));
    }

    if (request.getAmount() <= 0) {
      return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(new ErrorResponse("Montant invalide"));
    }

    User user = userService.findByEmail(userDetails.getUsername());

    // Vérifier que la commande appartient au client
    Order order = orderService.getOrderById(request.getOrderId());
    if (order == null || !order.getClient().getId().equals(user.getId())) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN)
        .body(new ErrorResponse("Accès non autorisé"));
    }

    // Appeler le service de paiement tiers (Stripe, Square, etc.)
    PaymentResult result = stripeService.chargeCard(
      request.getCardNumber(),
      request.getCvv(),
      request.getAmount(),
      "MAD",
      order.getId().toString()
    );

    if (!result.isSuccess()) {
      return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED)
        .body(new ErrorResponse("Paiement refusé: " + result.getErrorMessage()));
    }

    // Enregistrer la transaction
    Transaction transaction = new Transaction();
    transaction.setOrder(order);
    transaction.setAmount(request.getAmount());
    transaction.setTransactionId(result.getTransactionId());
    transaction.setPaymentMethod(PaymentMethod.CARD);
    transaction.setStatus(TransactionStatus.SUCCESS);
    transaction.setCreatedAt(LocalDateTime.now());
    transactionService.save(transaction);

    // Mettre à jour le statut de la commande
    order.setStatus(OrderStatus.CONFIRMED);
    orderService.save(order);

    return ResponseEntity.ok(new PaymentResponse(
      true,
      result.getTransactionId(),
      request.getAmount(),
      "MAD",
      LocalDateTime.now()
    ));

  } catch (StripeException e) {
    logger.error("Erreur Stripe: " + e.getMessage());
    return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED)
      .body(new ErrorResponse("Erreur de paiement: " + e.getMessage()));
  } catch (Exception e) {
    logger.error("Erreur lors du traitement du paiement: " + e.getMessage());
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
      .body(new ErrorResponse("Erreur serveur"));
  }
}
```

### Validation Requis
- Numéro de carte: Algorithme de Luhn
- CVV: 3-4 chiffres
- Date d'expiration: Non expirée
- Montant: > 0
- Commande: Appartient au client

### Response Codes
- `200 OK` - Paiement réussi
- `400 BAD REQUEST` - Données invalides
- `401 UNAUTHORIZED` - Non authentifié
- `402 PAYMENT_REQUIRED` - Paiement refusé par la banque
- `403 FORBIDDEN` - Accès non autorisé
- `404 NOT FOUND` - Commande non trouvée
- `500 INTERNAL_SERVER_ERROR` - Erreur serveur

---

## 7️⃣ Traiter un Paiement avec une Carte Enregistrée

### Endpoint
```
POST /api/payments/process-saved
```

### Description
Traite un paiement en utilisant une carte bancaire déjà enregistrée.

### Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Request Body
```json
{
  "paymentMethodId": 1,
  "amount": 250.50,
  "orderId": 123
}
```

### Response (200 OK)
```json
{
  "success": true,
  "transactionId": "txn_9876543210fedcba",
  "amount": 250.50,
  "currency": "MAD",
  "timestamp": "2025-11-02T10:35:00Z"
}
```

### cURL
```bash
curl -X POST "https://afifi-mostafa.com:8443/api/payments/process-saved" \
  -H "Authorization: Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJjbGllbnRAdGVzdC5jb20iLCJ1c2VySWQiOjIsInJvbGUiOiJDTElFTlQiLCJpYXQiOjE3NjE5NDk5OTUsImV4cCI6MTc2MjAzNjM5NX0.yp_iSJmBSNp_8QTV5QhqPV2QRlY9G3r921KtdYr_HqbcKIKPVCE8XqpkZIfik_9DBQzniSJT6KYgBKwA0NvUVQ" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentMethodId": 1,
    "amount": 250.50,
    "orderId": 123
  }'
```

### Code Backend
```java
@PostMapping("/process-saved")
@PreAuthorize("isAuthenticated()")
@Transactional
public ResponseEntity<?> processPaymentWithSavedCard(
    @RequestBody @Valid ProcessSavedPaymentRequest request,
    @AuthenticationPrincipal UserDetails userDetails) {

  try {
    User user = userService.findByEmail(userDetails.getUsername());

    // Vérifier que la carte appartient au client
    SavedPaymentMethod paymentMethod = paymentService.getPaymentMethodById(
      request.getPaymentMethodId()
    );

    if (paymentMethod == null || !paymentMethod.getUser().getId().equals(user.getId())) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN)
        .body(new ErrorResponse("Accès non autorisé"));
    }

    // Vérifier que la carte n'est pas expirée
    if (isCardExpired(paymentMethod.getExpiryMonth(), paymentMethod.getExpiryYear())) {
      return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(new ErrorResponse("Carte expirée"));
    }

    // Vérifier le montant
    if (request.getAmount() <= 0) {
      return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(new ErrorResponse("Montant invalide"));
    }

    // Vérifier la commande
    Order order = orderService.getOrderById(request.getOrderId());
    if (order == null || !order.getClient().getId().equals(user.getId())) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN)
        .body(new ErrorResponse("Accès non autorisé"));
    }

    // Récupérer le token Stripe de la carte enregistrée
    String cardToken = paymentMethod.getStripeTokenId(); // ou votre provider

    // Charger la carte avec le service de paiement
    PaymentResult result = stripeService.chargeSavedCard(
      cardToken,
      request.getAmount(),
      "MAD",
      order.getId().toString()
    );

    if (!result.isSuccess()) {
      return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED)
        .body(new ErrorResponse("Paiement refusé: " + result.getErrorMessage()));
    }

    // Enregistrer la transaction
    Transaction transaction = new Transaction();
    transaction.setOrder(order);
    transaction.setPaymentMethod(paymentMethod);
    transaction.setAmount(request.getAmount());
    transaction.setTransactionId(result.getTransactionId());
    transaction.setPaymentMethodType(PaymentMethod.CARD);
    transaction.setStatus(TransactionStatus.SUCCESS);
    transaction.setCreatedAt(LocalDateTime.now());
    transactionService.save(transaction);

    // Mettre à jour le statut de la commande
    order.setStatus(OrderStatus.CONFIRMED);
    orderService.save(order);

    return ResponseEntity.ok(new PaymentResponse(
      true,
      result.getTransactionId(),
      request.getAmount(),
      "MAD",
      LocalDateTime.now()
    ));

  } catch (StripeException e) {
    logger.error("Erreur Stripe: " + e.getMessage());
    return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED)
      .body(new ErrorResponse("Erreur de paiement"));
  } catch (Exception e) {
    logger.error("Erreur lors du paiement: " + e.getMessage());
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
      .body(new ErrorResponse("Erreur serveur"));
  }
}
```

### Validation Requis
- paymentMethodId: Existe et appartient au client
- Carte: Non expirée
- Montant: > 0
- Commande: Existe et appartient au client

### Response Codes
- `200 OK` - Paiement réussi
- `400 BAD REQUEST` - Données invalides
- `401 UNAUTHORIZED` - Non authentifié
- `402 PAYMENT_REQUIRED` - Paiement refusé
- `403 FORBIDDEN` - Accès non autorisé
- `404 NOT FOUND` - Ressource non trouvée
- `500 INTERNAL_SERVER_ERROR` - Erreur serveur

---

## 📊 Tableau Récapitulatif

| # | Endpoint | Method | Auth | Description |
|---|----------|--------|------|------------|
| 1 | `/api/payments/saved-methods` | GET | ✓ | Lister les cartes |
| 2 | `/api/payments/default-method` | GET | ✓ | Carte par défaut |
| 3 | `/api/payments/save-method` | POST | ✓ | Enregistrer une carte |
| 4 | `/api/payments/{id}/set-default` | PUT | ✓ | Définir par défaut |
| 5 | `/api/payments/{id}` | DELETE | ✓ | Supprimer une carte |
| 6 | `/api/payments/process` | POST | ✓ | Paiement nouvelle carte |
| 7 | `/api/payments/process-saved` | POST | ✓ | Paiement carte enregistrée |

---

## 🔐 Sécurité - Bonnes Pratiques

### 1. **Ne JAMAIS stocker les numéros de carte complets**
```java
// ❌ MAUVAIS
savedCard.setCardNumber("4532111122223333");

// ✓ BON
savedCard.setLastFourDigits("3333");
savedCard.setTokenId("stripe_token_123");
```

### 2. **Utiliser un service de paiement tiers**
```java
// Stripe
com.stripe.model.Charge charge = Charge.create(params);

// Square
Payment payment = client.getPaymentsApi().createPayment(payment);

// PayPal
PaymentResource paymentResource = payment.create(apiContext);
```

### 3. **Chiffrer les données sensibles**
```java
String encryptedCVV = encryptionService.encrypt(cvv);
String encryptedNumber = encryptionService.encrypt(cardNumber);
```

### 4. **Valider l'algorithme de Luhn**
```java
public boolean isValidCardNumber(String cardNumber) {
  String digits = cardNumber.replaceAll("\\D", "");

  if (digits.length() < 13 || digits.length() > 19) {
    return false;
  }

  long number = 0;
  for (char digit : digits.toCharArray()) {
    number = number * 10 + Character.getNumericValue(digit);
  }

  return isValidLuhn(number);
}

private boolean isValidLuhn(long number) {
  int sum = 0;
  int count = 0;

  while (number > 0) {
    int digit = (int) (number % 10);

    if (count % 2 == 1) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    number /= 10;
    count++;
  }

  return sum % 10 == 0;
}
```

### 5. **Implémenter le Rate Limiting**
```java
@Configuration
public class SecurityConfig {

  @Bean
  public RateLimitingInterceptor rateLimitingInterceptor() {
    return new RateLimitingInterceptor()
      .withLimit(10) // 10 requêtes
      .withPeriod(Duration.ofMinutes(1)); // par minute
  }
}
```

### 6. **Logger les transactions**
```java
logger.info("Transaction réussie - ID: {}, Montant: {}, Carte: ****{}, Timestamp: {}",
  transactionId,
  amount,
  lastFourDigits,
  LocalDateTime.now()
);
```

---

## 🧪 Exemples de Test

### Test 1: Lister les cartes
```bash
# Succès
curl -X GET "https://afifi-mostafa.com:8443/api/payments/saved-methods" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Résultat attendu: 200 OK avec liste des cartes
```

### Test 2: Enregistrer une carte
```bash
# Nouveau client (pas de carte)
curl -X POST "https://afifi-mostafa.com:8443/api/payments/save-method" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cardNumber": "4532111122223333",
    "cardholderName": "TEST USER",
    "expiryMonth": "12",
    "expiryYear": "25",
    "cvv": "123",
    "setAsDefault": true
  }'

# Résultat attendu: 201 CREATED
```

### Test 3: Traiter un paiement
```bash
# Créer une commande d'abord
orderResponse=$(curl -X POST "https://afifi-mostafa.com:8443/api/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}')

orderId=$(echo $orderResponse | jq '.id')

# Puis payer
curl -X POST "https://afifi-mostafa.com:8443/api/payments/process" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cardNumber": "4532111122223333",
    "cardholderName": "TEST USER",
    "expiryMonth": "12",
    "expiryYear": "25",
    "cvv": "123",
    "amount": 250.50,
    "orderId": '$orderId'
  }'

# Résultat attendu: 200 OK avec transactionId
```

### Test 4: Carte expirée
```bash
curl -X POST "https://afifi-mostafa.com:8443/api/payments/process" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cardNumber": "4532111122223333",
    "cardholderName": "TEST USER",
    "expiryMonth": "11",
    "expiryYear": "23",
    "cvv": "123",
    "amount": 250.50,
    "orderId": 123
  }'

# Résultat attendu: 400 BAD REQUEST - "Carte expirée"
```

### Test 5: Numéro invalide
```bash
curl -X POST "https://afifi-mostafa.com:8443/api/payments/process" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cardNumber": "1234567890123", # Invalide (Luhn)
    "cardholderName": "TEST USER",
    "expiryMonth": "12",
    "expiryYear": "25",
    "cvv": "123",
    "amount": 250.50,
    "orderId": 123
  }'

# Résultat attendu: 400 BAD REQUEST - "Numéro de carte invalide"
```

---

## 📚 Classes/DTOs à Créer

### SavePaymentMethodRequest.java
```java
@Data
@AllArgsConstructor
@NoArgsConstructor
public class SavePaymentMethodRequest {
  @NotBlank
  private String cardNumber;

  @NotBlank
  private String cardholderName;

  @NotBlank
  @Pattern(regexp = "^(0[1-9]|1[0-2])$")
  private String expiryMonth;

  @NotBlank
  @Pattern(regexp = "^\\d{2}$")
  private String expiryYear;

  @NotBlank
  @Pattern(regexp = "^\\d{3,4}$")
  private String cvv;

  private boolean setAsDefault = false;
}
```

### ProcessPaymentRequest.java
```java
@Data
@AllArgsConstructor
@NoArgsConstructor
public class ProcessPaymentRequest {
  @NotBlank
  private String cardNumber;

  @NotBlank
  private String cardholderName;

  @NotBlank
  private String expiryMonth;

  @NotBlank
  private String expiryYear;

  @NotBlank
  private String cvv;

  @Positive
  private BigDecimal amount;

  @Positive
  private Long orderId;
}
```

### ProcessSavedPaymentRequest.java
```java
@Data
@AllArgsConstructor
@NoArgsConstructor
public class ProcessSavedPaymentRequest {
  @Positive
  private Long paymentMethodId;

  @Positive
  private BigDecimal amount;

  @Positive
  private Long orderId;
}
```

### SavedPaymentMethodDTO.java
```java
@Data
@AllArgsConstructor
@NoArgsConstructor
public class SavedPaymentMethodDTO {
  private Long id;
  private String lastFourDigits;
  private String cardholderName;
  private String expiryMonth;
  private String expiryYear;
  private boolean isDefault;
}
```

### PaymentResponse.java
```java
@Data
@AllArgsConstructor
@NoArgsConstructor
public class PaymentResponse {
  private boolean success;
  private String transactionId;
  private BigDecimal amount;
  private String currency;
  private LocalDateTime timestamp;
}
```

### ErrorResponse.java
```java
@Data
@AllArgsConstructor
@NoArgsConstructor
public class ErrorResponse {
  private String message;
  private LocalDateTime timestamp = LocalDateTime.now();
}
```

---

## ✅ Checklist d'Implémentation

- [ ] Créer les DTOs/Requests
- [ ] Créer les entités JPA (SavedPaymentMethod, Transaction)
- [ ] Implémenter le PaymentController
- [ ] Implémenter le PaymentService
- [ ] Intégrer un service de paiement (Stripe/Square/PayPal)
- [ ] Ajouter la validation (Luhn, dates, etc.)
- [ ] Ajouter le chiffrement des données sensibles
- [ ] Implémenter les logs
- [ ] Tester avec les exemples cURL
- [ ] Ajouter la documentation Swagger/OpenAPI

---

## 🎯 Prochaines Étapes

1. **Choisir le service de paiement** (Stripe recommandé)
2. **Créer les tables de base de données**
3. **Implémenter les endpoints**
4. **Configurer le chiffrement**
5. **Ajouter les tests unitaires**
6. **Déployer et tester en production**
