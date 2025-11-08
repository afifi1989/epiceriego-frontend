# Implémentation Attrayante de la Sélection d'Unités de Vente - Côté Client

## 🎯 Vue d'Ensemble

L'application EpicerieGo implémente maintenant une **interface attrayante et intuitive** permettant aux clients de sélectionner différents formats/unités de produits directement lors du shopping. Les épiciers peuvent définir plusieurs formats d'un même produit (par pièce, 500g, 1kg, etc.) avec des prix et stocks distincts.

---

## ✨ Caractéristiques Principales

### 1. **Sélecteur d'Unités Attrayant** (`ProductUnitDisplay.tsx`)

#### Design Visuel
- **Grille de cartes** montrant tous les formats disponibles
- **Emojis descriptifs** pour chaque type d'unité:
  - 📦 Pièce (à l'unité)
  - ⚖️ Poids (kg)
  - 🧃 Volume (litres)
  - 📏 Longueur (mètres)
- **Badges de stock** avec codes couleur:
  - 🟢 En stock
  - 🟡 Stock faible
  - 🔴 Rupture

#### Fonctionnalités
```
┌─────────────────────────────────────────┐
│  Choisissez votre format                │
├─────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌────────┐│
│  │    📦    │  │    ⚖️    │  │  🧃   ││
│  │À l'unité │  │   500g   │  │  1.5L  ││
│  │  €2.50   │  │  €1.20   │  │ €4.80  ││
│  │   ✓ En   │  │ ✓ Stock  │  │  ✕   ││
│  │  stock   │  │  faible   │  │Rupture││
│  │  ✓       │  │          │  │        ││
│  └──────────┘  └──────────┘  └────────┘│
├─────────────────────────────────────────┤
│ Format sélectionné: À l'unité             │
│ Prix unitaire: €2.50                      │
│ Stock disponible: 50                      │
├─────────────────────────────────────────┤
│ Quantité                                  │
│  [−] [ 1 ] [+]  │  Total: €2.50          │
├─────────────────────────────────────────┤
│  🛒 Ajouter au panier                    │
└─────────────────────────────────────────┘
```

### 2. **Intégration Fluide**

#### Sur la Page de Listing (Épiceries)
```
Quand l'utilisateur clique "+"  sur un produit avec unités:
   ↓
   Modal s'ouvre avec le sélecteur attrayant
   ↓
   Utilisateur choisit format + quantité
   ↓
   Clique "Ajouter au panier"
   ↓
   Item ajouté avec info d'unité
   ↓
   Modal se ferme
```

Pour les produits **sans unités**:
- Ajout direct au panier (pas de modal)
- Ancien comportement préservé

#### Sur la Page de Détail du Produit
- Le composant `ProductUnitDisplay` remplace l'ancien sélecteur de quantité
- Interface plus claire et attractive
- Meilleure présentation des formats disponibles

#### Sur la Page du Panier
```
Produit dans le panier:

│ Apple - À l'unité              -  +  ✕  │ €2.50 │
│ Banana - 500g                  -  +  ✕  │ €1.20 │
│ Orange - 1kg                   -  +  ✕  │ €3.00 │

Les informations d'unité sont affichées à côté du nom du produit
```

---

## 🔄 Flux Utilisateur Complet

### Scénario: Un client veut acheter des pommes en deux formats

```
1. BROWSING
   ├─ Client navigue dans "Fruits et Légumes"
   └─ Voit "Pommes" avec bouton "+"

2. SELECTION (Modal s'ouvre)
   ├─ 4 formats disponibles sont affichés:
   │  ├─ 📦 À l'unité: €0.50 chacune
   │  ├─ ⚖️ 500g: €2.00
   │  ├─ ⚖️ 1kg: €3.50 ✓ Sélectionné
   │  └─ ⚖️ 2kg: €6.00
   └─ Détails du format sélectionné affichés

3. CONFIGURATION
   ├─ Client change la quantité: 1 → 3kg (3 unités)
   ├─ Prix total: €3.50 × 3 = €10.50
   └─ Clique "Ajouter au panier"

4. CONFIRMATION
   ├─ Toast: "✅ Pommes (1kg) ajoutées au panier"
   ├─ Modal se ferme
   └─ Panier passé de 0 à 1 article

5. PREMIER AJOUT AU PANIER
   Panier:
   ├─ Pommes - 1kg          -  +  ✕  €10.50

6. AJOUT SUPPLEMENTAIRE (Même produit, autre format)
   ├─ Client clique "+" de nouveau sur Pommes
   ├─ Choisit format: 📦 À l'unité
   ├─ Quantité: 5 pièces
   ├─ Prix total: €0.50 × 5 = €2.50
   ├─ Ajoute au panier
   └─ Toast: "✅ Pommes (À l'unité) ajoutées au panier"

7. PANIER FINAL
   ├─ Pommes - 1kg           -  +  ✕  €10.50
   ├─ Pommes - À l'unité     -  +  ✕  €2.50
   └─ Total: €13.00
```

---

## 📱 Interface Visuelle

### Grid Layout des Unités
```
Choisissez votre format
┌──────────────────────────────────────┐
│ ┌──────────┐ ┌──────────┐ ┌────────┐│
│ │    📦    │ │    ⚖️    │ │  🧃   ││
│ │À l'unité │ │   500g   │ │  1L   ││
│ │  €2.50   │ │  €1.20   │ │ €4.00 ││
│ │✓ Excellent│ │  ✓ Bon   │ │Rupture││
│ │          │ │  stock   │ │        ││
│ │ [Coché]  │ │          │ │[Désac]││
│ └──────────┘ └──────────┘ └────────┘│
│ ┌──────────┐                         │
│ │    ⚖️    │                         │
│ │   1kg    │                         │
│ │  €3.50   │                         │
│ │ ✓ Stock  │                         │
│ │  faible  │                         │
│ └──────────┘                         │
└──────────────────────────────────────┘
```

### Barre de Quantité
```
Quantité
┌─────────────────────────────────┐
│ [−] [ 1 ] [+]  │  Total €2.50   │
└─────────────────────────────────┘
```

Utilisateur peut:
- Cliquer [−] pour diminuer
- Cliquer [+] pour augmenter
- Taper directement la valeur
- Voir le prix total mis à jour en temps réel

### Indicateurs de Stock
```
Couleur | Label           | Situation
--------|-----------------|------------------
Vert    | Excellent/Bon   | Plus de 50 unités
Jaune   | Stock faible    | 10-50 unités
Rouge   | Rupture         | 0 unités (désactivé)
```

---

## 🛠 Architecture Technique

### Composants
```
ProductUnitDisplay.tsx (564 lignes)
├─ Props: { product, onAddToCart }
├─ State: selectedUnitId, quantity
└─ Features:
   ├─ Grid de cartes unitaires
   ├─ Sélecteur de quantité
   ├─ Calcul de prix en temps réel
   ├─ Validation de stock
   └─ Support legacy (produits sans units)
```

### Services Améliorés

#### cartService.ts
```typescript
// Identification par productId + unitId
addToCart(item: CartItem)
  └─ Cherche: item.productId && item.unitId
  └─ Fusionne si existe déjà
  └─ Met à jour totalPrice

updateQuantity(productId, delta, unitId?)
  └─ Respecte les unités spécifiques

removeFromCart(productId, unitId?)
  └─ Suppression granulaire par format
```

#### CartItem Structure
```typescript
interface CartItem {
  productId: number;           // Clé pour identification
  productNom: string;
  unitId?: number;             // Clé secondaire pour unité
  unitLabel?: string;          // "500g", "À l'unité", etc.
  quantity: number;
  requestedQuantity?: number;
  pricePerUnit: number;
  totalPrice: number;          // Clé pour calcul
  photoUrl?: string;
}
```

---

## 📊 Calculs et Validation

### Calcul de Prix
```
totalPrice = pricePerUnit × quantity

Exemple:
  Format: 500g à €1.20
  Quantité demandée: 2.5kg (soit 5 unités)
  Total: €1.20 × 5 = €6.00
```

### Validation de Stock
```
canOrder(unit, requestedQuantity) {
  unitsNeeded = ceil(requestedQuantity / unit.quantity)
  return unit.stock >= unitsNeeded && unit.isAvailable
}

Exemple:
  Format: 500g, Stock: 10 unités
  Demande: 3kg (soit 6 unités)
  Possible? OUI (10 ≥ 6)

  Demande: 6kg (soit 12 unités)
  Possible? NON (10 < 12)
```

---

## ✅ Tests Recommandés

### 1. Navigation
- [ ] Ajouter produit avec units → Modal s'ouvre
- [ ] Ajouter produit sans units → Ajout direct
- [ ] Fermer modal (X) → Retour à listing

### 2. Sélection d'Unité
- [ ] Cliquer sur différentes cartes → Sélection visuelle change
- [ ] Carte désactivée (rupture) → Impossible de sélectionner
- [ ] Détails de l'unité → Affichés correctement

### 3. Quantité
- [ ] Augmenter [+] → Quantité et prix augmentent
- [ ] Diminuer [−] → Quantité et prix diminuent
- [ ] Taper valeur → Acceptée si valide
- [ ] Prix total → Mis à jour en temps réel

### 4. Panier
- [ ] Item avec unité → Affiche format et prix
- [ ] Deux fois le même produit, formats différents → Deux lignes
- [ ] Augmenter quantité panier → Prix respecte le format
- [ ] Supprimer (X) → Item retiré correctement
- [ ] Total panier → Correct (somme des totalPrice)

### 5. Cas Limites
- [ ] Stock 0 → Carte grisée, impossible d'ajouter
- [ ] Quantité > stock → Message d'erreur
- [ ] Produit sans description → Pas d'erreur
- [ ] Modal en paysage → Interface responsive

---

## 🎨 Palette de Couleurs

```
Primaire:      #4CAF50 (Vert EpicerieGo)
Secondaire:    #2196F3 (Bleu)
Stock Bon:     #4CAF50 (Vert)
Stock Faible:  #FFC107 (Ambre)
Rupture:       #f44336 (Rouge)
Fond Modal:    #fff    (Blanc)
Fond Item:     #f9f9f9 (Gris clair)
Texte Primaire: #333   (Noir)
Texte Secondaire: #666 (Gris)
```

---

## 📚 Fichiers Modifiés

### Nouveaux Fichiers
- `components/client/ProductUnitDisplay.tsx` (564 lignes)
- `CLIENT_UNIT_SELECTION_IMPLEMENTATION.md` (ce fichier)

### Fichiers Modifiés
1. **app/(client)/(epicerie)/[id].tsx** (+119/-5)
   - Ajout modal de sélection d'unités
   - Gestion des deux workflows (avec/sans unités)

2. **app/(client)/(epicerie)/product/[productId].tsx** (+30/-140)
   - Intégration du composant ProductUnitDisplay
   - Suppression du sélecteur de quantité legacy

3. **app/(client)/cart.tsx** (+55/-25)
   - Affichage des infos d'unité (unitLabel)
   - Bouton de suppression par item
   - Calcul de total correct avec totalPrice

4. **src/services/cartService.ts** (+40/-20)
   - Utilisation de `productId` + `unitId` pour identification
   - Fusion intelligente des items
   - Calcul de prix correct

---

## 🚀 Fonctionnalités Futures

- [ ] Bouton "Ajouter plus tard" pour économiser temps
- [ ] Historique de préférences d'unité par client
- [ ] Suggestions "Format recommandé" basées sur actes
- [ ] Comparateur de prix par unité de base (€ par kg, etc.)
- [ ] Wishlist par format spécifique
- [ ] Notification quand rupture → réapprovisionnement

---

## 💡 Notes pour les Développeurs

### Intégration avec Backend
```
GET /products/{id}  → Inclut array "units"
POST /products/{productId}/units → Création unité
PUT /products/{productId}/units/{unitId} → Modification
DELETE /products/{productId}/units/{unitId} → Suppression
```

### Hook useLanguage
Le composant utilise `useLanguage()` pour les textes - penser à ajouter clés de traduction si nouveau texte ajouté.

### Performances
- ProductUnitDisplay optimisé avec useMemo/useCallback si besoin
- Pas de re-render inutile grâce à bien structurer le state
- Calculs de prix sont O(1)

---

## 📞 Support

Pour toute question sur cette implémentation:
1. Vérifier les console.log en [affichage, ajout, panier]
2. Inspecter le CartItem en AsyncStorage
3. Vérifier les props passées au ProductUnitDisplay

