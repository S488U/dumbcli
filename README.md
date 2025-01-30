# 👋 Welcome to DumbCLI!
Here are some quick commands to get started:
```
  - `dumb add` to add a new command
  - `dumb find "<query>"` to search commands
  - `dumb ls` to list all commands
  - `dumb run <index>` to execute a saved command
```

```
DumbCLI is build with ChatGPT. 
```

## DumbCLI Functionalities:
```
Commands:
  dumb add           Add a new command
  dumb ls            List all saved commands                     [aliases: list]
  dumb dl <index>    Delete a saved command
  dumb find <query>  Find saved commands
  dumb run <index>   Execute a saved command
  dumb dump cmd      Show raw commands.json data
  dumb               Show welcome message and GitHub link              [default]

Options:
      --version  Show version number                                   [boolean]
  -h, --help     Show this help menu with available commands           [boolean]

Examples:
  dumb add            Add a new command
  dumb find "ollama"  Search for a command related to "ollama"
```

## How to setup

clone the repository:
```
git clone https://github.com/s488u/dumbcli.git
cd dumbcli
```

Install the packages & link for global usage:
```
npm install
npm link
```


