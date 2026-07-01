socat TCP-LISTEN:9222,fork TCP:host.docker.internal:9222 &
claude --chrome
