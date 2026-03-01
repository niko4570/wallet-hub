// Keep AppRegistry override as early as possible to prevent duplicate headless task registration.
const { AppRegistry } = require("react-native");

const headlessTaskRegistry: Set<string> =
  (globalThis as any).__whHeadlessTaskRegistry ?? new Set<string>();
(globalThis as any).__whHeadlessTaskRegistry = headlessTaskRegistry;

type HeadlessTaskProvider = () => Promise<unknown>;
type HeadlessTaskCancelProvider = () => void;

const originalRegisterHeadlessTask = AppRegistry.registerHeadlessTask;
AppRegistry.registerHeadlessTask = (
  taskKey: string,
  taskProvider: HeadlessTaskProvider,
) => {
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
    taskKey: string,
    taskProvider: HeadlessTaskProvider,
    cancelTaskProvider: HeadlessTaskCancelProvider,
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

require("react-native-get-random-values");
const { registerRootComponent } = require("expo");
const { Buffer } = require("buffer");
const { getRandomValues: expoCryptoGetRandomValues } = require("expo-crypto");

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

import App from "./App";

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
