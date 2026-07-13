#!/bin/bash

# Safely extract app settings from the configuration file
if [ -f .env.claude ]
then
    set -a
    source .env.claude
    set +a
fi

# Request an installation access token dynamically using Node.js
export GH_TOKEN=$(node -e '
const crypto = require("crypto")
const fs = require("fs")

try {
    const pkey = fs.readFileSync(process.env.PRIVATE_KEY_PATH, "utf8")
    const now = Math.floor(Date.now() / 1000)
    const header = { alg: "RS256", typ: "JWT" }
    const payload = { iat: now - 60, exp: now + 600, iss: process.env.APP_ID }
    
    const b64 = (b) => b.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
    const tokenInput = b64(Buffer.from(JSON.stringify(header))) + "." + b64(Buffer.from(JSON.stringify(payload)))
    const sign = crypto.sign("SHA256", Buffer.from(tokenInput), pkey)
    const jwt = tokenInput + "." + b64(sign)

    fetch("https://api.github.com/app/installations/" + process.env.INSTALLATION_ID + "/access_tokens", {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + jwt,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "Claude-CLI"
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.token) console.log(data.token)
        else process.exit(1)
    })
} catch (e) {
    process.exit(1)
}
')

# Fallback block to guard against empty environment values
if [ -z "$GH_TOKEN" ]
then
    echo "Error: Unable to generate a valid GitHub App access token."
    echo "Please check your credentials inside .env.claude and the .pem file path."
    exit 1
fi

# Define the local Git profile settings matching the App identity
export GIT_AUTHOR_NAME="Claude Bot"
export GIT_AUTHOR_EMAIL="claude-bot@users.noreply.github.com"
export GIT_COMMITTER_NAME="Claude Bot"
export GIT_COMMITTER_EMAIL="claude-bot@users.noreply.github.com"

# Launch the interactive terminal application
exec claude
