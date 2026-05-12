import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, useColorScheme, View } from 'react-native';

interface WaveformIndicatorProps {
  isActive: boolean;
}

const BAR_COUNT = 5;
const BAR_WIDTH = 3;
const BAR_MAX_HEIGHT = 16;
const BAR_MIN_HEIGHT = 4;

export default function WaveformIndicator({
  isActive,
}: WaveformIndicatorProps) {
  const isDarkMode = useColorScheme() === 'dark';
  const animValues = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(BAR_MIN_HEIGHT)),
  ).current;

  useEffect(() => {
    if (!isActive) {
      animValues.forEach((a) => a.setValue(BAR_MIN_HEIGHT));
      return;
    }

    const animations = animValues.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: BAR_MAX_HEIGHT,
            duration: 350 + i * 70,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: BAR_MIN_HEIGHT,
            duration: 350 + i * 70,
            useNativeDriver: false,
          }),
        ]),
      ),
    );

    animations.forEach((a) => a.start());

    return () => {
      animations.forEach((a) => a.stop());
      animValues.forEach((a) => a.setValue(BAR_MIN_HEIGHT));
    };
  }, [isActive, animValues]);

  const barColor = isDarkMode ? '#FFFFFF' : '#000000';

  return (
    <View style={styles.container}>
      {animValues.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              height: anim,
              backgroundColor: barColor,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: 1.5,
  },
});
