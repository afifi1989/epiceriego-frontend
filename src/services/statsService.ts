import { EpicierStats } from '../type';
import api from './api';

/**
 * Service pour récupérer les statistiques de l'épicier
 */
export const statsService = {
  /**
   * Récupère les statistiques complètes de l'épicerie de l'épicier connecté
   * Statistiques en temps réel incluant:
   * - Commandes (total, aujourd'hui, cette semaine, ce mois)
   * - Chiffre d'affaires (total, aujourd'hui, cette semaine, ce mois)
   * - Clients (total, nouveaux)
   * - Produits (total, top vendus, stock faible)
   * - Taux (acceptation, annulation, complétion)
   * - Évolution du CA (7 derniers jours)
   */
  getMyEpicerieStats: async (): Promise<EpicierStats> => {
    try {
      const response = await api.get<EpicierStats>('/epiceries/my-epicerie/stats');
      return response.data;
    } catch (error: any) {
      console.error('Erreur lors du chargement des statistiques:', error);
      throw error.response?.data?.message || 'Impossible de charger les statistiques';
    }
  },
};
