import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { parse, stringify } from "smol-toml";


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BotConfig {
    /**
     * Membership / auto role assignment
     */
    membership: {
        /** Role assigned to verified members */
        member_role: string;
        /** Role auto-assigned to new joins, removed when member_role is assigned */
        guest_role: string;
    };

    /**
     * Giveaway settings
     */
    giveaway: {
        /** Channel to post giveaway announcements to (optional) */
        announcement_channel: string;
        /** Role to ping in announcement message (optional) */
        ping_role: string;
        /** Cron schedule for when to check for expired giveaways */
        schedule: string;
    };

    /**
     * Foodcheck settings
     */
    foodcheck: {
        /** Channel to post low-stock messages in */
        channel: string;
        /** Role to ping in alert message (optional) */
        ping_role: string;
        /** Item count at or below which an alert is triggered */
        threshold: number;
        /** Cron schedule for when to run the automated food check */
        schedule: string;
    };
}

/**
 * Summary of changes made during a config load or reload.
 * Returned by reloadConfig for user feedback.
 */
export interface ConfigLoadResult {
    /** Keys present in DEFAULTS but missing from the file - added with default values */
    added: string[];
    /** Keys present in the file but not in DEFAULTS - removed */
    removed: string[];
    /** Keys whose value had the wrong type - reset to default */
    fixed: string[];
}


// ---------------------------------------------------------------------------
// Defaults
// Used when creating and rebuilding config file
// ---------------------------------------------------------------------------

const DEFAULTS: BotConfig = {
        membership: {
        member_role: '',
        guest_role: '',
    },
    giveaway: {
        announcement_channel: '',
        ping_role: '',
        schedule: '*/1 * * * *',  // Every minute
    },
    foodcheck: {
        channel: '',
        ping_role: '',
        threshold: 15,
        schedule: '0 20 * * 0',  // Every Sundary, 20:00 UTC
    }
}


// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

type DeepRecord = { [key: string]: string | number | boolean | DeepRecord };

let _configPath = '';
let _config: BotConfig = structuredClone(DEFAULTS);


// ---------------------------------------------------------------------------
// Rebuild logic
// ---------------------------------------------------------------------------

/**
 * Rebuild a config object by walking `defaults` in order and pulling matching
 * values from `existing` where they are present and the same type.
 *
 * - Keys in `defaults` but not in `existing`  → default value used (new key)
 * - Keys in `existing` but not in `defaults`  → silently dropped (deprecated key)
 * - Type mismatch between existing and default → default value used (safe fallback)
 *
 * Returns the rebuilt object and two lists for logging.
 */
function rebuildConfig(
    existing: DeepRecord,
    defaults: DeepRecord,
    prefix = ''
): { rebuilt: DeepRecord } & ConfigLoadResult {
    const rebuilt: DeepRecord = {};
    const added: string[] = [];
    const removed: string[] = [];
    const fixed: string[] = [];

    // Walk defaults in declaration order to preserve key order
    for (const [key, defaultValue] of Object.entries(defaults)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (typeof defaultValue === 'object' && defaultValue !== null) {
            // Section — recurse
            const existingSection =
                key in existing && typeof existing[key] === 'object' && existing[key] !== null
                    ? (existing[key] as DeepRecord)
                    : {};

            const result = rebuildConfig(existingSection, defaultValue as DeepRecord, fullKey);
            rebuilt[key] = result.rebuilt;
            added.push(...result.added);
            removed.push(...result.removed);
            fixed.push(...result.fixed);
        } else if (key in existing && typeof existing[key] === typeof defaultValue) {
            // Key exists with matching type — preserve the user's value
            rebuilt[key] = existing[key]!;
        } else if (key in existing) {
            // Key exists but has wrong type - reset to default
            rebuilt[key] = defaultValue;
            fixed.push(fullKey);
        } else {
            // Key is missing - use default
            rebuilt[key] = defaultValue;
            added.push(fullKey);
        }
    }

    // Collect keys in existing that are not in defaults (deprecated)
    for (const key of Object.keys(existing)) {
        if (!(key in defaults)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            removed.push(fullKey);
        }
    }

    return { rebuilt, added, removed, fixed };
}


// ---------------------------------------------------------------------------
// Shared load logic
// ---------------------------------------------------------------------------

function loadFromDisk(configPath: string): { config: BotConfig } & ConfigLoadResult {
    let existing: DeepRecord = {};

    if (existsSync(configPath)) {
        try {
            existing = parse(readFileSync(configPath, 'utf-8')) as DeepRecord;
        } catch (error) {
            throw new Error(
                `[Config] Failed to parse ${configPath}: ` +
                `${error instanceof Error ? error.message : String(error)}\n` +
                `Check the file for syntax errors.`
            );
        }
    } else {
        console.log(`[Config] No config file found — creating at: ${configPath}`);
    }

    const { rebuilt, added, removed, fixed } = rebuildConfig(
        existing,
        DEFAULTS as unknown as DeepRecord
    );

    // Always write — keeps file order and structure in sync with DEFAULTS
    writeFileSync(configPath, stringify(rebuilt as Record<string, unknown>), 'utf-8');

    return { config: rebuilt as unknown as BotConfig, added, removed, fixed };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load config from file. Called once at startup.
 *
 * - Creates a config file from DEFAULTS if none exists yet.
 * - On every load, rebuilds the file to match DEFAULTS exactly:
 *     - Adds missing keys (new bot features)
 *     - Removes unknown keys (deprecated settings)
 *     - Resets type-mismatched values to defaults
 *     - Preserves all valid existing values
 */
export function loadConfig(configPath: string): BotConfig {
    _configPath = configPath;
    mkdirSync(dirname(configPath), { recursive: true });

    const { config, added, removed, fixed } = loadFromDisk(configPath);

    if (added.length   > 0) console.log(`[Config] Keys added:   ${added.join(', ')}`);
    if (removed.length > 0) console.log(`[Config] Keys removed: ${removed.join(', ')}`);
    if (fixed.length   > 0) console.log(`[Config] Keys fixed:   ${fixed.join(', ')}`);

    _config = config;
    return _config;
}

/**
 * Re-read the config file from disk and update the in-memory config.
 * Called by /config reload — no restart required.
 *
 * Returns a ConfigLoadResult so the caller can report what changed to the user.
 *
 * @throws if loadConfig has not been called first (no path set).
 */
export function reloadConfig(): ConfigLoadResult {
    if (!_configPath) {
        throw new Error('[Config] reloadConfig called before loadConfig — this is a bug.');
    }

    const { config, added, removed, fixed } = loadFromDisk(_configPath);

    if (added.length   > 0) console.log(`[Config] Reload — keys added:   ${added.join(', ')}`);
    if (removed.length > 0) console.log(`[Config] Reload — keys removed: ${removed.join(', ')}`);
    if (fixed.length   > 0) console.log(`[Config] Reload — keys fixed:   ${fixed.join(', ')}`);

    _config = config;
    return { added, removed, fixed };
}

/**
 * Returns the current in-memory config.
 */
export function getConfig(): BotConfig {
    return _config;
}

/**
 * Update a single config value in memory and persist to disk immediately.
 * Used by Discord commands that update settings without requiring a restart.
 *
 * @example
 * setConfigValue('giveaway', 'announcement_channel', '123456789');
 */
export function setConfigValue<
    S extends keyof BotConfig,
    K extends keyof BotConfig[S]
>(section: S, key: K, value: BotConfig[S][K]): void {
    if (!_configPath) {
        throw new Error('[Config] setConfigValue called before loadConfig — this is a bug.');
    }

    (_config[section] as BotConfig[S])[key] = value;
    writeFileSync(_configPath, stringify(_config as unknown as Record<string, unknown>), 'utf-8');
}


// ---------------------------------------------------------------------------
// Module initialisation — runs once when this module is first imported
// ---------------------------------------------------------------------------

export const CONFIG_PATH = process.env.CONFIG_PATH ?? './data/config.toml';
loadConfig(CONFIG_PATH);
