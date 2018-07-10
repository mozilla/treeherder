from celery import task

from treeherder.intermittents_commenter.commenter import Commenter


@task(name='intermittents-commenter')
def run_commenter(**kwargs):
    """
    Run the intermittents commenter in either daily or weekly mode.
    """
    process = Commenter(weekly_mode=False, dry_run=False)
    process.run()
