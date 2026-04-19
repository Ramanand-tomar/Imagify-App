import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { Linking, Platform } from "react-native";

import { useAuthStore } from "@/stores/authStore";
import { resolveUrl } from "@/utils/env";

/** Strip filename chars that are invalid on FAT/NTFS/ext4. */
export function sanitizeFilename(name: string): string {
  const cleaned = (name || "").trim().replace(/[\/\\:*?"<>|]/g, "").replace(/\s+/g, " ");
  return cleaned || "file";
}

/**
 * Download (or reuse) the result file in the app's cache directory.
 * Returns the local `file://` URI on success.
 *
 * Important: only sends an Authorization header when the URL points back
 * to our own backend. ImageKit signed URLs already carry their own auth
 * in the query string, and an unexpected `Authorization: Bearer ...`
 * header would be an extra wire round-trip the CDN doesn't need.
 */
export async function downloadResultToCache(
  downloadUrl: string,
  filename: string,
): Promise<string> {
  if (!FileSystem.cacheDirectory) {
    throw new Error("Device storage is unavailable");
  }
  const safeName = sanitizeFilename(filename);
  const target = `${FileSystem.cacheDirectory}${safeName}`;

  const info = await FileSystem.getInfoAsync(target);
  // Re-download if missing or zero-byte from a prior failed attempt.
  if (info.exists && info.size && info.size > 0) {
    return target;
  }
  await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => {});

  const resolved = resolveUrl(downloadUrl);
  const isOurBackend = resolved.startsWith(
    (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, ""),
  );
  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = {};
  if (isOurBackend && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const result = await FileSystem.downloadAsync(resolved, target, { headers });
  if (result.status >= 400) {
    if (result.status === 401 || result.status === 403) {
      throw new Error("Your session expired. Please sign in again.");
    }
    throw new Error(`Download failed (HTTP ${result.status})`);
  }
  return result.uri;
}

/**
 * Persist the result to the device so the user can find it outside our app.
 *
 * - Images: saved to Photos / camera roll via expo-media-library.
 * - PDFs and other docs: there's no system "Documents" folder on iOS; we
 *   open the system share sheet pointed at "Save to Files / Drive" so the
 *   user can pick a destination. On Android the share sheet exposes the
 *   "Save to device" target as well.
 *
 * Returns a short, human-readable description of where it landed.
 */
export async function saveToDevice(
  localUri: string,
  mimeType: string,
  filename: string,
): Promise<string> {
  if (mimeType.startsWith("image/")) {
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (!perm.granted) {
      // Fall through to share sheet so the user can still keep the file.
      if (perm.canAskAgain === false) {
        Linking.openSettings().catch(() => {});
      }
      throw new Error("Photo library permission denied");
    }
    await MediaLibrary.saveToLibraryAsync(localUri);
    return Platform.OS === "ios" ? "Saved to Photos" : "Saved to Gallery";
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing is not available on this device");
  }
  await Sharing.shareAsync(localUri, {
    mimeType,
    UTI: mimeType,
    dialogTitle: `Save ${filename}`,
  });
  return "Use the share sheet to save the file";
}

/**
 * Open the file in a viewer.
 *
 * - PDFs and HTML: opened in an in-app browser (works cross-platform).
 *   We prefer this over launching an external app so the user stays
 *   inside Imagify.
 * - Images: should be displayed inline by the caller; this helper just
 *   returns false to let the caller render them.
 *
 * Returns true if a viewer was opened.
 */
export async function openInViewer(
  localUri: string,
  mimeType: string,
): Promise<boolean> {
  if (mimeType.startsWith("image/")) return false;

  // expo-web-browser handles file:// URIs with a PDF or HTML mime type
  // on Android via Chrome custom tabs, on iOS via SFSafariViewController.
  // Some Android distributions can't render PDFs from file:// — if it
  // throws, we fall back to opening with an external app.
  try {
    await WebBrowser.openBrowserAsync(localUri, {
      controlsColor: "#6366F1",
      enableBarCollapsing: true,
    });
    return true;
  } catch {
    try {
      await Linking.openURL(localUri);
      return true;
    } catch {
      return false;
    }
  }
}
