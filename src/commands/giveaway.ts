import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    MessageFlags,
    LabelBuilder,
    EmbedBuilder
} from 'discord.js';
import type {
    ChatInputCommandInteraction,
    ModalSubmitInteraction,
    ButtonInteraction,
    TextChannel
} from 'discord.js';
import { parseDuration, getUnixTimestamp } from '../utils/timeParser.js';
import { createCancelledGiveawayEmbed, createEndedGiveawayEmbed, createGiveawayEmbed } from '../utils/giveawayEmbeds.js';
import { selectRandomWinners } from '../utils/giveawayHelpers.js';
import { CHANNELS, ROLES } from '../config.js';
import * as db from '../database/giveaways.js';

export const data = new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways')
    .addSubcommand(sub =>
        sub.setName('create').setDescription('Create a new giveaway')
    )
    .addSubcommand(sub =>
        sub.setName('end').setDescription('End a giveaway early').addStringOption(option =>
            option.setName('message_id').setDescription('The message ID of the giveaway').setRequired(true)
        )
    )
    .addSubcommand(sub =>
        sub.setName('cancel').setDescription('Cancel a giveaway').addStringOption(option =>
            option.setName('message_id').setDescription('The message ID of the giveaway').setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    if (interaction.options.getSubcommand() === 'create') await handleCreate(interaction);
    if (interaction.options.getSubcommand() === 'end') await handleEnd(interaction);
    if (interaction.options.getSubcommand() === 'cancel') await handleCancel(interaction);
}

/**
 * Handle '/giveaway create' command
 */
async function handleCreate(interaction: ChatInputCommandInteraction) {
    // Create and show the modal
    const modal = new ModalBuilder()
        .setCustomId('giveaway_create_modal')
        .setTitle('Create Giveaway');

    // Prize input
    const prizeInput = new TextInputBuilder()
        .setCustomId('prize')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(256);
    const prizeLabel = new LabelBuilder()
        .setLabel('Prize')
        .setDescription('What to give away')
        .setTextInputComponent(prizeInput);

    // Description
    const descriptionInput = new TextInputBuilder()
        .setCustomId('description')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1024);
    const descriptionLabel = new LabelBuilder()
        .setLabel('Description (Optional)')
        .setDescription('Any additional details or extra text')
        .setTextInputComponent(descriptionInput);

    // Duration
    const durationInput = new TextInputBuilder()
        .setCustomId('duration')
        .setPlaceholder('eg., "7d", "2 weeks", "12 hours", "5 days 12 hours')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    const durationLabel = new LabelBuilder()
        .setLabel('Duration')
        .setDescription('The duration of the giveaway')
        .setTextInputComponent(durationInput);

    // Winner count
    const winnerCountInput = new TextInputBuilder()
        .setCustomId('winner_count')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue('1')
        .setMaxLength(3);
    const winnerCountLabel = new LabelBuilder()
        .setLabel('Winners')
        .setDescription('How many winners to choose')
        .setTextInputComponent(winnerCountInput);

    // Announcement text input
    const announcementInput = new TextInputBuilder()
        .setCustomId('announcement')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1024)
    const announcementLabel = new LabelBuilder()
        .setLabel('Announcement (Optional)')
        .setDescription('Message for the Announcement channel')
        .setTextInputComponent(announcementInput);

    modal.setLabelComponents(
        prizeLabel,
        descriptionLabel,
        durationLabel,
        winnerCountLabel,
        announcementLabel
    );

    await interaction.showModal(modal);
}

/**
 * Handle modal submission for giveaway creation
 */
export async function handleModalSubmit(interaction: ModalSubmitInteraction) {
    if (interaction.customId !== 'giveaway_create_modal') return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Get input values
    const prize = interaction.fields.getTextInputValue('prize');
    const description = interaction.fields.getTextInputValue('description') || null;
    const durationStr = interaction.fields.getTextInputValue('duration');
    const winnerCountStr = interaction.fields.getTextInputValue('winner_count');
    const announcementText = interaction.fields.getTextInputValue('announcement') || null;

    // Parse and validate duration
    const duration = parseDuration(durationStr);
    if (!duration) {
        await interaction.editReply({
            content: `❌ Invalid duration format: "${durationStr}"\n\nExamples:\n- Single: "10m", "2 hours", "7 days", "1 week"\n- Combined: "5d 2h", "1w 3d 5h 30m"`
        });
        return;
    }

    // Parse and validate winner count
    const winnerCount = parseInt(winnerCountStr, 10);
    if (isNaN(winnerCount) || winnerCount < 1) {
        await interaction.editReply({
            content: '❌ Winner count must be a positive number'
        });
        return;
    }

    // interaction.channelId can be null for non-guild interactions, but since
    // this command requires Administrator permission it will always be in a guild
    // channel. We assert non-null here rather than propagating null through the types.
    const channelId = interaction.channelId!;

    // Calculate end time as unix timestamp
    const now = getUnixTimestamp();
    const endsAt = now + duration;

    try {
        // Build and post embed before writing to database, as we need message ID for the primary key
        const embed = createGiveawayEmbed(
            {
                message_id:     '',  // Not known yet
                channel_id:     channelId,
                prize,
                description,
                hosted_by:      interaction.user.id,
                created_at:     now,
                ends_at:        endsAt,
                ended:          false,
                winner_count:   winnerCount,
                entries:        '[]',
                winners:        '[]'
            },
            interaction.user,
            0
        );

        // Create enter button
        const enterButton = new ButtonBuilder()
            .setCustomId('giveaway_enter')
            .setLabel('🎉 Enter Giveaway')
            .setStyle(ButtonStyle.Primary);

        // Send the giveaway message
        const channel = interaction.channel as TextChannel;
        const giveawayMessage = await channel.send({
            embeds: [embed],
            components: [new ActionRowBuilder<ButtonBuilder>().addComponents(enterButton)]
        });

        // Save to database
        db.createGiveaway({
            message_id:     giveawayMessage.id,
            channel_id:     channelId,
            prize,
            description,
            hosted_by:      interaction.user.id,
            created_at:     now,
            ends_at:        endsAt,
            winner_count:   winnerCount
        });

        // Send announcement if provided
        if (announcementText && CHANNELS.announcements) {
            try {
                const announcementChannel = await interaction.client.channels.fetch(CHANNELS.announcements) as TextChannel;
                if (announcementChannel?.type === ChannelType.GuildText) {
                    await announcementChannel.send({
                        content: `<@&${ROLES.giveaway}>\n\n${announcementText}\n\nJump to giveaway:\n${giveawayMessage.url}`
                    });
                }
            } catch (error) {
                console.error('Error sending announcement:', error);
            }
        }

        await interaction.editReply({
            content: `✅ Giveaway created successfully! [Jump to giveaway](${giveawayMessage.url})`
        });
    } catch (error) {
        console.error('Error creating giveaway:', error);
        await interaction.editReply({
            content: '❌ Failed to create giveaway. Please try again.'
        });
    }
}

/**
 * Handle button click for entering/leaving giveaway
 */
export async function HandleButtonClick(interaction: ButtonInteraction) {
    if (interaction.customId !== 'giveaway_enter') return;

    const giveaway = db.getGiveaway(interaction.message.id);

    if (!giveaway) {
        await interaction.reply({
            content: '❌ This giveaway no longer exists.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (giveaway.ended) {
        await interaction.reply({
            content: '❌ This giveaway has already ended.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const userId = interaction.user.id;

    if (db.hasUserEntered(giveaway.message_id, userId)) {
        db.removeEntry(giveaway.message_id, userId);
        await interaction.reply({
            content: '✅ You have left the giveaway.', flags: MessageFlags.Ephemeral
        });
    } else {
        db.addEntry(giveaway.message_id, userId);
        await interaction.reply({
            content: '✅ You have entered the giveaway! Good luck! 🎉', flags: MessageFlags.Ephemeral
        });
    }

    // Update the entry count in the giveaway embed
    const newCount = db.getEntryCount(giveaway.message_id);
    const host = await interaction.client.users.fetch(giveaway.hosted_by);
    const updatedEmbed = createGiveawayEmbed(giveaway, host, newCount);

    await interaction.message.edit({ embeds: [updatedEmbed] });
}

/**
 * Handle '/giveaway end' command
 */
async function handleEnd(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const messageId = interaction.options.getString('message_id', true);
    const giveaway = db.getGiveaway(messageId);

    if (!giveaway) {
        await interaction.editReply({
            content: '❌ Giveaway not found. Make sure you copied the message ID correctly.'
        });
        return;
    }

    if (giveaway.ended) {
        await interaction.editReply({
            content: '❌ This giveaway has already ended.'
        });
        return;
    }

    try {
        // Get entries and select winners
        const entries = db.getEntries(messageId);
        const winnerIds = selectRandomWinners(entries, giveaway.winner_count);

        // Update ends_at to current time (since giveaway ended early)
        const now = getUnixTimestamp();
        db.updateEndsAt(messageId, now);

        // Add winners and mark as ended
        db.addWinners(messageId, winnerIds);
        db.markGiveawayEnded(messageId);

        // Fetch message and update it
        const channel = await interaction.client.channels.fetch(giveaway.channel_id) as TextChannel;
        const message = await channel.messages.fetch(messageId);
        const host = await interaction.client.users.fetch(giveaway.hosted_by);

        // Refetch giveaway to get updated ends_at
        const updatedGiveaway = db.getGiveaway(messageId)!;
        const endedEmbed = createEndedGiveawayEmbed(updatedGiveaway, host, entries.length, winnerIds);

        await message.edit({
            embeds: [endedEmbed], components: []
        });

        // Send winner announcement
        const winnerWord = winnerIds.length === 1 ? 'Winner' : 'Winners';
        const winnerMentions = winnerIds.map(userId => `<@${userId}>`).join(', ');

        await channel.send(
            winnerIds.length > 0
                ? `🎉 **Giveaway Ended!**\n\n**${winnerWord}**: ${winnerMentions}\n**Prize**: ${giveaway.prize}\n\nCongratulations!`
                : `🎉 **Giveaway Ended!**\n\nNo valid entries were received.\n**Prize**: ${giveaway.prize}`
        );

        await interaction.editReply({
            content: `✅ Giveaway ended successfully!`
        });
    } catch (error) {
        console.error('Error ending giveaway:', error);
        await interaction.editReply({
            content: '❌ Failed to end giveaway. Please try again.'
        });
    }
}

/**
 * Handle '/giveaway cancel' command
 */
async function handleCancel(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const messageId = interaction.options.getString('message_id', true);
    const giveaway = db.getGiveaway(messageId);

    if (!giveaway) {
        await interaction.editReply({
            content: '❌ Giveaway not found. Make sure you copied the message ID correctly.'
        });
        return;
    }

    try {
        // Delete from database first
        const deleted = db.deleteGiveaway(messageId);

        if (!deleted) {
            await interaction.editReply({
                content: '❌ Failed to delete giveaway from database.'
            });
            return;
        }

        // Update discord message to show it was cancelled
        const channel = await interaction.client.channels.fetch(giveaway.channel_id) as TextChannel;
        const message = await channel.messages.fetch(messageId);

        const cancelledEmbed = createCancelledGiveawayEmbed(giveaway);

        await message.edit({ embeds: [cancelledEmbed], components: [] });

        await interaction.editReply({
            content: `✅ Giveaway cancelled and removed from database.`
        });
    } catch (error) {
        console.error('Error cancelling giveaway:', error);
        await interaction.editReply({
            content: '❌ Failed to cancel giveaway. The database entry may have been deleted, but the message update failed.'
        });
    }
}
