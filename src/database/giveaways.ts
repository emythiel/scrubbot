import Database from 'better-sqlite3';
import type { Giveaway } from '../types/giveaway.js';

// Represents the raw shape of a row as SQLite returns it
// SQLite has no boolean type, so 'ended' comes back as 0 or 1
type GiveawayRow = Omit<Giveaway, 'ended'> & { ended: number };

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
    const stmt = db.prepare(`
        INSERT INTO giveaways (
            message_id, channel_id, prize, description, hosted_by,
            created_at, ends_at, winner_count
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
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
    const stmt = db.prepare('SELECT * FROM giveaways WHERE message_id = ?');
    const row = stmt.get(messageId) as GiveawayRow | undefined;

    if (!row) return null;

    return { ...row, ended: Boolean(row.ended) };
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

    return rows.map(row => ({ ...row, ended: Boolean(row.ended) }));
}

/**
 * Mark a giveaway as ended
 */
export function markGiveawayEnded(messageId: string): void {
    db.prepare('UPDATE giveaways SET ended = 1 WHERE message_id = ?').run(messageId);
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
 * Returns true if removed, false if user wasn't entered
 */
export function removeEntry(messageId: string, userId: string): boolean {
    const giveaway = getGiveaway(messageId);
    if (!giveaway) return false;

    const entries: string[] = JSON.parse(giveaway.entries);
    const index = entries.indexOf(userId);
    if (index === -1) return false;

    entries.splice(index, 1);

    db.prepare(`
        UPDATE giveaways
        SET entries = ?
        WHERE message_id = ?
    `).run(JSON.stringify(entries), messageId);

    return true;
}

/**
 * Check if a user has entered a giveaway
 */
export function hasUserEntered(messageId: string, userId: string): boolean {
    // Use SQLite json_each to check if user exists in entries
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
    const giveaway = getGiveaway(messageId);
    if (!giveaway) return [];

    return JSON.parse(giveaway.entries) as string[];
}

// ------------------------------
// Winner management
// ------------------------------

/**
 * Add winners to a giveaway
 */
export function addWinners(messageId: string, userIds: string[]): void {
    db.prepare(`
        UPDATE giveaways
        SET winners = ?
        WHERE message_id = ?
    `).run(JSON.stringify(userIds), messageId);
}

/**
 * Get winner user IDs for a giveaway
 */
export function getWinners(messageId: string): string[] {
    const giveaway = getGiveaway(messageId);
    if (!giveaway) return [];

    return JSON.parse(giveaway.winners) as string[];
}
