import api from './api';
import { RegistrationVerificationResponse } from '../type';

class RegistrationVerificationService {
  /**
   * Initie la vérification du compte en envoyant les codes OTP
   */
  async initiateVerification(email: string): Promise<RegistrationVerificationResponse> {
    try {
      const response = await api.post<RegistrationVerificationResponse>(
        '/auth/initiate-registration-verification',
        { email }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error initiating verification:', error);
      throw error.response?.data?.message || 'Erreur lors de l\'envoi des codes';
    }
  }

  /**
   * Vérifie le code OTP email
   */
  async verifyEmailCode(email: string, emailOtp: string): Promise<RegistrationVerificationResponse> {
    try {
      console.log('[VerifyEmail] Envoi de la requête:', { email, emailOtp });
      const response = await api.post<RegistrationVerificationResponse>(
        '/auth/verify-email-code',
        { email, emailOtp }
      );
      console.log('[VerifyEmail] Réponse reçue:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[VerifyEmail] Erreur complète:', error);
      console.error('[VerifyEmail] Réponse erreur:', error.response?.data);
      throw error.response?.data?.message || 'Erreur lors de la vérification';
    }
  }

  /**
   * Vérifie le code OTP SMS
   */
  async verifySmsCode(email: string, smsOtp: string): Promise<RegistrationVerificationResponse> {
    try {
      console.log('[VerifySMS] Envoi de la requête:', { email, smsOtp });
      const response = await api.post<RegistrationVerificationResponse>(
        '/auth/verify-sms-code',
        { email, smsOtp }
      );
      console.log('[VerifySMS] Réponse reçue:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[VerifySMS] Erreur complète:', error);
      console.error('[VerifySMS] Réponse erreur:', error.response?.data);
      throw error.response?.data?.message || 'Erreur lors de la vérification';
    }
  }

  /**
   * Renvoie les codes de vérification
   */
  async resendVerificationCodes(email: string): Promise<RegistrationVerificationResponse> {
    try {
      const response = await api.post<RegistrationVerificationResponse>(
        '/auth/resend-verification-codes',
        { email }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error resending codes:', error);
      throw error.response?.data?.message || 'Erreur lors du renvoi des codes';
    }
  }
}

export const registrationVerificationService = new RegistrationVerificationService();
