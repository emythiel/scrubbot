import cron from 'node-cron';
import type { Client } from 'discord.js';
import * as db from '../database/giveaways.js';
import { endGiveaway } from '../utils/giveawayActions.js';
import { GIVEAWAY_CONFIG } from '../config.js';

/**
 * Check for expired giveaways and end them
 */
async function checkExpiredGiveaways(client: Client) {
    const expired = db.getExpiredGiveaways();

    for (const giveaway of expired) {
        await endGiveaway(client, giveaway.message_id);
    }
}

/**
 * Start the giveaway monitor task
 * Checks for expired giveaways every 30 seconds
 */
export function startGiveawayMonitor(client: Client) {
    console.log('[Giveaway] Monitor started.');

    // Run on startup to catch any giveaways that expired while bot was offline
    checkExpiredGiveaways(client)

    // Run cron job schedule
    cron.schedule(GIVEAWAY_CONFIG.schedule, () => {
        checkExpiredGiveaways(client);
    });
}
