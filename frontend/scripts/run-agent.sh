#!/bin/bash
cd "$(dirname "$0")/../../backend" || exit 1
METTLE_ENV=development uv run python serve.py
