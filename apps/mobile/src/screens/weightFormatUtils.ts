export function formatSignedWeight(weightKg: number): string {
  const sign = weightKg > 0 ? '+' : '';
  return `${sign}${formatWeight(weightKg)} kg`;
}

export function formatWeight(weightKg: number): string {
  return Number.isInteger(weightKg) ? String(weightKg) : weightKg.toFixed(1);
}

export function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
