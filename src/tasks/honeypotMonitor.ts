import {Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { Client, GuildMember, TextChannel } from "discord.js";
import { HONEYPOT_CONFIG } from "../config.js";
import { parseDuration } from "../utils/timeParser.js";
import {
    createBanSuccessEmbed,
    createBanFailedEmbed,
    createTimeoutSuccessEmbed,
    createTimeoutFailedEmbed
} from "../utils/embeds/honeypot.js";

const BAN_REASON = '[Honeypot] Posted in watched channel, possible spambot';


// ---------------------------------------------------------------------------
// Admin action buttons (for handling timeout actions)
// ---------------------------------------------------------------------------

/**
 * Ban / Remove Timeout for admin alerts
 * Used for users that was timed out instead of instantly banned by honeypot
 */
function buildAdminActionRow(userId: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`honeypot_ban_${userId}`)
            .setLabel('Ban')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`honeypot_untimeout_${userId}`)
            .setLabel('Remove Timeout')
            .setStyle(ButtonStyle.Secondary)
    );
}


// ---------------------------------------------------------------------------
// Alert helper
// ---------------------------------------------------------------------------

/**
 * Post a message to the configured alert channel.
 */
async function sendAlert(client: Client, content: Parameters<TextChannel['send']>[0]): Promise<void> {
    if (!HONEYPOT_CONFIG.alertChannel) return;

    try {
        const channel = await client.channels.fetch(HONEYPOT_CONFIG.alertChannel) as TextChannel;
        await channel.send(content);
    } catch (error) {
        console.error('[Honeypot] Failed to send alert:', error);
    }
}


// ---------------------------------------------------------------------------
// Action handlers (ban & timeout)
// ---------------------------------------------------------------------------

/**
 * Handle user bans
 */
async function handleBan(client: Client, member: GuildMember): Promise<void> {
    const { softban, deleteMessageHours } = HONEYPOT_CONFIG;
    const deleteMessageSeconds = deleteMessageHours * 3600;
    const watchChannel = `<#${HONEYPOT_CONFIG.watchChannel}>`;

    try {
        await member.ban({ deleteMessageSeconds, reason: BAN_REASON });

        if (softban) {
            await member.guild.members.unban(member.id, 'Honeypot: Softban - auto-unban');
        }

        console.log(`[Honeypot] ${softban ? 'Softbanned' : 'Banned'} ${member.user.tag} (${member.id})`);

        await sendAlert(client, {
            embeds: [createBanSuccessEmbed(member, softban, watchChannel)]
        });
    } catch (error) {
        console.error(`[Honeypot] Failed to ${softban ? 'Softbanned' : 'Banned'} ${member.user.tag}:`, error);

        await sendAlert(client, {
            embeds: [createBanFailedEmbed(member, softban, watchChannel, error)]
        });
    }
}

/**
 * Handle user timeouts
 */
async function handleTimeout(client: Client, member: GuildMember): Promise<void> {
    const durationSeconds = parseDuration(HONEYPOT_CONFIG.timeoutDuration);
    const watchChannel = `<#${HONEYPOT_CONFIG.watchChannel}>`;

    if (!durationSeconds) {
        console.error('[Honeypot] Invalid timeout_duration in config:', HONEYPOT_CONFIG.timeoutDuration);
        await sendAlert(client, {
            content: `⚠️ **Honeypot config error:** \`timeout_duration\` is invalid (\`${HONEYPOT_CONFIG.timeoutDuration}\`). ${member} was not actioned.`
        });
        return;
    }

    try {
        await member.timeout(durationSeconds * 1000, BAN_REASON);

        console.log(`[Honeypot] Timed out ${member.user.tag} (${member.id}) for ${HONEYPOT_CONFIG.timeoutDuration}`);

        await sendAlert(client, {
            embeds: [createTimeoutSuccessEmbed(member, HONEYPOT_CONFIG.timeoutDuration, watchChannel)],
            components: [buildAdminActionRow(member.id)]
        });
    } catch (error) {
        console.error(`[Honeypot] Failed to timeout ${member.user.tag}:`, error);

        await sendAlert(client, {
            embeds: [createTimeoutFailedEmbed(member, watchChannel, error)]
        });
    }
}


// ---------------------------------------------------------------------------
// Monitor
// ---------------------------------------------------------------------------

export function startHoneypotMonitor(client: Client): void {
    if (!HONEYPOT_CONFIG.watchChannel) {
        console.log('[Honeypot] Monitor not started - watch channel not configured.');
        return;
    }

    console.log('[Honeypot] Monitor started.');

    client.on(Events.MessageCreate, async (message) => {
        // Ignore bots
        if (message.author.bot) return;

        // Only act in watch channel
        if (message.channelId !== HONEYPOT_CONFIG.watchChannel) return;

        const member = message.member;
        if (!member) return;

        const hasTimeoutRole = !!HONEYPOT_CONFIG.timeoutRole && member.roles.cache.has(HONEYPOT_CONFIG.timeoutRole);

        if (hasTimeoutRole) {
            try {
                await message.delete();
            } catch (error) {
                console.error('[Honeypot] Failed to delete message:', error);
            }
            await handleTimeout(client, member);
        } else {
            await handleBan(client, member);
        }
    });
}
