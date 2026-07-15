from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.utils import (
    get_glam_dashboard_link,
    get_treeherder_detection_link,
    get_treeherder_detection_range_link,
)


class TestGetGlamDashboardLink:
    def test_desktop_platform_windows(self, test_telemetry_signature):
        """Test GLAM dashboard link generation for Windows platform."""
        test_telemetry_signature.platform = "Windows"
        test_telemetry_signature.probe = "test_probe"

        link = get_glam_dashboard_link(test_telemetry_signature)

        assert link == (
            "https://glam.telemetry.mozilla.org/fog/probe/test_probe/explore"
            "?normalizationType=non_normalized&os=Windows"
        )

    def test_mobile_platform_fenix(self, test_telemetry_signature):
        """Test GLAM dashboard link generation for mobile (non-desktop) platform."""
        test_telemetry_signature.platform = "Android"
        test_telemetry_signature.probe = "mobile_probe"

        link = get_glam_dashboard_link(test_telemetry_signature)

        assert link == (
            "https://glam.telemetry.mozilla.org/fenix/probe/mobile_probe/explore"
            "?normalizationType=non_normalized&os=Android"
        )


class TestGetTreeherderDetectionLink:
    def test_nightly_channel(self, test_telemetry_signature):
        """Test Treeherder detection link for Nightly channel."""
        test_telemetry_signature.channel = "Nightly"
        detection_range = {"detection": type("obj", (object,), {"revision": "abcdef123456"})()}

        link = get_treeherder_detection_link(detection_range, test_telemetry_signature)

        assert (
            link == "https://treeherder.mozilla.org/jobs?repo=mozilla-central&revision=abcdef123456"
        )

    def test_unknown_channel_defaults_to_central(self, test_telemetry_signature):
        """Test Treeherder detection link defaults to mozilla-central for unknown channel."""
        test_telemetry_signature.channel = "UnknownChannel"
        detection_range = {"detection": type("obj", (object,), {"revision": "unknown123456"})()}

        link = get_treeherder_detection_link(detection_range, test_telemetry_signature)

        assert (
            link
            == "https://treeherder.mozilla.org/jobs?repo=mozilla-central&revision=unknown123456"
        )

    def test_with_long_revision(self, test_telemetry_signature):
        """Test Treeherder detection link with full-length revision hash."""
        test_telemetry_signature.channel = "Nightly"
        detection_range = {
            "detection": type(
                "obj", (object,), {"revision": "abcdef1234567890abcdef1234567890abcdef12"}
            )()
        }

        link = get_treeherder_detection_link(detection_range, test_telemetry_signature)

        assert (
            link
            == "https://treeherder.mozilla.org/jobs?repo=mozilla-central&revision=abcdef1234567890abcdef1234567890abcdef12"
        )


class TestGetTreeherderDetectionRangeLink:
    def test_release_channel_range(self, test_telemetry_signature):
        """Test Treeherder detection range link for Release channel."""
        test_telemetry_signature.channel = "Release"
        detection_range = {
            "from": type("obj", (object,), {"revision": "releaseFrom123"})(),
            "to": type("obj", (object,), {"revision": "releaseTo456"})(),
        }

        link = get_treeherder_detection_range_link(detection_range, test_telemetry_signature)

        assert (
            link
            == "https://treeherder.mozilla.org/jobs?repo=mozilla-release&fromchange=releaseFrom123&tochange=releaseTo456"
        )

    def test_with_full_length_revisions(self, test_telemetry_signature):
        """Test Treeherder detection range link with full-length revision hashes."""
        test_telemetry_signature.channel = "Nightly"
        detection_range = {
            "from": type(
                "obj", (object,), {"revision": "abcdef1234567890abcdef1234567890abcdef12"}
            )(),
            "to": type(
                "obj", (object,), {"revision": "fedcba0987654321fedcba0987654321fedcba98"}
            )(),
        }

        link = get_treeherder_detection_range_link(detection_range, test_telemetry_signature)

        assert (
            link
            == "https://treeherder.mozilla.org/jobs?repo=mozilla-central&fromchange=abcdef1234567890abcdef1234567890abcdef12&tochange=fedcba0987654321fedcba0987654321fedcba98"
        )
