import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

interface MonthDropdownProps {
  selectedDate: string;
  loggedDates: Set<string>;
  onDateSelect: (date: string) => void;
  onVisibleRangeChange?: (startDate: string, endDate: string) => void;
}

const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

function getMonthDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1;

  const days: (number | null)[] = [];
  for (let i = 0; i < offset; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

function formatMonthDate(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function getMonthRange(year: number, month: number): {
  startDate: string;
  endDate: string;
} {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return {
    startDate: formatMonthDate(year, month, 1),
    endDate: formatMonthDate(year, month, daysInMonth),
  };
}

function getTodayDate(): string {
  const today = new Date();
  return formatMonthDate(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
}

function getClampedDateForMonth(
  baseDate: string,
  targetYear: number,
  targetMonth: number,
): string {
  const selected = new Date(baseDate + 'T00:00:00');
  const today = new Date();
  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const maxDay =
    targetYear === today.getFullYear() && targetMonth === today.getMonth()
      ? Math.min(daysInMonth, today.getDate())
      : daysInMonth;
  const targetDay = Math.min(selected.getDate(), maxDay);
  return formatMonthDate(targetYear, targetMonth, targetDay);
}

function getShiftedMonth(year: number, month: number, offset: number): {
  year: number;
  month: number;
} {
  const date = new Date(year, month + offset, 1);
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
  };
}

function isTodayDate(year: number, month: number, day: number): boolean {
  const today = new Date();
  return (
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === day
  );
}

function isFutureDate(year: number, month: number, day: number): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const check = new Date(year, month, day);
  return check > today;
}

export default function MonthDropdown({
  selectedDate,
  loggedDates,
  onDateSelect,
  onVisibleRangeChange,
}: MonthDropdownProps) {
  const isDarkMode = useColorScheme() === 'dark';
  const [isOpen, setIsOpen] = useState(false);

  const [displayYear, setDisplayYear] = useState(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    return d.getFullYear();
  });
  const [displayMonth, setDisplayMonth] = useState(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    return d.getMonth();
  });

  const accentColor = isDarkMode ? '#0A84FF' : '#007AFF';

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) {
        const d = new Date(selectedDate + 'T00:00:00');
        setDisplayYear(d.getFullYear());
        setDisplayMonth(d.getMonth());
      }
      return !prev;
    });
  }, [selectedDate]);

  useEffect(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    setDisplayYear(d.getFullYear());
    setDisplayMonth(d.getMonth());
  }, [selectedDate]);

  useEffect(() => {
    if (!isOpen || onVisibleRangeChange === undefined) return;
    const range = getMonthRange(displayYear, displayMonth);
    onVisibleRangeChange(range.startDate, range.endDate);
  }, [displayYear, displayMonth, isOpen, onVisibleRangeChange]);

  const close = useCallback(() => setIsOpen(false), []);

  const days = useMemo(
    () => getMonthDays(displayYear, displayMonth),
    [displayYear, displayMonth],
  );

  const monthLabel = useMemo(() => {
    const date = new Date(displayYear, displayMonth, 1);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, [displayYear, displayMonth]);

  const now = new Date();
  const rightDisabled =
    displayYear > now.getFullYear() ||
    (displayYear === now.getFullYear() && displayMonth >= now.getMonth());

  const navigateMonth = useCallback(
    (offset: number) => {
      const next = getShiftedMonth(displayYear, displayMonth, offset);
      const nextDate = getClampedDateForMonth(
        selectedDate,
        next.year,
        next.month,
      );
      setDisplayYear(next.year);
      setDisplayMonth(next.month);
      onDateSelect(nextDate > getTodayDate() ? getTodayDate() : nextDate);
    },
    [displayMonth, displayYear, onDateSelect, selectedDate],
  );

  const goPrev = useCallback(() => {
    navigateMonth(-1);
  }, [navigateMonth]);

  const goNext = useCallback(() => {
    if (!rightDisabled) navigateMonth(1);
  }, [navigateMonth, rightDisabled]);

  const handleDaySelect = useCallback(
    (day: number) => {
      onDateSelect(formatMonthDate(displayYear, displayMonth, day));
      setIsOpen(false);
    },
    [displayYear, displayMonth, onDateSelect],
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Pressable
          onPress={goPrev}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.arrow, isDarkMode && styles.arrowDark]}
        >
          <Text style={[styles.arrowText, isDarkMode && styles.arrowTextDark]}>
            {'<'}
          </Text>
        </Pressable>

        <Pressable
          onPress={toggleOpen}
          style={[styles.monthButton, isDarkMode && styles.monthButtonDark]}
        >
          <Text
            numberOfLines={1}
            style={[styles.monthLabel, isDarkMode && styles.monthLabelDark]}
          >
            {monthLabel}
          </Text>
          <Text style={[styles.chevron, isDarkMode && styles.chevronDark]}>
            {isOpen ? '\u25B2' : '\u25BC'}
          </Text>
        </Pressable>

        <Pressable
          onPress={goNext}
          disabled={rightDisabled}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[
            styles.arrow,
            isDarkMode && styles.arrowDark,
            rightDisabled && styles.arrowDisabled,
          ]}
        >
          <Text
            style={[
              styles.arrowText,
              isDarkMode && styles.arrowTextDark,
              rightDisabled && styles.arrowDisabledText,
            ]}
          >
            {'>'}
          </Text>
        </Pressable>
      </View>

      {isOpen && (
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={close} />
          <View
            style={[
              styles.dropdown,
              isDarkMode && styles.dropdownDark,
            ]}
          >
            <View style={styles.dayHeadersRow}>
              {DAY_HEADERS.map((letter, index) => (
                <View key={`${letter}-${index}`} style={styles.dayHeaderCell}>
                  <Text
                    style={[
                      styles.dayHeaderText,
                      isDarkMode && styles.dayHeaderTextDark,
                    ]}
                  >
                    {letter}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.grid}>
              {days.map((day, i) => {
                if (day === null) {
                  return (
                    <View key={`empty-${i}`} style={styles.dayCell} />
                  );
                }

                const dateStr = formatMonthDate(
                  displayYear,
                  displayMonth,
                  day,
                );
                const future = isFutureDate(
                  displayYear,
                  displayMonth,
                  day,
                );
                const isToday = isTodayDate(
                  displayYear,
                  displayMonth,
                  day,
                );
                const isSelected = dateStr === selectedDate;
                const hasLogged = loggedDates.has(dateStr);

                return (
                  <Pressable
                    key={dateStr}
                    onPress={() =>
                      !future && handleDaySelect(day)
                    }
                    disabled={future}
                    style={styles.dayCell}
                  >
                    <View
                      style={[
                        styles.dayPill,
                        isSelected && {
                          backgroundColor: accentColor,
                        },
                        isToday &&
                          !isSelected &&
                          styles.todayRing,
                        isToday &&
                          !isSelected && {
                            borderColor: accentColor,
                          },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isDarkMode && styles.dayTextDark,
                          future && styles.dimmed,
                          isSelected &&
                            styles.dayTextSelected,
                          isToday &&
                            !isSelected && {
                              color: accentColor,
                              fontWeight: '700',
                            },
                        ]}
                      >
                        {day}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.dot,
                        !hasLogged && styles.dotHidden,
                      ]}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    position: 'relative',
    zIndex: 20,
  },
  header: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowDark: {
    backgroundColor: '#2C2C2E',
  },
  arrowDisabled: {
    opacity: 0.3,
  },
  arrowDisabledText: {
    color: '#CCCCCC',
  },
  arrowText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
  },
  arrowTextDark: {
    color: '#0A84FF',
  },
  monthButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
  },
  monthButtonDark: {
    backgroundColor: '#2C2C2E',
  },
  monthLabel: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
  },
  monthLabelDark: {
    color: '#FFFFFF',
  },
  chevron: {
    fontSize: 12,
    lineHeight: 16,
    color: '#8E8E93',
  },
  chevronDark: {
    color: '#8E8E93',
  },
  overlay: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    height: 480,
    zIndex: 30,
    elevation: 30,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    padding: 12,
    zIndex: 31,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dropdownDark: {
    backgroundColor: '#1C1C1E',
    borderColor: '#333333',
    shadowOpacity: 0,
    elevation: 0,
  },
  dayHeadersRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayHeaderCell: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayHeaderText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8E8E93',
  },
  dayHeaderTextDark: {
    color: '#8E8E93',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: 4,
    minHeight: 40,
    justifyContent: 'center',
  },
  dayPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  dayTextDark: {
    color: '#FFFFFF',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  todayRing: {
    borderWidth: 1.5,
  },
  dimmed: {
    opacity: 0.3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#30D158',
    marginTop: 2,
  },
  dotHidden: {
    backgroundColor: 'transparent',
  },
});
