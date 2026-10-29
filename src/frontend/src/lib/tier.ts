export type TierLevel = "starter" | "pro" | "elite";

export function getTier(accessCode: string): TierLevel {
  if (accessCode.endsWith("-E")) return "elite";
  if (accessCode.endsWith("-P")) return "pro";
  if (accessCode.endsWith("-S")) return "starter";
  return "elite"; // legacy codes (no suffix) default to elite
}

export function canUploadImages(tier: TierLevel): boolean {
  return tier === "pro" || tier === "elite";
}

export function canUseGlowCoach(tier: TierLevel): boolean {
  return tier === "pro" || tier === "elite";
}

export function canGenerateRoadmap(tier: TierLevel): boolean {
  return tier === "elite";
}

export function canUseIntegrations(tier: TierLevel): boolean {
  return tier === "pro" || tier === "elite";
}

export function isEliteTier(tier: TierLevel): boolean {
  return tier === "elite";
}

export function upgradeMessageFor(
  feature:
    | "image"
    | "coach"
    | "roadmap"
    | "integrations"
    | "google_sync"
    | "theme",
): string {
  if (feature === "image" || feature === "coach") {
    return "This feature is part of our Pro Collection. Visit your member dashboard to expand your access.";
  }
  if (feature === "integrations") {
    return "Third-Party Integrations are part of our Pro Collection. Upgrade to Pro or Elite to connect Notion, Slack, Zapier, and more.";
  }
  if (feature === "google_sync") {
    return "Phone Syncing is a premium feature. Upgrade to Pro or Elite to bring your Roadmap to your Google Calendar.";
  }
  if (feature === "theme") {
    return "Unlock Aesthetics: Upgrade to Pro to customize your portal's vibe.";
  }
  return "This feature is part of our Elite Collection. Visit your member dashboard to expand your access.";
}

export function canUseGoogleSync(tier: TierLevel): boolean {
  return tier === "pro" || tier === "elite";
}

/**
 * Returns tier-specific event title and description.
 * Pro  → title: "Elevatria Task"
 * Elite → title: "✨ [Task Name]"
 */
export function getCalendarEventDetails(
  tier: TierLevel,
  taskName: string,
): { title: string; description: string } {
  if (tier === "elite") {
    return {
      title: `\u2728 ${taskName}`,
      description:
        "\u2728 Elite Vision Roadmap: You are manifesting your highest self.",
    };
  }
  // Pro (and fallback)
  return {
    title: "Elevatria Task",
    description: "Elevatria Pro Task: Stay on track with your vision.",
  };
}

export function canCustomizeTheme(tier: TierLevel): boolean {
  return tier === "pro" || tier === "elite";
}

export function canUseCustomHex(tier: TierLevel): boolean {
  return tier === "elite";
}
