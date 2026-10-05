"""Context ingestion stack — AgentMail inbox, Exa research, normalization.

Invitation-based ingestion: the agent reads only mail addressed to its own
inbox, plus scoped public research. Every module degrades gracefully —
missing credentials or packages return None/empty, never raise.
"""
