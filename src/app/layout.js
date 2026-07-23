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

export const metadata = {
  title: "GrowVest Investor & Reporting Tool",
  description: "Staff lead operations and secure investor monthly reporting for GrowVest."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <BrandingProvider>
          <AuthProvider><PermissionProvider>{children}</PermissionProvider></AuthProvider>
        </BrandingProvider>
      </body>
    </html>
  );
}
