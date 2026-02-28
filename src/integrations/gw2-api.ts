/**
 * Guild Wars 2 API integration
 */

const GW2_BASE = 'https://api.guildwars2.com/v2';


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single slot in the guild's storage (bank)
 * `id` is guild_upgrade_id, *NOT* item ID
 */
export interface GuildStorageSlot {
    id: number;
    count: number;
}

/**
 * Shape of a GW2 item returned by /v2/items
 */
interface GW2Item {
    id: number;
    name: string;
    icon: string;
    type: string;
    details?: {
        type?: string;
        guild_upgrade_id?: number;
    };
}

/**
 * Data extracted from /v2/items API URL when adding a food item
 */
export interface FoodItemData {
    guild_upgrade_id: number;
    name: string;
    icon: string;
}


// ---------------------------------------------------------------------------
// Guild Storage
// ---------------------------------------------------------------------------

/**
 * Fetch current contents of guilds storage bank.
 *
 * @throws if the request fails or the API returns a non-OK status.
 */
export async function fetchGuildStorage(guildId: string, apiKey: string): Promise<GuildStorageSlot[]> {
    const url = `${GW2_BASE}/guild/${guildId}/storage?access_token=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`GW2 API error ${response.status}: ${response.statusText}`);
    }

    return response.json() as Promise<GuildStorageSlot[]>;
}


// ---------------------------------------------------------------------------
// Item Lookup (used during /foodcheck add)
// ---------------------------------------------------------------------------

/**
 * Parse a /v2/items URL provided by user and extract needed data.
 *
 * URL is expected to look something like this:
 *   https://api.guildwars2.com/v2/items?ids=91734,92479&lang=en
 *
 * We look for the item that has `details.guild.upgrade_id` set (Gizmo wrapper).
 *
 * @throws if the URL is invalid, request fails, or we can't find the data required.
 */
export async function fetchFoodItemData(apiUrl: string): Promise<FoodItemData> {
    // Basic URL validation
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(apiUrl);
    } catch {
        throw new Error('The API URL you entered is not a valid URL.');
    }

    if (!parsedUrl.hostname.includes('api.guildwars2.com')) {
        throw new Error('The API URL must point to api.guildwars2.com.');
    }

    const response = await fetch (apiUrl);
    if (!response.ok) {
        throw new Error(`GW2 API returned ${response.status}: ${response.statusText}`);
    }

    const items = await response.json() as GW2Item[];

    if (!Array.isArray(items) || items.length === 0) {
        throw new Error('The API returned no items. Check the URL and try again.');
    }

    // Find item that carries guild_upgrade_id (generally gizmo type)
    const gizmo = items.find(item => item.details?.guild_upgrade_id != null);
    if (!gizmo || gizmo.details?.guild_upgrade_id == null) {
        throw new Error(
            'Could not find a `guild_upgrade_id` in the API response. ' +
            'Make sure the URL includes both Gizmo variant.'
        );
    }

    return {
        guild_upgrade_id: gizmo.details.guild_upgrade_id,
        name: gizmo.name,
        icon: gizmo.icon,
    };
}


// ---------------------------------------------------------------------------
// Wiki scraping (used during /foodcheck add)
// ---------------------------------------------------------------------------

/**
 * URLs extracted from a GW2 wiki item page
 */
export interface WikiPageUrls {
    apiUrl: string;
    gw2EfficiencyUrl: string;
}

/**
 * Fetch a GW2 wiki item page and extract the GW2 API items URL and the
 * GW2 Efficiency crafting URL from the page HTML
 *
 * @throws if the page can't be fetched or either URL is not found on the page.
 */
export async function fetchWikiUrls(wikiUrl: string): Promise<WikiPageUrls> {
    // Basic URL validation
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(wikiUrl);
    } catch {
        throw new Error('The Wiki URL you entered is not a valid URL.');
    }

    if (!parsedUrl.hostname.includes('wiki.guildwars2.com')) {
        throw new Error('The Wiki URL must point to wiki.guildwars2.com.');
    }

    const response = await fetch(wikiUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ScrubBot/1.0; guild food monitor)'
        }
    });
    
    if (!response.ok) {
        throw new Error(`Wiki returned ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Extract GW2 API items URL
    // Matches: href="https://api.guildwars2.com/v2/items?..."
    // The URL may contain & amp; in raw HTML - decode it after extraction
    const apiMatch = html.match(/href="(https:\/\/api\.guildwars2\.com\/v2\/items\?[^"]+)"/);
    if (!apiMatch || !apiMatch[1]) {
        throw new Error(
            'Could not find a GW2 API items URL on this wiki page. ' +
            'Make sure the URL points to a food item page, and has a link to the API.'
        );
    }

    // Extract GW2 Efficiency crafting calculator URL
    // Matches: href="https://gw2efficiency.com/crafting/calculator/..."
    const efficiencyMatch = html.match(/href="(https:\/\/gw2efficiency\.com\/crafting\/calculator\/[^"]+)"/);
    if (!efficiencyMatch || !efficiencyMatch[1]) {
        throw new Error(
            'Could not find a GW2 Efficiency URL on this wiki page. ' +
            'Make sure the URL points to a food item page, and has a link to GW2 Efficiency.'
        );
    }

    return {
        // Decode HTML entities (e.g. & amp; -> &)
        apiUrl: apiMatch[1].replaceAll('&amp;', '&'),
        gw2EfficiencyUrl: efficiencyMatch[1]
    };
}
