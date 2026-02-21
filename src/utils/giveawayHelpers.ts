/**
 * Select random entries from an array of strings
 */
export function selectRandomWinners(entries: string[], count: number): string[] {
    if (entries.length === 0) return [];

    const pool = [...entries];

    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = pool[i] as string;
        pool[i] = pool[j] as string;
        pool[j] = tmp;
    }

    return pool.slice(0, Math.min(count, pool.length));
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
