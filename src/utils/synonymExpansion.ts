/**
 * Search-query expansion via the épicerie's synonym map.
 *
 * <p>Pure functions — no I/O, no React. Lives in {@code utils/} so the same
 * helper can be used by every screen that needs to filter a local in-RAM
 * collection by a darija/arabic-aware query (vente-directe products, future
 * variant pickers, etc.). The corresponding service (synonymsService.ts)
 * fetches and caches the underlying map.
 *
 * <p><strong>Map shape</strong>: mirrors the backend's
 * {@code SynonymService.getExpansionSnapshot} return type:
 * {@code { "zit": ["huile"], "matisha": ["tomate"], ... }}.
 * The terms are lowercase; canonicals are also lowercase. The expansion is
 * unidirectional — typing "zit" finds "huile", but typing "huile" does NOT
 * find products whose name happens to contain "zit". That matches the
 * backend's {@code expandQuery} semantics on purpose: épiciers store products
 * in French, customers type in darija.
 */

/** Map shape sent by GET /api/epiceries/{id}/synonyms/expansion-map. */
export type SynonymExpansionMap = Record<string, string[]>;

/**
 * Lowercase + strip the most common diacritics so "Café" matches "cafe" and
 * accent variants of the same word collapse together. Arabic harakat
 * (fatha, kasra, damma, sukun, shadda, tanwin, dagger alif) are also
 * stripped because épiciers and customers type the same word with or
 * without them.
 */
export const normalize = (s: string | null | undefined): string => {
  if (!s) return '';
  return s
    .normalize('NFD')                       // split base char + combining marks
    .replace(/[̀-ͯ]/g, '')        // strip Latin combining diacritics
    .replace(/[ً-ْٰ]/g, '')  // strip Arabic harakat + dagger alif
    .toLowerCase()
    .trim();
};

/** Optional knobs for {@link expandQuery} / {@link expandAndFilter}. */
export interface ExpandOptions {
  /**
   * When true, also expand using the <em>reverse</em> map (canonical → terms),
   * so typing "huile" finds products whose name happens to contain "zit" /
   * "زيت". Default: true.
   *
   * <p>Useful when the épicier names some of their products in darija/arabe
   * (rare but legitimate, e.g. "Zit Afia 1L"), so the staff who type in
   * French still find them. Disable if you want strict directional behaviour
   * (the canonical pure expansion that the backend's {@code expandQuery}
   * provides).
   */
  bidirectional?: boolean;
}

/**
 * Build the inverse of an expansion map: {@code canonical → [...terms]}.
 *
 * <p>One canonical can be mapped from several terms (e.g. {@code huile}
 * receives {@code zit, zet, زيت}), hence the array value. Memoised on the
 * caller side if you process many queries against the same map; the
 * computation is O(n) where n is the total entry count.
 */
export const buildReverseMap = (
  map: SynonymExpansionMap | null | undefined,
): SynonymExpansionMap => {
  const out: SynonymExpansionMap = {};
  if (!map) return out;
  for (const [term, canonicals] of Object.entries(map)) {
    for (const canonical of canonicals) {
      const k = normalize(canonical);
      if (!k) continue;
      const list = out[k] || (out[k] = []);
      const t = normalize(term);
      if (t && !list.includes(t)) list.push(t);
    }
  }
  return out;
};

/**
 * Expand a query into the set of terms to actually look for. Always
 * includes the normalized query itself first; appends each canonical
 * mapped to the full query, then for each space-separated word. When
 * {@link ExpandOptions.bidirectional} is on (default), the same passes
 * are applied to the inverse map.
 *
 * <p>Example with map {@code { "zit": ["huile"], "matisha": ["tomate"] }}:
 * <ul>
 *   <li>{@code expandQuery("zit", map)} → {@code ["zit", "huile"]}</li>
 *   <li>{@code expandQuery("2kg matisha", map)} → {@code ["2kg matisha", "tomate"]}</li>
 *   <li>{@code expandQuery("huile", map)} → {@code ["huile", "zit"]} (bidirectional)</li>
 *   <li>{@code expandQuery("pain", map)} → {@code ["pain"]} (no match)</li>
 * </ul>
 */
export const expandQuery = (
  query: string,
  map: SynonymExpansionMap | null | undefined,
  options: ExpandOptions = {},
): string[] => {
  const q = normalize(query);
  if (!q) return [];

  // LinkedHashSet semantics: preserve insertion order, no duplicates.
  const out: string[] = [q];
  const seen = new Set<string>([q]);
  const addAll = (arr?: string[]) => {
    if (!arr) return;
    for (const c of arr) {
      const n = normalize(c);
      if (n && !seen.has(n)) {
        seen.add(n);
        out.push(n);
      }
    }
  };

  if (!map) return out;

  const bidirectional = options.bidirectional !== false;
  // Single map walk to avoid building the reverse twice on hot paths
  // (vente-directe re-runs expandQuery on every keystroke).
  const reverseMap = bidirectional ? buildReverseMap(map) : null;

  const lookup = (key: string) => {
    addAll(map[key]);
    if (reverseMap) addAll(reverseMap[key]);
  };

  // Try the full query first (multi-word synonyms like "lait de soja").
  lookup(q);

  // Then each significant word, mirroring SynonymService.expandQuery.
  // Skip 1-char tokens (articles, leftover punctuation).
  if (q.includes(' ')) {
    for (const word of q.split(/\s+/)) {
      if (word.length >= 2) lookup(word);
    }
  }

  return out;
};

/**
 * Filter a list of items by a query, using the synonym map for darija/arabic
 * expansion. The {@code getText} callback returns the searchable strings of
 * each item (typically {@code [item.name, item.description]}); the item
 * matches if ANY expanded term appears as a substring of ANY of those
 * strings (case- and diacritic-insensitive thanks to {@link normalize}).
 *
 * <p>Performance: O(items × terms × textsPerItem). Catalogues are typically
 * a few hundred products with 1-3 expanded terms — well below any user-
 * visible threshold.
 */
export const expandAndFilter = <T>(
  items: T[],
  query: string,
  map: SynonymExpansionMap | null | undefined,
  getText: (item: T) => Array<string | null | undefined>,
  options: ExpandOptions = {},
): T[] => {
  const terms = expandQuery(query, map, options);
  if (terms.length === 0) return items;

  return items.filter(item => {
    const texts = getText(item).map(normalize);
    return terms.some(t => texts.some(tx => tx.includes(t)));
  });
};
