#!/bin/bash

# Script to ingest autoland pushes from push_revisions.txt file
# Usage: ./ingest_pushes.sh

# Source environment variables
source .env

# Activate the virtual environment
source venv/bin/activate

PROJECT="autoland"
REVISIONS_FILE="push_revisions.txt"
COUNTER=0
TOTAL=$(wc -l < "$REVISIONS_FILE")

echo "Starting ingestion of $TOTAL pushes for project: $PROJECT"
echo "Using Python: $(which python)"
echo "=========================================="

# Read each revision from the file and ingest it
while IFS= read -r revision; do
    COUNTER=$((COUNTER + 1))
    echo ""
    echo "[$COUNTER/$TOTAL] Ingesting push: $revision"
    echo "----------------------------------------"
    
    # Call the Django management command to ingest the push
    python manage.py ingest push -p "$PROJECT" -c "$revision"
    
    if [ $? -eq 0 ]; then
        echo "✓ Successfully ingested: $revision"
    else
        echo "✗ Failed to ingest: $revision"
    fi
done < "$REVISIONS_FILE"

echo ""
echo "=========================================="
echo "Ingestion complete! Processed $COUNTER pushes."