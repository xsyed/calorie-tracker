import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';

import { useAuth } from '../auth';
import { insertUser } from '../database';
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

export default function OnboardingScreen() {
  const auth = useAuth();
  const route = useRoute();
  const params =
    (route.params as { onOnboardingComplete?: () => void } | undefined) ?? {};
  const isDarkMode = useColorScheme() === 'dark';

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
        contentContainerStyle={styles.scrollContent}
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

          {step !== 'safety_gate' && step !== 'summary' && (
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
          )}
        </View>
      </ScrollView>
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
    justifyContent: 'space-between',
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
    marginTop: 24,
  },
  navButton: {
    flex: 1,
  },
  navButtonPlaceholder: {
    flex: 1,
  },
});
