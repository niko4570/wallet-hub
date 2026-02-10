import { TELEMETRY_ENDPOINT } from "../config/env";

interface ExploreTelemetryPayload {
  event: string;
  url?: string;
  targetUrl?: string;
  status?: "success" | "error" | "blocked";
  metadata?: Record<string, unknown>;
  errorMessage?: string;
}

const telemetryBaseUrl = TELEMETRY_ENDPOINT.replace(/\/$/, "");

const sendTelemetry = async (
  path: string,
  payload: ExploreTelemetryPayload,
): Promise<void> => {
  if (!telemetryBaseUrl) {
    return;
  }

  try {
    await fetch(`${telemetryBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
        source: "wallethub-mobile",
      }),
    });
  } catch (error) {
    console.warn("Telemetry dispatch failed", error);
  }
};

export const telemetryService = {
  recordExploreEvent: (payload: ExploreTelemetryPayload) =>
    sendTelemetry("/telemetry/explore", payload),
};
