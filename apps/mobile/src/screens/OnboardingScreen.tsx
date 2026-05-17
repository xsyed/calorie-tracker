import { useCallback, useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth';
import { insertUser } from '../database';
import type { RootStackParamList } from '../navigation/types';
import { useOnboardingForm } from '../onboarding';
import type { SafetyGateResult } from '../onboarding';
import {
  AgeStep,
  GenderStep,
  GoalStep,
  HeightStep,
  SafetyGateStep,
  SummaryStep,
  TargetWeightStep,
  TimeframeStep,
  WeightStep,
} from '../onboarding/steps';
import { sharedStyles as s } from '../onboarding/steps/sharedStyles';

const NAV_HEIGHT = 93;
const KEYBOARD_TOP_CLEARANCE = 44;

export default function OnboardingScreen() {
  const auth = useAuth();
  const route = useRoute();
  const params = (route.params as RootStackParamList['Onboarding']) ?? {};
  const isDarkMode = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();

  const {
    step,
    stepIndex,
    totalSteps,
    formData,
    errors,
    calculationResults,
    safetyGateResult,
    canAdvance,
    setField,
    goNext,
    goBack,
    acceptSafeTimeframe,
    reviseGoal,
  } = useOnboardingForm();

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [keyboardBottomInset, setKeyboardBottomInset] = useState(0);
  const showStepNavigation = step !== 'safety_gate' && step !== 'summary';
  const navBottom = keyboardBottomInset > 0 ? keyboardBottomInset + KEYBOARD_TOP_CLEARANCE : 0;

  const resetKeyboardBottomInset = useCallback(() => {
    setKeyboardBottomInset(0);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardBottomInset(Math.max(0, event.endCoordinates.height - insets.bottom));
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', resetKeyboardBottomInset);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [insets.bottom, resetKeyboardBottomInset]);

  useFocusEffect(
    useCallback(() => {
      resetKeyboardBottomInset();
    }, [resetKeyboardBottomInset]),
  );

  const handleConfirm = useCallback(async () => {
    if (!calculationResults || !auth.user) return;
    setSaving(true);
    setSaveError(null);
    try {
      await insertUser({
        firebase_uid: auth.user.uid,
        gender: calculationResults.gender,
        height_cm: calculationResults.height_cm,
        current_weight_kg: calculationResults.current_weight_kg,
        age: calculationResults.age,
        goal: calculationResults.goal,
        target_weight_kg:
          calculationResults.goal === 'maintain'
            ? null
            : calculationResults.target_weight_kg,
        timeframe_days: calculationResults.timeframe_days,
        daily_target_calories: calculationResults.daily_target_calories,
        protein_g: calculationResults.protein_g,
        carbs_g: calculationResults.carbs_g,
        fat_g: calculationResults.fat_g,
        activity_multiplier: calculationResults.activity_multiplier,
      });
      params.onOnboardingComplete?.();
    } catch {
      setSaveError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }, [calculationResults, auth.user, params.onOnboardingComplete]);

  const renderStepContent = () => {
    switch (step) {
      case 'gender':
        return (
          <GenderStep
            value={formData.gender}
            onChange={(v) => setField('gender', v)}
            error={errors.gender ?? null}
            isDarkMode={isDarkMode}
          />
        );
      case 'age':
        return (
          <AgeStep
            value={formData.age}
            onChange={(v) => setField('age', v)}
            error={errors.age ?? null}
            isDarkMode={isDarkMode}
          />
        );
      case 'height_cm':
        return (
          <HeightStep
            value={formData.height_cm}
            onChange={(v) => setField('height_cm', v)}
            error={errors.height_cm ?? null}
            isDarkMode={isDarkMode}
          />
        );
      case 'current_weight_kg':
        return (
          <WeightStep
            value={formData.current_weight_kg}
            onChange={(v) => setField('current_weight_kg', v)}
            error={errors.current_weight_kg ?? null}
            isDarkMode={isDarkMode}
          />
        );
      case 'goal':
        return (
          <GoalStep
            value={formData.goal}
            onChange={(v) => setField('goal', v)}
            error={errors.goal ?? null}
            isDarkMode={isDarkMode}
          />
        );
      case 'target_weight_kg':
        return (
          <TargetWeightStep
            value={formData.target_weight_kg}
            onChange={(v) => setField('target_weight_kg', v)}
            error={errors.target_weight_kg ?? null}
            isDarkMode={isDarkMode}
            goal={formData.goal as 'lose' | 'gain'}
          />
        );
      case 'timeframe':
        return (
          <TimeframeStep
            value={formData.timeframe_days}
            onChange={(v) => setField('timeframe_days', v)}
            error={errors.timeframe_days ?? null}
            isDarkMode={isDarkMode}
          />
        );
      case 'safety_gate':
        return (
          <SafetyGateStep
            result={safetyGateResult as SafetyGateResult & { passed: false }}
            onAccept={acceptSafeTimeframe}
            onRevise={reviseGoal}
            isDarkMode={isDarkMode}
          />
        );
      case 'summary':
        return (
          <SummaryStep
            results={calculationResults!}
            onConfirm={handleConfirm}
            onBack={goBack}
            isSaving={saving}
            saveError={saveError}
            isDarkMode={isDarkMode}
          />
        );
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, isDarkMode && styles.containerDark]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          showStepNavigation && { paddingBottom: NAV_HEIGHT + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inner}>
          <View style={styles.stepContent}>
            <Text
              style={[styles.progress, isDarkMode && styles.progressDark]}
              accessibilityLabel={`Step ${stepIndex + 1} of ${totalSteps}`}
            >
              Step {stepIndex + 1} of {totalSteps}
            </Text>

            <View style={styles.stepBody}>{renderStepContent()}</View>
          </View>
        </View>
      </ScrollView>
      {showStepNavigation && (
        <View
          style={[
            styles.navWrapper,
            isDarkMode && styles.navWrapperDark,
            {
              bottom: navBottom,
              paddingBottom: 24 + insets.bottom,
            },
          ]}
        >
          <View style={styles.navRow}>
            {step !== 'gender' ? (
              <Pressable
                onPress={goBack}
                style={[
                  s.button,
                  styles.navButton,
                  isDarkMode ? s.buttonSecondaryDark : s.buttonSecondaryLight,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Text style={[s.buttonText, isDarkMode && s.buttonTextDark]}>
                  Back
                </Text>
              </Pressable>
            ) : (
              <View style={styles.navButtonPlaceholder} />
            )}
            <Pressable
              onPress={goNext}
              disabled={!canAdvance}
              style={[
                s.button,
                styles.navButton,
                s.buttonPrimary,
                isDarkMode ? s.buttonPrimaryDark : s.buttonPrimaryLight,
                !canAdvance && s.buttonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Next"
            >
              <Text
                style={[
                  s.buttonText,
                  isDarkMode ? s.buttonTextSecondaryDark : s.buttonTextSecondaryLight,
                ]}
              >
                Next
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  scrollContent: {
    flexGrow: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
  },
  stepContent: {
    flex: 1,
  },
  progress: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999999',
    marginBottom: 32,
  },
  progressDark: {
    color: '#666666',
  },
  stepBody: {
    flex: 1,
  },
  navRow: {
    flexDirection: 'row',
    gap: 12,
  },
  navWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  navWrapperDark: {
    borderTopColor: '#1C1C1E',
    backgroundColor: '#000000',
  },
  navButton: {
    flex: 1,
  },
  navButtonPlaceholder: {
    flex: 1,
  },
});
