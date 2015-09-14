from django.core.management.base import BaseCommand, make_option

from treeherder.model.models import Matcher


class Command(BaseCommand):
    help = 'Add new matchers or list existing ones'

    option_list = BaseCommand.option_list + (
        make_option('--add',
                    action='store',
                    default=None,
                    help="Add matcher with the specified name"),
        make_option('--remove',
                    action='store',
                    default=None,
                    help="Remove matcher with the specified name")
    )

    def handle(self, *args, **options):
        if not (options["add"] or options["remove"]):
            for item in Matcher.objects.all():
                print item.name

        if options["add"]:
            new = Matcher(name=options["add"])
            new.save()

        if options["remove"]:
            Matcher.objects.filter(name=options["remove"]).delete()
