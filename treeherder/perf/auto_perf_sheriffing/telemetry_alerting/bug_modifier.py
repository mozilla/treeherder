import logging

logger = logging.getLogger(__name__)


class TelemetryBugModifier:
    modifiers = []

    @staticmethod
    def add(modifier_class):
        TelemetryBugModifier.modifiers.append(modifier_class)

    @staticmethod
    def get_modifiers():
        return TelemetryBugModifier.modifiers

    @staticmethod
    def get_bug_modifications(alerts, commented_bugs, new_bugs, **kwargs):
        """Get all the bug modifications that need to be made.

        No guarantees on the ordering of the modifiers running are made. They
        can modify the same fields, but certain fields are not allowed to have multiple
        modifications. The modifiers should not depend on each other.

        All bug changes from the modifiers are gathered together so that we only
        need to do a single call to Bugzilla to modify the bug. These
        modifications are then made through the bug manager.

        Bug updates are expected to take the following form:
        {
            "bug-id": {
                "see-also": "value-to-add",
                "keyword": "value-to-add2",
                ...
            },
            "bug-id2": {
                ...
            },
            ...
        }

        Warnings will be raised when a bug field that can only take a single value
        is modified multiple times, or when an unknown field is modified by
        multiple modifiers. The merge will continue but it will ignore the additional
        change to ensure that other bug modifications can still be made.
        """
        all_changes = {}
        for modifier in TelemetryBugModifier.get_modifiers():
            changes = modifier.modify(alerts, commented_bugs, new_bugs, **kwargs)
            if not changes:
                continue
            for bug, bug_changes in changes.items():
                all_changes.setdefault(bug, []).append(bug_changes)
        return TelemetryBugModifier._merge_changes(all_changes)

    @staticmethod
    def _merge_changes(all_changes):
        """Merges all the changes that will be made by modifiers.

        Some fields can be combined, however, not some can only contain
        a single value so they will not be allowed to be modified by
        multiple modifiers (e.g. priority, serverity).
        """

        def __merge_change(field, value, existing_value):
            if field in ("priority", "severity"):
                if value != existing_value:
                    logger.warning(
                        f"Bug modification in `{field}` from multiple Modifiers is not"
                        f"allowed. Values found: {value}, and {existing_value}"
                    )
                return existing_value
            elif field in ("comment",):
                logger.warning("Cannot post multiple comments to a bug.")
                return existing_value
            elif field in (
                "see_also",
                "keywords",
                "whiteboard",
            ):
                existing_value["add"].extend(value["add"])
                return existing_value
            logger.warning(f"Unable to consolidate field `{field}` with multiple values.")

        merged_changes = {}

        for bug, changes in all_changes.items():
            bug_changes = merged_changes.setdefault(bug, {})
            for change in changes:
                for field, value in change.items():
                    if field not in bug_changes:
                        bug_changes[field] = value
                        continue
                    merged_value = __merge_change(field, value, bug_changes[field])
                    if merged_value is not None:
                        bug_changes[field] = merged_value

        return merged_changes


@TelemetryBugModifier.add
class SeeAlsoModifier:
    @staticmethod
    def modify(alerts, commented_bugs, new_bugs, **kwargs):
        """Get modifications to make to the See Also field in the various bugs.

        :return dict: Returns a dict containing a mapping of bug to a list of
                      changes for that bug.
        """
        changes = {}

        # Get all bugs that are associated with this alert summary (excluding new bugs)
        for alert in alerts:
            alert_bug = alert.telemetry_alert.bug_number

            # Get all the related bugs, excluding those we've already done since we don't
            # want to duplicate the see_also changes
            related_bugs = [
                related_alert.bug_number
                for related_alert in alert.get_related_alerts()
                if related_alert.bug_number is not None and related_alert.bug_number not in changes
            ]

            if related_bugs:
                changes[alert_bug] = {"see_also": {"add": [bug for bug in related_bugs]}}

        return changes
