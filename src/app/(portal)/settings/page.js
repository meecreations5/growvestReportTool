import PageHeader from "@/components/ui/PageHeader";
import SettingsHub from "@/components/settings/SettingsHub";

export default function SettingsPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Administration"
        title="Branding and system settings"
        description="Publish GrowVest’s visual identity across the application, Investor Portal, email communication, HTML reports and A4 PDFs, then manage operational configuration from one secure workspace."
      />
      <SettingsHub />
    </div>
  );
}
