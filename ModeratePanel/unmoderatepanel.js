const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmoderate')
        .setDescription('Revoke user moderation')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user whose moderation is being revoked')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for withdrawal of moderation')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        const moderator = interaction.user;

        // Ellenőrizzük a felhasználó aktuális állapotát
        const isBanned = await interaction.guild.bans.fetch(targetUser.id).catch(() => null);
        const targetMember = isBanned ? null : await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('Moderation Withdraw')
            .setThumbnail(targetUser.displayAvatarURL())
            .setDescription(`**User:** ${targetUser}\n**Reason:** ${reason}`)
            .setTimestamp();

        const actionRow = new ActionRowBuilder();

        if (isBanned) {
            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('unban')
                    .setLabel('Unban')
                    .setStyle(ButtonStyle.Success)
            );
        } else if (targetMember) {
            if (targetMember.communicationDisabledUntil > new Date()) {
                actionRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId('untimeout')
                        .setLabel('Untimeout')
                        .setStyle(ButtonStyle.Success)
                );
            }
            if (targetMember.voice.channel) {
                if (targetMember.voice.mute) {
                    actionRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId('unvoicemute')
                            .setLabel('UnVoiceMute')
                            .setStyle(ButtonStyle.Secondary)
                    );
                }
                if (targetMember.voice.deaf) {
                    actionRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId('unvoicedeafen')
                            .setLabel('UnVoiceDeafening')
                            .setStyle(ButtonStyle.Secondary)
                    );
                }
            }
        }

        if (actionRow.components.length === 0) {
            return interaction.reply({
                content: 'No moderation action can be taken on this user.',
                ephemeral: true
            });
        }

        const response = await interaction.reply({ embeds: [embed], components: [actionRow], fetchReply: true });

        const filter = i => i.user.id === interaction.user.id;
        const collector = response.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            let success = false;
            let action = '';
            let errorMessage = '';

            try {
                switch (i.customId) {
                    case 'unban':
                        await interaction.guild.members.unban(targetUser, reason);
                        action = 'lifted the ban';
                        success = true;
                        break;
                    case 'untimeout':
                        if (targetMember) {
                            await targetMember.timeout(null, reason);
                            action = 'lifted the time lock';
                            success = true;
                        } else {
                            errorMessage = 'The user is not on the server.';
                        }
                        break;
                    case 'unvoicemute':
                        if (targetMember && targetMember.voice.channel) {
                            await targetMember.voice.setMute(false, reason);
                            action = 'unmuted the voice';
                            success = true;
                        } else {
                            errorMessage = targetMember ? 'The user is not in a voice channel.' : 'The user is not on the server.';
                        }
                        break;
                    case 'unvoicedeafen':
                        if (targetMember && targetMember.voice.channel) {
                            await targetMember.voice.setDeaf(false, reason);
                            action = 'dissolved the deafness of sound';
                            success = true;
                        } else {
                            errorMessage = targetMember ? 'The user is not in a voice channel.' : 'The user is not on the server.';
                        }
                        break;
                }

                let resultEmbed;
                if (success) {
                    resultEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('Successful Moderation Withdraw')
                        .setThumbnail(targetUser.displayAvatarURL())
                        .setDescription(`${moderator} successfully ${action} ${targetUser} to the user.\n**Reason:** ${reason}`)
                        .setTimestamp();
                } else {
                    resultEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('Unsuccessful Moderation Withdraw')
                        .setThumbnail(targetUser.displayAvatarURL())
                        .setDescription(`${moderator} you did not know ${action || 'perform the operation'} ${targetUser} to the user.\n**Reason:** ${reason}\n**Error:** ${errorMessage || 'The operation was unsuccessful.'}`)
                        .setTimestamp();
                }

                await i.update({ embeds: [resultEmbed], components: [] });
            } catch (error) {
                console.error(error);
                const errorEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('A mistake has been made')
                    .setThumbnail(targetUser.displayAvatarURL())
                    .setDescription(`The operation failed. ${errorMessage || 'Please check your bot permissions.'}`)
                    .setTimestamp();

                await i.update({ embeds: [errorEmbed], components: [] });
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({ content: 'The moderation withdrawal operation has been interrupted due to a timeout.', components: [] });
            }
        });
    },
};