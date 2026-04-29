/**
 * Formate une date ISO pour affichage court (jj/mm/aa).
 */
export function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Formate une durée relative en français : "2j 3h", "4h 15min", "30min".
 * Retourne "" pour une durée ≤ 0.
 */
export function humanizeDuration(ms: number): string {
  if (ms <= 0) return '';
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin - days * 60 * 24) / 60);
  const mins = totalMin - days * 60 * 24 - hours * 60;

  if (days >= 2) return `${days}j`;
  if (days === 1) return hours > 0 ? `1j ${hours}h` : '1j';
  if (hours >= 1) return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  return `${mins}min`;
}

/**
 * Retourne la durée jusqu'à / depuis une date ISO.
 *  - future : "3j", "5h", "30min"
 *  - past : "il y a 2j"
 */
export function timeUntil(iso: string): { ms: number; text: string } {
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diff = target - now;
  return {
    ms: diff,
    text: humanizeDuration(Math.abs(diff)),
  };
}
