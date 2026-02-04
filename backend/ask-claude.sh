#!/bin/bash

# Read the prompt from stdin or first argument
if [ -p /dev/stdin ]; then
    PROMPT=$(cat)
else
    PROMPT="$1"
fi

# Call Clawdbot sessions_send (assuming clawdbot is in PATH)
# This will use Clawdbot's internal session management
echo "$PROMPT" | clawdbot sessions send \
  --sessionKey "agent:main:subagent:a881219c-3b22-4a4c-b099-66a99a269c4a" \
  --timeoutSeconds 60 \
  2>/dev/null | jq -r '.reply // .response // .text // .'
