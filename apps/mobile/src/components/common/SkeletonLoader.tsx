import React from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: object;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = "100%",
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const opacity = React.useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

// Preset components
interface SkeletonCardProps {
  style?: object;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ style }) => (
  <View style={[styles.card, style]}>
    <View style={styles.cardHeader}>
      <SkeletonLoader width={120} height={16} borderRadius={8} />
      <SkeletonLoader width={60} height={12} borderRadius={6} />
    </View>
    <View style={styles.cardContent}>
      <SkeletonLoader height={14} borderRadius={4} style={styles.line} />
      <SkeletonLoader height={14} borderRadius={4} style={styles.line} />
      <SkeletonLoader
        height={14}
        borderRadius={4}
        style={[styles.line, styles.shortLine]}
      />
    </View>
  </View>
);

interface SkeletonTransactionProps {
  style?: object;
}

export const SkeletonTransaction: React.FC<SkeletonTransactionProps> = ({
  style,
}) => (
  <View style={[styles.transaction, style]}>
    <View style={styles.transactionHeader}>
      <SkeletonLoader width={180} height={14} borderRadius={4} />
      <SkeletonLoader width={60} height={20} borderRadius={10} />
    </View>
    <View style={styles.transactionInfo}>
      <SkeletonLoader width={120} height={16} borderRadius={4} />
      <SkeletonLoader
        width={200}
        height={12}
        borderRadius={4}
        style={styles.line}
      />
    </View>
    <SkeletonLoader
      width={100}
      height={11}
      borderRadius={4}
      style={styles.timestamp}
    />
  </View>
);

interface SkeletonWalletProps {
  style?: object;
}

export const SkeletonWallet: React.FC<SkeletonWalletProps> = ({ style }) => (
  <View style={[styles.wallet, style]}>
    <View style={styles.walletIcon}>
      <SkeletonLoader width={48} height={48} borderRadius={24} />
    </View>
    <View style={styles.walletInfo}>
      <SkeletonLoader width={150} height={16} borderRadius={4} />
      <SkeletonLoader
        width={200}
        height={12}
        borderRadius={4}
        style={styles.line}
      />
      <SkeletonLoader
        width={100}
        height={14}
        borderRadius={4}
        style={styles.line}
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardContent: {
    gap: 8,
  },
  line: {
    marginTop: 8,
  },
  shortLine: {
    width: "60%",
  },
  transaction: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  transactionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  transactionInfo: {
    marginBottom: 8,
  },
  timestamp: {
    marginTop: 4,
  },
  wallet: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 8,
  },
  walletIcon: {
    marginRight: 12,
  },
  walletInfo: {
    flex: 1,
  },
});

export default SkeletonLoader;
