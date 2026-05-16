import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Language } from '../i18n/translations';

const STORAGE_KEY = '@abridgo_client_onboarding_v1';

/**
 * État persisté de l'onboarding CLIENT (parcours 1ère ouverture de l'app).
 *
 * À ne pas confondre avec `onboardingService.ts` qui gère l'onboarding
 * ÉPICIER (wizard catalogue/clients en plusieurs étapes API).
 *
 * Sert deux usages:
 * 1. Flag binaire `completedAt` → routing décide si on montre l'onboarding
 *    au démarrage pour les utilisateurs CLIENT.
 * 2. Préférences capturées (langue, catégories favorites) → personnalisation
 *    future de la home / des recommandations.
 *
 * Pas d'expiration: une fois fait, on ne le re-déclenche jamais sur ce device.
 * Si l'utilisateur veut le revoir → ajouter un point d'entrée dans Settings
 * qui appelle `reset()`.
 */
export interface ClientOnboardingState {
  /** ISO date du clic "Terminer" ou "Passer". null = non fait. */
  completedAt:         string | null;
  /** Langue choisie pendant l'onboarding (peut différer de la langue système). */
  language?:           Language;
  /** IDs sémantiques des catégories cochées au step 3 (string, pas IDs DB). */
  favoriteCategoryIds: string[];
  /** True si l'utilisateur a accordé la géolocalisation au step 2. */
  locationGranted?:    boolean;
}

const DEFAULT_STATE: ClientOnboardingState = {
  completedAt: null,
  favoriteCategoryIds: [],
};

async function getState(): Promise<ClientOnboardingState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return DEFAULT_STATE;
  }
}

async function setState(state: ClientOnboardingState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('[clientOnboardingService] persist failed:', e);
  }
}

async function isCompleted(): Promise<boolean> {
  const s = await getState();
  return !!s.completedAt;
}

async function markCompleted(extra?: Partial<ClientOnboardingState>): Promise<void> {
  const current = await getState();
  await setState({
    ...current,
    ...extra,
    completedAt: new Date().toISOString(),
  });
}

async function patchPreferences(extra: Partial<ClientOnboardingState>): Promise<void> {
  const current = await getState();
  await setState({ ...current, ...extra });
}

/** Reset (utile pour tests / "revoir l'intro" depuis Settings). */
async function reset(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const clientOnboardingService = {
  getState,
  isCompleted,
  markCompleted,
  patchPreferences,
  reset,
};
