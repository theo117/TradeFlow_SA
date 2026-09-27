/** Keep the original day, or the last day for schedules originating at month end.
 * Clamp short months without losing the anchor; leap-day annual schedules recover
 * February 29 in leap years. Existing schedules acquire an anchor on next use.
 */
export function advanceRecurringDate(value: string, frequency: "monthly" | "quarterly" | "annually", anchor = value) {
  const current = new Date(`${value}T00:00:00.000Z`);
  const original = new Date(`${anchor}T00:00:00.000Z`);
  const monthEnd = new Date(Date.UTC(original.getUTCFullYear(), original.getUTCMonth() + 1, 0)).getUTCDate();
  const months = frequency === "monthly" ? 1 : frequency === "quarterly" ? 3 : 12;
  const target = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(original.getUTCDate() === monthEnd ? lastDay : Math.min(original.getUTCDate(), lastDay));
  return target.toISOString().slice(0, 10);
}
