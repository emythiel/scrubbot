import { EmbedBuilder } from "discord.js";
import type { Foodcheck } from "../../types/foodcheck.js";
import type { FoodItemData } from "../../integrations/gw2-api.js";


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A food item paried with its current storage count.
 * Used by status and alert embeds.
 */
export interface FoodWithCount {
    food: Foodcheck;
    count: number;
}


// ---------------------------------------------------------------------------
// /foodcheck add — confirmation embed
// ---------------------------------------------------------------------------

/**
 * Confirmation embed shown after successfully adding a food item
 */
export function createFoodAddedEmbed(
    itemData: FoodItemData,
    wikiUrl: string,
    gw2EfficiencyUrl: string,
    threshold: number
): EmbedBuilder {
    return new EmbedBuilder()
        .setTitle(`✅ Now tracking: ${itemData.name}`)
        .setThumbnail(itemData.icon)
        .setColor(0x57F287)
        .addFields(
            { name: 'Guild Upgrade ID', value: `\`${itemData.guild_upgrade_id}\``, inline: true },
            { name: 'Alert Threshold', value: `≤ ${threshold}`, inline: true },
            { name: 'Wiki', value: `[Open](${wikiUrl})`, inline: true },
            { name: 'GW2 Efficiency', value: `[Open](${gw2EfficiencyUrl})`, inline: true },
        )
        .setFooter({ text: 'Use /foodcheck status to see current stock levels' });
}


// ---------------------------------------------------------------------------
// /foodcheck status — overview embed
// ---------------------------------------------------------------------------

/**
 * Full stock overview embed for /foodcheck status.
 * Lists every tracked item with a ✅ / ⚠️ / ❌ status indicator.
 */
export function createFoodStatusEmbed(
    items: FoodWithCount[],
    threshold: number
): EmbedBuilder {
    const lines = items.map(({ food, count }) => {
        const status = count === 0 ? '❌' : count <= threshold ? '⚠️' : '✅';
        return `${status} **[${food.name}](${food.wiki_url})** — \`${count}\` in storage`;
    });

    return new EmbedBuilder()
        .setTitle('🍖 Guild Food Stock Status')
        .setDescription(lines.join('\n'))
        .setColor(0x5865F2)
        .setFooter({ text: `Threshold: ≤${threshold}  |  ✅ OK  ⚠️ Low  ❌ Empty` })
        .setTimestamp();
}


// ---------------------------------------------------------------------------
// Scheduled alert — one embed per low item
// ---------------------------------------------------------------------------

/**
 * Build one embed per item that is at or below the threshold.
 * Used by the scheduled food check monitor.
 *
 * Red  (0xED4245) — item is completely empty
 * Yellow (0xFEE75C) — item is low but not empty
 */
export function createFoodAlertEmbeds(
    lowItems: FoodWithCount[],
    threshold: number
): EmbedBuilder[] {
    return lowItems.map(({ food, count }) =>
        new EmbedBuilder()
            .setTitle(food.name)
            .setURL(food.wiki_url)
            .setThumbnail(food.icon)
            .setColor(count === 0 ? 0xED4245 : 0xFEE75C)
            .addFields(
                { name: 'In Storage', value: `${count}`, inline: true },
                { name: 'Threshold', value: `${threshold}`, inline: true },
                { name: 'Crafting', value: `[GW2 Efficiency](${food.gw2_efficiency_url})`, inline: true },
            )
    );
}
