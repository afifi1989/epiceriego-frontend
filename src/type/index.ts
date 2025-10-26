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

export interface CreateOrderRequest {
  epicerieId: number;
  items: OrderItem[];
  adresseLivraison: string;
  latitudeLivraison?: number;
  longitudeLivraison?: number;
  telephoneLivraison: string;
  paymentMethod?: string;
}

export interface Order {
  id: number;
  total: number;
  status: string;
  adresseLivraison: string;
  telephoneLivraison?: string;
  paymentMethod: string;
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
