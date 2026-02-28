import { Client, Events, GatewayIntentBits, MessageFlags, REST, Routes } from 'discord.js';
import { initializeDatabase } from './database/schema.js';
import { setDatabase as setGiveawayDb } from './database/giveaways.js';
import { setDatabase as setFoodcheckDb } from './database/foodcheck.js';
import { BOT_CONFIG, logConfigStatus } from './config.js';
import * as readyEvent from './events/ready.js';
import * as interactionCreateEvent from './events/interactionCreate.js';
import * as giveawayCommand from './commands/giveaway.js';
import * as foodcheckCommand from './commands/foodcheck.js';

// Validate configuration on startup
console.log('Validating configuration...');
logConfigStatus();

// Initialize database
console.log('Initializing database...');
const db = initializeDatabase();
setGiveawayDb(db);
setFoodcheckDb(db);

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

// Register event handlers
client.once(Events.ClientReady, (readyClient) => {
    readyEvent.execute(readyClient);
});

client.on(Events.InteractionCreate, async (interaction) => {
    try {
        await interactionCreateEvent.execute(interaction);
    } catch (error) {
        console.error('Error handling interaction:', error);

        // Only attempt a reply if the interaction supports it
        if (!interaction.isRepliable()) return;

        // Try to respond with an error message
        try {
            const payload = { content: '❌ An error occurred while processing your request.' };
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(payload);
            } else {
                await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
            }
        } catch (replyError) {
            console.error('Error sending error message:', replyError);
        }
    }
});

// Register slash commands
async function registerCommands() {
    const commands = [
        giveawayCommand.data.toJSON(),
        foodcheckCommand.data.toJSON()
    ];

    const rest = new REST().setToken(BOT_CONFIG.token);

    try {
        console.log('Registering slash commands for guild...');

        // Always register as guild commands for instant updates (single-server bot)
        await rest.put(
            Routes.applicationGuildCommands(BOT_CONFIG.clientId, BOT_CONFIG.guildId),
            { body: commands }
        );

        console.log(`✅ Successfully registered ${commands.length} command(s)`);
    } catch (error) {
        console.error('❌ Error registering commands:', error);
        throw error;
    }
}

// Start the bot
async function start() {
    try {
        await registerCommands();
        await client.login(BOT_CONFIG.token);
    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
}

start();
