import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeContext";
import {
  TransactionPreview,
  TransactionValidationResult,
} from "../../services/security/transactionSecurity.service";

interface TransactionPreviewModalProps {
  visible: boolean;
  preview: TransactionPreview | null;
  validation: TransactionValidationResult | null;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const TransactionPreviewModal: React.FC<TransactionPreviewModalProps> = ({
  visible,
  preview,
  validation,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const { theme } = useTheme();

  if (!visible || !preview) {
    return null;
  }

  const isValid = validation?.valid ?? true;
  const hasWarnings = (validation?.warnings?.length ?? 0) > 0;
  const hasErrors = (validation?.errors?.length ?? 0) > 0;

  return (
    <View style={styles.overlay}>
      <View
        style={[
          styles.container,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Transaction Preview
          </Text>
          <TouchableOpacity onPress={onCancel} disabled={loading}>
            <Feather name="x" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text
                style={[styles.loadingText, { color: theme.colors.text }]}
              >
                Analyzing transaction...
              </Text>
            </View>
          ) : (
            <>
              {hasErrors && (
                <View
                  style={[
                    styles.alertBox,
                    { backgroundColor: theme.colors.error + "20" },
                  ]}
                >
                  <Feather
                    name="alert-circle"
                    size={20}
                    color={theme.colors.error}
                  />
                  <Text
                    style={[styles.alertText, { color: theme.colors.error }]}
                  >
                    {validation?.errors?.join("\n")}
                  </Text>
                </View>
              )}

              {hasWarnings && (
                <View
                  style={[
                    styles.alertBox,
                    { backgroundColor: theme.colors.warning + "20" },
                  ]}
                >
                  <Feather
                    name="alert-triangle"
                    size={20}
                    color={theme.colors.warning}
                  />
                  <Text
                    style={[styles.alertText, { color: theme.colors.warning }]}
                  >
                    {validation?.warnings?.join("\n")}
                  </Text>
                </View>
              )}

              <View style={styles.section}>
                <Text
                  style={[styles.sectionTitle, { color: theme.colors.text }]}
                >
                  Transaction Details
                </Text>

                <View style={styles.row}>
                  <Text
                    style={[styles.label, { color: theme.colors.onSurface }]}
                  >
                    Type
                  </Text>
                  <Text
                    style={[styles.value, { color: theme.colors.text }]}
                  >
                    {preview.type.toUpperCase()}
                  </Text>
                </View>

                <View style={styles.row}>
                  <Text
                    style={[styles.label, { color: theme.colors.onSurface }]}
                  >
                    From
                  </Text>
                  <Text
                    style={[styles.value, { color: theme.colors.text }]}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {preview.from}
                  </Text>
                </View>

                <View style={styles.row}>
                  <Text
                    style={[styles.label, { color: theme.colors.onSurface }]}
                  >
                    To
                  </Text>
                  <Text
                    style={[styles.value, { color: theme.colors.text }]}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {preview.to}
                  </Text>
                </View>

                <View style={styles.row}>
                  <Text
                    style={[styles.label, { color: theme.colors.onSurface }]}
                  >
                    Amount
                  </Text>
                  <Text
                    style={[styles.value, { color: theme.colors.text }]}
                  >
                    {preview.amount.toFixed(6)} {preview.token || "SOL"}
                  </Text>
                </View>

                <View style={styles.row}>
                  <Text
                    style={[styles.label, { color: theme.colors.onSurface }]}
                  >
                    Network Fee
                  </Text>
                  <Text
                    style={[styles.value, { color: theme.colors.text }]}
                  >
                    {preview.feeInSol?.toFixed(6) || "0.000005"} SOL
                  </Text>
                </View>

                {preview.signature && (
                  <View style={styles.row}>
                    <Text
                      style={[styles.label, { color: theme.colors.onSurface }]}
                    >
                      Signature
                    </Text>
                    <Text
                      style={[styles.value, { color: theme.colors.text }]}
                      numberOfLines={2}
                      ellipsizeMode="middle"
                    >
                      {preview.signature}
                    </Text>
                  </View>
                )}
              </View>

              {preview.instructions.length > 0 && (
                <View style={styles.section}>
                  <Text
                    style={[styles.sectionTitle, { color: theme.colors.text }]}
                  >
                    Instructions ({preview.instructions.length})
                  </Text>

                  {preview.instructions.map((instruction, index) => (
                    <View
                      key={index}
                      style={[
                        styles.instructionBox,
                        {
                          backgroundColor: theme.colors.background,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.instructionProgram,
                          { color: theme.colors.primary },
                        ]}
                      >
                        {instruction.programName || "Unknown Program"}
                      </Text>
                      <Text
                        style={[styles.instructionType, { color: theme.colors.text }]}
                      >
                        {instruction.type}
                      </Text>
                      {instruction.description && (
                        <Text
                          style={[
                            styles.instructionDesc,
                            { color: theme.colors.onSurface },
                          ]}
                        >
                          {instruction.description}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.securityInfo}>
                <Feather
                  name="shield"
                  size={16}
                  color={theme.colors.success}
                />
                <Text
                  style={[styles.securityText, { color: theme.colors.onSurface }]}
                >
                  This transaction has been validated for security
                </Text>
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.cancelButton,
              { borderColor: theme.colors.border },
            ]}
            onPress={onCancel}
            disabled={loading}
          >
            <Text
              style={[styles.buttonText, { color: theme.colors.text }]}
            >
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.confirmButton,
              {
                backgroundColor: isValid
                  ? theme.colors.primary
                  : theme.colors.disabled,
              },
            ]}
            onPress={onConfirm}
            disabled={loading || !isValid}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Confirm & Sign</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    width: "100%",
    maxHeight: "80%",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "500",
  },
  alertBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  alertText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
  },
  value: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
    flex: 1,
    marginLeft: 12,
  },
  instructionBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  instructionProgram: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  instructionType: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  instructionDesc: {
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 16,
  },
  securityInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    marginTop: 8,
  },
  securityText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    borderWidth: 1,
  },
  confirmButton: {
    backgroundColor: "#6366f1",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

export default TransactionPreviewModal;