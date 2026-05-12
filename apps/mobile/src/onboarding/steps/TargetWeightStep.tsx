import NumericField from './NumericField';

interface TargetWeightStepProps {
  value: number | undefined;
  onChange: (value: number) => void;
  error: string | null;
  isDarkMode: boolean;
  goal: 'lose' | 'gain';
}

export default function TargetWeightStep({ goal, ...props }: TargetWeightStepProps) {
  const hint =
    goal === 'lose'
      ? 'Must be lower than current weight'
      : 'Must be higher than current weight';

  return (
    <NumericField
      label="What is your target weight?"
      placeholder={goal === 'lose' ? '65' : '75'}
      unit="kg"
      accessibilityLabel="Target weight in kilograms"
      hint={hint}
      {...props}
    />
  );
}
