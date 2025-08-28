#!/bin/bash

# Parallel log parsing script for maximum speed while maintaining accuracy
# This script sends log parsing tasks to Celery workers in batches

PROJECT="autoland"
BATCH_SIZE=100  # Process logs in batches
MAX_CONCURRENT=50  # Max concurrent Celery tasks

echo "Starting parallel log parsing for all unparsed jobs..."
echo "Project: $PROJECT"
echo "Batch size: $BATCH_SIZE"
echo "Max concurrent tasks: $MAX_CONCURRENT"

# Get all jobs that need log parsing (failed jobs are highest priority)
echo "Fetching jobs that need log parsing..."

# Run the Django shell command inside the backend container
docker exec -i backend python manage.py shell << 'EOF'
from treeherder.model.models import Job, JobLog, FailureLine
from treeherder.log_parser.tasks import parse_logs
from celery import group
import time

# Get jobs that likely need parsing (failed jobs + jobs without failure lines)
jobs_needing_parsing = Job.objects.filter(
    repository__name='autoland',
    result__in=['testfailed', 'busted', 'exception', 'retry']
).select_related('repository').order_by('-id')

print(f'Priority jobs needing parsing: {jobs_needing_parsing.count()}')

# Also get successful jobs that might need parsing for completeness
other_jobs = Job.objects.filter(
    repository__name='autoland',
    result='success'
).exclude(
    id__in=FailureLine.objects.filter(
        job_log__job__repository__name='autoland'
    ).values_list('job_log__job_id', flat=True)
).select_related('repository').order_by('-id')[:5000]  # Limit to recent 5000

all_jobs = list(jobs_needing_parsing) + list(other_jobs)
print(f'Total jobs to process: {len(all_jobs)}')

# Process in batches with Celery
batch_size = 100
processed = 0
task_results = []

for i in range(0, len(all_jobs), batch_size):
    batch = all_jobs[i:i+batch_size]
    batch_tasks = []
    
    print(f'\nProcessing batch {i//batch_size + 1}/{(len(all_jobs)-1)//batch_size + 1}')
    
    for job in batch:
        job_logs = JobLog.objects.filter(job=job)
        if job_logs.exists():
            # Send task to Celery - non-blocking
            try:
                result = parse_logs.delay(
                    job.id, [log.id for log in job_logs], 'normal'
                )
                batch_tasks.append(result)
                processed += 1
                
                if processed % 10 == 0:
                    print(f'  Queued {processed}/{len(all_jobs)} jobs for parsing...')
                    
            except Exception as e:
                print(f'  Error queuing job {job.guid[:12]}: {e}')
    
    # Wait briefly between batches to avoid overwhelming the queue
    if batch_tasks:
        task_results.extend(batch_tasks)
        print(f'  Batch sent to Celery queue ({len(batch_tasks)} tasks)')
        time.sleep(2)  # Small delay between batches
    
    # Every 500 jobs, check progress
    if processed % 500 == 0 and processed > 0:
        completed_tasks = sum(1 for task in task_results if task.ready())
        print(f'\n=== Progress Update ===')
        print(f'Jobs queued: {processed}/{len(all_jobs)}')
        print(f'Tasks completed: {completed_tasks}/{len(task_results)}')
        print(f'Tasks pending: {len(task_results) - completed_tasks}')
        print('======================\n')

print(f'\nAll {processed} jobs have been queued for log parsing!')
print('Celery workers are now processing them in parallel.')
print('Check progress with: python manage.py shell -c "from treeherder.model.models import Group; print(f\'Groups: {Group.objects.count()}\')"')

EOF