#!/bin/bash
cd "$(dirname "$0")/../../backend" || exit 1
uv sync
