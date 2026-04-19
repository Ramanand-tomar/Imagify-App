/* eslint-disable no-console */

type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, scope: string, args: unknown[]): void {
  if (level === "debug" && !__DEV__) return;
  const prefix = `[${scope}]`;
  if (level === "error") console.error(prefix, ...args);
  else if (level === "warn") console.warn(prefix, ...args);
  else if (level === "info") console.info(prefix, ...args);
  else console.log(prefix, ...args);
}

export function createLogger(scope: string) {
  return {
    debug: (...args: unknown[]) => emit("debug", scope, args),
    info: (...args: unknown[]) => emit("info", scope, args),
    warn: (...args: unknown[]) => emit("warn", scope, args),
    error: (...args: unknown[]) => emit("error", scope, args),
  };
}
