import cron from 'node-cron';
import type { Client, TextChannel } from 'discord.js';
import * as db from '../database/foodcheck.js';
import { fetchGuildStorage } from '../integrations/gw2-api.js';
import { createFoodAlertEmbeds } from '../utils/embeds/foodcheck.js';
import { FOODCHECK_CONFIG, GW2_CONFIG } from '../config.js';


// ---------------------------------------------------------------------------
// Core check logic (exported so a future /foodcheck test command can call it)
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

    if (!FOODCHECK_CONFIG.channelId) {
        console.warn('[FoodCheck] Skipping check — alert channel not configured.');
        return 'Skipped: Alert channel not configured.';
    }

    const foods = db.getAllFoods();
    if (foods.length === 0) {
        return 'No food items are being tracked.';
    }

    let storage;
    try {
        storage = await fetchGuildStorage(GW2_CONFIG.guildId, GW2_CONFIG.apiKey);
    } catch (error) {
        console.error('[FoodCheck] Failed to fetch guild storage:', error);
        return `Error fetching guild storage: ${error instanceof Error ? error.message : String(error)}`;
    }

    const storageMap = new Map<number, number>(storage.map(slot => [slot.id, slot.count]));
    const threshold = FOODCHECK_CONFIG.threshold;

    // Filter to only items below threshold
    const lowItems = foods
        .map(food => ({ food, count: storageMap.get(food.guild_upgrade_id) ?? 0 }))
        .filter(({ count }) => count <= threshold );

    if (lowItems.length === 0) {
        console.log('[FoodCheck] All items are above threshold. No alerts posted.');
        return 'All items are sufficiently stocked.';
    }

    try {
        const channel = await client.channels.fetch(FOODCHECK_CONFIG.channelId) as TextChannel;
        const ping = FOODCHECK_CONFIG.roleId ? `<@&${FOODCHECK_CONFIG.roleId}> ` : '';
        const itemWord = lowItems.length === 1 ? 'item is' : 'items are';

        await channel.send({
            content: `${ping}⚠️ **${lowItems.length} food ${itemWord} running low in the guild storage!**`,
            embeds: createFoodAlertEmbeds(lowItems, threshold)
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
 *
 * Uses setTimeout to fire precisely at the scheduled time, then setInterval
 * to repeat every week from that point.
 */
export function startFoodCheckMonitor(client: Client) {
    if (!FOODCHECK_CONFIG.channelId) {
        console.log('[FoodCheck] Monitor not started — FOODCHECK_CHANNEL_ID is not set.');
        return;
    }

    console.log(`[FoodCheck] Monitor started. Scheduled: ${FOODCHECK_CONFIG.schedule} (UTC)`);

    cron.schedule(FOODCHECK_CONFIG.schedule, () => {
        console.log('[FoodCheck] Running scheduled food check...');
        runFoodCheck(client);
    }, { timezone: 'UTC' });
}
