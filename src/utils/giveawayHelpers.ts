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
