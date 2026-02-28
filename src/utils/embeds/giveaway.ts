import { EmbedBuilder, User } from 'discord.js';
import type { Giveaway, GiveawayWinner } from '../../types/giveaway.js';
import { formatDiscordTimestamp } from '../timeParser.js';

/**
 * Create an embed for an active giveaway
 */
export function createGiveawayEmbed(
    giveaway: Giveaway,
    host: User,
    entryCount: number
): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setTitle(`${giveaway.prize}`)
        .setColor(0x5865F2)
        .setFooter({ text: `Giveaway` });

    // Add a description if provided
    if (giveaway.description) {
        embed.setDescription(giveaway.description);
    }

    // Time information using discord timestamps
    const endsRelative = formatDiscordTimestamp(giveaway.ends_at, 'R');
    const endsAbsolute = formatDiscordTimestamp(giveaway.ends_at, 'f');

    embed.addFields(
        { name: 'Ends', value: `${endsRelative} (${endsAbsolute})`, inline: false },
        { name: 'Hosted by', value: host.toString(), inline: true },
        { name: 'Entries', value: entryCount.toString(), inline: true },
        { name: 'Winners', value: giveaway.winner_count.toString(), inline: true }
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
    winners: GiveawayWinner[]
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
    const endedRelative = formatDiscordTimestamp(giveaway.ends_at, 'R');
    const endedAbsolute = formatDiscordTimestamp(giveaway.ends_at, 'f');

    embed.addFields(
        { name: 'Ended', value: `${endedRelative} (${endedAbsolute})`, inline: false },
        { name: 'Hosted by', value: host.toString(), inline: true },
        { name: 'Entries', value: entryCount.toString(), inline: true }
    );

    // Add winners
    if (winners.length > 0) {
        const winnerDisplay = winners.map(w =>
            `<@${w.user_id}> ${w.claimed ? '✅' : '⏳'}`
        ).join('\n');

        embed.addFields({
            name: `Winner${winners.length > 1 ? 's' : ''}`,
            value: winnerDisplay,
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

/**
 * Create an embed for a cancelled giveaway
 */
export function createCancelledGiveawayEmbed(giveaway: Giveaway): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setTitle(`${giveaway.prize}`)
        .setDescription('This giveaway has been cancelled by an administrator')
        .setColor(0x5D5A58)
        .setFooter({ text: 'Giveaway Cancelled'});

    return embed;
}

