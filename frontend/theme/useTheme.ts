import { useColorScheme } from "react-native";

import {
  colors,
  fontFamily,
  gradients,
  motion,
  onGradient,
  radius,
  shadowDark,
  shadowLight,
  spacing,
  typography,
  type Theme,
} from "./tokens";

export function useAppTheme(): Theme {
  const scheme = useColorScheme();
  const mode = scheme === "dark" ? "dark" : "light";
  return {
    mode,
    colors: colors[mode],
    spacing,
    radius,
    shadow: mode === "dark" ? shadowDark : shadowLight,
    typography,
    gradients,
    motion,
    fontFamily,
    onGradient,
  };
}
