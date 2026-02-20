import { DefaultTheme as PaperDefaultTheme, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';

export const darkTheme = {
  ...PaperDefaultTheme,
  ...MD3DarkTheme,
  colors: {
    ...PaperDefaultTheme.colors,
    ...MD3DarkTheme.colors,
    primary: '#7F56D9',
    secondary: '#C7B5FF',
    background: '#050814',
    surface: '#0B1221',
    error: '#FF4D4D',
    text: '#FFFFFF',
    onSurface: '#F8F5FF',
    disabled: 'rgba(255, 255, 255, 0.3)',
    placeholder: 'rgba(255, 255, 255, 0.5)',
    backdrop: 'rgba(0, 0, 0, 0.7)',
    notification: '#7F56D9',
    success: '#00FFB3',
    warning: '#FFB800',
  },
};

export const lightTheme = {
  ...PaperDefaultTheme,
  ...MD3LightTheme,
  colors: {
    ...PaperDefaultTheme.colors,
    ...MD3LightTheme.colors,
    primary: '#7F56D9',
    secondary: '#C7B5FF',
    background: '#F8F9FA',
    surface: '#FFFFFF',
    error: '#FF4D4D',
    text: '#050814',
    onSurface: '#0B1221',
    disabled: 'rgba(5, 8, 20, 0.3)',
    placeholder: 'rgba(5, 8, 20, 0.5)',
    backdrop: 'rgba(255, 255, 255, 0.7)',
    notification: '#7F56D9',
    success: '#00C48C',
    warning: '#FFB800',
  },
};

export const navigationDarkTheme = {
  ...NavigationDefaultTheme,
  colors: {
    ...NavigationDefaultTheme.colors,
    primary: '#7F56D9',
    background: '#050814',
    card: '#0B1221',
    text: '#FFFFFF',
    border: 'rgba(255, 255, 255, 0.1)',
    notification: '#7F56D9',
  },
};

export const navigationLightTheme = {
  ...NavigationDefaultTheme,
  colors: {
    ...NavigationDefaultTheme.colors,
    primary: '#7F56D9',
    background: '#F8F9FA',
    card: '#FFFFFF',
    text: '#050814',
    border: 'rgba(5, 8, 20, 0.1)',
    notification: '#7F56D9',
  },
};

export type AppTheme = typeof darkTheme;
