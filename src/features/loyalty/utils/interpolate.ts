/**
 * Remplace les placeholders {{key}} dans une string par les valeurs fournies.
 * Utilisé localement par la feature fidélité — l'i18n global ne fait pas d'interpolation.
 */
export function interpolate(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = params[k];
    return v === undefined || v === null ? '' : String(v);
  });
}
