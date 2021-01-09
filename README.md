# course-explorer-monitor

Discord bot that monitors Course Explorer via its [public API](https://courses.illinois.edu/cisdocs/explorer) and allows server members to subscribe to updates to particular courses and CRNs. 

# Setup

It's a simple one-file Node.js Discord bot, which uses yarn as a package manager. 

Put a Discord token in token.txt, (probably) edit all the snowflake IDs hardcoded into the script to ones on the server the bot will be running in, and then it can be run directly with `node coursemon.js` (after node_modules is created using `yarn`), or in Docker using docker-compose: `docker-compose up -d bot`. 

# License

This bot is closed source. All code contributions belong to their respective authors. By contributing software to this repository, you grant all administrators of the UIUC Course Watcher Discord server, with Discord ID 513216523083710464, a worldwide, royalty-free, perpetual, exclusive, transferable, sublicensable and irrevocable license to use and otherwise exploit the software in any manner and for any purpose.
