from treeherder.perf.alerts import (AlertsPicker,
                                    BackfillReportMaintainer,
                                    IdentifyAlertRetriggerables)


class BackfillReporter:
    """
    Wrapper class used to aggregate the reporting of backfill reports.
    """
    def __init__(self, options):
        """
        :param options: data for the BackfillReporter's internals
        Example: options = {'max_alerts': 5,
                            'max_improvements': 2,
                            'platforms_of_interest': ('windows10', 'windows7', 'linux', 'osx', 'android'),
                            'max_data_points': 5,
                            'time_interval': timedelta(days=1)}
        """
        alerts_picker = AlertsPicker(max_alerts=options.get('max_alerts'),
                                     max_improvements=options.get('max_improvements'),
                                     platforms_of_interest=options.get('platforms_of_interest'))
        backfill_context_fetcher = IdentifyAlertRetriggerables(max_data_points=options.get('max_data_points'),
                                                               time_interval=options.get('time_interval'))
        self.reportMaintainer = BackfillReportMaintainer(alerts_picker, backfill_context_fetcher)

    def report(self, since, frameworks, repositories):
        return self.reportMaintainer.provide_updated_reports(since, frameworks, repositories)
