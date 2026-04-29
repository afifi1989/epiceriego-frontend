import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { NotificationFamily } from './types';

/**
 * Android-only notification channels.
 *
 * Channels are user-controllable: from Android settings, the user can
 * disable promotions without losing order updates. Required for Android 8+.
 *
 * Backend should set the FCM `android.notification.channel_id` to one of
 * these IDs when sending push (or front-end falls back to default mapping).
 */
export const NotificationChannels = {
  ORDERS: 'orders',
  DELIVERY: 'delivery',
  PROMOTIONS: 'promotions',
  PAYMENT: 'payment',
  LOYALTY: 'loyalty',
  CART: 'cart',
  CHAT: 'chat',
  INVITATIONS: 'invitations',
  DEFAULT: 'default',
} as const;

export type ChannelId = typeof NotificationChannels[keyof typeof NotificationChannels];

interface ChannelDefinition {
  id: ChannelId;
  name: string;
  description: string;
  importance: Notifications.AndroidImportance;
  vibrationPattern?: number[];
}

const CHANNEL_DEFS: ChannelDefinition[] = [
  {
    id: NotificationChannels.ORDERS,
    name: 'Commandes',
    description: 'Statut de vos commandes (confirmation, préparation, prête)',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  },
  {
    id: NotificationChannels.DELIVERY,
    name: 'Livraison',
    description: 'Suivi de livraison en temps réel',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  },
  {
    id: NotificationChannels.PROMOTIONS,
    name: 'Promotions',
    description: 'Nouvelles offres et promotions',
    importance: Notifications.AndroidImportance.LOW,
  },
  {
    id: NotificationChannels.PAYMENT,
    name: 'Paiements & Factures',
    description: 'Paiements reçus, factures dues, mises à jour de crédit',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 100, 200],
  },
  {
    id: NotificationChannels.LOYALTY,
    name: 'Fidélité',
    description: 'Points gagnés, paliers atteints, récompenses disponibles',
    importance: Notifications.AndroidImportance.DEFAULT,
  },
  {
    id: NotificationChannels.CART,
    name: 'Panier',
    description: "Rappels d'articles laissés dans le panier",
    importance: Notifications.AndroidImportance.LOW,
  },
  {
    id: NotificationChannels.CHAT,
    name: 'Messages',
    description: "Réponses du chatbot et messages de l'épicier",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 100, 200],
  },
  {
    id: NotificationChannels.INVITATIONS,
    name: 'Invitations',
    description: "Invitations d'épiceries pour devenir client",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  },
  {
    id: NotificationChannels.DEFAULT,
    name: 'Général',
    description: 'Autres notifications',
    importance: Notifications.AndroidImportance.DEFAULT,
  },
];

const FAMILY_TO_CHANNEL: Record<NotificationFamily, ChannelId> = {
  ORDER: NotificationChannels.ORDERS,
  DELIVERY: NotificationChannels.DELIVERY,
  PROMOTION: NotificationChannels.PROMOTIONS,
  EPICERIE: NotificationChannels.DEFAULT,
  INVITATION: NotificationChannels.INVITATIONS,
  PAYMENT: NotificationChannels.PAYMENT,
  LOYALTY: NotificationChannels.LOYALTY,
  CART: NotificationChannels.CART,
  CHAT: NotificationChannels.CHAT,
  INFO: NotificationChannels.DEFAULT,
};

export function channelForFamily(family: NotificationFamily): ChannelId {
  return FAMILY_TO_CHANNEL[family] ?? NotificationChannels.DEFAULT;
}

export async function setupAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  for (const def of CHANNEL_DEFS) {
    try {
      await Notifications.setNotificationChannelAsync(def.id, {
        name: def.name,
        description: def.description,
        importance: def.importance,
        vibrationPattern: def.vibrationPattern,
        enableVibrate: !!def.vibrationPattern,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    } catch (e: any) {
      console.error(`[NotificationChannels] Failed to register "${def.id}":`, e?.message);
    }
  }
}
