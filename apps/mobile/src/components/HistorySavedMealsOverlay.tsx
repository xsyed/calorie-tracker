import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  createFoodEntryFromHistoryEntry,
  createFoodEntryFromSavedMeal,
  deleteSavedMeal,
  getCompletedHistoryEntries,
  getSavedMeals,
  saveFoodEntryAsSavedMeal,
} from '../database';
import type { FoodEntryWithItems, SavedMealWithItems } from '../database';
import {
  buildHistorySections,
  HistoryContent,
  SavedMealsContent,
} from './HistorySavedMealsOverlayContent';
import SaveMealPrompt from './SaveMealPrompt';

interface HistorySavedMealsOverlayProps {
  visible: boolean;
  userId: string | null;
  selectedDate: string;
  onDismiss: () => void;
  onApplied: () => void;
}

type Tab = 'history' | 'saved';

export default function HistorySavedMealsOverlay({
  visible,
  userId,
  selectedDate,
  onDismiss,
  onApplied,
}: HistorySavedMealsOverlayProps) {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const slide = useRef(new Animated.Value(1)).current;
  const [activeTab, setActiveTab] = useState<Tab>('history');
  const [history, setHistory] = useState<FoodEntryWithItems[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMealWithItems[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [savedMealError, setSavedMealError] = useState<string | null>(null);
  const [deletingSavedMealId, setDeletingSavedMealId] = useState<string | null>(null);
  const [savePromptEntry, setSavePromptEntry] = useState<FoodEntryWithItems | null>(null);
  const [saveMealName, setSaveMealName] = useState('');
  const [isCreatingSavedMeal, setIsCreatingSavedMeal] = useState(false);

  const sections = useMemo(() => buildHistorySections(history), [history]);
  const isBusy = applyingId !== null || deletingSavedMealId !== null || isCreatingSavedMeal;

  const loadSavedMeals = useCallback(async () => {
    if (userId === null) {
      setSavedMeals([]);
      return;
    }

    const meals = await getSavedMeals(userId);
    setSavedMeals(meals);
  }, [userId]);

  const loadHistory = useCallback(async () => {
    if (userId === null) {
      setHistory([]);
      setSavedMeals([]);
      setLoadError(null);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const [entries, meals] = await Promise.all([
        getCompletedHistoryEntries(userId),
        getSavedMeals(userId),
      ]);
      setHistory(entries);
      setSavedMeals(meals);
    } catch {
      setHistory([]);
      setSavedMeals([]);
      setLoadError('Could not load history.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!visible) return;

    setActiveTab('history');
    setApplyError(null);
    setSavedMealError(null);
    setApplyingId(null);
    setDeletingSavedMealId(null);
    setSavePromptEntry(null);
    setSaveMealName('');
    void loadHistory();
    slide.setValue(1);
    Animated.timing(slide, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [loadHistory, slide, visible]);

  const handleDismiss = useCallback(() => {
    if (isBusy) return;

    Animated.timing(slide, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onDismiss();
    });
  }, [isBusy, onDismiss, slide]);

  const handleApplyHistory = useCallback(async (entry: FoodEntryWithItems) => {
    if (userId === null || isBusy) return;

    setApplyingId(entry.entry.id);
    setApplyError(null);
    try {
      await createFoodEntryFromHistoryEntry({
        userId,
        sourceFoodEntryId: entry.entry.id,
        date: selectedDate,
      });
      onApplied();
    } catch {
      setApplyError('Could not add history entry.');
      setApplyingId(null);
    }
  }, [isBusy, onApplied, selectedDate, userId]);

  const handleApplySavedMeal = useCallback(async (meal: SavedMealWithItems) => {
    if (userId === null || isBusy) return;

    setApplyingId(meal.savedMeal.id);
    setApplyError(null);
    try {
      await createFoodEntryFromSavedMeal({
        userId,
        savedMealId: meal.savedMeal.id,
        date: selectedDate,
      });
      onApplied();
    } catch {
      setApplyError('Could not add saved meal.');
      setApplyingId(null);
    }
  }, [isBusy, onApplied, selectedDate, userId]);

  const handleOpenSavePrompt = useCallback((entry: FoodEntryWithItems) => {
    if (isBusy) return;

    setSavedMealError(null);
    setSaveMealName('');
    setSavePromptEntry(entry);
  }, [isBusy]);

  const handleCancelSavePrompt = useCallback(() => {
    if (isCreatingSavedMeal) return;

    setSavePromptEntry(null);
    setSaveMealName('');
  }, [isCreatingSavedMeal]);

  const handleChangeSaveMealName = useCallback((name: string) => {
    setSavedMealError(null);
    setSaveMealName(name);
  }, []);

  const handleCreateSavedMeal = useCallback(async () => {
    const name = saveMealName.trim();
    if (userId === null || savePromptEntry === null || name.length === 0) return;

    setIsCreatingSavedMeal(true);
    setSavedMealError(null);
    try {
      await saveFoodEntryAsSavedMeal({
        userId,
        foodEntryId: savePromptEntry.entry.id,
        name,
      });
      await loadSavedMeals();
      setSavePromptEntry(null);
      setSaveMealName('');
    } catch {
      setSavedMealError('Could not save meal.');
    } finally {
      setIsCreatingSavedMeal(false);
    }
  }, [loadSavedMeals, saveMealName, savePromptEntry, userId]);

  const handleDeleteSavedMeal = useCallback(async (meal: SavedMealWithItems) => {
    if (userId === null || isBusy) return;

    setDeletingSavedMealId(meal.savedMeal.id);
    setSavedMealError(null);
    try {
      await deleteSavedMeal(userId, meal.savedMeal.id);
      await loadSavedMeals();
    } catch {
      setSavedMealError('Could not delete saved meal.');
    } finally {
      setDeletingSavedMealId(null);
    }
  }, [isBusy, loadSavedMeals, userId]);

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, height],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={handleDismiss} />
        <Animated.View
          style={[
            styles.sheet,
            isDark && styles.sheetDark,
            {
              paddingBottom: Math.max(insets.bottom, 12),
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={[styles.title, isDark && styles.titleDark]}>
              History
            </Text>
            <Pressable onPress={handleDismiss} hitSlop={8}>
              <Text style={[styles.closeText, isDark && styles.closeTextDark]}>
                Close
              </Text>
            </Pressable>
          </View>
          <View style={[styles.tabs, isDark && styles.tabsDark]}>
            <TabButton
              label="History"
              isActive={activeTab === 'history'}
              isDark={isDark}
              onPress={() => setActiveTab('history')}
            />
            <TabButton
              label="Saved Meals"
              isActive={activeTab === 'saved'}
              isDark={isDark}
              onPress={() => setActiveTab('saved')}
            />
          </View>
          {activeTab === 'history' ? (
            <HistoryContent
              sections={sections}
              isLoading={isLoading}
              loadError={loadError}
              isDark={isDark}
              isBusy={isBusy}
              onApply={handleApplyHistory}
              onSaveAsMeal={handleOpenSavePrompt}
            />
          ) : (
            <SavedMealsContent
              meals={savedMeals}
              isLoading={isLoading}
              loadError={loadError}
              isDark={isDark}
              isBusy={isBusy}
              deletingId={deletingSavedMealId}
              onApply={handleApplySavedMeal}
              onDelete={handleDeleteSavedMeal}
            />
          )}
          {applyError !== null && (
            <Text style={[styles.applyError, isDark && styles.applyErrorDark]}>
              {applyError}
            </Text>
          )}
          {savedMealError !== null && (
            <Text style={[styles.applyError, isDark && styles.applyErrorDark]}>
              {savedMealError}
            </Text>
          )}
        </Animated.View>
        {savePromptEntry !== null && (
          <SaveMealPrompt
            isDark={isDark}
            name={saveMealName}
            error={savedMealError}
            isSaving={isCreatingSavedMeal}
            onChangeName={handleChangeSaveMealName}
            onCancel={handleCancelSavePrompt}
            onSave={handleCreateSavedMeal}
          />
        )}
      </View>
    </Modal>
  );
}

function TabButton({
  label,
  isActive,
  isDark,
  onPress,
}: {
  label: string;
  isActive: boolean;
  isDark: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tabButton,
        isActive && styles.tabButtonActive,
        isDark && styles.tabButtonDark,
        isActive && isDark && styles.tabButtonActiveDark,
      ]}
    >
      <Text
        style={[
          styles.tabText,
          isDark && styles.tabTextDark,
          isActive && styles.tabTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  sheet: {
    maxHeight: '82%',
    minHeight: '55%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  sheetDark: {
    backgroundColor: '#1C1C1E',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    marginTop: 8,
    borderRadius: 2,
    backgroundColor: '#D1D1D6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
  closeTextDark: {
    color: '#0A84FF',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 4,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
  },
  tabsDark: {
    backgroundColor: '#2C2C2E',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  tabButtonDark: {
    backgroundColor: '#2C2C2E',
  },
  tabButtonActiveDark: {
    backgroundColor: '#3A3A3C',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  tabTextDark: {
    color: '#C7C7CC',
  },
  tabTextActive: {
    color: '#007AFF',
  },
  applyError: {
    paddingHorizontal: 16,
    paddingTop: 8,
    fontSize: 14,
    color: '#CC0000',
    textAlign: 'center',
  },
  applyErrorDark: {
    color: '#FF4444',
  },
});
