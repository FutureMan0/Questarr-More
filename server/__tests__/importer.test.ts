import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { importCompletedGame } from "../importer.js";

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

describe("importCompletedGame", () => {
  it("imports a matching directory into <library>/<console>/<game>", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "questarr-import-"));
    const sourceRoot = path.join(tempRoot, "source");
    const libraryRoot = path.join(tempRoot, "library");
    await fs.mkdir(sourceRoot, { recursive: true });
    await fs.mkdir(libraryRoot, { recursive: true });

    const releaseDir = path.join(sourceRoot, "New.Super.Mario.Bros.Wii-EUR-GRP");
    await fs.mkdir(releaseDir);
    await fs.writeFile(path.join(releaseDir, "game.wbfs"), "dummy");

    const result = await importCompletedGame({
      gameTitle: "New Super Mario Bros. Wii",
      releaseTitle: "New.Super.Mario.Bros.Wii-EUR-GRP",
      gamePlatforms: ["Nintendo Wii"],
      sourceRoot,
      libraryRoot,
      renameEnabled: true,
    });

    const expectedFile = path.join(libraryRoot, "Wii", "New Super Mario Bros. Wii", "game.wbfs");

    expect(result.imported).toBe(true);
    expect(await pathExists(expectedFile)).toBe(true);
    expect(await pathExists(releaseDir)).toBe(false);
  });

  it("keeps original folder name when rename is disabled", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "questarr-import-"));
    const sourceRoot = path.join(tempRoot, "source");
    const libraryRoot = path.join(tempRoot, "library");
    await fs.mkdir(sourceRoot, { recursive: true });
    await fs.mkdir(libraryRoot, { recursive: true });

    const releaseDirName = "Mario.Kart.Wii-PROPER";
    const releaseDir = path.join(sourceRoot, releaseDirName);
    await fs.mkdir(releaseDir);
    await fs.writeFile(path.join(releaseDir, "mk.wbfs"), "dummy");

    const result = await importCompletedGame({
      gameTitle: "Mario Kart Wii",
      releaseTitle: "Mario.Kart.Wii-PROPER",
      gamePlatforms: ["Nintendo Wii"],
      sourceRoot,
      libraryRoot,
      renameEnabled: false,
    });

    const expectedFile = path.join(libraryRoot, "Wii", "Mario Kart Wii", releaseDirName, "mk.wbfs");

    expect(result.imported).toBe(true);
    expect(await pathExists(expectedFile)).toBe(true);
  });

  it("matches scene-like folder names with duplicate platform token", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "questarr-import-"));
    const sourceRoot = path.join(tempRoot, "source");
    const libraryRoot = path.join(tempRoot, "library");
    await fs.mkdir(sourceRoot, { recursive: true });
    await fs.mkdir(libraryRoot, { recursive: true });

    const releaseDir = path.join(sourceRoot, "Mario.Kart.Wii.Wii");
    await fs.mkdir(releaseDir);
    await fs.writeFile(path.join(releaseDir, "mk.wbfs"), "dummy");

    const result = await importCompletedGame({
      gameTitle: "Mario Kart Wii",
      releaseTitle: "Mario.Kart.Wii.Wii",
      gamePlatforms: ["Nintendo Wii"],
      sourceRoot,
      libraryRoot,
      renameEnabled: true,
    });

    const expectedFile = path.join(libraryRoot, "Wii", "Mario Kart Wii", "mk.wbfs");

    expect(result.imported).toBe(true);
    expect(await pathExists(expectedFile)).toBe(true);
    expect(await pathExists(releaseDir)).toBe(false);
  });

  it("returns skipped result when no candidate matches the game", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "questarr-import-"));
    const sourceRoot = path.join(tempRoot, "source");
    const libraryRoot = path.join(tempRoot, "library");
    await fs.mkdir(sourceRoot, { recursive: true });
    await fs.mkdir(libraryRoot, { recursive: true });

    await fs.writeFile(path.join(sourceRoot, "Completely.Other.Game.iso"), "dummy");

    const result = await importCompletedGame({
      gameTitle: "New Super Mario Bros. Wii",
      releaseTitle: "New.Super.Mario.Bros.Wii",
      gamePlatforms: ["Nintendo Wii"],
      sourceRoot,
      libraryRoot,
      renameEnabled: true,
    });

    expect(result.imported).toBe(false);
    expect(result.reason).toContain("No matching files/folders");
  });
});
