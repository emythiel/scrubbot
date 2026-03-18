import type { Interaction } from 'discord.js';
import { commands } from '../commands/registry.js';
import type { CommandModule } from '../types/command.js';

// ---------------------------------------------------------------------------
// Lookup maps / registratrion
// ---------------------------------------------------------------------------

const commandMap = new Map<string, CommandModule>(
    commands.map(cmd => [cmd.data.name, cmd])
);

function findCommandByPrefix(customId: string): CommandModule | undefined {
    for (const [name, cmd] of commandMap) {
        if (customId.startsWith(`${name}_`)) return cmd;
    }
}


// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function execute(interaction: Interaction) {
    if (interaction.isChatInputCommand()) {
        await commandMap.get(interaction.commandName)?.execute(interaction);

    } else if (interaction.isModalSubmit()) {
        await findCommandByPrefix(interaction.customId)?.handleModalSubmit?.(interaction);

    } else if (interaction.isButton()) {
        await findCommandByPrefix(interaction.customId)?.handleButtonClick?.(interaction);

    } else if (interaction.isStringSelectMenu()) {
        await findCommandByPrefix(interaction.customId)?.handleSelectMenu?.(interaction);
    }
}
