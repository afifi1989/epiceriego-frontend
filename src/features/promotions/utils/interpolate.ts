/**
 * Interpole les placeholders {{key}} d'une string i18n par les valeurs fournies.
 * Local à la feature — le système i18n global ne fait pas d'interpolation.
 */
export function interpolate(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = params[k];
    return v === undefined || v === null ? '' : String(v);
  });
}
