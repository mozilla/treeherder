def unique_key(testtype, buildtype, platform):
    '''This makes sure that we order consistently this unique identifier'''
    return (testtype, buildtype, platform)


def job_priority_index(job_priorities):
    '''This structure helps with finding data from the job priorities table'''
    jp_index = {}
    # Creating this data structure which reduces how many times we iterate through the DB rows
    for jp in job_priorities:
        key = jp.unique_identifier()
        # This is guaranteed by a unique composite index for these 3 fields in models.py
        assert key not in jp_index,\
            '"{}" should be a unique job priority and that is unexpected.'.format(key)
        # (testtype, buildtype, platform)
        jp_index[key] = {'pk': jp.id, 'build_system_type': jp.buildsystem}

    return jp_index
