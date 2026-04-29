/**
 * Raccourcis de dates pour le wizard (adaptés au contexte épicier marocain).
 */

export interface DateShortcut {
  key: 'weekend' | 'week' | '3days' | 'month';
  labelKey: string;           // clé i18n
  compute: () => { start: Date; end: Date };
}

function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function nextDayOfWeek(targetDow: number): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun..6=Sat
  const diff = (targetDow - day + 7) % 7 || 7;
  const r = new Date(now);
  r.setDate(now.getDate() + diff);
  return r;
}

/** Vendredi 00:00 → dimanche 23:59 (Maroc : week-end vendredi-samedi-dimanche selon usage). */
function weekend(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay();
  // Si on est déjà vendredi/samedi/dimanche : démarrer now, terminer dimanche soir
  if (day >= 5 || day === 0) {
    const sunday = day === 0 ? now : nextDayOfWeek(0);
    return {
      start: startOfDay(now),
      end: endOfDay(sunday),
    };
  }
  // Sinon : prochain vendredi → dimanche
  const friday = nextDayOfWeek(5);
  const sunday = new Date(friday);
  sunday.setDate(friday.getDate() + 2);
  return {
    start: startOfDay(friday),
    end: endOfDay(sunday),
  };
}

/** Aujourd'hui 00:00 → dimanche 23:59. */
function thisWeek(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay() === 0 ? 7 : now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + (7 - day));
  return {
    start: startOfDay(now),
    end: endOfDay(sunday),
  };
}

/** Aujourd'hui 00:00 → J+3 23:59. */
function threeDays(): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setDate(now.getDate() + 3);
  return {
    start: startOfDay(now),
    end: endOfDay(end),
  };
}

/** Aujourd'hui 00:00 → fin du mois. */
function thisMonth(): { start: Date; end: Date } {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: startOfDay(now),
    end: endOfDay(lastDay),
  };
}

export const DATE_SHORTCUTS: DateShortcut[] = [
  { key: 'weekend', labelKey: 'promotions.wizard.shortcutWeekend', compute: weekend },
  { key: 'week',    labelKey: 'promotions.wizard.shortcutWeek',    compute: thisWeek },
  { key: '3days',   labelKey: 'promotions.wizard.shortcut3Days',   compute: threeDays },
  { key: 'month',   labelKey: 'promotions.wizard.shortcutMonth',   compute: thisMonth },
];
