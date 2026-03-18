import Database from 'better-sqlite3';
import type { Giveaway, GiveawayWinner } from '../types/giveaway.js';

/**
 * Raw shape as SQLite returns it
 * - `ended`    0 | 1
 * - `entries`  JSON string
 * - `winners`  JSON string
 */
type GiveawayRow = Omit<Giveaway, 'ended' | 'entries' | 'winners'> & {
    ended: number;
    entries: string;
    winners: string;
};

/**
 * Parse raw DB row to Giveaway type
 */
function rowToGiveaway(row: GiveawayRow): Giveaway {
    return {
        ...row,
        ended: Boolean(row.ended),
        entries: JSON.parse(row.entries) as string[],
        winners: JSON.parse(row.winners) as GiveawayWinner[]
    };
}

let db: Database.Database;

/**
 * Set the database instance
 */
export function setDatabase(database: Database.Database) {
    db = database;
}

/**
 * Create a new giveaway row.
 * Entries and winners default to empty JSON arrays in schema.
 */
export function createGiveaway(data: Omit<Giveaway, 'entries' | 'winners' | 'ended'>): void {
    db.prepare(`
        INSERT INTO giveaways (
            message_id, channel_id, prize, description, hosted_by,
            created_at, ends_at, winner_count
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        data.message_id,
        data.channel_id,
        data.prize,
        data.description,
        data.hosted_by,
        data.created_at,
        data.ends_at,
        data.winner_count
    );
}

/**
 * Fetch a giveaway by message ID
 */
export function getGiveaway(messageId: string): Giveaway | null {
    const row = db.prepare(
        'SELECT * FROM giveaways WHERE message_id = ?'
    ).get(messageId) as GiveawayRow | undefined;

    return row ? rowToGiveaway(row) : null;
}

/**
 * Fetch all active giveaways whose end time has passed.
 */
export function getExpiredGiveaways(): Giveaway[] {
    const now = Math.floor(Date.now() / 1000);  // Current unix timestamp
    const rows = db.prepare(`
        SELECT * FROM giveaways
        WHERE ended = 0 AND ends_at <= ?
    `).all(now) as GiveawayRow[];

    return rows.map(rowToGiveaway);
}

/**
 * Mark a giveaway as ended
 */
export function markGiveawayEnded(messageId: string): void {
    db.prepare(
        'UPDATE giveaways SET ended = 1 WHERE message_id = ?'
    ).run(messageId);
}


// ------------------------------
// Entry management
// ------------------------------

/**
 * Add a user to a giveaway's entries array
 * Returns true if added, false if user already entered
 */
export function addEntry(messageId: string, userId: string): boolean {
    if (hasUserEntered(messageId, userId)) return false;

    // json_insert with '$[#]' path appends to end of array
    const result = db.prepare(`
        UPDATE giveaways
        SET entries = json_insert(entries, '$[#]', ?)
        WHERE message_id = ?
    `).run(userId, messageId);

    return result.changes > 0;
}

/**
 * Remove a user from a giveaway's entries array
 * Returns true if removed, false if not (eg user was not entered)
 */
export function removeEntry(messageId: string, userId: string): boolean {
    const giveaway = getGiveaway(messageId);
    if (!giveaway) return false;

    const index = giveaway.entries.indexOf(userId);
    if (index === -1) return false;

    const updated = [...giveaway.entries];
    updated.splice(index, 1);

    db.prepare(`
        UPDATE giveaways
        SET entries = ?
        WHERE message_id = ?
    `).run(JSON.stringify(updated), messageId);

    return true;
}

/**
 * Check if a user has entered a giveaway
 */
export function hasUserEntered(messageId: string, userId: string): boolean {
    const result = db.prepare(`
        SELECT EXISTS(
            SELECT 1
            FROM giveaways, json_each(giveaways.entries)
            WHERE giveaways.message_id = ? AND json_each.value = ?
        ) as exists_flag
    `).get(messageId, userId) as { exists_flag: number };

    return result.exists_flag === 1;
}

/**
 * Get entry count for a giveaway
 */
export function getEntryCount(messageId: string): number {
    const result = db.prepare(`
        SELECT json_array_length(entries) as count
        FROM giveaways
        WHERE message_id = ?
    `).get(messageId) as { count: number } | undefined;

    return result?.count ?? 0;
}

/**
 * Fetch all user IDs who entered a giveaway
 */
export function getEntries(messageId: string): string[] {
    return getGiveaway(messageId)?.entries ?? [];
}


// ------------------------------
// Winner management
// ------------------------------

/**
 * Add winners to a giveaway
 */
export function addWinners(messageId: string, winners: GiveawayWinner[]): void {
    db.prepare(`
        UPDATE giveaways
        SET winners = ?
        WHERE message_id = ?
    `).run(JSON.stringify(winners), messageId);
}

/**
 * Get winner user IDs for a giveaway
 */
export function getWinners(messageId: string): GiveawayWinner[] {
    return getGiveaway(messageId)?.winners ?? [];
}

/**
 * Get a specific winner's data
 */
export function getWinnerData(messageId: string, userId: string): GiveawayWinner | null {
    return getWinners(messageId).find(w => w.user_id === userId) ?? null;
}

/**
 * Mark a winner as having claimed their prize
 */
export function claimPrize(messageId: string, userId: string, gw2Id: string): boolean {
    const giveaway = getGiveaway(messageId);
    if (!giveaway) return false;

    const winner = giveaway.winners.find(w => w.user_id === userId);
    if (!winner || winner.claimed) return false;

    const updatedWinners = giveaway.winners.map(w =>
        w.user_id === userId ? { ...w, claimed: true, gw2_id: gw2Id} : w
    );

    db.prepare(`
        UPDATE giveaways
        SET winners = ?
        WHERE message_id = ?
    `).run(JSON.stringify(updatedWinners), messageId);

    return true;
}

/**
 * Replace unclaimed winners with new winners (for rerolling)
 * Keeps claimed winners, replaces unclaimed with new ones
 */
export function replaceUnclaimedWinners(messageId: string, newWinners: GiveawayWinner[]): void {
    const giveaway = getGiveaway(messageId);
    if (!giveaway) return;

    const updatedWinners = [
        ...giveaway.winners.filter(w => w.claimed),
        ...newWinners
    ];

    db.prepare(`
        UPDATE giveaways
        SET winners = ?
        WHERE message_id = ?
    `).run(JSON.stringify(updatedWinners), messageId);
}


// ------------------------------
// Modifying giveaways
// ------------------------------

/**
 * Update the ends_at timestamp for a giveaway (used when ending early)
 */
export function updateEndsAt(messageId: string, endsAt: number): void {
    db.prepare(`
        UPDATE giveaways
        SET ends_at = ?
        WHERE message_id = ?
    `).run(endsAt, messageId);
}

/**
 * Delete a giveaway completely (used when cancelling)
 */
export function deleteGiveaway(messageId: string): boolean {
    const result = db.prepare(`
        DELETE FROM giveaways
        WHERE message_id = ?
    `).run(messageId);

    return result.changes > 0;
}
