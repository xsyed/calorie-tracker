import NumericField from './NumericField';

interface HeightStepProps {
  value: number | undefined;
  onChange: (value: number) => void;
  error: string | null;
  isDarkMode: boolean;
}

export default function HeightStep(props: HeightStepProps) {
  return (
    <NumericField
      label="What is your height?"
      placeholder="175"
      unit="cm"
      accessibilityLabel="Height in centimeters"
      {...props}
    />
  );
}
