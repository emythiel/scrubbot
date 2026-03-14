import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { reloadConfig } from "../configFile.js";


// ---------------------------------------------------------------------------
// Command definition
// ---------------------------------------------------------------------------

export const data = new SlashCommandBuilder()
    .setName('config')
    .setDescription('Manage bot configuration')
    .addSubcommand(sub =>
        sub.setName('reload').setDescription('Reload config.toml settings')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);


// ---------------------------------------------------------------------------
// Command definition
// ---------------------------------------------------------------------------

// Subcommand registry: maps subcommand name -> handler function
const subcommands: Record<string, (interaction: ChatInputCommandInteraction) => Promise<void>> = {
    reload: handleReload
};

export async function execute(interaction: ChatInputCommandInteraction) {
    const handler = subcommands[interaction.options.getSubcommand()];
    if (handler) await handler(interaction);
}


// ---------------------------------------------------------------------------
// /config reload
// ---------------------------------------------------------------------------

async function handleReload(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let result;
    try {
        result = reloadConfig();
    } catch (error) {
        // Possible TOML syntax error in the file
        const message = error instanceof Error ? error.message : String(error);
        await interaction.editReply({
            content: `❌ Failed to reload config.\n\`\`\`\n${message}\n\`\`\``
        });
        return;
    }

    const lines: string[] = [];

    if (result.fixed.length > 0) {
        lines.push(
            `⚠️ **Invalid values reset to defaults:**`,
            ...result.fixed.map(k => `  • \`${k}\``)
        );
    }

    if (result.added.length > 0) {
        lines.push(
            `📝 **New keys added:**`,
            ...result.added.map(k => `  • \`${k}\``)
        );
    }

    if (result.removed.length > 0) {
        lines.push(
            `🗑️ **Deprecated keys removed:**`,
            ...result.removed.map(k => `  • \`${k}\``)
        );
    }

    const hasChanges = lines.length > 0;
    const summary = hasChanges ? lines.join('\n') : '✅ Config reloaded successfully. No issues found.';

    await interaction.editReply({ content: summary });
}
