#!/bin/bash
set -e

echo "Granting access to the mounted docker.sock"

# The socket is bind-mounted from the host and owned by root; grant node
# access without needing to guess the host's docker group GID.
if [ -S /var/run/docker.sock ]; then
    sudo chmod 666 /var/run/docker.sock
fi

echo "Setting up persistent Claude session paths"

# Create the configuration directory inside your workspace
mkdir -p /workspace/.devcontainer/.claude

# Remove any existing directory and link it to the workspace location
rm -rf /home/node/.claude
ln -sf /workspace/.devcontainer/.claude /home/node/.claude
ln -sf /workspace/.devcontainer/.claude/.claude.json /home/node/.claude.json

echo "Configuring pnpm paths for bash and zsh"

# Explicitly append the global binary path to bash config if it exists
if [ -f /home/node/.bashrc ]
then
    echo "export PNPM_HOME=\"/home/node/.local/share/pnpm\"" >> /home/node/.bashrc
    echo "export PATH=\"\$PNPM_HOME:/home/node/.local/bin:\$PATH\"" >> /home/node/.bashrc
fi

# Explicitly append the global binary path to zsh config if it exists
if [ -f /home/node/.zshrc ]
then
    echo "export PNPM_HOME=\"/home/node/.local/share/pnpm\"" >> /home/node/.zshrc
    echo "export PATH=\"\$PNPM_HOME:/home/node/.local/bin:\$PATH\"" >> /home/node/.zshrc
fi

# Set the path locally just for the remainder of this setup script execution
export PNPM_HOME="/home/node/.local/share/pnpm"
export PATH="$PNPM_HOME:/home/node/.local/bin:$PATH"

# Route the global pnpm store directly into the workspace folder
pnpm config set store-dir /workspace/.devcontainer/.pnpm-store

# Ensure the claude-code native binary is installed (install.cjs may be skipped in some pnpm configs)
CLAUDE_PKG_DIR="$(pnpm root -g)/@anthropic-ai/claude-code"
if [ -f "$CLAUDE_PKG_DIR/install.cjs" ]; then
    echo "Running claude-code postinstall to ensure native binary..."
    node "$CLAUDE_PKG_DIR/install.cjs" || echo "Warning: claude-code postinstall failed (non-fatal)"
fi

echo "Setup done!"
