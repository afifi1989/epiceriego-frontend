export { interpolate } from './interpolate';
export {
  computeStatus,
  statusColor,
  statusBackground,
  statusEmoji,
} from './promoStatus';
export {
  formatShortDate,
  humanizeDuration,
  timeUntil,
} from './formatPromoDate';
export {
  applyDiscount,
  savings,
  formatDH,
} from './discountCalc';
export { DATE_SHORTCUTS, type DateShortcut } from './dateShortcuts';
export {
  activePromosForEpicerie,
  bestPromoForProduct,
  bestPromoForCategory,
  bestPromoForUnit,
  promoTouchesProduct,
  promoTouchesCategory,
  promoTouchesUnit,
  effectivePriceForProduct,
  effectivePriceForUnit,
  type EffectivePrice,
} from './resolveProductPromo';
