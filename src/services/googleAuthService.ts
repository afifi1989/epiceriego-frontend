import {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
} from '@react-native-google-signin/google-signin';
import { GOOGLE_OAUTH } from '../constants/config';

/**
 * Wrap @react-native-google-signin/google-signin pour l'auth client mobile.
 * Le idToken obtenu est ensuite envoyé au backend via /auth/login-google.
 *
 * Pré-requis :
 *  - GOOGLE_OAUTH.WEB_CLIENT_ID rempli dans constants/config.ts
 *  - Côté Android : google-services.json déjà présent + SHA-1 du keystore
 *    debug/release configurés dans Google Cloud Console
 *  - Côté iOS : URL Schemes mis à jour dans Info.plist (à voir si on déploie iOS)
 *
 * Cette init est idempotente — on peut l'appeler plusieurs fois sans problème.
 */

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  if (!GOOGLE_OAUTH.WEB_CLIENT_ID) {
    throw new Error(
      'Google Sign-In non configuré : remplir GOOGLE_OAUTH.WEB_CLIENT_ID dans src/constants/config.ts'
    );
  }
  GoogleSignin.configure({
    webClientId: GOOGLE_OAUTH.WEB_CLIENT_ID,
    iosClientId: GOOGLE_OAUTH.IOS_CLIENT_ID || undefined,
    offlineAccess: false,
    forceCodeForRefreshToken: false,
  });
  configured = true;
}

export interface GoogleSignInResult {
  idToken: string;
  email: string;
  name?: string;
  photo?: string | null;
}

/**
 * Lance le flow Google Sign-In natif (sheet iOS / Play Services Android) et
 * retourne le idToken à transmettre au backend.
 *
 * @throws Error si l'utilisateur annule, si Google Play Services est manquant
 *               (Android), ou si la configuration est incomplète.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  ensureConfigured();

  // Vérification dispo Play Services côté Android (no-op iOS)
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const response = await GoogleSignin.signIn();
  // SDK v13+ : response = { type: 'success' | 'cancelled', data: { idToken, user: { email, name, photo } } }
  // SDK v12- : response a directement les champs idToken et user à la racine
  const data: any = (response as any).data ?? response;

  const idToken = data?.idToken as string | null;
  if (!idToken) {
    throw new Error('Google Sign-In : idToken manquant (vérifier la configuration Web Client ID)');
  }

  const user = data?.user ?? data;
  return {
    idToken,
    email: user?.email ?? '',
    name: user?.name ?? undefined,
    photo: user?.photo ?? null,
  };
}

/**
 * Déconnecte le compte Google côté mobile. Ne révoque pas le JWT côté backend
 * (utiliser authService.logout pour ça).
 */
export async function signOutGoogle(): Promise<void> {
  try {
    if (configured) {
      await GoogleSignin.signOut();
    }
  } catch (e) {
    console.warn('[googleAuthService] signOut error (ignored):', e);
  }
}

export function isGoogleCancelError(error: unknown): boolean {
  if (!error) return false;
  if (isErrorWithCode(error)) {
    return error.code === statusCodes.SIGN_IN_CANCELLED;
  }
  return false;
}
