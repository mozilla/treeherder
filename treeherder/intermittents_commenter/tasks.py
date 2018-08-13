from celery import task

from treeherder.intermittents_commenter.commenter import Commenter


@task(name='intermittents-commenter', soft_time_limit=120 * 60, time_limit=121 * 60)
def run_commenter(weekly_mode=False):
    """Run the intermittents commenter in either daily or weekly mode."""
    process = Commenter(weekly_mode=weekly_mode)
    process.run()
