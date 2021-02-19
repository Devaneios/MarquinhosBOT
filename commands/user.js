const fetch = require('node-fetch');
const manage = require("./../utils/management").manage;
const dj = require("./../utils/dj").dj;
module.exports = {
    name: "user",
    description: "admin only.",
    hide: true,
    usage: "!user",
    async execute(message, args) {
        message.delete();
        getLyrics("Gabrielle Aplin", "Dear Happy");
    },
};

async function getLyrics(artist, song){
    let URL = `https://api.lyrics.ovh/v1/${encodeURI(artist)}/${encodeURI(song)}`;
    
    let response = await (fetch(URL, { method: 'get' }));
    let dados = await response.json();
    console.log(dados.lyrics);    
}