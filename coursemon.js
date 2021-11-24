const discord = require('discord.js');
const https = require('https');
const xml2js = require('xml2js');
const fs = require('fs');

const client = new discord.Client();

const {secret, baseUri, checkInterval, guildID, adminChannelID, statusPing, debug} = require("./config.js");

let guild = undefined;
let validCourses = new Set();
let validCRNs = new Set();
let initDone = false;
let prefix = '.';

let url = dept => baseUri + dept.toUpperCase() + ".xml?mode=cascade"

// cache list of departments to check (require restart to update)
let toCheck = [];
// map of department => previous data, direct from xml2js
let previousResults = {};

// whether debug was triggered, use debug command to reset
let debugDone = false;

client.on('ready', () => {
    console.log('Connected.');
    client.guilds.fetch(guildID).then(()=>{
        guild = client.guilds.cache.get(guildID);
        toCheck = guild.channels.cache.find(e=>e.name=='Notifications').children
                    .array().map(e=>e.name);
        console.log(toCheck);
        client.channels.cache.get(adminChannelID).send("Restarted.");
        check();
    });
});

let check = () => {
    if (typeof guild == "undefined") return console.log("Check: Not connected yet.");
    toCheck.forEach(dept=>{
        console.log("Downloading " + dept);
        https.get(url(dept), response => {
            response.setEncoding('utf8');
            let data = '';
            response.on('data', e=>data+=e);
            response.on('end', ()=>{
                // There is a bug where, every day at 2:00am or so, course explorer will
                // be missing all of its data. Experimentally, this is the only time UNKNOWN
                // shows up, so unfortunately we quietishly fail if we see that. 
                if (data.includes("<enrollmentStatus>UNKNOWN</enrollmentStatus>"))
                    return console.log(dept + " returned UNKNOWN, skipping");
                xml2js.parseString(data, (err, result)=>{
                    if (!result || !result.hasOwnProperty('ns2:subject'))
                        return console.log("Download failed for " + dept, data, result);
                    // If anything in here throws, then the CISAPI probably changed
                    if (!previousResults.hasOwnProperty(dept)) {
                        // Initialization, first pull
                        previousResults[dept] = result;
                        console.log("Initialized " + dept);
                        
                        // Add to validCourses and validCRNs
                        result['ns2:subject'].cascadingCourses[0].cascadingCourse.forEach(p=>{
                            let course = p.$.id.split(' ').join('');
                            validCourses.add(course)
                            p.detailedSections[0].detailedSection.forEach(q=>
                                validCRNs.add(course + "/" + q.$.id));
                        });
                        return;
                    }
                    console.log("Updated     " + dept + " " + data.length);
                    if (!initDone) client.channels.cache.get(adminChannelID).send("Finished initialization.");
                    initDone = true;
                    diff(previousResults[dept], result, dept);
                    previousResults[dept] = result;
                });
            });
        });
    });
}

let fmt = e=>{
    if (typeof e != "string") {
        console.error("Error: fmt was passed a non-string, did the CISAPI api spec change?");
        process.exit(0);
    }
    return "`" + e.split("`").join("'") + "`";
}

let clean = e=>{
    if (Array.isArray(e)) return e.map(e=>clean(e)).join("\n");
    if (typeof e == "string") return e;
    if (typeof e == "undefined") return "(blank)";
    return JSON.stringify(e);
}

let excludeProperties = ["$", "parents", "detailedSections", "creditHours"];

let diff = (past, curr, dept) => {
    let output = []; //output format: [message, course code] for @tags
    
    past = past['ns2:subject'].cascadingCourses[0].cascadingCourse;
    curr = curr['ns2:subject'].cascadingCourses[0].cascadingCourse;
    
    //first we find all the new courses
    let pastCourseCodes = past.map(e=>e.$.id);
    let currCourseCodes = curr.map(e=>e.$.id);
    currCourseCodes.filter(e=>!pastCourseCodes.includes(e))
                   .forEach(e=>output.push(["New course added", e]));
    
    //and then we diff each individual course
    past.forEach(p=>{
        let c = curr.filter(e=>e.$.id == p.$.id);
        let courseCode = p.$.id;
        validCourses.add(courseCode.split(' ').join(''));
        if (c.length == 0) {
            //course was removed
            output.push(["Course was removed", courseCode]);
            return;
        }
        c = c[0];
        
        //diff all the course properties
        Object.keys(c).filter(e=>!excludeProperties.includes(e)).forEach(property=>{
            let pText = clean(p[property]);
            let cText = clean(c[property]);
            if (pText != cText && pText != "(blank)" && cText != "(blank)") 
                output.push(["Course property " + fmt(property) + " changed from " + fmt(pText) + " to " + fmt(cText), courseCode]);
        });
        
        //diff all the sections
        p = p.detailedSections[0].detailedSection;
        c = c.detailedSections[0].detailedSection;
        //first we find all the new sections
        let pSects = p.map(e=>e.$.id);
        let cSects = c.map(e=>e.$.id);
        cSects.filter(e=>!pSects.includes(e))
              .forEach(e=>output.push(["New section added with CRN " + fmt(e), courseCode]));
        
        //and then we diff each individual section
        p.forEach(pS=>{
            let cS = c.filter(e=>e.$.id == pS.$.id);
            if (cS.length == 0) {
                //section was removed
                output.push(["Section with CRN " + fmt(pS.$.id) + " was removed", courseCode, pS.$.id]);
                return;
            }
            cS = cS[0];
            
            //diff all the section properties
            Object.keys(cS).filter(e=>!excludeProperties.includes(e)).forEach(property=>{
                let pText = clean(pS[property]);
                let cText = clean(cS[property]);
                if (debug && !debugDone) {
                    if (pS.$.id == debug) {
                        cText = "test";
                        debugDone = true;
                    }
                }
                if (pText != cText && pText != "(blank)" && cText != "(blank)") {
                    //get meeting times for user friendliness
                    // fixme: sometimes, instead of .meeting, there's .meetings which is an array of meetings?
                    // figure out what that means and how to nicely display that, fmt currently jsons it which is :(
                    output.push(["Section with CRN " + fmt(pS.$.id) + 
                        " ("+fmt(cS.meetings[0].meeting.map(e=>clean(e.daysOfTheWeek).split(' ').join('') + " " + clean(e.start)+" - "+clean(e.end)).join("; "))+")" + 
                        " property " + fmt(property) + 
                        " changed from " + fmt(pText) + " to " + fmt(cText), courseCode, pS.$.id]);
                }
            });
        });
    });
    
    sendOutput(output, dept);
}

let sendOutput = (output, dept) => {
    let channel = client.channels.cache.find(e=>e.name == dept.toLowerCase());
    output.forEach(e=>{
        let courseCode = e[1].split(' ').join('');
        let role = guild.roles.cache.find(e=>e.name == courseCode);
        let roleCRN = false;
        if (e.length >= 3)
            //entry has a CRN
            roleCRN = guild.roles.cache.find(f=>f.name == (courseCode + "/" + e[2]));
        
        let message = courseCode;
        if (roleCRN || role) {
            // Contains mentions
            message += " (";
            if (role) message += "<@&" + role + ">";
            if (roleCRN) message += "<@&" + roleCRN + ">";
            message += ")";
        }
        message += ": " + e[0];
        
        // woo discord updated to allow us to mention unmentionable roles without toggling the role
        channel.send(message, {allowedMentions: {parse: ['roles']}});
        /*
        //if there is a role, we have to enable it, mention it, and then disable it
        //slightly hacky way of doing this, but eh, promises, glarp
        if (!role && !roleCRN) channel.send(message);
        else if (role && !roleCRN) role.setMentionable(true).then(()=>
            channel.send(message).then(()=>role.setMentionable(false)));
        else if (!role && roleCRN) roleCRN.setMentionable(true).then(()=>
            channel.send(message).then(()=>roleCRN.setMentionable(false)));
        else roleCRN.setMentionable(true).then(()=>
                role.setMentionable(true).then(()=>
                    channel.send(message).then(()=>
                        role.setMentionable(false).then(()=>
                            roleCRN.setMentionable(false)))));
        */
    });
}

client.on('message', message => {
    // only allow commands in channels #roles or #roles-testing
    if (!message.channel.name.startsWith("roles")) return;
    if (!message.content.startsWith(prefix)) return;
    
    let set; //true = add role, false = remove role
    
    // watch and unwatch fall through this if statement, everything else returns.
    // when implementing commands, take care that course codes may or may not be entered with a space
    if (message.content.startsWith(prefix + 'watch ')) set = true;
    else if (message.content.startsWith(prefix + 'unwatch')) set = false;
    else if (message.content.startsWith(prefix + 'restart')) process.exit(0); // fixme: perms check
    else if (message.content.startsWith(prefix + 'forceupdate')) return check();
    else if (message.content.startsWith(prefix + 'debug')) {
        message.channel.send("Set.");
        debugDone = false;
        return;
    }
    else if (message.content.startsWith(prefix + 'list ')) {
        let course = message.content.trim().split(' ').pop().toUpperCase();
        message.channel.send("Tracked courses: " + 
            Array.from(validCourses).filter(e=>e.startsWith(course)).join(", ")
        );
        return;
    }
    else if (message.content.startsWith(prefix + 'listall ')) {
        let course = message.content.trim().split(' ').pop().toUpperCase();
        let msg = "Tracked courses and CRNs: " + 
            Array.from(validCourses).concat(Array.from(validCRNs)).filter(e=>e.startsWith(course)).join(", ");
        if (msg.length >= 2000) msg = "Too many to send! Try using list first.";
        message.channel.send(msg);
        return;
    }
    else if (message.content.startsWith(prefix + prefix)) return;
    else return message.channel.send(`Usage:
\`` + prefix + `watch ECE 391\` - subscribe to changes to ECE 391
\`` + prefix + `watch ECE 391/47765\` - subscribe to changes to only section 47765 of ECE 391
\`` + prefix + `unwatch CS 225\` - unsubscribe from CS 225
\`` + prefix + `unwatch all\` - remove all subscriptions
\`` + prefix + `list BADM\` - list all seen courses in a department
\`` + prefix + `listall PHYS 325\` - list all seen sections of a course`);
    
    guild.members.fetch().then(()=>{
        //parse class name from message
        let courseCode = message.content.split(' ').slice(1).join('').toUpperCase().trim();
        if (courseCode === "DEV") return message.channel.send("Nice try :P");
        else if (courseCode === "ALL") {
            if (set) return message.channel.send("Haha no.");
            let roles = message.member.roles.cache.filter(e=>(validCourses.has(e.name) || validCRNs.has(e.name)));
            roles.forEach(role=>{
                // fixme: this is a copy paste of logic below for removal in the non-all case, should be refactored
                message.member.roles.remove(role).then(()=>{
                    //check if we should delete the role
                    if(!guild.members.cache.some(e=>e.roles.cache.get(role.id))) role.delete().then(()=>{
                        message.channel.send("Deleted the " + role.name + " role.");
                    });
                    message.channel.send("Removed the " + role.name + " role from you.");
                });
            });
            return;
        } else if (!validCourses.has(courseCode) && !validCRNs.has(courseCode)) {
            if (!initDone) message.channel.send("The bot was recently reloaded, please try again in a minute.");
            else message.channel.send("`" + courseCode + "` does not appear to be a valid course or course/CRN.");
            return;
        }
        guild.roles.fetch().then(()=>{
            let role = guild.roles.cache.find(e=>e.name == courseCode);
            if (set) {
                if (role) message.member.roles.add(role).then(()=>{
                    message.channel.send("Gave you the " + courseCode + " role.");
                });
                else {
                    //create a new role
                    guild.roles.create({data: {name: courseCode, permissions: [], mentionable: false}}).then(()=>{
                        message.member.roles.add(guild.roles.cache.find(e=>e.name == courseCode)).then(()=>{
                            message.channel.send("Created the " + courseCode + " role and gave it to you.");
                        });
                    });
                }
            } else {
                if (!role || !message.member.roles.cache.has(role.id))
                    return message.channel.send("You don't currently have that role!");
                message.member.roles.remove(role).then(()=>{
                    //check if we should delete the role
                    if(!guild.members.cache.some(e=>e.roles.cache.get(role.id))) role.delete().then(()=>{
                        message.channel.send("Deleted the " + courseCode + " role.");
                    });
                    message.channel.send("Removed the " + courseCode + " role from you.");
                });
            }
        });
    });
});

// status.kuilin.net
if (statusPing) {
    https.get(statusPing);
    setInterval(() => {
        https.get(statusPing);
    }, 60*60*1000);
}

client.login(secret);
setInterval(check, checkInterval);
