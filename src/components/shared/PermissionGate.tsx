/**
 * PermissionGate — masque ses enfants si l'utilisateur n'a pas la permission.
 *
 * <p>Mode UX retenu : <b>masquage complet</b> (pas de disable+tooltip). L'utilisateur
 * ne voit pas les boutons qu'il ne peut pas utiliser.</p>
 *
 * <p>Usage typique :</p>
 * <pre>
 *   &lt;PermissionGate feature="orders:process"&gt;
 *     &lt;Button title="Accepter" onPress={accept} /&gt;
 *   &lt;/PermissionGate&gt;
 *
 *   {/* Au moins une des permissions *\/}
 *   &lt;PermissionGate features={['stock:adjust','stock:history']}&gt;...&lt;/PermissionGate&gt;
 *
 *   {/* Toutes les permissions *\/}
 *   &lt;PermissionGate features={['products:edit','variants:edit']} mode="all"&gt;...&lt;/PermissionGate&gt;
 * </pre>
 */
import React from 'react';
import { Feature, usePermissions } from '../../hooks/usePermissions';
import { useCurrentUser } from '../../hooks/useCurrentUser';

type Props = {
  /** Une seule permission requise. */
  feature?: Feature;
  /** Plusieurs permissions. Combine via {@link mode}. */
  features?: Feature[];
  /** 'any' = au moins une (defaut) ; 'all' = toutes. */
  mode?: 'any' | 'all';
  /** Rendu alternatif quand l'utilisateur n'a pas la permission. Defaut : rien. */
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

export const PermissionGate: React.FC<Props> = ({
  feature,
  features,
  mode = 'any',
  fallback = null,
  children,
}) => {
  const user = useCurrentUser();
  const { can } = usePermissions(user);

  const list: Feature[] = feature ? [feature] : (features ?? []);
  if (list.length === 0) return <>{fallback}</>;

  const allowed = mode === 'all' ? list.every(can) : list.some(can);
  return <>{allowed ? children : fallback}</>;
};
