import type { ProviderModule } from "../module";

const elevenlabs: ProviderModule = {
  metadata: {
    name: "ElevenLabs",
    iconSlug: "elevenlabs",
    iconFallback: "SpeakerOn",
    brandColor: "#EBEBE6",
    usageSectionLabels: { primary: "Credits", secondary: "Voices" },
    dashboardUrl: "https://elevenlabs.io/app/developers/usage",
    subscriptionDashboardUrl: "https://elevenlabs.io/app/subscription",
    statusPageUrl: "https://status.elevenlabs.io",
  },
  aliases: ["11labs", "eleven"],
  mock: { source: "api" },
};

export default elevenlabs;
