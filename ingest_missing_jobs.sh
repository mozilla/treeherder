#!/bin/bash

# Script to ingest jobs only for pushes that don't have jobs yet
# Usage: ./ingest_missing_jobs.sh

# Source environment variables
source .env

# Activate the virtual environment
source venv/bin/activate

PROJECT="autoland"

echo "Starting job ingestion for pushes without jobs for project: $PROJECT"
echo "WARNING: This will take several hours and ingest thousands of jobs!"
echo "Using Python: $(which python)"
echo "Press Ctrl+C within 10 seconds to cancel..."
sleep 10
echo "=========================================="

# Track start time
START_TIME=$(date +%s)

# Get push revisions that don't have jobs yet
echo "Fetching pushes without jobs from database..."
python manage.py shell -c "
from treeherder.model.models import Push
from django.db.models import Count

# Get pushes that have no jobs
pushes_without_jobs = Push.objects.filter(
    repository__name='$PROJECT'
).annotate(
    job_count=Count('jobs')
).filter(
    job_count=0
).order_by('time')

print(f'Found {pushes_without_jobs.count()} pushes without jobs to process')

with open('pushes_needing_jobs.txt', 'w') as f:
    for i, push in enumerate(pushes_without_jobs, 1):
        f.write(f'{push.revision}\\n')
        if i % 50 == 0:
            print(f'Processed {i}/{pushes_without_jobs.count()} pushes...')

print('Created pushes_needing_jobs.txt')
"

TOTAL=$(wc -l < "pushes_needing_jobs.txt")
echo "Processing $TOTAL pushes that need jobs..."

if [ $TOTAL -eq 0 ]; then
    echo "No pushes need jobs - all done!"
    exit 0
fi

COUNTER=0
SUCCESS_COUNT=0
FAIL_COUNT=0

while IFS= read -r revision; do
    COUNTER=$((COUNTER + 1))
    echo ""
    echo "[$COUNTER/$TOTAL] Processing push: ${revision:0:12}..."
    echo "  Started at: $(date)"
    
    # Direct command execution without timeout (macOS doesn't have timeout by default)
    echo "  Running: python manage.py ingest push -p $PROJECT -c $revision --ingest-all-tasks"
    
    # Run the command directly, suppress RabbitMQ connection errors
    python manage.py ingest push -p "$PROJECT" -c "$revision" --ingest-all-tasks 2>&1 | \
        grep -v "nodename nor servname provided" | \
        grep -v "ChannelPromise" | \
        grep -v "kombu" || true
    EXIT_CODE=${PIPESTATUS[0]}
    
    if [ $EXIT_CODE -eq 0 ]; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        echo "  ✓ SUCCESS: Completed jobs for ${revision:0:12}..."
    elif [ $EXIT_CODE -eq 124 ]; then
        echo "  ⚠ TIMEOUT: ${revision:0:12}... (30min timeout - may have partially completed)"
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        echo "  ✗ FAILED: ${revision:0:12}... (exit code: $EXIT_CODE)"
    fi
    
    # Progress update every 5 pushes
    if [ $((COUNTER % 5)) -eq 0 ]; then
        JOB_COUNT=$(python manage.py shell -c "from treeherder.model.models import Job; print(Job.objects.filter(repository__name='$PROJECT').count())" 2>/dev/null)
        CURRENT_TIME=$(date +%s)
        ELAPSED=$((CURRENT_TIME - START_TIME))
        
        if [ $COUNTER -gt 0 ]; then
            AVG_TIME=$((ELAPSED / COUNTER))
            REMAINING=$((TOTAL - COUNTER))
            EST_REMAINING=$((REMAINING * AVG_TIME))
        else
            EST_REMAINING=0
        fi
        
        echo "  ========================================"
        echo "  Progress: $COUNTER/$TOTAL ($(($COUNTER * 100 / $TOTAL))%)"
        echo "  Success: $SUCCESS_COUNT | Failed: $FAIL_COUNT"
        echo "  Total jobs in DB: $JOB_COUNT"
        echo "  Elapsed: $((ELAPSED/3600))h $((($ELAPSED%3600)/60))m"
        if [ $EST_REMAINING -gt 0 ]; then
            echo "  Est. remaining: $((EST_REMAINING/3600))h $((($EST_REMAINING%3600)/60))m"
        fi
        echo "  ========================================"
    fi
    
    echo "  Completed at: $(date)"
    
    # Short pause between pushes
    sleep 3
    
done < pushes_needing_jobs.txt

# Clean up
rm -f pushes_needing_jobs.txt

TOTAL_TIME=$(date +%s)
TOTAL_ELAPSED=$((TOTAL_TIME - START_TIME))

echo ""
echo "=========================================="
echo "Job ingestion complete!"
echo "Total time: $((TOTAL_ELAPSED/3600))h $((($TOTAL_ELAPSED%3600)/60))m"
echo "Successfully processed: $SUCCESS_COUNT pushes"
echo "Failed: $FAIL_COUNT pushes"

# Final job count
echo ""
echo "Final statistics:"
python manage.py shell -c "
from treeherder.model.models import Job, Push
from django.db.models import Count

job_count = Job.objects.filter(repository__name='$PROJECT').count()
push_count = Push.objects.filter(repository__name='$PROJECT').count()
pushes_with_jobs = Push.objects.filter(repository__name='$PROJECT').annotate(job_count=Count('jobs')).filter(job_count__gt=0).count()
pushes_without_jobs = push_count - pushes_with_jobs

print(f'Total jobs in database: {job_count}')
print(f'Total pushes: {push_count}')
print(f'Pushes with jobs: {pushes_with_jobs}')
print(f'Pushes without jobs: {pushes_without_jobs}')
if pushes_with_jobs > 0:
    print(f'Average jobs per push: {job_count/pushes_with_jobs:.1f}')
"