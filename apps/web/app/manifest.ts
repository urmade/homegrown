import type { MetadataRoute } from "next";
import { getT, householdLocale } from "../lib/server";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = (await householdLocale().catch(() => null)) ?? "en";
  const t = await getT("core", locale);
  return {
    name: t("app.name"),
    short_name: t("app.name"),
    description: t("app.description"),
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f6f1",
    theme_color: "#3f7d4e",
    lang: locale,
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
