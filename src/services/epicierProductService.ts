/**
 * Product service for epicier (shop owner)
 * Handles all product-related API calls
 */

import api from './api';
import { Product } from '../type/index';

export interface ProductCreateRequest {
  nom: string;
  prix: number;
  categoryId: number;
  codeBarreExterne?: string;
  uniteVente: 'PIECE' | 'KILOGRAM' | 'GRAM' | 'LITER' | 'MILLILITER' | 'DOZEN' | 'PAIR' | 'PACK';
  stockThreshold: number;
  stockInitial: number;
  description?: string;
}

export interface ProductUpdateRequest {
  nom?: string;
  prix?: number;
  categoryId?: number;
  uniteVente?: string;
  stockThreshold?: number;
  description?: string;
}

export interface ProductDetailDTO {
  id: number;
  nom: string;
  prix: number;
  categoryId: number;
  uniteVente: string;
  stock: number;
  stockThreshold: number;
  description?: string;
  imageUrl?: string;
  barcodes: {
    id: number;
    barcode: string;
    barcodeType: 'EXTERNAL' | 'INTERNAL_GENERATED';
    isPrimary: boolean;
  }[];
  createdAt: string;
  updatedAt: string;
}

class EpicierProductService {
  /**
   * Get all products for the current epicerie
   */
  async getProducts(page = 0, size = 20) {
    try {
      const response = await api.get('/produits/epicerie/me', {
        params: { page, size },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  }

  /**
   * Search products by name
   */
  async searchProducts(query: string, page = 0, size = 20) {
    try {
      const response = await api.get('/produits/epicerie/me/search', {
        params: { query, page, size },
      });
      return response.data;
    } catch (error) {
      console.error('Error searching products:', error);
      throw error;
    }
  }

  /**
   * Get product by ID
   */
  async getProductById(productId: number): Promise<ProductDetailDTO> {
    try {
      const response = await api.get(`/produits/${productId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Find product by barcode
   */
  async findProductByBarcode(barcode: string): Promise<Product> {
    try {
      const response = await api.get(`/produits/barcode/${barcode}`);
      return response.data;
    } catch (error) {
      console.error(`Error finding product by barcode ${barcode}:`, error);
      throw error;
    }
  }

  /**
   * Create new product
   */
  async createProduct(data: ProductCreateRequest): Promise<ProductDetailDTO> {
    try {
      const response = await api.post('/produits', data);
      return response.data;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  /**
   * Update existing product
   */
  async updateProduct(productId: number, data: ProductUpdateRequest): Promise<ProductDetailDTO> {
    try {
      const response = await api.put(`/produits/${productId}`, data);
      return response.data;
    } catch (error) {
      console.error(`Error updating product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Update product stock
   * @param productId Product ID
   * @param newStock New absolute stock value
   */
  async updateStock(productId: number, newStock: number): Promise<ProductDetailDTO> {
    try {
      const payload = { stock: newStock };
      console.log('=== STOCK UPDATE REQUEST ===');
      console.log('Product ID:', productId);
      console.log('New Stock Value:', newStock);
      console.log('Payload being sent:', JSON.stringify(payload));
      console.log('Endpoint:', `/produits/${productId}/stock`);
      console.log('===========================');

      const response = await api.put(`/produits/${productId}/stock`, payload);

      console.log('=== STOCK UPDATE RESPONSE ===');
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);
      console.log('==============================');

      return response.data;
    } catch (error) {
      console.error(`Error updating stock for product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Get low stock products
   */
  async getLowStockProducts(page = 0, size = 20) {
    try {
      const response = await api.get('/produits/epicerie/me/stock-bas', {
        params: { page, size },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching low stock products:', error);
      throw error;
    }
  }

  /**
   * Get product barcodes
   */
  async getProductBarcodes(productId: number) {
    try {
      const response = await api.get(`/produits/${productId}/barcodes`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching barcodes for product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Add a barcode to a product
   */
  async addProductBarcode(productId: number, barcodeData: { barcode: string; format: string }) {
    try {
      const response = await api.post(`/produits/${productId}/barcodes`, barcodeData);
      return response.data;
    } catch (error) {
      console.error(`Error adding barcode to product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a barcode from a product
   */
  async deleteProductBarcode(productId: number, barcodeId: number) {
    try {
      const response = await api.delete(`/produits/${productId}/barcodes/${barcodeId}`);
      return response.data;
    } catch (error) {
      console.error(
        `Error deleting barcode ${barcodeId} from product ${productId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Deactivate/delete product
   */
  async deleteProduct(productId: number) {
    try {
      const response = await api.delete(`/produits/${productId}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Upload product image
   */
  async uploadProductImage(productId: number, imageUri: string) {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: `product-${productId}-${Date.now()}.jpg`,
      } as any);

      const response = await api.post(`/produits/${productId}/image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error(`Error uploading image for product ${productId}:`, error);
      throw error;
    }
  }
}

export default new EpicierProductService();
