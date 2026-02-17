/**
 * Parse a duration string and return milliseconds
 *
 * Supported single durations:
 * - "10m" or "10 minutes" = 10 minutes
 * - "2h" or "2 hours" = 2 hours
 * - "5d" or "5 days" = 5 days
 * - "1w" or "1 week" = 1 week
 *
 * Supports combined durations (in any order):
 * - "5d 2h" = 5 days + 2 hours
 * - "2h 5d" = 2 hours ? 5 days (same as above)
 * - "1w 3d 5h 30m" = 1 week + 3 days + 5 hours + 30 minutes
 *
 * @param input - Duration string (e.g., "10m", "2 hours", "5d")
 * @returns Duration in seconds, or null if invalid
 */
export function parseDuration(input: string): number | null {
    const trimmed = input.trim().toLowerCase();

    // Pattern: to match individual time components: number + unit
    // Matches things like "10m, 2 hours" etc.
    const pattern = /(\d+\.?\d*)\s*(minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w)/g;

    const matches = [...trimmed.matchAll(pattern)];

    if (matches.length === 0) {
        return null;
    }

    let totalSeconds = 0;

    for (const match of matches) {
        const valueStr = match[1];
        const unit = match[2];

        if (!valueStr || !unit) {
            return null;
        }

        const value = parseFloat(valueStr);

        if (isNaN(value) || value <= 0) {
            return null;
        }

        // Convert to seconds and add to total
        switch (unit) {
        case 'minute':
        case 'minutes':
        case 'min':
        case 'mins':
        case 'm':
            totalSeconds += value * 60;
            break;

        case 'hour':
        case 'hours':
        case 'hr':
        case 'hrs':
        case 'h':
            totalSeconds += value * 60 * 60;
            break;

        case 'day':
        case 'days':
        case 'd':
            totalSeconds += value * 24 * 60 * 60;
            break;

        case 'week':
        case 'weeks':
        case 'w':
            totalSeconds += value * 7 * 24 * 60 * 60;
            break;

        default:
            return null;
        }
    }

    return totalSeconds > 0 ? Math.floor(totalSeconds) : null;
}

/**
 * Get current Unix timestamp (in seconds)
 * Used by Discord for timestamps
 *
 * @returns Current unix timestamp in seconds
 */
export function getUnixTimestamp(): number {
    return Math.floor(Date.now() / 1000);
}

/**
 * Format a Unix timestamp as a Discord timestamp (shows in user's local timezone)
 * Discord's timestamp format: <t:UNIX_TIMESTAMP:STYLE>
 *
 * Styles:
 * - 'd' - Short date (15/02/2026)
 * - 'D' - Long date (15 February 2026)
 * - 't' - Short time (17:46)
 * - 'T' - Long time (17:46:00)
 * - 'f' - Short date/time (15 February 2026 17:46) [DEFAULT]
 * - 'F' - Long date/time (Sunday, 15 February 2026 17:46)
 * - 'R' - Relative time (in 5 minutes / 2 hours ago)
 *
 * @param unixTimestamp - Unix timestamp in seconds
 * @param style - Discord timestamp style
 * @returns Discord timestamp string (e.g., "<t:1771173960:R>")
 */
export function formatDiscordTimestamp(
    unixTimestamp: number,
    style: 'd' | 'D' | 't' | 'T' | 'f' | 'F' | 'R' = 'f'
): string {
    return `<t:${unixTimestamp}:${style}>`;
}
