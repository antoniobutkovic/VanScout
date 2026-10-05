const GOOGLE_MAPS_HOSTS = new Set(["maps.google.com", "maps.app.goo.gl"]);

/** Returns a safe Google Maps URL when the value is a Google Maps link. */
export function googleMapsUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return null;

    const hostname = url.hostname.toLowerCase();
    if (GOOGLE_MAPS_HOSTS.has(hostname)) return url.toString();
    if (hostname === "goo.gl" && url.pathname.startsWith("/maps")) return url.toString();
    if (hostname === "www.google.com" && url.pathname.startsWith("/maps")) return url.toString();
    return null;
  } catch {
    return null;
  }
}
