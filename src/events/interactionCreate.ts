import type { Interaction } from 'discord.js';
import * as giveawayCommand from '../commands/giveaway.js';
import * as foodcheckCommand from '../commands/foodcheck.js';

export async function execute(interaction: Interaction) {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'giveaway') {
            await giveawayCommand.execute(interaction);
        } else if (interaction.commandName === 'foodcheck') {
            await foodcheckCommand.execute(interaction);
        }
    } else if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('giveaway_')) {
            await giveawayCommand.handleModalSubmit(interaction);
        } else if (interaction.customId.startsWith('foodcheck_')) {
            await foodcheckCommand.handleModalSubmit(interaction);
        }
    } else if (interaction.isButton()) {
        if (interaction.customId.startsWith('giveaway_')) {
            await giveawayCommand.handleButtonClick(interaction);
        }
    } else if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('foodcheck_')) {
            await foodcheckCommand.handleSelectMenu(interaction);
        }
    }
}
