import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/config';
import { Collaborateur, CollaboratorDirectCreateRequest, CollaboratorRole } from '../type';

const getEpicerieId = async (): Promise<number> => {
  const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER);
  if (!userData) throw new Error('Non connecté');
  const user = JSON.parse(userData);
  if (!user.epicerieId) throw new Error('Épicerie introuvable');
  return user.epicerieId;
};

export const collaborateurService = {

  getAll: async (): Promise<Collaborateur[]> => {
    const epicerieId = await getEpicerieId();
    const response = await api.get<Collaborateur[]>(`/epiceries/${epicerieId}/collaborators`);
    return response.data;
  },

  createDirect: async (request: CollaboratorDirectCreateRequest): Promise<Collaborateur> => {
    const epicerieId = await getEpicerieId();
    const response = await api.post<Collaborateur>(
      `/epiceries/${epicerieId}/collaborators/create-direct`,
      request
    );
    return response.data;
  },

  updateRole: async (collaboratorId: number, collaboratorRole: CollaboratorRole): Promise<Collaborateur> => {
    const epicerieId = await getEpicerieId();
    const response = await api.put<Collaborateur>(
      `/epiceries/${epicerieId}/collaborators/${collaboratorId}/role`,
      { collaboratorRole }
    );
    return response.data;
  },

  suspend: async (collaboratorId: number, reason?: string): Promise<Collaborateur> => {
    const epicerieId = await getEpicerieId();
    const response = await api.put<Collaborateur>(
      `/epiceries/${epicerieId}/collaborators/${collaboratorId}/suspend`,
      { reason }
    );
    return response.data;
  },

  reactivate: async (collaboratorId: number): Promise<Collaborateur> => {
    const epicerieId = await getEpicerieId();
    const response = await api.put<Collaborateur>(
      `/epiceries/${epicerieId}/collaborators/${collaboratorId}/reactivate`,
      {}
    );
    return response.data;
  },

  revoke: async (collaboratorId: number): Promise<void> => {
    const epicerieId = await getEpicerieId();
    await api.delete(`/epiceries/${epicerieId}/collaborators/${collaboratorId}`);
  },
};
