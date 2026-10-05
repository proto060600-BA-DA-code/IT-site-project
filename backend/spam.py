"""Lead spam scoring.

Score, don't drop: anything at or over SPAM_THRESHOLD is stored with status
"spam" and no notification email is sent, but it stays reviewable in the admin
so a false positive costs nothing worse than a delayed reply.
"""
import re
import time
from typing import List, Tuple

SPAM_THRESHOLD = 50
MIN_FILL_SECONDS = 3  # a person cannot read and complete the form faster

_URL = re.compile(r"https?://|www\.", re.I)
_SPAM_WORDS = re.compile(
    r"\b(seo services|backlinks?|crypto|casino|viagra|loan offer|guest post|"
    r"rank (your|on) google|web traffic|forex)\b",
    re.I,
)


def score_lead(payload) -> Tuple[int, List[str]]:
    score, reasons = 0, []

    if (payload.website or "").strip():
        score += 100
        reasons.append("honeypot field filled")

    if payload.form_started_at:
        elapsed = time.time() - (payload.form_started_at / 1000)
        if 0 <= elapsed < MIN_FILL_SECONDS:
            score += 60
            reasons.append(f"submitted {elapsed:.1f}s after the form loaded")
        elif elapsed < 0 or elapsed > 86400 * 2:
            # Clock skew or a replayed payload — mildly suspicious only.
            score += 10
            reasons.append("implausible form timestamp")
    else:
        score += 15
        reasons.append("no form timestamp (not submitted from the site)")

    text = f"{payload.message or ''} {payload.company or ''}"
    links = len(_URL.findall(text))
    if links > 2:
        score += 20 * (links - 2)
        reasons.append(f"{links} links in the message")

    if _SPAM_WORDS.search(text):
        score += 40
        reasons.append("contains common spam phrases")

    name = (payload.name or "").strip()
    if _URL.search(name):
        score += 60
        reasons.append("URL in the name field")

    return score, reasons
