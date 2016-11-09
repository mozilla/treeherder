import os


def get_root_dir():
    path = os.path.expanduser('~/.mozilla/seta/')
    if not os.path.exists(path):
        os.makedirs(path)

    return path


def get_runnable_jobs_path():
    return os.path.join(get_root_dir(), 'runnable_jobs.json')


def unique_key(testtype, buildtype, platform):
    '''This makes sure that we order consistently this unique identifier'''
    return (testtype, buildtype, platform)
