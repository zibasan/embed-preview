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
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          `-# You can close this settings screen at any time by pressing "Dismiss Message" below.`
        )
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
        content: "This command can only be used within a server.",
        flags: [MessageFlags.Ephemeral],
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
      flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
    });
  } catch (err) {
    console.error("[settings] Error processing settings command:", err);
    try {
      await interaction.followUp({
        content: "An error occurred while displaying the settings screen.",
        flags: [MessageFlags.Ephemeral],
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
        content: "This operation can only be performed within a server.",
        flags: [MessageFlags.Ephemeral],
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
        content: "An error occurred while updating the settings.",
        flags: [MessageFlags.Ephemeral],
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

// Builds the UI components for the settings command
export function buildSettingsComponents(
  client: Client,
  guild: any,
  settings: GuildSettings,
): any[] {
  const { mode, blacklist, whitelist } = settings;

  const container = new ContainerBuilder().setAccentColor(
    mode === "blacklist" ? 0x000000 : 0xffffff,
  ); // black | white

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent("## Blacklist / Whitelist Settings"),
  );

  const modeText = mode === "blacklist" ? "**🚫 Blacklist**" : "**✅ Whitelist**";

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`Current Mode: ${modeText}`),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
  );

  const blacklistSummary =
    `**Blacklist**\n` +
    `• Channels: ${blacklist.channels.length > 0 ? blacklist.channels.map((id) => `<#${id}>`).join(", ") : "None"}\n` +
    `• Users: ${blacklist.users.length > 0 ? blacklist.users.map((id) => `<@${id}>`).join(", ") : "None"}\n` +
    `• Roles: ${blacklist.roles.length > 0 ? blacklist.roles.map((id) => `<@&${id}>`).join(", ") : "None"}`;

  const whitelistSummary =
    `**Whitelist**\n` +
    `• Channels: ${whitelist.channels.length > 0 ? whitelist.channels.map((id) => `<#${id}>`).join(", ") : "None"}\n` +
    `• Users: ${whitelist.users.length > 0 ? whitelist.users.map((id) => `<@${id}>`).join(", ") : "None"}\n` +
    `• Roles: ${whitelist.roles.length > 0 ? whitelist.roles.map((id) => `<@&${id}>`).join(", ") : "None"}`;

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`${blacklistSummary}\n\n${whitelistSummary}`),
  );

  const components: any[] = [container];

  const toggleButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("settings:toggle_mode")
      .setLabel(mode === "blacklist" ? "Switch to Whitelist Mode" : "Switch to Blacklist Mode")
      .setStyle(ButtonStyle.Primary),
  );

  components.push(toggleButtonRow);

  return components;
}
