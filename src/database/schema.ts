import Database from 'better-sqlite3';
import { dirname} from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import { DATABASE } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure data directory exists before opening the database
const dbDir = dirname(DATABASE.path);
mkdirSync(dbDir, { recursive: true });

/**
 * Initialize the database and create tables if they don't exist
 */
export function initializeDatabase(): Database.Database {
    const db = new Database(DATABASE.path);

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Single giveaways table - message_id used as primary key since
    // every giveaway maps 1:1 to a Discord message and we always look up by message_id
    db.exec(`
        CREATE TABLE IF NOT EXISTS giveaways (
            message_id   TEXT    PRIMARY KEY,
            channel_id   TEXT    NOT NULL,
            prize        TEXT    NOT NULL,
            description  TEXT,
            hosted_by    TEXT    NOT NULL,
            created_at   INTEGER NOT NULL,
            ends_at      INTEGER NOT NULL,
            ended        INTEGER NOT NULL DEFAULT 0,
            winner_count INTEGER NOT NULL DEFAULT 1,
            entries      TEXT    NOT NULL DEFAULT '[]',
            winners      TEXT    NOT NULL DEFAULT '[]'
        )
    `);

    // Create index for finding active/expired giveaways
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_giveaways_ended
        ON giveaways(ended, ends_at);
    `);

    console.log('Database initialized successfully');

    return db;
}
