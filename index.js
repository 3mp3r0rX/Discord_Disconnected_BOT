require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
    ],
});

const DISCONNECT_LIMIT = 1; 
const TIME_WINDOW = 10 * 60 * 1000; 
const ROLE_REMOVAL_DURATION = 60 * 60 * 1000; 
const disconnectTracker = new Map(); 

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    if (oldState.channel && !newState.channel) {
        const moderator = oldState.guild.members.cache
        .filter(member => member.permissions.has(PermissionsBitField.Flags.MoveMembers))
        .find(member => member.voice.channel === oldState.channel); 

    if (!moderator) {
        console.log('No moderator found who moved or disconnected this user.');
        return;
    }

        if (moderator && moderator.permissions.has(PermissionsBitField.Flags.MoveMembers)) {
            const now = Date.now();

            if (!disconnectTracker.has(moderator.id)) {
                disconnectTracker.set(moderator.id, []);
            }

            const recentActions = disconnectTracker.get(moderator.id).filter(
                (timestamp) => now - timestamp < TIME_WINDOW
            );

            disconnectTracker.set(moderator.id, recentActions);

            if (recentActions.length >= DISCONNECT_LIMIT) {
                const moderatorRole = oldState.guild.roles.cache.find(
                    (role) => role.name === 'oligarchy' 
                );

                if (!moderatorRole) {
                    console.error("The 'oligarchy' role does not exist in this guild.");
                    return;
                }

                const botRolePosition = oldState.guild.members.me.roles.highest.position;
                const rolePosition = moderatorRole.position;

                if (botRolePosition <= rolePosition) {
                    console.error(
                        `Bot's role is not high enough in the hierarchy to manage the 'oligarchy' role.` 
                    );
                    return;
                }

                try {
                    await moderator.roles.remove(moderatorRole);
                    console.log(
                        `Removed the 'oligarchy' role from ${moderator.user.tag} for exceeding the disconnect limit.` 
                    );

                    try {
                        await moderator.send(
                            `⚠️ Your 'oligarchy' role has been removed for 1 hour due to exceeding the disconnect limit (${DISCONNECT_LIMIT} users in ${TIME_WINDOW / 60000} minutes).` 
                        );
                    } catch (error) {
                        console.error(`Failed to send DM to ${moderator.user.tag}:`, error);
                    }

                    setTimeout(async () => {
                        try {
                            await moderator.roles.add(moderatorRole);
                            console.log(
                                `Restored the 'oligarchy' role to ${moderator.user.tag} after the timeout.` 
                            );

                            await moderator.send(
                                `✅ Your 'oligarchy' role has been restored after the 1-hour timeout. Please adhere to server rules moving forward.` 
                            );
                        } catch (error) {
                            console.error(
                                `Failed to restore the 'oligarchy' role to ${moderator.user.tag}:`,
                                error
                            );
                        }
                    }, ROLE_REMOVAL_DURATION);
                } catch (error) {
                    console.error(
                        `Failed to remove the 'oligarchy' role from ${moderator.user.tag}:`, 
                        error
                    );
                }
                return;
            }

            recentActions.push(now);
            disconnectTracker.set(moderator.id, recentActions);

            console.log(
                `${moderator.user.tag} disconnected a user. Remaining limit: ${
                    DISCONNECT_LIMIT - recentActions.length
                }`
            );
        }
    }
});

client.login(process.env.TOKEN);
