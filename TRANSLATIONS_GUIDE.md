# 🌍 Guide Traductions MultiLangues

## Vue d'ensemble

L'app utilise un système de traductions **Context API + AsyncStorage** pour gérer les 3 langues:
- **Français** (par défaut) - `fr`
- **العربية** (Arabe) - `ar`
- **English** (Anglais) - `en`

---

## 📁 Structure des Fichiers

```
src/
├── i18n/
│   └── translations.ts         # Toutes les traductions (fr, ar, en)
└── context/
    └── LanguageContext.tsx     # Contexte et hook useLanguage()
```

---

## 🎯 Comment Utiliser

### 1. **Dans un composant, utiliser le hook `useLanguage()`:**

```typescript
import { useLanguage } from '../../src/context/LanguageContext';

export default function MyComponent() {
  const { t, language, setLanguage } = useLanguage();

  return (
    <View>
      {/* Afficher du texte traduit */}
      <Text>{t('settings.title')}</Text>

      {/* Changer la langue */}
      <Button
        title={language === 'fr' ? '✓ Français' : 'Français'}
        onPress={() => setLanguage('fr')}
      />
      <Button
        title={language === 'ar' ? '✓ العربية' : 'العربية'}
        onPress={() => setLanguage('ar')}
      />
      <Button
        title={language === 'en' ? '✓ English' : 'English'}
        onPress={() => setLanguage('en')}
      />
    </View>
  );
}
```

### 2. **Clés de traduction disponibles:**

```typescript
// Exemple d'utilisation
t('settings.title')           // "Paramètres"
t('cart.empty')               // "Votre panier est vide"
t('nav.epiceries')            // "Épiceries"
t('common.loading')            // "Chargement..."
```

**Catégories disponibles:**
- `nav.*` - Navigation
- `settings.*` - Paramètres
- `cart.*` - Panier
- `orders.*` - Commandes
- `products.*` - Produits
- `epiceries.*` - Magasins
- `auth.*` - Authentification
- `profile.*` - Profil
- `common.*` - Termes communs

---

## ➕ Ajouter une Nouvelle Traduction

### Étape 1: Modifier `src/i18n/translations.ts`

```typescript
export const translations = {
  fr: {
    mySection: {
      myKey: 'Valeur en français',
    },
  },
  ar: {
    mySection: {
      myKey: 'القيمة بالعربية',
    },
  },
  en: {
    mySection: {
      myKey: 'Value in English',
    },
  },
};
```

### Étape 2: Utiliser dans ton composant

```typescript
const { t } = useLanguage();
<Text>{t('mySection.myKey')}</Text>
```

---

## 🔄 Comment Ça Fonctionne

### 1. **Chargement initial:**
   - Au démarrage, `LanguageContext` charge la langue sauvegardée dans AsyncStorage
   - Si aucune langue n'est sauvegardée, défaut = **Français**

### 2. **Changement de langue:**
   - Appel `setLanguage('ar')` → met à jour l'état + sauvegarde dans AsyncStorage
   - Tous les composants qui utilisent `useLanguage()` se re-rendent automatiquement

### 3. **Persistance:**
   - La langue choisie est sauvegardée dans AsyncStorage avec la clé `'app_language'`
   - À la prochaine ouverture de l'app, la dernière langue choisie est restaurée

---

## 📝 Exemple Complet: Settings Screen

```typescript
import { useLanguage } from '../../src/context/LanguageContext';

export default function SettingsScreen() {
  const { t, language, setLanguage } = useLanguage();

  return (
    <ScrollView>
      <Text style={styles.title}>{t('settings.title')}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t('settings.language')}
        </Text>

        <Button
          title={`Français ${language === 'fr' ? '✓' : ''}`}
          onPress={() => setLanguage('fr')}
        />
        <Button
          title={`العربية ${language === 'ar' ? '✓' : ''}`}
          onPress={() => setLanguage('ar')}
        />
        <Button
          title={`English ${language === 'en' ? '✓' : ''}`}
          onPress={() => setLanguage('en')}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t('settings.notifications')}
        </Text>
        <Switch
          value={true}
          onValueChange={() => {}}
        />
        <Text>{t('settings.pushNotifications')}</Text>
      </View>
    </ScrollView>
  );
}
```

---

## 🛡️ Gestion des Erreurs

### Clé de traduction non trouvée:

```typescript
t('key.that.doesNotExist')
// ⚠️ Affiche un warning en console
// Retourne la clé elle-même: "key.that.doesNotExist"
```

**Solution:** Vérifier la clé dans `translations.ts` et l'ajouter si manquante

---

## 📊 Langues Supportées

| Code | Langue | Symbole |
|------|--------|---------|
| `fr` | Français | 🇫🇷 |
| `ar` | العربية | 🇸🇦 |
| `en` | English | 🇬🇧 |

---

## 🚀 Bonnes Pratiques

✅ **À faire:**
- Utiliser `useLanguage()` hook dans tous les composants
- Organiser les traductions par section/module
- Tester les 3 langues avant de pousher
- Ajouter toutes les traductions en même temps

❌ **À ne pas faire:**
- Utiliser du texte en dur (hardcoded strings)
- Créer des fichiers de traductions séparés
- Oublier une langue quand on ajoute une nouvelle clé
- Utiliser des variables complexes dans les clés

---

## 📱 Test

Pour tester rapidement les traductions:

```bash
# Lancer l'app
npm start

# Dans l'app:
1. Aller à Settings
2. Changer la langue
3. Vérifier que le texte change instantanément
4. Redémarrer l'app → la langue est restée
```

---

## 🔗 Fichiers Connexes

- [LanguageContext](src/context/LanguageContext.tsx) - Contexte et hook
- [Translations](src/i18n/translations.ts) - Tous les textes
- [Settings Screen](app/(client)/settings.tsx) - Exemple d'utilisation
- [Root Layout](app/_layout.tsx) - Provider setup

---

**C'est tout! Tu peux maintenant ajouter des traductions partout dans l'app. 🎉**
