import type  { Client } from 'discord.js';
import { startGiveawayMonitor } from '../tasks/giveawayMonitor.js';

export async function execute(client: Client) {
    console.log(`Ready! Logged in as ${client.user?.tag}`);

    // Start background tasks
    startGiveawayMonitor(client);
}
