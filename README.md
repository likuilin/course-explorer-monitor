# course-explorer-monitor

Discord bot that monitors Course Explorer via its [public API](https://courses.illinois.edu/cisdocs/explorer) and allows server members to subscribe to updates to particular courses and CRNs. It is live on the [UIUC Course Watcher](https://discord.gg/buwRCvm) Discord server. 

# Setup

It's a simple one-file Node.js Discord bot, which uses yarn as a package manager. 

Copy `config.template.js` to `config.js` and then edit parameters, including a valid Discord bot token. Currently, one instance of the bot only works within one configured guild. 

Run with docker `docker-compose up -d bot`, or directly with `yarn` and then `node coursemon.js`. 

# Adding new departments

To add a new department, add a new channel for it, and restart the bot. The list of departments to watch is determined on startup. 

# License

This bot is closed source. All code contributions belong to their respective authors. By contributing software to this repository, you grant all administrators of the UIUC Course Watcher Discord server, with Discord ID 513216523083710464, a worldwide, royalty-free, perpetual, exclusive, transferable, sublicensable and irrevocable license to use and otherwise exploit the software in any manner and for any purpose.
