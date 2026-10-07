/**
 * Reverse geocode (lat, lng) -> a city-ish place name, via OpenStreetMap's
 * Nominatim. Free, no API key, but its usage policy requires a descriptive
 * User-Agent identifying the app/contact and caps requests around 1/sec —
 * both fine here since check-ins happen one at a time. Best-effort: a
 * failure here must never block saving the check-in itself, so callers should treat a null return as "no
 * city available" rather than an error.
 */
export async function reverseGeocodeCity(lat, lng) {
  const userAgent = process.env.NOMINATIM_USER_AGENT;
  if (!userAgent) {
    console.warn(
      "NOMINATIM_USER_AGENT not set; skipping reverse geocoding (required by Nominatim's usage policy)."
    );
    return null;
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "10"); // city-level detail
  url.searchParams.set("addressdetails", "1");

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error("Nominatim reverse geocode returned non-OK status:", res.status);
      return null;
    }
    const data = await res.json();
    const addr = data.address || {};
    return addr.city || addr.town || addr.village || addr.county || null;
  } catch (err) {
    console.error("Reverse geocoding failed:", err);
    return null;
  }
}
