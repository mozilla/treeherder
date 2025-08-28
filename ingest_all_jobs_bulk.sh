#!/bin/bash

# Script to ingest all jobs for the last 500 pushes using bulk approach
# Usage: ./ingest_all_jobs_bulk.sh

# Source environment variables
source .env

# Activate the virtual environment
source venv/bin/activate

PROJECT="autoland"

echo "Starting job ingestion for all existing pushes for project: $PROJECT"
echo "This approach will iterate through pushes chronologically and ingest all jobs"
echo "WARNING: This will take several hours and ingest thousands of jobs!"
echo "Using Python: $(which python)"
echo "Press Ctrl+C within 10 seconds to cancel..."
sleep 10
echo "=========================================="

# Track start time
START_TIME=$(date +%s)

# Get all push revisions from the database in chronological order (oldest first)
echo "Fetching all push revisions from database..."
python manage.py shell -c "
from treeherder.model.models import Push
pushes = Push.objects.filter(repository__name='$PROJECT').order_by('time')
print(f'Found {pushes.count()} pushes to process')
with open('all_pushes_chronological.txt', 'w') as f:
    for i, push in enumerate(pushes, 1):
        f.write(f'{push.revision}\\n')
        if i % 50 == 0:
            print(f'Processed {i}/{pushes.count()} pushes...')
print('Created all_pushes_chronological.txt')
"

TOTAL=$(wc -l < "all_pushes_chronological.txt")
echo "Processing $TOTAL pushes chronologically..."

COUNTER=0
while IFS= read -r revision; do
    COUNTER=$((COUNTER + 1))
    echo ""
    echo "[$COUNTER/$TOTAL] Processing push: ${revision:0:12}..."
    echo "  Started at: $(date)"
    
    # Use a longer timeout (30 minutes) and better error handling
    timeout 1800 python manage.py ingest push -p "$PROJECT" -c "$revision" --ingest-all-tasks 2>&1 | \
        grep -E "(We have [0-9]+ tasks|## START ##|## END ##|ERROR|WARNING)" | \
        head -20
    
    EXIT_CODE=${PIPESTATUS[0]}
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo "  ✓ SUCCESS: Completed jobs for ${revision:0:12}..."
    elif [ $EXIT_CODE -eq 124 ]; then
        echo "  ⚠ TIMEOUT: ${revision:0:12}... (30min timeout - may have partially completed)"
    else
        echo "  ✗ FAILED: ${revision:0:12}... (exit code: $EXIT_CODE)"
    fi
    
    # Check current job count every 10 pushes
    if [ $((COUNTER % 10)) -eq 0 ]; then
        JOB_COUNT=$(python manage.py shell -c "from treeherder.model.models import Job; print(Job.objects.filter(repository__name='$PROJECT').count())" 2>/dev/null)
        CURRENT_TIME=$(date +%s)
        ELAPSED=$((CURRENT_TIME - START_TIME))
        AVG_TIME=$((ELAPSED / COUNTER))
        REMAINING=$((TOTAL - COUNTER))
        EST_REMAINING=$((REMAINING * AVG_TIME))
        
        echo "  Progress: $COUNTER/$TOTAL ($(($COUNTER * 100 / $TOTAL))%)"
        echo "  Total jobs in DB: $JOB_COUNT"
        echo "  Elapsed: $((ELAPSED/3600))h $((($ELAPSED%3600)/60))m"
        echo "  Est. remaining: $((EST_REMAINING/3600))h $((($EST_REMAINING%3600)/60))m"
    fi
    
    echo "  Completed at: $(date)"
    
    # Short pause between pushes
    sleep 5
    
done < all_pushes_chronological.txt

# Clean up
rm -f all_pushes_chronological.txt

TOTAL_TIME=$(date +%s)
TOTAL_ELAPSED=$((TOTAL_TIME - START_TIME))

echo ""
echo "=========================================="
echo "Job ingestion complete!"
echo "Total time: $((TOTAL_ELAPSED/3600))h $((($TOTAL_ELAPSED%3600)/60))m"

# Final job count
echo "Final job count check..."
python manage.py shell -c "
from treeherder.model.models import Job, Push
job_count = Job.objects.filter(repository__name='$PROJECT').count()
push_count = Push.objects.filter(repository__name='$PROJECT').count()
print(f'Total jobs in database for $PROJECT: {job_count}')
print(f'Total pushes in database for $PROJECT: {push_count}')
if push_count > 0:
    print(f'Average jobs per push: {job_count/push_count:.1f}')
"