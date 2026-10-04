"""Bundled fallback content for demos without live AgentMail credentials.

The seed thread is the same artifact Dev B uses for the demo script — a
forwarded email chain between the user and their manager Dana ahead of a
compensation review. It is written so the deterministic extractor finds real
claims: numbers, a commitment, objections, and a timeline.
"""

SEED_DANA_MESSAGES = [
    {
        "message_id": "seed-1",
        "from": "Dana Whitfield <dana.whitfield@meridianlabs.com>",
        "subject": "Compensation review — Thursday 3pm",
        "timestamp": "Tue, Sep 29, 2026 at 4:12 PM",
        "text": "Confirming Thursday at 3pm for the compensation conversation you asked for. Come ready to walk through scope and impact — heads up that comp bands are tight this cycle and anything above band needs VP sign-off.",
    },
    {
        "message_id": "seed-2",
        "from": "you",
        "subject": "Compensation review — Thursday 3pm",
        "timestamp": "Tue, Sep 29, 2026 at 5:03 PM",
        "text": "Thanks Dana. I'll bring the launch metrics and the team-health dashboard. I'd like to discuss moving to $185,000 base and the senior title.",
    },
    {
        "message_id": "seed-3",
        "from": "Dana Whitfield <dana.whitfield@meridianlabs.com>",
        "subject": "Compensation review — Thursday 3pm",
        "timestamp": "Wed, Sep 30, 2026 at 9:41 AM",
        "text": "$185k is above the posted band for your level — I'll need a clear case on scope, not tenure. Also you still owe me the team-health metrics you promised after the last review in March; bring them Thursday.",
    },
    {
        "message_id": "seed-4",
        "from": "you",
        "subject": "Compensation review — Thursday 3pm",
        "timestamp": "Wed, Sep 30, 2026 at 10:15 AM",
        "text": "Understood — I'll have the metrics package ready. To be clear on scope: I now own the payments surface end-to-end and have been covering senior-level oncall since Priya left in July.",
    },
    {
        "message_id": "seed-5",
        "from": "Dana Whitfield <dana.whitfield@meridianlabs.com>",
        "subject": "Compensation review — Thursday 3pm",
        "timestamp": "Wed, Sep 30, 2026 at 11:02 AM",
        "text": "Fair points — scope is the right frame. One more thing: if comp can't move this cycle, are you open to discussing title and expanded scope instead? I may be able to move faster on title than on cash.",
    },
]

SEED_DANA_THREAD = """From: Dana Whitfield <dana.whitfield@meridianlabs.com>
Subject: Compensation review — Thursday 3pm
Date: Tue, Sep 29, 2026 at 4:12 PM

Confirming Thursday at 3pm for the compensation conversation you asked for.
Come ready to walk through scope and impact — heads up that comp bands are
tight this cycle and anything above band needs VP sign-off.

From: you
Date: Tue, Sep 29, 2026 at 5:03 PM

Thanks Dana. I'll bring the launch metrics and the team-health dashboard.
I'd like to discuss moving to $185,000 base and the senior title.

From: Dana Whitfield <dana.whitfield@meridianlabs.com>
Date: Wed, Sep 30, 2026 at 9:41 AM

$185k is above the posted band for your level — I'll need a clear case on
scope, not tenure. Also you still owe me the team-health metrics you promised
after the last review in March; bring them Thursday.

From: you
Date: Wed, Sep 30, 2026 at 10:15 AM

Understood — I'll have the metrics package ready. To be clear on scope: I
now own the payments surface end-to-end and have been covering senior-level
oncall since Priya left in July.

From: Dana Whitfield <dana.whitfield@meridianlabs.com>
Date: Wed, Sep 30, 2026 at 11:02 AM

Fair points — scope is the right frame. One more thing: if comp can't move
this cycle, are you open to discussing title and expanded scope instead?
I may be able to move faster on title than on cash.
"""
