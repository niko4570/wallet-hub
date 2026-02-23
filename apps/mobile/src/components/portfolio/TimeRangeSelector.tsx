import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useTheme } from "../../theme/ThemeContext";
import { TIME_RANGE_OPTIONS, ANIMATION_CONFIG, UI_CONFIG } from "../../config/appConfig";

type TimeRange = "1D" | "7D" | "30D";

interface TimeRangeSelectorProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
}

const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  timeRange,
  onTimeRangeChange,
}) => {
  const { theme } = useTheme();

  const getTimeRangeButtonStyle = (range: TimeRange) => {
    return useAnimatedStyle(() => {
      if (timeRange === range) {
        return {
          transform: [
            {
              scale: withSpring(1.05, ANIMATION_CONFIG.SPRING),
            },
          ],
        };
      }
      return {};
    });
  };

  return (
    <View style={styles.container}>
      {TIME_RANGE_OPTIONS.OPTIONS.map((range) => (
        <Animated.View key={range} style={getTimeRangeButtonStyle(range)}>
          <TouchableOpacity
            style={[
              styles.button,
              {
                backgroundColor: timeRange === range 
                  ? theme.colors.primary 
                  : "rgba(255, 255, 255, 0.08)",
                borderColor: timeRange === range 
                  ? theme.colors.primary 
                  : "rgba(255, 255, 255, 0.1)",
              },
            ]}
            onPress={() => onTimeRangeChange(range)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.buttonText,
                {
                  color: timeRange === range ? "#FFFFFF" : "rgba(255, 255, 255, 0.6)",
                },
              ]}
            >
              {range}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 28,
    gap: UI_CONFIG.SPACING.MD,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: UI_CONFIG.BORDER_RADIUS.LG,
    borderWidth: 1,
    ...UI_CONFIG.SHADOW.LIGHT,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});

export default TimeRangeSelector;