# Implémentation du Système de Paiement par Carte

## Vue d'ensemble

Ce document décrit l'implémentation complète du système de paiement par carte bancaire dans l'application EpicerieGo, y compris la gestion des cartes enregistrées et les préférences de paiement.

## Architecture

### Services

#### `paymentService.ts` (src/services/paymentService.ts)

Le service de paiement gère toutes les opérations liées aux cartes bancaires:

```typescript
// Récupère les cartes enregistrées du client
getSavedPaymentMethods(): Promise<SavedPaymentMethod[]>

// Récupère la carte par défaut
getDefaultPaymentMethod(): Promise<SavedPaymentMethod | null>

// Enregistre une nouvelle carte
savePaymentMethod(cardDetails: CardPaymentDetails, setAsDefault: boolean): Promise<SavedPaymentMethod>

// Définit une carte comme défaut
setDefaultPaymentMethod(paymentMethodId: number): Promise<SavedPaymentMethod>

// Supprime une carte enregistrée
deletePaymentMethod(paymentMethodId: number): Promise<void>

// Traite un paiement avec une nouvelle carte
processCardPayment(cardDetails, amount, orderId): Promise<{ success: boolean; transactionId: string }>

// Traite un paiement avec une carte enregistrée
processPaymentWithSavedCard(paymentMethodId, amount, orderId): Promise<{ success: boolean; transactionId: string }>
```

### Types de Données

#### `CardPaymentDetails`
```typescript
interface CardPaymentDetails {
  cardNumber: string;           // Numéro de carte (16 chiffres)
  cardholderName: string;       // Nom du titulaire
  expiryMonth: string;          // Mois d'expiration (MM)
  expiryYear: string;           // Année d'expiration (YY)
  cvv: string;                  // Code de sécurité
  saveForLater?: boolean;       // Enregistrer pour les futures commandes
}
```

#### `SavedPaymentMethod`
```typescript
interface SavedPaymentMethod {
  id: number;                   // ID de la méthode de paiement
  lastFourDigits: string;       // 4 derniers chiffres (xxxx 1234)
  cardholderName: string;       // Nom du titulaire
  expiryMonth: string;          // Mois d'expiration
  expiryYear: string;           // Année d'expiration
  isDefault: boolean;           // Défaut pour les futures commandes
}
```

## Flux d'utilisation

### Étape 1: Sélection du mode de paiement

L'utilisateur sélectionne "💳 Carte bancaire" comme méthode de paiement dans la section "Méthode de paiement" de la page `cart.tsx:340-375`.

### Étape 2: Choix de la carte

Deux options sont disponibles:

#### Option A: Utiliser une carte enregistrée
- Si l'utilisateur a déjà enregistré des cartes, elles s'affichent dans une liste
- Chaque carte affiche:
  - Nom du titulaire + 4 derniers chiffres
  - Date d'expiration (MM/YY)
  - Case à cocher pour sélectionner la carte
- Un bouton "+ Ajouter une nouvelle carte" permet d'en ajouter une nouvelle

#### Option B: Saisir une nouvelle carte
- Cliquer sur "+ Ajouter une nouvelle carte" ouvre le formulaire de saisie
- Le formulaire contient:
  - **Numéro de carte**: 16 chiffres (filtrage automatique)
  - **Nom du titulaire**: Convertis automatiquement en majuscules
  - **Date d'expiration**: MM/YY avec champs séparés
  - **CVV**: Code de sécurité (3-4 chiffres, caché)
  - **Case à cocher**: "Enregistrer cette carte pour les prochaines commandes"

### Étape 3: Validation et traitement

Avant de traiter le paiement:

1. **Validation de l'adresse de livraison** ✓
2. **Validation du téléphone** (si livraison à domicile) ✓
3. **Validation du paiement par carte**:
   - Si carte enregistrée sélectionnée: valide l'ID
   - Si nouvelle carte: valide les champs du formulaire

### Étape 4: Création de la commande et paiement

Le processus dans `cart.tsx:125-237`:

```typescript
1. Créer la commande via orderService.createOrder()
2. Si paiement par carte enregistrée:
   → paymentService.processPaymentWithSavedCard()
3. Si nouvelle carte:
   → paymentService.processCardPayment()
   → Si saveForLater = true:
      → paymentService.savePaymentMethod()
4. Afficher le message de succès
5. Rediriger vers la page d'accueil
```

## Interface utilisateur

### Section Paiement par Carte (cart.tsx:378-523)

#### Affichage des cartes enregistrées
```
Cartes enregistrées
┌─────────────────────────────────┐
│ JEAN DUPONT - •••• 1234    ✓    │  ← Sélectionnée
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ MARIE MARTIN - •••• 5678         │
└─────────────────────────────────┘
┌───────────────────────────────────────┐
│ + Ajouter une nouvelle carte          │
└───────────────────────────────────────┘
```

#### Formulaire de saisie de carte
```
Informations de carte
┌─────────────────────────────┐
│ Numéro de carte (16 chiffres)
│ [4532 1111 2222 3333]       │
├─────────────────────────────┤
│ Nom du titulaire
│ [JEAN DUPONT]               │
├─────────────────────────────┤
│ Date d'expiration    CVV
│ [12] / [25]    [123]        │
├─────────────────────────────┤
│ ☐ Enregistrer cette carte   │
│   pour les prochaines...    │
├─────────────────────────────┤
│ Annuler                     │
└─────────────────────────────┘
```

## Sécurité

### Points importants

1. **Le CVV est caché** (secureTextEntry={true})
2. **Les cartes enregistrées stockent uniquement**:
   - Les 4 derniers chiffres
   - Le nom du titulaire
   - La date d'expiration
   - L'ID de la transaction

3. **Les données sensibles sont transmises via HTTPS**
4. **Validation côté client** avant envoi

### Recommandations d'implémentation backend

Pour la sécurité en production, le backend devrait:

1. **Utiliser un service de paiement tiers** (Stripe, Square, PayPal, etc.)
   - Ne JAMAIS stocker les numéros de carte complets
   - Utiliser des tokens/payment methods du provider

2. **PCI-DSS Compliance**
   - Chiffrement des données en transit (HTTPS)
   - Chiffrement des données au repos
   - Isolation des systèmes de paiement

3. **Validation stricte**
   - Algorithme de Luhn pour les numéros de carte
   - Vérification des dates d'expiration
   - Détection de fraude

## Endpoints API requis

### GET `/api/payments/saved-methods`
Retourne la liste des cartes enregistrées du client

**Réponse:**
```json
[
  {
    "id": 1,
    "lastFourDigits": "1234",
    "cardholderName": "JEAN DUPONT",
    "expiryMonth": "12",
    "expiryYear": "25",
    "isDefault": true
  }
]
```

### GET `/api/payments/default-method`
Retourne la carte par défaut

### POST `/api/payments/save-method`
Enregistre une nouvelle carte

**Payload:**
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

### PUT `/api/payments/{paymentMethodId}/set-default`
Définit une carte comme défaut

### DELETE `/api/payments/{paymentMethodId}`
Supprime une carte enregistrée

### POST `/api/payments/process`
Traite un paiement avec une nouvelle carte

**Payload:**
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

**Réponse:**
```json
{
  "success": true,
  "transactionId": "txn_abc123xyz"
}
```

### POST `/api/payments/process-saved`
Traite un paiement avec une carte enregistrée

**Payload:**
```json
{
  "paymentMethodId": 1,
  "amount": 250.50,
  "orderId": 123
}
```

## Flux de la page Panier

```
┌─────────────────────────────────────┐
│ 1. CART SCREEN INITIALIZATION       │
│ - Charger les cartes enregistrées   │
│ - Charger l'adresse par défaut      │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 2. USER SELECTS DELIVERY TYPE       │
│ - HOME_DELIVERY ou PICKUP           │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 3. USER ENTERS DELIVERY INFO        │
│ - Adresse                           │
│ - Téléphone (si HOME_DELIVERY)      │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 4. USER SELECTS PAYMENT METHOD      │
│ ├─ CASH (espèces)                   │
│ └─ CARD (carte bancaire)            │
└─────────────────────────────────────┘
              ↓
       ┌──────┴──────┐
       ↓             ↓
   [CASH]       [CARD]
       ↓             ↓
    SKIP      ┌─────────────────────┐
              │ 5A. SAVED CARDS?    │
              ├─ Oui → Select card  │
              └─ Non → Show form    │
                      ↓
                ┌─────────────────┐
                │ 5B. SAVE LATER? │
                │ ☐ Yes / ☐ No   │
                └─────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 6. CLICK "COMMANDER"                │
│ - Créer la commande                 │
│ - Traiter le paiement               │
│ - Enregistrer la carte (si oui)     │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 7. SUCCESS → REDIRECT TO HOME       │
└─────────────────────────────────────┘
```

## Gestion des erreurs

### Validation côté client
- Numéro de carte invalide
- Nom du titulaire manquant
- Date d'expiration invalide
- CVV invalide
- Pas de carte sélectionnée

### Erreurs de paiement
- Carte refusée par la banque
- Montant insuffisant
- Carte expirée
- 3D Secure échoué (si applicable)

## Code d'exemple

### Charger les cartes enregistrées
```typescript
const [savedCards, setSavedCards] = useState<SavedPaymentMethod[]>([]);

useEffect(() => {
  const loadCards = async () => {
    try {
      const cards = await paymentService.getSavedPaymentMethods();
      setSavedCards(cards);
    } catch (error) {
      console.error('Erreur:', error);
    }
  };
  loadCards();
}, []);
```

### Traiter un paiement
```typescript
// Avec carte enregistrée
await paymentService.processPaymentWithSavedCard(
  cardId,
  totalAmount,
  orderId
);

// Avec nouvelle carte
await paymentService.processCardPayment(
  cardDetails,
  totalAmount,
  orderId
);

// Enregistrer la carte
if (cardDetails.saveForLater) {
  await paymentService.savePaymentMethod(cardDetails, false);
}
```

## Tests

### Cas de test à valider

1. ✓ Sélectionner "Espèces" → Commander
2. ✓ Sélectionner "Carte bancaire" avec carte enregistrée → Commander
3. ✓ Ajouter une nouvelle carte → Enregistrer → Commander
4. ✓ Ajouter une nouvelle carte → Ne pas enregistrer → Commander
5. ✗ Entrer un numéro de carte invalide → Afficher erreur
6. ✗ Laisser des champs vides → Afficher erreur

## Prochaines étapes

1. **Implémentation backend**
   - Créer les endpoints de paiement
   - Intégrer un service de paiement tiers

2. **Authentification 3D Secure**
   - Ajouter support pour les paiements sécurisés

3. **Gestion des remboursements**
   - Ajouter un système de refund

4. **Historique de paiement**
   - Afficher les transactions précédentes

5. **Notifications**
   - Email de confirmation de paiement
   - SMS de confirmation
