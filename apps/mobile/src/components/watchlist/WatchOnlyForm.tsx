import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { PublicKey } from "@solana/web3.js";

interface WatchOnlyFormProps {
  onSubmit: (payload: { address: string; label?: string }) => Promise<void>;
  onClose: () => void;
  loading?: boolean;
}

export const WatchOnlyForm: React.FC<WatchOnlyFormProps> = ({
  onSubmit,
  onClose,
  loading = false,
}) => {
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isAddressFilled = address.trim().length > 0;

  const normalizedAddress = useMemo(() => address.trim(), [address]);

  const handleSubmit = async () => {
    try {
      if (!isAddressFilled) {
        setError("请输入 Solana 公钥");
        return;
      }
      const validatedAddress = new PublicKey(normalizedAddress).toBase58();
      setError(null);
      await onSubmit({
        address: validatedAddress,
        label: label.trim() || undefined,
      });
    } catch (err: any) {
      setError("无效的 Solana 公钥");
    }
  };

  return (
    <View style={styles.formContainer}>
      <Text style={styles.formSubtitle}>添加 watch-only 账户</Text>
      <TextInput
        style={styles.input}
        placeholder="账户标签（可选）"
        placeholderTextColor="rgba(255,255,255,0.4)"
        value={label}
        onChangeText={setLabel}
      />
      <TextInput
        style={styles.input}
        placeholder="输入 Solana 公钥"
        placeholderTextColor="rgba(255,255,255,0.4)"
        value={address}
        onChangeText={setAddress}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionGhost}
          onPress={onClose}
          disabled={loading}
        >
          <Text style={styles.actionGhostText}>取消</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionPrimary,
            (!isAddressFilled || loading) && styles.disabledButton,
          ]}
          onPress={handleSubmit}
          disabled={!isAddressFilled || loading}
        >
          <Feather name="plus" size={16} color="#050814" />
          <Text style={styles.actionPrimaryText}>
            {loading ? "添加中..." : "添加账户"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  formContainer: {
    gap: 12,
  },
  formSubtitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 13,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  },
  actionGhost: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionGhostText: {
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
  },
  actionPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#9CFFDA",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  actionPrimaryText: {
    color: "#050814",
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.4,
  },
});
