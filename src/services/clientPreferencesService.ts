import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

/**
 * Profil d'achat derive du client (read-model backend, module personalization).
 *
 * <p>Miroir de {@code com.epiceriego.personalization.dto.ClientPreferenceDTO}.
 * Le backend recalcule ce profil de facon asynchrone apres chaque livraison ;
 * le mobile le consomme pour personnaliser le parcours chatbot/recherche
 * (pre-selection variante/marque, suggestions, sauvetage "0 resultat").</p>
 *
 * <p><strong>Strategie de cache</strong> : identique a {@code synonymsService}
 * — memoire → AsyncStorage → backend, TTL 10 min, tolerant au hors-ligne. La
 * personnalisation est purement "nice to have" : un echec reseau ou l'absence
 * de profil ne doit jamais bloquer l'UX (on renvoie {@code null}).</p>
 */

/** Mirror of ClientPreferenceDTO.TopProductDTO. */
export interface TopProduct {
  productId: number;
  unitId?: number | null;
  productName: string;
  photoUrl?: string | null;
  brandId?: number | null;
  categoryId?: number | null;
  orderCount: number;
  qtySum: number;
  lastOrderedAt?: string | null;
}

/** Mirror of ClientPreferenceDTO. */
export interface ClientPreference {
  orderCount: number;
  topProducts: TopProduct[];
  /** productId -> unitId prefere. Clefs serialisees en string par Jackson. */
  preferredVariantByProduct: Record<string, number>;
  /** categoryId -> brandId prefere. */
  preferredBrandByCategory: Record<string, number>;
}

const TTL_MS = 10 * 60 * 1000; // 10 min — meme convention que synonymsService.
const STORAGE_PREFIX = '@client_prefs_';

interface CachedSnapshot {
  /** null = le backend a repondu 204 (pas de profil) — on memoize pour ne pas
   *  re-interroger a chaque ouverture du chatbot. */
  data: ClientPreference | null;
  fetchedAt: number;
}

/** Memo en RAM par-dessus AsyncStorage : evite le JSON.parse a chaque ouverture. */
const memoryCache = new Map<string, CachedSnapshot>();

const cacheKey = (clientId: number, epicerieId: number) => `${clientId}_${epicerieId}`;
const storageKey = (clientId: number, epicerieId: number) =>
  `${STORAGE_PREFIX}${cacheKey(clientId, epicerieId)}`;

const isFresh = (entry: CachedSnapshot): boolean => Date.now() - entry.fetchedAt < TTL_MS;

const fetchFromBackend = async (epicerieId: number): Promise<ClientPreference | null> => {
  const res = await api.get<ClientPreference>('/clients/me/preferences', {
    params: { epicerieId },
  });
  // 204 → axios remonte data null/'' : on normalise en null (pas d'erreur).
  if (res.status === 204 || !res.data || typeof res.data !== 'object') return null;
  return res.data;
};

const persist = async (clientId: number, epicerieId: number, snap: CachedSnapshot): Promise<void> => {
  try {
    await AsyncStorage.setItem(storageKey(clientId, epicerieId), JSON.stringify(snap));
  } catch (e) {
    console.warn('[clientPrefs] AsyncStorage write failed (non-blocking)', e);
  }
};

const restore = async (clientId: number, epicerieId: number): Promise<CachedSnapshot | null> => {
  try {
    const raw = await AsyncStorage.getItem(storageKey(clientId, epicerieId));
    return raw ? (JSON.parse(raw) as CachedSnapshot) : null;
  } catch {
    return null;
  }
};

export const clientPreferencesService = {
  /**
   * Profil d'achat le plus frais disponible pour {@code (clientId, epicerieId)} :
   *  1. cache memoire (chemin chaud) → direct
   *  2. cache AsyncStorage (chaud) → direct si frais, sinon refresh background
   *  3. fetch reseau (froid) → attendre, persister, renvoyer
   *
   * <p>Ne propage jamais d'erreur : renvoie {@code null} si aucun profil ou si
   * le backend est injoignable et qu'aucun cache n'existe.</p>
   */
  getPreferences: async (
    epicerieId: number,
    clientId: number,
  ): Promise<ClientPreference | null> => {
    if (!epicerieId || !clientId) return null;
    const key = cacheKey(clientId, epicerieId);

    // 1) Memoire
    const inMem = memoryCache.get(key);
    if (inMem && isFresh(inMem)) return inMem.data;

    // 2) AsyncStorage
    const stored = inMem ?? (await restore(clientId, epicerieId));
    if (stored) {
      memoryCache.set(key, stored);
      if (isFresh(stored)) return stored.data;
      // Perime — on tente un refresh, fallback sur la valeur perimee si reseau KO.
      try {
        const fresh = await fetchFromBackend(epicerieId);
        const snap: CachedSnapshot = { data: fresh, fetchedAt: Date.now() };
        memoryCache.set(key, snap);
        await persist(clientId, epicerieId, snap);
        return fresh;
      } catch (e) {
        console.warn('[clientPrefs] Refresh failed, using stale cache', e);
        return stored.data;
      }
    }

    // 3) Froid
    try {
      const fresh = await fetchFromBackend(epicerieId);
      const snap: CachedSnapshot = { data: fresh, fetchedAt: Date.now() };
      memoryCache.set(key, snap);
      await persist(clientId, epicerieId, snap);
      return fresh;
    } catch (e) {
      console.warn('[clientPrefs] Cold fetch failed, no profile available', e);
      return null;
    }
  },

  /** Vide le cache d'un couple client×epicerie (ex. apres une nouvelle commande). */
  invalidate: async (epicerieId: number, clientId: number): Promise<void> => {
    memoryCache.delete(cacheKey(clientId, epicerieId));
    try {
      await AsyncStorage.removeItem(storageKey(clientId, epicerieId));
    } catch {
      /* ignore */
    }
  },
};

// ───────────────────────────────────────────────────────────────────────────
// Helpers purs — utilises par le chatbot (P3) pour exploiter le profil sans
// re-implementer la logique d'acces. Tolerants au profil null/absent.
// ───────────────────────────────────────────────────────────────────────────

/** unitId prefere pour un produit, ou null si inconnu. Resout l'ambigüite de variante. */
export const preferredVariantFor = (
  prefs: ClientPreference | null,
  productId: number | null | undefined,
): number | null => {
  if (!prefs || productId == null) return null;
  const v = prefs.preferredVariantByProduct?.[String(productId)];
  return typeof v === 'number' ? v : null;
};

/** brandId prefere pour une categorie, ou null si inconnu. Resout l'ambigüite de marque. */
export const preferredBrandFor = (
  prefs: ClientPreference | null,
  categoryId: number | null | undefined,
): number | null => {
  if (!prefs || categoryId == null) return null;
  const b = prefs.preferredBrandByCategory?.[String(categoryId)];
  return typeof b === 'number' ? b : null;
};
