#!/bin/bash

# Script to parse logs for existing jobs and populate the group table
# Usage: ./parse_logs_for_jobs.sh

# Source environment variables
source .env

# Activate the virtual environment
source venv/bin/activate

echo "Parsing logs for existing jobs to populate the group table..."
echo "=========================================="

python manage.py shell << 'EOF'
from treeherder.model.models import Job, JobLog, Group
from treeherder.log_parser.failureline import store_failure_lines
from treeherder.log_parser.crossreference import crossreference_job
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get jobs that have logs but might not have been parsed
jobs_with_logs = Job.objects.filter(
    repository__name='autoland',
    logs__name='live_backing_log'
).distinct()[:10]  # Start with just 10 for testing

print(f"Found {jobs_with_logs.count()} jobs with logs to process")
print(f"Current groups in database: {Group.objects.count()}")

for i, job in enumerate(jobs_with_logs, 1):
    print(f"\nProcessing job {i}/{jobs_with_logs.count()}: {job.guid}")
    
    try:
        # Get the job's logs
        job_logs = JobLog.objects.filter(job=job)
        
        for job_log in job_logs:
            if job_log.name in ['live_backing_log', 'errorsummary_json']:
                print(f"  Parsing {job_log.name}...")
                
                # Parse the log for failure lines
                # This would normally be done by the log parser tasks
                # Note: This is simplified - actual parsing requires downloading and processing the log
                
        # Cross-reference the job to detect intermittent failures
        crossreference_job(job)
        
    except Exception as e:
        print(f"  Error processing job {job.id}: {e}")

print(f"\nFinal groups in database: {Group.objects.count()}")
print("Done!")
EOF