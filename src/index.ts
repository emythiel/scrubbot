import { Client, Events, GatewayIntentBits, MessageFlags, REST, Routes } from 'discord.js';
import { initializeDatabase } from './database/schema.js';
import { setDatabase as setGiveawayDb } from './database/giveaways.js';
import { setDatabase as setFoodcheckDb } from './database/foodcheck.js';
import { BOT_CONFIG, logConfigStatus } from './config.js';
import { commands } from './commands/registry.js';
import * as interactionCreateEvent from './events/interactionCreate.js';
import * as guildRoleAssignment from './events/guildRoleAssignment.js';
import { startGiveawayMonitor } from './tasks/giveawayMonitor.js';
import { startFoodCheckMonitor } from './tasks/foodcheckMonitor.js';
import { startHoneypotMonitor } from './tasks/honeypotMonitor.js';

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
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});


// ---------------------------------------------------------------------------
// Event Handler Registration
// ---------------------------------------------------------------------------

client.once(Events.ClientReady, (readyClient) => {
    console.log(`Ready! Logged in as ${readyClient.user?.tag}`);

    // Start background tasks
    startGiveawayMonitor(readyClient);
    startFoodCheckMonitor(readyClient);
    startHoneypotMonitor(readyClient);
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


// ---------------------------------------------------------------------------
// Guest Role Assignment
// ---------------------------------------------------------------------------

// Assign Guest role when a user joins
client.on(Events.GuildMemberAdd, async (member) => {
    try {
        await guildRoleAssignment.addGuest(member);
    } catch (error) {
        console.error('Error handling guildRoleAssignment:', error);
    }
});

// Remove Guest role when Member role is assigned
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    try {
        await guildRoleAssignment.removeGuest(oldMember, newMember);
    } catch (error) {
        console.error('Error handling guildRoleAssignment:', error);
    }
});


// ---------------------------------------------------------------------------
// Slash Commands Registration
// ---------------------------------------------------------------------------

async function registerCommands() {
    const rest = new REST().setToken(BOT_CONFIG.token);

    try {
        console.log(`Registering ${commands.length} slash command(s) for guild...`);

        // Always register as guild commands for instant updates (single-server bot)
        await rest.put(
            Routes.applicationGuildCommands(BOT_CONFIG.clientId, BOT_CONFIG.guildId),
            { body: commands.map(c => c.data.toJSON()) }
        );

        console.log(`✅ Successfully registered ${commands.length} command(s)`);
    } catch (error) {
        console.error('❌ Error registering commands:', error);
        throw error;
    }
}


// ---------------------------------------------------------------------------
// Start the bot
// ---------------------------------------------------------------------------

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
