import "react-native-get-random-values";
import { registerRootComponent } from "expo";
import { Buffer } from "buffer";
import { getRandomValues as expoCryptoGetRandomValues } from "expo-crypto";
import { AppRegistry } from "react-native";

(globalThis as any).Buffer = Buffer;

class CryptoPolyfill {
  getRandomValues = expoCryptoGetRandomValues;
}

const cryptoInstance =
  typeof globalThis.crypto !== "undefined"
    ? globalThis.crypto
    : new CryptoPolyfill();

(() => {
  if (typeof globalThis.crypto === "undefined") {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true, // Allow redefinition if needed
      enumerable: true, // Make it show up in console logs
      get: () => cryptoInstance,
    });
  }
})();

const headlessTaskRegistry: Set<string> =
  (globalThis as any).__whHeadlessTaskRegistry ?? new Set<string>();
(globalThis as any).__whHeadlessTaskRegistry = headlessTaskRegistry;

const originalRegisterHeadlessTask = AppRegistry.registerHeadlessTask;
AppRegistry.registerHeadlessTask = (taskKey, taskProvider) => {
  if (headlessTaskRegistry.has(taskKey)) {
    return;
  }
  headlessTaskRegistry.add(taskKey);
  return originalRegisterHeadlessTask(taskKey, taskProvider);
};

if (typeof AppRegistry.registerCancellableHeadlessTask === "function") {
  const originalRegisterCancellableHeadlessTask =
    AppRegistry.registerCancellableHeadlessTask;
  AppRegistry.registerCancellableHeadlessTask = (
    taskKey,
    taskProvider,
    cancelTaskProvider,
  ) => {
    if (headlessTaskRegistry.has(taskKey)) {
      return;
    }
    headlessTaskRegistry.add(taskKey);
    return originalRegisterCancellableHeadlessTask(
      taskKey,
      taskProvider,
      cancelTaskProvider,
    );
  };
}

import App from "./App";

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
