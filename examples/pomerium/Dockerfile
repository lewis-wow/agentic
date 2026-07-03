# Bakes config.yaml and the locally-generated TLS cert into the image instead
# of bind-mounting them from the host. Docker Desktop's file-sharing
# allowlist (Preferences > Resources > File Sharing) can reject bind mounts
# for paths it doesn't know about, especially from a devcontainer talking to
# a host/remote daemon it doesn't fully control — building the files into the
# image sidesteps that entirely.
#
# Build context is examples/pomerium/ (see docker-compose.yml's `build:`
# block), so paths below are relative to this directory.
FROM pomerium/pomerium:latest
COPY pomerium/config.yaml /pomerium/config.yaml
COPY certs/cert.pem certs/key.pem /pomerium/certs/
