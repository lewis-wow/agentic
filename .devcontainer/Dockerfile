FROM ubuntu:22.04

# Dependencies + Docker CLI
RUN apt-get update && apt-get install -y \
    curl \
    git \
    htop \
    jq \
    tmux \
    zsh \
    ca-certificates \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu jammy stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update && apt-get install -y docker-ce-cli \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Non-root user node
RUN useradd -m -s /bin/zsh node

ENV NVM_DIR=/home/node/.nvm

WORKDIR /workspace
COPY --chown=node:node .nvmrc ./

USER node

# Needed for NVM
SHELL ["/bin/bash", "-c"]

# https://github.com/nvm-sh/nvm#install--update-script
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.5/install.sh | bash \
    && . "$NVM_DIR/nvm.sh" --no-use \
    && NODE_VERSION=$(cat /workspace/.nvmrc | tr -d '[:space:]') \
    && nvm install "$NODE_VERSION" \
    && nvm alias default "$NODE_VERSION" \
    && ln -s "$NVM_DIR/versions/node/$NODE_VERSION" "$NVM_DIR/current"

ENV PATH=/home/node/.nvm/current/bin:$PATH

# pnpm global bin dir — must be set before any `pnpm add -g` in the build
ENV PNPM_HOME=/home/node/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH

# Install pnpm at the version declared in package.json#packageManager.
# Latest pnpm (v11+) requires Node >=22.13 which breaks on Node 20;
# corepack has its own vm-compilation issue on Node 20, so use npm directly.
RUN npm install -g pnpm@10.10.0

# Install claude-code globally so `claude` is available as a plain command
RUN pnpm add -g @anthropic-ai/claude-code
# Explicitly run the postinstall so the native ELF binary (bin/claude.exe) is in place.
# pnpm may skip lifecycle scripts in some configurations; running it explicitly is a safe guarantee.
RUN node "$(pnpm root -g)/@anthropic-ai/claude-code/install.cjs"

# Install Oh My Zsh
RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended && \
    sed -i 's/ZSH_THEME=".*"/ZSH_THEME="robbyrussell"/g' ~/.zshrc

# Install ralph claude code
RUN git clone https://github.com/frankbria/ralph-claude-code.git /tmp/ralph \
    && cd /tmp/ralph \
    && ./install.sh \
    && rm -rf /tmp/ralph
