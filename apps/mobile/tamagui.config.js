const { createTamagui } = require('tamagui');
const { createInterFont } = require('@tamagui/font-inter');
const { createMedia } = require('@tamagui/react-native-media-driver');
const { shorthands } = require('@tamagui/shorthands');
const { tokens } = require('@tamagui/themes');
const { animations } = require('@tamagui/config/v3');

const headingFont = createInterFont({
  size: {
    6: 15,
    7: 28,
    8: 34,
    9: 46,
  },
  transform: {
    6: 'uppercase',
    7: 'none',
  },
  weight: {
    6: '400',
    7: '700',
  },
  color: {
    6: '$colorFocus',
    7: '$color',
  },
  letterSpacing: {
    5: 2,
    6: 1,
    7: 0,
    8: -1,
    9: -2,
  },
  face: {
    700: { normal: 'InterBold' },
  },
});

const bodyFont = createInterFont(
  {
    face: {
      700: { normal: 'InterBold' },
    },
  },
  {
    sizeSize: (size) => Math.round(size * 1.1),
    sizeLineHeight: (size) => Math.round(size * 1.1 + (size > 20 ? 10 : 10)),
  },
);

const darkTheme = {
  background: '#050914',
  backgroundStrong: '#0B1221',
  backgroundTransparent: 'rgba(5, 9, 20, 0)',
  color: '#FFFFFF',
  colorHover: '#F2F2F2',
  colorPress: '#E0E0E0',
  colorFocus: '#8EA4FF',
  borderColor: 'rgba(255,255,255,0.08)',
  borderColorHover: 'rgba(255,255,255,0.15)',
  shadowColor: '#000000',
  shadowColorHover: '#000000',
  accentColor: '#00FFB3',
  accentColorHover: '#00D4FF',
  accentColorPress: '#FF00E5',
  surface1: 'rgba(255,255,255,0.05)',
  surface2: 'rgba(255,255,255,0.08)',
  surface3: 'rgba(255,255,255,0.12)',
};

const customTokens = {
  ...tokens,
  color: {
    ...tokens.color,
    brand: '#4B8BF5',
    brandHover: '#3A74D4',
    brandPress: '#2B5EB3',
    success: '#00FFB3',
    warning: '#FFD700',
    error: '#FF4D4D',
    background: '#050914',
    surface: '#121a31',
  },
  space: {
    ...tokens.space,
    0: 0,
    1: 4,
    2: 8,
    3: 16,
    4: 24,
    5: 32,
    6: 40,
    7: 48,
    8: 64,
  },
  radius: {
    ...tokens.radius,
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 24,
    6: 32,
  },
};

const config = createTamagui({
  animations,
  defaultTheme: 'dark',
  shouldAddPrefersColorThemes: false,
  themeClassNameOnRoot: false,
  shorthands,
  fonts: {
    heading: headingFont,
    body: bodyFont,
  },
  themes: {
    dark: darkTheme,
    light: darkTheme,
  },
  tokens: customTokens,
  media: createMedia({
    xs: { maxWidth: 660 },
    sm: { maxWidth: 800 },
    md: { maxWidth: 1020 },
    lg: { maxWidth: 1280 },
    xl: { maxWidth: 1420 },
    xxl: { maxWidth: 1600 },
    gtXs: { minWidth: 660 + 1 },
    gtSm: { minWidth: 800 + 1 },
    gtMd: { minWidth: 1020 + 1 },
    gtLg: { minWidth: 1280 + 1 },
    short: { maxHeight: 820 },
    tall: { minHeight: 820 },
    hover: { hover: 'none' },
    pointerCoarse: { pointer: 'coarse' },
  }),
});

module.exports = config;
