class Manager{
    isReady;
    idPreso;
    debug;
    debugChannel;
    nowPlaying;
    nowPlayingRef;
    vStateUpdateTimestamp;
    vStateUpdateCD;
    chatSecreto;
    teste;
    constructor(){
        this.isReady = true;
        this.idPreso = [];
        this.debug = false;
        this.debugChannel = null;
        this.nowPlaying = null;
        this.nowPlayingRef = null;
        this.volumeEmbed = null;
        this.volumeRef = null;
        this.vStateUpdateTimestamp = undefined;
        //Cooldown of 3600000ms (1 hour)
        this.vStateUpdateCD = 3600 * 1000;
        this.chatSecreto = {};
        this.timer = {};
        this.teste;
    }
}

module.exports.manager = new Manager();