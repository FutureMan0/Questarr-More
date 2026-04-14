import fs from "fs/promises";
import path from "path";
import { buildDownloadRoutingMeta } from "../shared/download-routing.js";
import { cleanReleaseName, releaseMatchesGame } from "../shared/title-utils.js";
import { logger } from "./logger.js";

const importerLogger = logger.child({ module: "importer" });

export interface AutoImportRequest {
  gameTitle: string;
  releaseTitle: string;
  gamePlatforms?: string[] | null;
  sourceRoot: string;
  libraryRoot: string;
  renameEnabled: boolean;
}

export interface AutoImportResult {
  imported: boolean;
  reason: string;
  sourcePath?: string;
  destinationPath?: string;
  consoleSlug?: string;
}

interface Candidate {
  name: string;
  absolutePath: string;
  isDirectory: boolean;
  score: number;
  modifiedAtMs: number;
}

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sanitizePathSegment(input: string): string {
  const noControls = Array.from(input.normalize("NFKD").replace(/[\u0300-\u036f]/g, ""), (c) =>
    c.charCodeAt(0) < 32 ? "_" : c
  ).join("");
  const cleaned = noControls
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Unknown";
}

function scoreCandidate(name: string, gameTitle: string): number {
  const normalizedName = normalize(name);
  const normalizedGame = normalize(gameTitle);
  const scoreByNormalizedMatch = (candidateName: string, maxScore = 80): number => {
    if (!candidateName || !normalizedGame) return 0;
    if (candidateName.includes(normalizedGame)) return maxScore;
    if (normalizedGame.includes(candidateName)) return maxScore - 10;

    const gameTokens = normalizedGame.split(" ").filter(Boolean);
    if (gameTokens.length === 0) return 0;
    const matchedTokens = gameTokens.filter((token) => candidateName.includes(token)).length;
    return Math.floor((matchedTokens / gameTokens.length) * 60);
  };

  if (releaseMatchesGame(name, gameTitle)) return 100;
  let score = scoreByNormalizedMatch(normalizedName, 80);

  const cleanedName = cleanReleaseName(name);
  const normalizedCleanedName = normalize(cleanedName);
  if (normalizedCleanedName && normalizedCleanedName !== normalizedName) {
    if (releaseMatchesGame(cleanedName, gameTitle)) {
      score = Math.max(score, 95);
    } else {
      score = Math.max(score, scoreByNormalizedMatch(normalizedCleanedName, 78));
    }
  }

  return score;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDirectory(targetPath: string): Promise<void> {
  await fs.mkdir(targetPath, { recursive: true });
}

async function moveWithFallback(sourcePath: string, destinationPath: string): Promise<void> {
  try {
    await fs.rename(sourcePath, destinationPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EXDEV") throw error;
    await fs.cp(sourcePath, destinationPath, { recursive: true, force: false });
    await fs.rm(sourcePath, { recursive: true, force: true });
  }
}

async function resolveUniquePath(targetPath: string): Promise<string> {
  if (!(await pathExists(targetPath))) return targetPath;

  const parsed = path.parse(targetPath);
  let counter = 1;
  while (counter < 1000) {
    const candidate = path.join(parsed.dir, `${parsed.name}-${counter}${parsed.ext}`);
    if (!(await pathExists(candidate))) return candidate;
    counter++;
  }

  throw new Error(`Could not resolve unique destination for: ${targetPath}`);
}

async function moveDirectoryContents(sourceDir: string, destinationDir: string): Promise<void> {
  await ensureDirectory(destinationDir);
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const desiredDest = path.join(destinationDir, entry.name);
    const uniqueDest = await resolveUniquePath(desiredDest);
    await moveWithFallback(sourcePath, uniqueDest);
  }
  await fs.rm(sourceDir, { recursive: true, force: true });
}

async function findBestCandidate(sourceRoot: string, gameTitle: string): Promise<Candidate | null> {
  const entries = await fs.readdir(sourceRoot, { withFileTypes: true });
  const candidates: Candidate[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const absolutePath = path.join(sourceRoot, entry.name);
    const score = scoreCandidate(entry.name, gameTitle);
    if (score <= 0) continue;

    const stats = await fs.stat(absolutePath);
    candidates.push({
      name: entry.name,
      absolutePath,
      isDirectory: entry.isDirectory(),
      score,
      modifiedAtMs: stats.mtimeMs,
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.modifiedAtMs - a.modifiedAtMs;
  });
  return candidates[0];
}

export async function importCompletedGame(request: AutoImportRequest): Promise<AutoImportResult> {
  const sourceRoot = path.resolve(request.sourceRoot);
  const libraryRoot = path.resolve(request.libraryRoot);

  const sourceStats = await fs.stat(sourceRoot).catch(() => null);
  if (!sourceStats || !sourceStats.isDirectory()) {
    return { imported: false, reason: `Source folder not found: ${sourceRoot}` };
  }

  const libraryStats = await fs.stat(libraryRoot).catch(() => null);
  if (!libraryStats || !libraryStats.isDirectory()) {
    return { imported: false, reason: `Library root not found: ${libraryRoot}` };
  }

  const candidate = await findBestCandidate(sourceRoot, request.gameTitle);
  if (!candidate) {
    return { imported: false, reason: "No matching files/folders found in source folder." };
  }

  const routing = buildDownloadRoutingMeta({
    releaseTitle: request.releaseTitle || request.gameTitle,
    gameTitle: request.gameTitle,
    gamePlatforms: request.gamePlatforms,
  });

  const consoleDir = path.join(libraryRoot, sanitizePathSegment(routing.consoleSlug));
  const gameDir = path.join(consoleDir, sanitizePathSegment(request.gameTitle));
  await ensureDirectory(consoleDir);
  await ensureDirectory(gameDir);

  if (candidate.isDirectory) {
    if (request.renameEnabled) {
      await moveDirectoryContents(candidate.absolutePath, gameDir);
      importerLogger.info(
        { gameTitle: request.gameTitle, sourcePath: candidate.absolutePath, gameDir },
        "Auto-imported directory into normalized game folder"
      );
      return {
        imported: true,
        reason: "Directory imported",
        sourcePath: candidate.absolutePath,
        destinationPath: gameDir,
        consoleSlug: routing.consoleSlug,
      };
    }

    const folderName = sanitizePathSegment(candidate.name);
    const targetPath = await resolveUniquePath(path.join(gameDir, folderName));
    await moveWithFallback(candidate.absolutePath, targetPath);
    importerLogger.info(
      { gameTitle: request.gameTitle, sourcePath: candidate.absolutePath, targetPath },
      "Auto-imported directory without rename"
    );
    return {
      imported: true,
      reason: "Directory imported",
      sourcePath: candidate.absolutePath,
      destinationPath: targetPath,
      consoleSlug: routing.consoleSlug,
    };
  }

  const filename = sanitizePathSegment(candidate.name);
  const targetPath = await resolveUniquePath(path.join(gameDir, filename));
  await moveWithFallback(candidate.absolutePath, targetPath);
  importerLogger.info(
    { gameTitle: request.gameTitle, sourcePath: candidate.absolutePath, targetPath },
    "Auto-imported file into game folder"
  );
  return {
    imported: true,
    reason: "File imported",
    sourcePath: candidate.absolutePath,
    destinationPath: targetPath,
    consoleSlug: routing.consoleSlug,
  };
}
