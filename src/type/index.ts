// ============================================
// SYSTÈME MULTI-LANGUE (i18n dynamique)
// ============================================

/** Codes langue supportés par l'application */
export type SupportedLanguage = 'fr' | 'ar' | 'en' | 'tz';

/** Métadonnées des langues disponibles */
export const SUPPORTED_LANGUAGES: {
  code: SupportedLanguage;
  label: string;
  flag: string;
  dir: 'ltr' | 'rtl';
}[] = [
  { code: 'fr', label: 'Français',     flag: '🇫🇷', dir: 'ltr' },
  { code: 'ar', label: 'العربية',       flag: '🇲🇦', dir: 'rtl' },
  { code: 'en', label: 'English',      flag: '🇬🇧', dir: 'ltr' },
  { code: 'tz', label: 'ⵜⴰⵎⴰⵣⵉⵖⵜ',   flag: '🏳',  dir: 'ltr' },
];

/** Traduction d'un seul contenu (nom + description) dans une langue */
export interface ProductTranslation {
  nom: string;
  description: string;
}

/** Map complète des traductions d'un produit ou d'une catégorie */
export type ProductTranslations = Record<SupportedLanguage, ProductTranslation>;

/** Valeur initiale vide pour ProductTranslations */
export const EMPTY_TRANSLATIONS: ProductTranslations = {
  fr: { nom: '', description: '' },
  ar: { nom: '', description: '' },
  en: { nom: '', description: '' },
  tz: { nom: '', description: '' },
};

// ============================================
// TYPE D'ÉPICERIE
// ============================================

export type EpicerieType =
  | 'EPICERIE_GENERALE'
  | 'BOULANGERIE_PATISSERIE'
  | 'BOUCHERIE_CHARCUTERIE'
  | 'FRUITS_LEGUMES'
  | 'POISSONNERIE'
  | 'BOISSONS'
  | 'BIO_NATURE'
  | 'EPICERIE_FINE'
  | 'SUPERETTE'
  | 'AUTRE';

export interface EpicerieTypeInfo {
  value: EpicerieType;
  label: string;
  icon: string;
}

export const EPICERIE_TYPES: EpicerieTypeInfo[] = [
  { value: 'EPICERIE_GENERALE',       label: 'Épicerie générale',       icon: '🛒' },
  { value: 'BOULANGERIE_PATISSERIE',  label: 'Boulangerie / Pâtisserie', icon: '🥖' },
  { value: 'BOUCHERIE_CHARCUTERIE',   label: 'Boucherie / Charcuterie',  icon: '🥩' },
  { value: 'FRUITS_LEGUMES',          label: 'Fruits & Légumes',         icon: '🥦' },
  { value: 'POISSONNERIE',            label: 'Poissonnerie',             icon: '🐟' },
  { value: 'BOISSONS',                label: 'Boissons / Cave',          icon: '🧃' },
  { value: 'BIO_NATURE',              label: 'Bio & Nature',             icon: '🌿' },
  { value: 'EPICERIE_FINE',           label: 'Épicerie fine',            icon: '🫙' },
  { value: 'SUPERETTE',               label: 'Supérette',                icon: '🏪' },
  { value: 'AUTRE',                   label: 'Autre',                    icon: '📦' },
];

// ============================================
// UTILISATEUR
// ============================================

export interface User {
  id: number;
  email: string;
  nom: string;
  telephone?: string;
  role: 'CLIENT' | 'EPICIER' | 'LIVREUR';
  adresse?: string;
  latitude?: number;
  longitude?: number;
  /** Langue préférée persistée en base — utilisée par le backend pour traduire les réponses */
  preferredLanguage?: SupportedLanguage;
}

export interface LoginResponse {
  token: string;
  userId: number;
  email: string;
  nom: string;
  role: string;
  epicerieId?: number;
  epicerieName?: string;
  livreurId?: number;
  collaboratorRole?: string; // MANAGER | GESTIONNAIRE | CAISSIER
  mustChangePassword?: boolean;
  /** Langue préférée du client retournée par le backend au login */
  preferredLanguage?: SupportedLanguage;
  /** Identifiant de connexion épicier (format ALXXXXX). Null pour CLIENT/LIVREUR. */
  identifiant?: string;
}

// ── Collaborateurs ────────────────────────────────────────────────────────────

export type CollaboratorRole = 'MANAGER' | 'GESTIONNAIRE' | 'CAISSIER';
export type CollaboratorStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export interface Collaborateur {
  id: number;
  userId?: number;
  nom?: string;
  email?: string;
  telephone?: string;
  /** Identifiant de connexion épicier (format ALXXXXX) */
  identifiant?: string;
  collaboratorRole: CollaboratorRole;
  status: CollaboratorStatus;
  epicerieId: number;
  invitedAt?: string;
  acceptedAt?: string;
  suspendedAt?: string;
  suspensionReason?: string;
}

export interface CollaboratorDirectCreateRequest {
  nom: string;
  email: string;
  telephone?: string;
  collaboratorRole: CollaboratorRole;
}

export const COLLABORATOR_ROLE_CONFIG: Record<CollaboratorRole, { label: string; color: string; icon: string }> = {
  MANAGER:      { label: 'Manager',      color: '#e53935', icon: '⭐' },
  GESTIONNAIRE: { label: 'Gestionnaire', color: '#F57C00', icon: '📦' },
  CAISSIER:     { label: 'Caissier',     color: '#1976D2', icon: '💳' },
};

export const COLLABORATOR_STATUS_CONFIG: Record<CollaboratorStatus, { label: string; color: string }> = {
  ACTIVE:    { label: 'Actif',       color: '#43A047' },
  PENDING:   { label: 'En attente',  color: '#F57C00' },
  SUSPENDED: { label: 'Suspendu',    color: '#e53935' },
  REVOKED:   { label: 'Révoqué',     color: '#9E9E9E' },
};

export interface RegisterRequest {
  email: string;
  password: string;
  nom: string;
  telephone: string;
  role: string;
  adresse: string;
  latitude?: number;
  longitude?: number;
  // Pour EPICIER — personne morale
  nomEpicerie?: string;
  descriptionEpicerie?: string;
  emailEpicerie?: string;
  telephoneEpicerie?: string;
  // Pour EPICIER — représentant légal
  prenomGerant?: string;
  nomGerant?: string;
  // Pour EPICIER — type de boutique
  epicerieType?: EpicerieType;
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
  photoUrl?: string; // Photo de profil (logo/avatar)
  presentationPhotoUrl?: string; // Photo de présentation (bannière)
  horaires?: string;
  nomGerant?: string;
  prenomGerant?: string;
  emailGerant?: string;
  isActive: boolean;
  isOpen?: boolean;
  nombreProducts: number;
  deliveryZones?: string;
  averageRating?: number;
  totalRatings?: number;
  // Type de boutique
  epicerieType?: EpicerieType;
  epicerieTypeLabel?: string;
  epicerieTypeIcon?: string;
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
  prixBarre?: number;      // Prix original barré (avant remise), si présent = promo active
  stock: number;
  isAvailable: boolean;
  displayOrder: number;
  formattedQuantity: string;  // "500g", "1 pcs", "1.0 L"
  formattedPrice: string;     // "1.20 DH / 500g"
  baseUnit: string;           // "kg", "pcs", "L"
  createdAt: string;
  updatedAt: string;
}

export interface ProductUnitRequest {
  unitType: UnitType;
  quantity: number;
  label: string;
  prix: number;
  prixBarre?: number;      // Prix barré optionnel (promo)
  stock: number;
  isAvailable?: boolean;
  displayOrder?: number;
}

export interface CategoryPathItem {
  id: number;
  name: string;
  level: number;
}

export interface Brand {
  id: number;
  name: string;
  logoUrl?: string;
  isActive: boolean;
  displayOrder: number;
}

export interface ProductCharacteristic {
  id: number;
  keyName: string;
  value: string;
  displayOrder: number;
}

// ── Tags ───────────────────────────────────────────────────────────────────

export type TagScope = 'PRODUCT' | 'CATEGORY' | 'BOTH';

export interface Tag {
  id: number;
  name: string;
  slug: string;
  color?: string;
  iconUrl?: string;
  scope: TagScope;
  isSystem: boolean;
  isActive: boolean;
  displayOrder: number;
  translations?: Record<string, string>;
}

export interface Product {
  id: number;
  /** Nom dans la langue du client (retourné par le backend via Accept-Language) */
  nom: string;
  /** Description dans la langue du client */
  description?: string;
  prix: number;              // Legacy - ignore si units
  prixBarre?: number;        // Prix barré legacy (promo), ignoré si units
  stock: number;             // Legacy - ignore si units
  photoUrl?: string;
  categorie?: string; // Deprecated: use categoryId
  categoryId?: number;
  /** Nom de la catégorie dans la langue du client */
  categoryName?: string;
  parentCategoryId?: number | null;
  categoryLevel?: number;
  categoryPath?: CategoryPathItem[];  // Full category path with hierarchy
  isAvailable: boolean;
  epicerieId: number;
  epicerieNom: string;

  // NEW - Product Units
  units?: ProductUnit[];      // Array of available units
  totalStock?: number;        // Total across all units
  inStock?: boolean;          // Has any unit with stock?

  // Brand & Characteristics
  brandId?: number;
  brandName?: string;
  brandLogoUrl?: string;
  characteristics?: ProductCharacteristic[];

  // Tags
  tags?: Tag[];

  /**
   * Toutes les traductions du produit — uniquement dans le contexte admin (épicier).
   * Non présent dans les réponses côté client.
   */
  translations?: ProductTranslations;
}

export type CartItemType = 'PRODUCT';

export interface CartItem {
  itemType: CartItemType;        // Type d'item
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
  unitLabel?: string;             // Label of selected unit (e.g., "500g", "1kg")
  requestedQuantity?: number;     // Pour weight-based (1.0kg, 0.5L)
  itemType?: CartItemType;        // Type d'item (PRODUCT par défaut)
}

export type DeliveryType = 'HOME_DELIVERY' | 'PICKUP';
export type PaymentMethod = 'CASH' | 'CARD' | 'CLIENT_ACCOUNT';

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

export type OrderItemStatus = 'PENDING' | 'SCANNED' | 'UNAVAILABLE' | 'MODIFIED' | 'COMPLETED';

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

  itemType?: CartItemType;

  // Préparation de commande
  status?: OrderItemStatus;
  isComplete?: boolean;
  quantityActual?: number; // Quantité réelle après scan (pour produits au poids)
}

export interface Delivery {
  orderId: number;
  total: number;
  status: string;
  deliveryType?: DeliveryType; // PICKUP ou HOME_DELIVERY
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

export interface ClientInvitation {
  id: number;
  status: string;
  clientName: string;
  clientEmail: string;
  createdAt: string;
  respondedAt: string;
  clientId: number;
  epicerieId: number;
  epicerieName: string;
}

export interface ClientEpicerieRelation {
  id: number;
  clientId: number;
  epicerieId: number;
  status: string;
  createdAt: string;
  clientNom: string;
  clientEmail: string;
  allowCredit: boolean;
  creditLimit: number;
}

export interface ClientAccount {
  id: number;
  clientId: number;
  epicerieId: number;
  creditLimit: number;
  currentBalance: number;
  totalPurchases: number;
  balanceDue: number;
  totalAdvances: number;
}

export interface Invoice {
  id: number;
  orderId: number;
  status: string;
  reference: string;
  clientId: number;
  clientNom: string;
  epicerieId: number;
  epicerieName: string;
  amount: number;
  dueDate: string;
  createdAt: string;
  paidAt?: string;
  paidDate?: string;
}

export interface Payment {
  id: number;
  invoiceId: number;
  amount: number;
  paymentMethod: PaymentMethod;
  reference: string;
  createdAt: string;
  clientId: number;
  epicerieId: number;
}

export interface PaymentCreateRequest {
  invoiceId?: number;
  clientId?: number;
  epicerieId?: number;
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string;
}

export interface InvoiceCreateRequest {
  orderId?: number;
  clientId: number;
  epicerieId: number;
  amount: number;
  dueDate?: string;
  reference?: string;
}

// === TYPES POUR LES STATISTIQUES ÉPICIER ===

export interface TopProductDTO {
  productId: number;
  productName: string;
  photoUrl?: string;
  totalQuantitySold: number;
  totalRevenue: number;
  orderCount: number;
}

export interface LowStockProductDTO {
  productId: number;
  productName: string;
  photoUrl?: string;
  currentStock: number;
  stockThreshold: number;
  status: 'OUT_OF_STOCK' | 'LOW_STOCK';
}

export interface DailyRevenueDTO {
  date: string;
  revenue: number;
  orderCount: number;
}

export interface TopClientDTO {
  clientId: number;
  clientName: string;
  clientPhone?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string;
}

export interface EpicierStats {
  // Statistiques globales
  totalOrders: number;
  totalRevenue: number;
  totalClients: number;
  totalProducts: number;

  // Aujourd'hui
  todayOrders: number;
  todayRevenue: number;
  todayNewClients: number;

  // Cette semaine
  weekOrders: number;
  weekRevenue: number;
  weekNewClients: number;

  // Ce mois
  monthOrders: number;
  monthRevenue: number;
  monthNewClients: number;

  // Moyennes
  averageOrderValue: number;
  averageItemsPerOrder: number;

  // Répartition par statut
  pendingOrders: number;
  acceptedOrders: number;
  preparingOrders: number;
  readyOrders: number;
  inDeliveryOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;

  // Taux
  acceptanceRate: number;
  cancellationRate: number;
  completionRate: number;

  // Détails
  topProducts: TopProductDTO[];
  lowStockProducts: LowStockProductDTO[];
  revenueEvolution: DailyRevenueDTO[];
  topClients: TopClientDTO[];
  paymentMethodsDistribution: Record<string, number>;
  deliveryTypesDistribution: Record<string, number>;
}

// ============================================
// TYPES POUR VÉRIFICATION D'INSCRIPTION
// ============================================

export interface RegistrationVerificationResponse {
  success: boolean;
  message: string;
  emailSent?: boolean;
  smsSent?: boolean;
  maskedPhone?: string;
  expiryMinutes?: number;
  emailVerified?: boolean;
  smsVerified?: boolean;
  bothVerified?: boolean;
  attemptsRemaining?: number;
  resendCooldownSeconds?: number;
  /** Identifiant de connexion épicier généré (format ALXXXXX). Présent si rôle EPICIER. */
  identifiant?: string;
}

export interface VerifyEmailCodeRequest {
  email: string;
  emailOtp: string;
}

export interface VerifySmsCodeRequest {
  email: string;
  smsOtp: string;
}

export interface UnverifiedLoginResponse {
  verified: false;
  message: string;
  email: string;
}

// ============================================
// TYPES POUR LES CODES-BARRES PRODUITS
// ============================================

export interface ProductBarcode {
  id: number;
  barcode: string;
  barcodeType: string;
  barcodeFormat: string;
  isPrimary: boolean;
  description?: string;
  scanCount: number;
  isActive: boolean;
  /** ID de l'unité de vente associée (null si barcode lié au produit global) */
  unitId?: number;
  unitLabel?: string;
  unitPrix?: number;
  createdAt?: string;
  lastScannedAt?: string;
}

/**
 * Résultat d'une recherche de produit par code-barre.
 * Contient le produit complet + l'ID de l'unité identifiée par le scan.
 */
export interface BarcodeProductResult {
  /** Produit trouvé */
  id: number;
  nom: string;
  description?: string;
  photoUrl?: string;
  epicerieId: number;
  epicerieNom?: string;
  units?: ProductUnit[];
  /** ID de l'unité correspondant au code-barre scanné (null si non lié) */
  matchedUnitId?: number;
}

// ============================================
// TYPES POUR LE SYSTÈME QR CODE
// ============================================

export interface QrTokenResponse {
  orderId: number;
  qrToken: string;
  deliveryType: 'PICKUP' | 'HOME_DELIVERY';
}

export interface QrValidateResponse {
  success: boolean;
  orderId: number;
  newStatus: string;
  deliveryType: 'PICKUP' | 'HOME_DELIVERY';
  clientNom: string;
  epicerieNom: string;
}
