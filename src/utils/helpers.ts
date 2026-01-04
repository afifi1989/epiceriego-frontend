/**
 * Formate un prix en DH
 */
export const formatPrice = (price: number): string => {
  return `${price.toFixed(2)} DH`;
};

/**
 * Formate une date au format français
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Traduit les statuts de commande
 */
export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    PENDING: 'En attente',
    ACCEPTED: 'Acceptée',
    PREPARING: 'En préparation',
    READY: 'Prête',
    IN_DELIVERY: 'En livraison',
    DELIVERED: 'Livrée',
    CANCELLED: 'Annulée',
  };
  return labels[status] || status;
};

/**
 * Retourne la couleur associée à un statut
 */
export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    PENDING: '#FFA500',
    ACCEPTED: '#4169E1',
    PREPARING: '#9370DB',
    READY: '#00CED1',
    IN_DELIVERY: '#8A2BE2',
    DELIVERED: '#32CD32',
    CANCELLED: '#DC143C',
  };
  return colors[status] || '#808080';
};