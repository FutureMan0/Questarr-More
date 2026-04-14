import { type Game } from "@shared/schema";

export interface OwnershipStatusChip {
  icon: "check" | "minus" | "x" | null;
  visible: boolean;
  className: string;
}

export interface ConsoleChip {
  label: string;
  className: string;
}

const CONSOLE_SHORT_MAP: Record<string, string> = {
  "Nintendo Switch": "Switch",
  "Super Nintendo Entertainment System": "SNES",
  "Nintendo Entertainment System": "NES",
  "Game Boy Advance": "GBA",
  "Game Boy Color": "GBC",
  "Game Boy": "GB",
  "Nintendo GameCube": "GC",
  "Nintendo 64": "N64",
  "Nintendo 3DS": "3DS",
  "Nintendo DS": "DS",
  "Nintendo Wii U": "WiiU",
  "Nintendo Wii": "Wii",
  "Sega Mega Drive/Genesis": "MD",
  "Sega Dreamcast": "DC",
  "Sony PlayStation": "PS1",
  "PlayStation 5": "PS5",
  "PlayStation 4": "PS4",
  "PlayStation 3": "PS3",
  "PlayStation 2": "PS2",
  "PlayStation Portable": "PSP",
  "PlayStation Vita": "PSVita",
  "Xbox Series X|S": "XboxSeries",
  "Xbox Series": "XboxSeries",
  "Xbox One": "XboxOne",
  "Xbox 360": "Xbox360",
  "Xbox": "Xbox",
  "PC (Microsoft Windows)": "PC",
  Windows: "PC",
};

export function getPrimaryConsoleLabel(game: Game): string {
  const primary = game.platforms?.[0];
  if (!primary) return "Unknown";
  if (CONSOLE_SHORT_MAP[primary]) return CONSOLE_SHORT_MAP[primary];

  const normalized = primary.toLowerCase();
  if (normalized.includes("super nintendo")) return "SNES";
  if (normalized.includes("nintendo entertainment system")) return "NES";
  if (normalized.includes("game boy advance")) return "GBA";
  if (normalized.includes("game boy color")) return "GBC";
  if (normalized === "game boy" || normalized.includes(" game boy")) return "GB";
  if (normalized.includes("nintendo 64")) return "N64";
  if (normalized.includes("gamecube")) return "GC";
  if (normalized.includes("playstation portable")) return "PSP";
  if (normalized.includes("playstation vita")) return "PSVita";
  if (normalized.includes("playstation 2")) return "PS2";
  if (normalized === "sony playstation" || normalized.includes("playstation 1")) return "PS1";
  if (normalized.includes("mega drive") || normalized.includes("genesis")) return "MD";
  if (normalized.includes("dreamcast")) return "DC";

  return primary;
}

export function getConsoleChip(game: Game): ConsoleChip {
  const label = getPrimaryConsoleLabel(game);
  const normalized = label.toLowerCase();

  if (
    normalized.includes("switch") ||
    normalized.includes("nintendo") ||
    /^wii|^3ds|^ds/.test(normalized)
  ) {
    return {
      label,
      className: "border-red-300/70 bg-red-500/90 text-white",
    };
  }

  if (/^ps/i.test(label)) {
    return {
      label,
      className: "border-blue-300/70 bg-blue-500/90 text-white",
    };
  }

  if (/^xbox/i.test(label)) {
    return {
      label,
      className: "border-emerald-300/70 bg-emerald-500/90 text-white",
    };
  }

  if (/^pc/i.test(label) || /windows/i.test(label)) {
    return {
      label,
      className: "border-violet-300/70 bg-violet-500/90 text-white",
    };
  }

  return {
    label,
    className: "border-slate-300/60 bg-slate-700/90 text-white",
  };
}

export function getOwnershipStatusChip(status?: string | null): OwnershipStatusChip {
  const normalized = (status ?? "").toLowerCase();

  if (normalized === "owned" || normalized === "completed") {
    return {
      icon: "check",
      visible: true,
      className: "text-emerald-500 ring-emerald-300/70",
    };
  }

  if (
    normalized === "downloading" ||
    normalized === "wanted" ||
    normalized === "requested" ||
    normalized === "pending" ||
    normalized === "queued"
  ) {
    return {
      icon: "minus",
      visible: true,
      className: "text-orange-500 ring-orange-300/70",
    };
  }

  if (
    normalized === "error" ||
    normalized === "failed" ||
    normalized === "problem" ||
    normalized === "stalled" ||
    normalized === "broken"
  ) {
    return {
      icon: "x",
      visible: true,
      className: "text-red-500 ring-red-300/70",
    };
  }

  return {
    icon: null,
    visible: false,
    className: "",
  };
}
