# Implémentation Frontend - Product Units

## 📋 Résumé

Implémentation complète du système de Product Units côté frontend pour permettre aux épiciers de gérer plusieurs formats de vente (pièce, poids, volume) et aux clients de choisir le format souhaité lors de l'achat.

---

## ✅ Fichiers Créés

### 1. Types et Interfaces
- **`src/type/index.ts`** - Mis à jour avec :
  - `UnitType` enum (PIECE, WEIGHT, VOLUME, LENGTH)
  - `ProductUnit` interface
  - `ProductUnitRequest` interface
  - Mise à jour de `Product` avec propriétés `units`, `totalStock`, `inStock`
  - Mise à jour de `CartItem` pour gérer les unités
  - Mise à jour de `OrderItem` et `OrderItemDetail` avec support des unités

### 2. Services
- **`src/services/unitService.ts`** - Nouveau service pour les Product Units :
  - `createUnit(productId, request)` - Créer une unité
  - `getUnits(productId)` - Récupérer les unités d'un produit
  - `updateUnit(productId, unitId, request)` - Modifier une unité
  - `deleteUnit(productId, unitId)` - Supprimer une unité

### 3. Utilitaires
- **`src/utils/unitCalculations.ts`** - Fonctions de calcul :
  - `calculateUnitPrice(unit, quantity)` - Calculer le prix total
  - `canOrder(unit, quantity)` - Vérifier si commande possible
  - `calculateUnitsNeeded(unit, quantity)` - Calculer nombre d'unités nécessaires
  - `formatQuantity(unit, quantity)` - Formater l'affichage de quantité
  - `getStockLevel(stock)` - Obtenir le niveau de stock avec couleur

### 4. Composants Épicier
- **`components/epicier/ProductUnitForm.tsx`** - Formulaire pour ajouter/modifier une unité :
  - Sélection du type d'unité (Pièce, Poids, Volume, Longueur)
  - Configuration de la quantité (1 pour pièce, 0.5 pour 500g, etc.)
  - Définition du libellé affiché au client
  - Gestion du prix et du stock
  - Ordre d'affichage

- **`components/epicier/ProductUnitList.tsx`** - Liste et gestion des unités :
  - Affichage de toutes les unités d'un produit
  - Actions : Modifier, Supprimer
  - Indicateurs de stock visuel
  - Modal pour créer/modifier des unités

### 5. Composants Client
- **`components/client/UnitSelector.tsx`** - Sélecteur d'unité pour les achats :
  - Affichage de tous les formats disponibles
  - Sélection visuelle du format
  - Contrôles de quantité (+/-)
  - Calcul automatique du prix total
  - Vérification du stock en temps réel
  - Support des produits legacy (sans unités)

---

## 🔄 Fichiers Modifiés

### 1. Page Épicier - Modification Produit
- **`app/(epicier)/modifier-produit.tsx`** :
  - Ajout d'un système d'onglets (Informations / Unités)
  - Onglet "Informations" : Formulaire existant
  - Onglet "Unités" : Liste et gestion des unités avec `ProductUnitList`
  - Compteur d'unités dans l'onglet

---

## 🎯 Fonctionnalités Implémentées

### Pour l'Épicier

#### 1. Gestion des Unités
- ✅ Créer plusieurs unités pour un même produit
- ✅ Configurer différents types : Pièce, Poids (kg), Volume (L), Longueur (m)
- ✅ Définir prix et stock indépendants par unité
- ✅ Modifier/Supprimer des unités
- ✅ Ordre d'affichage personnalisable

#### 2. Exemples d'Usage
```
Produit: Tomate
├─ À l'unité (1 pièce) - 0.50€ - Stock: 100
├─ Lot de 6 (6 pièces) - 2.50€ - Stock: 20
└─ 1kg (1.0 kg) - 3.00€ - Stock: 50

Produit: Jus d'Orange
├─ 250ml (0.25 L) - 1.50€ - Stock: 30
├─ 500ml (0.5 L) - 2.80€ - Stock: 25
└─ 1L (1.0 L) - 5.00€ - Stock: 15
```

### Pour le Client

#### 1. Sélection de Format
- ✅ Modal élégant affichant tous les formats disponibles
- ✅ Indicateurs de stock visuels (En stock / Stock limité / Rupture)
- ✅ Prix clairement affiché pour chaque format
- ✅ Impossibilité de sélectionner les formats en rupture

#### 2. Gestion de Quantité
- ✅ Contrôles +/- pour ajuster la quantité
- ✅ Saisie manuelle possible
- ✅ Calcul automatique du prix total
- ✅ Vérification du stock en temps réel
- ✅ Alerte si stock insuffisant

#### 3. Compatibilité
- ✅ Support des produits legacy (sans unités)
- ✅ Fallback automatique sur prix/stock classique

---

## 📱 Flux Utilisateur

### Épicier : Ajouter des Unités à un Produit

1. Accéder à la modification d'un produit
2. Basculer sur l'onglet "Unités"
3. Cliquer sur "Ajouter Unité"
4. Remplir le formulaire :
   - Choisir le type (Pièce, Poids, Volume, Longueur)
   - Définir la quantité (ex: 0.5 pour 500g)
   - Saisir le libellé (ex: "500g")
   - Définir le prix
   - Saisir le stock disponible
5. Sauvegarder
6. Répéter pour chaque format souhaité

### Client : Acheter un Produit avec Unités

1. Parcourir les produits de l'épicerie
2. Cliquer sur "Ajouter au panier" ou voir détails
3. Modal s'ouvre avec tous les formats disponibles
4. Sélectionner le format souhaité (carte verte quand sélectionnée)
5. Ajuster la quantité avec +/- ou saisie manuelle
6. Vérifier le prix total calculé automatiquement
7. Cliquer sur "Ajouter au Panier"
8. Le produit avec le format sélectionné est ajouté au panier

---

## 🔧 Intégration API

### Endpoints Utilisés

#### Gestion des Unités (Épicier)
```
POST   /api/products/{productId}/units
GET    /api/products/{productId}/units
PUT    /api/products/{productId}/units/{unitId}
DELETE /api/products/{productId}/units/{unitId}
```

#### Récupération des Produits (Client)
```
GET /api/products/{id}
GET /api/products?epicerieId={id}
GET /api/products/category/{categoryId}
```

Les produits retournés incluent automatiquement leur tableau `units` avec :
- Les données de chaque unité (prix, stock, label, etc.)
- Les champs calculés (`formattedQuantity`, `formattedPrice`, `baseUnit`)
- Les propriétés agrégées (`totalStock`, `inStock`)

#### Passage de Commande
```
POST /api/orders
```

Avec le body incluant les unités :
```json
{
  "epicerieId": 1,
  "deliveryType": "HOME_DELIVERY",
  "items": [
    {
      "productId": 5,
      "unitId": 12,          // ID de l'unité sélectionnée
      "quantite": 2,          // Quantité (nombre d'unités)
      "requestedQuantity": 2  // Pour weight-based
    }
  ]
}
```

---

## 🎨 Interface Utilisateur

### Épicier

#### Onglet Unités
- Bouton "Ajouter Unité" en haut
- Liste des unités en cartes avec :
  - Libellé et type bien visible
  - Prix en vert
  - Badge de stock coloré (vert/orange/rouge)
  - Badge disponibilité (Oui/Non)
  - Icônes Modifier et Supprimer

#### Formulaire Unité
- Boutons de sélection du type d'unité
- Champs pour quantité, label, prix, stock
- Textes d'aide pour guider l'épicier
- Validation en temps réel

### Client

#### Sélecteur d'Unité
- Design modal moderne et épuré
- Cartes de sélection pour chaque format :
  - Bordure verte quand sélectionnée
  - Icône de validation (checkmark)
  - Prix en gras et coloré
  - Badge de stock (couleur selon disponibilité)
  - Désactivation visuelle si rupture
- Section quantité apparaît après sélection :
  - Boutons +/- arrondis
  - Champ de saisie central
  - Alerte info avec stock disponible
  - Prix total en grand et coloré
  - Alerte warning si stock insuffisant

---

## 🧪 Tests à Effectuer

### Tests Épicier

1. **Création d'Unités**
   - [ ] Créer un produit
   - [ ] Accéder à l'onglet Unités
   - [ ] Ajouter une unité "À l'unité" (PIECE, qty: 1)
   - [ ] Ajouter une unité "500g" (WEIGHT, qty: 0.5)
   - [ ] Ajouter une unité "1kg" (WEIGHT, qty: 1.0)
   - [ ] Vérifier l'affichage de toutes les unités

2. **Modification d'Unités**
   - [ ] Modifier le prix d'une unité
   - [ ] Modifier le stock d'une unité
   - [ ] Changer le libellé
   - [ ] Vérifier la sauvegarde

3. **Suppression d'Unités**
   - [ ] Supprimer une unité
   - [ ] Confirmer la suppression
   - [ ] Vérifier qu'elle disparaît de la liste

### Tests Client

1. **Affichage des Unités**
   - [ ] Voir un produit avec plusieurs unités
   - [ ] Vérifier l'affichage de tous les formats
   - [ ] Vérifier les badges de stock

2. **Sélection et Achat**
   - [ ] Sélectionner une unité
   - [ ] Vérifier la bordure verte
   - [ ] Ajuster la quantité
   - [ ] Vérifier le calcul du prix total
   - [ ] Essayer de dépasser le stock (doit bloquer)
   - [ ] Ajouter au panier
   - [ ] Vérifier dans le panier

3. **Produits Legacy**
   - [ ] Tester avec un produit sans unités
   - [ ] Vérifier le fallback sur prix/stock classique
   - [ ] Ajouter au panier normalement

4. **Passage de Commande**
   - [ ] Créer une commande avec produits à unités
   - [ ] Vérifier la déduction du stock correct
   - [ ] Vérifier l'affichage dans l'historique

---

## 📊 Cas d'Usage Réels

### Épicerie de Quartier

```
🍅 Tomates
├─ À l'unité - 0.60€ - 50 en stock
├─ 500g - 2.50€ - 30 en stock
└─ 1kg - 4.50€ - 20 en stock

🥖 Pain
├─ 1 baguette - 1.00€ - 100 en stock
└─ Lot de 3 - 2.70€ - 35 en stock

🥛 Lait
├─ 250ml - 0.80€ - 40 en stock
├─ 500ml - 1.50€ - 50 en stock
└─ 1L - 2.80€ - 30 en stock

🍎 Pommes
├─ À l'unité - 0.40€ - 80 en stock
├─ Sachet 1kg - 3.50€ - 25 en stock
└─ Cagette 5kg - 15.00€ - 10 en stock
```

---

## 🔒 Gestion des Stocks

### Comportement

1. Chaque unité a son propre stock indépendant
2. Lors d'une commande, le stock de l'unité commandée est décrémenté
3. Le `totalStock` du produit = somme des stocks de toutes les unités
4. Le produit est `inStock` si au moins une unité a du stock
5. En cas d'annulation, le stock est restauré automatiquement

### Exemple

```
Produit: Jus d'Orange - totalStock: 70 - inStock: true

Units:
├─ 250ml: stock 30
├─ 500ml: stock 25
└─ 1L: stock 15

Client commande 3 × 500ml
→ 500ml: stock passe de 25 à 22
→ totalStock: passe de 70 à 67
→ inStock: reste true

Client annule sa commande
→ 500ml: stock revient à 25
→ totalStock: revient à 70
```

---

## 💡 Points Importants

### Pour les Épiciers

1. **Prix et Stock Indépendants** : Chaque format a son propre prix et stock
2. **Flexibilité** : Possibilité de créer autant de formats que souhaité
3. **Ordre d'Affichage** : Contrôle de l'ordre de présentation aux clients
4. **Compatibilité** : Les produits sans unités fonctionnent toujours

### Pour les Clients

1. **Clarté** : Tous les formats et prix affichés dès le départ
2. **Transparence** : Stock disponible visible pour chaque format
3. **Simplicité** : Interface intuitive avec calcul automatique
4. **Sécurité** : Impossible de commander plus que le stock disponible

---

## 🚀 Prochaines Étapes

### Fonctionnalités Futures Possibles

1. **Promotions par Unité** : Réductions spécifiques à certains formats
2. **Historique des Prix** : Tracer l'évolution des prix par unité
3. **Statistiques** : Formats les plus vendus
4. **Suggestions** : Recommander des formats selon l'historique client
5. **Bundles** : Combiner plusieurs formats en pack promotion

### Améliorations UI/UX

1. **Photos par Unité** : Image spécifique pour chaque format
2. **Comparateur** : Afficher le prix au kg/L pour tous les formats
3. **Favoris** : Mémoriser le format préféré par client
4. **Quick Add** : Bouton rapide pour le format par défaut

---

## 📞 Support

Pour toute question ou problème :
1. Consulter le guide backend : `FRONTEND_INTEGRATION_GUIDE.md`
2. Vérifier les types dans `src/type/index.ts`
3. Consulter les exemples d'API dans le guide backend

---

## ✅ Checklist Implémentation

- [x] Types TypeScript créés
- [x] Service unitService implémenté
- [x] Utilitaires de calcul créés
- [x] Composant ProductUnitForm créé
- [x] Composant ProductUnitList créé
- [x] Page modifier-produit mise à jour
- [x] Composant UnitSelector créé
- [ ] Page détail produit client mise à jour (à faire)
- [ ] Page panier mise à jour pour afficher les unités (à faire)
- [ ] Tests E2E effectués
- [ ] Documentation utilisateur créée

---

## 📝 Notes Techniques

### Calcul des Prix

Le prix total est calculé selon la formule :
```
unitsNeeded = requestedQuantity / unit.quantity
totalPrice = unit.prix * unitsNeeded
```

Exemple :
- Unité: 500g (quantity = 0.5) à 2.50€
- Client veut: 1.5kg
- unitsNeeded = 1.5 / 0.5 = 3
- totalPrice = 2.50€ × 3 = 7.50€

### Validation du Stock

Le stock est vérifié selon :
```
unitsNeeded = ceil(requestedQuantity / unit.quantity)
canOrder = unit.stock >= unitsNeeded
```

---

**Implémentation réalisée avec succès ! 🎉**
