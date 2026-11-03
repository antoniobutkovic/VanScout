import type { Metadata, Viewport } from "next";
import "../index.css";
import "maplibre-gl/dist/maplibre-gl.css";

export const metadata: Metadata = {
  title: "VanScout",
  description: "Request or offer transport services without the hassle.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#f4f1ea",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="hr"><body>{children}</body></html>;
}
