import * as LocalAuthentication from "expo-local-authentication";

const DEFAULT_PROMPT = "Authenticate to continue";
const SESSION_TTL_MS = 2 * 60 * 1000; // 2 minutes

let lastSuccessTimestamp = 0;

export interface BiometricApprovalOptions {
  /**
   * Allow reusing a recent successful biometric session within SESSION_TTL_MS.
   * Defaults to false, which forces a fresh biometric prompt.
   */
  allowSessionReuse?: boolean;
}

/**
 * Ensures the user completes a biometric (or secure fallback) challenge
 * before executing sensitive wallet actions.
 */
export async function requireBiometricApproval(
  intent: string = DEFAULT_PROMPT,
  options?: BiometricApprovalOptions,
): Promise<void> {
  const now = Date.now();
  const canReuseSession =
    options?.allowSessionReuse &&
    lastSuccessTimestamp > 0 &&
    now - lastSuccessTimestamp < SESSION_TTL_MS;

  if (canReuseSession) {
    return;
  }

  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) {
    throw new Error(
      "Biometric authentication hardware is unavailable on this device.",
    );
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
    if ((result as any).error === "user_cancel" || (result as any).error === "system_cancel") {
      throw new Error("Biometric authentication was cancelled.");
    }
    throw new Error(
      (result as any).warning || (result as any).error || "Biometric authentication failed.",
    );
  }

  lastSuccessTimestamp = Date.now();
}

export function resetBiometricSession(): void {
  lastSuccessTimestamp = 0;
}

export function getBiometricSessionState(): {
  lastSuccessAt: number;
  expiresAt: number;
} {
  const expiresAt =
    lastSuccessTimestamp > 0 ? lastSuccessTimestamp + SESSION_TTL_MS : 0;
  return {
    lastSuccessAt: lastSuccessTimestamp,
    expiresAt,
  };
}
