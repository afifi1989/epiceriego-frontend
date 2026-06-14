import api from './api';
import {
  Delivery,
  LivreurNotificationSettings,
  LivreurProfile,
  LivreurStats,
} from '../type';

/** V116 — Motifs d'échec de livraison (code → libellé FR) pour le picker livreur. */
export const DELIVERY_FAILURE_REASONS: { code: string; label: string }[] = [
  { code: 'CLIENT_ABSENT', label: 'Client absent' },
  { code: 'WRONG_ADDRESS', label: 'Adresse introuvable' },
  { code: 'CLIENT_REFUSED', label: 'Client refuse la commande' },
  { code: 'DAMAGED', label: 'Produit endommagé' },
  { code: 'COURIER_INCIDENT', label: 'Incident livreur (panne, accident…)' },
  { code: 'OTHER', label: 'Autre' },
];

export const livreurService = {
  /**
   * Récupère les livraisons du livreur connecté
   * @param status Filtre optionnel côté serveur (PENDING, READY, IN_DELIVERY, DELIVERED, CANCELLED…)
   */
  getMyDeliveries: async (status?: string): Promise<Delivery[]> => {
    try {
      const params = status ? { status } : {};
      const response = await api.get<Delivery[]>('/livreurs/my-deliveries', { params });
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur';
    }
  },

  /**
   * Récupère le profil du livreur connecté
   */
  getProfile: async (): Promise<LivreurProfile> => {
    try {
      const response = await api.get<LivreurProfile>('/livreurs/profile');
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors du chargement du profil';
    }
  },

  /**
   * Récupère les statistiques du livreur connecté
   * (note moyenne, total livraisons, taux de succès, activité du mois)
   */
  getStats: async (): Promise<LivreurStats> => {
    try {
      const response = await api.get<LivreurStats>('/livreurs/stats');
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors du chargement des statistiques';
    }
  },

  /**
   * Récupère les préférences de notification du livreur connecté
   */
  getNotificationSettings: async (): Promise<LivreurNotificationSettings> => {
    try {
      const response = await api.get<LivreurNotificationSettings>('/livreurs/notification-settings');
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors du chargement des préférences';
    }
  },

  /**
   * Met à jour les préférences de notification du livreur connecté
   */
  updateNotificationSettings: async (
    settings: Partial<LivreurNotificationSettings>
  ): Promise<{ message: string }> => {
    try {
      const response = await api.put<{ message: string }>('/livreurs/notification-settings', settings);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de la mise à jour des préférences';
    }
  },

  /**
   * Met à jour la disponibilité du livreur
   */
  updateAvailability: async (
    isAvailable: boolean,
    latitude?: number,
    longitude?: number
  ): Promise<{ message: string }> => {
    try {
      const response = await api.put<{ message: string }>('/livreurs/availability', {
        isAvailable,
        latitude,
        longitude,
      });
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur';
    }
  },

  /**
   * Met à jour la position GPS du livreur
   */
  updateLocation: async (latitude: number, longitude: number): Promise<{ message: string }> => {
    try {
      const response = await api.put<{ message: string }>('/livreurs/location', {
        latitude,
        longitude,
      });
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur';
    }
  },

  /**
   * Récupère une livraison à domicile (statut READY → IN_DELIVERY)
   * C'est quand le livreur récupère la commande en épicerie.
   * Réservé aux commandes HOME_DELIVERY côté backend.
   */
  startDelivery: async (orderId: number): Promise<Delivery> => {
    try {
      const response = await api.put<Delivery>(`/livreurs/delivery/${orderId}/start`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors du démarrage de la livraison';
    }
  },

  /**
   * Complète une livraison à domicile (statut IN_DELIVERY → DELIVERED)
   * Réservé aux commandes HOME_DELIVERY côté backend.
   *
   * @param cashCollected V114 — pour une commande espèces non payée, le backend
   *   exige cette confirmation explicite d'encaissement (« Encaissé X DH »).
   */
  completeDelivery: async (orderId: number, cashCollected?: boolean): Promise<Delivery> => {
    try {
      const response = await api.put<Delivery>(`/livreurs/delivery/${orderId}/complete`, { cashCollected });
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de la complétude de la livraison';
    }
  },

  /**
   * V116 — Signale un échec de livraison (le livreur n'a pas pu livrer).
   * La commande passe en DELIVERY_FAILED, le livreur est détaché, l'épicier
   * et le client sont notifiés.
   * @param reason Code motif (CLIENT_ABSENT, WRONG_ADDRESS, CLIENT_REFUSED, DAMAGED, COURIER_INCIDENT, OTHER)
   */
  reportDeliveryFailure: async (
    orderId: number,
    reason: string,
    note?: string,
    latitude?: number,
    longitude?: number
  ): Promise<Delivery> => {
    try {
      const response = await api.put<Delivery>(`/livreurs/delivery/${orderId}/fail`, {
        reason,
        note,
        latitude,
        longitude,
      });
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Impossible de signaler l\'échec de livraison';
    }
  },

  /**
   * Complète un retrait en magasin (statut READY → DELIVERED)
   * Réservé aux commandes PICKUP côté backend : le client vient
   * chercher sa commande, pas de phase IN_DELIVERY.
   *
   * @param cashCollected V114 — confirmation d'encaissement espèces au comptoir.
   */
  completePickup: async (orderId: number, cashCollected?: boolean): Promise<Delivery> => {
    try {
      const response = await api.put<Delivery>(`/livreurs/pickup/${orderId}/complete`, { cashCollected });
      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de la remise de la commande';
    }
  },
};
