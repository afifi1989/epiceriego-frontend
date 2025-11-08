import axios, { AxiosInstance, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, STORAGE_KEYS } from '../constants/config';

console.log('========================================');
console.log('[API] ✅ Configuration initialisée');
console.log('========================================');
console.log('[API] URL de base:', API_CONFIG.BASE_URL);
console.log('[API] Timeout:', API_CONFIG.TIMEOUT + 'ms');
console.log('========================================');

const api: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
});

// Intercepteur de requête - Ajoute le token JWT automatiquement
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);

    // Ne pas modifier Content-Type si c'est FormData (multipart)
    const isFormData = config.data instanceof FormData;

    console.log('[API] Requête vers:', config.url, {
      method: config.method,
      hasToken: !!token,
      isFormData: isFormData,
      hasData: !!config.data,
      headers: config.headers
    });

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Si c'est FormData, supprimer le Content-Type par défaut pour laisser axios le gérer
    // Cela permet à axios de générer le bon boundary pour multipart/form-data
    if (isFormData) {
      delete (config.headers as any)['Content-Type'];
      console.log('[API] FormData détecté - Content-Type supprimé pour axios');
    }

    return config;
  },
  (error: AxiosError) => {
    console.error('[API] Erreur requête:', error.message);
    return Promise.reject(error);
  }
);

// Intercepteur de réponse - Gère les erreurs
api.interceptors.response.use(
  (response) => {
    console.log('[API] Réponse reçue:', {
      url: response.config.url,
      status: response.status,
      dataKeys: Object.keys(response.data || {})
    });
    return response;
  },
  async (error: AxiosError) => {
    console.error('========================================');
    console.error('[API] ❌ ERREUR RÉPONSE');
    console.error('========================================');
    console.error('[API] URL tentée:', error.config?.url);
    console.error('[API] Code d\'erreur:', error.code);
    console.error('[API] Message:', error.message);
    console.error('[API] Status HTTP:', error.response?.status);
    console.error('[API] Status Text:', error.response?.statusText);
    console.error('[API] Données réponse:', error.response?.data);
    console.error('========================================');

    if (error.response?.status === 401) {
      // Token expiré ou invalide - Déconnecter l'utilisateur
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.USER,
        STORAGE_KEYS.ROLE,
      ]);
    }
    return Promise.reject(error);
  }
);

export default api;