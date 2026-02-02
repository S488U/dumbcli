#!/bin/bash

# 🧠 Version comparator
version_gt() {
  test "$(printf '%s\n' "$@" | sort -V | head -n 1)" != "$1"
}

# 🚫 OS Check
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
  echo "❌ This shell installer doesn't support Windows."
  echo "👉 Please use Git Bash / WSL or run install.ps1 for Windows."
  exit 1
fi

print_banner() {
  cat <<'BANNER'
██████╗ ██╗   ██╗███╗   ███╗███████╗╔██████╗██╗     ██╗
██╔══██╗██║   ██║████╗ ████║██╔══██║║██╔═══╝██║     ██║
██║  ██║██║   ██║██╔████╔██║███████║║██║    ██║     ██║
██║  ██║██║   ██║██║╚██╔╝██║██╔══██║║██║    ██║     ██║
██████╔╝╚██████╔╝██║ ╚═╝ ██║███████║╚██████╗███████╗██║
╚═════╝  ╚═════╝ ╚═╝     ╚═╝╚══════╝ ╚═════╝╚══════╝╚═╝
BANNER
  echo "      The \"Dumb\" Way to Manage Smart Commands"
  echo ""
}

print_banner
echo "DumbCLI Installer"
echo "Preparing to install or update DumbCLI..."

# 🔍 Check Requirements
for cmd in git node npm; do
  if ! command -v $cmd &>/dev/null; then
    echo "Error: $cmd is not installed. Please install it first."
    exit 1
  fi
done

NODE_VERSION=$(node -v | sed 's/v//')
MAX_VERSION="23.9.0"

if version_gt "$NODE_VERSION" "$MAX_VERSION"; then
  echo "Warning: Node.js v$NODE_VERSION may be too new. Try using v$MAX_VERSION or below."
fi

# 🖥️ OS detection (intelligent display + install path)
OS_NAME="Unknown OS"
INSTALL_DIR=""

case "$(uname -s)" in
  Darwin)
    OS_NAME="macOS"
    if command -v sw_vers >/dev/null 2>&1; then
      OS_VERSION="$(sw_vers -productVersion 2>/dev/null)"
      OS_NAME="macOS ${OS_VERSION}"
    fi
    INSTALL_DIR="${HOME}/Library/Application Support/DumbCLI"
    ;;
  Linux)
    OS_NAME="Linux"
    if [ -f /etc/os-release ]; then
      # shellcheck disable=SC1091
      . /etc/os-release
      if [ -n "${NAME:-}" ]; then
        OS_NAME="Linux (${NAME})"
      fi
    fi
    INSTALL_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/dumbcli"
    ;;
  *)
    OS_NAME="$(uname -s 2>/dev/null || echo "Unknown OS")"
    INSTALL_DIR="${HOME}/.local/share/dumbcli"
    ;;
esac

echo "Detected OS: ${OS_NAME}"

# 📁 Install or Update Logic (permanent install dir)
if [ -z "$INSTALL_DIR" ]; then
  echo "Error: Could not determine install directory."
  exit 1
fi

echo "Install directory: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Update detected. Pulling latest changes..."
  cd "$INSTALL_DIR" || exit
  DIRTY_STATUS="$(git status --porcelain --untracked-files=no)"
  if [ -n "$DIRTY_STATUS" ]; then
    if [ "$DIRTY_STATUS" = " M package-lock.json" ]; then
      echo "Note: package-lock.json has local changes. Resetting it for update..."
      git checkout -- package-lock.json
    else
      echo "Error: Local changes found in $INSTALL_DIR. Please commit or stash before updating."
      git status --porcelain
      exit 1
    fi
  fi
  git pull --ff-only origin main
  echo "Updating dependencies..."
else
  if [ -n "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]; then
    echo "Error: $INSTALL_DIR is not empty and not a git repo."
    echo "Please delete it or move its contents, then re-run the installer."
    exit 1
  fi
  echo "First-time install. Cloning DumbCLI into $INSTALL_DIR..."
  git clone https://github.com/S488U/dumbcli.git "$INSTALL_DIR"
  cd "$INSTALL_DIR" || exit
  echo "Installing dependencies..."
fi

# 📦 NPM install
npm install
clear

# 🔗 Link (auto-fix old global link if needed)
echo "Linking DumbCLI globally..."
EXISTING_DUMB="$(command -v dumb 2>/dev/null || true)"
if [ -n "$EXISTING_DUMB" ]; then
  RESOLVED_DUMB="$(readlink -f "$EXISTING_DUMB" 2>/dev/null || echo "$EXISTING_DUMB")"
  case "$RESOLVED_DUMB" in
    "$INSTALL_DIR"/*) ;;
    *)
      echo "Found existing global 'dumb' at $RESOLVED_DUMB"
      echo "Removing old link..."
      sudo npm unlink -g cli >/dev/null 2>&1 || true
      sudo npm unlink -g dumbcli >/dev/null 2>&1 || true
      ;;
  esac
fi
sudo npm link

# ✅ Done
echo ""
echo "Done. DumbCLI is ready to use."
echo "Run: dumb   (or: d)"
echo "Docs & GitHub: https://github.com/S488U/dumbcli"
echo ""
