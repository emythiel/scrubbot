/**
 * Giveaway type definitions
 */

export interface Giveaway {
    message_id: string;         // Discord message ID - used as primary key
    channel_id: string;         // Discord channel ID - needed to fetch message on giveaway end
    prize: string;              // Prize text
    description: string | null; // Option description text
    hosted_by: string;          // Discord user ID
    created_at: number;         // Unix timestamp (seconds)
    ends_at: number;            // Unix timestamp (seconds)
    ended: boolean;             // If the giveaway has ended (0|1)
    winner_count: number;       // Amount of winners
    entries: string;            // JSON array of user IDs: ["123", "456", "789"]
    winners: string;            // JSON array of GiveawayWinner objects
}

/**
 * Individual winner with claim status and gw2 id
 * Stored as JSON in winners column
 */
export interface GiveawayWinner {
    user_id: string,            // Discord user ID
    claimed: boolean;           // Whether user has claimed their prize or not
    gw2_id: string | null;      // The users Guild Wars 2 ID
}
