import type { ActivePromotionSummary, Promotion } from '../types';
import type { Product, ProductUnit } from '../../../type';

export interface EffectivePrice {
  display: number;
  original: number | null;
  hasDiscount: boolean;
}

export function effectivePriceForProduct(
  item: Product,
  promo: ActivePromotionSummary | null,
): EffectivePrice {
  if (item.prixBarre != null && item.prixBarre > item.prix) {
    return { display: item.prix, original: item.prixBarre, hasDiscount: true };
  }
  if (promo && promo.reductionPercentage > 0) {
    const discounted = +(item.prix * (1 - promo.reductionPercentage / 100)).toFixed(2);
    return { display: discounted, original: item.prix, hasDiscount: true };
  }
  return { display: item.prix, original: null, hasDiscount: false };
}

export function effectivePriceForUnit(
  unit: ProductUnit,
  promo: ActivePromotionSummary | null,
): EffectivePrice {
  if (unit.prixBarre != null && unit.prixBarre > unit.prix) {
    return { display: unit.prix, original: unit.prixBarre, hasDiscount: true };
  }
  if (promo && promo.reductionPercentage > 0) {
    const discounted = +(unit.prix * (1 - promo.reductionPercentage / 100)).toFixed(2);
    return { display: discounted, original: unit.prix, hasDiscount: true };
  }
  return { display: unit.prix, original: null, hasDiscount: false };
}

export function activePromosForEpicerie(
  promos: Promotion[] | null | undefined,
  epicerieId: number | null | undefined,
): Promotion[] {
  if (!promos || epicerieId == null) return [];
  const now = Date.now();
  return promos.filter((p) => {
    if (p.epicerieId !== epicerieId) return false;
    if (p.status === 'CANCELLED' || p.status === 'EXPIRED') return false;
    if (p.isActive === false) return false;
    const start = p.dateDebut ? new Date(p.dateDebut).getTime() : 0;
    const end = p.dateFin ? new Date(p.dateFin).getTime() : Infinity;
    return start <= now && end >= now;
  });
}

function toSummary(p: Promotion): ActivePromotionSummary {
  return {
    id: p.id,
    titre: p.titre,
    reductionPercentage: p.reductionPercentage,
    dateFin: p.dateFin,
    priority: p.priority ?? 0,
  };
}

function comparePromos(a: Promotion, b: Promotion): number {
  const pa = a.priority ?? 0;
  const pb = b.priority ?? 0;
  if (pb !== pa) return pb - pa;
  return new Date(a.dateFin).getTime() - new Date(b.dateFin).getTime();
}

export function promoTouchesProduct(promo: Promotion, product: Product): boolean {
  const type = promo.targetType;
  if (!type || type === 'ALL') return true;
  const targets = promo.targets ?? [];
  if (targets.length === 0) return false;
  switch (type) {
    case 'CATEGORY':
      return (
        product.categoryId != null &&
        targets.some((t) => t.kind === 'CATEGORY' && t.targetId === product.categoryId)
      );
    case 'PRODUCT':
      return targets.some((t) => t.kind === 'PRODUCT' && t.targetId === product.id);
    case 'UNIT': {
      const unitIds = new Set((product.units ?? []).map((u) => u.id));
      return targets.some((t) => t.kind === 'UNIT' && unitIds.has(t.targetId));
    }
    default:
      return false;
  }
}

export function bestPromoForProduct(
  promos: Promotion[],
  product: Product,
): ActivePromotionSummary | null {
  const matching = promos.filter((p) => promoTouchesProduct(p, product));
  if (matching.length === 0) return null;
  matching.sort(comparePromos);
  return toSummary(matching[0]);
}

export function promoTouchesCategory(promo: Promotion, categoryId: number): boolean {
  const type = promo.targetType;
  if (!type) return false;
  if (type === 'ALL') return true;
  if (type === 'CATEGORY') {
    return (promo.targets ?? []).some((t) => t.kind === 'CATEGORY' && t.targetId === categoryId);
  }
  return false;
}

export function bestPromoForCategory(
  promos: Promotion[],
  categoryId: number,
): ActivePromotionSummary | null {
  const matching = promos.filter((p) => promoTouchesCategory(p, categoryId));
  if (matching.length === 0) return null;
  matching.sort(comparePromos);
  return toSummary(matching[0]);
}

export function promoTouchesUnit(
  promo: Promotion,
  product: Product,
  unitId: number,
): boolean {
  const type = promo.targetType;
  if (!type || type === 'ALL') return true;
  const targets = promo.targets ?? [];
  switch (type) {
    case 'CATEGORY':
      return (
        product.categoryId != null &&
        targets.some((t) => t.kind === 'CATEGORY' && t.targetId === product.categoryId)
      );
    case 'PRODUCT':
      return targets.some((t) => t.kind === 'PRODUCT' && t.targetId === product.id);
    case 'UNIT':
      return targets.some((t) => t.kind === 'UNIT' && t.targetId === unitId);
    default:
      return false;
  }
}

export function bestPromoForUnit(
  promos: Promotion[],
  product: Product,
  unitId: number,
): ActivePromotionSummary | null {
  const matching = promos.filter((p) => promoTouchesUnit(p, product, unitId));
  if (matching.length === 0) return null;
  matching.sort(comparePromos);
  return toSummary(matching[0]);
}
