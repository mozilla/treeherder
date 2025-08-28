#!/bin/bash

# Script to ingest the last 500 pushes from autoland
# Usage: ./ingest_all_pushes.sh

# Source environment variables
source .env

# Activate the virtual environment
source venv/bin/activate

PROJECT="autoland"
PUSH_COUNT=500

echo "Starting ingestion of last $PUSH_COUNT pushes for project: $PROJECT"
echo "Using Python: $(which python)"
echo "=========================================="

# Use the --last-n-pushes flag to get the last 500 pushes
python manage.py ingest push -p "$PROJECT" --last-n-pushes $PUSH_COUNT

echo "=========================================="
echo "Ingestion complete!"