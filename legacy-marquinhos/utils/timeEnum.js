class TimeEnum {
    get SECOND(){
        return 1000;
    }

    get MINUTE(){
        return 60000;
    }

    get HOUR(){
        return 3600000;
    }

    get DAY(){
        return 86400000;
    }
}
module.exports.timeEnum = new TimeEnum();
