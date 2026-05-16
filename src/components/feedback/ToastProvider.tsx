import * as Haptics from 'expo-haptics';
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Toast, ToastConfig, ToastVariant } from './Toast';

interface ShowToastOptions {
  variant?:  ToastVariant;
  title:     string;
  message?:  string;
  duration?: number;
  /** Désactive le retour haptique pour ce toast (défaut: actif). */
  silent?:   boolean;
}

interface ToastContextValue {
  show:    (opts: ShowToastOptions) => string;
  success: (title: string, message?: string) => string;
  error:   (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info:    (title: string, message?: string) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const HAPTIC_BY_VARIANT: Record<ToastVariant, Haptics.NotificationFeedbackType | null> = {
  success: Haptics.NotificationFeedbackType.Success,
  error:   Haptics.NotificationFeedbackType.Error,
  warning: Haptics.NotificationFeedbackType.Warning,
  info:    null,
};

/**
 * Provider à monter une seule fois au plus haut niveau (RootLayout).
 *
 * Conception:
 * - File d'attente plate (max 3 toasts visibles simultanément). Au-delà, le plus
 *   ancien est dismissé en silence pour éviter de cacher l'écran.
 * - Pas de re-render coûteux: chaque toast est un composant indépendant qui gère
 *   sa propre animation via Reanimated (UI thread).
 * - Haptics natif synchrone à l'apparition — feedback corporel = perception
 *   "instant" qui compense l'arrivée animée.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastConfig[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((opts: ShowToastOptions): string => {
    const variant = opts.variant ?? 'info';
    const id = `t_${Date.now()}_${idRef.current++}`;
    const config: ToastConfig = {
      id,
      variant,
      title:    opts.title,
      message:  opts.message,
      duration: opts.duration,
    };

    setToasts(prev => {
      // Cap à 3 toasts visibles. On retire le plus ancien.
      const next = prev.length >= 3 ? prev.slice(1) : prev;
      return [...next, config];
    });

    if (!opts.silent) {
      const haptic = HAPTIC_BY_VARIANT[variant];
      if (haptic) {
        // Fire-and-forget: haptics sont best-effort.
        Haptics.notificationAsync(haptic).catch(() => {});
      }
    }

    return id;
  }, []);

  const value: ToastContextValue = {
    show,
    success: (title, message) => show({ variant: 'success', title, message }),
    error:   (title, message) => show({ variant: 'error',   title, message }),
    warning: (title, message) => show({ variant: 'warning', title, message }),
    info:    (title, message) => show({ variant: 'info',    title, message }),
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.map(config => (
        <Toast key={config.id} config={config} onDismiss={dismiss} />
      ))}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return ctx;
}
