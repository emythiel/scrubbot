import cron from 'node-cron';
import type { Client, TextChannel } from 'discord.js';
import * as db from '../database/foodcheck.js';
import { fetchFoodCounts } from '../utils/foodcheckActions.js';
import { createFoodAlertEmbeds } from '../utils/embeds/foodcheck.js';
import { FOODCHECK_CONFIG, GW2_CONFIG } from '../config.js';


// ---------------------------------------------------------------------------
// Core check logic
// ---------------------------------------------------------------------------

/**
 * Fetch current guild storage, compare against tracked foods, and post an
 * alert to the configured channel for any items below the threshold
 *
 * Returns a summary string for logging / manual-trigger feedback
 */
export async function runFoodCheck(client: Client): Promise<string> {
    if (!GW2_CONFIG.apiKey || !GW2_CONFIG.guildId) {
        console.warn('[FoodCheck] Skipping check — GW2 API key or Guild ID not configured.');
        return 'Skipped: GW2 credentials not configured.';
    }

    if (!FOODCHECK_CONFIG.channel) {
        console.warn('[FoodCheck] Skipping check — alert channel not configured.');
        return 'Skipped: Alert channel not configured.';
    }

    const foods = db.getAllFoods();
    if (foods.length === 0) {
        return 'No food items are being tracked.';
    }

    let allItems;
    try {
        allItems = await fetchFoodCounts(foods);
    } catch (error) {
        console.error('[FoodCheck] Failed to fetch guild storage:', error);
        return `Error fetching guild storage: ${error instanceof Error ? error.message : String(error)}`;
    }

    const lowItems = allItems.filter(({ count }) => count <= FOODCHECK_CONFIG.threshold);
    if (lowItems.length === 0) {
        console.log('[FoodCheck] All items are above threshold. No alerts posted.');
        return 'All items are sufficiently stocked.';
    }

    try {
        const channel = await client.channels.fetch(FOODCHECK_CONFIG.channel) as TextChannel;
        const ping = FOODCHECK_CONFIG.pingRole ? `<@&${FOODCHECK_CONFIG.pingRole}>\n` : '';
        const itemWord = lowItems.length === 1 ? 'item is' : 'items are';

        await channel.send({
            content: `${ping}⚠️ **${lowItems.length} food ${itemWord} running low in the guild storage!**`,
            embeds: createFoodAlertEmbeds(lowItems)
        });

        console.log(`[FoodCheck] Alert posted for ${lowItems.length} item(s).`);
        return `Alert posted for ${lowItems.length} item(s): ${lowItems.map(i => i.food.name).join(', ')}`;
    } catch (error) {
        console.error('[FoodCheck] Failed to post alert:', error);
        return `Error posting alert: ${error instanceof Error ? error.message : String(error)}`;
    }
}


// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

/**
 * Start food check monitor.
 */
export function startFoodCheckMonitor(client: Client) {
    if (!FOODCHECK_CONFIG.channel) {
        console.log('[FoodCheck] Monitor not started — FOODCHECK_CHANNEL_ID is not set.');
        return;
    }

    console.log(`[FoodCheck] Monitor started. Scheduled: ${FOODCHECK_CONFIG.schedule} (UTC)`);

    cron.schedule(FOODCHECK_CONFIG.schedule, () => {
        console.log('[FoodCheck] Running scheduled food check...');
        runFoodCheck(client);
    }, { timezone: 'UTC' });
}
