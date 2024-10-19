const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('moderate')
        .setDescription('Moderate a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to moderate')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for moderation')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        const moderator = interaction.user;

        // Ellenőrizzük, hogy a felhasználó tagja-e a szervernek
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
            return interaction.reply({ 
                content: 'The designated user is not a member of this server.', 
                ephemeral: true 
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Moderation')
            .setThumbnail(targetUser.displayAvatarURL())
            .setDescription(`**User to be moderated:** ${targetUser}\n**Reason:** ${reason}`)
            .setTimestamp();

        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ban')
                    .setLabel('Ban')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('kick')
                    .setLabel('Kick')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('timeout')
                    .setLabel('TimeOut')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('voicemute')
                    .setLabel('Voice Mute')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('voicedeafen')
                    .setLabel('Voice Deafening')
                    .setStyle(ButtonStyle.Secondary)
            );

        const response = await interaction.reply({ embeds: [embed], components: [actionRow], fetchReply: true });

        const filter = i => i.user.id === interaction.user.id;
        const collector = response.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'timeout') {
                const timeoutRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('timeout_10m')
                            .setLabel('10 minutes')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('timeout_1h')
                            .setLabel('1 hour')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('timeout_1d')
                            .setLabel('1 day')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('timeout_1w')
                            .setLabel('1 week')
                            .setStyle(ButtonStyle.Primary)
                    );

                await i.update({ components: [timeoutRow] });
            } else {
                let success = false;
                let action = '';
                let errorMessage = '';

                try {
                    switch (i.customId) {
                        case 'ban':
                            await interaction.guild.members.ban(targetUser, { reason });
                            action = 'banned';
                            success = true;
                            break;
                        case 'kick':
                            await targetMember.kick(reason);
                            action = 'kicked';
                            success = true;
                            break;
                        case 'voicemute':
                            if (targetMember.voice.channel) {
                                await targetMember.voice.setMute(true, reason);
                                action = 'muted on the audio channel';
                                success = true;
                            } else {
                                errorMessage = 'The user is not in a voice channel.';
                            }
                            break;
                        case 'voicedeafen':
                            if (targetMember.voice.channel) {
                                await targetMember.voice.setDeaf(true, reason);
                                action = 'deafened the sound channel';
                                success = true;
                            } else {
                                errorMessage = 'The user is not in a voice channel.';
                            }
                            break;
                        case 'timeout_10m':
                        case 'timeout_1h':
                        case 'timeout_1d':
                        case 'timeout_1w':
                            const duration = {
                                'timeout_10m': 10 * 60 * 1000,
                                'timeout_1h': 60 * 60 * 1000,
                                'timeout_1d': 24 * 60 * 60 * 1000,
                                'timeout_1w': 7 * 24 * 60 * 60 * 1000
                            }[i.customId];
                            await targetMember.timeout(duration, reason);
                            action = `temporarily muted ${duration / (60 * 1000)} minutes`;
                            success = true;
                            break;
                    }

                    let resultEmbed;
                    if (success) {
                        resultEmbed = new EmbedBuilder()
                            .setColor('#00FF00')
                            .setThumbnail(targetUser.displayAvatarURL())
                            .setTitle('Successful moderation')
                            .setDescription(`${moderator} successfully ${action} ${targetUser} user.\n**Reason:** ${reason}`)
                            .setTimestamp();
                    } else {
                        resultEmbed = new EmbedBuilder()
                            .setColor('#FF0000')
                            .setThumbnail(targetUser.displayAvatarURL())
                            .setTitle('Unsuccessful moderation')
                            .setDescription(`${moderator} you did not know ${action} ${targetUser} user.\n**Reason:** ${reason}\n**Error:** ${errorMessage || 'The operation was unsuccessful.'}`)
                            .setTimestamp();
                    }

                    await i.update({ embeds: [resultEmbed], components: [] });
                } catch (error) {
                    console.error(error);
                    const errorEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setThumbnail(targetUser.displayAvatarURL())
                        .setTitle('Error happened')
                        .setDescription(`The operation failed. ${errorMessage || 'Please check your bot permissions.'}`)
                        .setTimestamp();

                    await i.update({ embeds: [errorEmbed], components: [] });
                }
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({ content: 'The moderation operation was interrupted due to a timeout.', components: [] });
            }
        });
    },
};