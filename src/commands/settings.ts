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
} from "discord.js";
import { settingsManager, type GuildSettings } from "../utils/settingsManager.ts";

export const settingCommand = new SlashCommandBuilder()
  .setName("settings")
  .setDescription("Configure the bot settings");

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
    const container = new ContainerBuilder().setAccentColor(0x4169e1);

    container
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "## Embed Preview Bot Settings\n\nPlease select the item to configure.",
        ),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large),
      )
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder()
              .setContent(
                "### Blacklist / Whitelist\n\nYou can configure blacklists or whitelists for users, roles, and channels."
              ),
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setEmoji("➡️")
              .setCustomId("settings:black_white")
              .setStyle(ButtonStyle.Primary)
          ),
      );

    await interaction.reply({
      components: [container],
      flags: [MessageFlags.IsComponentsV2],
    });

    /*
    await settingsManager.load();
    const settings = settingsManager.getSettings(guildId);
    const components = buildSettingsComponents(_client, interaction.guild, settings);
    await interaction.followUp({
      components,
      flags: [MessageFlags.IsComponentsV2],
    });
    */
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
 * Handles component interactions for adding/removing items to/from whitelist or blacklist.
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
  _client: Client,
  _guild: any,
  _settings: GuildSettings,
): any[] {
  return [];
}
