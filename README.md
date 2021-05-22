# course-explorer-monitor

Discord bot that monitors Course Explorer via its [public API](https://courses.illinois.edu/cisdocs/explorer) and allows server members to subscribe to updates to particular courses and CRNs. It is live on the [UIUC Course Watcher](https://discord.gg/buwRCvm) Discord server. 

# Setup

It's a simple one-file Node.js Discord bot, which uses yarn as a package manager. 

Copy `config.template.js` to `config.js` and then edit parameters, including a valid Discord bot token. Currently, one instance of the bot only works within one configured guild. 

Run with docker `docker-compose up -d bot`, or directly with `yarn` and then `node coursemon.js`. 

# Adding new departments

To add a new department, add a new channel for it, and restart the bot. The list of departments to watch is determined on startup. 

# License

GNU GPL 3.0

# Contributing

Issues and pull requests are appreciated. 
