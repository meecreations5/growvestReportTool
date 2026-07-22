import EmailDiagnostics from "@/components/settings/EmailDiagnostics";
import SystemSettingsForm from "@/components/settings/SystemSettingsForm";
import PageHeader from "@/components/ui/PageHeader";

export default function SettingsPage() {
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Configuration" title="Branding and system settings" description="Manage report defaults, communication configuration, masters and SOP servicing rules." />
      <EmailDiagnostics />
      <SystemSettingsForm />
    </div>
  );
}
