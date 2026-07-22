"""LiveKit adapter seam owned by Person B.

The adapter is intentionally lazy-imported so text-mode development does not
require voice packages or credentials. Install with `uv add
"livekit-agents[langchain]~=1.5"` when enabling a LiveKit worker.
"""

from typing import Any


def create_livekit_adapter(compiled_graph: Any) -> Any:
    """Wrap a compiled, voice-capable graph in LiveKit's official LLMAdapter.

    Both `messages` and `custom` modes are enabled: normal assistant text can
    reach TTS immediately while a future proactive node can use
    `langgraph.config.get_stream_writer()` to emit a nudge without pretending it
    is model-token output.
    """
    try:
        from livekit.plugins import langchain
    except ImportError as error:
        raise RuntimeError(
            "LiveKit voice support is optional. Run: uv add "
            '\"livekit-agents[langchain]~=1.5\"'
        ) from error

    return langchain.LLMAdapter(
        graph=compiled_graph,
        stream_mode=["messages", "custom"],
    )
