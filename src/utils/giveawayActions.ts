import type { Client, TextChannel } from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { GiveawayWinner } from '../types/giveaway.js';
import * as db from '../database/giveaways.js';
import { createEndedGiveawayEmbed } from './embeds/giveaway.js';
import { GIVEAWAY_CONFIG as CONF, GIVEAWAY_CONFIG } from '../config.js';


// ---------------------------------------------------------------------------
// Shared UI component
// ---------------------------------------------------------------------------

/**
 * Build claim prize button for a giveaway
 */
export function buildClaimButton(messageId: string): ButtonBuilder {
    return new ButtonBuilder()
        .setCustomId(`giveaway_claim_${messageId}`)
        .setLabel('🎁 Claim Prize')
        .setStyle(ButtonStyle.Success);
}


// ---------------------------------------------------------------------------
// Announcement post helper
// ---------------------------------------------------------------------------

export async function trySendAnnouncement(client: Client, text: string | null, giveawayUrl: string): Promise<void> {
    if (!text || !CONF.announcementChannel) return;

    try {
        const ch = await client.channels.fetch(CONF.announcementChannel);
        if (!ch?.isTextBased() || ch.isDMBased()) return;

        const ping = CONF.pingRole ? `<@&${CONF.pingRole}>\n\n` : '';
        await ch.send({ content: `${ping}${text}\n\nJump to giveaway:\n${giveawayUrl}` });
    } catch (error) {
        console.error('[Giveaway] Failed to send announcement:', error);
    }
}

// ---------------------------------------------------------------------------
// Core end giveaway logic
// ---------------------------------------------------------------------------

/**
 * Select random entries from an array of strings, using Fisher-Yates shuffle
 */
export function selectRandomWinners(entries: string[], count: number): string[] {
    if (entries.length === 0) return [];

    const pool = [...entries];

    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = pool[i] as string;
        pool[i] = pool[j] as string;
        pool[j] = tmp;
    }

    return pool.slice(0, Math.min(count, pool.length));
}

/**
 * Select winners, update original Discord message,
 * and post winner announcement with a claim button.
 *
 * For forum giveaways, channel_id is the thread ID.
 * IF a thread is detected, active tag is removed and ended tag added.
 *
 * @param client         - Discord client instance
 * @param messageId      - Giveaway message ID
 * @param overrideEndsAt - If ending early, pass current timestamp
 */
export async function endGiveaway(
    client: Client,
    messageId: string,
    overrideEndsAt?: number
): Promise<void> {
    const giveaway = db.getGiveaway(messageId);
    if (!giveaway) return;

    if (overrideEndsAt !== undefined) {
        db.updateEndsAt(messageId, overrideEndsAt);
    }

    const winners: GiveawayWinner[] = selectRandomWinners(giveaway.entries, giveaway.winner_count)
        .map(userId => ({ user_id: userId, claimed: false, gw2_id: null}));

    db.addWinners(messageId, winners);
    db.markGiveawayEnded(messageId);

    // Re-fetch to ensure consistent final state
    const finalGiveaway = db.getGiveaway(messageId)!;

    try {
        const channel = await client.channels.fetch(giveaway.channel_id);
        if (!channel || !channel.isTextBased() || channel.isDMBased()) return;

        const message = await channel.messages.fetch(messageId);
        const host = await client.users.fetch(giveaway.hosted_by);

        await message.edit({
            embeds: [createEndedGiveawayEmbed(finalGiveaway, host, finalGiveaway.entries.length, finalGiveaway.winners)],
            components: []
        });

        if (winners.length > 0) {
            const winnerWord = winners.length === 1 ? 'Winner' : 'Winners';
            const winnerMentions = winners.map(w => `<@${w.user_id}>`).join(', ');

            await channel.send({
                content: `🎉 **Giveaway Ended!**\n\n**${winnerWord}**: ${winnerMentions}\n**Prize**: ${giveaway.prize}\n\nWinners: Claim your prize below within 72 hours!`,
                components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buildClaimButton(messageId))],
            });
        } else {
            await channel.send({
                content: `🎉 **Giveaway Ended!**\n\nNo valid entries were received.\n**Prize**: ${giveaway.prize}`
            });
        }

        // If forum thread, swap active to ended tag
        if (channel.isThread()) {
            const activeTag = GIVEAWAY_CONFIG.tagActive || null;
            const endedTag  = GIVEAWAY_CONFIG.tagEnded  || null;

            const updatedTags = channel.appliedTags.filter(t => t !== activeTag);
            if (endedTag) updatedTags.push(endedTag);

            await channel.setAppliedTags(updatedTags, 'Giveaway ended');
            console.log(`[Giveaway] Updated forum thread tags for giveaway ${messageId}`);
        }
    } catch (error) {
        console.error(`[Giveaway] Error ending giveaway ${messageId}`, error);
    }
}
