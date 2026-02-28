import type {
    Interaction,
    ChatInputCommandInteraction,
    ModalSubmitInteraction,
    ButtonInteraction,
    StringSelectMenuInteraction,
} from 'discord.js';
import * as giveawayCommand from '../commands/giveaway.js';
import * as foodcheckCommand from '../commands/foodcheck.js';


// ---------------------------------------------------------------------------
// Command module interface
// Each command file exports the handlers it supports. Optional handlers are
// only called when an interaction's customId starts with the command's name.
// ---------------------------------------------------------------------------

interface CommandModule {
    execute:            (interaction: ChatInputCommandInteraction) => Promise<void>;
    handleModalSubmit?: (interaction: ModalSubmitInteraction) => Promise<void>;
    handleButtonClick?: (interaction: ButtonInteraction) => Promise<void>;
    handleSelectMenu?:  (interaction: StringSelectMenuInteraction) => Promise<void>;
}


// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const commands = new Map<string, CommandModule>([
    ['giveaway',   giveawayCommand],
    ['foodcheck',  foodcheckCommand]
]);


// ---------------------------------------------------------------------------
// Prefix-based lookup for modal / button / select interactions
// ---------------------------------------------------------------------------

function findCommandByPrefix(customId: string): CommandModule | undefined {
    for (const [name, cmd] of commands) {
        if (customId.startsWith(`${name}_`)) return cmd;
    }
}


// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function execute(interaction: Interaction) {
    if (interaction.isChatInputCommand()) {
        await commands.get(interaction.commandName)?.execute(interaction);

    } else if (interaction.isModalSubmit()) {
        await findCommandByPrefix(interaction.customId)?.handleModalSubmit?.(interaction);

    } else if (interaction.isButton()) {
        await findCommandByPrefix(interaction.customId)?.handleButtonClick?.(interaction);

    } else if (interaction.isStringSelectMenu()) {
        await findCommandByPrefix(interaction.customId)?.handleSelectMenu?.(interaction);
    }
}
