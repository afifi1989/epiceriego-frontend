# Fonctionnalité Photo de Profil - Guide Épicier

## 📸 Vue d'Ensemble

Les épiciers (propriétaires de magasins) peuvent maintenant télécharger et gérer la photo de profil de leur épicerie directement depuis l'application. Cette photo s'affiche de manière prominente sur leur profil et aide les clients à identifier leur magasin.

---

## 🎯 Fonctionnalités

### 1. **Sélection de Photo**
- **Depuis la galerie** : Parcourir et sélectionner une image existante
- **Depuis la caméra** : Prendre une photo directe
- **Édition** : Recadrer l'image en format carré (1:1) avant upload
- **Optimisation** : Qualité automatiquement optimisée pour la performance

### 2. **Affichage**
- Phot circul aire de 100x100 pixels dans le profil
- Fallback emoji (🏪) si aucune photo n'est définie
- Mise à jour automatique lors du retour à la page profil

### 3. **Upload**
- Utilise **Fetch API** (pas axios) pour la compatibilité avec FormData
- Support du base64 pour une meilleure compatibilité React Native
- Indicateur de chargement pendant l'upload
- Gestion d'erreurs avec messages clairs

---

## 📱 Flux Utilisateur

### Pour changer la photo de profil:

1. **Navigation**
   ```
   Profil → Modifier le profil
   ```

2. **Sélection de photo**
   - Voir l'avatar circulaire en haut de la page
   - Cliquer sur "Galerie" ou "Caméra"
   - Sélectionner/recadrer l'image
   - Voir l'aperçu instantanément

3. **Sauvegarde**
   - La photo s'upload automatiquement lors de la sauvegarde du profil
   - Un indicateur de chargement apparaît pendant l'upload
   - Message de succès confirmé

4. **Affichage**
   - Retour à la page Profil
   - La nouvelle photo s'affiche immédiatement

---

## 🛠️ Architecture Technique

### Composants

**ProfilePhotoUpload.tsx** (164 lignes)
```typescript
interface ProfilePhotoUploadProps {
  photoUrl?: string;           // Photo actuelle
  onPhotoSelected: (uri, base64?) => void;  // Callback
  uploading?: boolean;         // État du chargement
}
```

Caractéristiques:
- Image preview circulaire (150x150px)
- Boutons Galerie et Caméra avec icônes Material
- Placeholder avec icône magasin
- État de chargement avec overlay
- Messages d'aide contextuels

### Services

**epicerieService.ts**
```typescript
uploadProfilePhoto(imageUri: string, base64?: string): Promise<Epicerie>
```

Workflow:
1. Récupère le token d'authentification
2. Crée FormData avec l'image (blob ou base64)
3. Envoie via Fetch vers `/epiceries/my-epicerie/photo`
4. Retourne l'épicerie mise à jour avec nouvelle photoUrl

Fonction utilitaire:
```typescript
base64ToBlob(base64, mimeType): Blob
```

### Pages

**modifier-infos.tsx**
```
ProfilePhotoUpload ↓
  ├─ onPhotoSelected
  │  └─ setSelectedPhotoUri + setSelectedPhotoBase64
  └─ uploading
     └─ setUploading (pendant l'upload)

handleSave():
  ├─ Si photo sélectionnée
  │  └─ uploadProfilePhoto()
  └─ Mettre à jour autres infos
     └─ updateMyEpicerie()
```

**profil.tsx**
```
useFocusEffect()
  └─ refreshData()
     └─ getMyEpicerie() → affiche photoUrl

Header Avatar:
  ├─ Si photoUrl
  │  └─ <Image source={{ uri: photoUrl }} />
  └─ Sinon
     └─ <Text>🏪</Text>
```

---

## 📊 Types

### CartItem interface mise à jour:
```typescript
interface Epicerie {
  id: number;
  nomEpicerie: string;
  photoUrl?: string;  // ← URL de la photo
  // ... autres champs
}
```

---

## 🔄 Flux de Données

```
Galerie/Caméra
     ↓
ImagePicker.launchImageLibraryAsync/launchCameraAsync
     ↓
Image {uri, base64}
     ↓
ProfilePhotoUpload.onPhotoSelected(uri, base64)
     ↓
setSelectedPhotoUri + setSelectedPhotoBase64
     ↓
Aperçu dans le composant
     ↓
handleSave() → uploadProfilePhoto()
     ↓
Fetch POST /epiceries/my-epicerie/photo
     ↓
Backend retourne Epicerie avec photoUrl
     ↓
useFocusEffect recharge à la revenir au Profil
     ↓
Image affichée dans l'avatar
```

---

## 🎨 UI/UX

### Couleurs & Icônes
- Bouton Galerie : Bleu (#2196F3) avec icône `photo-library`
- Bouton Caméra : Vert (#4CAF50) avec icône `camera-alt`
- Avatar : Bordure bleue, contenu centré
- Placeholder : Icône magasin bleue avec texte "Ajouter une photo"

### États
- **Normal** : Photo ou placeholder emoji
- **Sélectionnée** : Aperçu de la photo avec boutons
- **Chargement** : Overlay semi-transparent avec spinner
- **Succès** : Alert de confirmation

### Responsive
- Avatar circulaire : 150x150px (sélection), 100x100px (profil)
- Boutons : 50% de largeur chacun avec gap de 12px
- Texte d'aide : Petit, gris, italique en bas

---

## 🧪 Tests Recommandés

### Sélection d'image
- [ ] Galerie : Sélectionner image → Affiche aperçu
- [ ] Caméra : Prendre photo → Affiche aperçu
- [ ] Recadrage : Aspect ratio 1:1 correctif
- [ ] Permissions : Refus permission → Message d'erreur

### Upload
- [ ] Validation : Formulaire valide avant upload
- [ ] Indicateur : "Mise à jour..." pendant upload
- [ ] Succès : Alert de confirmation
- [ ] Erreur : Message d'erreur spécifique
- [ ] Fallback : Emoji si upload échoue

### Affichage
- [ ] Profil : Photo s'affiche après modification
- [ ] Focus : useFocusEffect rafraîchit les données
- [ ] Legacy : Emoji si photoUrl vide/null
- [ ] Erreur réseau : Placeholder emoji si chargement échoue

### Cas limites
- [ ] Image très grande : Optimisation qualité (0.8)
- [ ] Connexion lente : Indicateur de chargement
- [ ] Déconnexion : Token refreshé automatiquement
- [ ] Retour arrière : Photo en mémoire conservée

---

## 🚀 Prochaines Étapes Possibles

- [ ] Galerie de photos historiques (plusieurs photos)
- [ ] Filtre et effets d'image
- [ ] Crop personnalisé au lieu de carré fixe
- [ ] Compression d'image côté client avant upload
- [ ] Validation taille fichier (max 5MB)
- [ ] Animation de transition photo
- [ ] Indicateur "Photo mise à jour" sur la page Profil

---

## 📞 Dépannage

### Photo ne s'affiche pas après upload
1. Vérifier la console pour les erreurs
2. Vérifier que le backend retourne une photoUrl valide
3. Vérifier les permissions de caméra/galerie

### Erreur "Permission refusée"
- Vérifier les paramètres de permissions dans app.json
- Sur iOS : Vérifier Info.plist
- Sur Android : Vérifier AndroidManifest.xml

### Upload échoue
1. Vérifier la connexion réseau
2. Vérifier le token d'authentification
3. Consulter les logs: `[EpicerieService]` dans la console

### Image floue/pixelisée
- Qualité est définie à 0.8
- Peut être ajusté dans ImagePicker.launchImageLibraryAsync
- Augmenter de 0.8 à 0.9 ou 1.0 pour plus de qualité (plus gros fichier)

---

## 📝 Notes pour les Développeurs

### Integration backend
Le backend doit:
1. Exposer endpoint `POST /epiceries/my-epicerie/photo`
2. Accepter FormData avec field "photo"
3. Valider le type MIME (image/jpeg, image/png)
4. Limiter taille (recommandé: max 5MB)
5. Retourner Epicerie mise à jour avec photoUrl
6. Stocker l'image (fichier ou cloud storage)

### Performances
- Base64 vs URI: Base64 est 35% plus gros mais plus compatible
- Qualité 0.8 = bon compromis qualité/taille
- Image max 150x150 → fichier petit
- Fetch API directement (pas axios) pour FormData

### Sécurité
- Token automatiquement injecté via Bearer header
- Validation côté client (permission)
- Validation côté backend requise (type, taille)
- Pas de stockage en cache du base64 (mémoire)

---

## 🎬 Exemple d'Utilisation

```typescript
// Dans modifier-infos.tsx

// 1. État
const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
const [selectedPhotoBase64, setSelectedPhotoBase64] = useState<string | null>(null);

// 2. Callback
const handlePhotoSelected = (uri: string, base64?: string) => {
  setSelectedPhotoUri(uri);
  setSelectedPhotoBase64(base64);
};

// 3. Render
<ProfilePhotoUpload
  photoUrl={formData.photoUrl}
  onPhotoSelected={handlePhotoSelected}
  uploading={uploading}
/>

// 4. Save
if (selectedPhotoUri) {
  await epicerieService.uploadProfilePhoto(selectedPhotoUri, selectedPhotoBase64);
}
```

---

## 📞 Support

Pour toute question sur cette implémentation:
1. Vérifier les console logs `[ProfilePhotoUpload]` et `[EpicerieService]`
2. Inspectionner les données Epicerie dans Redux DevTools
3. Vérifier les endpoints backend dans l'API docs
