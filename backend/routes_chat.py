import os
import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from ratelimit import limit_by_ip

from db import db
from models import ChatIn, ChatMessage, now_iso

router = APIRouter(prefix="/chat", tags=["chat"])

# Aria talks to Anthropic directly. Set ANTHROPIC_API_KEY in backend/.env to enable.
# Without a key the endpoint returns a friendly "not configured" notice so the site
# still runs end-to-end (e.g. local browsing).
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
CHAT_MODEL = os.environ.get("CHAT_MODEL", "claude-sonnet-4-5-20250929")
MAX_TOKENS = int(os.environ.get("CHAT_MAX_TOKENS", "1024"))

def _build_system_prompt() -> str:
    """Built from the published catalogue, so Aria can never describe services
    or prices that differ from the Services page. (The previous hardcoded
    prompt still listed the retired placeholder services.)"""
    from content.catalogue import SERVICES, PRICING_NOTE

    lines = "\n".join(
        f"- {s['name']} — {s['price_label']} ({s['duration']}): {s['short_description']}"
        for s in SERVICES
    )
    return f"""You are Aria, the website assistant for Synferrous — the business analysis, e-commerce and AI practice of Rohan Kapoor, based in Delhi NCR, India. Synferrous is one person: Rohan scopes and delivers every engagement himself.

Services and starting prices (these are the only services offered — do not invent others):
{lines}

{PRICING_NOTE}

Rohan's background (only claim what is listed here): techno-functional business analyst; requirements and order-management work on Salesforce Commerce Cloud programmes for 7+ enterprise clients while at Solveda; designed, built and launched a live e-commerce store with Razorpay payments for a publisher; GA4/GTM tracking and technical SEO; builds AI assistants.

How to help:
- Answer questions about the services above, quoting the starting price exactly as written.
- Point people to /services for details, /about for Rohan's background, and /contact to start a conversation.
- For anything needing a firm quote, timeline or scope, say Rohan replies personally within one business day via the Contact page.
- Never promise discounts, delivery dates, guarantees or results. Never claim a team, seniority or clients beyond those listed.
- If you don't know, say so and suggest the Contact page.

Tone: clear, friendly, concise — 2 to 4 short sentences."""


SYSTEM_PROMPT = _build_system_prompt()


def _build_history(docs):
    """Turn stored chat docs into a clean, alternating Anthropic message list."""
    msgs = []
    for d in docs:
        role = d.get("role")
        content = (d.get("content") or "").strip()
        if role not in ("user", "assistant") or not content:
            continue
        if msgs and msgs[-1]["role"] == role:
            msgs[-1]["content"] += "\n\n" + content
        else:
            msgs.append({"role": role, "content": content})
    # Anthropic requires the conversation to start with a user turn.
    while msgs and msgs[0]["role"] != "user":
        msgs.pop(0)
    return msgs


# Every message is a paid model call. 20 per 10 minutes per IP is generous for
# a real visitor and caps what a script can spend on your Anthropic account.
@router.post("/stream", dependencies=[Depends(limit_by_ip("chat", 20, 600))])
async def chat_stream(payload: ChatIn):
    if len(payload.message or "") > 4000:
        raise HTTPException(status_code=400, detail="Message is too long")
    session_id = payload.session_id or str(uuid.uuid4())

    # persist user message
    user_msg = ChatMessage(session_id=session_id, role="user", content=payload.message)
    await db.chat_messages.insert_one(user_msg.model_dump())

    async def event_generator():
        # emit session id once
        yield f"event: session\ndata: {session_id}\n\n"

        # Graceful degradation: no key configured -> friendly notice, site still works.
        if not ANTHROPIC_API_KEY:
            # Visitor-facing — never expose setup instructions. (The widget hides
            # itself when chat_enabled is false, so this is only a fallback.)
            notice = "The assistant is offline right now. Please use the Contact page — Rohan replies personally within one business day."
            yield f"event: delta\ndata: {notice}\n\n"
            yield "event: done\ndata: [DONE]\n\n"
            return

        # Pull recent conversation for context (includes the message just stored).
        docs = await db.chat_messages.find(
            {"session_id": session_id}, {"_id": 0, "role": 1, "content": 1, "created_at": 1}
        ).sort("created_at", 1).to_list(40)
        messages = _build_history(docs)

        full_text = ""
        try:
            # Lazy import so a missing package never blocks server startup.
            from anthropic import AsyncAnthropic

            client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
            async with client.messages.stream(
                model=CHAT_MODEL,
                max_tokens=MAX_TOKENS,
                system=SYSTEM_PROMPT,
                messages=messages,
            ) as stream:
                async for text in stream.text_stream:
                    full_text += text
                    safe = text.replace("\n", "\\n")
                    yield f"event: delta\ndata: {safe}\n\n"

            # save assistant message
            asst_msg = ChatMessage(session_id=session_id, role="assistant", content=full_text)
            await db.chat_messages.insert_one(asst_msg.model_dump())
            yield "event: done\ndata: [DONE]\n\n"
        except Exception as e:
            yield f"event: error\ndata: {str(e)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/history/{session_id}")
async def chat_history(session_id: str):
    docs = await db.chat_messages.find(
        {"session_id": session_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    return docs
