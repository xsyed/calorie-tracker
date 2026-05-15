import { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

interface DateStripProps {
  selectedDate: string;
  loggedDates: Set<string>;
  onDateSelect: (date: string) => void;
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isAfterToday(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return getStartOfDay(date) > today;
}

export default function DateStrip({
  selectedDate,
  loggedDates,
  onDateSelect,
}: DateStripProps) {
  const isDarkMode = useColorScheme() === 'dark';

  const days = useMemo(
    () => {
      const selected = new Date(selectedDate + 'T00:00:00');
      const endDate = isAfterToday(selected) ? new Date() : selected;
      endDate.setHours(0, 0, 0, 0);

      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(endDate);
        d.setDate(d.getDate() - (6 - i));
        return d;
      });
    },
    [selectedDate],
  );

  const accentColor = isDarkMode ? '#0A84FF' : '#007AFF';
  const todayStr = getTodayDate();

  return (
    <View style={styles.container}>
      <View style={styles.daysRow}>
        {days.map((day) => {
          const dateStr = formatDate(day);
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const hasLogged = loggedDates.has(dateStr);

          return (
            <Pressable
              key={dateStr}
              onPress={() => {
                onDateSelect(dateStr);
              }}
              style={styles.dayCell}
            >
              <Text
                style={[
                  styles.dayLabel,
                  isDarkMode && styles.dayLabelDark,
                ]}
              >
                {DAY_LETTERS[day.getDay()]}
              </Text>

              <View
                style={[
                  styles.pill,
                  isSelected && { backgroundColor: accentColor },
                  isToday && !isSelected && styles.todayRing,
                  isToday && !isSelected && { borderColor: accentColor },
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    isDarkMode && styles.pillTextDark,
                    isSelected && styles.pillTextSelected,
                    isToday &&
                      !isSelected && {
                        color: accentColor,
                        fontWeight: '700',
                      },
                  ]}
                >
                  {day.getDate()}
                </Text>
              </View>

              <View
                style={[styles.dot, !hasLogged && styles.dotHidden]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  daysRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8E8E93',
    marginBottom: 2,
  },
  dayLabelDark: {
    color: '#8E8E93',
  },
  pill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  pillTextDark: {
    color: '#FFFFFF',
  },
  pillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  todayRing: {
    borderWidth: 1.5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#30D158',
    marginTop: 4,
  },
  dotHidden: {
    backgroundColor: 'transparent',
  },
});
