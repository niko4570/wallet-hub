import 'react-native-get-random-values';
import { registerRootComponent } from 'expo';
import { Buffer } from 'buffer';
import { getRandomValues as expoCryptoGetRandomValues } from 'expo-crypto';

global.Buffer = Buffer;

class CryptoPolyfill {
  getRandomValues = expoCryptoGetRandomValues;
}

const cryptoInstance = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : new CryptoPolyfill();

(() => {
  if (typeof globalThis.crypto === 'undefined') {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      enumerable: true,
      get: () => cryptoInstance,
    });
  }
})();

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
