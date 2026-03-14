import type { GuildMember, PartialGuildMember } from "discord.js";
import { MEMBERSHIP_CONFIG as CONF } from '../config.js';

/**
 * Fired when a user joins the server.
 * Automatically assigns Guest role.
 */
export async function addGuest(member: GuildMember): Promise<void> {
    if (!CONF.guestRole) {
        console.warn('Guest role is not configured — skipping auto-assign on join.');
        return;
    }

    // Exit if user already has Guest role
    if (member.roles.cache.has(CONF.guestRole)) return;

    try {
        await member.roles.add(CONF.guestRole);
        console.log(`Assigned Guest role to ${member.user.tag} on join.`);
    } catch (error) {
        console.error(`Failed to assign Guest role to ${member.user.tag}:`, error);
    }
}

/**
 * Fired when a guild member is updated (roles, nickname, etc).
 * When 'Member' role is added, remove 'Guest' role.
 */
export async function removeGuest(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember
): Promise<void> {
    if (!CONF.memberRole || !CONF.guestRole) {
        console.warn('Member or Guest role is not configured — skipping role swap check.');
        return;
    }

    // Find roles added
    const addedRoles = newMember.roles.cache.filter(
        role => !oldMember.roles.cache.has(role.id)
    );

    // Only act if Member role was added
    if (!addedRoles.has(CONF.memberRole)) return;

    // Only remove Guest if user has it
    if (!newMember.roles.cache.has(CONF.guestRole)) return;

    try {
        await newMember.roles.remove(CONF.guestRole);
        console.log(`Removed Guest role from ${newMember.user.tag} after Member role was assigned.`);
    } catch (error) {
        console.error(`Failed to remove Guest role from ${newMember.user.tag}:`, error);
    }
}
