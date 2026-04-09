"""Signal CRM — AI Service
Primary: Claude claude-sonnet-4-6 (Anthropic)
Fallback: GPT-4o-mini (OpenAI)
Fallback: Rule-based (no API key)

Provides:
  - analyze_signal()       — why this signal matters + urgency + email draft
  - draft_outreach_email() — personalized cold outreach email
"""
import json
import os
from app.config import get_settings

# ---------------------------------------------------------------------------
# Rule-based fallback
# ---------------------------------------------------------------------------

_SIGNAL_INSIGHTS = {
    "hiring_spike": {
        "why": "Hiring surges are one of the strongest buying intent signals. Companies that hire aggressively in a new market simultaneously need CRM, compliance, payroll, legal, and local partnerships. They have budget allocated and decisions to make fast.",
        "urgency": "HIGH — Hiring windows are 60–90 days. First-mover advantage is significant.",
        "action_template": "Email the VP Sales or Head of HR this week. Lead with market-specific insights. Mention you saw their {country} expansion.",
    },
    "new_country_page": {
        "why": "A country page signals a company has committed budget and resources to enter that market. They need local compliance, banking, distribution, or tech integration.",
        "urgency": "HIGH — They are already spending money. Decision window is open now.",
        "action_template": "Connect with the expansion lead. Lead with local regulatory requirements and partner network.",
    },
    "new_product": {
        "why": "New products require implementation partners, integration specialists, and channel resellers. Companies launching in new markets need local experts immediately.",
        "urgency": "MEDIUM — Best to connect within 30 days of launch.",
        "action_template": "Position yourself as the first local implementation partner. Offer a case study or pilot.",
    },
    "pricing_change": {
        "why": "Price increases create dissatisfied customers actively looking for alternatives. Price decreases signal competitive pressure and urgency to close deals fast.",
        "urgency": "HIGH — Affected customers are evaluating alternatives right now.",
        "action_template": "Reach out to their existing customer base with a competitive comparison.",
    },
    "leadership_change": {
        "why": "New leaders spend in their first 90 days establishing priorities. They bring their own vendor preferences and are open to new relationships.",
        "urgency": "HIGH — The first 90-day window is when decisions get made.",
        "action_template": "Congratulate the new leader and request an introductory call. Arrive with insights, not a pitch.",
    },
    "compliance_update": {
        "why": "Regulatory changes force companies to find new compliant vendors. Non-compliance creates risk and urgency.",
        "urgency": "HIGH — Compliance deadlines create hard action windows.",
        "action_template": "Lead with compliance expertise. Offer a free compliance briefing.",
    },
}

_EMAIL_TEMPLATES = {
    "hiring_spike": """\
Subject: Your {country} expansion — how we can help

Hi {{name}},

I noticed {company} is building out a team in {country} — impressive move.

We work with {industry} companies scaling into {country}, helping with [your offering].

Would a 15-minute call this week work? I can share what's working for similar companies.

Best,
[Your Name] · [Your Company]
To unsubscribe, reply STOP.""",

    "new_country_page": """\
Subject: {company}'s {country} launch — one thing to know

Hi {{name}},

I saw {company} just launched a {country}-specific page. Exciting step.

Companies entering {country} often encounter compliance and local integration challenges. We've helped similar companies navigate this.

Would you be open to a quick call to share what we've learned?

Best,
[Your Name]
To unsubscribe, reply STOP.""",

    "pricing_change": """\
Subject: Saw the {company} pricing update — timing a conversation

Hi {{name}},

I noticed {company} recently updated its pricing. Moments like these often prompt a fresh look at the stack.

We work with [industry] companies on [your offering] — and timing matters when evaluating alternatives.

Worth a 15-minute call this week?

Best,
[Your Name] · [Your Company]
To unsubscribe, reply STOP.""",
}

_SYSTEM_PROMPT = """You are a B2B sales intelligence expert helping Indian exporters, IT services firms, and SaaS agencies identify and act on expansion signals from global companies.

Your job: analyze a web signal and return actionable sales intelligence.

Return a JSON object with these exact keys:
- why_important: (2-3 sentences) why this signal matters for a B2B sales rep
- urgency: one of HIGH/MEDIUM/LOW with a brief reason
- suggested_action: specific next step (who to contact, what to say, what to offer)
- email_draft: a personalized cold outreach email (subject line + 4-5 sentence body + unsubscribe note)
- ai_score: integer 1-10 indicating signal strength for B2B sales"""


def _rule_based_analysis(signal: dict) -> dict:
    stype   = signal.get("signal_type", "")
    insight = _SIGNAL_INSIGHTS.get(stype, {
        "why": "This change indicates an active buying signal — the company is investing in growth.",
        "urgency": "MEDIUM — Act within 2 weeks for best response rates.",
        "action_template": "Reach out with a personalized message referencing this specific change.",
    })
    country = signal.get("country_hint", "this market")
    company = signal.get("account_name", "this company")
    tmpl    = _EMAIL_TEMPLATES.get(stype, _EMAIL_TEMPLATES.get("new_country_page", ""))
    email   = tmpl.format(country=country, company=company, industry="technology",
                          product=signal.get("title", "new product"))
    return {
        "why_important":    insight["why"],
        "urgency":          insight["urgency"],
        "suggested_action": insight["action_template"].format(country=country),
        "email_draft":      email,
        "ai_score":         signal.get("score", 7),
        "source":           "rule-based",
    }


def _signal_user_prompt(signal: dict) -> str:
    return f"""Signal data:
Company: {signal.get('account_name', 'Unknown')}
Signal type: {signal.get('signal_type', 'unknown')}
Title: {signal.get('title', '')}
Summary: {signal.get('summary', '')}
Country: {signal.get('country_hint', 'unknown')}
Proof: {signal.get('proof_text', '')}
Current recommendation: {signal.get('recommended_action', '')}

Analyze this for a B2B sales rep targeting Indian exporters, IT services, and SaaS companies."""


# ---------------------------------------------------------------------------
# Claude (Anthropic) — primary AI engine
# ---------------------------------------------------------------------------

async def _claude_analyze(signal: dict, api_key: str) -> dict:
    from anthropic import AsyncAnthropic
    client = AsyncAnthropic(api_key=api_key)

    msg = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=700,
        system=_SYSTEM_PROMPT + "\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no extra text.",
        messages=[{"role": "user", "content": _signal_user_prompt(signal)}],
    )
    text   = msg.content[0].text.strip()
    result = json.loads(text)
    result["source"] = "claude-sonnet-4-6"
    return result


async def _claude_draft_email(signal: dict, sender_name: str, sender_company: str, offering: str, api_key: str) -> str:
    from anthropic import AsyncAnthropic
    client = AsyncAnthropic(api_key=api_key)

    prompt = f"""Write a short, personalized cold outreach email from {sender_name} at {sender_company}.

Context:
- Target company: {signal.get('account_name', 'Unknown')}
- Signal: {signal.get('title', '')}
- Signal type: {signal.get('signal_type', '')}
- Target country: {signal.get('country_hint', 'global')}
- Our offering: {offering}
- Signal proof: {signal.get('proof_text', '')}

Requirements:
- Professional but warm
- Reference the signal naturally (don't say "I saw your signal")
- Clear value proposition related to their expansion or the signal
- CTA: request a 15-minute call
- 4-5 sentences max in body
- First line: Subject: ...
- GDPR/CAN-SPAM compliant: include opt-out note at end
- Return ONLY the email text, no explanations"""

    msg = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=350,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text.strip()


# ---------------------------------------------------------------------------
# OpenAI — secondary AI engine
# ---------------------------------------------------------------------------

async def _openai_analyze(signal: dict, api_key: str) -> dict:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key)

    resp = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": _signal_user_prompt(signal)},
        ],
        response_format={"type": "json_object"},
        max_tokens=600,
        temperature=0.4,
    )
    result = json.loads(resp.choices[0].message.content)
    result["source"] = "gpt-4o-mini"
    return result


async def _openai_draft_email(signal: dict, sender_name: str, sender_company: str, offering: str, api_key: str) -> str:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key)

    prompt = f"""Write a short personalized cold outreach email from {sender_name} at {sender_company}.
Target: {signal.get('account_name')} | Signal: {signal.get('title')} | Country: {signal.get('country_hint')} | Offering: {offering}
Proof: {signal.get('proof_text', '')}
Requirements: Professional, reference the signal naturally, clear CTA (15-min call), 4-5 sentences, Subject: on first line, opt-out note at end."""

    resp = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=300,
        temperature=0.5,
    )
    return resp.choices[0].message.content


# ---------------------------------------------------------------------------
# Public API — Claude primary → OpenAI fallback → Rule-based
# ---------------------------------------------------------------------------

async def analyze_signal(signal: dict) -> dict:
    """Analyze a signal. Claude → OpenAI → rule-based fallback."""
    settings     = get_settings()
    claude_key   = settings.ANTHROPIC_API_KEY or os.environ.get("ANTHROPIC_API_KEY", "")
    openai_key   = settings.OPENAI_API_KEY    or os.environ.get("OPENAI_API_KEY", "")

    # 1. Try Claude
    if claude_key:
        try:
            return await _claude_analyze(signal, claude_key)
        except Exception as e:
            print(f"[AI] Claude analyze failed: {type(e).__name__}: {e}")

    # 2. Try OpenAI
    if openai_key:
        try:
            return await _openai_analyze(signal, openai_key)
        except Exception as e:
            print(f"[AI] OpenAI analyze failed: {type(e).__name__}: {e}")

    # 3. Rule-based
    return _rule_based_analysis(signal)


async def draft_outreach_email(
    signal: dict,
    sender_name: str = "[Your Name]",
    sender_company: str = "[Your Company]",
    offering: str = "cross-border IT services",
) -> str:
    """Draft cold outreach email. Claude → OpenAI → rule-based fallback."""
    settings   = get_settings()
    claude_key = settings.ANTHROPIC_API_KEY or os.environ.get("ANTHROPIC_API_KEY", "")
    openai_key = settings.OPENAI_API_KEY    or os.environ.get("OPENAI_API_KEY", "")

    country = signal.get("country_hint", "new markets")
    company = signal.get("account_name", "your company")
    stype   = signal.get("signal_type", "")

    # 1. Try Claude
    if claude_key:
        try:
            return await _claude_draft_email(signal, sender_name, sender_company, offering, claude_key)
        except Exception as e:
            print(f"[AI] Claude email failed: {type(e).__name__}: {e}")

    # 2. Try OpenAI
    if openai_key:
        try:
            return await _openai_draft_email(signal, sender_name, sender_company, offering, openai_key)
        except Exception as e:
            print(f"[AI] OpenAI email failed: {type(e).__name__}: {e}")

    # 3. Rule-based template
    tmpl = _EMAIL_TEMPLATES.get(stype, _EMAIL_TEMPLATES.get("new_country_page", ""))
    return (
        tmpl.format(country=country, company=company, industry="technology",
                    product=signal.get("title", "new product"))
        .replace("[Your Name]", sender_name)
        .replace("[Your Company]", sender_company)
    )
