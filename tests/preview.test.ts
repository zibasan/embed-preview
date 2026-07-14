import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { type ChatInputCommandInteraction, type Client } from "discord.js";
import { handlePreviewCommand } from "../src/commands/preview.ts";
import { settingsManager } from "../src/utils/settingsManager.ts";
import { fetchTargetMessage } from "../src/utils/fetcher.ts";

vi.mock("../src/utils/fetcher.ts", () => ({
  fetchTargetMessage: vi.fn(),
}));

vi.mock("../src/utils/previewCore.ts", () => ({
  buildPreviewPayload: vi.fn(),
}));

const TEST_FILE = path.resolve("tests/temp-preview-settings.json");

describe("Preview Command Integration with Settings", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    (settingsManager as any).filepath = TEST_FILE;
    (settingsManager as any).cache = { guilds: {} };
    if (fs.existsSync(TEST_FILE)) {
      await fs.promises.unlink(TEST_FILE);
    }
  });

  afterEach(async () => {
    if (fs.existsSync(TEST_FILE)) {
      try {
        await fs.promises.unlink(TEST_FILE);
      } catch {
        // ignore
      }
    }
  });

  function createMockInteraction(options: {
    guildId?: string | null;
    channelId?: string;
    userId?: string;
    roles?: string[] | { cache: Map<string, any> };
    link?: string;
  }) {
    const deferReply = vi.fn().mockResolvedValue(undefined);
    const followUp = vi.fn().mockResolvedValue(undefined);
    const getString = vi.fn().mockImplementation((name: string) => {
      if (name === "link") return options.link ?? "https://discord.com/channels/123/456/789";
      return null;
    });

    return {
      deferReply,
      followUp,
      guildId: options.guildId !== undefined ? options.guildId : "123",
      channelId: options.channelId ?? "456",
      user: { id: options.userId ?? "user_abc" },
      member: {
        roles: options.roles ?? { cache: new Map() },
      },
      options: {
        getString,
      },
    } as unknown as ChatInputCommandInteraction;
  }

  it("should allow preview by default if there are no settings restrictions", async () => {
    const interaction = createMockInteraction({
      guildId: "123",
      channelId: "456",
      userId: "user_abc",
    });

    (fetchTargetMessage as any).mockResolvedValue(null);

    await handlePreviewCommand(interaction, {} as Client);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(fetchTargetMessage).toHaveBeenCalled();
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: "Message not found." }),
    );
  });

  it("should restrict preview if channel is blacklisted", async () => {
    await settingsManager.load();
    const settings = settingsManager.getSettings("123");
    settings.blacklist.channels.push("456");
    await settingsManager.setSettings("123", settings);

    const interaction = createMockInteraction({
      guildId: "123",
      channelId: "456",
      userId: "user_abc",
    });

    await handlePreviewCommand(interaction, {} as Client);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(fetchTargetMessage).not.toHaveBeenCalled();
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "このチャンネル、ユーザー、またはロールではプレビューが制限されています。",
        ephemeral: true,
      }),
    );
  });

  it("should restrict preview if user is blacklisted", async () => {
    await settingsManager.load();
    const settings = settingsManager.getSettings("123");
    settings.blacklist.users.push("user_abc");
    await settingsManager.setSettings("123", settings);

    const interaction = createMockInteraction({
      guildId: "123",
      channelId: "456",
      userId: "user_abc",
    });

    await handlePreviewCommand(interaction, {} as Client);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(fetchTargetMessage).not.toHaveBeenCalled();
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "このチャンネル、ユーザー、またはロールではプレビューが制限されています。",
        ephemeral: true,
      }),
    );
  });

  it("should restrict preview if role is blacklisted (cache roles)", async () => {
    await settingsManager.load();
    const settings = settingsManager.getSettings("123");
    settings.blacklist.roles.push("role_bad");
    await settingsManager.setSettings("123", settings);

    const cache = new Map();
    cache.set("role_bad", { id: "role_bad" });
    const interaction = createMockInteraction({
      guildId: "123",
      channelId: "456",
      userId: "user_abc",
      roles: { cache },
    });

    await handlePreviewCommand(interaction, {} as Client);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(fetchTargetMessage).not.toHaveBeenCalled();
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "このチャンネル、ユーザー、またはロールではプレビューが制限されています。",
        ephemeral: true,
      }),
    );
  });

  it("should restrict preview if role is blacklisted (array roles)", async () => {
    await settingsManager.load();
    const settings = settingsManager.getSettings("123");
    settings.blacklist.roles.push("role_bad");
    await settingsManager.setSettings("123", settings);

    const interaction = createMockInteraction({
      guildId: "123",
      channelId: "456",
      userId: "user_abc",
      roles: ["role_bad"],
    });

    await handlePreviewCommand(interaction, {} as Client);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(fetchTargetMessage).not.toHaveBeenCalled();
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "このチャンネル、ユーザー、またはロールではプレビューが制限されています。",
        ephemeral: true,
      }),
    );
  });

  it("should bypass restrictions if outside a guild (DM)", async () => {
    const interaction = createMockInteraction({
      guildId: null,
      channelId: "dm_chan",
      userId: "user_abc",
    });

    (fetchTargetMessage as any).mockResolvedValue(null);

    await handlePreviewCommand(interaction, {} as Client);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(fetchTargetMessage).toHaveBeenCalled();
  });
});
