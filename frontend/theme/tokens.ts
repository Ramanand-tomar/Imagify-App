import { Platform } from "react-native";

export const palette = {
  indigo: {
    50: "#EEF2FF",
    100: "#E0E7FF",
    200: "#C7D2FE",
    300: "#A5B4FC",
    400: "#818CF8",
    500: "#6366F1",
    600: "#4F46E5",
    700: "#4338CA",
    800: "#3730A3",
    900: "#312E81",
  },
  violet: {
    400: "#A78BFA",
    500: "#8B5CF6",
    600: "#7C3AED",
  },
  cyan: {
    400: "#22D3EE",
    500: "#06B6D4",
    600: "#0891B2",
  },
  emerald: {
    500: "#10B981",
    600: "#059669",
  },
  amber: {
    500: "#F59E0B",
    600: "#D97706",
  },
  rose: {
    500: "#F43F5E",
    600: "#E11D48",
  },
  slate: {
    50: "#F8FAFC",
    100: "#F1F5F9",
    200: "#E2E8F0",
    300: "#CBD5E1",
    400: "#94A3B8",
    500: "#64748B",
    600: "#475569",
    700: "#334155",
    800: "#1E293B",
    900: "#0F172A",
  },
  white: "#FFFFFF",
  black: "#000000",
};

const lightColors = {
  brand: {
    50: palette.indigo[50],
    100: palette.indigo[100],
    200: palette.indigo[200],
    300: palette.indigo[300],
    400: palette.indigo[400],
    500: palette.indigo[500],
    600: palette.indigo[600],
    700: palette.indigo[700],
    800: palette.indigo[800],
    900: palette.indigo[900],
    default: palette.indigo[600],
    contrast: palette.white,
  },
  accent: {
    violet: palette.violet[500],
    cyan: palette.cyan[500],
    emerald: palette.emerald[500],
    amber: palette.amber[500],
    rose: palette.rose[500],
  },
  surface: {
    background: "#F7F8FC",
    card: palette.white,
    elevated: palette.white,
    subtle: palette.slate[50],
    overlay: "rgba(15, 23, 42, 0.55)",
    inverse: palette.slate[900],
  },
  text: {
    primary: palette.slate[900],
    secondary: palette.slate[600],
    muted: palette.slate[400],
    inverse: palette.white,
    brand: palette.indigo[600],
    link: palette.indigo[600],
  },
  border: {
    subtle: palette.slate[100],
    default: palette.slate[200],
    strong: palette.slate[300],
    brand: palette.indigo[200],
  },
  status: {
    success: palette.emerald[600],
    successSoft: "#D1FAE5",
    warning: palette.amber[600],
    warningSoft: "#FEF3C7",
    error: palette.rose[600],
    errorSoft: "#FEE2E2",
    info: palette.indigo[600],
    infoSoft: palette.indigo[50],
  },
};

const darkColors: typeof lightColors = {
  brand: {
    ...lightColors.brand,
    default: palette.indigo[400],
    contrast: palette.slate[900],
  },
  accent: {
    violet: palette.violet[400],
    cyan: palette.cyan[400],
    emerald: palette.emerald[500],
    amber: palette.amber[500],
    rose: palette.rose[500],
  },
  surface: {
    background: palette.slate[900],
    card: palette.slate[800],
    elevated: "#273449",
    subtle: palette.slate[800],
    overlay: "rgba(0, 0, 0, 0.65)",
    inverse: palette.white,
  },
  text: {
    primary: palette.slate[50],
    secondary: palette.slate[300],
    muted: palette.slate[400],
    inverse: palette.slate[900],
    brand: palette.indigo[300],
    link: palette.indigo[300],
  },
  border: {
    subtle: "#273449",
    default: palette.slate[700],
    strong: palette.slate[600],
    brand: palette.indigo[700],
  },
  status: {
    success: palette.emerald[500],
    successSoft: "rgba(16, 185, 129, 0.18)",
    warning: palette.amber[500],
    warningSoft: "rgba(245, 158, 11, 0.18)",
    error: palette.rose[500],
    errorSoft: "rgba(244, 63, 94, 0.18)",
    info: palette.indigo[400],
    infoSoft: "rgba(99, 102, 241, 0.18)",
  },
};

export const colors = { light: lightColors, dark: darkColors };
export type TokenColors = typeof lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 48,
  "5xl": 64,
} as const;

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  pill: 999,
} as const;

type ShadowToken = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

const shadowFor = (elevation: number, opacity: number, radius: number, dy: number, color: string): ShadowToken => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: dy },
  shadowOpacity: Platform.OS === "android" ? 0 : opacity,
  shadowRadius: radius,
  elevation: Platform.OS === "android" ? elevation : 0,
});

const makeShadow = (color: string) => ({
  none: shadowFor(0, 0, 0, 0, color),
  xs: shadowFor(1, 0.04, 2, 1, color),
  sm: shadowFor(2, 0.06, 6, 2, color),
  md: shadowFor(4, 0.08, 12, 4, color),
  lg: shadowFor(8, 0.12, 20, 8, color),
  xl: shadowFor(16, 0.16, 32, 16, color),
});

/** Legacy light-mode shadow export. Prefer `theme.shadow` from `useAppTheme`. */
export const shadow = makeShadow(palette.slate[900]);
export const shadowLight = makeShadow(palette.slate[900]);
export const shadowDark = makeShadow(palette.black);

export const onGradient = {
  primary: palette.white,
  secondary: "rgba(255,255,255,0.85)",
  tertiary: "rgba(255,255,255,0.65)",
  surface: "rgba(255,255,255,0.18)",
  surfaceStrong: "rgba(255,255,255,0.25)",
} as const;

export const fontFamily = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
} as const;

type TypographyToken = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  fontWeight?: "400" | "500" | "600" | "700";
};

export const typography = {
  display: { fontFamily: fontFamily.bold, fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
  h1: { fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
  h2: { fontFamily: fontFamily.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  h3: { fontFamily: fontFamily.semibold, fontSize: 18, lineHeight: 24 },
  titleLg: { fontFamily: fontFamily.semibold, fontSize: 17, lineHeight: 22 },
  titleMd: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20 },
  titleSm: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18 },
  bodyLg: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20 },
  bodySm: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  caption: { fontFamily: fontFamily.regular, fontSize: 11, lineHeight: 14 },
  overline: { fontFamily: fontFamily.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 1.2 },
  button: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, letterSpacing: 0.2 },
} as const satisfies Record<string, TypographyToken>;

export type TypographyVariant = keyof typeof typography;

export const gradients = {
  brand: ["#6366F1", "#8B5CF6"] as const,
  aiGlow: ["#6366F1", "#8B5CF6", "#06B6D4"] as const,
  sunset: ["#F59E0B", "#F43F5E"] as const,
  cyanMint: ["#06B6D4", "#10B981"] as const,
  dim: ["rgba(99,102,241,0.18)", "rgba(139,92,246,0.18)"] as const,
};

export const motion = {
  duration: { fast: 150, base: 220, slow: 360 },
  easing: {
    standard: [0.2, 0.0, 0.0, 1.0],
    emphasized: [0.3, 0.0, 0.0, 1.0],
  },
} as const;

export type Theme = {
  mode: "light" | "dark";
  colors: TokenColors;
  spacing: typeof spacing;
  radius: typeof radius;
  shadow: typeof shadow;
  typography: typeof typography;
  gradients: typeof gradients;
  motion: typeof motion;
  fontFamily: typeof fontFamily;
  onGradient: typeof onGradient;
};
