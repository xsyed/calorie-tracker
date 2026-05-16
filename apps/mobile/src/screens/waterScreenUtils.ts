import type { WaterEntry } from '../database';
import type { WaterHistoryGroup, WaterTrendDay } from './WaterTrendHistory';

const TREND_DAY_COUNT = 7;
const MAX_WATER_AMOUNT_ML = 5000;

export function formatDateLabel(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatEntryTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getCustomAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const amount = Number(trimmed);
  return Number.isFinite(amount) ? amount : null;
}

export function getCustomAmountError(amount: number | null): string | null {
  if (amount === null || amount <= 0) return 'Enter an amount greater than 0ml.';
  if (amount > MAX_WATER_AMOUNT_ML) return `Maximum water amount is ${MAX_WATER_AMOUNT_ML}ml.`;
  return null;
}

export function getGoalAmountError(amount: number | null): string | null {
  if (amount === null || amount <= 0) return 'Enter a goal greater than 0ml.';
  if (amount > MAX_WATER_AMOUNT_ML) return `Maximum water goal is ${MAX_WATER_AMOUNT_ML}ml.`;
  return null;
}

export function getDateWindow(endDate: string): string[] {
  const end = new Date(endDate + 'T00:00:00');
  return Array.from({ length: TREND_DAY_COUNT }, (_, index) => {
    const nextDate = new Date(end);
    nextDate.setDate(end.getDate() - (TREND_DAY_COUNT - 1 - index));
    return formatDateKey(nextDate);
  });
}

export function fillTrendDays(dates: string[], totals: WaterTrendDay[]): WaterTrendDay[] {
  const totalsByDate = new Map(totals.map((total) => [total.date, total.total_ml]));
  return dates.map((nextDate) => ({
    date: nextDate,
    total_ml: totalsByDate.get(nextDate) ?? 0,
  }));
}

export function groupEntriesByDate(entries: WaterEntry[]): WaterHistoryGroup[] {
  const groups = new Map<string, WaterEntry[]>();
  entries.forEach((entry) => {
    const currentEntries = groups.get(entry.date) ?? [];
    currentEntries.push(entry);
    groups.set(entry.date, currentEntries);
  });
  return Array.from(groups, ([groupDate, groupEntries]) => ({
    date: groupDate,
    entries: groupEntries,
  }));
}

function formatDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
