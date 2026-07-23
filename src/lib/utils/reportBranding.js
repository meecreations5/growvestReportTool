export function resolveReportBranding(report = {}, liveBranding = {}) {
  const snapshot = report?.brandingSnapshot || report?.branding || {};
  return { ...liveBranding, ...snapshot };
}

export function resolveReportTheme(report = {}, branding = {}, template = {}) {
  const appearance = template?.appearance || {};
  return {
    primaryColor: appearance.primaryColor || branding.primaryColor || "#1F4ED8",
    secondaryColor: appearance.secondaryColor || branding.secondaryColor || "#20B8CD",
    darkColor: appearance.darkColor || branding.darkColor || "#0B0B0F",
    dangerColor: branding.dangerColor || "#E53935",
    warningColor: branding.warningColor || "#F5B301",
    surfaceColor: branding.surfaceColor || "#F4F6F9",
    mutedColor: branding.mutedColor || "#6B7280"
  };
}
