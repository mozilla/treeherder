#!/bin/bash

# Quick status check - run this frequently during processing

source .env && source venv/bin/activate

echo "$(date): Jobs: $(python manage.py shell -c "from treeherder.model.models import Job; print(Job.objects.filter(repository__name='autoland').count())" 2>/dev/null), Groups: $(python manage.py shell -c "from treeherder.model.models import Group; print(Group.objects.count())" 2>/dev/null), Failures: $(python manage.py shell -c "from treeherder.model.models import FailureLine; print(FailureLine.objects.filter(job_log__job__repository__name='autoland').count())" 2>/dev/null)"