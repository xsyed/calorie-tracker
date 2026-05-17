import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { FlatList, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { CalendarList } from 'react-native-calendars';
import type { DateData } from 'react-native-calendars';

const PAST_MONTH_RANGE = 60;
const MONTH_TAB_WIDTH = 104;
const VISIBLE_DAY_COUNT = 7;
const DATE_LIST_GAP = 6;
const DATE_LIST_HORIZONTAL_PADDING = 8;

interface HomeDateCalendarProps {
  selectedDate: string;
  loggedDates: Set<string>;
  onDateSelect: (date: string) => void;
  onVisibleMonthChange: (date: string) => void;
}

interface CalendarListHandle {
  scrollToMonth: (date: string) => void;
}

interface DateItem {
  date: string;
  day: string;
  weekday: string;
}

interface MarkedDate {
  dotColor?: string;
  marked?: boolean;
  selected?: boolean;
  selectedColor?: string;
  selectedDotColor?: string;
  selectedTextColor?: string;
}

interface MonthItem {
  id: string;
  label: string;
  date: string;
}

function getTodayDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getDateAtLocalMidnight(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

function getMonthId(date: string): string {
  return date.slice(0, 7);
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function toDateString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatHeaderLabel(date: string): string {
  if (date === getTodayDate()) return 'Today';

  return getDateAtLocalMidnight(date).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function formatMonthTabLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function formatWeekday(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1);
}

function buildDateItems(todayDate: string): DateItem[] {
  const today = getDateAtLocalMidnight(todayDate);
  const start = getMonthStart(today);
  start.setMonth(start.getMonth() - (PAST_MONTH_RANGE - 1));

  const items: DateItem[] = [];
  for (let date = start; date <= today; date.setDate(date.getDate() + 1)) {
    const itemDate = new Date(date);
    items.push({
      date: toDateString(itemDate),
      day: String(itemDate.getDate()),
      weekday: formatWeekday(itemDate),
    });
  }

  return items;
}

function buildMonthItems(todayDate: string): MonthItem[] {
  const today = getDateAtLocalMidnight(todayDate);
  const start = getMonthStart(today);
  start.setMonth(start.getMonth() - (PAST_MONTH_RANGE - 1));

  return Array.from({ length: PAST_MONTH_RANGE }, (_, index) => {
    const month = new Date(start);
    month.setMonth(start.getMonth() + index);
    const id = toDateString(month).slice(0, 7);

    return {
      id,
      date: `${id}-01`,
      label: formatMonthTabLabel(month),
    };
  });
}

function getMonthIndex(months: MonthItem[], monthId: string): number {
  return Math.max(0, months.findIndex((month) => month.id === monthId));
}

export default function HomeDateCalendar({
  selectedDate,
  loggedDates,
  onDateSelect,
  onVisibleMonthChange,
}: HomeDateCalendarProps) {
  const isDarkMode = useColorScheme() === 'dark';
  const accentColor = isDarkMode ? '#0A84FF' : '#007AFF';
  const todayDate = getTodayDate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(getMonthId(selectedDate));
  const [calendarWidth, setCalendarWidth] = useState(320);
  const calendarRef = useRef<CalendarListHandle | null>(null);
  const dateListRef = useRef<FlatList<DateItem>>(null);
  const monthListRef = useRef<FlatList<MonthItem>>(null);

  const dateItems = useMemo(() => buildDateItems(todayDate), [todayDate]);
  const monthItems = useMemo(() => buildMonthItems(todayDate), [todayDate]);
  const label = formatHeaderLabel(selectedDate);
  const dateCellWidth = Math.max(
    34,
    (calendarWidth - DATE_LIST_HORIZONTAL_PADDING * 2 - DATE_LIST_GAP * (VISIBLE_DAY_COUNT - 1)) / VISIBLE_DAY_COUNT,
  );
  const selectedDateIndex = Math.max(0, dateItems.findIndex((item) => item.date === selectedDate));
  const monthIndex = getMonthIndex(monthItems, visibleMonth);

  const scrollDateStripToSelectedDate = useCallback((animated: boolean) => {
    dateListRef.current?.scrollToIndex({
      animated,
      index: selectedDateIndex,
      viewPosition: 0.5,
    });
  }, [selectedDateIndex]);

  useEffect(() => {
    setVisibleMonth(getMonthId(selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    if (isExpanded) {
      monthListRef.current?.scrollToIndex({
        animated: true,
        index: monthIndex,
        viewPosition: 0.5,
      });
    }
  }, [isExpanded, monthIndex]);

  useEffect(() => {
    if (!isExpanded) {
      requestAnimationFrame(() => scrollDateStripToSelectedDate(true));
    }
  }, [dateCellWidth, isExpanded, scrollDateStripToSelectedDate]);

  const markedDates = useMemo(() => {
    const dates: Record<string, MarkedDate> = {};
    loggedDates.forEach((date) => {
      dates[date] = {
        dotColor: '#30D158',
        marked: true,
        selectedDotColor: '#FFFFFF',
      };
    });

    dates[selectedDate] = {
      ...dates[selectedDate],
      selected: true,
      selectedColor: accentColor,
      selectedTextColor: '#FFFFFF',
    };

    return dates;
  }, [accentColor, loggedDates, selectedDate]);

  const calendarTheme = useMemo(
    () => ({
      calendarBackground: isDarkMode ? '#000000' : '#FFFFFF',
      dayTextColor: isDarkMode ? '#FFFFFF' : '#000000',
      dotColor: '#30D158',
      monthTextColor: isDarkMode ? '#FFFFFF' : '#000000',
      selectedDayBackgroundColor: accentColor,
      selectedDayTextColor: '#FFFFFF',
      textDayFontWeight: '600' as const,
      textDisabledColor: isDarkMode ? '#4A4A4C' : '#C7C7CC',
      textMonthFontWeight: '700' as const,
      textSectionTitleColor: '#8E8E93',
      todayTextColor: accentColor,
    }),
    [accentColor, isDarkMode],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const width = Math.floor(event.nativeEvent.layout.width);
    if (width > 0 && width !== calendarWidth) {
      setCalendarWidth(width);
    }
  };

  const handleDatePress = (date: string) => {
    if (date <= todayDate && date !== selectedDate) {
      onDateSelect(date);
    }
  };

  const handleMonthChange = (date: DateData) => {
    const monthId = getMonthId(date.dateString);
    setVisibleMonth(monthId);
    onVisibleMonthChange(date.dateString);
  };

  const handleMonthPress = (month: MonthItem) => {
    setVisibleMonth(month.id);
    onVisibleMonthChange(month.date);
    requestAnimationFrame(() => {
      calendarRef.current?.scrollToMonth(month.date);
    });
  };

  const renderDateItem = ({ item }: { item: DateItem }) => {
    const isSelected = item.date === selectedDate;
    const isLogged = loggedDates.has(item.date);

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        onPress={() => handleDatePress(item.date)}
        style={[
          styles.dateCell,
          { width: dateCellWidth },
          isDarkMode && styles.dateCellDark,
          isSelected && { backgroundColor: accentColor },
        ]}
      >
        <Text style={[styles.weekdayText, isDarkMode && styles.weekdayTextDark, isSelected && styles.selectedText]}>
          {item.weekday}
        </Text>
        <Text style={[styles.dayText, isDarkMode && styles.dayTextDark, isSelected && styles.selectedText]}>
          {item.day}
        </Text>
        <View style={[styles.dot, isLogged && styles.loggedDot, isSelected && styles.selectedDot]} />
      </Pressable>
    );
  };

  const renderMonthItem = ({ item }: { item: MonthItem }) => {
    const isVisible = item.id === visibleMonth;

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: isVisible }}
        onPress={() => handleMonthPress(item)}
        style={[
          styles.monthTab,
          isDarkMode && styles.monthTabDark,
          isVisible && { backgroundColor: accentColor, borderColor: accentColor },
        ]}
      >
        <Text style={[styles.monthTabText, isDarkMode && styles.monthTabTextDark, isVisible && styles.selectedText]}>
          {item.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <Pressable
        accessibilityLabel={isExpanded ? 'Collapse calendar' : 'Expand calendar'}
        accessibilityRole="button"
        onPress={() => setIsExpanded((value) => !value)}
        style={styles.headerButton}
      >
        <Text style={[styles.headerLabel, isDarkMode && styles.headerLabelDark]}>{label}</Text>
        <View
          style={[
            styles.chevron,
            isExpanded ? styles.chevronUp : styles.chevronDown,
            isDarkMode && (isExpanded ? styles.chevronUpDark : styles.chevronDownDark),
          ]}
        />
      </Pressable>

      {isExpanded ? (
        <View>
          <CalendarList
            ref={calendarRef}
            calendarWidth={calendarWidth}
            current={selectedDate}
            animateScroll
            firstDay={0}
            futureScrollRange={0}
            hideArrows
            horizontal
            markedDates={markedDates}
            maxDate={todayDate}
            onDayPress={(date) => handleDatePress(date.dateString)}
            onMonthChange={handleMonthChange}
            pagingEnabled
            pastScrollRange={PAST_MONTH_RANGE - 1}
            renderHeader={() => null}
            staticHeader
            theme={calendarTheme}
          />
          <FlatList
            ref={monthListRef}
            contentContainerStyle={styles.monthTabs}
            data={monthItems}
            getItemLayout={(_, index) => ({
              length: MONTH_TAB_WIDTH,
              offset: MONTH_TAB_WIDTH * index,
              index,
            })}
            horizontal
            keyExtractor={(item) => item.id}
            onScrollToIndexFailed={() => undefined}
            renderItem={renderMonthItem}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      ) : (
        <FlatList
          ref={dateListRef}
          contentContainerStyle={styles.dateList}
          data={dateItems}
          getItemLayout={(_, index) => ({
            length: dateCellWidth + DATE_LIST_GAP,
            offset: (dateCellWidth + DATE_LIST_GAP) * index,
            index,
          })}
          horizontal
          initialScrollIndex={selectedDateIndex}
          keyExtractor={(item) => item.date}
          onContentSizeChange={() => scrollDateStripToSelectedDate(false)}
          onScrollToIndexFailed={() => requestAnimationFrame(() => scrollDateStripToSelectedDate(false))}
          renderItem={renderDateItem}
          showsHorizontalScrollIndicator={false}
          style={styles.dateStrip}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'visible',
    width: '100%',
  },
  headerButton: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
    minHeight: 28,
    justifyContent: 'center',
    paddingLeft: 16,
    paddingRight: 104,
    paddingBottom: 2,
  },
  headerLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  headerLabelDark: {
    color: '#FFFFFF',
  },
  chevron: {
    width: 0,
    height: 0,
    marginTop: 7,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  chevronDown: {
    borderTopWidth: 7,
    borderTopColor: '#000000',
  },
  chevronDownDark: {
    borderTopColor: '#FFFFFF',
  },
  chevronUp: {
    borderBottomWidth: 7,
    borderBottomColor: '#000000',
  },
  chevronUpDark: {
    borderBottomColor: '#FFFFFF',
  },
  dateList: {
    gap: DATE_LIST_GAP,
    paddingHorizontal: DATE_LIST_HORIZONTAL_PADDING,
    paddingTop: 6,
    paddingBottom: 6,
  },
  dateCell: {
    height: 48,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
  },
  dateStrip: {
    flexGrow: 0,
    height: 56,
  },
  dateCellDark: {
    backgroundColor: '#1C1C1E',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  weekdayText: {
    marginBottom: 3,
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8E93',
  },
  weekdayTextDark: {
    color: '#8E8E93',
  },
  dayTextDark: {
    color: '#FFFFFF',
  },
  selectedText: {
    color: '#FFFFFF',
  },
  dot: {
    width: 4,
    height: 4,
    marginTop: 2,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  loggedDot: {
    backgroundColor: '#30D158',
  },
  selectedDot: {
    backgroundColor: '#FFFFFF',
  },
  monthTabs: {
    gap: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  monthTab: {
    width: 96,
    height: 34,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  monthTabDark: {
    borderColor: '#3A3A3C',
    backgroundColor: '#1C1C1E',
  },
  monthTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  monthTabTextDark: {
    color: '#FFFFFF',
  },
});
