import asyncio

import pytest

from research import solari


def test_normalize_urls_keeps_unique_http_and_caps():
    urls = [
        "https://example.com/a",
        "https://example.com/a",
        "ftp://example.com/file",
        "not a url",
        *[f"https://example.com/{i}" for i in range(10)],
    ]
    cleaned = solari.normalize_urls(urls)
    assert cleaned[0] == "https://example.com/a"
    assert len(cleaned) == solari.MAX_URLS
    assert all(url.startswith("https://") for url in cleaned)


def test_claims_from_page_text_prioritizes_numbers_and_stays_pending():
    text = (
        "Welcome to the pension plan newsroom.\n"
        "The board approved a $2.1 million reduction in private equity allocation this year.\n"
        "Trustees flagged concern that distributions lagged expectations across the portfolio.\n"
        "Contact us for more information about our programs."
    )
    claims = solari.claims_from_page_text(text, "solari-1")
    assert claims, "expected at least one claim"
    assert claims[0]["relevance"] == "number"
    assert all(claim["decision"] == "pending" for claim in claims)
    assert all(claim["confidence"] != "high" for claim in claims)
    assert all(claim["source_ids"] == ["solari-1"] for claim in claims)


def test_claims_from_page_text_caps_per_page():
    text = "\n".join(
        f"The fund committed ${i} million to the new strategy in Q{i % 4 + 1}."
        for i in range(20)
    )
    assert (
        len(solari.claims_from_page_text(text, "solari-1"))
        == solari.MAX_CLAIMS_PER_PAGE
    )


def test_session_id_validation():
    assert solari.valid_session_id("sess_abc123")
    assert not solari.valid_session_id("../etc/passwd")
    assert not solari.valid_session_id("x")


def test_research_requires_api_key(monkeypatch):
    monkeypatch.delenv("SOLARI_API_KEY", raising=False)
    assert solari.is_configured() is False
    with pytest.raises(solari.ResearchUnavailable):
        asyncio.run(solari.research_public_pages(["https://example.com"]))
