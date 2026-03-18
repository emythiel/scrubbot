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
