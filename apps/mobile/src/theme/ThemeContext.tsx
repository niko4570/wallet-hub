import React, { createContext, useContext } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, lightTheme, navigationDarkTheme, navigationLightTheme, AppTheme } from './index';

type ThemeMode = 'dark' | 'light';

interface ThemeState {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleThemeMode: () => void;
  theme: AppTheme;
  navigationTheme: any;
  isLoading: boolean;
}

const THEME_STORAGE_KEY = 'wallethub_theme_mode';

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeMode: 'dark',
  setThemeMode: async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error('Failed to save theme mode:', error);
    }
    
    set(() => {
      const theme = mode === 'dark' ? darkTheme : lightTheme;
      const navigationTheme = mode === 'dark' ? navigationDarkTheme : navigationLightTheme;
      
      return {
        themeMode: mode,
        theme,
        navigationTheme,
      };
    });
  },
  toggleThemeMode: () => {
    const currentMode = get().themeMode;
    const newMode = currentMode === 'dark' ? 'light' : 'dark';
    get().setThemeMode(newMode);
  },
  theme: darkTheme,
  navigationTheme: navigationDarkTheme,
  isLoading: true,
}));

export const initializeTheme = async () => {
  try {
    const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    if (savedMode === 'dark' || savedMode === 'light') {
      useThemeStore.getState().setThemeMode(savedMode);
    }
  } catch (error) {
    console.error('Failed to load theme mode:', error);
  } finally {
    useThemeStore.setState({ isLoading: false });
  }
};

export const useTheme = () => {
  return useThemeStore(
    useShallow((state) => ({
      themeMode: state.themeMode,
      theme: state.theme,
      navigationTheme: state.navigationTheme,
      setThemeMode: state.setThemeMode,
      toggleThemeMode: state.toggleThemeMode,
      isLoading: state.isLoading,
    }))
  );
};
