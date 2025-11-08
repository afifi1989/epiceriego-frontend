export interface User {
  id: number;
  email: string;
  nom: string;
  telephone?: string;
  role: 'CLIENT' | 'EPICIER' | 'LIVREUR';
  adresse?: string;
  latitude?: number;
  longitude?: number;
}

export interface LoginResponse {
  token: string;
  userId: number;
  email: string;
  nom: string;
  role: string;
  epicerieId?: number;
  livreurId?: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
  nom: string;
  telephone: string;
  role: string;
  adresse: string;
  latitude?: number;
  longitude?: number;
  nomEpicerie?: string;
  descriptionEpicerie?: string;
}

export interface Epicerie {
  id: number;
  nomEpicerie: string;
  description?: string;
  adresse: string;
  latitude?: number;
  longitude?: number;
  telephone?: string; // Deprecated: use telephonePro
  telephonePro?: string;
  telephonePersonnel?: string;
  photoUrl?: string;
  horaires?: string;
  nomGerant?: string;
  prenomGerant?: string;
  emailGerant?: string;
  isActive: boolean;
  nombreProducts: number;
}

// Product Units Types
export enum UnitType {
  PIECE = 'PIECE',
  WEIGHT = 'WEIGHT',
  VOLUME = 'VOLUME',
  LENGTH = 'LENGTH'
}

export interface ProductUnit {
  id: number;
  unitType: UnitType;
  quantity: number;        // 1 for piece, 0.5 for 500g, etc.
  label: string;           // "À l'unité", "500g", "1kg"
  prix: number;
  stock: number;
  isAvailable: boolean;
  displayOrder: number;
  formattedQuantity: string;  // "500g", "1 pcs", "1.0 L"
  formattedPrice: string;     // "€1.20 / 500g"
  baseUnit: string;           // "kg", "pcs", "L"
  createdAt: string;
  updatedAt: string;
}

export interface ProductUnitRequest {
  unitType: UnitType;
  quantity: number;
  label: string;
  prix: number;
  stock: number;
  isAvailable?: boolean;
  displayOrder?: number;
}

export interface Product {
  id: number;
  nom: string;
  description?: string;
  prix: number;              // Legacy - ignore si units
  stock: number;             // Legacy - ignore si units
  photoUrl?: string;
  categorie?: string; // Deprecated: use categoryId and subCategoryId
  categoryId?: number;
  categoryName?: string;
  subCategoryId?: number;
  subCategoryName?: string;
  isAvailable: boolean;
  epicerieId: number;
  epicerieNom: string;
  
  // NEW - Product Units
  units?: ProductUnit[];      // Array of available units
  totalStock?: number;        // Total across all units
  inStock?: boolean;          // Has any unit with stock?
}

export interface CartItem {
  productId: number;
  productNom: string;
  epicerieId: number;            // Store épicerie ID from product
  unitId?: number;
  unitLabel?: string;
  quantity: number;              // Quantité pièces
  requestedQuantity?: number;    // Quantité weight (1.0kg, etc.)
  pricePerUnit: number;
  totalPrice: number;
  photoUrl?: string;
}

export interface OrderItem {
  productId: number;
  quantite: number;
  unitId?: number;                // ID of selected unit
  requestedQuantity?: number;     // Pour weight-based (1.0kg, 0.5L)
}

export type DeliveryType = 'HOME_DELIVERY' | 'PICKUP';
export type PaymentMethod = 'CASH' | 'CARD';

export interface CardPaymentDetails {
  cardNumber: string;
  cardholderName: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  saveForLater?: boolean;
}

export interface SavedPaymentMethod {
  id: number;
  lastFourDigits: string;
  cardholderName: string;
  expiryMonth: string;
  expiryYear: string;
  isDefault: boolean;
}

export interface CreateOrderRequest {
  epicerieId: number;
  items: OrderItem[];
  deliveryType: DeliveryType;
  adresseLivraison: string;
  latitudeLivraison?: number;
  longitudeLivraison?: number;
  telephoneLivraison?: string;
  paymentMethod: PaymentMethod;
}

export interface Order {
  id: number;
  total: number;
  status: string;
  deliveryType: DeliveryType;
  adresseLivraison: string;
  telephoneLivraison?: string;
  paymentMethod: PaymentMethod;
  createdAt: string;
  updatedAt: string;
  clientId: number;
  clientNom: string;
  epicerieId: number;
  epicerieNom: string;
  livreurId?: number;
  livreurNom?: string;
  items: OrderItemDetail[];
  nombreItems: number;
}

export interface OrderItemDetail {
  id: number;
  productId: number;
  productNom: string;
  quantite: number;
  prixUnitaire: number;
  total: number;
  
  // NEW - Unit information
  unitId?: number;
  unitLabel?: string;
  unitType?: string;
  productUnit?: ProductUnit;
}

export interface Delivery {
  orderId: number;
  total: number;
  status: string;
  adresseLivraison: string;
  latitudeLivraison?: number;
  longitudeLivraison?: number;
  telephoneLivraison?: string;
  clientNom: string;
  clientTelephone?: string;
  epicerieNom: string;
  nombreItems: number;
  createdAt: string;
}

export interface DeliveryInfo {
  adresseLivraison: string;
  telephoneLivraison: string;
  latitudeLivraison?: number;
  longitudeLivraison?: number;
}

export interface UpdateDeliveryInfoRequest {
  adresseLivraison: string;
  telephoneLivraison: string;
}

// Settings Types
export interface NotificationSettings {
  pushNotifications: boolean;
  emailNotifications: boolean;
  orderNotifications: boolean;
  promoNotifications: boolean;
  deliveryNotifications: boolean;
}

export interface UserPreferences {
  language: string;
  darkMode: boolean;
  currency: string;
  timezone: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface DeleteAccountRequest {
  password: string;
  confirmation: string;
}
