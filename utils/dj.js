const ytdl = require("ytdl-core");
const manage = require("./management").manage;
const Discord = require("discord.js");
class Dj {
    musicQueue;
    audioQueue;
    musicDispatcher;
    audioDispatcher;
    playingMusic;
    playingAudio;
    music;
    volume;
    constructor() {
        this.start();
    }

    start(){
        this.playingMusic = false;
        this.playingAudio = false;
        this.titlePlaying = "";
        this.musicQueue = [];
        this.audioQueue = [];
        this.musicDispatcher = null;
        this.audioDispatcher = null;
        this.music;
        this.seek = 0;
        this.volume = 0.4;
    }

    playMusic(newUserChannel, seek) {
        if (this.musicQueue.length == 0) return;

        newUserChannel
            .join()
            .then(async (connection) => {
                const video_id = this.musicQueue[0].link;
                this.music = this.musicQueue[0];
                console.log(`Seeking music to ${seek}`);
                this.musicDispatcher = connection.play(
                    await ytdl(video_id, {
                        filter: "audioonly",
                        quality: "highestaudio",
                        highWaterMark: 1024 * 1024 * 10,
                    }),
                    { seek: seek/1000 }
                );
                this.playingMusic = true;
                manage.nowPlaying = criarEmbed("Tocando agora");
                manage.nowPlaying.addField(
                    this.musicQueue[0].title,
                    this.musicQueue[0].duration
                );
                manage.nowPlayingRef.delete();
                manage.nowPlayingRef = await manage.nowPlayingRef.channel.send(
                    manage.nowPlaying
                );
                this.musicDispatcher.setVolume(this.volume);
                this.titlePlaying = this.musicQueue[0].title;
                this.musicQueue.shift();
                this.musicDispatcher.on("finish", (end) => {
                    console.log("Finished playing");
                    setTimeout(() => {
                        console.log("Finished playing music");
                        if (this.musicQueue.length == 0) {
                            this.seek = 0;
                            this.playingMusic = false;
                            newUserChannel.leave();
                            //this.musicDispatcher.destroy();
                        } else {
                            this.seek = 0;
                            this.playMusic(newUserChannel, 0);
                        }
                    }, 1500);
                });
                this.musicDispatcher.on("error", (error) => {
                    console.log(error);
                    newUserChannel.leave();
                    this.playingMusic = false;
                });
            })
            .catch((err) => {
                this.playingMusic = false;
                console.log(err);
                newUserChannel.leave();
            });
    }

    async playAudio(channel, chaos) {
        if (this.playingMusic) {
            console.log("Pausing music");
            this.musicDispatcher.pause();
            this.musicQueue.unshift(this.music);
            let seek = this.musicDispatcher.player.dispatcher.streamTime;
            this.seek += seek;
        }
        return await channel
            .join()
            .then(async (connection) => {
                this.audioDispatcher = await connection.play(
                    this.audioQueue[0]
                );
                this.playingAudio = true;
                this.audioQueue.shift();
                if (chaos) return;
                this.audioDispatcher.on("finish", (end) => {
                    setTimeout(() => {
                        if (this.audioQueue.length == 0) {
                            console.log("Fila de audios vazia");
                            if (this.playingMusic) {
                                this.playingAudio = false;
                                this.playMusic(channel, this.seek);
                            } else {
                                this.audioDispatcher.destroy();
                                channel.leave();
                            }
                        } else {
                            this.playAudio(channel);
                        }
                    }, 1500);
                });
            })
            .catch((err) => {
                this.playingAudio = false;
                console.log(err);
                channel.leave();
            });
    }
}

function criarEmbed(title) {
    let titulo = `${title}`;
    let embed = new Discord.MessageEmbed().setTitle(titulo).setColor("#0099ff");
    return embed;
}

module.exports.dj = new Dj();
