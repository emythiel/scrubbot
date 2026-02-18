import type { Interaction } from 'discord.js';
import * as giveawayCommand from '../commands/giveaway.js';

export async function execute(interaction: Interaction) {
    if (interaction.isChatInputCommand()) {
        // Handle slash commands
        if (interaction.commandName === 'giveaway') {
            await giveawayCommand.execute(interaction);
        }
    } else if (interaction.isModalSubmit()) {
        // Handle modal submissions
        await giveawayCommand.handleModalSubmit(interaction);
    } else if (interaction.isButton()) {
        // Handle button clicks
        await giveawayCommand.HandleButtonClick(interaction);
    }
}
