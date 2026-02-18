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
    LabelBuilder
} from 'discord.js';
import type {
    ChatInputCommandInteraction,
    ModalSubmitInteraction,
    ButtonInteraction,
    TextChannel
} from 'discord.js';
import { parseDuration, getUnixTimestamp } from '../utils/timeParser.js';
import { createGiveawayEmbed } from '../utils/embedsGiveaways.js';
import { CHANNELS, ROLES } from '../config.js';
import * as db from '../database/giveaways.js';

export const data = new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways')
    .addSubcommand(sub =>
        sub.setName('create').setDescription('Create a new giveaway')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    if (interaction.options.getSubcommand() === 'create') {
        await handleCreate(interaction);
    }
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
