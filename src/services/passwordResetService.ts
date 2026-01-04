import api from "./api";

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  emailSent?: boolean;
  smsSent?: boolean;
  maskedPhone?: string;
  expiryMinutes?: number;
}

export interface VerifyResetCodesRequest {
  email: string;
  emailOtp: string;
  smsOtp: string;
}

export interface VerifyResetCodesResponse {
  success: boolean;
  message: string;
  bothVerified?: boolean;
  attemptsRemaining?: number;
}

export interface ResetPasswordRequest {
  email: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

class PasswordResetService {
  /**
   * Initie le processus de réinitialisation de mot de passe
   * Envoie les codes OTP par email et SMS
   */
  async initiatePasswordReset(
    email: string
  ): Promise<ForgotPasswordResponse> {
    try {
      const response = await api.post<ForgotPasswordResponse>(
        "/auth/forgot-password",
        { email }
      );
      return response.data;
    } catch (error: any) {
      console.error("Error initiating password reset:", error);
      throw new Error(
        error.response?.data?.message ||
          "Erreur lors de l'envoi des codes de vérification"
      );
    }
  }

  /**
   * Vérifie les codes OTP reçus par email et SMS
   */
  async verifyResetCodes(
    email: string,
    emailOtp: string,
    smsOtp: string
  ): Promise<VerifyResetCodesResponse> {
    try {
      const response = await api.post<VerifyResetCodesResponse>(
        "/auth/verify-reset-codes",
        {
          email,
          emailOtp,
          smsOtp,
        }
      );
      return response.data;
    } catch (error: any) {
      console.error("Error verifying reset codes:", error);
      throw new Error(
        error.response?.data?.message ||
          "Erreur lors de la vérification des codes"
      );
    }
  }

  /**
   * Réinitialise le mot de passe
   */
  async resetPassword(
    email: string,
    newPassword: string
  ): Promise<ResetPasswordResponse> {
    try {
      const response = await api.post<ResetPasswordResponse>(
        "/auth/reset-password",
        {
          email,
          newPassword,
        }
      );
      return response.data;
    } catch (error: any) {
      console.error("Error resetting password:", error);
      throw new Error(
        error.response?.data?.message ||
          "Erreur lors de la réinitialisation du mot de passe"
      );
    }
  }
}

export const passwordResetService = new PasswordResetService();
