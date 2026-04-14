import { parseReleaseMetadata } from "./title-utils.js";

type ConsoleSlug =
  | "Switch"
  | "WiiU"
  | "Wii"
  | "3DS"
  | "DS"
  | "PS5"
  | "PS4"
  | "XboxSeries"
  | "XboxOne"
  | "Xbox360"
  | "PC"
  | "PSP"
  | "PSVita"
  | "Unknown";

interface ResolveConsoleInput {
  platformHint?: string;
  gamePlatforms?: string[] | null;
  releaseTitle: string;
}

interface SceneNameInput extends ResolveConsoleInput {
  gameTitle?: string;
}

export interface DownloadRoutingMeta {
  consoleSlug: ConsoleSlug;
  sceneTitle: string;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function toSceneToken(value: string): string {
  const sanitized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");

  return sanitized || "Unknown";
}

function mapPlatformToConsoleSlug(platform: string): ConsoleSlug | undefined {
  const normalized = normalize(platform);

  if (
    normalized.includes("nintendo switch") ||
    normalized === "switch" ||
    normalized.includes("nsw")
  ) {
    return "Switch";
  }
  if (normalized.includes("wii u") || normalized === "wiiu") return "WiiU";
  if (normalized === "wii" || normalized.includes("nintendo wii")) return "Wii";
  if (normalized.includes("nintendo 3ds") || normalized === "3ds") return "3DS";
  if (
    normalized.includes("nintendo ds") ||
    normalized === "ds" ||
    normalized.includes("nds")
  ) {
    return "DS";
  }
  if (normalized.includes("playstation 5") || normalized === "ps5") return "PS5";
  if (normalized.includes("playstation 4") || normalized === "ps4") return "PS4";
  if (normalized.includes("xbox series")) return "XboxSeries";
  if (normalized.includes("xbox one")) return "XboxOne";
  if (normalized.includes("xbox 360") || normalized === "x360") return "Xbox360";
  if (normalized === "pc" || normalized.includes("windows")) return "PC";
  if (normalized === "psp") return "PSP";
  if (normalized.includes("vita")) return "PSVita";

  return undefined;
}

export function resolveConsoleSlug(input: ResolveConsoleInput): ConsoleSlug {
  if (input.platformHint) {
    const direct = mapPlatformToConsoleSlug(input.platformHint);
    if (direct) return direct;
  }

  if (input.gamePlatforms?.length) {
    for (const platform of input.gamePlatforms) {
      const mapped = mapPlatformToConsoleSlug(platform);
      if (mapped) return mapped;
    }
  }

  const releaseMetadata = parseReleaseMetadata(input.releaseTitle);
  if (releaseMetadata.platform) {
    const mapped = mapPlatformToConsoleSlug(releaseMetadata.platform);
    if (mapped) return mapped;
  }

  const releaseText = normalize(input.releaseTitle);
  if (/\b(wii u|wiiu)\b/.test(releaseText)) return "WiiU";
  if (/\b(wii)\b/.test(releaseText)) return "Wii";
  if (/\b(3ds)\b/.test(releaseText)) return "3DS";
  if (/\b(nds|nintendo ds|ds)\b/.test(releaseText)) return "DS";
  if (/\b(switch|nsw)\b/.test(releaseText)) return "Switch";

  return "Unknown";
}

function extractRegionTag(releaseTitle: string): string | undefined {
  const match = releaseTitle.match(/\b(EUR|USA|US|JPN|JAP|JP|PAL|NTSC|WORLD|MULTI)\b/i);
  if (!match?.[1]) return undefined;

  const region = match[1].toUpperCase();
  if (region === "US") return "USA";
  if (region === "JAP" || region === "JP") return "JPN";
  return region;
}

export function buildSceneLikeName(input: SceneNameInput): string {
  const metadata = parseReleaseMetadata(input.releaseTitle);
  const consoleSlug = resolveConsoleSlug(input);
  const baseTitle = toSceneToken(input.gameTitle || metadata.gameTitle || input.releaseTitle);
  const region = extractRegionTag(input.releaseTitle);
  const version = metadata.version ? toSceneToken(metadata.version) : undefined;
  const group = metadata.group ? toSceneToken(metadata.group) : undefined;

  const tokens = [baseTitle];
  if (consoleSlug !== "Unknown") tokens.push(consoleSlug);
  if (region) tokens.push(region);
  if (version) tokens.push(version);

  const body = tokens.join(".");
  return group ? `${body}-${group}` : body;
}

export function buildDownloadRoutingMeta(input: SceneNameInput): DownloadRoutingMeta {
  const consoleSlug = resolveConsoleSlug(input);
  const sceneTitle = buildSceneLikeName(input);

  return { consoleSlug, sceneTitle };
}
