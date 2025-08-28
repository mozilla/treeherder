#!/bin/bash

# Monitor Celery log parsing queue status and progress
# Shows active tasks, parsing progress, and system performance

echo "================================================================================"
echo "Treeherder Log Parsing Queue Status - $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================================================"

echo ""
echo "🔄 CELERY QUEUE STATUS"
echo "----------------------"

# Check active log-parser tasks in detail
docker exec backend python manage.py shell -c "
import celery
app = celery.current_app
inspect = app.control.inspect()

print('Active log-parser tasks by worker:')
active = inspect.active() or {}
total_active = 0

for worker, tasks in active.items():
    log_tasks = [t for t in tasks if 'log-parser' in t.get('name', '')]
    total_active += len(log_tasks)
    if log_tasks:
        print(f'  {worker}: {len(log_tasks)} tasks')
    elif 'default' in worker.lower():
        print(f'  {worker}: 0 tasks')

print(f'\\nTotal active log-parser tasks: {total_active}')

# Check scheduled tasks
scheduled = inspect.scheduled() or {}
total_scheduled = 0
for worker, tasks in scheduled.items():
    log_tasks = [t for t in tasks if 'log-parser' in t.get('name', '')]
    total_scheduled += len(log_tasks)

# Check reserved (prefetched) tasks
reserved = inspect.reserved() or {}
total_reserved = 0
for worker, tasks in reserved.items():
    log_tasks = [t for t in tasks if 'log-parser' in t.get('name', '')]
    total_reserved += len(log_tasks)

if total_scheduled > 0:
    print(f'Scheduled tasks: {total_scheduled}')
if total_reserved > 0:
    print(f'Reserved tasks: {total_reserved}')

total_queue_size = total_active + total_scheduled + total_reserved
print(f'\\n📊 TOTAL QUEUE SIZE: {total_queue_size} log-parser tasks')
"

echo ""
echo "📈 PARSING PROGRESS"
echo "-------------------"

# Show parsing progress
docker exec backend python manage.py shell -c "
from treeherder.model.models import Group, FailureLine, Job, JobLog
import datetime

groups = Group.objects.count()
failure_lines = FailureLine.objects.count()

# Estimate completion  
jobs_with_logs = Job.objects.filter(
    repository__name='autoland',
    job_log__isnull=False
).distinct().count()

jobs_with_groups = Job.objects.filter(
    repository__name='autoland',
    job_log__groups__isnull=False  
).distinct().count()

remaining_jobs = max(0, jobs_with_logs - jobs_with_groups)

print(f'Groups parsed: {groups:,}')
print(f'Failure lines: {failure_lines:,}')
print(f'Jobs with logs: {jobs_with_logs:,}')
print(f'Jobs parsed: {jobs_with_groups:,}')
print(f'Jobs remaining: {remaining_jobs:,}')

if jobs_with_logs > 0:
    progress_pct = (jobs_with_groups / jobs_with_logs) * 100
    print(f'Progress: {progress_pct:.1f}% complete')
"

echo ""
echo "⚡ WORKER PERFORMANCE"
echo "--------------------"

# Count active worker processes
worker_count=$(docker exec backend ps aux | grep -E "celery.*worker.*default" | wc -l)
echo "Active worker processes: $worker_count"

echo ""
echo "================================================================================"
echo "💡 TIP: Run this script again to see progress updates"
echo "💡 Expected parsing rate: ~150-200 failure lines per second with current setup"
echo "================================================================================"