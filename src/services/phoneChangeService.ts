/**
 * Service de modification du numero de telephone du user authentifie.
 *
 * Flow en 2 etapes, protege par OTP SMS sur le NOUVEAU numero :
 *   1. requestOtp(phone) -> envoie un code SMS, renvoie un token public
 *   2. verifyOtp(token, code) -> applique le numero au profil + phoneVerified=true
 *
 * Cote backend : {@code PhoneChangeService} et endpoints
 *   POST /api/users/me/phone/request-otp
 *   POST /api/users/me/phone/verify-otp
 */

import api from './api';
import { User } from '../type';

export interface RequestOtpResponse {
  /** Token public a renvoyer dans verifyOtp. */
  token: string;
  /** TTL du code en minutes (affichage UI). */
  expiresInMinutes: number;
}

export const phoneChangeService = {
  /**
   * Demande un SMS OTP pour le {@code phone} candidat. Le backend rejette
   * en 400 si le numero est deja utilise par un autre compte verifie, en
   * 429 si un cooldown resend est actif.
   */
  async requestOtp(phone: string): Promise<RequestOtpResponse> {
    const response = await api.post<RequestOtpResponse>('/users/me/phone/request-otp', {
      phone: phone.trim(),
    });
    return response.data;
  },

  /**
   * Valide le code recu par SMS. Renvoie le profil mis a jour (avec
   * telephone + phoneVerified).
   */
  async verifyOtp(token: string, code: string): Promise<User> {
    const response = await api.post<User>('/users/me/phone/verify-otp', {
      token,
      code: code.trim(),
    });
    return response.data;
  },
};

export default phoneChangeService;
