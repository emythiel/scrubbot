import type {
    ChatInputCommandInteraction,
    ModalSubmitInteraction,
    ButtonInteraction,
    StringSelectMenuInteraction
} from "discord.js";

export interface CommandModule {
    data: {
        name: string;
        toJSON(): unknown;
    };
    execute:            (interaction: ChatInputCommandInteraction) => Promise<void>;
    handleModalSubmit?: (interaction: ModalSubmitInteraction)      => Promise<void>;
    handleButtonClick?: (interaction: ButtonInteraction)           => Promise<void>;
    handleSelectMenu?:  (interaction: StringSelectMenuInteraction) => Promise<void>;
}
