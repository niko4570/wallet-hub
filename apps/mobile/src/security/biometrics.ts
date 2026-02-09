import * as LocalAuthentication from "expo-local-authentication";

const DEFAULT_PROMPT = "Authenticate to continue";

/**
 * Ensures the user completes a biometric (or secure fallback) challenge
 * before executing sensitive wallet actions.
 */
export async function requireBiometricApproval(
  intent: string = DEFAULT_PROMPT,
): Promise<void> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) {
    throw new Error("Biometric authentication hardware is unavailable on this device.");
  }

  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!isEnrolled) {
    throw new Error(
      "No biometric credentials are enrolled. Please add Face ID, Touch ID, or a fingerprint to continue.",
    );
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: intent,
    fallbackLabel: "Use device passcode",
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
  });

  if (!result.success) {
    if (result.error === "user_cancel" || result.error === "system_cancel") {
      throw new Error("Biometric authentication was cancelled.");
    }
    throw new Error(result.warning || result.error || "Biometric authentication failed.");
  }
}
