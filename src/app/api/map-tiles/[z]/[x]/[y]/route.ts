import { NextResponse } from "next/server";
import { optionalEnv } from "@/lib/config";

export async function GET(_request: Request, context: { params: Promise<{ z: string; x: string; y: string }> }) {
  const { z: zValue, x: xValue, y: yValue } = await context.params;
  const z = Number.parseInt(zValue, 10);
  const x = Number.parseInt(xValue, 10);
  const y = Number.parseInt(yValue, 10);
  const tilesPerAxis = 2 ** z;
  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) || z < 0 || z > 18 || x < 0 || y < 0 || x >= tilesPerAxis || y >= tilesPerAxis) {
    return NextResponse.json({ error: "Invalid map tile" }, { status: 400 });
  }

  const apiKey = optionalEnv("GEOAPIFY_API_KEY");
  if (!apiKey) return NextResponse.json({ error: "Map is not configured" }, { status: 503 });

  try {
    const response = await fetch(`https://maps.geoapify.com/v1/tile/osm-carto/${z}/${x}/${y}.png?apiKey=${encodeURIComponent(apiKey)}`);
    if (!response.ok) return NextResponse.json({ error: "Unable to load map tile" }, { status: 502 });
    return new Response(await response.arrayBuffer(), {
      headers: {
        "Content-Type": response.headers.get("content-type") || "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to load map tile" }, { status: 502 });
  }
}
