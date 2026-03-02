import Database from 'better-sqlite3';
import type { Foodcheck } from '../types/foodcheck.js';

let db: Database.Database;

/**
 * Set database instance
 */
export function setDatabase(database: Database.Database) {
    db = database;
}

/**
 * Add a food to database
 */
export function addFood(data: Foodcheck): void {
    db.prepare(`
        INSERT INTO foodcheck (
            guild_upgrade_id, name, icon, wiki_url, gw2_efficiency_url
        )
        VALUES (?, ?, ?, ?, ?)
    `).run(
        data.guild_upgrade_id,
        data.name,
        data.icon,
        data.wiki_url,
        data.gw2_efficiency_url
    );
}

/**
 * Remove a food from database
 */
export function removeFood(guildUpgradeId: number): boolean {
    const result = db.prepare(`
        DELETE FROM foodcheck
        WHERE guild_upgrade_id = ?
    `).run(guildUpgradeId);

    return result.changes > 0;
}

/**
 * Retrieve single food item by guild_upgrade_id
 * Return null if not found
 */
export function getFoodById(guildUpgradeId: number): Foodcheck | null {
    return db.prepare(`
        SELECT * FROM foodcheck WHERE guild_upgrade_id = ?
    `).get(guildUpgradeId) as Foodcheck | null;
}

/**
 * Retrieve all tracked food items, ordered by name
 */
export function getAllFoods(): Foodcheck[] {
    return db.prepare(`
        SELECT * FROM foodcheck ORDER BY name ASC
    `).all() as Foodcheck[];
}
