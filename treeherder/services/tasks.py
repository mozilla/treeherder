from celery import task

from treeherder.services.intermittents_commenter.commenter import Commenter


@task(name='intermittents-commenter')
def run_commenter(weekly_mode, test_mode):
    """
    Run the intermittents commenter daily and weekly
    """
    process = Commenter(weekly_mode, test_mode)
    process.run()
