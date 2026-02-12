import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import ErrorToast, { toast } from "./ErrorToast";

interface ToastItem {
  id: string;
  message: string;
  type: "error" | "success" | "warning" | "info";
  duration: number;
}

const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Override the toast.show method to use our state
  React.useEffect(() => {
    const originalShow = toast.show;

    toast.show = (options) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newToast: ToastItem = {
        id,
        message: options.message,
        type: options.type || "info",
        duration: options.duration || 3000,
      };

      setToasts((prev) => [...prev, newToast]);

      // Remove toast after duration
      setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, newToast.duration);
    };

    return () => {
      toast.show = originalShow;
    };
  }, []);

  return (
    <View style={styles.container}>
      {children}
      {toasts.map((toastItem) => (
        <ErrorToast
          key={toastItem.id}
          message={toastItem.message}
          type={toastItem.type}
          duration={toastItem.duration}
          onClose={() => {
            setToasts((prev) =>
              prev.filter((toast) => toast.id !== toastItem.id),
            );
          }}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default ToastProvider;
