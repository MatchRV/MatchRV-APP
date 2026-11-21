// Brand palette & typography ported from ui/theme/Color.kt and Type.kt.
import type { TextStyle } from 'react-native';

export const Brand = {
  ink950: '#040B12',
  ink900: '#07131D',
  ink850: '#0A1A27',
  ink800: '#0E2231',
  ink700: '#16303F',
  aqua: '#2DE2D2',
  aquaSoft: '#8FF5EA',
  aquaDeep: '#086A63',
  aquaInk: '#04211F',
  amber: '#FFB561',
  ember: '#FF8A4C',
  warnDark: '#FF9D6C',
  warnLight: '#B4491C',
  fgDark: '#EAF2F5',
  fgMutedDark: '#A3B5C1',
  borderDark: 'rgba(255,255,255,0.12)',
  paper: '#F3EFE7',
  paper2: '#E8E2D6',
  white: '#FFFDF9',
  fgLight: '#0A1823',
  fgMutedLight: '#4A5A66',
  borderLight: 'rgba(10,24,35,0.13)',
  saveGreen: '#2DE2D2',
  passCoral: '#FF6B57',
} as const;

/** The Kotlin app is dark-first (MatchInk background, aqua accents); we keep that look on both OSes. */
export const Colors = {
  background: Brand.ink950,
  surface: Brand.ink900,
  surfaceRaised: Brand.ink850,
  surfaceHigh: Brand.ink800,
  border: Brand.borderDark,
  divider: Brand.ink700,
  text: Brand.fgDark,
  textMuted: Brand.fgMutedDark,
  accent: Brand.aqua,
  onAccent: Brand.ink950,
  warn: Brand.warnDark,
  danger: Brand.passCoral,
} as const;

export const Fonts = {
  display: 'BricolageGrotesque',
  body: 'Inter',
  mono: 'JetBrainsMono',
} as const;

/** Font files bundled from app/src/main/res/font (single variable-weight TTF each). */
export const FontAssets = {
  [Fonts.display]: require('../assets/fonts/bricolage_grotesque.ttf'),
  [Fonts.body]: require('../assets/fonts/inter.ttf'),
  [Fonts.mono]: require('../assets/fonts/jetbrains_mono.ttf'),
};

export const Type = {
  displayLarge: { fontFamily: Fonts.display, fontWeight: '700', fontSize: 36, lineHeight: 42, letterSpacing: -0.5 },
  displayMedium: { fontFamily: Fonts.display, fontWeight: '700', fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
  headlineLarge: { fontFamily: Fonts.display, fontWeight: '700', fontSize: 24, lineHeight: 30, letterSpacing: -0.2 },
  headlineMedium: { fontFamily: Fonts.display, fontWeight: '600', fontSize: 20, lineHeight: 26 },
  titleLarge: { fontFamily: Fonts.display, fontWeight: '600', fontSize: 18, lineHeight: 24 },
  titleMedium: { fontFamily: Fonts.body, fontWeight: '600', fontSize: 15, lineHeight: 21 },
  titleSmall: { fontFamily: Fonts.body, fontWeight: '500', fontSize: 13, lineHeight: 18 },
  bodyLarge: { fontFamily: Fonts.body, fontWeight: '400', fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: Fonts.body, fontWeight: '400', fontSize: 14, lineHeight: 20 },
  bodySmall: { fontFamily: Fonts.body, fontWeight: '400', fontSize: 12, lineHeight: 17 },
  labelLarge: { fontFamily: Fonts.body, fontWeight: '600', fontSize: 14, lineHeight: 18, letterSpacing: 0.1 },
  labelMedium: { fontFamily: Fonts.mono, fontWeight: '500', fontSize: 12, lineHeight: 16, letterSpacing: 0.3 },
  labelSmall: { fontFamily: Fonts.mono, fontWeight: '500', fontSize: 11, lineHeight: 14, letterSpacing: 0.4 },
} satisfies Record<string, TextStyle>;

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const Radius = { sm: 10, md: 14, lg: 20, xl: 28 } as const;
