import { getServerBranding } from "@/lib/server/settingsServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function iconType(url = "") {
  const value = String(url).toLowerCase();
  if (value.includes(".webp")) return "image/webp";
  if (value.includes(".jpg") || value.includes(".jpeg")) return "image/jpeg";
  return "image/png";
}

function icon(src, sizes, purpose = "any") {
  return { src, sizes, type: iconType(src), purpose };
}

export default async function manifest() {
  const branding = await getServerBranding();
  const companyName = branding.companyName || "GrowVest";
  const icon512 = branding.pwaIcon512Url || branding.iconLogoUrl || "/icons/growvest-pwa-512.png";
  const icon192 = branding.pwaIcon192Url || branding.pwaIcon512Url || branding.iconLogoUrl || "/icons/growvest-pwa-192.png";
  const maskableIcon = branding.pwaMaskableIconUrl || icon512 || "/icons/growvest-pwa-maskable-512.png";

  return {
    name: `${companyName} Investor`,
    short_name: companyName,
    description: `Secure ${companyName} investor reports, goals, meetings, documents and notifications.`,
    id: "/investor/dashboard",
    start_url: "/investor/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    background_color: branding.surfaceColor || "#F4F6F9",
    theme_color: branding.primaryColor || "#1F4ED8",
    orientation: "portrait-primary",
    categories: ["finance", "business", "productivity"],
    lang: "en-IN",
    icons: [
      icon(icon192, "192x192"),
      icon(icon512, "512x512"),
      icon(maskableIcon, "512x512", "maskable")
    ],
    shortcuts: [
      {
        name: "Latest reports",
        short_name: "Reports",
        description: `Open your published ${companyName} reports.`,
        url: "/investor/reports",
        icons: [icon(icon192, "192x192")]
      },
      {
        name: "Bucket List goals",
        short_name: "Goals",
        description: "Review your financial goals and progress.",
        url: "/investor/goals",
        icons: [icon(icon192, "192x192")]
      },
      {
        name: "Notifications",
        short_name: "Alerts",
        description: "Review recent investor notifications.",
        url: "/investor/notifications",
        icons: [icon(icon192, "192x192")]
      }
    ]
  };
}
