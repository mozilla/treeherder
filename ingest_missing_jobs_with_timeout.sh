#!/bin/bash

# Script to ingest jobs only for pushes that don't have jobs yet
# Usage: ./ingest_missing_jobs_with_timeout.sh [--resume-from REVISION]
# Example: ./ingest_missing_jobs_with_timeout.sh --resume-from ad9edd9fcf04

# Source environment variables
source .env

# Set DATABASE_URL if not already set
if [ -z "$DATABASE_URL" ]; then
    DATABASE_URL="psql://postgres:mozilla1234@localhost:$POSTGRES_PORT/treeherder"
fi

export DATABASE_URL

# Activate the virtual environment
source venv/bin/activate

# Suppress DEBUG logging
export DJANGO_LOG_LEVEL=INFO
export BROKER_URL=amqp://guest:guest@localhost:5672//

PROJECT="autoland"

# Parse command line arguments
RESUME_FROM=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --resume-from)
            RESUME_FROM="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--resume-from REVISION]"
            exit 1
            ;;
    esac
done

echo "Starting job ingestion for pushes without jobs for project: $PROJECT"
if [ -n "$RESUME_FROM" ]; then
    echo "RESUMING FROM REVISION: $RESUME_FROM"
fi
echo "WARNING: This will take several hours and ingest thousands of jobs!"
echo "Using Python: $(which python)"

# Check if gtimeout is available (from coreutils)
if command -v gtimeout &> /dev/null; then
    TIMEOUT_CMD="gtimeout"
    echo "Using gtimeout for time limits"
elif command -v timeout &> /dev/null; then
    TIMEOUT_CMD="timeout"
    echo "Using timeout for time limits"
else
    TIMEOUT_CMD=""
    echo "WARNING: No timeout command available - jobs may run indefinitely"
fi

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

resume_from = '$RESUME_FROM'

# Get pushes that have no jobs
pushes_without_jobs = Push.objects.filter(
    repository__name='$PROJECT'
).annotate(
    job_count=Count('jobs')
).filter(
    job_count=0
).order_by('time')

print(f'Found {pushes_without_jobs.count()} pushes without jobs to process')

# If resuming, we need to find the resume point in ALL pushes, not just those without jobs
if resume_from and resume_from.strip():
    print(f'Looking for resume point: {resume_from}...')
    try:
        resume_push = Push.objects.filter(
            repository__name='$PROJECT',
            revision__startswith=resume_from
        ).first()
        
        if resume_push:
            print(f'Found resume push: {resume_push.revision[:12]} at time {resume_push.time}')
            # Filter to only include pushes after the resume point that still need jobs
            pushes_without_jobs = pushes_without_jobs.filter(time__gte=resume_push.time)
            print(f'Filtered to {pushes_without_jobs.count()} pushes after resume point')
        else:
            print(f'WARNING: Could not find revision {resume_from} in database')
            print('Processing all pushes without jobs...')
    except Exception as e:
        print(f'Error finding resume point: {e}')
        print('Processing all pushes without jobs...')

# Write the filtered list
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
    
    # Run with or without timeout based on availability
    if [ -n "$TIMEOUT_CMD" ]; then
        echo "  Running with 10-minute timeout (fast mode, no log parsing)..."
        # Remove --enable-eager-celery for speed (no log parsing, no group table population)
        $TIMEOUT_CMD 600 python manage.py ingest push -p "$PROJECT" -c "$revision" --ingest-all-tasks 2>&1 | grep -v "DEBUG\|nodename nor servname\|ChannelPromise\|kombu"
        EXIT_CODE=${PIPESTATUS[0]}
        
        if [ $EXIT_CODE -eq 124 ]; then
            echo "  ⚠ TIMEOUT: ${revision:0:12}... (10min timeout - may have partially completed)"
        fi
    else
        echo "  Running without timeout (fast mode, no log parsing)..."
        # Remove --enable-eager-celery for speed (no log parsing, no group table population)
        python manage.py ingest push -p "$PROJECT" -c "$revision" --ingest-all-tasks 2>&1 | grep -v "DEBUG\|nodename nor servname\|ChannelPromise\|kombu"
        EXIT_CODE=${PIPESTATUS[0]}
    fi
    
    if [ $EXIT_CODE -eq 0 ]; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        echo "  ✓ SUCCESS: Completed jobs for ${revision:0:12}..."
    elif [ $EXIT_CODE -ne 124 ]; then
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
    
    # Very short pause between pushes (fast mode)
    sleep 1
    
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