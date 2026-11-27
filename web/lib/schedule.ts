// The scan schedule, mirroring .github/workflows/scan.yml (keep the two in step).
// Weekly: Mondays 02:13 UTC (promotions, products, content). Monthly: the 1st, 03:17 UTC (everything else).
export const SKIPPED = ["2026-12-01"]; // SKIP_SCHEDULED_DATES in scan.yml
export const TRACKING_BEGAN = "2026-11-26";

export function nextWeekly(now = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 2, 13));
  while (d.getUTCDay() !== 1 || d <= now || SKIPPED.includes(d.toISOString().slice(0, 10))) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export function nextMonthly(now = new Date()): Date {
  let d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 3, 17));
  while (d <= now || SKIPPED.includes(d.toISOString().slice(0, 10))) d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 3, 17));
  return d;
}
