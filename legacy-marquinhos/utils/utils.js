const { URL } = require("url");
module.exports = {
    stringIsAValidUrl(messageContent) {
        try {
            new URL(messageContent);
            return true;
          } catch (err) {
            return false;
          }
    },
};
