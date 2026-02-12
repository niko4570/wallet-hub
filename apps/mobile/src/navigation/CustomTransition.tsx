import React from "react";
import { StyleSheet, ViewStyle } from "react-native";
import {
  StackCardInterpolationProps,
  StackNavigationProp,
} from "@react-navigation/stack";
import Animated, {
  useSharedValue,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  useAnimatedStyle,
} from "react-native-reanimated";

/**
 * Custom screen transition animation using react-native-reanimated
 */
export const customCardStyleInterpolator = ({
  current,
  layouts,
  insets,
}: StackCardInterpolationProps) => {
  const translateX = current.progress.interpolate({
    inputRange: [0, 1],
    outputRange: [layouts.screen.width, 0],
  });

  const translateY = current.progress.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  const opacity = current.progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.8, 1],
  });

  const scale = current.progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1],
  });

  return {
    cardStyle: {
      transform: [{ translateX }, { translateY }, { scale }],
      opacity,
    },
  };
};

/**
 * Custom fade-in animation for screen transitions
 */
export const fadeInCardStyleInterpolator = ({
  current,
}: StackCardInterpolationProps) => {
  const opacity = current.progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const translateY = current.progress.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  return {
    cardStyle: {
      opacity,
      transform: [{ translateY }],
    },
  };
};

/**
 * Custom slide-up animation for screen transitions
 */
export const slideUpCardStyleInterpolator = ({
  current,
  layouts,
}: StackCardInterpolationProps) => {
  const translateY = current.progress.interpolate({
    inputRange: [0, 1],
    outputRange: [layouts.screen.height, 0],
  });

  const opacity = current.progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return {
    cardStyle: {
      transform: [{ translateY }],
      opacity,
    },
  };
};

/**
 * Reanimated-based screen transition component
 */
interface ReanimatedTransitionProps {
  children: React.ReactNode;
  isVisible: boolean;
  style?: ViewStyle;
  duration?: number;
}

export const ReanimatedTransition: React.FC<ReanimatedTransitionProps> = ({
  children,
  isVisible,
  style,
  duration = 300,
}) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  const scale = useSharedValue(0.95);

  React.useEffect(() => {
    if (isVisible) {
      // Animation when screen becomes visible
      opacity.value = withTiming(1, { duration });
      translateY.value = withSpring(0, {
        damping: 15,
        stiffness: 100,
      });
      scale.value = withSpring(1, {
        damping: 15,
        stiffness: 100,
      });
    } else {
      // Animation when screen becomes hidden
      opacity.value = withTiming(0, { duration });
      translateY.value = withTiming(20, { duration });
      scale.value = withTiming(0.95, { duration });
    }
  }, [isVisible, duration, opacity, translateY, scale]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }, { scale: scale.value }],
    };
  });

  return (
    <Animated.View style={[styles.container, style, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
