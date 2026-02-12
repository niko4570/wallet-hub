import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { Feather } from "@expo/vector-icons";

interface ErrorToastProps {
  message: string;
  type?: "error" | "success" | "warning" | "info";
  duration?: number;
  onClose?: () => void;
}

const ErrorToast: React.FC<ErrorToastProps> = ({
  message,
  type = "error",
  duration = 3000,
  onClose,
}) => {
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    // Animate in
    Animated.timing(translateY, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Animate out after duration
    const timer = setTimeout(() => {
      Animated.timing(translateY, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        onClose?.();
      });
    }, duration);

    return () => clearTimeout(timer);
  }, [translateY, duration, onClose]);

  const getIconName = () => {
    switch (type) {
      case "success":
        return "check-circle";
      case "warning":
        return "alert-triangle";
      case "info":
        return "info";
      default:
        return "alert-circle";
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case "success":
        return "rgba(0, 255, 179, 0.2)";
      case "warning":
        return "rgba(255, 204, 0, 0.2)";
      case "info":
        return "rgba(127, 86, 217, 0.2)";
      default:
        return "rgba(255, 77, 77, 0.2)";
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case "success":
        return "rgba(0, 255, 179, 0.4)";
      case "warning":
        return "rgba(255, 204, 0, 0.4)";
      case "info":
        return "rgba(127, 86, 217, 0.4)";
      default:
        return "rgba(255, 77, 77, 0.4)";
    }
  };

  const getTextColor = () => {
    switch (type) {
      case "success":
        return "#00FFB3";
      case "warning":
        return "#FFCC00";
      case "info":
        return "#7F56D9";
      default:
        return "#FF4D4D";
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
        },
      ]}
    >
      <Feather name={getIconName()} size={20} color={getTextColor()} />
      <Text style={[styles.message, { color: getTextColor() }]}>{message}</Text>
    </Animated.View>
  );
};

// Toast manager for global usage
interface ToastOptions {
  message: string;
  type?: "error" | "success" | "warning" | "info";
  duration?: number;
}

class ToastManager {
  private static instance: ToastManager;
  private toastQueue: (() => void)[] = [];
  private isShowing: boolean = false;

  static getInstance(): ToastManager {
    if (!ToastManager.instance) {
      ToastManager.instance = new ToastManager();
    }
    return ToastManager.instance;
  }

  show(options: ToastOptions) {
    // Add to queue
    this.toastQueue.push(() => {
      this.displayToast(options);
    });

    // If no toast is showing, start processing the queue
    if (!this.isShowing) {
      this.processQueue();
    }
  }

  private processQueue() {
    if (this.toastQueue.length === 0) {
      this.isShowing = false;
      return;
    }

    this.isShowing = true;
    const showNext = this.toastQueue.shift();
    showNext?.();
  }

  private displayToast(options: ToastOptions) {
    // Create toast element and add to DOM
    // In a real app, you would use a global state or context to manage toasts
    console.log("Show toast:", options);

    // Simulate toast display duration
    setTimeout(() => {
      this.processQueue();
    }, options.duration || 3000);
  }
}

export const toast = ToastManager.getInstance();

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 9999,
  },
  message: {
    marginLeft: 12,
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
});

export default ErrorToast;
