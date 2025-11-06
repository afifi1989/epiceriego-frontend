# Plan de Test: Synchronisation du Panier et Flux Complet

## ✅ Implémentations Réalisées

### 1. Rechargement automatique du panier (useFocusEffect)
**Fichier**: `app/(client)/cart.tsx`
- ✅ Import de `useFocusEffect` et `useCallback` depuis 'expo-router'
- ✅ Remplacement de `useEffect` par `useFocusEffect` pour recharger à chaque navigation
- ✅ Appel à `cartService.getCart()` pour synchroniser l'état avec AsyncStorage
- ✅ Logging: `[CartScreen] 🔄 Panier reloadé au focus: X articles`

### 2. Rechargement automatique de la page produits (useFocusEffect)
**Fichier**: `app/(client)/(epicerie)/[id].tsx`
- ✅ Implémentation identique pour recharger le panier au retour sur la page
- ✅ Fonction `addToCart()` convertie en async/await
- ✅ Logging détaillé à chaque étape de l'ajout au panier

### 3. Rechargement automatique des commandes (useFocusEffect)
**Fichier**: `app/(client)/(commandes)/index.tsx`
- ✅ Import de `useFocusEffect` et `useCallback`
- ✅ Remplacement de `useEffect` par `useFocusEffect`
- ✅ Appel à `orderService.getMyOrders()` à chaque navigation
- ✅ Logging: `[OrdersScreen] 🔄 Commandes reloadées au focus`

### 4. Vidage du panier au logout
**Fichier**: `src/services/authService.ts`
- ✅ Import de `cartService`
- ✅ Appel à `cartService.clearCart()` dans `logout()` avant suppression des tokens
- ✅ Logging: `[authService.logout] Déconnexion effectuée - Panier vidé`

### 5. Service de panier avec AsyncStorage
**Fichier**: `src/services/cartService.ts`
- ✅ `getCart()`: Récupère depuis AsyncStorage
- ✅ `saveCart()`: Sauvegarde dans AsyncStorage
- ✅ `addToCart()`: Ajoute ou augmente la quantité
- ✅ `updateQuantity()`: Modifie la quantité
- ✅ `removeFromCart()`: Supprime un article
- ✅ `clearCart()`: Vide complètement le panier
- ✅ Logging détaillé à chaque opération

---

## 🧪 Plan de Test Complet

### Scénario 1: Ajouter un produit et le voir dans le panier

**Étapes:**
1. Lancer l'app et se connecter en tant que client
2. Aller sur la page "Épiceries"
3. Sélectionner une épicerie
4. Ajouter un produit au panier
5. Cliquer sur l'onglet "Panier" en bas

**Résultats attendus:**
- ✅ Le produit doit apparaître dans la liste du panier
- ✅ Console doit afficher: `[CartScreen] 🔄 Panier reloadé au focus: 1 articles`
- ✅ La quantité affichée doit être correcte
- ✅ Le prix total doit être correct

**Indicateurs de succès:**
- [ ] Produit visible dans le panier
- [ ] Logging affiche le nombre correct d'articles
- [ ] Aucune erreur dans la console

---

### Scénario 2: Ajouter plusieurs produits et naviguer entre onglets

**Étapes:**
1. Ajouter 3 produits différents depuis l'épicerie
2. Cliquer sur "Panier" → le panier doit afficher 3 articles
3. Cliquer sur "Épiceries" → retour à la liste
4. Cliquer sur "Panier" à nouveau

**Résultats attendus:**
- ✅ Tous les 3 articles doivent être visibles au clic sur panier
- ✅ Les articles ne doivent pas être dupliqués à chaque navigation
- ✅ Console affiche: `[CartScreen] 🔄 Panier reloadé au focus: 3 articles`

**Indicateurs de succès:**
- [ ] Panier affiche 3 articles
- [ ] Pas de duplication
- [ ] Logging correct à chaque navigation

---

### Scénario 3: Modifier la quantité d'un article

**Étapes:**
1. Avoir au moins 1 article dans le panier
2. Cliquer sur le bouton "+" pour augmenter la quantité
3. Cliquer sur le bouton "-" pour diminuer la quantité
4. Naviguer vers un autre onglet et revenir au panier

**Résultats attendus:**
- ✅ La quantité doit augmenter/diminuer
- ✅ Le total doit être mis à jour
- ✅ La quantité modifiée doit persister après navigation

**Indicateurs de succès:**
- [ ] Quantité correcte après +/-
- [ ] Total recalculé correctement
- [ ] Quantité conservée après navigation

---

### Scénario 4: Passer une commande

**Étapes:**
1. Avoir des articles dans le panier
2. Cliquer sur "Commander" / "Passer la commande"
3. Remplir les informations (adresse, téléphone)
4. Sélectionner le type de livraison et le paiement
5. Confirmer la commande

**Résultats attendus:**
- ✅ La commande doit être créée avec succès
- ✅ Le panier doit être **vide** après la commande
- ✅ La commande doit apparaître dans l'onglet "Commandes"
- ✅ Console affiche succès de création

**Indicateurs de succès:**
- [ ] Commande créée avec succès
- [ ] Panier vide après commande
- [ ] Commande visible dans "Commandes"

---

### Scénario 5: Consulter les commandes

**Étapes:**
1. Avoir au moins une commande passée
2. Cliquer sur l'onglet "Commandes"
3. Consulter les commandes listées
4. Naviguer vers un autre onglet et revenir aux commandes

**Résultats attendus:**
- ✅ Liste des commandes affichée
- ✅ Console affiche: `[OrdersScreen] 🔄 Commandes reloadées au focus: X commandes`
- ✅ Les commandes se chargent à chaque navigation

**Indicateurs de succès:**
- [ ] Commandes affichées correctement
- [ ] Logging affiche le bon nombre
- [ ] Données à jour à chaque navigation

---

### Scénario 6: Déconnexion et panier vide

**Étapes:**
1. Avoir des articles dans le panier
2. Aller dans le profil
3. Cliquer sur "Déconnexion"
4. Attendre la redirection vers login
5. Se reconnecter avec le même compte

**Résultats attendus:**
- ✅ Panier doit être **complètement vide** après logout
- ✅ Console affiche: `[authService.logout] Déconnexion effectuée - Panier vidé`
- ✅ Panier reste vide après reconnexion

**Indicateurs de succès:**
- [ ] Panier vide après déconnexion
- [ ] Logging de vidage du panier
- [ ] Panier vide après reconnexion

---

### Scénario 7: Déconnexion et connexion avec autre compte

**Étapes:**
1. Se connecter avec compte A ayant articles dans le panier
2. Ajouter 2-3 articles au panier
3. Déconnexion
4. Se connecter avec compte B (différent)
5. Vérifier le panier du compte B

**Résultats attendus:**
- ✅ Compte B doit avoir un panier **vide** (pas les articles du compte A)
- ✅ Console affiche vidage du panier lors du logout du compte A
- ✅ Panier fresh pour le compte B

**Indicateurs de succès:**
- [ ] Panier compte B vide
- [ ] Pas de mélange de données entre comptes
- [ ] Logging correct

---

## 📋 Vérification des Logs Console

Pour suivre le flux complet, ouvrez les **DevTools** ou vérifiez les logs du simulateur:

### Pattern de Logs Attendus:

**Lors d'ajout au panier:**
```
[addToCart] Ajout du produit: [NOM] avec ID: [ID]
[addToCart] CartItem créé: {...}
[CartService.saveCart] ✅ Panier sauvegardé: X articles
[addToCart] ✅ Panier mis à jour: X articles
```

**Lors de navigation sur panier:**
```
[CartScreen] 🔄 Panier reloadé au focus: X articles
[CartService.getCart] Panier parsé: X articles
```

**Lors de navigation sur commandes:**
```
[OrdersScreen] 🔄 Commandes reloadées au focus
[OrdersScreen] Chargement des commandes...
[OrdersScreen] ✅ Commandes chargées: X commandes
```

**Lors de déconnexion:**
```
[authService.logout] Déconnexion effectuée - Panier vidé
[CartService] Panier vidé
```

---

## 🔍 Checklist Finale

- [ ] Scénario 1: Ajouter 1 produit et le voir dans le panier ✅
- [ ] Scénario 2: Ajouter plusieurs produits et naviguer ✅
- [ ] Scénario 3: Modifier les quantités ✅
- [ ] Scénario 4: Passer une commande et vider le panier ✅
- [ ] Scénario 5: Consulter les commandes avec rechargement ✅
- [ ] Scénario 6: Déconnexion vide le panier ✅
- [ ] Scénario 7: Changer de compte vide le panier ✅
- [ ] Console logs affichent les bons messages ✅
- [ ] Aucune erreur TypeScript ✅
- [ ] Aucune erreur runtime ✅

---

## 🐛 Dépannage

Si vous rencontrez des problèmes:

### Panier toujours vide
- Vérifier que `useFocusEffect` est bien importé
- Vérifier que `cartService.getCart()` est appelé
- Vérifier les logs console pour les erreurs

### Données pas à jour après navigation
- Vérifier que `useFocusEffect` remplace `useEffect`
- Vérifier que la dépendance array est `[]`
- Vérifier que le composant a bien importé les hooks

### Panier pas vidé au logout
- Vérifier que `cartService.clearCart()` est appelé dans logout
- Vérifier les logs: `[authService.logout] Déconnexion effectuée - Panier vidé`

### Données mélangées entre comptes
- Vérifier que `clearCart()` est appelé AVANT de supprimer les tokens

---

## 📝 Notes

- Tous les services utilisent `AsyncStorage` comme source de vérité
- `useFocusEffect` se déclenche à chaque navigation, même lors de retour
- Les logs permettent de suivre tout le flux de données
- Aucune dépendance externe supplémentaire n'a été ajoutée
