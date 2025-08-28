#!/bin/bash

# Script to ingest autoland pushes from push_revisions.txt in batches
# Usage: ./ingest_pushes_batch.sh

# Source environment variables
source .env

# Activate the virtual environment
source venv/bin/activate

PROJECT="autoland"
REVISIONS_FILE="push_revisions.txt"
BATCH_SIZE=100
TOTAL=$(wc -l < "$REVISIONS_FILE")
BATCHES=$((($TOTAL + $BATCH_SIZE - 1) / $BATCH_SIZE))

echo "Starting ingestion of $TOTAL pushes for project: $PROJECT"
echo "Processing in $BATCHES batches of $BATCH_SIZE pushes each"
echo "Using Python: $(which python)"
echo "=========================================="

# Split the file into batches and process each
for ((batch=0; batch<$BATCHES; batch++)); do
    START=$((batch * BATCH_SIZE + 1))
    END=$((START + BATCH_SIZE - 1))
    
    # Make sure we don't exceed total lines
    if [ $END -gt $TOTAL ]; then
        END=$TOTAL
    fi
    
    BATCH_NUM=$((batch + 1))
    echo ""
    echo "Processing batch $BATCH_NUM/$BATCHES (pushes $START-$END)"
    echo "----------------------------------------"
    
    # Extract the batch of revisions
    sed -n "${START},${END}p" "$REVISIONS_FILE" > temp_batch.txt
    
    # Process each revision in the batch
    COUNTER=0
    while IFS= read -r revision; do
        COUNTER=$((COUNTER + 1))
        GLOBAL_COUNTER=$((START + COUNTER - 1))
        echo "[$GLOBAL_COUNTER/$TOTAL] Ingesting push: $revision"
        
        # Call the Django management command to ingest the push
        python manage.py ingest push -p "$PROJECT" -c "$revision" 2>&1 | grep -v DEBUG | grep -v "If you want all logs"
        
        if [ ${PIPESTATUS[0]} -eq 0 ]; then
            echo "✓ Successfully ingested: $revision"
        else
            echo "✗ Failed to ingest: $revision"
        fi
    done < temp_batch.txt
    
    # Clean up temp file
    rm -f temp_batch.txt
    
    echo "✓ Completed batch $BATCH_NUM/$BATCHES"
    
    # Optional: Add a small delay between batches to avoid overloading
    if [ $batch -lt $((BATCHES - 1)) ]; then
        echo "Waiting 2 seconds before next batch..."
        sleep 2
    fi
done

echo ""
echo "=========================================="
echo "Ingestion complete! Processed $TOTAL pushes in $BATCHES batches."