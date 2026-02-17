/**
 * Configuration test script
 * Run to validate .env setup before starting the bot
 *
 * Usage: npm run build && node dist/test-config.js
 */

import { BOT_CONFIG, CHANNELS, ROLES, DATABASE, GW2_CONFIG, logConfigStatus } from './config.js';

console.log('🔍 Testing bot configuration...\n');

// Test required configuration
let hasErrors = false;

console.log('=== Required Configuration ===');

if (BOT_CONFIG.token) {
    console.log('✅ DISCORD_TOKEN is set');
} else {
    console.log('❌ DISCORD_TOKEN is missing');
    hasErrors = true;
}

if (BOT_CONFIG.clientId) {
    console.log('✅ CLIENT_ID is set');
} else {
    console.log('❌ CLIENT_ID is missing');
    hasErrors = true;
}

if (BOT_CONFIG.guildId) {
    console.log('✅ GUILD_ID (Server ID) is set');
} else {
    console.log('❌ GUILD_ID (Server ID) is missing');
    hasErrors = true;
}

console.log('\n=== Optional Configuration ===');

// Check announcement channel
if (CHANNELS.announcements) {
    console.log('✅ Announcement channel configured');
    console.log(`   Channel ID: ${CHANNELS.announcements}`);
} else {
    console.log('ℹ️  Announcement channel not configured');
    console.log('   Giveaway announcements will be disabled');
}

// Check GW2 API
if (GW2_CONFIG.apiKey && GW2_CONFIG.guildId) {
    console.log('✅ GW2 API configured');
} else {
    console.log('ℹ️  GW2 API not configured');
    console.log('   User verification features will be unavailable');
}

// Check database
console.log('\n=== Database ===');
console.log(`📁 Database path: ${DATABASE.path}`);
console.log(`📌 Database version: ${DATABASE.version}`);

// Display full configuration
console.log('\n');
logConfigStatus();

// Summary
console.log('\n=== Summary ===');
if (hasErrors) {
    console.log('❌ Configuration has errors. Please check your environment variables.');
    process.exit(1);
} else {
    console.log('✅ All required configuration is valid!');
    process.exit(0);
}
