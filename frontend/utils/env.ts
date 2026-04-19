const RAW_API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!RAW_API_URL && !__DEV__) {
  throw new Error(
    "EXPO_PUBLIC_API_URL is not set. Configure it in eas.json / .env before building a release.",
  );
}

export const API_BASE_URL = (RAW_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export function resolveUrl(raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${API_BASE_URL}${raw.startsWith("/") ? raw : `/${raw}`}`;
}
