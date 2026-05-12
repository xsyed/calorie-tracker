import { Text, View } from 'react-native';

import { sharedStyles as s } from './sharedStyles';
import OptionSelectGroup from './OptionSelectGroup';

interface GenderStepProps {
  value: 'male' | 'female' | undefined;
  onChange: (value: 'male' | 'female') => void;
  error: string | null;
  isDarkMode: boolean;
}

const OPTIONS = [
  { label: 'Male', value: 'male' as const },
  { label: 'Female', value: 'female' as const },
];

export default function GenderStep({ value, onChange, error, isDarkMode }: GenderStepProps) {
  return (
    <View>
      <Text style={[s.label, isDarkMode && s.labelDark]}>
        What is your gender?
      </Text>
      <OptionSelectGroup
        options={OPTIONS}
        value={value}
        onChange={onChange}
        isDarkMode={isDarkMode}
        direction="row"
        error={error}
      />
    </View>
  );
}
