#!/usr/bin/env bash
# Local launcher for ADK CAPTCHA Resolver
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

export PYTHONPATH="/webtop-config/.local/share/uv/tools/google-agents-cli/lib/python3.14/site-packages:$PYTHONPATH"
export PROJECT_ID="${PROJECT_ID:-extended-atrium-508907-b6}"
export LOCATION="${LOCATION:-us-central1}"
export MODEL_NAME="${MODEL_NAME:-gemini-2.5-flash}"
export PORT="${PORT:-8080}"

echo "Starting ADK CAPTCHA Resolver locally on http://localhost:$PORT..."
exec python3 app.py
