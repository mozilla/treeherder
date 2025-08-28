#!/bin/bash

# Script to ingest all jobs for existing pushes in the database
# Usage: ./ingest_jobs_for_existing_pushes.sh

# Source environment variables
source .env

# Activate the virtual environment
source venv/bin/activate

PROJECT="autoland"
REVISIONS_FILE="existing_pushes.txt"
BATCH_SIZE=5  # Very small batches since job ingestion is intensive
TOTAL=$(wc -l < "$REVISIONS_FILE")
BATCHES=$((($TOTAL + $BATCH_SIZE - 1) / $BATCH_SIZE))

echo "Starting job ingestion for $TOTAL pushes for project: $PROJECT"
echo "Processing in $BATCHES batches of $BATCH_SIZE pushes each"
echo "WARNING: This will take several hours and ingest thousands of jobs!"
echo "Each push may take 2-10 minutes to process all its jobs."
echo "Using Python: $(which python)"
echo "Press Ctrl+C within 10 seconds to cancel..."
sleep 10
echo "=========================================="

# Track start time
START_TIME=$(date +%s)

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
    echo "Estimated time remaining: $((($BATCHES - $batch) * $BATCH_SIZE * 3)) minutes"
    echo "----------------------------------------"
    
    # Extract the batch of revisions
    sed -n "${START},${END}p" "$REVISIONS_FILE" > temp_jobs_batch.txt
    
    # Process each revision in the batch
    COUNTER=0
    while IFS= read -r revision; do
        COUNTER=$((COUNTER + 1))
        GLOBAL_COUNTER=$((START + COUNTER - 1))
        echo "[$GLOBAL_COUNTER/$TOTAL] Ingesting ALL JOBS for push: ${revision:0:12}..."
        echo "  Starting at: $(date)"
        
        # Call the Django management command to ingest all tasks for the push
        timeout 900 python manage.py ingest push -p "$PROJECT" -c "$revision" --ingest-all-tasks 2>&1 | grep -v DEBUG | grep -E "(INFO|ERROR|We have [0-9]+ tasks|Loading into DB)"
        
        if [ ${PIPESTATUS[0]} -eq 0 ]; then
            echo "✓ Successfully ingested all jobs for: ${revision:0:12}..."
        elif [ ${PIPESTATUS[0]} -eq 124 ]; then
            echo "⚠ Timeout (15min) for: ${revision:0:12}... (may have partially completed)"
        else
            echo "✗ Failed to ingest jobs for: ${revision:0:12}..."
        fi
        
        # Check current job count
        JOB_COUNT=$(source .env && source venv/bin/activate && python manage.py shell -c "from treeherder.model.models import Job; print(Job.objects.filter(repository__name='$PROJECT').count())" 2>/dev/null)
        echo "  Current total jobs in DB: $JOB_COUNT"
        echo "  Completed at: $(date)"
        echo ""
    done < temp_jobs_batch.txt
    
    # Clean up temp file
    rm -f temp_jobs_batch.txt
    
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))
    echo "✓ Completed batch $BATCH_NUM/$BATCHES (Elapsed: $((ELAPSED/60))m)"
    
    # Add a delay between batches
    if [ $batch -lt $((BATCHES - 1)) ]; then
        echo "Waiting 30 seconds before next batch..."
        sleep 30
    fi
done

TOTAL_TIME=$(date +%s)
TOTAL_ELAPSED=$((TOTAL_TIME - START_TIME))

echo ""
echo "=========================================="
echo "Job ingestion complete!"
echo "Total time: $((TOTAL_ELAPSED/3600))h $((($TOTAL_ELAPSED%3600)/60))m"
echo "Processed all jobs for $TOTAL pushes in $BATCHES batches."

# Final job count
echo "Final job count check..."
python manage.py shell -c "
from treeherder.model.models import Job, Push
job_count = Job.objects.filter(repository__name='$PROJECT').count()
push_count = Push.objects.filter(repository__name='$PROJECT').count()
print(f'Total jobs in database for $PROJECT: {job_count}')
print(f'Total pushes in database for $PROJECT: {push_count}')
print(f'Average jobs per push: {job_count/push_count:.1f}')
"