import type { CommandModule } from '../types/command.js';
import * as config from './config.js';
import * as guild from './guild.js';
import * as giveaway from './giveaway.js';
import * as foodcheck from './foodcheck.js';

export const commands: CommandModule[] = [
    config,
    guild,
    giveaway,
    foodcheck,
];
