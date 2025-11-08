import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Category, categoryService, SubCategory } from '../../src/services/categoryService';
import { productService } from '../../src/services/productService';

export default function AjouterProduitScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [formData, setFormData] = useState({
    nom: '',
    description: '',
    prix: '',
    stock: '',
    categoryId: '',
    subCategoryId: '',
  });

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (formData.categoryId) {
      loadSubCategories(parseInt(formData.categoryId));
    } else {
      setSubCategories([]);
      setFormData(prev => ({ ...prev, subCategoryId: '' }));
    }
  }, [formData.categoryId]);

  const loadCategories = async () => {
    try {
      const data = await categoryService.getActiveCategories();
      setCategories(data);
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
      Alert.alert('Erreur', 'Impossible de charger les catégories');
    } finally {
      setLoading(false);
    }
  };

  const loadSubCategories = async (categoryId: number) => {
    try {
      const data = await categoryService.getActiveSubCategories(categoryId);
      setSubCategories(data);
    } catch (error) {
      console.error('Erreur chargement sous-catégories:', error);
      setSubCategories([]);
    }
  };

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission requise', 'Vous devez autoriser l\'accès à la galerie pour ajouter une image');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Erreur sélection image:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
  };

  const handleSave = async () => {
    // Validation
    if (!formData.nom.trim()) {
      Alert.alert('Erreur', 'Le nom du produit est requis');
      return;
    }

    if (!formData.prix.trim()) {
      Alert.alert('Erreur', 'Le prix est requis');
      return;
    }

    if (!formData.categoryId) {
      Alert.alert('Erreur', 'La catégorie est requise');
      return;
    }

    const prix = parseFloat(formData.prix);
    if (isNaN(prix) || prix <= 0) {
      Alert.alert('Erreur', 'Le prix doit être un nombre valide supérieur à 0');
      return;
    }

    const stock = formData.stock.trim() ? parseInt(formData.stock) : 0;
    if (formData.stock.trim() && (isNaN(stock) || stock < 0)) {
      Alert.alert('Erreur', 'Le stock doit être un nombre valide');
      return;
    }

    try {
      setSaving(true);

      // Si une image est sélectionnée, utiliser FormData
      if (selectedImage) {
        console.log('[AjouterProduit] Création du FormData avec image...');
        const formDataToSend = new FormData();
        formDataToSend.append('nom', formData.nom.trim());
        if (formData.description.trim()) {
          formDataToSend.append('description', formData.description.trim());
        }
        formDataToSend.append('prix', prix.toString());
        formDataToSend.append('stock', stock.toString());
        formDataToSend.append('categoryId', formData.categoryId);
        if (formData.subCategoryId) {
          formDataToSend.append('subCategoryId', formData.subCategoryId);
        }

        // Ajouter l'image
        const imageUri = selectedImage.uri;
        const imageName = imageUri.split('/').pop() || 'product.jpg';
        const imageType = selectedImage.mimeType || 'image/jpeg';

        console.log('[AjouterProduit] Détails image:', {
          uri: imageUri,
          name: imageName,
          type: imageType,
          size: selectedImage.fileSize,
        });

        // @ts-ignore - FormData supporte les fichiers sur React Native
        formDataToSend.append('image', {
          uri: imageUri,
          name: imageName,
          type: imageType,
        });

        console.log('[AjouterProduit] FormData prêt, envoi en cours...');
        const response: any = await productService.addProductWithImage(formDataToSend);
        
        // Proposer d'ajouter des unités
        Alert.alert(
          '✅ Succès',
          'Le produit a été ajouté avec succès !\n\nVoulez-vous ajouter des unités de vente (formats, poids, etc.) maintenant ?',
          [
            {
              text: 'Plus tard',
              style: 'cancel',
              onPress: () => router.replace('/(epicier)/produits'),
            },
            {
              text: 'Ajouter unités',
              onPress: () => {
                // Extraire l'ID du produit de la réponse
                const productId = response?.productId || response?.id;
                if (productId) {
                  router.replace(`/(epicier)/modifier-produit?id=${productId}`);
                } else {
                  router.replace('/(epicier)/produits');
                }
              },
            },
          ]
        );
      } else {
        // Sinon, utiliser l'ancienne méthode JSON
        const productData: any = {
          nom: formData.nom.trim(),
          description: formData.description.trim() || undefined,
          prix: prix,
          stock: stock,
          categoryId: parseInt(formData.categoryId),
        };

        if (formData.subCategoryId) {
          productData.subCategoryId = parseInt(formData.subCategoryId);
        }

        const response: any = await productService.addProduct(productData);
        
        // Proposer d'ajouter des unités
        Alert.alert(
          '✅ Succès',
          'Le produit a été ajouté avec succès !\n\nVoulez-vous ajouter des unités de vente (formats, poids, etc.) maintenant ?',
          [
            {
              text: 'Plus tard',
              style: 'cancel',
              onPress: () => router.replace('/(epicier)/produits'),
            },
            {
              text: 'Ajouter unités',
              onPress: () => {
                // Extraire l'ID du produit de la réponse
                const productId = response?.productId || response?.id;
                if (productId) {
                  router.replace(`/(epicier)/modifier-produit?id=${productId}`);
                } else {
                  router.replace('/(epicier)/produits');
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert('Erreur', String(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView}>
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Nom du produit <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={formData.nom}
              onChangeText={(text) => setFormData({ ...formData, nom: text })}
              placeholder="Ex: Tomate Bio"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              placeholder="Décrivez votre produit..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>
                Prix (€) <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={formData.prix}
                onChangeText={(text) => setFormData({ ...formData, prix: text })}
                placeholder="3.50"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Stock</Text>
              <TextInput
                style={styles.input}
                value={formData.stock}
                onChangeText={(text) => setFormData({ ...formData, stock: text })}
                placeholder="45"
                placeholderTextColor="#999"
                keyboardType="number-pad"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Catégorie <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.categoryId}
                onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                <Picker.Item label="-- Sélectionnez une catégorie --" value="" />
                {categories.map((cat) => (
                  <Picker.Item key={cat.id} label={cat.name} value={cat.id.toString()} />
                ))}
              </Picker>
            </View>
          </View>

          {formData.categoryId && subCategories.length > 0 && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Sous-catégorie</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.subCategoryId}
                  onValueChange={(value) => setFormData({ ...formData, subCategoryId: value })}
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                >
                  <Picker.Item label="-- Sélectionnez une sous-catégorie --" value="" />
                  {subCategories.map((subCat) => (
                    <Picker.Item key={subCat.id} label={subCat.name} value={subCat.id.toString()} />
                  ))}
                </Picker>
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Photo du produit</Text>
            {selectedImage ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} />
                <TouchableOpacity style={styles.removeImageButton} onPress={removeImage}>
                  <Text style={styles.removeImageText}>✕ Supprimer l'image</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                <Text style={styles.uploadButtonText}>📷 Choisir une image</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.hint}>
              💡 L'image sera automatiquement téléchargée sur le serveur
            </Text>
          </View>

          <View style={styles.requiredNote}>
            <Text style={styles.requiredNoteText}>
              <Text style={styles.required}>*</Text> Champs obligatoires
            </Text>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>ℹ️ Informations</Text>
            <Text style={styles.infoText}>
              • Le produit sera automatiquement disponible après l'ajout{'\n'}
              • Le stock par défaut est 0 si non spécifié{'\n'}
              • La catégorie est obligatoire{'\n'}
              • L'image est optionnelle mais recommandée{'\n'}
              • Après création, vous pourrez ajouter des unités de vente (ex: 500g, 1kg, lot de 6)
            </Text>
          </View>
          
          <View style={styles.unitsInfoBox}>
            <Text style={styles.unitsInfoTitle}>📦 Unités de vente</Text>
            <Text style={styles.unitsInfoText}>
              Après avoir créé le produit, vous pourrez définir différents formats :{'\n'}
              • À l'unité, par lot, par poids (500g, 1kg...){'\n'}
              • Prix et stock indépendants par format{'\n'}
              • Les clients pourront choisir le format souhaité
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={saving}
        >
          <Text style={styles.cancelButtonText}>Annuler</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>➕ Ajouter</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  halfWidth: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#f44336',
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  picker: {
    height: 50,
    color: '#333',
  },
  pickerItem: {
    fontSize: 16,
    color: '#333',
  },
  uploadButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#2196F3',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
  },
  imagePreviewContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
  },
  removeImageButton: {
    backgroundColor: '#f44336',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  removeImageText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    fontStyle: 'italic',
  },
  requiredNote: {
    marginTop: 10,
    marginBottom: 15,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  requiredNoteText: {
    fontSize: 14,
    color: '#856404',
  },
  infoBox: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#0d47a1',
    lineHeight: 22,
  },
  unitsInfoBox: {
    backgroundColor: '#f1f8e9',
    borderRadius: 12,
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    marginTop: 15,
  },
  unitsInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#33691e',
    marginBottom: 8,
  },
  unitsInfoText: {
    fontSize: 14,
    color: '#558b2f',
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
