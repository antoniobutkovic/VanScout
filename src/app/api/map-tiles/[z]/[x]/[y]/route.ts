import { NextResponse } from "next/server";
import { optionalEnv } from "@/lib/config";

function tileResponse(response: Response, provider: "openstreetmap" | "geoapify") {
  return new Response(response.body, {
    headers: {
      "Content-Type": response.headers.get("content-type") || "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
      "X-Map-Provider": provider,
    },
  });
}

export async function GET(_request: Request, context: { params: Promise<{ z: string; x: string; y: string }> }) {
  const { z: zValue, x: xValue, y: yValue } = await context.params;
  const z = Number.parseInt(zValue, 10);
  const x = Number.parseInt(xValue, 10);
  const y = Number.parseInt(yValue, 10);
  const tilesPerAxis = 2 ** z;
  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) || z < 0 || z > 18 || x < 0 || y < 0 || x >= tilesPerAxis || y >= tilesPerAxis) {
    return NextResponse.json({ error: "Invalid map tile" }, { status: 400 });
  }

  try {
    const osmResponse = await fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, {
      headers: { "User-Agent": "VanScout/1.0 (+https://github.com/antoniobutkovic/VanScout)" },
    });
    if (osmResponse.ok && !osmResponse.headers.has("x-blocked")) return tileResponse(osmResponse, "openstreetmap");
  } catch {
    // Fall through to the configured provider when OpenStreetMap is unavailable.
  }

  const apiKey = optionalEnv("GEOAPIFY_API_KEY");
  if (!apiKey) return NextResponse.json({ error: "Unable to load map tile" }, { status: 502 });
  try {
    const geoapifyResponse = await fetch(`https://maps.geoapify.com/v1/tile/osm-carto/${z}/${x}/${y}.png?apiKey=${encodeURIComponent(apiKey)}`);
    if (!geoapifyResponse.ok) return NextResponse.json({ error: "Unable to load map tile" }, { status: 502 });
    return tileResponse(geoapifyResponse, "geoapify");
  } catch {
    return NextResponse.json({ error: "Unable to load map tile" }, { status: 502 });
  }
}
