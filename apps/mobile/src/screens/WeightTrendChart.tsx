import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

import type { WeightEntry } from '../database';

import { buildWeightChartData } from './weightChartUtils';
import type { WeightChartPoint, WeightChartSegment } from './weightChartUtils';

const CHART_HEIGHT = 180;
const POINT_SIZE = 8;
const LINE_WIDTH = 2;

interface WeightTrendChartProps {
  entries: WeightEntry[];
  isDarkMode: boolean;
}

interface ChartPosition {
  x: number;
  y: number;
}

interface ChartScale {
  maxDay: number;
  maxWeight: number;
  minDay: number;
  minWeight: number;
  width: number;
}

export function WeightTrendChart({ entries, isDarkMode }: WeightTrendChartProps) {
  const [chartWidth, setChartWidth] = useState(0);
  const chartData = useMemo(() => buildWeightChartData(entries), [entries]);
  const scale = getScale(chartData.displayPoints, chartData.minWeightKg, chartData.maxWeightKg, chartWidth);

  return (
    <View style={[styles.card, isDarkMode && styles.cardDark]}>
      <View style={styles.titleRow}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.titleDark]}>Trend</Text>
        {chartData.displayPoints.length > 0 && (
          <Text style={[styles.rangeLabel, isDarkMode && styles.mutedDark]}>
            {formatRange(chartData.displayPoints)}
          </Text>
        )}
      </View>

      {chartData.displayPoints.length === 0 ? (
        <Text style={[styles.emptyText, isDarkMode && styles.mutedDark]}>
          No weigh-ins yet. Tap '+ Log Weight' to add your first entry.
        </Text>
      ) : (
        <View>
          <View style={styles.axisRow}>
            <Text style={[styles.axisLabel, isDarkMode && styles.mutedDark]}>
              {formatAxisWeight(chartData.maxWeightKg)}
            </Text>
            <Text style={[styles.axisLabel, isDarkMode && styles.mutedDark]}>
              {formatAxisWeight(chartData.minWeightKg)}
            </Text>
          </View>
          <View style={styles.chart} onLayout={handleLayout(setChartWidth)}>
            {chartWidth > 0 && (
              <>
                {chartData.segments.map((segment) => (
                  <Segment
                    key={`${segment.start.date}-${segment.end.date}`}
                    color={isDarkMode ? '#64D2FF' : '#007AFF'}
                    scale={scale}
                    segment={segment}
                  />
                ))}
                {chartData.trendSegments.map((segment) => (
                  <Segment
                    key={`trend-${segment.start.date}-${segment.end.date}`}
                    color={isDarkMode ? '#FFB340' : '#C77700'}
                    scale={scale}
                    segment={segment}
                    style={styles.trendLine}
                  />
                ))}
                {chartData.displayPoints.map((point) => (
                  <Point
                    key={point.date}
                    color={isDarkMode ? '#64D2FF' : '#007AFF'}
                    point={point}
                    scale={scale}
                  />
                ))}
              </>
            )}
          </View>
          {chartData.displayPoints.length === 1 && (
            <Text style={[styles.singleText, isDarkMode && styles.mutedDark]}>
              Log another weigh-in to see a trend.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

interface SegmentProps {
  color: string;
  scale: ChartScale;
  segment: WeightChartSegment;
  style?: object;
}

function Segment({ color, scale, segment, style }: SegmentProps) {
  const start = getPosition(segment.start, scale);
  const end = getPosition(segment.end, scale);
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.hypot(deltaX, deltaY);
  const angle = `${Math.atan2(deltaY, deltaX)}rad`;

  return (
    <View
      style={[
        styles.segment,
        style,
        {
          backgroundColor: color,
          left: start.x,
          top: start.y,
          transform: [{ rotate: angle }],
          width: length,
        },
      ]}
    />
  );
}

interface PointProps {
  color: string;
  point: WeightChartPoint;
  scale: ChartScale;
}

function Point({ color, point, scale }: PointProps) {
  const position = getPosition(point, scale);

  return (
    <View
      style={[
        styles.point,
        {
          backgroundColor: color,
          left: position.x - POINT_SIZE / 2,
          top: position.y - POINT_SIZE / 2,
        },
      ]}
    />
  );
}

function getScale(points: WeightChartPoint[], minWeight: number, maxWeight: number, width: number): ChartScale {
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const minDay = firstPoint?.dayIndex ?? 0;
  const maxDay = lastPoint?.dayIndex ?? minDay + 1;

  return {
    maxDay: maxDay === minDay ? minDay + 1 : maxDay,
    maxWeight,
    minDay,
    minWeight,
    width,
  };
}

function getPosition(point: WeightChartPoint, scale: ChartScale): ChartPosition {
  const xRange = scale.maxDay - scale.minDay;
  const yRange = scale.maxWeight - scale.minWeight;
  const x = ((point.dayIndex - scale.minDay) / xRange) * scale.width;
  const y = CHART_HEIGHT - ((point.weightKg - scale.minWeight) / yRange) * CHART_HEIGHT;

  return {
    x: Math.max(0, Math.min(scale.width, x)),
    y: Math.max(0, Math.min(CHART_HEIGHT, y)),
  };
}

function handleLayout(setChartWidth: (width: number) => void) {
  return (event: LayoutChangeEvent) => {
    setChartWidth(event.nativeEvent.layout.width);
  };
}

function formatRange(points: WeightChartPoint[]): string {
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  if (firstPoint === undefined || lastPoint === undefined) return '';
  if (firstPoint.date === lastPoint.date) return formatShortDate(firstPoint.date);
  return `${formatShortDate(firstPoint.date)} - ${formatShortDate(lastPoint.date)}`;
}

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatAxisWeight(weightKg: number): string {
  return `${weightKg.toFixed(1)} kg`;
}

const styles = StyleSheet.create({
  card: {
    marginTop: 20,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  cardDark: {
    backgroundColor: '#1C1C1E',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  rangeLabel: {
    flexShrink: 1,
    fontSize: 13,
    color: '#666666',
  },
  mutedDark: {
    color: '#A0A0A0',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 15,
    color: '#666666',
  },
  axisRow: {
    position: 'absolute',
    top: 10,
    bottom: 0,
    justifyContent: 'space-between',
  },
  axisLabel: {
    fontSize: 11,
    color: '#666666',
  },
  chart: {
    position: 'relative',
    height: CHART_HEIGHT,
    marginTop: 16,
    marginLeft: 54,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D1D1D6',
  },
  segment: {
    position: 'absolute',
    height: LINE_WIDTH,
    opacity: 0.75,
    transformOrigin: 'left center',
  },
  trendLine: {
    opacity: 0.45,
  },
  point: {
    position: 'absolute',
    width: POINT_SIZE,
    height: POINT_SIZE,
    borderRadius: POINT_SIZE / 2,
  },
  singleText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
  },
});
