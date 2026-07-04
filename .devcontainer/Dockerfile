FROM ubuntu:22.04

# Dependencies + Docker CLI + Google Chrome
RUN apt-get update && apt-get install -y \
    curl \
    git \
    htop \
    jq \
    tmux \
    zsh \
    ca-certificates \
    gnupg \
    wget \
    libatomic1 \
    socat \
    sudo \
    && install -m 0755 -d /etc/apt/keyrings \
    # Docker repository setup
    && curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu jammy stable" > /etc/apt/sources.list.d/docker.list \
    # Google Chrome repository setup
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /etc/apt/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    # Google Chrome has no arm64 build; add amd64 as a foreign arch so apt can
    # resolve it (runs under Docker Desktop's built-in amd64 emulation, while
    # the rest of the container stays native). The base image's sources.list
    # points every entry at ports.ubuntu.com, which only mirrors non-amd64
    # arches, so amd64 entries must be repointed at archive.ubuntu.com or apt
    # 404s trying to fetch amd64 package indexes from the ports mirror.
    && sed -i "s/^deb /deb [arch=arm64] /" /etc/apt/sources.list \
    && grep "^deb \[arch=arm64\]" /etc/apt/sources.list \
    | sed "s/arch=arm64/arch=amd64/; s|ports.ubuntu.com/ubuntu-ports|archive.ubuntu.com/ubuntu|" \
    >> /etc/apt/sources.list \
    && dpkg --add-architecture amd64 \
    # Install packages
    && apt-get update && apt-get install -y \
    docker-ce-cli \
    google-chrome-stable:amd64 \
    gh \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Non-root user node
RUN useradd -m -s /bin/zsh node

# Allow node to grant itself access to the host-mounted docker.sock without a
# password — the socket's host-side GID varies per machine, so we can't just
# add node to a docker group at build time. Scoped to this one chmod so it
# can't be used as a general sudo escape hatch.
RUN echo "node ALL=(root) NOPASSWD: /usr/bin/chmod 666 /var/run/docker.sock" > /etc/sudoers.d/node-docker-sock \
    && chmod 0440 /etc/sudoers.d/node-docker-sock

ENV NVM_DIR=/home/node/.nvm

WORKDIR /workspace

USER node

# Needed for NVM
SHELL ["/bin/bash", "-c"]

# https://github.com/nvm-sh/nvm#install--update-script
# Installs the absolute latest stable Node.js version
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.5/install.sh | bash \
    && . "$NVM_DIR/nvm.sh" --no-use \
    && nvm install node \
    && nvm alias default node \
    && ln -s "$NVM_DIR/versions/node/$(nvm version node)" "$NVM_DIR/current"

ENV PATH=/home/node/.nvm/current/bin:$PATH

# pnpm global bin dir — must be set before any `pnpm add -g` in the build.
# pnpm 11 symlinks global package bins into $PNPM_HOME/bin, not $PNPM_HOME
# itself, so that's what needs to be on PATH.
ENV PNPM_HOME=/home/node/.local/share/pnpm
ENV PATH=$PNPM_HOME/bin:$PATH

# Install the latest version of pnpm
RUN npm install -g pnpm@latest

# Install claude-code globally so `claude` is available as a plain command.
# Installed via npm rather than `pnpm add -g`: pnpm blocks packages'
# postinstall scripts by default (requiring manual allow-listing) and its
# global store layout (versioned store dirs, bin symlinks) has changed
# across pnpm versions, making a hardcoded path to install.cjs unreliable.
RUN npm install -g @anthropic-ai/claude-code

# Install Oh My Zsh
RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended && \
    sed -i 's/ZSH_THEME=".*"/ZSH_THEME="robbyrussell"/g' ~/.zshrc

# Install ralph claude code
RUN git clone https://github.com/frankbria/ralph-claude-code.git /tmp/ralph \
    && cd /tmp/ralph \
    && ./install.sh \
    && rm -rf /tmp/ralph
