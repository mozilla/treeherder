#!/bin/bash

# Script to ingest all jobs for all pushes in push_revisions.txt
# Usage: ./ingest_all_jobs.sh

# Source environment variables
source .env

# Activate the virtual environment
source venv/bin/activate

PROJECT="autoland"
REVISIONS_FILE="push_revisions.txt"
BATCH_SIZE=10  # Smaller batches since this is much more intensive
TOTAL=$(wc -l < "$REVISIONS_FILE")
BATCHES=$((($TOTAL + $BATCH_SIZE - 1) / $BATCH_SIZE))

echo "Starting job ingestion for $TOTAL pushes for project: $PROJECT"
echo "Processing in $BATCHES batches of $BATCH_SIZE pushes each"
echo "WARNING: This will take a very long time and ingest thousands of jobs!"
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
    sed -n "${START},${END}p" "$REVISIONS_FILE" > temp_jobs_batch.txt
    
    # Process each revision in the batch
    COUNTER=0
    while IFS= read -r revision; do
        COUNTER=$((COUNTER + 1))
        GLOBAL_COUNTER=$((START + COUNTER - 1))
        echo "[$GLOBAL_COUNTER/$TOTAL] Ingesting ALL JOBS for push: $revision"
        echo "  This may take several minutes per push..."
        
        # Call the Django management command to ingest all tasks for the push
        python manage.py ingest push -p "$PROJECT" -c "$revision" --ingest-all-tasks 2>&1 | grep -v DEBUG
        
        if [ ${PIPESTATUS[0]} -eq 0 ]; then
            echo "✓ Successfully ingested all jobs for: $revision"
        else
            echo "✗ Failed to ingest jobs for: $revision"
        fi
        
        echo "  Completed push $GLOBAL_COUNTER/$TOTAL"
    done < temp_jobs_batch.txt
    
    # Clean up temp file
    rm -f temp_jobs_batch.txt
    
    echo "✓ Completed batch $BATCH_NUM/$BATCHES"
    
    # Add a delay between batches to avoid overloading
    if [ $batch -lt $((BATCHES - 1)) ]; then
        echo "Waiting 10 seconds before next batch..."
        sleep 10
    fi
done

echo ""
echo "=========================================="
echo "Job ingestion complete! Processed all jobs for $TOTAL pushes in $BATCHES batches."
echo "Check the database for job counts."