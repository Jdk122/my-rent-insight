/**
 * Shared display helpers for comparable listing UI.
 */

export function compAgeLabel(daysOld: number | null): { text: string; className: string } | null {
  if (daysOld === null || daysOld < 0) return null;
  if (daysOld < 30) {
    return { text: `Listed ${daysOld} days ago`, className: 'text-green-600' };
  }
  if (daysOld <= 90) {
    const weeks = Math.round(daysOld / 7);
    const text = weeks >= 6 ? `Listed ${Math.round(daysOld / 30)} months ago` : `Listed ${weeks} weeks ago`;
    return { text, className: 'text-muted-foreground' };
  }
  const months = Math.round(daysOld / 30);
  return { text: `Listed ${months} months ago`, className: 'text-amber-600' };
}
