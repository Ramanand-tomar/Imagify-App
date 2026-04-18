import { useColorScheme } from "react-native";

import {
  colors,
  fontFamily,
  gradients,
  motion,
  radius,
  shadow,
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
    shadow,
    typography,
    gradients,
    motion,
    fontFamily,
  };
}
