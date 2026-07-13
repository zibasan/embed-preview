import { type ChatInputCommandInteraction, Client, Events, GatewayIntentBits } from "discord.js";
import { config } from "dotenv";
import { registerMessageCreateEvent } from "./events/messageCreate.ts";
import { handlePreviewCommand, registerSlashCommands } from "./commands/preview.ts";
import { handleSettingCommand } from "./commands/settings.ts";
import { isOpenOriginalButton } from "./utils/buttons.ts";

config();

const TOKEN = process.env["DISCORD_TOKEN"];
if (!TOKEN) {
  console.error("[index] DISCORD_TOKEN is not set in .env");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

registerMessageCreateEvent(client);

client.on(Events.ClientReady, async (readyClient) => {
  console.log(`[index] Bot logged in as ${readyClient.user.tag}`);
  try {
    await registerSlashCommands(readyClient, TOKEN);
    console.log("[index] Slash commands registered");
  } catch (err) {
    console.error("[index] Failed to register slash commands:", err);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === "preview") {
      await handlePreviewCommand(interaction as ChatInputCommandInteraction, client);
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "settings") {
      await handleSettingCommand(interaction as ChatInputCommandInteraction, client);
      return;
    }

    if (isOpenOriginalButton(interaction)) {
      const row = interaction.message.components[0];
      const urlComponent = row && "components" in row ? row.components[1] : undefined;
      const originalUrl =
        urlComponent && "url" in urlComponent && urlComponent.url != null
          ? urlComponent.url
          : "メッセージリンクが見つかりません";
      await interaction.reply({ content: originalUrl, ephemeral: true });
    }
  } catch (err) {
    console.error("[index] InteractionCreate handler error:", err);
  }
});

await client.login(TOKEN);
