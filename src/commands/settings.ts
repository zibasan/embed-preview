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
  ModalBuilder,
  LabelBuilder,
  CheckboxGroupBuilder,
  CheckboxGroupOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { settingsManager, type GuildSettings } from "../utils/settingsManager.ts";

const toggleButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
    .setCustomId("settings:toggle_mode")
    .setLabel("Switch mode")
    .setStyle(ButtonStyle.Primary),
);

const actionButtonsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
    .setCustomId("settings:action_add")
    .setEmoji("✅")
    .setLabel("Add")
    .setStyle(ButtonStyle.Primary),
  new ButtonBuilder()
    .setCustomId("settings:action_delete")
    .setEmoji("🗑️")
    .setLabel("Delete")
    .setStyle(ButtonStyle.Danger),
);

const backButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
    .setCustomId("settings:main")
    .setEmoji("⬅️")
    .setLabel("Back")
    .setStyle(ButtonStyle.Secondary),
);

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
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# You can close this settings screen at any time by pressing "Dismiss Message" below.`,
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

    if (typeof customId === "string" && customId === "settings_modal:black_white") {
      settings.mode = settings.mode === "blacklist" ? "whitelist" : "blacklist";
      await settingsManager.setSettings(guildId, settings);

      const components = buildSettingsComponents(_client, interaction.guild, settings);
      await interaction.update({
        components,
        flags: [MessageFlags.IsComponentsV2],
      });
      return;
    }

    // Switching Mode Modal
    if (
      typeof customId === "string" &&
      (customId === "settings:toggle_mode" || customId === "settings:open_mode_modal")
    ) {
      const modal = buildModeModal(settings.mode);
      await interaction.showModal(modal);
      return;
    }

    // Choose target list
    if (
      typeof customId === "string" &&
      (customId === "settings:action_add" || customId === "settings:action_delete")
    ) {
      const action = customId === "settings:action_add" ? "add" : "delete";
      const components = buildSelectTargetListComponents(action);
      await interaction.reply({
        components,
        flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
      });
      return;
    }

    // Add/Del Modal
    if (typeof customId === "string" && customId.startsWith("settings:select_list:")) {
      const parts = customId.split(":");
      const action = parts[2] as "add" | "delete";
      const listType = parts[3] as "whitelist" | "blacklist";

      if (action === "add") {
        // 追加用 Modal を表示
        const modal = buildAddModal(listType);
        await interaction.showModal(modal);
        return;
      } else if (action === "delete") {
        const targetList = settings[listType];
        const totalItems =
          targetList.channels.length + targetList.users.length + targetList.roles.length;

        if (totalItems === 0) {
          const container = new ContainerBuilder()
            .setAccentColor(0xff0000)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                "## ⚠️ Error\nThere are no registered items to delete in this list.",
              ),
            );
          await interaction.reply({
            components: [container],
            flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
          });
          return;
        }

        if (totalItems > 25) {
          const components = await buildDeleteFallbackComponents(
            listType,
            settings,
            interaction.guild,
          );
          await interaction.update({
            components,
            flags: [MessageFlags.IsComponentsV2],
          });
          return;
        } else {
          const modal = await buildDeleteModal(listType, settings, interaction.guild);
          await interaction.showModal(modal);
          return;
        }
      }
    }

    // 3. 追加 Modal Submit
    if (typeof customId === "string" && customId.startsWith("settings_modal:add:")) {
      const listType = customId.split(":")[2] as "whitelist" | "blacklist";
      if (listType && settings[listType]) {
        if (interaction.fields) {
          try {
            const channelsStr = interaction.fields.getTextInputValue("add_channels") || "";
            const usersStr = interaction.fields.getTextInputValue("add_users") || "";
            const rolesStr = interaction.fields.getTextInputValue("add_roles") || "";

            const parseIds = (str: string) => str.match(/\d+/g) || [];

            for (const id of parseIds(channelsStr)) {
              if (!settings[listType].channels.includes(id)) settings[listType].channels.push(id);
            }
            for (const id of parseIds(usersStr)) {
              if (!settings[listType].users.includes(id)) settings[listType].users.push(id);
            }
            for (const id of parseIds(rolesStr)) {
              if (!settings[listType].roles.includes(id)) settings[listType].roles.push(id);
            }

            await settingsManager.setSettings(guildId, settings);
          } catch (e) {
            console.warn("[settings_modal:add] Error reading fields:", e);
          }
        }
      }

      const components = buildSettingsComponents(_client, interaction.guild, settings);
      await interaction.update({
        components,
        flags: [MessageFlags.IsComponentsV2],
      });
      return;
    }

    // 4. 削除 Modal Submit
    if (typeof customId === "string" && customId.startsWith("settings_modal:delete:")) {
      const listType = customId.split(":")[2] as "whitelist" | "blacklist";
      if (listType && settings[listType] && interaction.fields) {
        try {
          // TextInput または StringSelectMenu から削除値を取り出す
          const selectedValues: string[] = [];

          // 1) StringSelectMenu からの選択値 (delete_users, delete_roles, delete_channels)
          try {
            const usersVal = interaction.fields.getStringSelectMenuValues("delete_users");
            if (Array.isArray(usersVal)) selectedValues.push(...usersVal);
          } catch { }
          try {
            const rolesVal = interaction.fields.getStringSelectMenuValues("delete_roles");
            if (Array.isArray(rolesVal)) selectedValues.push(...rolesVal);
          } catch { }
          try {
            const channelsVal = interaction.fields.getStringSelectMenuValues("delete_channels");
            if (Array.isArray(channelsVal)) selectedValues.push(...channelsVal);
          } catch { }

          // 2) TextInput からの値
          try {
            const textVal = interaction.fields.getTextInputValue("delete_items");
            if (textVal) {
              const ids = textVal.match(/\d+/g) || [];
              for (const id of ids) {
                selectedValues.push(`:${id}`);
              }
            }
          } catch { }

          for (const item of selectedValues) {
            const parts = item.split(":");
            if (parts.length >= 3) {
              const targetType = parts[1] as "channels" | "users" | "roles";
              const id = parts[2];
              if (targetType && id && settings[listType][targetType]) {
                settings[listType][targetType] = settings[listType][targetType].filter(
                  (existingId) => existingId !== id,
                );
              }
            } else if (parts.length === 2 && parts[1]) {
              const id = parts[1];
              settings[listType].channels = settings[listType].channels.filter(
                (existingId) => existingId !== id,
              );
              settings[listType].users = settings[listType].users.filter(
                (existingId) => existingId !== id,
              );
              settings[listType].roles = settings[listType].roles.filter(
                (existingId) => existingId !== id,
              );
            }
          }

          await settingsManager.setSettings(guildId, settings);
        } catch (e) {
          console.warn("[settings_modal:delete] Error processing delete fields:", e);
        }
      }

      const components = buildSettingsComponents(_client, interaction.guild, settings);
      await interaction.update({
        components,
        flags: [MessageFlags.IsComponentsV2],
      });
      return;
    }

    // 5. フォールバック時の番号指定削除ボタン押下
    if (typeof customId === "string" && customId.startsWith("settings:prompt_delete_index:")) {
      const listType = customId.split(":")[2] as "whitelist" | "blacklist";
      const modal = buildDeleteByIndexModal(listType);
      await interaction.showModal(modal);
      return;
    }

    // 6. 番号指定削除 Modal Submit
    if (typeof customId === "string" && customId.startsWith("settings_modal:delete_by_index:")) {
      const listType = customId.split(":")[2] as "whitelist" | "blacklist";
      if (listType && settings[listType] && interaction.fields) {
        try {
          const indexStr = interaction.fields.getTextInputValue("delete_indices") || "";
          const numbers = (indexStr.match(/\d+/g) || []).map(Number);

          // 登録アイテムの一覧マップ（1-based）を生成
          const allItems: { type: "channels" | "users" | "roles"; id: string }[] = [
            ...settings[listType].channels.map((id) => ({ type: "channels" as const, id })),
            ...settings[listType].users.map((id) => ({ type: "users" as const, id })),
            ...settings[listType].roles.map((id) => ({ type: "roles" as const, id })),
          ];

          const idsToRemove = new Set<string>();
          for (const num of numbers) {
            if (num >= 1 && num <= allItems.length) {
              const item = allItems[num - 1];
              if (item) idsToRemove.add(item.id);
            }
          }

          if (idsToRemove.size > 0) {
            settings[listType].channels = settings[listType].channels.filter(
              (id) => !idsToRemove.has(id),
            );
            settings[listType].users = settings[listType].users.filter(
              (id) => !idsToRemove.has(id),
            );
            settings[listType].roles = settings[listType].roles.filter(
              (id) => !idsToRemove.has(id),
            );
            await settingsManager.setSettings(guildId, settings);
          }
        } catch (e) {
          console.warn("[settings_modal:delete_by_index] Error parsing indices:", e);
        }
      }

      const components = buildSettingsComponents(_client, interaction.guild, settings);
      await interaction.update({
        components,
        flags: [MessageFlags.IsComponentsV2],
      });
      return;
    }

    // 既存の direct settings:add / settings_remove 互換処理
    if (typeof customId === "string" && customId.startsWith("settings:add:")) {
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
  _client: Client,
  _guild: any,
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

  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Current Mode: ${modeText}`))
      .setButtonAccessory(toggleButtonRow.components[0] as ButtonBuilder),
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

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
  );

  const action_back_btn_row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...backButtonRow.components,
    ...actionButtonsRow.components,
  );

  container.addActionRowComponents(action_back_btn_row);

  const components: any[] = [container];

  return components;
}

/**
 * Builds the list selection UI (Choose Blacklist or Whitelist for Add/Delete action)
 */
export function buildSelectTargetListComponents(action: "add" | "delete"): any[] {
  const container = new ContainerBuilder().setAccentColor(0x4169e1);
  const actionTitle = action === "add" ? "Add Items" : "Delete Items";

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${actionTitle}\n\nPlease select which list to target:`),
  );

  const listButtonsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`settings:select_list:${action}:blacklist`)
      .setLabel("Blacklist")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`settings:select_list:${action}:whitelist`)
      .setLabel("Whitelist")
      .setStyle(ButtonStyle.Primary),
  );

  container.addActionRowComponents(listButtonsRow);

  return [container];
}

/**
 * Builds the modal for adding items (channels, users, roles)
 */
export function buildAddModal(listType: "whitelist" | "blacklist"): ModalBuilder {
  const modal = new ModalBuilder()
    .setTitle(`Add to ${listType === "blacklist" ? "Blacklist" : "Whitelist"}`)
    .setCustomId(`settings_modal:add:${listType}`)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `Please select *the users, roles, or channels* to add to **${listType}**.`,
      ),
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Users")
        .setDescription("You can specify up to 25 items.")
        .setUserSelectMenuComponent(
          new UserSelectMenuBuilder()
            .setCustomId("add_users")
            .setPlaceholder("@foo, @bar, ...")
            .setMaxValues(25)
            .setMinValues(1)
            .setRequired(false),
        ),

      new LabelBuilder()
        .setLabel("Roles")
        .setDescription("You can specify up to 25 items.")
        .setRoleSelectMenuComponent(
          new RoleSelectMenuBuilder()
            .setCustomId("add_roles")
            .setPlaceholder("@everyone, @moderators, ...")
            .setMaxValues(25)
            .setMinValues(1)
            .setRequired(false),
        ),

      new LabelBuilder()
        .setLabel("Channels")
        .setDescription("You can specify up to 25 items.")
        .setChannelSelectMenuComponent(
          new ChannelSelectMenuBuilder()
            .setCustomId("add_channels")
            .setPlaceholder("#general, #rule, ...")
            .setMaxValues(25)
            .setMinValues(1)
            .setRequired(false),
        ),

      new LabelBuilder()
        .setLabel("Are you sure you want to add these?")
        .setCheckboxGroupComponent(
          new CheckboxGroupBuilder()
            .setCustomId("add_confirm")
            .setRequired(true)
            .setMinValues(1)
            .setMaxValues(1)
            .setOptions(
              new CheckboxGroupOptionBuilder().setLabel("Yes, I'll add those.").setValue("Yes"),
            ),
        ),
    );

  return modal;
}

/**
 * Builds the modal for deleting registered items (normal case)
 */
export async function buildDeleteModal(
  listType: "whitelist" | "blacklist",
  settings: GuildSettings,
  guild?: any,
): Promise<ModalBuilder> {
  const modal = new ModalBuilder()
    .setTitle(`Delete from ${listType === "blacklist" ? "Blacklist" : "Whitelist"}`)
    .setCustomId(`settings_modal:delete:${listType}`)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `Please select *the users, roles, or channels* to delete from **${listType}**.`,
      ),
    );

  const targetList = settings[listType];

  const userOptions: StringSelectMenuOptionBuilder[] = [];
  for (const id of targetList.users) {
    let name = id;
    if (guild) {
      try {
        const member =
          guild.members?.cache?.get(id) || (await guild.members?.fetch(id).catch(() => null));
        if (member) {
          name = member.user?.username || member.displayName || id;
        }
      } catch { }
    }
    const label = `@${name} (${id})`.slice(0, 100);
    userOptions.push(
      new StringSelectMenuOptionBuilder().setLabel(label).setValue(`${listType}:users:${id}`),
    );
  }

  const roleOptions: StringSelectMenuOptionBuilder[] = [];
  for (const id of targetList.roles) {
    let name = id;
    if (guild) {
      try {
        const role =
          guild.roles?.cache?.get(id) || (await guild.roles?.fetch(id).catch(() => null));
        if (role) {
          name = role.name || id;
        }
      } catch { }
    }
    const label = `@${name} (${id})`.slice(0, 100);
    roleOptions.push(
      new StringSelectMenuOptionBuilder().setLabel(label).setValue(`${listType}:roles:${id}`),
    );
  }

  const channelOptions: StringSelectMenuOptionBuilder[] = [];
  for (const id of targetList.channels) {
    let name = id;
    if (guild) {
      try {
        const channel =
          guild.channels?.cache?.get(id) || (await guild.channels?.fetch(id).catch(() => null));
        if (channel) {
          name = channel.name || id;
        }
      } catch { }
    }
    const label = `#${name} (${id})`.slice(0, 100);
    channelOptions.push(
      new StringSelectMenuOptionBuilder().setLabel(label).setValue(`${listType}:channels:${id}`),
    );
  }

  if (userOptions.length > 0) {
    const userSelect = new StringSelectMenuBuilder()
      .setCustomId("delete_users")
      .setPlaceholder("@foo, @bar, ...")
      .setMaxValues(Math.min(userOptions.length, 25))
      .setMinValues(0)
      .setRequired(false)
      .setOptions(userOptions);

    modal.addLabelComponents(
      new LabelBuilder().setLabel("Users").setStringSelectMenuComponent(userSelect),
    );
  }

  if (roleOptions.length > 0) {
    const roleSelect = new StringSelectMenuBuilder()
      .setCustomId("delete_roles")
      .setPlaceholder("@everyone, @moderators, ...")
      .setMaxValues(Math.min(roleOptions.length, 25))
      .setMinValues(0)
      .setRequired(false)
      .setOptions(roleOptions);

    modal.addLabelComponents(
      new LabelBuilder().setLabel("Roles").setStringSelectMenuComponent(roleSelect),
    );
  }

  if (channelOptions.length > 0) {
    const channelSelect = new StringSelectMenuBuilder()
      .setCustomId("delete_channels")
      .setPlaceholder("#general, #rule, ...")
      .setMaxValues(Math.min(channelOptions.length, 25))
      .setMinValues(0)
      .setRequired(false)
      .setOptions(channelOptions);

    modal.addLabelComponents(
      new LabelBuilder().setLabel("Channels").setStringSelectMenuComponent(channelSelect),
    );
  }

  modal.addLabelComponents(
    new LabelBuilder()
      .setLabel("Are you sure you want to delete these?")
      .setCheckboxGroupComponent(
        new CheckboxGroupBuilder()
          .setCustomId("delete_confirm")
          .setRequired(true)
          .setMinValues(1)
          .setMaxValues(1)
          .setOptions(
            new CheckboxGroupOptionBuilder().setLabel("Yes, I'll delete those.").setValue("Yes"),
          ),
      ),
  );

  return modal;
}

/**
 * Builds the fallback UI when total registered items exceed 25.
 * Displays numbered list in codeblocks and a button to prompt for deletion by index.
 */
export async function buildDeleteFallbackComponents(
  listType: "whitelist" | "blacklist",
  settings: GuildSettings,
  guild?: any,
): Promise<any[]> {
  const container = new ContainerBuilder().setAccentColor(0xed4245);
  const targetList = settings[listType];

  let index = 1;
  let textList = `## Registered ${listType === "blacklist" ? "Blacklist" : "Whitelist"} Items\n\n`;

  if (targetList.users.length > 0) {
    const userLines: string[] = [];
    for (const id of targetList.users) {
      let name = id;
      if (guild) {
        try {
          const member =
            guild.members?.cache?.get(id) || (await guild.members?.fetch(id).catch(() => null));
          if (member) name = member.user?.username || member.displayName || id;
        } catch { }
      }
      userLines.push(`#${index++} ${name} (${id})`);
    }
    textList += `**Users:**\n\`\`\`\n${userLines.join("\n")}\n\`\`\`\n\n`;
  }

  if (targetList.roles.length > 0) {
    const roleLines: string[] = [];
    for (const id of targetList.roles) {
      let name = id;
      if (guild) {
        try {
          const role =
            guild.roles?.cache?.get(id) || (await guild.roles?.fetch(id).catch(() => null));
          if (role) name = role.name || id;
        } catch { }
      }
      roleLines.push(`#${index++} ${name} (${id})`);
    }
    textList += `**Roles:**\n\`\`\`\n${roleLines.join("\n")}\n\`\`\`\n\n`;
  }

  if (targetList.channels.length > 0) {
    const channelLines: string[] = [];
    for (const id of targetList.channels) {
      let name = id;
      if (guild) {
        try {
          const ch =
            guild.channels?.cache?.get(id) || (await guild.channels?.fetch(id).catch(() => null));
          if (ch) name = ch.name || id;
        } catch { }
      }
      channelLines.push(`#${index++} ${name} (${id})`);
    }
    textList += `**Channels:**\n\`\`\`\n${channelLines.join("\n")}\n\`\`\`\n\n`;
  }

  textList += `-# Total items exceed 25. Please use the button below to delete by item numbers.`;

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(textList));

  const promptButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`settings:prompt_delete_index:${listType}`)
      .setLabel("Delete by Item Numbers")
      .setStyle(ButtonStyle.Danger),
  );

  container.addActionRowComponents(promptButtonRow);

  return [container];
}

/**
 * Builds the modal for deleting items by index numbers (#1, #2...)
 */
export function buildDeleteByIndexModal(listType: "whitelist" | "blacklist"): ModalBuilder {
  const modal = new ModalBuilder()
    .setTitle(`Delete by Numbers (${listType})`)
    .setCustomId(`settings_modal:delete_by_index:${listType}`)
    .setLabelComponents(
      new LabelBuilder()
        .setLabel('Please enter the number of the item you want to delete.')
        .setDescription('e.g. 1, 2, 4, 6, ...')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId('delete_indices')
            .setMinLength(1)
            .setRequired(true)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('1, 2, 4, 6, ...')
        ),
      new LabelBuilder()
        .setLabel("Are you sure you want to delete these?")
        .setCheckboxGroupComponent(
          new CheckboxGroupBuilder()
            .setCustomId("delete_confirm")
            .setRequired(true)
            .setMinValues(1)
            .setMaxValues(1)
            .setOptions(
              new CheckboxGroupOptionBuilder().setLabel("Yes, I'll delete those.").setValue("Yes"),
            ),
        ),
    );

  return modal;
}

/**
 * Builds the mode configuration modal (customId: "settings_modal:black_white").
 * Frontend UI developers can construct and return the ModalBuilder here.
 */
export function buildModeModal(currentMode?: string): any {
  const modal = new ModalBuilder()
    .setTitle("Confirm")
    .setCustomId("settings_modal:black_white")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel(
          currentMode === "blacklist"
            ? "Really switch to whitelist mode?"
            : "Really switch to blacklist mode?",
        )
        .setCheckboxGroupComponent(
          new CheckboxGroupBuilder()
            .setCustomId("confirm_checkbox")
            .setMinValues(1)
            .setMaxValues(1)
            .setRequired(true)
            .setOptions(
              new CheckboxGroupOptionBuilder()
                .setLabel(
                  currentMode === "blacklist"
                    ? "Yes, I will switch to whitelist mode."
                    : "Yes, I will switch to blacklist mode.",
                )
                .setValue("Yes"),
            ),
        ),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        currentMode === "blacklist"
          ? "**When you switch to the whitelist, the bot will operate only for the users, roles, and channels registered on the whitelist.**"
          : "**When you switch to the blacklist mode, the bot will operate only for users, roles, and channels that are not on the blacklist.**",
      ),
    );

  return modal;
}
