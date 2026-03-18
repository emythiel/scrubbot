import type { Foodcheck } from "../types/foodcheck.js";
import type { FoodWithCount } from "./embeds/foodcheck.js";
import { fetchGuildStorage } from "../integrations/gw2-api.js";
import { GW2_CONFIG } from "../config.js";

/**
 * Fetch current guild storage and map each tracked food item to its count.
 *
 * @throws if GW2 api keys are missing, or if the API request fails
 */
export async function fetchFoodCounts(foods: Foodcheck[]): Promise<FoodWithCount[]> {
    const { guildId, apiKey } = GW2_CONFIG;

    if (!guildId || !apiKey) {
        throw new Error('GW2 API key or Guild ID is not configured.');
    }

    const storage = await fetchGuildStorage(guildId, apiKey);
    const storageMap = new Map<number, number>(storage.map(slot => [slot.id, slot.count]));

    return foods.map(food => ({
        food,
        count: storageMap.get(food.guild_upgrade_id) ?? 0
    }));
}
