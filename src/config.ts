import pkg from '../package.json' with { type: 'json' };

/**
 * Centralized bot configuration
 * All server-specific settings are defined here
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
 * Channel IDs for various of bot functions
 */
export const CHANNELS = {
    /** Announcement channel */
    announcements: process.env.CHANNEL_ID_ANNOUNCEMENT || null,

    /** General/main channel */
    general: process.env.CHANNEL_ID_GENERAL || null,

    /** Admin channel */
    admin: process.env.CHANNEL_ID_ADMIN || null,

    /** Mentor channel */
    mentor: process.env.CHANNEL_ID_MENTOR || null,
} as const;


/**
 * Role IDs for permissions and user management
 */
export const ROLES = {
    admin: process.env.ROLE_ID_ADMIN || null,
    mentor: process.env.ROLE_ID_MENTOR || null,
    member: process.env.ROLE_ID_MEMBER || null,
    guest: process.env.ROLE_ID_GUEST || null,
    giveaway: process.env.ROLE_ID_GIVEAWAY || null,
    foodcheck: process.env.ROLE_ID_FOODCHECK || null,
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
 * Giveaway configuration
 */
export const GIVEAWAY_CONFIG = {
    /** Cron schedule - how often to check */
    schedule: '*/1 * * * *',
} as const;

/**
 * Foodcheck configuration
 */
export const FOODCHECK_CONFIG = {
    /** Channel to post low-stock alerts to. Must be set for monitor to run */
    channelId: process.env.FOODCHECK_CHANNEL_ID || CHANNELS.admin,

    /** Role ID to ping in alert messages */
    roleId: ROLES.foodcheck || null,

    /** Item threshold for automated check */
    threshold: parseInt(process.env.FOODCHECK_THRESHOLD || '15', 10),

    /** Cron schedule - how often to check */
    schedule: '0 20 * * 0'
} as const;


/**
 * Helper function to check if a channel is configured
 */
export function isChannelConfigured(channel: keyof typeof CHANNELS): boolean {
    return CHANNELS[channel] !== null;
}


/**
 * Helper function to check if a role is configured
 */
export function isRoleConfigured(role: keyof typeof ROLES): boolean {
    return ROLES[role] !== null;
}


/**
 * Display configuration status (for debugging)
 */
export function logConfigStatus(): void {
    console.log('\n=== Bot Configuration ===');
    console.log(`Version: ${pkg.version}\n`)

    console.log(`Server ID: ${BOT_CONFIG.guildId}`);
    console.log(`Client ID: ${BOT_CONFIG.clientId}`);
    console.log(`Database: ${DATABASE.path}`);

    console.log('\n--- Channels ---');
    Object.entries(CHANNELS).forEach(([key, value]) => {
        console.log(`${key}: ${value || 'Not configured'}`);
    });

    console.log('\n--- Roles ---');
    Object.entries(ROLES).forEach(([key, value]) => {
        console.log(`${key}: ${value || 'Not configured'}`);
    });

    console.log('\n--- GW2 API ---');
    console.log(`API Key: ${GW2_CONFIG.apiKey ? 'Configured': 'Not configured'}`);
    console.log(`Guild ID: ${GW2_CONFIG.guildId || 'Not configured'}`);

    console.log('========================\n');
}
