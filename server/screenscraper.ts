import { config } from "./config.js";
import { storage } from "./storage.js";
import { igdbLogger } from "./logger.js";

type SearchOptions = {
  limit?: number;
  mediaPreference?: "box-2d" | "box-3d" | "cartridge" | "screenshot";
};

type ScreenScraperMedia = {
  type?: string;
  url?: string;
  parent?: string;
};

type ScreenScraperGame = {
  id?: number | string;
  nom?: string;
  noms?: Array<{ text?: string; langue?: string }>;
  synopsis?: Array<{ text?: string; langue?: string }> | { text?: string };
  medias?: ScreenScraperMedia[] | { media?: ScreenScraperMedia[] };
  genres?: Array<{ nom?: string }>;
  systeme?: { nom?: string } | Array<{ nom?: string }>;
  dates?: Array<{ text?: string }>;
};

function normalizeMediaUrl(url: string | undefined): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url.replace(/^\/+/, "")}`;
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

class ScreenScraperClient {
  private baseUrl = "https://api.screenscraper.fr/api2/jeuRecherche.php";

  private async getCredentials(): Promise<{
    user?: string;
    password?: string;
    devId?: string;
    devPassword?: string;
  }> {
    const dbUser = await storage.getSystemConfig("screenscraper.user");
    const dbPassword = await storage.getSystemConfig("screenscraper.password");

    return {
      user: dbUser || config.screenscraper.user,
      password: dbPassword || config.screenscraper.password,
      devId: config.screenscraper.devId,
      devPassword: config.screenscraper.devPassword,
    };
  }

  async isConfigured(): Promise<boolean> {
    const creds = await this.getCredentials();
    return !!(creds.user && creds.password && creds.devId && creds.devPassword);
  }

  private pickPreferredMedia(
    medias: ScreenScraperMedia[],
    preference: SearchOptions["mediaPreference"]
  ): string {
    const preferType = preference ?? "box-2d";
    const candidates = medias.filter((m) => typeof m.url === "string" && m.url.length > 0);
    if (candidates.length === 0) return "";

    const byType = (needle: string) =>
      candidates.find((m) => (m.type || "").toLowerCase().includes(needle));

    const ordered =
      preferType === "box-3d"
        ? [byType("box-3d"), byType("box"), byType("sstitle"), byType("screenshot")]
        : preferType === "cartridge"
          ? [byType("cartridge"), byType("box"), byType("sstitle"), byType("screenshot")]
          : preferType === "screenshot"
            ? [byType("screenshot"), byType("sstitle"), byType("box")]
            : [byType("box-2d"), byType("box"), byType("sstitle"), byType("screenshot")];

    const selected = ordered.find(Boolean) || candidates[0];
    return normalizeMediaUrl(selected?.url);
  }

  private extractTitle(game: ScreenScraperGame): string {
    const translated = toArray(game.noms).find((n) => n?.text);
    return (translated?.text || game.nom || "").trim();
  }

  private extractSummary(game: ScreenScraperGame): string {
    const entries = toArray(game.synopsis);
    const first = entries.find((s) => s?.text);
    return (first?.text || "").trim();
  }

  private extractPlatforms(game: ScreenScraperGame): string[] {
    const systems = toArray(game.systeme);
    return systems.map((s) => s?.nom || "").filter(Boolean);
  }

  private mapGame(game: ScreenScraperGame, options: SearchOptions) {
    const title = this.extractTitle(game);
    const id = String(game.id || title);
    const medias = Array.isArray(game.medias)
      ? game.medias
      : toArray((game.medias as { media?: ScreenScraperMedia[] } | undefined)?.media);
    const coverUrl = this.pickPreferredMedia(medias, options.mediaPreference);
    const genres = toArray(game.genres)
      .map((g) => g?.nom || "")
      .filter(Boolean);
    const releaseDate =
      toArray(game.dates)
        .map((d) => d?.text || "")
        .find(Boolean) || "";

    return {
      id: `screenscraper-${id}`,
      igdbId: null,
      title,
      summary: this.extractSummary(game),
      coverUrl,
      releaseDate,
      rating: 0,
      platforms: this.extractPlatforms(game),
      genres,
      publishers: [],
      developers: [],
      screenshots: medias
        .filter((m) => (m.type || "").toLowerCase().includes("screenshot"))
        .map((m) => normalizeMediaUrl(m.url))
        .filter(Boolean)
        .slice(0, 6),
      status: null,
      releaseYear: null,
      isReleased: false,
    };
  }

  async searchGames(query: string, options: SearchOptions = {}) {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const creds = await this.getCredentials();
    if (!creds.user || !creds.password || !creds.devId || !creds.devPassword) {
      igdbLogger.warn("ScreenScraper search skipped: credentials missing");
      return [];
    }

    const params = new URLSearchParams({
      devid: creds.devId,
      devpassword: creds.devPassword,
      softname: "Questarr",
      output: "json",
      ssid: creds.user,
      sspassword: creds.password,
      romtype: "rom",
      romnom: trimmed,
    });

    const response = await fetch(`${this.baseUrl}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`ScreenScraper API error: ${response.status}`);
    }

    const payload = (await response.json()) as {
      response?: { jeux?: ScreenScraperGame[] | { jeu?: ScreenScraperGame[] } };
      jeux?: ScreenScraperGame[] | { jeu?: ScreenScraperGame[] };
    };

    const rootJeux = payload.response?.jeux ?? payload.jeux;
    const games = Array.isArray(rootJeux)
      ? rootJeux
      : toArray((rootJeux as { jeu?: ScreenScraperGame[] } | undefined)?.jeu);

    return games
      .map((g) => this.mapGame(g, options))
      .filter((g) => g.title.length > 0)
      .slice(0, options.limit ?? 20);
  }
}

export const screenScraperClient = new ScreenScraperClient();
