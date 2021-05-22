module.exports = {
    // Discord bot token
    "secret": "NDAw---------------------------------------------------V9wo", 
    
    // CISAPI base URI, including current semester
    // Note: This doesn't have to be manual, the current semester can be loaded from https://courses.illinois.edu/cisapp/explorer/schedule/DEFAULT/DEFAULT.xml
    // but I think it's better to manually update it every year, because currently the next semester is added early enough that people still care about registration for the previous semester.
    "baseUri": "https://courses.illinois.edu/cisapp/explorer/schedule/2021/fall/", 
    
    // How often (in ms) it checks all the courses. Please note the CISAPI rate limit, and how slow some pages are.
    // At this interval, all courses are checked, so this should be multiplied by the # of watched depts.
    "checkInterval": 2 * 60 * 1000,
    
    // Discord snowflake ID for server (guild) that it is working in.
    "guildID": "513216523083710464", 
    
    // Channel for bot posts when it auto restarts, for debugging. Must be in guild.
    "adminChannelID": "514616341634875422",
    
    // Status/uptime checker ping URL. Will be poked every hour, pass null to disable.
    "statusPing": null,
    
    // Debug flag. Make this into a string CRN (eg. "38572") which exists to simulate, only once (use `debug` command to reset), a change of the course text.
    "debug": false
}