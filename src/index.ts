import { Client, Events, GatewayIntentBits } from 'discord.js';
const token = process.env.DISCORD_TOKEN

if (!token) {
    throw new Error("Token not found");
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (readyClient: Client<true>) => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
})

client.login(token);
