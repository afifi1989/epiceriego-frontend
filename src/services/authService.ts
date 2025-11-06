import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/config';
import { RegisterRequest, LoginResponse } from '../type';
import { cartService } from './cartService';

export const authService = {
  /**
   * Inscription d'un nouvel utilisateur
   */
  register: async (userData: RegisterRequest, fcmToken: string | null = null): Promise<LoginResponse> => {
    try {
      // Ajouter le token FCM aux données si fourni
      const dataWithToken = fcmToken ? { ...userData, fcmToken } : userData;

      const response = await api.post<LoginResponse>('/auth/register', dataWithToken);

      // Sauvegarder le token et les infos user
      if (response.data.token) {
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, response.data.token);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.data));
        await AsyncStorage.setItem(STORAGE_KEYS.ROLE, response.data.role);
      }

      return response.data;
    } catch (error: any) {
      throw error.response?.data?.message || 'Erreur lors de l\'inscription';
    }
  },

  /**
   * Connexion d'un utilisateur existant
   */
  login: async (
    email: string,
    password: string,
    fcmToken: string | null = null
  ): Promise<LoginResponse> => {
    try {
      console.log('[authService.login] Tentative de connexion avec:', { email, hasPassword: !!password });

      const response = await api.post<LoginResponse>('/auth/login', {
        email,
        password,
        fcmToken,
      });

      console.log('[authService.login] Réponse reçue:', {
        status: response.status,
        hasToken: !!response.data.token,
        role: response.data.role
      });

      // Sauvegarder le token et les infos user
      if (response.data.token) {
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, response.data.token);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.data));
        await AsyncStorage.setItem(STORAGE_KEYS.ROLE, response.data.role);
        console.log('[authService.login] Données sauvegardées avec succès');
      }

      return response.data;
    } catch (error: any) {
      console.error('[authService.login] Erreur:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        code: error.code
      });
      throw error.response?.data?.message || 'Email ou mot de passe incorrect';
    }
  },

  /**
   * Déconnexion - Supprime toutes les données locales
   */
  logout: async (): Promise<void> => {
    try {
      // Vider le panier lors de la déconnexion
      await cartService.clearCart();

      // Supprimer les données d'authentification
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.USER,
        STORAGE_KEYS.ROLE,
      ]);

      console.log('[authService.logout] Déconnexion effectuée - Panier vidé');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  },

  /**
   * Vérifie si l'utilisateur est connecté
   */
  isAuthenticated: async (): Promise<boolean> => {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      return !!token;
    } catch (error) {
      return false;
    }
  },

  /**
   * Récupère les informations de l'utilisateur connecté
   */
  getCurrentUser: async (): Promise<LoginResponse | null> => {
    try {
      const userStr = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      return null;
    }
  },

  /**
   * Récupère le rôle de l'utilisateur connecté
   */
  getUserRole: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.ROLE);
    } catch (error) {
      return null;
    }
  },
};