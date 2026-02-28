import type { Client, TextChannel } from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { GiveawayWinner } from '../types/giveaway.js';
import * as db from '../database/giveaways.js';
import { createEndedGiveawayEmbed } from '../utils/embeds/giveaway.js';
import { selectRandomWinners } from '../utils/giveawayHelpers.js';

/**
 * End a giveaway and select winners
 */
async function endGiveaway(client: Client, messageId: string) {
    const giveaway = db.getGiveaway(messageId);
    if (!giveaway) return;

    const entries = db.getEntries(messageId);
    const winnerUserIds = selectRandomWinners(entries, giveaway.winner_count);

    // Create winner obejcts with claim status
    const winners: GiveawayWinner[] = winnerUserIds.map(userId => ({
        user_id: userId,
        claimed: false,
        gw2_id: null
    }));

    db.addWinners(messageId, winners);
    db.markGiveawayEnded(messageId);

    try {
        const channel = await client.channels.fetch(giveaway.channel_id) as TextChannel;
        const message = await channel.messages.fetch(giveaway.message_id);
        const host = await client.users.fetch(giveaway.hosted_by);

        const endedEmbed = createEndedGiveawayEmbed(giveaway, host, entries.length, winners);

        // Edit original message: Swap embed and remove enter/exit button
        await message.edit({ embeds: [endedEmbed], components: [] });

        // Send a separate announcement mentioning the winners
        const winnerWord = winners.length === 1 ? 'Winner' : 'Winners';
        const winnerMentions = winners.map(w => `<@${w.user_id}>`).join(', ');

        if (winners.length > 0) {
            const claimButton = new ButtonBuilder()
                .setCustomId(`giveaway_claim_${messageId}`)
                .setLabel('🎁 Claim Prize')
                .setStyle(ButtonStyle.Success);

            await channel.send({
                content: `🎉 **Giveaway Ended!**\n\n**${winnerWord}**: ${winnerMentions}\n**Prize**: ${giveaway.prize}\n\nWinners: Click below to claim your prize!`,
                components: [new ActionRowBuilder<ButtonBuilder>().addComponents(claimButton)]
            });
        } else {
            await channel.send({
                content: `🎉 **Giveaway Ended!**\n\nNo valid entries were received.\n**Prize**: ${giveaway.prize}`
            })
        }
    } catch (error) {
        console.error(`Error ending giveaway ${messageId}:`, error);
    }
}

/**
 * Check for expired giveaways and end them
 */
async function checkExpiredGiveaways(client: Client) {
    const expiredGiveaways = db.getExpiredGiveaways();

    for (const giveaway of expiredGiveaways) {
        await endGiveaway(client, giveaway.message_id);
    }
}

/**
 * Start the giveaway monitor task
 * Checks for expired giveaways every 30 seconds
 */
export function startGiveawayMonitor(client: Client) {
    console.log('Starting giveaway monitor...');

    // Check immediately on startup
    checkExpiredGiveaways(client);

    // Check every 30 seconds
    setInterval(() => checkExpiredGiveaways(client), 30 * 1000);
}
