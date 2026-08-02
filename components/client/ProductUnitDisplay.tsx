/**
 * Affichage attractif des unités de vente pour les clients
 * Intégré directement dans les pages de produit
 */

import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLanguage } from '../../src/context/LanguageContext';
import { Product, ProductUnit, UnitType } from '../../src/type';
import { canOrder, getStockLevel } from '../../src/utils/unitCalculations';
import type { ActivePromotionSummary } from '../../src/features/promotions/types';
import { effectivePriceForProduct, effectivePriceForUnit } from '../../src/features/promotions/utils';

interface ProductUnitDisplayProps {
  product: Product;
  /**
   * `unitId` est `null` quand le produit n'a pas de variantes (produit "legacy"
   * tarifé sur `Product.prix`). Les consommateurs doivent traiter `null`
   * comme "pas de variante" — ne JAMAIS envoyer `0` au backend (cela
   * déclenche "Unit not found" lors de la création de la commande).
   */
  onAddToCart: (
    unitId: number | null,
    quantity: number,
    totalPrice: number,
    unit: ProductUnit,
    /**
     * Prix unitaire EFFECTIF (remisé) déjà résolu par ce composant via
     * {@link effectivePriceForUnit}/{@link effectivePriceForProduct}. Le parent
     * DOIT stocker cette valeur comme {@code pricePerUnit} du panier plutôt que
     * {@code unit.prix} (brut) — sans quoi le panier persiste le tarif plein et
     * le total est recalculé faux à partir du prix d'origine. Source unique de
     * vérité pour éviter toute double-remise côté parent.
     */
    pricePerUnit: number,
  ) => void;
  /**
   * Promotion active résolue pour ce produit (ou pour une unité), côté parent.
   * Sert de fallback quand le backend n'a pas encore écrit `prixBarre` sur
   * l'unité (ex. promo créée mais snapshot pas encore appliqué). Si
   * `unit.prixBarre` est présent, il prévaut.
   */
  promo?: ActivePromotionSummary | null;
  /**
   * Notifies the parent screen each time the user picks a different variant —
   * lets the page swap its hero image to the variant's dedicated photo
   * (falling back to {@code product.photoUrl} when the variant has none).
   * The component still owns the selection state internally; this is just
   * a side-channel for the parent's UI.
   */
  onUnitChanged?: (unit: ProductUnit | null) => void;
  /**
   * Couleur d'accent de la boutique (branding épicier V101). Appliquée au prix,
   * au bouton « Ajouter au panier », à la bordure de la variante sélectionnée et
   * à la pastille de sélection. Défaut = vert AbridGO → zéro régression pour les
   * appels existants qui ne passent pas la prop.
   */
  accentColor?: string;
  /**
   * Sélection pilotée depuis le parent (ex. l'utilisateur fait défiler le
   * carrousel d'images du header → on synchronise le format choisi). Quand le
   * parent pousse une nouvelle valeur ≠ null, le composant aligne sa sélection
   * interne. Laisser `undefined` pour un fonctionnement 100 % autonome.
   */
  controlledUnitId?: number | null;
}

export const ProductUnitDisplay: React.FC<ProductUnitDisplayProps> = ({
  product,
  onAddToCart,
  promo = null,
  onUnitChanged,
  accentColor = '#4CAF50',
  controlledUnitId,
}) => {
  const { t } = useLanguage();
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(
    product.units && product.units.length > 0 ? product.units[0].id : null
  );
  const [quantity, setQuantity] = useState<string>('1');
  // Variant-photo zoom (independent of the page-level product zoom).
  const [zoomedPhotoUrl, setZoomedPhotoUrl] = useState<string | null>(null);

  // Sélectionner l'unité
  const selectedUnit = product.units?.find(u => u.id === selectedUnitId);

  // Notifie le parent du changement (initial mount + chaque sélection) pour
  // qu'il puisse switcher l'image principale vers `unit.photoUrl`.
  useEffect(() => {
    onUnitChanged?.(selectedUnit ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUnitId]);

  // Sélection pilotée par le parent (carrousel d'images du header). On ne
  // réagit qu'aux valeurs non-null réellement différentes pour éviter toute
  // boucle avec onUnitChanged (qui notifie le parent en retour).
  useEffect(() => {
    if (controlledUnitId != null && controlledUnitId !== selectedUnitId) {
      setSelectedUnitId(controlledUnitId);
      setQuantity('1');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledUnitId]);

  // Calculer le prix total — applique la promo résolue quand prixBarre n'a
  // pas (encore) été écrit sur l'unité par le backend.
  const getTotalPrice = (): number => {
    if (!selectedUnit) return 0;
    const qty = parseFloat(quantity) || 1;
    const effective = effectivePriceForUnit(selectedUnit, promo);
    return +(effective.display * qty).toFixed(2);
  };

  // Vérifier si on peut commander
  const canOrderNow = (): boolean => {
    if (!selectedUnit) return false;
    const qty = parseFloat(quantity) || 1;
    return canOrder(selectedUnit, qty);
  };

  // Incrémenter/Décrémenter la quantité
  const updateQuantity = (delta: number) => {
    const current = parseFloat(quantity) || 1;
    const newQty = Math.max(1, current + delta);
    setQuantity(newQty.toString());
  };

  // Ajouter au panier
  const handleAddToCart = () => {
    const qty = parseFloat(quantity) || 1;

    // Pour les produits sans unités (legacy), créer une unité par défaut
    if (!selectedUnit && (!product.units || product.units.length === 0)) {
      // Prix remisé si la promo runtime touche ce produit legacy. Sinon le
      // panier persisterait product.prix (prix barré) au lieu du prix réel.
      const effectivePrice = effectivePriceForProduct(product, promo).display;

      // Legacy product - create default unit
      const defaultUnit: ProductUnit = {
        id: 0, // No specific unit ID for legacy products
        unitType: UnitType.PIECE,
        quantity: 1,
        label: 'À l\'unité',
        prix: effectivePrice,
        stock: product.stock,
        isAvailable: product.isAvailable,
        displayOrder: 0,
        formattedQuantity: '1 pcs',
        formattedPrice: `${effectivePrice.toFixed(2)} DH`,
        baseUnit: 'pcs',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const totalPrice = effectivePrice * qty;
      console.log('[ProductUnitDisplay] Ajout produit legacy au panier:', {
        quantity: qty,
        totalPrice,
        pricePerUnit: effectivePrice,
        rawPrice: product.prix,
        promoActive: !!promo,
        label: defaultUnit.label
      });
      // `null` (pas `0`) = produit sans variante. Le backend lit ce champ et
      // déclenche "Unit not found" si on lui envoie `0` (qui correspond à
      // aucune ProductUnit en base). On passe `effectivePrice` comme
      // pricePerUnit : defaultUnit.prix EST déjà le prix remisé, donc pas de
      // double-remise possible côté parent.
      onAddToCart(null, qty, totalPrice, defaultUnit, effectivePrice);
      return;
    }

    // Pour les produits avec unités
    if (!selectedUnit) {
      Alert.alert(t('common.error'), t('products.selectFormat'));
      return;
    }

    if (!canOrderNow()) {
      Alert.alert(t('common.warning'), t('products.insufficientStock'));
      return;
    }

    // Prix unitaire EFFECTIF (remisé) — même source que l'affichage et que
    // getTotalPrice(). On NE stocke PAS selectedUnit.prix (brut) : quand la promo
    // n'est pas encore matérialisée sur la variante, unit.prix = tarif plein,
    // ce qui persisterait un mauvais prix dans le panier.
    const effectiveUnitPrice = effectivePriceForUnit(selectedUnit, promo).display;
    const totalPrice = getTotalPrice();
    console.log('[ProductUnitDisplay] Ajout au panier:', {
      unitId: selectedUnit.id,
      quantity: qty,
      totalPrice,
      pricePerUnit: effectiveUnitPrice,
      rawPrice: selectedUnit.prix,
      promoActive: !!promo,
      label: selectedUnit.label
    });
    onAddToCart(selectedUnit.id, qty, totalPrice, selectedUnit, effectiveUnitPrice);
  };

  // S'il n'y a pas d'unités, afficher le prix legacy
  if (!product.units || product.units.length === 0) {
    return (
      <View style={styles.container}>
        {/* Affichage legacy - sans unités */}
        <View style={styles.legacyContainer}>
          <View style={styles.priceSection}>
            <Text style={styles.priceLabel}>{t('products.price')}</Text>
            {/* M-f : prix EFFECTIF (remisé) + prix barré + badge −X% quand la
                promo runtime touche ce produit legacy — même source que l'ajout
                (effectivePriceForProduct) et que la branche variante. Avant, on
                affichait product.prix brut alors que l'ajout appliquait déjà la
                remise (promo invisible mais facturée). */}
            {(() => {
              const price = effectivePriceForProduct(product, promo);
              const discountPct = price.hasDiscount && price.original != null
                ? Math.round((1 - price.display / price.original) * 100)
                : 0;
              return (
                <>
                  {price.hasDiscount && price.original != null && (
                    <Text style={styles.legacyPrixBarre}>{price.original.toFixed(2)} DH</Text>
                  )}
                  <View style={styles.legacyPriceRow}>
                    <Text style={[styles.legacyPrice, { color: price.hasDiscount ? '#e53935' : accentColor }]}>
                      {price.display.toFixed(2)} DH
                    </Text>
                    {price.hasDiscount && discountPct > 0 && (
                      <View style={styles.legacyPromoBadge}>
                        <Text style={styles.promoBadgeText}>-{discountPct}%</Text>
                      </View>
                    )}
                  </View>
                </>
              );
            })()}
          </View>

          <View style={styles.stockSection}>
            <MaterialIcons name="inventory-2" size={20} color={accentColor} />
            <Text style={[
              styles.stockText,
              { color: product.stock > 0 ? accentColor : '#f44336' }
            ]}>
              {product.stock} {t('products.inStockUnits')}
            </Text>
          </View>

          <View style={styles.quantitySection}>
            <Text style={styles.sectionTitle}>{t('products.quantity')}</Text>
            <View style={styles.quantityControl}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => updateQuantity(-1)}
              >
                <Text style={styles.quantityButtonText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.quantityInput}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => updateQuantity(1)}
              >
                <Text style={styles.quantityButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: accentColor }, !product.isAvailable && styles.addButtonDisabled]}
            onPress={handleAddToCart}
            disabled={!product.isAvailable}
          >
            <MaterialIcons name="add-shopping-cart" size={24} color="#fff" />
            <Text style={styles.addButtonText}>{t('products.addToCart')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        {/* Titre */}
        <Text style={styles.mainTitle}>{t('products.chooseFormat')}</Text>

        {/* Détails de l'unité sélectionnée */}
        {selectedUnit && (
          <View style={styles.selectedUnitDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('products.selectedFormat')}:</Text>
              <Text style={styles.detailValue}>{selectedUnit.label}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('products.unitPrice')}:</Text>
              {(() => {
                const price = effectivePriceForUnit(selectedUnit, promo);
                return (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {price.hasDiscount && price.original != null && (
                      <Text style={styles.detailPrixBarre}>{price.original.toFixed(2)} DH</Text>
                    )}
                    <Text style={[styles.detailValue, price.hasDiscount && styles.detailValuePromo]}>
                      {price.display.toFixed(2)} DH
                    </Text>
                  </View>
                );
              })()}
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('products.availableStock')}:</Text>
              <Text style={[
                styles.detailValue,
                { color: selectedUnit.stock > 0 ? '#4CAF50' : '#f44336' }
              ]}>
                {selectedUnit.stock}
              </Text>
            </View>
          </View>
        )}

        {/* Séparateur */}
        <View style={styles.separator} />

        {/* Grille d'unités */}
        <View style={styles.unitsGrid}>
          {product.units.map((unit) => {
            const isSelected = unit.id === selectedUnitId;
            const stockLevel = getStockLevel(unit.stock);
            const isInStock = unit.isAvailable && unit.stock > 0;
            const price = effectivePriceForUnit(unit, promo);
            const discountPct = price.hasDiscount && price.original != null
              ? Math.round((1 - price.display / price.original) * 100)
              : 0;

            return (
              <TouchableOpacity
                key={unit.id}
                style={[
                  styles.unitCard,
                  isSelected && styles.unitCardSelected,
                  isSelected && { borderColor: accentColor },
                  !isInStock && styles.unitCardDisabled,
                ]}
                onPress={() => {
                  setSelectedUnitId(unit.id);
                  setQuantity('1');
                }}
                disabled={!isInStock}
              >
                {/* Mini-thumb (variant photo > product photo > emoji fallback).
                    Tappable séparément pour zoom — sans re-déclencher la sélection. */}
                {(() => {
                  const thumbUrl = unit.photoUrl || product.photoUrl;
                  if (thumbUrl) {
                    return (
                      <TouchableOpacity
                        onPress={() => setZoomedPhotoUrl(thumbUrl)}
                        activeOpacity={0.85}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        style={styles.unitThumbWrap}
                      >
                        <Image source={{ uri: thumbUrl }} style={styles.unitThumb} />
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <View style={styles.unitIconContainer}>
                      <Text style={styles.unitIcon}>
                        {unit.unitType === 'PIECE' ? '📦'
                          : unit.unitType === 'WEIGHT' ? '⚖️'
                            : unit.unitType === 'VOLUME' ? '🧃'
                              : '📏'}
                      </Text>
                    </View>
                  );
                })()}

                {/* Label */}
                <Text style={[styles.unitLabel, !isInStock && styles.unitLabelDisabled]}>
                  {unit.label}
                </Text>

                {/* Prix */}
                {price.hasDiscount && price.original != null && (
                  <Text style={styles.unitPrixBarre}>{price.original.toFixed(2)} DH</Text>
                )}
                <Text style={[styles.unitPrice, !isInStock && styles.unitPriceDisabled, price.hasDiscount && styles.unitPricePromo]}>
                  {price.display.toFixed(2)} DH
                </Text>

                {/* Badge stock */}
                {isInStock ? (
                  <View style={[styles.stockBadge, { backgroundColor: stockLevel.color }]}>
                    <Text style={styles.stockBadgeText}>{stockLevel.label}</Text>
                  </View>
                ) : (
                  <View style={styles.stockBadgeOOS}>
                    <Text style={styles.stockBadgeTextOOS}>{t('products.outOfStockShort')}</Text>
                  </View>
                )}

                {/* Badge promo */}
                {price.hasDiscount && discountPct > 0 && (
                  <View style={styles.promoBadge}>
                    <Text style={styles.promoBadgeText}>
                      -{discountPct}%
                    </Text>
                  </View>
                )}

                {/* Indicateur de sélection */}
                {isSelected && (
                  <View style={styles.checkmark}>
                    <MaterialIcons name="check-circle" size={28} color={accentColor} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Séparateur visuel */}
        <View style={styles.sectionDivider} />

        {/* Section d'achat - Conteneur séparé */}
        <View style={styles.purchaseSection}>
          {/* Sélecteur de quantité */}
          <View style={styles.quantitySection}>
            <Text style={styles.sectionTitle}>{t('products.quantity')}</Text>
            <View style={styles.quantityRow}>
              <View style={styles.quantityControl}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => updateQuantity(-1)}
                >
                  <MaterialIcons name="remove" size={20} color="#333" />
                </TouchableOpacity>
                <TextInput
                  style={styles.quantityInput}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                  placeholder="1"
                  placeholderTextColor="#999"
                />
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => updateQuantity(1)}
                >
                  <MaterialIcons name="add" size={20} color="#333" />
                </TouchableOpacity>
              </View>

              {/* Affichage du prix total */}
              <View style={styles.totalPriceBox}>
                <Text style={styles.totalPriceLabel}>{t('products.total')}</Text>
                <Text style={[styles.totalPrice, { color: accentColor }]}>{getTotalPrice().toFixed(2)} DH</Text>
              </View>
            </View>
          </View>

          {/* Bouton ajouter au panier */}
          <TouchableOpacity
            style={[
              styles.addButton,
              { backgroundColor: accentColor },
              !canOrderNow() && styles.addButtonDisabled,
            ]}
            onPress={handleAddToCart}
            disabled={!canOrderNow()}
          >
            <MaterialIcons name="add-shopping-cart" size={24} color="#fff" />
            <Text style={styles.addButtonText}>{t('products.addToCart')}</Text>
          </TouchableOpacity>

          {!canOrderNow() && (
            <Text style={styles.errorText}>{t('products.insufficientStock')}</Text>
          )}
        </View>
      </View>

      {/* Zoom modal sur le mini-thumb d'une variante */}
      <Modal
        visible={!!zoomedPhotoUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomedPhotoUrl(null)}
      >
        <Pressable style={styles.thumbZoomBackdrop} onPress={() => setZoomedPhotoUrl(null)}>
          {zoomedPhotoUrl && (
            <Image
              source={{ uri: zoomedPhotoUrl }}
              style={styles.thumbZoomImage}
              resizeMode="contain"
            />
          )}
          <View style={styles.thumbZoomCloseBtn}>
            <MaterialIcons name="close" size={24} color="#fff" />
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    flexDirection: 'column',
  },

  /* === IMAGE SECTION === */
  imageSection: {
    width: '100%',
    height: 280,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },

  productImage: {
    width: '100%',
    height: '100%',
  },

  imageLoadingSpinner: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    zIndex: 1,
  },

  zoomHint: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  zoomHintText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  /* === LEGACY CONTAINER === */
  legacyContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },

  priceSection: {
    marginBottom: 16,
    alignItems: 'center',
  },

  priceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },

  legacyPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
  },

  // M-f : rendu promo du prix legacy (barré + ligne prix/badge), calqué sur la
  // branche variante mais dimensionné pour le gros prix legacy.
  legacyPrixBarre: {
    fontSize: 16,
    color: '#999',
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },

  legacyPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  legacyPromoBadge: {
    backgroundColor: '#E53935',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  stockSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
  },

  stockText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },

  /* === MAIN TITLE === */
  mainTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },

  /* === UNITS GRID === */
  unitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 0,
    marginBottom: 20,
    width: '100%',
    paddingBottom: 0,
    flexShrink: 0,
  },

  unitCard: {
    width: '48%',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  unitCardSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#f1f8f6',
  },

  unitCardDisabled: {
    opacity: 0.5,
  },

  unitIconContainer: {
    marginBottom: 8,
  },

  unitIcon: {
    fontSize: 32,
  },

  unitThumbWrap: {
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    padding: 2,
  },

  unitThumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
  },

  thumbZoomBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  thumbZoomImage: {
    width: '92%',
    height: '78%',
  },

  thumbZoomCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  unitLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 6,
  },

  unitLabelDisabled: {
    color: '#999',
  },

  unitPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 6,
  },

  unitPricePromo: {
    color: '#e53935',
  },

  unitPrixBarre: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },

  unitPriceDisabled: {
    color: '#999',
  },

  promoBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#E53935',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    shadowColor: '#E53935',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },

  promoBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },

  detailPrixBarre: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },

  detailValuePromo: {
    color: '#e53935',
  },

  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },

  stockBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },

  stockBadgeOOS: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
    backgroundColor: '#ffebee',
  },

  stockBadgeTextOOS: {
    fontSize: 11,
    fontWeight: '600',
    color: '#c62828',
  },

  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },

  /* === SELECTED UNIT DETAILS === */
  selectedUnitDetails: {
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 0,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    flexShrink: 0,
  },

  separator: {
    height: 20,
    width: '100%',
  },

  sectionDivider: {
    height: 1,
    width: '100%',
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },

  purchaseSection: {
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    flexShrink: 0,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },

  detailLabel: {
    fontSize: 13,
    color: '#666',
  },

  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },

  /* === QUANTITY SECTION === */
  quantitySection: {
    marginBottom: 16,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },

  quantityRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },

  quantityControl: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
    backgroundColor: '#fff',
  },

  quantityButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },

  quantityButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },

  quantityInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },

  totalPriceBox: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 12,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },

  totalPriceLabel: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 4,
  },

  totalPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },

  /* === ADD TO CART BUTTON === */
  addButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },

  addButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },

  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },

  errorText: {
    textAlign: 'center',
    color: '#f44336',
    fontSize: 13,
    fontWeight: '600',
  },
});
