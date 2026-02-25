import React, { useCallback, memo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeContext";
import { useSolanaStore } from "../../store/solanaStore";

type Network = "mainnet-beta" | "devnet" | "testnet";

const NETWORK_LABELS: Record<Network, string> = {
  "mainnet-beta": "Mainnet",
  devnet: "Devnet",
  testnet: "Testnet",
};

const NetworkSwitcher = memo(() => {
  const { theme } = useTheme();
  const { network, setNetwork } = useSolanaStore();

  const handleNetworkChange = useCallback(
    (newNetwork: Network) => {
      setNetwork(newNetwork);
    },
    [setNetwork],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Network
        </Text>
      </View>
      <View style={styles.networkOptions}>
        {Object.entries(NETWORK_LABELS).map(([networkKey, label]) => {
          const isSelected = network === networkKey;
          return (
            <TouchableOpacity
              key={networkKey}
              style={[
                styles.networkOption,
                isSelected && [
                  styles.selectedOption,
                  { borderColor: theme.colors.primary },
                ],
                {
                  backgroundColor: isSelected
                    ? theme.colors.primary + "20"
                    : theme.colors.surface,
                },
              ]}
              onPress={() => handleNetworkChange(networkKey as Network)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.networkLabel,
                  isSelected && { color: theme.colors.primary },
                  { color: theme.colors.text },
                ]}
              >
                {label}
              </Text>
              {isSelected && (
                <Feather name="check" size={16} color={theme.colors.primary} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
  networkOptions: {
    gap: 8,
  },
  networkOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  selectedOption: {
    borderWidth: 1,
  },
  networkLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  statusContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  statusLabel: {
    fontSize: 12,
  },
});

export default NetworkSwitcher;
