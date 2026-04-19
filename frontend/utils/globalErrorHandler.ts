import { createLogger } from "./logger";

const log = createLogger("uncaught");

let installed = false;
let reporter: ((message: string, fatal: boolean) => void) | null = null;

export function setGlobalErrorReporter(fn: ((message: string, fatal: boolean) => void) | null) {
  reporter = fn;
}

/**
 * Install a single global handler that logs (and optionally surfaces) uncaught
 * JS errors. Safe to call multiple times — only installs once.
 *
 * Only non-fatal errors are reported to the UI; fatal errors let React Native's
 * red-box take over in dev.
 */
export function installGlobalErrorHandler() {
  if (installed) return;
  installed = true;

  const ErrorUtils = (global as unknown as {
    ErrorUtils?: {
      getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void;
      setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
    };
  }).ErrorUtils;

  if (!ErrorUtils?.getGlobalHandler || !ErrorUtils?.setGlobalHandler) return;

  const prev = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    log.error(isFatal ? "Fatal" : "Non-fatal", error?.message, error?.stack);
    if (!isFatal && reporter) {
      try {
        reporter(error?.message || "An unexpected error occurred", false);
      } catch {
        /* ignore */
      }
    }
    prev?.(error, isFatal);
  });
}
