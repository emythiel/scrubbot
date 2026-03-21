import {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    LabelBuilder,
    MessageFlags
} from "discord.js";
import type {
    ChatInputCommandInteraction,
    ModalSubmitInteraction,
    TextChannel
} from "discord.js";
import { validateGW2Id } from "../utils/helpers.js";
import { GUILD_CONFIG } from "../config.js";


// ---------------------------------------------------------------------------
// Command definition
// ---------------------------------------------------------------------------

export const data = new SlashCommandBuilder()
    .setName('guild')
    .setDescription('Guild-related commands')
    .addSubcommand(sub =>
        sub.setName('invite').setDescription('Request an invite to the Guild')
    );


// ---------------------------------------------------------------------------
// Subcommand dispatcher
// ---------------------------------------------------------------------------

const subcommands: Record<string, (interaction: ChatInputCommandInteraction) => Promise<void>> = {
    invite: handleInvite
};

export async function execute(interaction: ChatInputCommandInteraction) {
    const handler = subcommands[interaction.options.getSubcommand()];
    if (handler) await handler(interaction);
}

export async function handleModalSubmit(interaction: ModalSubmitInteraction) {
    if (interaction.customId === 'guild_invite_modal') {
        await handleInviteModalSubmit(interaction);
    }
}


// ---------------------------------------------------------------------------
// /guild invite
// ---------------------------------------------------------------------------

async function handleInvite(interaction: ChatInputCommandInteraction) {
    const modal = new ModalBuilder()
        .setCustomId('guild_invite_modal')
        .setTitle('Request Guild Invite');

    const gw2Input = new TextInputBuilder()
        .setCustomId('gw2_id')
        .setPlaceholder('example.1234')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

    const gw2Label = new LabelBuilder()
        .setLabel('Guild Wars 2 Account Name')
        .setDescription('Enter your Guild Wars 2 Account Name. Format: example.1234')
        .setTextInputComponent(gw2Input);

    modal.setLabelComponents(gw2Label);

    await interaction.showModal(modal);
}

async function handleInviteModalSubmit(interaction: ModalSubmitInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const gw2Id = interaction.fields.getTextInputValue('gw2_id').trim();

    if (!validateGW2Id(gw2Id)) {
        await interaction.editReply({
            content: '❌ Invalid GW2 ID format. Must be like: \`example.1234\`'
        });
        return;
    }

    if (!GUILD_CONFIG.inviteRequestChannel) {
        await interaction.editReply({
            content: '❌ Invite requests are not configured. Please contact staff.'
        });
        return;
    }

    try {
        const channel = await interaction.client.channels.fetch(GUILD_CONFIG.inviteRequestChannel) as TextChannel;

        await channel.send({
            content: `📩 **Guild Invite Request**\nA user has requested an invite to the Guild!\n\n**Discord:** ${interaction.user} (${interaction.user.tag})\n**GW2 ID:**\n\`\`\`${gw2Id}\`\`\``
        });
    } catch (error) {
        console.error('[Guild] Failed to post invite request:', error);
        await interaction.editReply({
            content: '❌ Failed to send invite request. Please try again, or contact staff.'
        });
        return;
    }

    await interaction.editReply({
        content: '✅ Your invite request has been sent! You will receive an invite as soon as possible.'
    });
}
