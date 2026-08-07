import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { type ChatInputCommandInteraction, type Client } from "discord.js";
import {
  handleSettingCommand,
  handleSettingsInteraction,
  handleSettingsRemoveInteraction,
} from "../src/commands/settings.ts";
import { settingsManager } from "../src/utils/settingsManager.ts";

const TEST_FILE = path.resolve("tests/temp-command-settings.json");

function createMockInteraction(guildId: string | null = "guild_123") {
  const deferReply = vi.fn().mockResolvedValue(undefined);
  const followUp = vi.fn().mockResolvedValue(undefined);
  const reply = vi.fn().mockResolvedValue(undefined);
  const update = vi.fn().mockResolvedValue(undefined);

  return {
    deferReply,
    followUp,
    reply,
    update,
    guildId,
    guild: null,
  } as unknown as ChatInputCommandInteraction;
}

describe("Settings Command Backend Handler", () => {
  beforeEach(async () => {
    (settingsManager as any).filepath = TEST_FILE;
    (settingsManager as any).cache = { guilds: {} };
    if (fs.existsSync(TEST_FILE)) {
      await fs.promises.unlink(TEST_FILE);
    }
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (fs.existsSync(TEST_FILE)) {
      try {
        await fs.promises.unlink(TEST_FILE);
      } catch {
        // ignore
      }
    }
  });

  it("should fail when executed outside a guild", async () => {
    const interaction = createMockInteraction(null);

    await handleSettingCommand(interaction, {} as Client);

    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "This command can only be used within a server.",
      }),
    );
  });

  it("should reply with UI components when executed in a guild", async () => {
    const interaction = createMockInteraction("guild_123");

    await handleSettingCommand(interaction, {} as Client);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        components: expect.any(Array),
        flags: expect.arrayContaining([32768]),
      }),
    );
  });

  it("should handle settings:toggle_mode interaction and save to settings.json", async () => {
    await settingsManager.load();
    const initSettings = settingsManager.getSettings("guild_123");
    expect(initSettings.mode).toBe("blacklist");

    const update = vi.fn().mockResolvedValue(undefined);
    const mockToggleInteraction = {
      guildId: "guild_123",
      customId: "settings:toggle_mode",
      update,
    } as any;

    await handleSettingsInteraction(mockToggleInteraction, {} as Client);

    const settings = settingsManager.getSettings("guild_123");
    expect(settings.mode).toBe("whitelist");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        components: expect.any(Array),
        flags: expect.arrayContaining([32768]),
      }),
    );
  });

  it("should handle settings:add interaction and save to settings.json", async () => {
    await settingsManager.load();

    const update = vi.fn().mockResolvedValue(undefined);
    const mockAddInteraction = {
      guildId: "guild_123",
      customId: "settings:add:blacklist:channels",
      values: ["chan_999"],
      update,
    } as any;

    await handleSettingsInteraction(mockAddInteraction, {} as Client);

    const settings = settingsManager.getSettings("guild_123");
    expect(settings.blacklist.channels).toContain("chan_999");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        components: expect.any(Array),
        flags: expect.arrayContaining([32768]),
      }),
    );
  });

  it("should handle settings_remove interaction and remove item from settings.json", async () => {
    await settingsManager.load();
    const initSettings = settingsManager.getSettings("guild_123");
    initSettings.blacklist.users.push("user_888");
    await settingsManager.setSettings("guild_123", initSettings);

    const update = vi.fn().mockResolvedValue(undefined);
    const mockRemoveInteraction = {
      guildId: "guild_123",
      customId: "settings_remove",
      values: ["blacklist:users:user_888"],
      update,
    } as any;

    await handleSettingsRemoveInteraction(mockRemoveInteraction, {} as Client);

    const settings = settingsManager.getSettings("guild_123");
    expect(settings.blacklist.users).not.toContain("user_888");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        components: expect.any(Array),
        flags: expect.arrayContaining([32768]),
      }),
    );
  });
});
