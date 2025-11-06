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

export interface Product {
  id: number;
  nom: string;
  description?: string;
  prix: number;
  stock: number;
  photoUrl?: string;
  categorie?: string; // Deprecated: use categoryId and subCategoryId
  categoryId?: number;
  categoryName?: string;
  subCategoryId?: number;
  subCategoryName?: string;
  isAvailable: boolean;
  epicerieId: number;
  epicerieNom: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface OrderItem {
  productId: number;
  quantite: number;
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
