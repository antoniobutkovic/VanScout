import type { Metadata } from "next";
import "../index.css";
import "maplibre-gl/dist/maplibre-gl.css";

export const metadata: Metadata = {
  title: "VanScout",
  description: "Request or offer transport services without the hassle.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="hr"><body>{children}</body></html>;
}
