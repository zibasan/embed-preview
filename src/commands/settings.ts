import { type ChatInputCommandInteraction, type Client, SlashCommandBuilder } from "discord.js";
import { settingsManager } from "../utils/settingsManager.ts";

export const settingCommand = new SlashCommandBuilder()
  .setName("settings")
  .setDescription("Configure the bot settings")
  .addStringOption((opt) =>
    opt
      .setName("type")
      .setDescription("The type of list to configure")
      .setRequired(false)
      .addChoices(
        { name: "whitelist", value: "whitelist" },
        { name: "blacklist", value: "blacklist" },
      ),
  )
  .addStringOption((opt) =>
    opt
      .setName("action")
      .setDescription("The action to perform (add or remove)")
      .setRequired(false)
      .addChoices({ name: "add", value: "add" }, { name: "remove", value: "remove" }),
  )
  .addChannelOption((opt) =>
    opt.setName("channel").setDescription("The channel to add or remove").setRequired(false),
  )
  .addUserOption((opt) =>
    opt.setName("user").setDescription("The user to add or remove").setRequired(false),
  )
  .addRoleOption((opt) =>
    opt.setName("role").setDescription("The role to add or remove").setRequired(false),
  );

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

  const type = interaction.options.getString("type") as "whitelist" | "blacklist" | null;
  const action = interaction.options.getString("action") as "add" | "remove" | null;
  const channel = interaction.options.getChannel("channel");
  const user = interaction.options.getUser("user");
  const role = interaction.options.getRole("role");

  const hasType = type !== null;
  const hasAction = action !== null;
  const hasTarget = channel !== null || user !== null || role !== null;

  // 1. もし引数が「すべて空」なら、対話的UIを返す（Task 2 ではプレースホルダー）
  if (!hasType && !hasAction && !hasTarget) {
    try {
      await interaction.reply({ content: "対話的設定UIは未実装です" });
    } catch (err) {
      console.error("[settings] Failed to send placeholder response:", err);
    }
    return;
  }

  // 2. もし type または action が指定されているが、channel、user、role のいずれも指定されていない場合は、エラーメッセージを返す。
  if ((hasType || hasAction) && !hasTarget) {
    try {
      await interaction.reply({
        content:
          "設定を変更するには、変更対象（チャンネル、ユーザー、またはロール）を指定してください。",
        ephemeral: true,
      });
    } catch (err) {
      console.error("[settings] Failed to send validation error response:", err);
    }
    return;
  }

  // 3. もし channel、user、role のいずれかが指定されているが、type または action が指定されていない場合も、エラーメッセージを返す。
  if (hasTarget && (!hasType || !hasAction)) {
    try {
      await interaction.reply({
        content: "設定を変更するには、type と action の両方を指定してください。",
        ephemeral: true,
      });
    } catch (err) {
      console.error("[settings] Failed to send validation error response:", err);
    }
    return;
  }

  // validation checks passed, now call deferReply
  try {
    await interaction.deferReply();
  } catch (err) {
    console.error("[settings] Failed to defer reply:", err);
    return;
  }

  try {
    // 設定のロード
    await settingsManager.load();
    const settings = settingsManager.getSettings(guildId);
    const list = settings[type!];
    const responseParts: string[] = [];

    if (channel) {
      const channelName =
        "name" in channel && channel.name ? `#${channel.name}` : `チャンネル <#${channel.id}>`;
      if (action === "add") {
        if (!list.channels.includes(channel.id)) {
          list.channels.push(channel.id);
        }
        responseParts.push(
          `チャンネル ${channelName} を${type === "whitelist" ? "ホワイトリスト" : "ブラックリスト"}に追加しました。`,
        );
      } else {
        list.channels = list.channels.filter((id) => id !== channel.id);
        responseParts.push(
          `チャンネル ${channelName} を${type === "whitelist" ? "ホワイトリスト" : "ブラックリスト"}から削除しました。`,
        );
      }
    }

    if (user) {
      const userName = user.tag;
      if (action === "add") {
        if (!list.users.includes(user.id)) {
          list.users.push(user.id);
        }
        responseParts.push(
          `ユーザー ${userName} を${type === "whitelist" ? "ホワイトリスト" : "ブラックリスト"}に追加しました。`,
        );
      } else {
        list.users = list.users.filter((id) => id !== user.id);
        responseParts.push(
          `ユーザー ${userName} を${type === "whitelist" ? "ホワイトリスト" : "ブラックリスト"}から削除しました。`,
        );
      }
    }

    if (role) {
      const roleName = `@${role.name}`;
      if (action === "add") {
        if (!list.roles.includes(role.id)) {
          list.roles.push(role.id);
        }
        responseParts.push(
          `ロール ${roleName} を${type === "whitelist" ? "ホワイトリスト" : "ブラックリスト"}に追加しました。`,
        );
      } else {
        list.roles = list.roles.filter((id) => id !== role.id);
        responseParts.push(
          `ロール ${roleName} を${type === "whitelist" ? "ホワイトリスト" : "ブラックリスト"}から削除しました。`,
        );
      }
    }

    // 設定の保存
    await settingsManager.setSettings(guildId, settings);

    const finalMessage = responseParts.join("\n");
    await interaction.followUp({ content: finalMessage });
  } catch (err) {
    console.error("[settings] Error in setting command execution:", err);
    try {
      await interaction.followUp({
        content: "設定の保存中にエラーが発生しました。",
        ephemeral: true,
      });
    } catch (followUpErr) {
      console.error("[settings] Failed to send fallback error response:", followUpErr);
    }
  }
}
