import { useMemo } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import { CalendarProvider, ExpandableCalendar } from 'react-native-calendars';
import type { DateData } from 'react-native-calendars';

interface HomeDateCalendarProps {
  selectedDate: string;
  loggedDates: Set<string>;
  onDateSelect: (date: string) => void;
  onVisibleMonthChange: (date: string) => void;
}

interface MarkedDate {
  dotColor?: string;
  marked?: boolean;
  selected?: boolean;
  selectedColor?: string;
  selectedDotColor?: string;
  selectedTextColor?: string;
}

function getTodayDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatHeaderLabel(date: string): string {
  if (date === getTodayDate()) return 'Today';

  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
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
  const label = formatHeaderLabel(selectedDate);

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
      arrowColor: 'transparent',
      calendarBackground: isDarkMode ? '#000000' : '#FFFFFF',
      dayTextColor: isDarkMode ? '#FFFFFF' : '#000000',
      disabledArrowColor: 'transparent',
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

  const handleDateChanged = (date: string) => {
    if (date <= todayDate && date !== selectedDate) {
      onDateSelect(date);
    }
  };

  const handleMonthChange = (date: DateData) => {
    onVisibleMonthChange(date.dateString);
  };

  return (
    <View style={styles.container}>
      <CalendarProvider
        date={selectedDate}
        onDateChanged={handleDateChanged}
        onMonthChange={handleMonthChange}
        style={styles.provider}
        theme={calendarTheme}
      >
        <ExpandableCalendar
          allowShadow={false}
          closeOnDayPress
          firstDay={0}
          hideArrows
          initialPosition={ExpandableCalendar.positions.CLOSED}
          markedDates={markedDates}
          maxDate={todayDate}
          renderHeader={() => (
            <Text style={[styles.headerLabel, isDarkMode && styles.headerLabelDark]}>
              {label}
            </Text>
          )}
          theme={calendarTheme}
        />
      </CalendarProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'visible',
  },
  provider: {
    flex: 0,
  },
  headerLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
  },
  headerLabelDark: {
    color: '#FFFFFF',
  },
});
