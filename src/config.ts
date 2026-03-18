import pkg from '../package.json' with { type: 'json' };
import { getConfig } from './configLoader.js';

/**
 * Bot configuration
 *
 * Environment variables: DISCORD_TOKEN, CLIENT_ID, GUILD_ID, GW2_API_KEY, GW2_GUILD_ID, DB_PATH, CONFIG_PATH
 */

const requiredEnvVars = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID'] as const;

for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
        throw new Error(`Missing required environment variable: ${varName}`);
    }
}

/**
 * Bot authentication and identity
 */
export const BOT_CONFIG = {
    /** Discord bot token */
    token: process.env.DISCORD_TOKEN!,

    /** Discord bot client ID */
    clientId: process.env.CLIENT_ID!,

    /** Discord server ID (Bot is designed for single-server use) */
    guildId: process.env.GUILD_ID!,
} as const;

/**
 * Guild Wars 2 API configuration
 */
export const GW2_CONFIG = {
    /** GW2 Player API Key (Guild Admin) */
    apiKey: process.env.GW2_API_KEY || null,

    /** GW2 Guild ID */
    guildId: process.env.GW2_GUILD_ID || null,
} as const;

/**
 * Database configuration
 */
export const DATABASE = {
    /** Path to the Database SQLite file */
    path: process.env.DB_PATH || './data/scrubbot.db',

    /** Database version (in case of migrations in the future) */
    version: process.env.DB_VERSION || '1.0',
} as const;


// ---------------------------------------------------------------------------
// config.toml Configuration
// ---------------------------------------------------------------------------

/**
 * Membership / auto role assignment configuration
 */
export const MEMBERSHIP_CONFIG = {
    /** Role assigned to verified members */
    get memberRole() { return getConfig().membership.member_role || null; },

    /** Role auto-assigned to new users, remved when memberRole is assigned */
    get guestRole() { return getConfig().membership.guest_role || null; }
};

/**
 * Giveaway configuration
 */
export const GIVEAWAY_CONFIG = {
    /** Channel to post giveaway announcements in */
    get announcementChannel() { return getConfig().giveaway.announcement_channel || null; },

    /** Role to ping in announcement message */
    get pingRole() { return getConfig().giveaway.ping_role || null; },

    /** Cron schedule for checking expired giveaways */
    get schedule() { return getConfig().giveaway.schedule; }
};

/**
 * Foodcheck configuration
 */
export const FOODCHECK_CONFIG = {
    /** Channel to post low-stock messages in */
    get channel() { return getConfig().foodcheck.channel || null; },

    /** Role to ping in alert messages */
    get pingRole() { return getConfig().foodcheck.ping_role || null; },

    /** Item count at or below which an alert is triggered */
    get threshold() { return getConfig().foodcheck.threshold; },

    /** Cron schedule for automated food check */
    get schedule() { return getConfig().foodcheck.schedule;},
};


// ---------------------------------------------------------------------------
// Debugging
// ---------------------------------------------------------------------------

/**
 * Go through a config section recursively and print each key-value pair.
 */
function logConfigSection(sectionName: string, section: Record<string, unknown>): void {
    console.log(`\n--- ${sectionName} (config.toml) ---`);
    for (const [key, value] of Object.entries(section)) {
        const display = value === '' ? 'Not configured' : String(value);
        console.log(`${key}: ${display}`);
    }
}

/**
 * Display configuration status (for debugging)
 */
export function logConfigStatus(): void {
    console.log('\n=== Bot Configuration ===');
    console.log(`Version:  ${pkg.version}`);
    console.log(`Database: ${DATABASE.path}`);

    console.log('\n--- Discord ---');
    console.log(`Server ID: ${BOT_CONFIG.guildId}`);
    console.log(`Client ID: ${BOT_CONFIG.clientId}`);

    console.log('\n--- GW2 API ---');
    console.log(`API Key:  ${GW2_CONFIG.apiKey  ? 'Configured' : 'Not configured'}`);
    console.log(`Guild ID: ${GW2_CONFIG.guildId || 'Not configured'}`);

    const cfg = getConfig() as unknown as Record<string, Record<string, unknown>>;
    for (const [sectionName, section] of Object.entries(cfg)) {
        logConfigSection(sectionName, section);
    }

    console.log('========================\n');
}
