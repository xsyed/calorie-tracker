import type { WeightEntry } from '../database';

const MAX_DISPLAY_POINTS = 120;
const MAX_SOLID_GAP_DAYS = 7;
const OUTLIER_STD_DEV_LIMIT = 3;
const MS_PER_DAY = 86_400_000;

export interface WeightChartPoint {
  date: string;
  dayIndex: number;
  weightKg: number;
}

export interface WeightChartSegment {
  end: WeightChartPoint;
  start: WeightChartPoint;
}

export interface WeightChartData {
  displayPoints: WeightChartPoint[];
  maxWeightKg: number;
  minWeightKg: number;
  segments: WeightChartSegment[];
  trendSegments: WeightChartSegment[];
}

interface DatedWeightEntry extends WeightEntry {
  dayIndex: number;
}

export function buildWeightChartData(entries: WeightEntry[]): WeightChartData {
  const dailyPoints = excludeOutliers(collapseEntriesByDate(entries));
  const displayPoints = downsamplePoints(dailyPoints);
  const bounds = getWeightBounds(displayPoints);

  return {
    displayPoints,
    maxWeightKg: bounds.max,
    minWeightKg: bounds.min,
    segments: buildSegments(displayPoints),
    trendSegments: buildTrendSegments(dailyPoints, displayPoints),
  };
}

function collapseEntriesByDate(entries: WeightEntry[]): WeightChartPoint[] {
  const latestByDate = new Map<string, DatedWeightEntry>();

  entries.forEach((entry) => {
    const existing = latestByDate.get(entry.date);
    const datedEntry = { ...entry, dayIndex: getDayIndex(entry.date) };
    if (existing === undefined || entry.timestamp > existing.timestamp) {
      latestByDate.set(entry.date, datedEntry);
    }
  });

  return Array.from(latestByDate.values())
    .sort((first, second) => first.dayIndex - second.dayIndex)
    .map((entry) => ({
      date: entry.date,
      dayIndex: entry.dayIndex,
      weightKg: entry.weight_kg,
    }));
}

function excludeOutliers(points: WeightChartPoint[]): WeightChartPoint[] {
  if (points.length < 2) return points;

  const weights = points.map((point) => point.weightKg);
  const mean = weights.reduce((sum, weight) => sum + weight, 0) / weights.length;
  const variance = weights.reduce((sum, weight) => sum + (weight - mean) ** 2, 0) / weights.length;
  const standardDeviation = Math.sqrt(variance);

  if (standardDeviation === 0) return points;

  return points.filter((point) => Math.abs(point.weightKg - mean) <= standardDeviation * OUTLIER_STD_DEV_LIMIT);
}

function downsamplePoints(points: WeightChartPoint[]): WeightChartPoint[] {
  if (points.length <= MAX_DISPLAY_POINTS) return points;

  const step = Math.ceil(points.length / MAX_DISPLAY_POINTS);
  const sampled = points.filter((_point, index) => index % step === 0);
  const lastPoint = points[points.length - 1];
  const sampledLastPoint = sampled[sampled.length - 1];

  if (lastPoint !== undefined && sampledLastPoint?.date !== lastPoint.date) {
    return [...sampled, lastPoint];
  }

  return sampled;
}

function getWeightBounds(points: WeightChartPoint[]): { max: number; min: number } {
  const firstPoint = points[0];
  if (firstPoint === undefined) return { max: 1, min: 0 };

  let min = firstPoint.weightKg;
  let max = firstPoint.weightKg;

  points.forEach((point) => {
    min = Math.min(min, point.weightKg);
    max = Math.max(max, point.weightKg);
  });

  if (min === max) {
    return { max: max + 1, min: min - 1 };
  }

  const padding = (max - min) * 0.12;
  return { max: max + padding, min: min - padding };
}

function buildSegments(points: WeightChartPoint[]): WeightChartSegment[] {
  const segments: WeightChartSegment[] = [];

  points.forEach((point, index) => {
    const nextPoint = points[index + 1];
    if (nextPoint === undefined) return;
    if (nextPoint.dayIndex - point.dayIndex > MAX_SOLID_GAP_DAYS) return;
    segments.push({ start: point, end: nextPoint });
  });

  return segments;
}

function buildTrendSegments(sourcePoints: WeightChartPoint[], displayPoints: WeightChartPoint[]): WeightChartSegment[] {
  if (sourcePoints.length < 2 || displayPoints.length < 2) return [];

  const regression = getLinearRegression(sourcePoints);
  const trendPoints = displayPoints.map((point) => ({
    date: point.date,
    dayIndex: point.dayIndex,
    weightKg: regression.slope * point.dayIndex + regression.intercept,
  }));
  return buildSegments(trendPoints);
}

function getLinearRegression(points: WeightChartPoint[]): { intercept: number; slope: number } {
  const count = points.length;
  const sums = points.reduce(
    (total, point) => ({
      x: total.x + point.dayIndex,
      xx: total.xx + point.dayIndex * point.dayIndex,
      xy: total.xy + point.dayIndex * point.weightKg,
      y: total.y + point.weightKg,
    }),
    { x: 0, xx: 0, xy: 0, y: 0 },
  );
  const denominator = count * sums.xx - sums.x * sums.x;
  const slope = denominator === 0 ? 0 : (count * sums.xy - sums.x * sums.y) / denominator;
  const intercept = (sums.y - slope * sums.x) / count;

  return { intercept, slope };
}

function getDayIndex(date: string): number {
  return Math.round(new Date(`${date}T00:00:00`).getTime() / MS_PER_DAY);
}
