def set_classifications(failures, intermittent_history, fixed_by_commit_history):
    for failure in failures:
        set_intermittent(failure, intermittent_history)
        set_fixed_by_commit(failure, fixed_by_commit_history)


def set_fixed_by_commit(failure, fixed_by_commit_history):
    # Not perfect, could have intermittent that is cause of fbc
    if failure['testName'] in fixed_by_commit_history.keys() and not is_classified_intermittent(failure):
        failure['suggestedClassification'] = 'fixedByCommit'
        return True
    return False


def set_intermittent(failure, previous_failures):
    # Not clear if we need these TODO items or not:
    # TODO: if there is >1 failure for platforms/config, increase pct
    # TODO: if >1 failures in the same dir or platform, increase pct

    name = failure['testName']
    platform = failure['platform']
    config = failure['config']
    job_name = failure['jobName']

    confidence = 0
    if name in previous_failures:
        confidence = 50
        if platform in previous_failures[name]:
            confidence = 75
            if config in previous_failures[name][platform]:
                confidence = 100

    # TODO: how many unique regression in win7*reftest*
    # Marking all win7 reftest failures as int, too many font issues
    if confidence == 0 and platform == 'windows7-32' and (
        'opt-reftest' in job_name or 'debug-reftest' in job_name
    ):
        confidence = 50

    if is_classified_intermittent(failure):
        confidence = 100

    if confidence:
        failure['confidence'] = confidence
        failure['suggestedClassification'] = 'intermittent'
        return True
    return False


def is_classified_intermittent(failure):
    return all(job['failure_classification_id'] == 4 for job in failure['failJobs'])


def get_log_lines(failure):
    messages = []
    for line in failure['logLines']:
        line = line.encode('ascii', 'ignore')
        parts = line.split(b'|')
        if len(parts) == 3:
            messages.append(parts[2].strip())
    return messages


def get_grouped(failures):
    classified = {
        'needInvestigation': [],
        'intermittent': [],
    }

    for failure in failures:
        is_intermittent = failure['suggestedClassification'] == 'intermittent'

        if ((is_intermittent and failure['confidence'] == 100) or
                failure['passFailRatio'] > .5):
            classified['intermittent'].append(failure)
        else:
            classified['needInvestigation'].append(failure)
            # If it needs investigation, we, by definition, don't have 100% confidence.
            failure['confidence'] = min(failure['confidence'], 90)

    return classified
