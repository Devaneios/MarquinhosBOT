class Manager{
    isReady;
    idPreso;
    debug;
    nowPlaying;
    nowPlayingRef;
    vStateUpdateTimestamp;
    vStateUpdateCD;
    constructor(){
        this.isReady = true;
        this.idPreso = [];
        this.debug = false;
        this.nowPlaying = null;
        this.nowPlayingRef = null;
        this.volumeEmbed = null;
        this.volumeRef = null;
        this.vStateUpdateTimestamp = undefined;
        //Cooldown of 3600000ms (1 hour)
        this.vStateUpdateCD = 3600 * 1000;
    }
}

module.exports.manage = new Manager();