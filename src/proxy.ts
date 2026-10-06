import { NextRequest, NextResponse } from "next/server";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function firstHeaderValue(value: string | null): string | undefined {
  return value?.split(",", 1)[0]?.trim() || undefined;
}

function publicRequestOrigin(request: NextRequest): string {
  // On a hosted deployment, Next may see an internal origin while the browser
  // talks to the public HTTPS domain. The proxy supplies these headers.
  const host = firstHeaderValue(request.headers.get("x-forwarded-host")) || request.headers.get("host");
  const forwardedProtocol = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol
    : request.nextUrl.protocol.slice(0, -1);

  if (!host) return request.nextUrl.origin;
  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return request.nextUrl.origin;
  }
}

export function proxy(request: NextRequest) {
  if (!UNSAFE_METHODS.has(request.method) || request.nextUrl.pathname === "/api/stripe/webhook") {
    return NextResponse.next();
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== publicRequestOrigin(request)) {
    return NextResponse.json({ error: "Cross-site request rejected" }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
