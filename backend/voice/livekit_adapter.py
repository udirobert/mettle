"""LiveKit adapter seam owned by Person B.

Stretch goal: wrap the compiled graph with LiveKit's official LLMAdapter and
append STT turns to ConversationState. Proactive nudge candidates should be
sent through the adapter's custom stream writer, not fabricated as LLM tokens.
"""


def create_livekit_adapter():
    """TODO(Person B): implement after the text-only Wingman graph is stable."""
    raise NotImplementedError("LiveKit is intentionally additive to the text demo.")
