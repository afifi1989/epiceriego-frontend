# Guide Rapide - Système de Paiement par Carte

## 🚀 Démarrage Rapide

Le système de paiement par carte est maintenant **complètement fonctionnel** côté frontend!

---

## ✨ Fonctionnalités Disponibles

### ✅ Prêt à l'emploi (Frontend)

- ✓ Formulaire de paiement par carte complet
- ✓ Enregistrement des cartes bancaires
- ✓ Sélection de cartes enregistrées
- ✓ Validation des données (frontend)
- ✓ Logs détaillés de débogage
- ✓ Stockage local des cartes (AsyncStorage)
- ✓ Simulation du paiement (mode dev)

### ❌ À Implémenter (Backend)

- ✗ Endpoints API de paiement (7 endpoints)
- ✗ Intégration Stripe/Square/PayPal
- ✗ Base de données des cartes
- ✗ Chiffrement des données

---

## 📱 Utilisation Utilisateur

### Étape 1: Sélectionner le Mode de Paiement

```
Page du Panier
├─ Type de livraison: À domicile / Retrait
├─ Adresse de livraison
├─ Méthode de paiement:
│  ├─ 💵 Espèces
│  └─ 💳 Carte bancaire ← CLIQUER ICI
```

### Étape 2: Ajouter une Carte (Première fois)

```
Si aucune carte enregistrée:
├─ Bouton "Ajouter une nouvelle carte"
│  └─ CLIQUER

Formulaire:
├─ Numéro de carte: 4532111122223333
├─ Nom du titulaire: JEAN DUPONT
├─ Date expiration: 12 / 25
├─ CVV: 123
├─ ☑ Enregistrer pour les futures commandes
└─ Bouton "Commander"
```

### Étape 3: Utiliser une Carte Enregistrée

```
Si cartes enregistrées:
├─ [✓] JEAN DUPONT - •••• 3333
├─ [ ] MARIE MARTIN - •••• 5678
├─ [ ] + Ajouter une nouvelle carte
└─ Bouton "Commander"
```

### Résultat: Message de Succès

```
✓ Succès
Votre commande avec livraison à domicile
et paiement en carte bancaire a été créée!

[OK] → Redirection vers l'accueil
```

---

## 🛠️ Configuration Requise

### Frontend (Déjà Fait ✓)

```typescript
// Fichiers modifiés/créés:
✓ src/services/paymentService.ts       (nouveau)
✓ app/(client)/cart.tsx                 (modifié)
✓ src/type/index.ts                     (modifié - types ajoutés)
```

### Backend (À Faire)

Voir `BACKEND_API_ENDPOINTS.md` pour:
- 7 endpoints API à implémenter
- Exemples cURL complets
- Code Spring Boot exemple
- DTOs et entités JPA

---

## 🧪 Test Sans Backend

L'application fonctionne **même sans backend** grâce au mode développement!

### Test 1: Nouvelle Carte + Enregistrer

```bash
# Ouvrir l'app
# Aller à: Panier → Produit → Checkout

1. Sélectionner "💳 Carte bancaire"
2. Cliquer "Ajouter une nouvelle carte"
3. Remplir:
   - 4532111122223333
   - JEAN DUPONT
   - 12/25
   - 123
4. Cocher "Enregistrer cette carte"
5. Cliquer "Commander"
6. Voir le message "Succès"
7. Vérifier les logs console [PaymentService]
```

### Test 2: Vérifier la Carte Enregistrée

```bash
1. Nouvelle tentative de panier
2. Sélectionner "💳 Carte bancaire"
3. La carte devrait être visible:
   "JEAN DUPONT - •••• 3333"
4. La sélectionner
5. Cliquer "Commander"
6. Vérifier le succès
```

### Test 3: Pas Enregistrer

```bash
1. Nouvelle carte
2. NE PAS cocher "Enregistrer"
3. Commander
4. Nouvelle commande: Pas de carte en liste
```

---

## 📊 Logs de Débogage

### Ouvrir les logs

**React Native Debugger:**
```
npm start
→ Ouvrir "React Native Debugger"
→ Menu: Debugger → Console
→ Chercher [PaymentService]
```

**Expo CLI:**
```
npm start
→ Appuyer sur 'j' pour ouvrir le debugger
→ Chercher les logs
```

### Exemple de logs attendus

```
[PaymentService] Récupération des cartes enregistrées...
[PaymentService] Impossible de récupérer les cartes (endpoint non disponible)
[PaymentService] Traitement du paiement par nouvelle carte
[PaymentService] Montant: 250.5 DH
[PaymentService] Enregistrement de la carte...
[PaymentService] Carte: 3333 (par défaut)
[PaymentService] Erreur enregistrement: Network Error
[PaymentService] Mode développement: Carte enregistrée localement
[PaymentService] Traitement du paiement par nouvelle carte
[PaymentService] Montant: 250.5 DH
[PaymentService] Mode développement: Paiement simulé
```

---

## 🔧 Développement - Modifier la Carte

### Fichier: `app/(client)/cart.tsx`

Localiser la section du formulaire de paiement:

```typescript
// Ligne ~378-523
{paymentMethod === 'CARD' && (
  <View style={styles.cardSection}>
    {savedPaymentMethods.length > 0 && !showCardForm && (
      // Liste des cartes enregistrées
    )}

    {showCardForm && (
      // Formulaire de saisie
      <View style={styles.cardFormContainer}>
        <TextInput placeholder="Numéro de carte (16 chiffres)" />
        <TextInput placeholder="Nom du titulaire" />
        {/* ... autres champs ... */}
      </View>
    )}
  </View>
)}
```

### Styles: `StyleSheet` en bas du fichier

```typescript
const styles = StyleSheet.create({
  // ...
  cardSection: { /* ... */ },
  cardOption: { /* ... */ },
  cardFormContainer: { /* ... */ },
  // ... voir les autres styles ...
});
```

---

## 🔐 Sécurité - Points à Connaître

⚠️ **IMPORTANT:**

1. **Les CVV ne sont jamais stockés** (champ secureTextEntry)
2. **Les numéros complets ne sont jamais stockés** (seuls les 4 derniers)
3. **Transmission HTTPS obligatoire**
4. **Validation côté client + backend requis**

### Quand vous implémenterez le backend:

```java
// ✓ BON: Utiliser un service de paiement tiers
Stripe.chargeCard(cardToken, amount);

// ❌ MAUVAIS: Jamais faire ça!
database.save("cardNumber", "4532111122223333");
```

---

## 📚 Documentation Complète

| Document | Description |
|----------|------------|
| `IMPLEMENTATION_SUMMARY.md` | Résumé complet de l'implémentation |
| `BACKEND_API_ENDPOINTS.md` | Endpoints et cURL pour le backend |
| `BACKEND_DATABASE_MODELS.md` | Modèles JPA et SQL |
| `FIX_PAYMENT_SUMMARY.md` | Corrections et mode dev |

---

## 💻 Commandes Utiles

### Démarrer l'app
```bash
npm start
# ou
npm run android
npm run ios
npm run web
```

### Voir les logs
```bash
# React Native CLI
npm start
# Appuyer sur 'j'

# Ou utiliser Expo Go
# Appuyer sur Cmd+M (Mac) ou Ctrl+M (Windows)
```

### Nettoyer le stockage local
```typescript
// Dans une page ou composant:
import AsyncStorage from '@react-native-async-storage/async-storage';

await AsyncStorage.removeItem('saved_cards');
console.log('Cartes locales supprimées');
```

### Linting
```bash
npm run lint
npm run lint -- --fix
```

---

## 🐛 Dépannage

### Problème: "La carte n'est pas enregistrée"

**Solution:**
- Vérifier les logs console pour `[PaymentService]`
- Si vous voyez "Carte enregistrée localement", c'est correct
- La carte est dans AsyncStorage
- Le backend n'est pas implémenté

### Problème: "Erreur lors du paiement"

**Solutions possibles:**

1. **Vérifier les logs:**
   ```
   [PaymentService] Mode développement: Paiement simulé
   = Tout fonctionne! (pas de backend)
   ```

2. **Valider le formulaire:**
   - Numéro: 13+ chiffres
   - Nom: Non vide
   - Date: MM/YY valide
   - CVV: 3-4 chiffres

3. **Vérifier la connexion:**
   - API_CONFIG.BASE_URL correct?
   - JWT token valide?

### Problème: "Données de carte non affichées"

**Vérifier:**
- FormData transmise correctement (console logs)
- États React mis à jour (cardDetails)
- Validation passée (validateCardDetails())

---

## 📝 Checklist - Avant Production

### Frontend ✓
- [x] Formulaire complet
- [x] Validation client
- [x] Enregistrement local
- [x] Logs détaillés
- [x] Gestion d'erreurs

### Backend à faire
- [ ] 7 endpoints implémentés
- [ ] Validation serveur
- [ ] Intégration Stripe/Square/PayPal
- [ ] Base de données cartes
- [ ] Chiffrement données

### Sécurité à valider
- [ ] PCI-DSS compliance
- [ ] HTTPS obligatoire
- [ ] JWT tokens valides
- [ ] Rate limiting
- [ ] Détection fraude

---

## 🎓 Apprendre Plus

### Structure du code

```
app/(client)/cart.tsx
├─ État local (cardDetails, selectedSavedCard)
├─ useEffect (charger cartes)
├─ Validation (validateCardDetails)
├─ Paiement (handleOrder)
└─ Rendu (formulaire + liste)

src/services/paymentService.ts
├─ getSavedPaymentMethods()
├─ savePaymentMethod()
├─ processCardPayment()
└─ processPaymentWithSavedCard()

src/type/index.ts
├─ CardPaymentDetails
└─ SavedPaymentMethod
```

---

## 🚀 Prochaines Étapes

### Semaine 1: Backend
- [ ] Créer les entités JPA
- [ ] Créer les repositories
- [ ] Implémenter PaymentController
- [ ] Créer les tables SQL

### Semaine 2: Intégration
- [ ] Choisir le service de paiement
- [ ] Implémenter l'intégration
- [ ] Tester les endpoints

### Semaine 3: Production
- [ ] Tests complets
- [ ] Audit de sécurité
- [ ] Déploiement

---

## 📞 Support

Voir la documentation:
```bash
# Endpoints API
cat BACKEND_API_ENDPOINTS.md

# Modèles BD
cat BACKEND_DATABASE_MODELS.md

# Résumé
cat IMPLEMENTATION_SUMMARY.md
```

**Bonne implémentation! 🎉**
