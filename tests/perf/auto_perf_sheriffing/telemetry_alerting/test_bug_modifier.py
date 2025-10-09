import pytest

from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.bug_modifier import (
    TelemetryBugModifier,
)


class TestTelemetryBugModifier:
    def test_add_modifier(self):
        """Test adding a modifier to the modifiers list."""
        initial_count = len(TelemetryBugModifier.get_modifiers())

        class DummyModifier:
            pass

        TelemetryBugModifier.add(DummyModifier)

        assert len(TelemetryBugModifier.get_modifiers()) == initial_count + 1
        assert DummyModifier in TelemetryBugModifier.get_modifiers()

        # Clean up
        TelemetryBugModifier.modifiers.remove(DummyModifier)

    def test_get_modifiers(self):
        """Test getting the list of modifiers."""
        modifiers = TelemetryBugModifier.get_modifiers()
        assert isinstance(modifiers, list)
        # SeeAlsoModifier should be registered
        assert any(m.__name__ == "SeeAlsoModifier" for m in modifiers)

    def test_get_bug_modifications_empty(self):
        """Test get_bug_modifications when modifiers return no changes."""
        alerts = []
        commented_bugs = []
        new_bugs = []

        modifications = TelemetryBugModifier.get_bug_modifications(alerts, commented_bugs, new_bugs)

        assert modifications == {}

    def test_get_bug_modifications_with_data(
        self,
        test_telemetry_alert,
        test_telemetry_alert_summary,
        test_telemetry_signature,
        create_telemetry_signature,
        create_telemetry_alert,
    ):
        """Test get_bug_modifications with actual modifications from modifiers."""
        from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert import (
            TelemetryAlert,
        )

        # Create another alert with a bug number to trigger see_also modification
        sig2 = create_telemetry_signature(probe="test_probe2")
        create_telemetry_alert(
            sig2,
            bug_number=67890,
        )

        test_telemetry_alert.bug_number = 12345
        test_telemetry_alert.save()

        # Create TelemetryAlert objects
        telemetry_alert1 = TelemetryAlert(
            test_telemetry_alert, test_telemetry_alert_summary, test_telemetry_signature
        )

        alerts = [telemetry_alert1]
        modifications = TelemetryBugModifier.get_bug_modifications(alerts, [], [])

        # Should have modifications for the see_also field
        assert 12345 in modifications
        assert "see_also" in modifications[12345]

    def test_get_bug_modifications_with_two_modifiers_different_fields(
        self, test_telemetry_alert, test_telemetry_alert_summary, test_telemetry_signature
    ):
        """Test get_bug_modifications with two modifiers updating different fields for the same bug."""
        from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert import (
            TelemetryAlert,
        )

        class PriorityModifier:
            @staticmethod
            def modify(alerts, commented_bugs, new_bugs, **kwargs):
                return {12345: {"priority": "P1"}}

        class KeywordModifier:
            @staticmethod
            def modify(alerts, commented_bugs, new_bugs, **kwargs):
                return {12345: {"keywords": {"add": ["perf-regression"]}}}

        # Save original modifiers
        original_modifiers = TelemetryBugModifier.modifiers.copy()

        # Replace with our test modifiers
        TelemetryBugModifier.modifiers = [PriorityModifier, KeywordModifier]

        try:
            test_telemetry_alert.bug_number = 12345
            test_telemetry_alert.save()

            telemetry_alert = TelemetryAlert(
                test_telemetry_alert, test_telemetry_alert_summary, test_telemetry_signature
            )

            modifications = TelemetryBugModifier.get_bug_modifications([telemetry_alert], [], [])

            # Both modifiers should contribute their changes
            assert 12345 in modifications
            assert modifications[12345]["priority"] == "P1"
            assert modifications[12345]["keywords"] == {"add": ["perf-regression"]}
        finally:
            # Restore original modifiers
            TelemetryBugModifier.modifiers = original_modifiers

    def test_get_bug_modifications_with_two_modifiers_same_priority_field(
        self, test_telemetry_alert, test_telemetry_alert_summary, test_telemetry_signature, caplog
    ):
        """Test get_bug_modifications with two modifiers trying to update the priority field."""
        from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert import (
            TelemetryAlert,
        )

        class FirstPriorityModifier:
            @staticmethod
            def modify(alerts, commented_bugs, new_bugs, **kwargs):
                return {12345: {"priority": "P1"}}

        class SecondPriorityModifier:
            @staticmethod
            def modify(alerts, commented_bugs, new_bugs, **kwargs):
                return {12345: {"priority": "P2"}}

        # Save original modifiers
        original_modifiers = TelemetryBugModifier.modifiers.copy()

        # Replace with our test modifiers
        TelemetryBugModifier.modifiers = [FirstPriorityModifier, SecondPriorityModifier]

        try:
            test_telemetry_alert.bug_number = 12345
            test_telemetry_alert.save()

            telemetry_alert = TelemetryAlert(
                test_telemetry_alert, test_telemetry_alert_summary, test_telemetry_signature
            )

            modifications = TelemetryBugModifier.get_bug_modifications([telemetry_alert], [], [])

            # First modifier's value should win, second should be logged as warning
            assert 12345 in modifications
            assert modifications[12345]["priority"] == "P1"
            assert "Bug modification in `priority` from multiple Modifiers" in caplog.text
        finally:
            # Restore original modifiers
            TelemetryBugModifier.modifiers = original_modifiers

    def test_get_bug_modifications_with_two_modifiers_same_see_also_field(
        self, test_telemetry_alert, test_telemetry_alert_summary, test_telemetry_signature
    ):
        """Test get_bug_modifications with two modifiers both updating the see_also field."""
        from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert import (
            TelemetryAlert,
        )

        class FirstSeeAlsoModifier:
            @staticmethod
            def modify(alerts, commented_bugs, new_bugs, **kwargs):
                return {12345: {"see_also": {"add": [11111]}}}

        class SecondSeeAlsoModifier:
            @staticmethod
            def modify(alerts, commented_bugs, new_bugs, **kwargs):
                return {12345: {"see_also": {"add": [22222]}}}

        # Save original modifiers
        original_modifiers = TelemetryBugModifier.modifiers.copy()

        # Replace with our test modifiers
        TelemetryBugModifier.modifiers = [FirstSeeAlsoModifier, SecondSeeAlsoModifier]

        try:
            test_telemetry_alert.bug_number = 12345
            test_telemetry_alert.save()

            telemetry_alert = TelemetryAlert(
                test_telemetry_alert, test_telemetry_alert_summary, test_telemetry_signature
            )

            modifications = TelemetryBugModifier.get_bug_modifications([telemetry_alert], [], [])

            # Both modifiers should contribute their see_also changes
            assert 12345 in modifications
            assert "see_also" in modifications[12345]
            # Both values should be merged into the add list
            assert 11111 in modifications[12345]["see_also"]["add"]
            assert 22222 in modifications[12345]["see_also"]["add"]
        finally:
            # Restore original modifiers
            TelemetryBugModifier.modifiers = original_modifiers

    def test_get_bug_modifications_with_comment_conflict(
        self, test_telemetry_alert, test_telemetry_alert_summary, test_telemetry_signature, caplog
    ):
        """Test get_bug_modifications with two modifiers trying to add comments."""
        from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert import (
            TelemetryAlert,
        )

        class FirstCommentModifier:
            @staticmethod
            def modify(alerts, commented_bugs, new_bugs, **kwargs):
                return {12345: {"comment": "First comment"}}

        class SecondCommentModifier:
            @staticmethod
            def modify(alerts, commented_bugs, new_bugs, **kwargs):
                return {12345: {"comment": "Second comment"}}

        # Save original modifiers
        original_modifiers = TelemetryBugModifier.modifiers.copy()

        # Replace with our test modifiers
        TelemetryBugModifier.modifiers = [FirstCommentModifier, SecondCommentModifier]

        try:
            test_telemetry_alert.bug_number = 12345
            test_telemetry_alert.save()

            telemetry_alert = TelemetryAlert(
                test_telemetry_alert, test_telemetry_alert_summary, test_telemetry_signature
            )

            modifications = TelemetryBugModifier.get_bug_modifications([telemetry_alert], [], [])

            # Should log a warning about multiple comments, but first comment is kept
            assert "Cannot post multiple comments to a bug" in caplog.text
            assert 12345 in modifications
            assert modifications[12345]["comment"] == "First comment"
        finally:
            # Restore original modifiers
            TelemetryBugModifier.modifiers = original_modifiers

    def test_merge_changes_single_modifier(self):
        """Test merging changes from a single modifier."""
        all_changes = {12345: [{"priority": "P1"}], 67890: [{"priority": "P2"}]}

        merged = TelemetryBugModifier._merge_changes(all_changes)

        assert merged == {12345: {"priority": "P1"}, 67890: {"priority": "P2"}}

    def test_merge_changes_multiple_modifiers_no_conflict(self):
        """Test merging changes from multiple modifiers with no conflicts."""
        all_changes = {
            12345: [{"priority": "P1"}, {"keywords": {"add": ["perf"]}}],
            67890: [{"priority": "P2"}],
        }

        merged = TelemetryBugModifier._merge_changes(all_changes)

        assert merged == {
            12345: {"priority": "P1", "keywords": {"add": ["perf"]}},
            67890: {"priority": "P2"},
        }

    def test_merge_changes_with_priority_conflict(self, caplog):
        """Test merging changes when multiple modifiers try to modify the priority field."""
        all_changes = {12345: [{"priority": "P1"}, {"priority": "P2"}]}

        merged = TelemetryBugModifier._merge_changes(all_changes)

        # First update should be kept (P1), second triggers warning but keeps first value
        assert merged == {12345: {"priority": "P1"}}
        # Should log warning about different priority values
        assert (
            "Bug modification in `priority` from multiple Modifiers" in caplog.text
            or "Values found: P2, and P1" in caplog.text
        )

    def test_merge_changes_with_unknown_field(self, caplog):
        """Test merging changes with an unknown field."""
        all_changes = {12345: [{"unknown_field": "value1"}, {"unknown_field": "value2"}]}

        merged = TelemetryBugModifier._merge_changes(all_changes)

        # First value should be kept, second triggers warning
        assert merged == {12345: {"unknown_field": "value1"}}
        # Should log a warning about unknown field
        assert "Unable to consolidate field `unknown_field`" in caplog.text

    def test_merge_changes_empty(self):
        """Test merging with no changes."""
        all_changes = {}

        merged = TelemetryBugModifier._merge_changes(all_changes)

        assert merged == {}


class TestSeeAlsoModifier:
    @pytest.fixture
    def see_also_modifier_class(self):
        """Get the SeeAlsoModifier class from the modifiers list."""
        # Find SeeAlsoModifier in the modifiers list
        for modifier in TelemetryBugModifier.get_modifiers():
            if modifier.__name__ == "SeeAlsoModifier":
                return modifier
        pytest.fail("SeeAlsoModifier not found in modifiers list")

    def test_modify_no_alerts(self, see_also_modifier_class):
        """Test modify when no alerts are provided."""
        changes = see_also_modifier_class.modify([], [], [])

        assert changes == {}

    def test_modify_alert_with_no_bug_number(
        self,
        see_also_modifier_class,
        test_telemetry_alert,
        test_telemetry_alert_summary,
        test_telemetry_signature,
    ):
        """Test modify when alert has no bug number."""
        from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert import (
            TelemetryAlert,
        )

        telemetry_alert = TelemetryAlert(
            test_telemetry_alert, test_telemetry_alert_summary, test_telemetry_signature
        )

        changes = see_also_modifier_class.modify([telemetry_alert], [], [])

        assert changes == {}

    def test_modify_alert_with_no_related_bugs(
        self,
        see_also_modifier_class,
        test_telemetry_alert,
        test_telemetry_alert_summary,
        test_telemetry_signature,
        create_telemetry_signature,
        create_telemetry_alert,
    ):
        """Test modify when alert has a bug but no related alerts have bugs."""
        from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert import (
            TelemetryAlert,
        )

        test_telemetry_alert.bug_number = 12345
        test_telemetry_alert.save()

        # Create another alert in same summary but without bug number
        sig2 = create_telemetry_signature(probe="test_probe2")
        create_telemetry_alert(sig2)

        telemetry_alert = TelemetryAlert(
            test_telemetry_alert, test_telemetry_alert_summary, test_telemetry_signature
        )

        changes = see_also_modifier_class.modify([telemetry_alert], [], [])

        # No related bugs, so no see_also changes
        assert changes == {}

    def test_modify_alert_with_one_related_bug(
        self,
        see_also_modifier_class,
        test_telemetry_alert,
        test_telemetry_alert_summary,
        test_telemetry_signature,
        create_telemetry_signature,
        create_telemetry_alert,
    ):
        """Test modify when alert has one related alert with a bug."""
        from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert import (
            TelemetryAlert,
        )

        test_telemetry_alert.bug_number = 12345
        test_telemetry_alert.save()

        # Create another alert in same summary with a different bug number
        sig2 = create_telemetry_signature(probe="test_probe2")
        create_telemetry_alert(sig2, bug_number=67890)

        telemetry_alert = TelemetryAlert(
            test_telemetry_alert, test_telemetry_alert_summary, test_telemetry_signature
        )

        changes = see_also_modifier_class.modify([telemetry_alert], [], [])

        # Should add related bug to see_also
        assert 12345 in changes
        assert "see_also" in changes[12345]
        assert changes[12345]["see_also"]["add"] == [67890]

    def test_modify_alert_with_multiple_related_bugs(
        self,
        see_also_modifier_class,
        test_telemetry_alert,
        test_telemetry_alert_summary,
        test_telemetry_signature,
        create_telemetry_signature,
        create_telemetry_alert,
    ):
        """Test modify when alert has multiple related alerts with bugs."""
        from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert import (
            TelemetryAlert,
        )

        test_telemetry_alert.bug_number = 12345
        test_telemetry_alert.save()

        # Create two more alerts in same summary with different bug numbers
        sig2 = create_telemetry_signature(probe="test_probe2")
        create_telemetry_alert(sig2, bug_number=67890)

        sig3 = create_telemetry_signature(probe="test_probe3")
        create_telemetry_alert(sig3, bug_number=11111)

        telemetry_alert = TelemetryAlert(
            test_telemetry_alert, test_telemetry_alert_summary, test_telemetry_signature
        )

        changes = see_also_modifier_class.modify([telemetry_alert], [], [])

        # Should add all related bugs to see_also
        assert 12345 in changes
        assert "see_also" in changes[12345]
        assert sorted(changes[12345]["see_also"]["add"]) == sorted([67890, 11111])

    def test_modify_multiple_alerts_with_related_bugs(
        self,
        see_also_modifier_class,
        test_telemetry_alert,
        test_telemetry_alert_summary,
        test_telemetry_signature,
        create_telemetry_signature,
        create_telemetry_alert,
    ):
        """Test modify when multiple alerts are passed, each with related bugs."""
        from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert import (
            TelemetryAlert,
        )

        test_telemetry_alert.bug_number = 12345
        test_telemetry_alert.save()

        # Create another alert in same summary with a different bug number
        sig2 = create_telemetry_signature(probe="test_probe2")
        alert2 = create_telemetry_alert(sig2, bug_number=67890)

        telemetry_alert1 = TelemetryAlert(
            test_telemetry_alert, test_telemetry_alert_summary, test_telemetry_signature
        )
        telemetry_alert2 = TelemetryAlert(alert2, test_telemetry_alert_summary, sig2)

        changes = see_also_modifier_class.modify([telemetry_alert1, telemetry_alert2], [], [])

        # Due to the logic that excludes bugs already in changes, only the first alert
        # gets the second bug in see_also. The second alert doesn't get the first bug
        # because 12345 is already in the changes dict when processing alert2
        assert 12345 in changes
        assert changes[12345]["see_also"]["add"] == [67890]
        # Bug 67890 doesn't get an entry because 12345 was already processed
        assert 67890 not in changes

    def test_modify_excludes_already_processed_bugs(
        self,
        see_also_modifier_class,
        test_telemetry_alert,
        test_telemetry_alert_summary,
        test_telemetry_signature,
        create_telemetry_signature,
        create_telemetry_alert,
    ):
        """Test that modify excludes bugs that have already been processed."""
        from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert import (
            TelemetryAlert,
        )

        test_telemetry_alert.bug_number = 12345
        test_telemetry_alert.save()

        # Create two more alerts
        sig2 = create_telemetry_signature(probe="test_probe2")
        alert2 = create_telemetry_alert(sig2, bug_number=67890)

        sig3 = create_telemetry_signature(probe="test_probe3")
        alert3 = create_telemetry_alert(sig3, bug_number=11111)

        telemetry_alert1 = TelemetryAlert(
            test_telemetry_alert, test_telemetry_alert_summary, test_telemetry_signature
        )
        telemetry_alert2 = TelemetryAlert(alert2, test_telemetry_alert_summary, sig2)
        telemetry_alert3 = TelemetryAlert(alert3, test_telemetry_alert_summary, sig3)

        # Process alerts in order - each should only see bugs from later alerts
        changes = see_also_modifier_class.modify(
            [telemetry_alert1, telemetry_alert2, telemetry_alert3], [], []
        )

        # Alert 1 should see alerts 2 and 3
        assert 12345 in changes
        assert sorted(changes[12345]["see_also"]["add"]) == sorted([67890, 11111])

        # Alert 2 should see alerts 1 and 3, but 1 was already processed
        assert 67890 in changes
        assert changes[67890]["see_also"]["add"] == [11111]

        # Alert 3 should see alerts 1 and 2, but both were already processed
        assert 11111 not in changes
