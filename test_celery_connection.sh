#!/bin/bash

# Test Celery connection and task routing
source .env
source venv/bin/activate

echo "Testing Celery connection and task routing..."

python manage.py shell << 'EOF'
from treeherder.model.models import Job, JobLog
from treeherder.log_parser.tasks import parse_logs
from celery import Celery
import os

# Test with the corrected broker URL
app = Celery('treeherder')
app.config_from_object('django.conf:settings', namespace='CELERY')

print(f"Broker URL: {os.environ.get('BROKER_URL', 'Not set')}")
print(f"Celery broker: {app.conf.broker_url}")

# Get a job that needs log parsing
test_job = Job.objects.filter(
    repository__name='autoland',
    result='testfailed'
).first()

if test_job:
    job_logs = JobLog.objects.filter(job=test_job)
    print(f"\nTest job: {test_job.guid}")
    print(f"Job logs: {job_logs.count()}")
    
    if job_logs.exists():
        print("Sending log parsing task to Celery...")
        
        # Try different queue approaches
        try:
            # Method 1: Default queue
            result = parse_logs.apply_async(
                args=[test_job.id, [log.id for log in job_logs], 'normal']
            )
            print(f"✓ Task sent with ID: {result.id}")
            
        except Exception as e:
            print(f"✗ Failed to send task: {e}")
            
            # Method 2: Specific queue
            try:
                result = parse_logs.apply_async(
                    args=[test_job.id, [log.id for log in job_logs], 'normal'],
                    queue='log-parser'
                )
                print(f"✓ Task sent to log-parser queue with ID: {result.id}")
            except Exception as e2:
                print(f"✗ Also failed with specific queue: {e2}")
    else:
        print("No logs found for test job")
else:
    print("No failed jobs found for testing")

EOF