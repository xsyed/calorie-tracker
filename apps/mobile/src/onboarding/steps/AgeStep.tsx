import NumericField from './NumericField';

interface AgeStepProps {
  value: number | undefined;
  onChange: (value: number) => void;
  error: string | null;
  isDarkMode: boolean;
}

export default function AgeStep(props: AgeStepProps) {
  return (
    <NumericField
      label="What is your age?"
      placeholder="25"
      unit="years"
      unitMinWidth={56}
      accessibilityLabel="Age in years"
      {...props}
    />
  );
}
