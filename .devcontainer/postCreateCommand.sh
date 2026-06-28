#!/bin/bash
set -e

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
    echo "export PATH=\"\$PNPM_HOME:\$PATH\"" >> /home/node/.bashrc
fi

# Explicitly append the global binary path to zsh config if it exists
if [ -f /home/node/.zshrc ]
then
    echo "export PNPM_HOME=\"/home/node/.local/share/pnpm\"" >> /home/node/.zshrc
    echo "export PATH=\"\$PNPM_HOME:\$PATH\"" >> /home/node/.zshrc
fi

echo "Installing Ralph Wiggum"

# Set the path locally just for the remainder of this setup script execution
export PNPM_HOME="/home/node/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"

# Route the global pnpm store directly into the workspace folder
pnpm config set store-dir /workspace/.devcontainer/.pnpm-store

pnpm add -g @wiggumdev/ralph

echo "Setup done!"
