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
  const showModal = vi.fn().mockResolvedValue(undefined);

  return {
    deferReply,
    followUp,
    reply,
    update,
    showModal,
    guildId,
    guild: null,
  } as unknown as ChatInputCommandInteraction;
}

describe("設定コマンド バックエンドハンドラー", () => {
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

  it("ギルド外で実行された場合はエラーを返す", async () => {
    const interaction = createMockInteraction(null);

    await handleSettingCommand(interaction, {} as Client);

    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "This command can only be used within a server.",
      }),
    );
  });

  it("ギルド内で実行された場合はUIコンポーネントで返答する", async () => {
    const interaction = createMockInteraction("guild_123");

    await handleSettingCommand(interaction, {} as Client);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        components: expect.any(Array),
        flags: expect.arrayContaining([32768]),
      }),
    );
  });

  it("settings_modal:black_white送信時にモードが更新されsettings.jsonに保存される", async () => {
    await settingsManager.load();
    const initSettings = settingsManager.getSettings("guild_123");
    expect(initSettings.mode).toBe("blacklist");

    const update = vi.fn().mockResolvedValue(undefined);
    const mockModalSubmitInteraction = {
      guildId: "guild_123",
      customId: "settings_modal:black_white",
      fields: {
        getTextInputValue: vi.fn().mockReturnValue("whitelist"),
      },
      update,
    } as any;

    await handleSettingsInteraction(mockModalSubmitInteraction, {} as Client);

    const settings = settingsManager.getSettings("guild_123");
    expect(settings.mode).toBe("whitelist");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        components: expect.any(Array),
        flags: expect.arrayContaining([32768]),
      }),
    );
  });

  it("settings_modal:add:blacklist送信時にモーダルの入力値からアイテムが追加される", async () => {
    await settingsManager.load();
    const update = vi.fn().mockResolvedValue(undefined);
    const mockAddModalInteraction = {
      guildId: "guild_123",
      customId: "settings_modal:add:blacklist",
      fields: {
        getTextInputValue: vi.fn((id: string) => {
          if (id === "add_channels") return "111122223333";
          if (id === "add_users") return "444455556666";
          if (id === "add_roles") return "777788889999";
          return "";
        }),
      },
      update,
    } as any;

    await handleSettingsInteraction(mockAddModalInteraction, {} as Client);

    const settings = settingsManager.getSettings("guild_123");
    expect(settings.blacklist.channels).toContain("111122223333");
    expect(settings.blacklist.users).toContain("444455556666");
    expect(settings.blacklist.roles).toContain("777788889999");
  });

  it("登録アイテムが0件のときに削除を選択した場合はモーダルを表示せずエラーを返信する", async () => {
    await settingsManager.load();
    const reply = vi.fn().mockResolvedValue(undefined);
    const showModal = vi.fn().mockResolvedValue(undefined);

    const mockSelectDeleteZeroInteraction = {
      guildId: "guild_123",
      customId: "settings:select_list:delete:blacklist",
      reply,
      showModal,
    } as any;

    await handleSettingsInteraction(mockSelectDeleteZeroInteraction, {} as Client);

    expect(showModal).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith(
      expect.objectContaining({
        components: expect.any(Array),
        flags: expect.arrayContaining([64]),
      }),
    );
  });

  it("項目数が25件を超えた場合フォールバック一覧画面が表示され、番号入力Modal送信で該当アイテムが削除される", async () => {
    await settingsManager.load();
    const settings = settingsManager.getSettings("guild_123");
    // 26個のチャンネルを追加
    for (let i = 1; i <= 26; i++) {
      settings.blacklist.channels.push(`channel_${i}`);
    }
    await settingsManager.setSettings("guild_123", settings);

    const update = vi.fn().mockResolvedValue(undefined);
    const mockSelectDeleteInteraction = {
      guildId: "guild_123",
      customId: "settings:select_list:delete:blacklist",
      update,
    } as any;

    await handleSettingsInteraction(mockSelectDeleteInteraction, {} as Client);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        components: expect.any(Array),
      }),
    );

    // 番号指定削除 Modal Submit (1番目の channel_1 を削除)
    const mockDeleteIndexModalSubmit = {
      guildId: "guild_123",
      customId: "settings_modal:delete_by_index:blacklist",
      fields: {
        getTextInputValue: vi.fn().mockReturnValue("1"),
      },
      update,
    } as any;

    await handleSettingsInteraction(mockDeleteIndexModalSubmit, {} as Client);

    const updatedSettings = settingsManager.getSettings("guild_123");
    expect(updatedSettings.blacklist.channels).not.toContain("channel_1");
  });

  it("settings_removeインタラクションで項目が削除されsettings.jsonから除去される", async () => {
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
