import NumericField from './NumericField';

interface WeightStepProps {
  value: number | undefined;
  onChange: (value: number) => void;
  error: string | null;
  isDarkMode: boolean;
}

export default function WeightStep(props: WeightStepProps) {
  return (
    <NumericField
      label="What is your current weight?"
      placeholder="70"
      unit="kg"
      accessibilityLabel="Current weight in kilograms"
      {...props}
    />
  );
}
