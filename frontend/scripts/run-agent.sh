#!/bin/bash
cd "$(dirname "$0")/../../backend" || exit 1
npx @langchain/langgraph-cli dev --port 8123 --no-browser
