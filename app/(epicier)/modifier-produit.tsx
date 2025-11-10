import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { ProductUnitList } from '../../components/epicier/ProductUnitList';
import { Category, categoryService } from '../../src/services/categoryService';
import { productService } from '../../src/services/productService';
import { Product } from '../../src/type';

export default function ModifierProduitScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'units'>('info');
  const [product, setProduct] = useState<Product | null>(null);
  const [categoriesTree, setCategoriesTree] = useState<Category[]>([]);
  const [flatCategories, setFlatCategories] = useState<Category[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [imageChanged, setImageChanged] = useState(false);
  const [formData, setFormData] = useState({
    nom: '',
    description: '',
    prix: '',
    stock: '',
    categoryId: '',
  });

  useEffect(() => {
    loadCategories();
    if (id) {
      loadProduct();
    }
  }, [id]);

  const loadProduct = async () => {
    try {
      const productData = await productService.getProductById(parseInt(id as string));
      setProduct(productData);
      
      // Réinitialiser les états d'image
      setSelectedImage(null);
      setImageChanged(false);
      setCurrentImageUrl(productData.photoUrl || null);
      
      setFormData({
        nom: productData.nom,
        description: productData.description || '',
        prix: productData.prix.toString(),
        stock: productData.stock.toString(),
        categoryId: productData.categoryId?.toString() || '',
      });
    } catch (error) {
      console.error('Erreur chargement produit:', error);
      Alert.alert('Erreur', 'Impossible de charger le produit', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      // Charger l'arborescence complète
      const data = await categoryService.getActiveCategories();
      setCategoriesTree(data);
      
      // Aplatir l'arborescence pour le select
      const flat = categoryService.flattenCategories(data);
      setFlatCategories(flat);
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
      Alert.alert('Erreur', 'Impossible de charger les catégories');
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
        setImageChanged(true);
      }
    } catch (error) {
      console.error('Erreur sélection image:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setCurrentImageUrl(null);
    setImageChanged(true);
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

      // Toujours utiliser FormData pour la modification (cohérent avec l'API)
      const formDataToSend = new FormData();
      formDataToSend.append('nom', formData.nom.trim());
      if (formData.description.trim()) {
        formDataToSend.append('description', formData.description.trim());
      }
      formDataToSend.append('prix', prix.toString());
      formDataToSend.append('stock', stock.toString());
      formDataToSend.append('categoryId', formData.categoryId);

      // Ajouter la nouvelle image si elle a été sélectionnée
      if (selectedImage) {
        const imageUri = selectedImage.uri;
        const imageName = imageUri.split('/').pop() || 'product.jpg';
        const imageType = selectedImage.mimeType || 'image/jpeg';

        // @ts-ignore - FormData supporte les fichiers sur React Native
        formDataToSend.append('image', {
          uri: imageUri,
          name: imageName,
          type: imageType,
        });
      }

      await productService.updateProductWithImage(parseInt(id as string), formDataToSend);
      
      Alert.alert('✅ Succès', 'Le produit a été modifié avec succès', [
        {
          text: 'OK',
          onPress: () => router.replace('/(epicier)/produits'),
        },
      ]);
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
      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'info' && styles.activeTab]}
          onPress={() => setActiveTab('info')}
        >
          <Text style={[styles.tabText, activeTab === 'info' && styles.activeTabText]}>
            📝 Informations Produit
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'units' && styles.activeTab]}
          onPress={() => setActiveTab('units')}
        >
          <Text style={[styles.tabText, activeTab === 'units' && styles.activeTabText]}>
            📦 Unités ({product?.units?.length || 0})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'info' ? (
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
                Prix (DH) <Text style={styles.required}>*</Text>
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
                {flatCategories.map((cat) => (
                  <Picker.Item 
                    key={cat.id} 
                    label={categoryService.getLabelWithIndentation(cat)} 
                    value={cat.id.toString()} 
                  />
                ))}
              </Picker>
            </View>
            <Text style={styles.hint}>
              💡 Les catégories sont organisées de manière hiérarchique
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Photo du produit</Text>
            {selectedImage ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} />
                <TouchableOpacity style={styles.removeImageButton} onPress={removeImage}>
                  <Text style={styles.removeImageText}>✕ Supprimer l'image</Text>
                </TouchableOpacity>
              </View>
            ) : currentImageUrl ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: currentImageUrl }} style={styles.imagePreview} />
                <View style={styles.imageActions}>
                  <TouchableOpacity style={styles.changeImageButton} onPress={pickImage}>
                    <Text style={styles.changeImageText}>📷 Changer l'image</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.removeImageButton} onPress={removeImage}>
                    <Text style={styles.removeImageText}>✕ Supprimer</Text>
                  </TouchableOpacity>
                </View>
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
              • Les modifications seront appliquées immédiatement{'\n'}
              • La catégorie est obligatoire{'\n'}
              • Vous pouvez modifier l'image ou la supprimer{'\n'}
              • Le produit restera visible aux clients
            </Text>
          </View>
        </View>
        </ScrollView>
      ) : (
        <View style={styles.unitsContainer}>
          {product && (
            <ProductUnitList
              productId={product.id}
              units={product.units || []}
              onRefresh={loadProduct}
            />
          )}
        </View>
      )}

      {activeTab === 'info' && (
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
            <Text style={styles.saveButtonText}>💾 Enregistrer</Text>
          )}
        </TouchableOpacity>
      </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#4CAF50',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#4CAF50',
    fontWeight: '700',
  },
  unitsContainer: {
    flex: 1,
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
  imageActions: {
    flexDirection: 'row',
    gap: 10,
  },
  changeImageButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  changeImageText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  removeImageButton: {
    flex: 1,
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
