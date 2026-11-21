import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from graph import whisper


class FitTests(unittest.TestCase):
    def test_short_text_passes_through(self):
        self.assertEqual(whisper._fit("Anchor at $185k.", 60), "Anchor at $185k.")

    def test_long_text_trims_at_word_boundary_with_ellipsis(self):
        out = whisper._fit(
            "She is steering you to title because title is cheap for her this cycle",
            60,
        )
        self.assertLessEqual(len(out), 60)
        self.assertTrue(out.endswith("…"))
        self.assertNotIn("  ", out)

    def test_whitespace_collapses(self):
        self.assertEqual(whisper._fit("  a   b\n c ", 60), "a b c")


class BuildCardTests(unittest.TestCase):
    def test_proactive_defaults(self):
        card = whisper.build_card("proactive", "msg")
        self.assertEqual(
            card,
            {"kind": "proactive", "headline": "msg", "ttl_ms": 8000},
        )

    def test_body_fits_to_80(self):
        card = whisper.build_card("reactive", "h", "x " * 60)
        self.assertLessEqual(len(card["body"]), 80)

    def test_unknown_kind_degrades_to_proactive(self):
        self.assertEqual(whisper.build_card("weird", "h")["kind"], "proactive")

    def test_phase_ttl(self):
        self.assertEqual(whisper.build_card("phase", "LIVE")["ttl_ms"], 3000)


class PublishTests(unittest.TestCase):
    def test_publish_nudge_posts_shaped_card(self):
        with patch.object(whisper, "publish_card") as pub:
            whisper.publish_nudge("You conceded twice.")
        pub.assert_called_once_with("proactive", "You conceded twice.")

    def test_reply_fits_headline_only(self):
        with patch.object(whisper, "publish_card") as pub:
            whisper.publish_reply("Short answer.")
        pub.assert_called_once_with("reactive", "Short answer.")

    def test_reply_splits_across_headline_and_body(self):
        long_reply = (
            "Acknowledge the band constraint and name the sign-off path, then ask "
            "her to take the above-band case upstairs with a dated review."
        )
        with patch.object(whisper, "publish_card") as pub:
            whisper.publish_reply(long_reply)
        kind, headline, body = pub.call_args[0]
        self.assertEqual(kind, "reactive")
        self.assertLessEqual(len(headline), 60)
        self.assertTrue(body)

    def test_post_failure_is_silent(self):
        with patch.object(
            whisper.urllib.request, "urlopen", side_effect=OSError("down")
        ):
            whisper._post({"card": {}})  # must not raise

    def test_post_uses_relay_env(self):
        captured = {}

        class FakeResp:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

        def fake_urlopen(req, timeout):
            captured["url"] = req.full_url
            captured["data"] = req.data
            return FakeResp()

        with patch.dict(os.environ, {whisper.RELAY_URL_ENV: "http://x:9/r/"}):
            with patch.object(whisper.urllib.request, "urlopen", fake_urlopen):
                whisper._post({"card": {"headline": "h"}})
        self.assertEqual(captured["url"], "http://x:9/r")


class EmitWiringTests(unittest.TestCase):
    def test_proactive_emit_publishes_nudge(self):
        from graph.wingman_proactive import ingest_transcript_turn

        with patch("graph.wingman_proactive.publish_nudge") as pub:
            update = ingest_transcript_turn(
                {"transcript": [], "nudges_sent": []},
                speaker="user",
                text="We can accept a $25M renewal.",
            )
        self.assertTrue(update["nudges_sent"])
        pub.assert_called_once_with(update["nudges_sent"][-1]["message"])

    def test_reactive_answer_publishes_reply(self):
        from graph.wingman_reactive import answer_reactive_query

        state = {
            "open_reactive_query": "what if she says next cycle",
            "counterpart_profile": {"name": "Dana", "concerns": ["band"]},
            "transcript": [],
        }
        with patch("graph.wingman_reactive.publish_reply") as pub:
            update = answer_reactive_query(state)
        pub.assert_called_once_with(update["reactive_reply"])


if __name__ == "__main__":
    unittest.main()
