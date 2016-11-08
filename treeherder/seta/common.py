import os


def get_root_dir():
    path = os.path.expanduser('~/.mozilla/seta/')
    if not os.path.exists(path):
        os.makedirs(path)

    return path


def get_runnable_jobs_path():
    return os.path.join(get_root_dir(), 'runnable_jobs.json')
