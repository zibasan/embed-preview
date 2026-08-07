import {
  type ChatInputCommandInteraction,
  type Client,
  SlashCommandBuilder,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ThumbnailBuilder,
  ActionRowBuilder,
} from "discord.js";
import { settingsManager, type GuildSettings } from "../utils/settingsManager.ts";

export const settingCommand = new SlashCommandBuilder()
  .setName("settings")
  .setDescription("Configure the bot settings");

export function buildMainSettingsComponents(guild: any): any[] {
  const container = new ContainerBuilder().setAccentColor(0x4169e1);
  if (guild?.iconURL()) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `## Embed Preview Bot Settings For "${guild?.name}"\n\nPlease select the item to configure.`,
          ),
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(guild.iconURL() as string)),
    );
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## Embed Preview Bot Settings For "${guild?.name}"\n\nPlease select the item to configure.`,
      ),
    );
  }

  container
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large),
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "### Blacklist / Whitelist\n\nYou can configure blacklists or whitelists for users, roles, and channels.",
          ),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setEmoji("➡️")
            .setCustomId("settings:black_white")
            .setStyle(ButtonStyle.Primary),
        ),
    );

  return [container];
}

export async function handleSettingCommand(
  interaction: ChatInputCommandInteraction,
  _client: Client,
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    try {
      await interaction.reply({
        content: "このコマンドはサーバー内でのみ実行できます。",
        ephemeral: true,
      });
    } catch (err) {
      console.error("[settings] Failed to send guild-only error response:", err);
    }
    return;
  }

  try {
    const components = buildMainSettingsComponents(interaction.guild);
    await interaction.reply({
      components,
      flags: [MessageFlags.IsComponentsV2],
    });
  } catch (err) {
    console.error("[settings] Error processing settings command:", err);
    try {
      await interaction.followUp({
        content: "設定画面の表示中にエラーが発生しました。",
        ephemeral: true,
      });
    } catch (followUpErr) {
      console.error("[settings] Failed to send fallback error response:", followUpErr);
    }
  }
}

/**
 * Handles component interactions for adding/removing items to/from whitelist or blacklist,
 * and navigating between settings screens.
 */
export async function handleSettingsInteraction(interaction: any, _client: Client): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    try {
      await interaction.reply({
        content: "この操作はサーバー内でのみ実行できます。",
        ephemeral: true,
      });
    } catch (err) {
      console.error("[settings_interaction] Failed to send guild-only error response:", err);
    }
    return;
  }

  try {
    await settingsManager.load();
    const settings = settingsManager.getSettings(guildId);
    const customId = interaction.customId;

    if (typeof customId === "string" && customId === "settings:main") {
      const components = buildMainSettingsComponents(interaction.guild);
      await interaction.update({
        components,
        flags: [MessageFlags.IsComponentsV2],
      });
      return;
    }

    if (typeof customId === "string" && customId === "settings:toggle_mode") {
      settings.mode = settings.mode === "blacklist" ? "whitelist" : "blacklist";
      await settingsManager.setSettings(guildId, settings);
    } else if (typeof customId === "string" && customId.startsWith("settings:set_mode:")) {
      const mode = customId.split(":")[2] as "blacklist" | "whitelist";

      if (mode === "blacklist" || mode === "whitelist") {
        settings.mode = mode;
        await settingsManager.setSettings(guildId, settings);
      }
    } else if (typeof customId === "string" && customId.startsWith("settings:add:")) {
      const parts = customId.split(":");
      const type = parts[2] as "whitelist" | "blacklist";
      const targetType = parts[3] as "channels" | "users" | "roles";

      if (type && targetType && interaction.values && interaction.values.length > 0) {
        const list = settings[type];
        if (list && Array.isArray(list[targetType])) {
          for (const id of interaction.values) {
            if (!list[targetType].includes(id)) {
              list[targetType].push(id);
            }
          }
          await settingsManager.setSettings(guildId, settings);
        }
      }
    } else if (
      customId === "settings_remove" ||
      (typeof customId === "string" && customId.startsWith("settings:remove"))
    ) {
      const selectedValue = interaction.values?.[0];
      if (selectedValue) {
        const [type, targetType, id] = selectedValue.split(":") as [
          "whitelist" | "blacklist",
          "channels" | "users" | "roles",
          string,
        ];
        if (type && targetType && id && settings[type]?.[targetType]) {
          settings[type][targetType] = settings[type][targetType].filter(
            (existingId: string) => existingId !== id,
          );
          await settingsManager.setSettings(guildId, settings);
        }
      }
    }

    const components = buildSettingsComponents(_client, interaction.guild, settings);
    await interaction.update({
      components,
      flags: [MessageFlags.IsComponentsV2],
    });
  } catch (err) {
    console.error("[settings_interaction] Error processing settings interaction:", err);
    try {
      await interaction.reply({
        content: "設定の更新中にエラーが発生しました。",
        ephemeral: true,
      });
    } catch (replyErr) {
      console.error("[settings_interaction] Failed to send fallback error response:", replyErr);
    }
  }
}

export async function handleSettingsRemoveInteraction(
  interaction: any,
  client: Client,
): Promise<void> {
  return handleSettingsInteraction(interaction, client);
}

/**
 * Builds the UI components for the settings command.
 * Frontend UI developers can modify or expand this function.
 */
export function buildSettingsComponents(
  client: Client,
  guild: any,
  settings: GuildSettings,
): any[] {
  const { mode, blacklist, whitelist } = settings;

  // 1. メインコンテナの作成
  const container = new ContainerBuilder()
    .setAccentColor(mode === "blacklist" ? 0xed4245 : 0x57f287); // 赤(ブラックリスト) / 緑(ホワイトリスト)

  // タイトル表示
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent("## ⚙️ サーバー設定 (Server Configuration)")
  );

  // 現在のモード表示
  const modeText = mode === "blacklist"
    ? "現在のモード: **🚫 ブラックリスト (指定アイテムを除外)**"
    : "現在のモード: **✅ ホワイトリスト (指定アイテムのみ許可)**";

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(modeText)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
  );

  // リストの現在の設定状態
  const blacklistSummary =
    `**ブラックリスト (Blacklist)**\n` +
    `• チャンネル: ${blacklist.channels.length > 0 ? blacklist.channels.map(id => `<#${id}>`).join(", ") : "なし"}\n` +
    `• ユーザー: ${blacklist.users.length > 0 ? blacklist.users.map(id => `<@${id}>`).join(", ") : "なし"}\n` +
    `• ロール: ${blacklist.roles.length > 0 ? blacklist.roles.map(id => `<@&${id}>`).join(", ") : "なし"}`;

  const whitelistSummary =
    `**ホワイトリスト (Whitelist)**\n` +
    `• チャンネル: ${whitelist.channels.length > 0 ? whitelist.channels.map(id => `<#${id}>`).join(", ") : "なし"}\n` +
    `• ユーザー: ${whitelist.users.length > 0 ? whitelist.users.map(id => `<@${id}>`).join(", ") : "なし"}\n` +
    `• ロール: ${whitelist.roles.length > 0 ? whitelist.roles.map(id => `<@&${id}>`).join(", ") : "なし"}`;

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`${blacklistSummary}\n\n${whitelistSummary}`)
  );

  // 2. コンポーネント配列の初期化
  const components: any[] = [container];

  // モード切替ボタン
  const toggleButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("settings:toggle_mode")
      .setLabel(mode === "blacklist" ? "ホワイトリストモードに切り替える" : "ブラックリストモードに切り替える")
      .setStyle(ButtonStyle.Primary)
  );

  components.push(toggleButtonRow);

  return components;
}
