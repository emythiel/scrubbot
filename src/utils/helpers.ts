import { DiscordAPIError } from "discord.js";


/**
 * Log errors to the console
 * If a discord API error, log a simplified message. Else log a more in-depth error.
 */
export function logError(prefix: string, error: unknown): void {
    if (error instanceof DiscordAPIError) {
        console.error(`${prefix}: [${error.code}] ${error.message}`);
    } else {
        console.error(prefix, error);
    }
}

/**
 * Validate a Guild Wars 2 Account Name
 * Format: Name.#### where #### is exactly 4 digits
 *
 * Examples:
 * - "PlayerName.1234" ✅
 * - "I am somebody.5678" ✅
 * - "Name" ❌ (no dot and digits)
 * - "Name.12" ❌ (not 4 digits)
 * - "Name.12345" ❌ (too many digits)
 */
export function validateGW2Id(input: string): boolean {
    const trimmed = input.trim();

    const pattern = /^.+\.\d{4}$/;

    return pattern.test(trimmed) && trimmed.length >= 6;
}
