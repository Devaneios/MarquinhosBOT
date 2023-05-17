module.exports = {
    getHoursAndMinutesWithTimeZone(locale, timeZone) {
        let now = new Date();
        let currentTime = now.toLocaleString(locale, {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: timeZone,
        });
        return currentTime;
    },

    getHoursWithTimeZone(locale, timeZone) {
        let now = new Date();
        let currentHours = now.toLocaleString(locale, {
            hour: "2-digit",
            hour12: false,
            timeZone: timeZone,
        });
        return currentHours;
    },

    getMinutesWithTimeZone(locale, timeZone) {
        let now = new Date();
        let currentMinutes = now.toLocaleString(locale, {
            minute: "2-digit",
            hour12: false,
            timeZone: timeZone,
        });
        return currentMinutes;
    },

    getLongWeekdayWithTimeZone(locale, timeZone) {
        let now = new Date();
        let currentDay = now.toLocaleString(locale, {
            weekday:"long",
            hour12: false,
            timeZone: timeZone,
        });
        return currentDay;
    },

    getShortWeekdayWithTimeZone(locale, timeZone) {
        let now = new Date();
        let currentDay = now.toLocaleString(locale, {
            weekday:"short",
            hour12: false,
            timeZone: timeZone,
        });
        return currentDay;
    },

    getNarrowWeekdayWithTimeZone(locale, timeZone) {
        let now = new Date();
        let currentDay = now.toLocaleString(locale, {
            weekday:"narrow",
            hour12: false,
            timeZone: timeZone,
        });
        return currentDay;
    },
};
