import { Text, View } from 'react-native';

import { sharedStyles as s } from './sharedStyles';
import OptionSelectGroup from './OptionSelectGroup';

interface GoalStepProps {
  value: 'lose' | 'maintain' | 'gain' | undefined;
  onChange: (value: 'lose' | 'maintain' | 'gain') => void;
  error: string | null;
  isDarkMode: boolean;
}

const OPTIONS = [
  { label: 'Lose', value: 'lose' as const },
  { label: 'Maintain', value: 'maintain' as const },
  { label: 'Gain', value: 'gain' as const },
];

export default function GoalStep({ value, onChange, error, isDarkMode }: GoalStepProps) {
  return (
    <View>
      <Text style={[s.label, isDarkMode && s.labelDark]}>What is your goal?</Text>
      <OptionSelectGroup
        options={OPTIONS}
        value={value}
        onChange={onChange}
        isDarkMode={isDarkMode}
        direction="column"
        error={error}
      />
    </View>
  );
}
