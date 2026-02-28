import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags,
    LabelBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} from 'discord.js';
import type {
    ChatInputCommandInteraction,
    ModalSubmitInteraction,
    StringSelectMenuInteraction,
} from 'discord.js';
import * as db from '../database/foodcheck.js';
import { fetchFoodItemData, fetchGuildStorage, fetchWikiUrls } from '../integrations/gw2-api.js';
import { createFoodAddedEmbed, createFoodStatusEmbed } from '../utils/embeds/foodcheck.js';
import { FOODCHECK_CONFIG, GW2_CONFIG } from '../config.js';


// ---------------------------------------------------------------------------
// Command definition
// ---------------------------------------------------------------------------

export const data = new SlashCommandBuilder()
    .setName('foodcheck')
    .setDescription('Manage guild storage food monitorting')
    .addSubcommand(sub =>
        sub.setName('add').setDescription('Add a food item to monitor')
    )
    .addSubcommand(sub =>
        sub.setName('remove').setDescription('Remove a food item from monitoring')
    )
    .addSubcommand(sub =>
        sub.setName('status').setDescription('Show current stock levels for all tracked foods')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);


// ---------------------------------------------------------------------------
// Subcommand dispatcher
// ---------------------------------------------------------------------------

// Subcommand registry: maps subcommand name -> handler function
const subcommands: Record<string, (interaction: ChatInputCommandInteraction) => Promise<void>> = {
    add:    handleAdd,
    remove: handleRemove,
    status: handleStatus,
};

export async function execute(interaction: ChatInputCommandInteraction) {
    const handler = subcommands[interaction.options.getSubcommand()];
    if (handler) await handler(interaction);
}

export async function handleModalSubmit(interaction: ModalSubmitInteraction) {
    if (interaction.customId === 'foodcheck_add_modal') {
        await handleAddModalSubmit(interaction);
    }
}

export async function handleSelectMenu(interaction: StringSelectMenuInteraction) {
    if (interaction.customId === 'foodcheck_remove_select') {
        await handleRemoveSelect(interaction);
    }
}


// ---------------------------------------------------------------------------
// /foodcheck add
// ---------------------------------------------------------------------------

async function handleAdd(interaction: ChatInputCommandInteraction) {
    const modal = new ModalBuilder()
        .setCustomId('foodcheck_add_modal')
        .setTitle('Add Food Item')

    const wikiUrlInput = new TextInputBuilder()
        .setCustomId('wiki_url')
        .setPlaceholder('https://wiki.guildwars2.com/wiki/Peppercorn-Crusted_Sous-Vide_Steak')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(512);
    const wikiUrlLabel = new LabelBuilder()
        .setLabel('Wiki URL')
        .setDescription('Link to the Guild Wars 2 Wiki page for the food item')
        .setTextInputComponent(wikiUrlInput);

    modal.setLabelComponents(wikiUrlLabel);

    await interaction.showModal(modal);
}

async function handleAddModalSubmit(interaction: ModalSubmitInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const wikiUrl = interaction.fields.getTextInputValue('wiki_url').trim();

    // Scrape wiki page for GW2 API and GW2 Efficiency URLs
    let wikiUrls;
    try {
        wikiUrls = await fetchWikiUrls(wikiUrl);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        await interaction.editReply({
            content: `❌ Failed to read the wiki page.\n\n**Reason:** ${message}`
        });
        return;
    }

    // Fetch item data from GW2 API
    let itemData;
    try {
        itemData = await fetchFoodItemData(wikiUrls.apiUrl);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        await interaction.editReply({
            content: `❌ Failed to fetch item data from the GW2 API.\n\n**Reason:** ${message}`
        });
        return;
    }

    // Guard against duplicates
    const existing = db.getFoodById(itemData.guild_upgrade_id);
    if (existing) {
        await interaction.editReply({
            content: `❌ **${existing.name}** is already in the database!`
        });
        return;
    }

    // Add to database
    try {
        db.addFood({
            guild_upgrade_id: itemData.guild_upgrade_id,
            name: itemData.name,
            icon: itemData.icon,
            wiki_url: wikiUrl,
            gw2_efficiency_url: wikiUrls.gw2EfficiencyUrl
        });
    } catch (error) {
        console.error('Error saving food to database:', error);
        await interaction.editReply({
            content: '❌ Failed to save food item to the database. Please try again.'
        });
        return;
    }

    await interaction.editReply({
        embeds: [createFoodAddedEmbed(itemData, wikiUrl, wikiUrls.gw2EfficiencyUrl, FOODCHECK_CONFIG.threshold)]
    });
}


// ---------------------------------------------------------------------------
// /foodcheck remove
// ---------------------------------------------------------------------------

async function handleRemove(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const foods = db.getAllFoods();

    if (foods.length === 0) {
        await interaction.editReply({
            content: 'ℹ️ No food items are currently in the database. Use `/foodcheck add` to add some.'
        });
        return;
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('foodcheck_remove_select')
        .setPlaceholder('Select a food item to stop tracking...')
        .addOptions(
            foods.map(food =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(food.name)
                    .setDescription(`Guild Upgrade ID: ${food.guild_upgrade_id}`)
                    .setValue(String(food.guild_upgrade_id))
            )
        );

    await interaction.editReply({
        content: 'Select the food item you want to remove:',
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)]
    });
}

async function handleRemoveSelect(interaction: StringSelectMenuInteraction) {
    await interaction.deferUpdate();

    const guildUpgradeId = parseInt(interaction.values[0]!, 10);
    const food = db.getFoodById(guildUpgradeId);

    if (!food) {
        await interaction.editReply({
            content: '❌ That item no longer exists in the database.',
            components: []
        });
        return;
    }

    const deleted = db.removeFood(guildUpgradeId);

    if (!deleted) {
        await interaction.editReply({
            content: '❌ Failed to remove the item. Please try again.',
            components: []
        });
        return;
    }

    await interaction.editReply({
        content: `✅ **${food.name}** has been removed from the database.`,
        components: []
    });
}


// ---------------------------------------------------------------------------
// /foodcheck status
// ---------------------------------------------------------------------------

async function handleStatus(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const foods = db.getAllFoods();

    if (foods.length === 0) {
        await interaction.editReply({
            content: 'ℹ️ No food items are currently in the database. Use `/foodcheck add` to add some.'
        });
        return;
    }

    if (!GW2_CONFIG.apiKey || !GW2_CONFIG.guildId) {
        await interaction.editReply({
            content: '❌ GW2 API key or Guild ID is not configured. Check your environment variables.'
        });
        return;
    }

    let storage;
    try {
        storage = await fetchGuildStorage(GW2_CONFIG.guildId, GW2_CONFIG.apiKey);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        await interaction.editReply({
            content: `❌ Failed to fetch guild storage from the GW2 API.\n\n**Reason:** ${message}`
        });
        return;
    }

    // Quick lookup map: guild_upgrade_id -> count
    const storageMap = new Map<number, number>(storage.map(slot => [slot.id, slot.count]));
    const items = foods.map(food => ({ food, count: storageMap.get(food.guild_upgrade_id) ?? 0 }));

    await interaction.editReply({
        embeds: [createFoodStatusEmbed(items, FOODCHECK_CONFIG.threshold)]
    });
}
