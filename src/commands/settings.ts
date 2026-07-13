import { type ChatInputCommandInteraction, type Client, SlashCommandBuilder } from "discord.js";

export const settingCommand = new SlashCommandBuilder()
  .setName("settings")
  .setDescription("Configure the bot settings");

export async function handleSettingCommand(
  interaction: ChatInputCommandInteraction,
  _client: Client,
): Promise<void> {
  try {
    await interaction.deferReply();
  } catch (err) {
    console.error("[settings] Failed to defer reply:", err);
    return;
  }
}
