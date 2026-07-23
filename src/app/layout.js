import "@fontsource/league-spartan/600.css";
import "@fontsource/league-spartan/700.css";
import "@fontsource/league-spartan/800.css";
import "@fontsource/open-sauce-one/400.css";
import "@fontsource/open-sauce-one/500.css";
import "@fontsource/open-sauce-one/600.css";
import "@fontsource/open-sauce-one/700.css";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { PermissionProvider } from "@/contexts/PermissionContext";
import { PwaProvider } from "@/contexts/PwaContext";
import { getServerBranding } from "@/lib/server/settingsServer";

export async function generateMetadata() {
  const branding = await getServerBranding();
  const companyName = branding.companyName || "GrowVest";
  const favicon = branding.iconLogoUrl || "/icons/growvest-pwa-192.png";
  const pwaIcon = branding.pwaAppleTouchIconUrl || branding.pwaIcon512Url || branding.pwaIcon192Url || favicon;

  return {
    title: {
      default: `${companyName} Investor & Reporting Tool`,
      template: `%s | ${companyName}`
    },
    description: `Secure ${companyName} investor reports, goals, documents, meetings and monthly reporting.`,
    applicationName: `${companyName} Investor`,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [{ url: favicon }],
      apple: [{ url: pwaIcon, sizes: "180x180", type: "image/png" }]
    },
    appleWebApp: {
      capable: true,
      title: `${companyName} Investor`,
      statusBarStyle: "black-translucent"
    },
    formatDetection: {
      telephone: false
    }
  };
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1F4ED8"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <PwaProvider>
          <BrandingProvider>
            <AuthProvider>
              <PermissionProvider>{children}</PermissionProvider>
            </AuthProvider>
          </BrandingProvider>
        </PwaProvider>
      </body>
    </html>
  );
}
