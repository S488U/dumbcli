# DumbCLI

<p align="center">
  <pre>
██████╗ ██╗   ██╗███╗   ███╗███████╗╔██████╗██╗     ██╗
██╔══██╗██║   ██║████╗ ████║██╔══██║║██╔═══╝██║     ██║
██║  ██║██║   ██║██╔████╔██║███████║║██║    ██║     ██║
██║  ██║██║   ██║██║╚██╔╝██║██╔══██║║██║    ██║     ██║
██████╔╝╚██████╔╝██║ ╚═╝ ██║███████║╚██████╗███████╗██║
╚═════╝  ╚═════╝ ╚═╝     ╚═╝╚══════╝ ╚═════╝╚══════╝╚═╝
  </pre>
</p>

<p align="center">
  <b>The "Dumb" Way to Manage Smart Commands.</b><br>
  Stop asking AI for the same command twice. Store it. Trust it. Run it.
</p>

---

## Why DumbCLI?

Modern terminals are smart, but they have a fatal flaw: **They remember your mistakes.**

If you mistype a command, break a flag, or run a syntax error, your shell history (`Ctrl+R` or autosuggestions) saves it forever. When you try to find it later, you often get the **broken** version, leading to frustration and wasted time.

**DumbCLI is your "Golden Record."** It ignores the noise and only stores the verified, working commands that you explicitly choose to save.

**The Workflow:**
1.  **Stop searching history** for that one specific `ffmpeg` command buried under 50 failed attempts.
2.  **Stop Googling** the same Regex syntax every two weeks.
3.  **Stop asking AI** for critical operations and risking hallucinations.

**DumbCLI** lets you save complex shell commands with **Short IDs** or **Aliases**, and reuse them instantly with dynamic arguments.

### Killer Features
*   **Anti-Hallucination:** Don't rely on AI for critical ops. Use your own trusted, verified commands.
*   **Clean History:** Your shell history is full of typos. DumbCLI is curated. It only runs what works.
*   **Dynamic Placeholders:** The killer feature. Use `{}` to insert arguments at runtime.
*   **Team Onboarding:** Export your project's build/test scripts to JSON. New team members just `import` and start working immediately.
*   **Power User Syntax (Alpha):** Add commands in seconds without leaving the prompt.
*   **Smart Search:** Find commands by ID, alias, or vague comment keywords.

---

## Installation

Download from our website: [https://plexaur.com/dumbcli](https://plexaur.com/dumbcli)

## Quick Start

### 1. Save a Command
Interactive mode makes it easy to save complex one-liners.
```bash
$ dumb add
```
*Follow the prompts to add command, alias, and comments.*

### 2. Run it (The Standard Way)
Run by ID or Alias.
```bash
$ dumb run 1
# OR
$ dumb run build-app
```

### 3. The Killer Feature: Dynamic Arguments `{}`
Stop hardcoding paths or messages. Use `{}` as a placeholder when adding a command.

**Saved Command (Alias: `gcom`):**
```bash
git commit -m "{}"
```

**Run it:**
```bash
$ dumb run gcom "Fixing the login bug"
```
**Result:** Executed `git commit -m "Fixing the login bug"` instantly.

---

## Power User Features (Alpha Stage)

### Rapid Add
Don't want to go through the interactive menu? Use the generic syntax:
`d:a:<command>:<alias>:<comment>`

```bash
# Quickly save an echo command
dumb d:a:"echo Hello World":hello:"My first command"
```

### Team Workflow (Import/Export)
Ideal for dev teams. Don't write a long Wiki page about how to build the project. Just share a `project-commands.json`.

**Team Lead:**
```bash
# Export verified build scripts
dumb export ./onboarding/
```

**New Developer:**
```bash
# Import scripts into their local DumbCLI
dumb import -a ./onboarding/project-commands.json
```
Now the new dev has all the project scripts ready to go!

---

## Command Reference

| Command | Description |
| :--- | :--- |
| `dumb add` | Add a new command interactively |
| `dumb ls` | List all saved commands (shows ID & Alias) |
| `dumb find <query>` | Search commands, aliases, or comments |
| `dumb run <id/alias>` | Execute a command. Add arguments for `{}` placeholders |
| `dumb edit <id/alias>` | Update a command's logic or alias |
| `dumb dl <id/alias>` | Delete a command |
| `dumb import <file>` | Load commands from a JSON file (use `-a` to append) |
| `dumb export [path]` | Backup your commands to JSON |
| `dumb dump` | Print your JSON file |

---

## Configuration
Your commands are stored locally in `~/.dumbcli/dumbcli.json`.
You can back up this folder or sync it across machines.

---

## Contributing
Found a bug? Want to add a feature?
Connect with me on GitHub: [https://github.com/S488U](https://github.com/S488U)