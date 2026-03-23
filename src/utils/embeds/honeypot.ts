import { EmbedBuilder} from 'discord.js';
import type { GuildMember } from 'discord.js';
import { HONEYPOT_CONFIG } from '../../config.js';


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function memberDisplay(member: GuildMember): string {
    return `${member.user.tag} (<@${member.user.id}>)`;
}


// ---------------------------------------------------------------------------
// Ban embeds
// ---------------------------------------------------------------------------

/**
 * Posted to alert channel when a user is successfully banned / softbanned
 */
export function createBanSuccessEmbed(member: GuildMember, softban: boolean, watchCannel: string, message: string): EmbedBuilder {
    return new EmbedBuilder()
        .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
        .setTitle(`🔨 User ${softban ? 'Softbanned': 'Banned'}`)
        .setColor(softban ? 0xFEE75C : 0xED4245)
        .setDescription(`User was ${softban ? 'softbanned' : 'banned'} for triggering the honeypot in ${watchCannel}.`)
        .addFields(
            { name: 'User', value: `<@${member.user.id}>`, inline: false },
            { name: 'Message', value: `\`\`\`${message}\`\`\``, inline: false }
        )
        .setTimestamp();
}

/**
 * Posted to alert channel when a ban / softban attempt fails
 */
export function createBanFailedEmbed(member: GuildMember, softban: boolean, watchChannel: string, error: unknown, message: string): EmbedBuilder {
    return new EmbedBuilder()
        .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
        .setTitle(`⚠️ Failed to ${softban ? 'softban' : 'ban'} user`)
        .setColor(0xED4245)
        .setDescription(`User triggered the honeypot in ${watchChannel}, but I failed to ${softban ? 'softban' : 'ban'} them.`)
        .addFields(
            { name: 'User', value: `<@${member.user.id}>`, inline: false },
            { name: 'Error', value: getErrorMessage(error), inline: false },
            { name: 'Message', value: `\`\`\`${message}\`\`\``, inline: false }
        )
        .setTimestamp();
}


// ---------------------------------------------------------------------------
// Timeout embeds
// ---------------------------------------------------------------------------

/**
 * Posted to alert channel when a user is successfully timed out.
 * Includes Ban / Remove Timeout buttons added by the monitor.
 */
export function createTimeoutSuccessEmbed(member: GuildMember, duration: string, watchChannel: string, message: string): EmbedBuilder {
    return new EmbedBuilder()
        .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
        .setTitle('⏱️ User Timed Out - Action Required')
        .setColor(0xFEE75C)
        .setDescription(`User has been timed out for triggering the honeypot in ${watchChannel}`)
        .addFields(
            { name: 'User', value: `<@${member.user.id}>`, inline: false },
            { name: 'Timeout Duration', value: duration, inline: true },
            { name: 'Message', value: `\`\`\`${message}\`\`\``, inline: false }
        )
        .setTimestamp();
}

/**
 * Posted to alert channel when a timeout attempt fails
 */
export function createTimeoutFailedEmbed(member: GuildMember, watchChannel: string, error: unknown, message: string): EmbedBuilder {
    return new EmbedBuilder()
        .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
        .setTitle('⚠️ Failed to timeout user - Manual action required')
        .setColor(0xED4245)
        .setDescription(`User with the timeout role triggered the honeypot in ${watchChannel}, but could not be timed out. Please review manually.`)
        .addFields(
            { name: 'User', value: `<@${member.user.id}>`, inline: false },
            { name: 'Error', value: getErrorMessage(error), inline: false },
            { name: 'Message', value: `\`\`\`${message}\`\`\``, inline: false }
        )
        .setTimestamp();
}
