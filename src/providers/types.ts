export type ProviderUsageSectionLabels = {
  primary: string;
  secondary?: string;
  tertiary?: string;
};

export type ProviderIconFallback =
  | "AppWindow"
  | "ArrowRightCircle"
  | "BarChart"
  | "Bolt"
  | "Box"
  | "Bubble"
  | "Cloud"
  | "Code"
  | "Globe"
  | "Microphone"
  | "Network"
  | "Person"
  | "SpeakerOn"
  | "Stars"
  | "Terminal"
  | "TwoPeople";

export type ProviderCatalogEntry = {
  name: string;
  iconSlug: string;
  iconFallback?: ProviderIconFallback;
  brandColor: string;
  usageSectionLabels: ProviderUsageSectionLabels;
  dashboardUrl?: string;
  subscriptionDashboardUrl?: string;
  statusPageUrl?: string;
};
