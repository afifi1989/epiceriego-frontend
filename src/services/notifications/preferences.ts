import api from '../api';
import { NotificationFamily } from './types';

/**
 * User-controllable notification preferences (per family).
 *
 * Backend is the source of truth — server consults these before sending a
 * push (e.g. before queuing a CART_REMINDER, check preferences.CART).
 *
 * Critical families (ORDER, DELIVERY, INVITATION, PAYMENT) are NOT
 * disableable from the UI. Their flags are always returned as `true` from
 * the API and any PUT attempt to set them false should be rejected by
 * the backend (defense in depth).
 *
 * Designed to live in its own file so a future microservice can own it
 * without dragging the whole notification stack along.
 */
export interface NotificationPreferences {
  ORDER: boolean;
  DELIVERY: boolean;
  PROMOTION: boolean;
  EPICERIE: boolean;
  INVITATION: boolean;
  PAYMENT: boolean;
  LOYALTY: boolean;
  CART: boolean;
  CHAT: boolean;
  INFO: boolean;
}

export const CRITICAL_FAMILIES: ReadonlySet<NotificationFamily> = new Set<NotificationFamily>([
  'ORDER',
  'DELIVERY',
  'INVITATION',
  'PAYMENT',
]);

export function isFamilyDisableable(family: NotificationFamily): boolean {
  return !CRITICAL_FAMILIES.has(family);
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  ORDER: true,
  DELIVERY: true,
  PROMOTION: true,
  EPICERIE: true,
  INVITATION: true,
  PAYMENT: true,
  LOYALTY: true,
  CART: true,
  CHAT: true,
  INFO: true,
};

export const notificationPreferencesService = {
  async get(): Promise<NotificationPreferences> {
    try {
      const response = await api.get<Partial<NotificationPreferences>>('/users/me/notification-preferences');
      // Merge with defaults so missing keys (e.g. backend hasn't deployed
      // a new family yet) don't break the UI.
      return { ...DEFAULT_PREFERENCES, ...response.data };
    } catch (error: any) {
      console.error('[NotificationPreferences] GET failed:', error?.message);
      return DEFAULT_PREFERENCES;
    }
  },

  /**
   * Update a single family. Critical families are silently ignored client-side
   * (and the backend should reject them too).
   */
  async update(family: NotificationFamily, enabled: boolean): Promise<boolean> {
    if (CRITICAL_FAMILIES.has(family) && !enabled) {
      console.warn(`[NotificationPreferences] ${family} is critical, cannot disable`);
      return false;
    }

    try {
      await api.put('/users/me/notification-preferences', { [family]: enabled });
      return true;
    } catch (error: any) {
      console.error(`[NotificationPreferences] PUT ${family}=${enabled} failed:`, error?.message);
      return false;
    }
  },

  /**
   * Bulk update — useful for "save all at once" UX, or to reset.
   */
  async updateAll(prefs: Partial<NotificationPreferences>): Promise<boolean> {
    const sanitized: Partial<NotificationPreferences> = { ...prefs };
    for (const family of CRITICAL_FAMILIES) {
      sanitized[family] = true;
    }

    try {
      await api.put('/users/me/notification-preferences', sanitized);
      return true;
    } catch (error: any) {
      console.error('[NotificationPreferences] PUT all failed:', error?.message);
      return false;
    }
  },
};
