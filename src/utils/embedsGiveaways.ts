import { EmbedBuilder, User } from 'discord.js';
import type { Giveaway } from '../types/giveaway.js';
import { formatDiscordTimestamp } from './timeParser.js';

/**
 * Create an embed for an active giveaway
 */
export function createGiveawayEmbed(
    giveaway: Giveaway,
    host: User,
    entryCount: number
): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setTitle(`🎉 ${giveaway.prize}`)
        .setColor(0x5865F2)
        .setFooter({ text: `Giveaway` });

    // Add a description if provided
    if (giveaway.description) {
        embed.setDescription(giveaway.description);
    }

    // Time information using discord timestamps
    // Style 'R' = Relative time ("in 2 hours")
    // Style 'F' = Full date/time ("Sunday, 15. February 2026 17:46")
    const endsRelative = formatDiscordTimestamp(giveaway.ends_at, 'R');
    const endsAbsolute = formatDiscordTimestamp(giveaway.ends_at, 'F');

    embed.addFields(
        { name: 'Ends', value: `${endsRelative} (${endsAbsolute})`, inline: false },
        { name: 'Hosted by', value: host.toString(), inline: true },
        { name: 'Entries', value: entryCount.toString(), inline: true }
    );

    return embed;
}

/**
 * Create an embed for an ended giveaway
 */
export function createEndedGiveawayEmbed(
    giveaway: Giveaway,
    host: User,
    entryCount: number,
    winners: string[]
): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setTitle(`🎉 ${giveaway.prize}`)
        .setColor(0xED4245)
        .setFooter({ text: `Giveaway` });

    // Add a description if provided
    if (giveaway.description) {
        embed.setDescription(giveaway.description);
    }

    // Time information using discord timestamps
    // Style 'R' = Relative time ("in 2 hours")
    // Style 'F' = Full date/time ("Sunday, 15. February 2026 17:46")
    const endedRelative = formatDiscordTimestamp(giveaway.ends_at, 'R');
    const endedAbsolute = formatDiscordTimestamp(giveaway.ends_at, 'F');

    embed.addFields(
        { name: 'Ended', value: `${endedRelative} (${endedAbsolute})`, inline: false },
        { name: 'Hosted by', value: host.toString(), inline: true },
        { name: 'Entries', value: entryCount.toString(), inline: true }
    );

    // Add winners
    if (winners.length > 0) {
        const winnerMentions = winners.map(userId => `<@${userId}>`).join(', ');
        embed.addFields({
            name: `Winner${winners.length > 1 ? 's' : ''}`,
            value: winnerMentions,
            inline: false
        });
    } else {
        embed.addFields({
            name: 'Winner',
            value: 'No valid entries',
            inline: false
        });
    }

    return embed;
}
