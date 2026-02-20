import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { Provider as PaperProvider } from "react-native-paper";
import { useEffect, useState } from "react";
import AppNavigator from "./src/navigation/AppNavigator";
import { SolanaProvider } from "./src/context/SolanaContext";
import ToastProvider from "./src/components/common/ToastProvider";
import { useTheme, initializeTheme } from "./src/theme/ThemeContext";

// Suppress zeego warning (not using native menus yet)
// import '@tamagui/native/setup-zeego';

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { theme, themeMode, isLoading } = useTheme();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  return (
    <PaperProvider theme={theme}>
      <StatusBar style={themeMode === 'dark' ? "light" : "dark"} />
      <AppNavigator />
    </PaperProvider>
  );
}

export default function App() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      await initializeTheme();
      setInitialized(true);
    };

    init();
  }, []);

  if (!initialized) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <SolanaProvider>
          <AppContent />
        </SolanaProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
