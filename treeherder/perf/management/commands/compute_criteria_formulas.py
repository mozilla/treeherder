import time
from datetime import timedelta


from treeherder.config import settings
from treeherder.perf.sheriffing_criteria import (
    EngineerTractionFormula,
    FixRatioFormula,
    CriteriaTracker,
    TotalAlertsFormula,
)
from treeherder.perf.sheriffing_criteria import criteria_tracking
from mo_times import Duration
from django.core.management.base import BaseCommand


def pretty_enumerated(formulas: list[str]) -> str:
    comma = ", "
    return " & ".join(comma.join(formulas).rsplit(comma, maxsplit=1))


class Command(BaseCommand):
    ENGINEER_TRACTION = "engineer traction"
    FIX_RATIO = "fix ratio"
    FORMULAS = [ENGINEER_TRACTION, FIX_RATIO]  # register new formulas here

    help = f"""
    Compute the {pretty_enumerated(FORMULAS)} for multiple framework/suite combinations,
     according to the Perf Sheriffing Criteria specification.\nRequires "{criteria_tracking.CRITERIA_FILENAME}" to be provided for both program input & output.
    """

    INITIAL_PROMPT_MSG = "Computing Perf Sheriffing Criteria... (may take some time)"
    PRECISION = ".1f"

    def add_arguments(self, parser):
        parser.add_argument(
            "--quantifying-period",
            "-qp",
            default=settings.QUANTIFYING_PERIOD,
            type=self.parse_time_interval,
            help="""How far back to look for gathering formula's input data, from now.
            Expressed in a humanized form.
            Examples: 1year, 6month, 2weeks etc.
            More details about accepted forms: https://github.com/mozilla/ActiveData/blob/dev/docs/jx_time.md#duration""",
            metavar="QUANTIFYING_PERIOD",
        )

        parser.add_argument(
            "--bug-cooldown",
            "-bc",
            default=settings.BUG_COOLDOWN_TIME,
            type=self.parse_time_interval,
            help="""How old Bugzilla bugs should be to be taken into consideration.
            Expressed in a humanized form.
            Examples: 1year, 6month, 2weeks etc.
            More details about accepted forms: https://github.com/mozilla/ActiveData/blob/dev/docs/jx_time.md#duration""",
            metavar="BUG_COOLDOWN",
        )

        parser.add_argument(
            "--multiprocessing",
            "-mp",
            action="store_true",
            help="""Experimental! Whether to use a process pool instead of a thread pool""",
        )
        subparser = parser.add_subparsers(dest="individually")
        individual_parser = subparser.add_parser(
            "individually",
            help="Compute perf sheriffing criteria for individual framework/suite combo (no CSV file required)",
        )
        individual_parser.add_argument("framework", action="store")
        individual_parser.add_argument("suite", action="store")
        individual_parser.add_argument("--test", default=None)

    def handle(self, *args, **options):
        if options.get("individually"):
            return self._handle_individually(options)

        quant_period = options["quantifying_period"]
        bug_cooldown = options["bug_cooldown"]
        multiprocessed = options["multiprocessing"]

        init_params = (None, quant_period, bug_cooldown)
        formula_map = {
            "EngineerTraction": EngineerTractionFormula(*init_params),
            "FixRatio": FixRatioFormula(*init_params),
            "TotalAlerts": TotalAlertsFormula(quant_period),
        }

        tracker = CriteriaTracker(formula_map, multiprocessed=multiprocessed)
        tracker.load_records()
        start = time.time()
        tracker.update_records()
        duration = time.time() - start

        print(f"{self.INITIAL_PROMPT_MSG}", end="")

        for record in tracker:
            print(record)
        print(f"Took {duration:.1f} seconds")

    def _handle_individually(self, options):
        framework = options["framework"]
        suite = options["suite"]
        test = options["test"]
        quant_period = options["quantifying_period"]
        bug_cooldown = options["bug_cooldown"]

        init_params = (None, quant_period, bug_cooldown)
        targetted_test = (framework, suite, test)

        engineer_traction = EngineerTractionFormula(*init_params)
        fix_ratio = FixRatioFormula(*init_params)

        print(f"\r{self.INITIAL_PROMPT_MSG}", end="")

        compute_start = time.time()
        eng_traction_result = engineer_traction(*targetted_test)
        fix_ratio_result = fix_ratio(*targetted_test)
        compute_duration = time.time() - compute_start

        # turn into regular percentages
        eng_traction_result *= 100
        fix_ratio_result *= 100

        # display results (inline)
        test_moniker = " ".join(filter(None, (suite, test)))
        title = f"Perf Sheriffing Criteria for {framework} - {test_moniker}"
        big_underline = "-" * len(title)

        # & results headers
        eng_traction_head = self.ENGINEER_TRACTION.capitalize()
        fix_ratio_head = self.FIX_RATIO.capitalize()
        justify_head = self.__get_head_justification(eng_traction_head, fix_ratio_head)

        # let's update 1st prompt line
        print(f"\r{' ' * len(self.INITIAL_PROMPT_MSG)}", end="")
        print(
            f"\rComputing Perf Sheriffing Criteria... (took {compute_duration:{self.PRECISION}} seconds)"
        )

        # display title
        print(big_underline)
        print(title)
        print(big_underline)

        # & actual results
        print(f"{eng_traction_head:<{justify_head}}: {eng_traction_result:{self.PRECISION}}%")
        print(f"{fix_ratio_head:<{justify_head}}: {fix_ratio_result:{self.PRECISION}}%")
        print(big_underline)

    def __get_head_justification(self, *result_heads):
        return max([len(head) for head in result_heads]) + 1

    def parse_time_interval(self, interval: str) -> timedelta:
        duration = Duration(interval)
        return timedelta(seconds=duration.total_seconds())
