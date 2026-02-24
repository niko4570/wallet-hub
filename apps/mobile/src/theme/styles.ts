import { TextStyle, ViewStyle } from "react-native";
import { UI_CONFIG } from "../config/appConfig";
import type { AppTheme } from "./index";

/**
 * Get common container styles
 * @param theme - App theme
 * @param options - Additional options
 * @returns Container style object
 */
export const getContainerStyle = (
  theme: AppTheme,
  options?: {
    padding?: boolean;
    margin?: boolean;
    center?: boolean;
    backgroundColor?: keyof typeof theme.colors;
  },
): ViewStyle => {
  return {
    backgroundColor: options?.backgroundColor
      ? (theme.colors[options.backgroundColor] as string)
      : (theme.colors.background as string),
    padding: options?.padding ? UI_CONFIG.SPACING.MD : 0,
    margin: options?.margin ? UI_CONFIG.SPACING.MD : 0,
    alignItems: options?.center ? "center" : "stretch",
    justifyContent: options?.center ? "center" : "flex-start",
  };
};

/**
 * Get common card styles
 * @param theme - App theme
 * @param options - Additional options
 * @returns Card style object
 */
export const getCardStyle = (
  theme: AppTheme,
  options?: {
    padding?: boolean;
    margin?: boolean;
    shadowLevel?: "light" | "medium";
  },
): ViewStyle => {
  return {
    backgroundColor: theme.colors.surface,
    borderRadius: UI_CONFIG.BORDER_RADIUS.MD,
    padding: options?.padding ? UI_CONFIG.SPACING.MD : UI_CONFIG.SPACING.SM,
    margin: options?.margin ? UI_CONFIG.SPACING.MD : 0,
    ...(options?.shadowLevel
      ? UI_CONFIG.SHADOW[
          options.shadowLevel.toUpperCase() as "LIGHT" | "MEDIUM"
        ]
      : UI_CONFIG.SHADOW.LIGHT),
  };
};

/**
 * Get common text styles
 * @param theme - App theme
 * @param options - Additional options
 * @returns Text style object
 */
export const getTextStyle = (
  theme: AppTheme,
  options?: {
    size?: "small" | "medium" | "large" | "xlarge";
    weight?: "regular" | "medium" | "bold";
    color?: keyof typeof theme.colors;
    align?: "left" | "center" | "right";
    margin?: boolean;
  },
): TextStyle => {
  const sizeMap = {
    small: 12,
    medium: 14,
    large: 16,
    xlarge: 18,
  };

  const weightMap = {
    regular: "400" as const,
    medium: "500" as const,
    bold: "600" as const,
  };

  return {
    fontSize: sizeMap[options?.size || "medium"],
    fontWeight: weightMap[options?.weight || "regular"],
    color: options?.color
      ? (theme.colors[options.color] as string)
      : (theme.colors.text as string),
    textAlign: (options?.align as any) || "left",
    marginBottom: options?.margin ? UI_CONFIG.SPACING.SM : 0,
  };
};

/**
 * Get common button styles
 * @param theme - App theme
 * @param options - Additional options
 * @returns Button style object
 */
export const getButtonStyle = (
  theme: AppTheme,
  options?: {
    variant?: "primary" | "secondary" | "outline" | "text";
    size?: "small" | "medium" | "large";
    disabled?: boolean;
  },
): ViewStyle => {
  const sizeMap = {
    small: UI_CONFIG.SPACING.SM,
    medium: UI_CONFIG.SPACING.MD,
    large: UI_CONFIG.SPACING.LG,
  };

  const variantStyles = {
    primary: {
      backgroundColor: theme.colors.primary,
      borderWidth: 0,
    },
    secondary: {
      backgroundColor: theme.colors.secondary,
      borderWidth: 0,
    },
    outline: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    text: {
      backgroundColor: "transparent",
      borderWidth: 0,
    },
  };

  return {
    paddingHorizontal: sizeMap[options?.size || "medium"],
    paddingVertical: sizeMap[options?.size || "small"],
    borderRadius: UI_CONFIG.BORDER_RADIUS.MD,
    opacity: options?.disabled ? 0.5 : 1,
    ...variantStyles[options?.variant || "primary"],
  };
};

/**
 * Get common input styles
 * @param theme - App theme
 * @param options - Additional options
 * @returns Input style object
 */
export const getInputStyle = (
  theme: AppTheme,
  options?: {
    error?: boolean;
    disabled?: boolean;
  },
): ViewStyle => {
  return {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: options?.error
      ? theme.colors.error
      : theme.colors.surfaceVariant,
    borderRadius: UI_CONFIG.BORDER_RADIUS.MD,
    paddingHorizontal: UI_CONFIG.SPACING.MD,
    paddingVertical: UI_CONFIG.SPACING.SM,
    opacity: options?.disabled ? 0.5 : 1,
  };
};

/**
 * Get common modal styles
 * @param theme - App theme
 * @param options - Additional options
 * @returns Modal style object
 */
export const getModalStyle = (
  theme: AppTheme,
  options?: {
    fullScreen?: boolean;
  },
): ViewStyle => {
  return {
    backgroundColor: theme.colors.surface,
    borderRadius: options?.fullScreen ? 0 : UI_CONFIG.BORDER_RADIUS.XL,
    minHeight: options?.fullScreen
      ? ("100%" as any)
      : (UI_CONFIG.MODAL.MIN_HEIGHT as any),
    maxHeight: options?.fullScreen
      ? ("100%" as any)
      : (UI_CONFIG.MODAL.MAX_HEIGHT as any),
  };
};

/**
 * Get common shadow styles
 * @param level - Shadow level
 * @returns Shadow style object
 */
export const getShadowStyle = (level: "light" | "medium"): ViewStyle => {
  return UI_CONFIG.SHADOW[level.toUpperCase() as "LIGHT" | "MEDIUM"];
};

/**
 * Get common spacing styles
 * @param direction - Spacing direction
 * @param size - Spacing size
 * @returns Spacing style object
 */
export const getSpacingStyle = (
  direction: "padding" | "margin",
  size: "xs" | "sm" | "md" | "lg" | "xl",
  sides?:
    | "all"
    | "horizontal"
    | "vertical"
    | "top"
    | "bottom"
    | "left"
    | "right",
): ViewStyle => {
  const spacingValue =
    UI_CONFIG.SPACING[size.toUpperCase() as keyof typeof UI_CONFIG.SPACING];

  switch (sides) {
    case "horizontal":
      return {
        [`${direction}Left`]: spacingValue,
        [`${direction}Right`]: spacingValue,
      };
    case "vertical":
      return {
        [`${direction}Top`]: spacingValue,
        [`${direction}Bottom`]: spacingValue,
      };
    case "top":
      return {
        [`${direction}Top`]: spacingValue,
      };
    case "bottom":
      return {
        [`${direction}Bottom`]: spacingValue,
      };
    case "left":
      return {
        [`${direction}Left`]: spacingValue,
      };
    case "right":
      return {
        [`${direction}Right`]: spacingValue,
      };
    default:
      return {
        [direction]: spacingValue,
      };
  }
};

/**
 * Get common border styles
 * @param radius - Border radius size
 * @param color - Border color
 * @returns Border style object
 */
export const getBorderStyle = (
  radius: "sm" | "md" | "lg" | "xl",
  color?: string,
): ViewStyle => {
  return {
    borderRadius:
      UI_CONFIG.BORDER_RADIUS[
        radius.toUpperCase() as keyof typeof UI_CONFIG.BORDER_RADIUS
      ],
    borderWidth: color ? 1 : 0,
    borderColor: color,
  };
};

/**
 * Common style utilities
 */
export const styleUtils = {
  // Spacing utilities
  spacing: {
    xs: UI_CONFIG.SPACING.XS,
    sm: UI_CONFIG.SPACING.SM,
    md: UI_CONFIG.SPACING.MD,
    lg: UI_CONFIG.SPACING.LG,
    xl: UI_CONFIG.SPACING.XL,
  },

  // Border radius utilities
  borderRadius: {
    sm: UI_CONFIG.BORDER_RADIUS.SM,
    md: UI_CONFIG.BORDER_RADIUS.MD,
    lg: UI_CONFIG.BORDER_RADIUS.LG,
    xl: UI_CONFIG.BORDER_RADIUS.XL,
  },

  // Shadow utilities
  shadow: {
    light: UI_CONFIG.SHADOW.LIGHT,
    medium: UI_CONFIG.SHADOW.MEDIUM,
  },

  // Flex utilities
  flex: {
    row: {
      flexDirection: "row" as const,
    },
    column: {
      flexDirection: "column" as const,
    },
    center: {
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    spaceBetween: {
      justifyContent: "space-between" as const,
    },
    spaceAround: {
      justifyContent: "space-around" as const,
    },
  },
};

export default {
  getContainerStyle,
  getCardStyle,
  getTextStyle,
  getButtonStyle,
  getInputStyle,
  getModalStyle,
  getShadowStyle,
  getSpacingStyle,
  getBorderStyle,
  styleUtils,
};
