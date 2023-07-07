import { BotEvent } from '../types';
import ArrestedModel from '../schemas/arrested';
import { GuildMember, VoiceState } from 'discord.js';

// WIP
export const voiceStateUpdate: BotEvent = {
    name: 'voiceStateUpdate',
    execute: async (oldState: VoiceState, newState: VoiceState) => {
    const member = oldState.member;
        if(oldState.channel === null && newState.channel !== null) {
            userJoinedVoiceChannel(member);
            return; 
        } 

        if(oldState.channel !== null && newState.channel === null) {
            userLeftVoiceChannel(member);
            return;
        }

        if(oldState.channel !== null && newState.channel !== null && oldState.channelId !== newState.channelId) {
            userChangedVoiceChannel(member);
            return;
        }

        if(oldState.channel !== null && newState.channel !== null && oldState.channelId === newState.channelId) {
            userChangedVoiceState(member);
            return;
        }
    }
}
  
async function userJoinedVoiceChannel(member: GuildMember) {
    if(await isUserArrested(member)) {
        arrestUser(member);
    }
}

  
async function userLeftVoiceChannel(member: GuildMember) {
    return;
}

async function userChangedVoiceChannel(member: GuildMember) {
    if (await isUserArrested(member)) {
        arrestUser(member);
    }
}
async function userChangedVoiceState(member: GuildMember) {
    return;
}

async function isUserArrested(member: GuildMember) {
    return ArrestedModel.collection.findOne({ id: member.id, tag: member.user.tag });
}

async function arrestUser(member: GuildMember) {
    if(member.voice?.channel.id != member.guild.afkChannelId){
        // a try/catch so if the person disconnect, Marquinhos don't break
        try {
            member.voice.setChannel(member.guild.afkChannelId);
            member.send("Você está preso! :(");
        } catch (error) {
            console.log(error);
        }
    } else {
        // User is already in arrested's channel;
        return;
    }
    
}