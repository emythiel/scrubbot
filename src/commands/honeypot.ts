import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    LabelBuilder,
    MessageFlags,
    EmbedBuilder
} from "discord.js";
import type {
    ChatInputCommandInteraction,
    ModalSubmitInteraction,
    ButtonInteraction,
    TextChannel
} from "discord.js";
import { HONEYPOT_CONFIG } from "../config.js";


// ---------------------------------------------------------------------------
// Command definition
// ---------------------------------------------------------------------------

export const data = new SlashCommandBuilder()
    .setName('honeypot')
    .setDescription('Manage honeypot settings')
    .addSubcommand(sub =>
        sub.setName('message').setDescription('Post a warning message to the honeypot channel')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);


// ---------------------------------------------------------------------------
// Subcommand dispatcher
// ---------------------------------------------------------------------------

const subcommands: Record<string, (interaction: ChatInputCommandInteraction) => Promise<void>> = {
    message: handleMessage
};

export async function execute(interaction: ChatInputCommandInteraction) {
    const handler = subcommands[interaction.options.getSubcommand()];
    if (handler) await handler(interaction);
}

export async function handleModalSubmit(interaction: ModalSubmitInteraction) {
    if (interaction.customId === 'honeypot_message_modal') {
        await handleEmbedModalSubmit(interaction);
    }
}

export async function handleButtonClick(interaction: ButtonInteraction) {
    if (interaction.customId.startsWith('honeypot_ban_')) {
        await handleBanButton(interaction);
    } else if (interaction.customId.startsWith('honeypot_untimeout_')) {
        await handleUntimeoutButton(interaction);
    }
}


// ---------------------------------------------------------------------------
// /honeypot message
// ---------------------------------------------------------------------------

async function handleMessage(interaction: ChatInputCommandInteraction) {
    if (!HONEYPOT_CONFIG.watchChannel) {
        await interaction.reply({
            content: '❌ No watch channel configured. Set `honeypot.watch_channel` in `config.toml`.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId('honeypot_message_modal')
        .setTitle('Honeypot Warning Message')

    const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setValue('⚠️ DO NOT SEND MESSAGES IN THIS CHANNEL!')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(256);
    const titleLabel = new LabelBuilder()
        .setLabel('Title')
        .setTextInputComponent(titleInput);

    const descriptionInput = new TextInputBuilder()
        .setCustomId('description')
        .setValue('This channel is used to catch spam bots.\nAny messages sent here will result in a {action} from the server.\nYou have been warned.')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(2048);
    const descriptionLabel = new LabelBuilder()
        .setLabel('Description')
        .setDescription('Placeholders: {action} = ban/softban, {channel} = channel mention')
        .setTextInputComponent(descriptionInput);

    const iconInput = new TextInputBuilder()
        .setCustomId('icon_url')
        .setPlaceholder('https://...')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(512);
    const iconLabel = new LabelBuilder()
        .setLabel('Icon URL (optional)')
        .setTextInputComponent(iconInput);

    const webhookNameInput = new TextInputBuilder()
        .setCustomId('webhook_name')
        .setPlaceholder('Honeypot')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(80);
    const webhookNameLabel = new LabelBuilder()
        .setLabel('Sender Name (optional)')
        .setDescription('Custom name shown as the message sender')
        .setTextInputComponent(webhookNameInput);

    const webhookAvatarInput = new TextInputBuilder()
        .setCustomId('webhook_avatar_url')
        .setPlaceholder('https://...')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(512);
    const webhookAvatarLabel = new LabelBuilder()
        .setLabel('Sender Avatar URL (optional)')
        .setDescription('Custom avatar shown as the message sender')
        .setTextInputComponent(webhookAvatarInput);

    modal.setLabelComponents(titleLabel, descriptionLabel, iconLabel, webhookNameLabel, webhookAvatarLabel);

    await interaction.showModal(modal);
}

async function handleEmbedModalSubmit(interaction: ModalSubmitInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!HONEYPOT_CONFIG.watchChannel) {
        await interaction.editReply({
            content: '❌ No watch channel configured. Set `honeypot.watch_channel` in `config.toml`.'
        });
        return;
    }

    const title = interaction.fields.getTextInputValue('title').trim();
    const description = interaction.fields.getTextInputValue('description').trim();
    const iconUrl = interaction.fields.getTextInputValue('icon_url').trim() || null;
    const webhookName = interaction.fields.getTextInputValue('webhook_name').trim() || null;
    const webhookAvatarUrl = interaction.fields.getTextInputValue('webhook_avatar_url').trim() || null;

    // Resolve placeholders
    const action = HONEYPOT_CONFIG.softban ? 'softban' : 'ban';
    const channelMention = `<#${HONEYPOT_CONFIG.watchChannel}>`;

    const resolvedTitle = title.replaceAll('{action}', action).replaceAll('{channel}', channelMention);
    const resolvedDescription = description.replaceAll('{action}', action).replaceAll('{channel}', channelMention);

    const embed = new EmbedBuilder()
        //.setTitle(resolvedTitle)
        .setDescription(`# ${resolvedTitle}\n${resolvedDescription}`)
        .setColor(0xED4245)

    if (iconUrl) {
        embed.setThumbnail(iconUrl);
    }

    try {
        const channel = await interaction.client.channels.fetch(HONEYPOT_CONFIG.watchChannel) as TextChannel;

        // Reuse existing webhook if one exists, otherwise create a new one
        const wbehooks = await channel.fetchWebhooks();
        const existing = wbehooks.find(wh => wh.name === 'Honeypot');
        const webhook = existing ?? await channel.createWebhook({ name: 'Honeypot' });

        await webhook.send({
            embeds: [embed],
            ...(webhookName && { username: webhookName }),
            ...(webhookAvatarUrl && { avatarURL: webhookAvatarUrl })
        });
    } catch (error) {
        console.error('[Honeypot] Failed to post warning message:', error);
        await interaction.editReply({
            content: `❌ Failed to post the message to the watch channel. Check that I have \`Manage Webhooks\` permission for ${channelMention}.`
        });
        return;
    }

    await interaction.editReply({ content: '✅ Warning message posted.' });
}


// ---------------------------------------------------------------------------
// Admin buttons (Ban / Remove Timeout)
// ---------------------------------------------------------------------------

async function handleBanButton(interaction: ButtonInteraction) {
    await interaction.deferUpdate();

    const userId = interaction.customId.replace('honeypot_ban_', '');
    const { softban, deleteMessageHours } = HONEYPOT_CONFIG;
    const deleteMessageSeconds = deleteMessageHours * 3600;
    const action = softban ? 'softbanned' : 'banned';

    let resultLine: string;

    try {
        const member = await interaction.guild!.members.fetch(userId);

        await member.ban({ deleteMessageSeconds, reason: '[Honeypot] Admin action via alert'});

        if (softban) {
            await interaction.guild!.members.unban(userId, 'Honeypot: Admin softban - auto-unban');
        }

        console.log(`[Honeypot] Admin ${action} ${member.user.tag} (${userId})`);
        resultLine = `✅ **${member.user.tag}** has been ${action} by <@${interaction.user.id}>.`;
    } catch (error) {
        console.error(`[Honeypot] Admin ban failed for ${userId}:`, error);
        const message = error instanceof Error ? error.message : String(error);

        // User may have already left
        resultLine = `❌ Failed to ${softban ? 'softban' : 'ban'} <@${userId}>: ${message}`;
    }

    // Remove buttons and append outcome to alert message
    await interaction.editReply({
        components: [],
        content: resultLine
    });
}

async function handleUntimeoutButton(interaction: ButtonInteraction) {
    await interaction.deferUpdate();

    const userId = interaction.customId.replace('honeypot_untimeout_', '');

    let resultLine: string;

    try {
        const member = await interaction.guild!.members.fetch(userId);
        await member.timeout(null, '[Honeypot] Admin removed timeout via alert');

        console.log(`[Honeypot] Admin removed timeout for ${member.user.tag} (${userId})`);
        resultLine = `✅ Timeout removed from **${member.user.tag}** by <@${interaction.user.id}>.`;
    } catch (error) {
        console.error(`[Honeypot] Admin untimeout failed for ${userId}:`, error);
        const message = error instanceof Error ? error.message : String(error);

        resultLine = `❌ Failed to remove timeout for <@${userId}>: ${message}`;
    }

    // Remove buttons and append outcome to alert message
    await interaction.editReply({
        components: [],
        content: resultLine,
    });
}

