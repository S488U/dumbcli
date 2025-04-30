dumbcli/
├── src/
│   ├── cli.js           # Main entry point, Yargs setup
│   ├── config.js        # Read/write config files (commands.json, config.json)
│   ├── commands/
│   │   ├── add.js
│   │   ├── delete.js
│   │   ├── dump.js
│   │   ├── edit.js
│   │   ├── exportCmd.js # Renamed to avoid conflict
│   │   ├── find.js
│   │   ├── importCmd.js # Renamed to avoid conflict
│   │   ├── list.js
│   │   └── run.js
│   ├── utils/
│   │   ├── asyncHandler.js # Error handling wrapper
│   │   ├── commandUtils.js # findCommandByIdOrAlias, isAliasUnique
│   │   ├── constants.js    # Config paths, etc.
│   │   └── display.js      # Table formatting, welcome message
│   └── powerSyntax.js   # Handler for d a:, d r:, etc.
├── package.json
└── README.md (Optional)