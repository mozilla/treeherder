#!/bin/bash

# Script to ingest jobs with synchronous log parsing (populates group table)
# Usage: ./ingest_with_log_parsing.sh

# Source environment variables
source .env

# Activate the virtual environment
source venv/bin/activate

# Override Celery to run tasks synchronously (eager mode)
export CELERY_TASK_ALWAYS_EAGER=True
export CELERY_TASK_EAGER_PROPAGATES=True

PROJECT="autoland"

echo "Starting job ingestion with synchronous log parsing..."
echo "This will populate the group table as jobs are ingested"
echo "WARNING: This will be MUCH slower as logs are parsed immediately"
echo "=========================================="

# Get a few pushes to test with
python manage.py shell -c "
from treeherder.model.models import Push
from django.db.models import Count

# Get a few pushes that have jobs but might not have groups
pushes_to_process = Push.objects.filter(
    repository__name='$PROJECT'
).annotate(
    job_count=Count('jobs')
).filter(
    job_count__gt=0
).order_by('-time')[:5]  # Just process 5 recent pushes for testing

print(f'Processing {pushes_to_process.count()} pushes with log parsing enabled')

with open('test_pushes.txt', 'w') as f:
    for push in pushes_to_process:
        f.write(f'{push.revision}\\n')
"

echo "Processing pushes with log parsing enabled..."

while IFS= read -r revision; do
    echo "Processing push: ${revision:0:12}..."
    
    # Run with --enable-eager-celery to parse logs synchronously
    python manage.py ingest push -p "$PROJECT" -c "$revision" --ingest-all-tasks --enable-eager-celery 2>&1 | \
        grep -v "DEBUG" | \
        grep -E "(START|END|Loading|Parsing|tasks to process)" | \
        head -20
    
    echo "  ✓ Completed push with log parsing"
    
done < test_pushes.txt

rm -f test_pushes.txt

echo ""
echo "=========================================="
echo "Checking results..."

python manage.py shell -c "
from treeherder.model.models import Job, Group, FailureLine

job_count = Job.objects.filter(repository__name='$PROJECT').count()
group_count = Group.objects.count()
failure_line_count = FailureLine.objects.count()

print(f'Total jobs in database: {job_count}')
print(f'Total groups in database: {group_count}')
print(f'Total failure lines in database: {failure_line_count}')

if group_count > 0:
    print(f'\\nSample groups:')
    for group in Group.objects.all()[:5]:
        print(f'  - {group.name[:50]}...')
"