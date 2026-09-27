import type { ProviderModule } from "../module";

const clinepass: ProviderModule = {
  metadata: {
    name: "ClinePass",
    iconSlug: "clinepass",
    iconFallback: "Code",
    brandColor: "#61A3FA",
    usageSectionLabels: { primary: "5-hour", secondary: "Weekly", tertiary: "Monthly" },
    dashboardUrl: "https://app.cline.bot/dashboard/subscription?personal=true",
  },
  mock: { source: "api" },
};

export default clinepass;
