import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import AppNavigator from "./src/navigation/AppNavigator";
import { SolanaProvider } from "./src/context/SolanaContext";
import ToastProvider from "./src/components/common/ToastProvider";

// Suppress zeego warning (not using native menus yet)
// import '@tamagui/native/setup-zeego';

SplashScreen.preventAutoHideAsync();

export default function App() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <SolanaProvider>
          <StatusBar style="light" />
          <AppNavigator />
        </SolanaProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
