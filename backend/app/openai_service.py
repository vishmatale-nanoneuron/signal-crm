"""Signal CRM — OpenAI GPT-4o-mini Integration

Provides:
  - analyze_signal()    — why this signal matters + urgency score
  - suggest_action()    — specific next steps for the sales rep
  - draft_email()       — compliant cold outreach email draft
  - score_deal()        — probability score for a deal
"""
import json
import os
from typing import Optional
from app.config import get_settings

# ---------------------------------------------------------------------------
# Rule-based fallback (when OpenAI key not set)
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

We work with {industry} companies scaling into {country}, specifically helping with [your offering].

Would it be worth a 15-minute call this week? I can share what's working for similar companies entering {country}.

Best,
[Your Name]
[Your Company]""",

    "new_country_page": """\
Subject: {company}'s {country} launch — one thing to know

Hi {{name}},

I saw {company} just launched a {country}-specific page. Exciting step.

Companies entering {country} often encounter [specific challenge]. We've helped [similar company] navigate this and achieve [outcome].

Would you be open to a quick call to share what we've learned?

Best,
[Your Name]""",

    "new_product": """\
Subject: {product} launch — partnership opportunity?

Hi {{name}},

Congratulations on launching {product}. It looks like a strong addition to your lineup.

We specialize in [implementation/integration] for {industry} products in [your markets]. We'd love to explore being your local partner.

Can we jump on a 15-minute call this week?

Best,
[Your Name]""",
}


def _rule_based_analysis(signal: dict) -> dict:
    """Generate analysis without OpenAI (rule-based fallback)."""
    stype = signal.get("signal_type", "")
    insight = _SIGNAL_INSIGHTS.get(stype, {
        "why": "This change indicates an active buying signal — the company is investing in growth.",
        "urgency": "MEDIUM — Act within 2 weeks for best response rates.",
        "action_template": "Reach out with a personalized message referencing this specific change.",
    })

    country = signal.get("country_hint", "this market")
    company = signal.get("account_name", "this company")
    industry = "technology"

    email_tmpl = _EMAIL_TEMPLATES.get(stype, _EMAIL_TEMPLATES.get("new_country_page", ""))
    email_draft = email_tmpl.format(
        country=country,
        company=company,
        industry=industry,
        product=signal.get("title", "new product"),
    )

    return {
        "why_important": insight["why"],
        "urgency": insight["urgency"],
        "suggested_action": insight["action_template"].format(country=country),
        "email_draft": email_draft,
        "ai_score": signal.get("score", 7),
        "source": "rule-based",
    }


# ---------------------------------------------------------------------------
# OpenAI-powered analysis
# ---------------------------------------------------------------------------

async def analyze_signal(signal: dict) -> dict:
    """Analyze a signal using OpenAI GPT-4o-mini. Falls back to rules if key not set."""
    settings = get_settings()
    api_key = settings.OPENAI_API_KEY or os.environ.get("OPENAI_API_KEY", "")

    if not api_key:
        return _rule_based_analysis(signal)

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)

        system_prompt = """You are a B2B sales intelligence expert helping Indian exporters, IT services firms, and SaaS agencies identify and act on expansion signals from global companies.

Your job: analyze a web signal and return actionable sales intelligence.

Return a JSON object with these exact keys:
- why_important: (2-3 sentences) why this signal matters for a B2B sales rep
- urgency: one of HIGH/MEDIUM/LOW with a brief reason
- suggested_action: specific next step (who to contact, what to say, what to offer)
- email_draft: a short cold outreach email (subject line + 4-5 sentence body)
- ai_score: integer 1-10 indicating signal strength for B2B sales"""

        user_prompt = f"""Signal data:
Company: {signal.get('account_name', 'Unknown')}
Signal type: {signal.get('signal_type', 'unknown')}
Title: {signal.get('title', '')}
Summary: {signal.get('summary', '')}
Country: {signal.get('country_hint', 'unknown')}
Proof: {signal.get('proof_text', '')}
Current recommendation: {signal.get('recommended_action', '')}

Analyze this for a B2B sales rep targeting exporters, IT services, and SaaS companies."""

        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            max_tokens=600,
            temperature=0.4,
        )

        result = json.loads(resp.choices[0].message.content)
        result["source"] = "gpt-4o-mini"
        return result

    except Exception as e:
        # Fallback silently
        result = _rule_based_analysis(signal)
        result["source"] = "rule-based-fallback"
        return result


async def draft_outreach_email(
    signal: dict,
    sender_name: str = "[Your Name]",
    sender_company: str = "[Your Company]",
    offering: str = "cross-border IT services",
) -> str:
    """Generate a personalized cold outreach email based on a signal."""
    settings = get_settings()
    api_key = settings.OPENAI_API_KEY or os.environ.get("OPENAI_API_KEY", "")

    company = signal.get("account_name", "your company")
    country = signal.get("country_hint", "new markets")
    stype = signal.get("signal_type", "")

    if not api_key:
        tmpl = _EMAIL_TEMPLATES.get(stype, _EMAIL_TEMPLATES.get("new_country_page", ""))
        return tmpl.format(
            country=country, company=company,
            industry="technology", product=signal.get("title", "new product")
        ).replace("[Your Name]", sender_name).replace("[Your Company]", sender_company)

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)

        prompt = f"""Write a short, personalized cold outreach email from {sender_name} at {sender_company}.

Context:
- Target company: {company}
- Signal: {signal.get('title', '')}
- Signal type: {stype}
- Target country: {country}
- Our offering: {offering}
- Signal proof: {signal.get('proof_text', '')}

Requirements:
- Professional but warm
- Reference the specific signal naturally (don't say "I saw your signal")
- Clear value proposition related to {country} expansion or the signal
- CTA: request a 15-minute call
- 4-5 sentences max in body
- Include: Subject line on first line, then blank line, then body
- GDPR/CAN-SPAM compliant: include opt-out note at end"""

        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.5,
        )

        return resp.choices[0].message.content

    except Exception:
        tmpl = _EMAIL_TEMPLATES.get(stype, _EMAIL_TEMPLATES.get("new_country_page", ""))
        return tmpl.format(
            country=country, company=company,
            industry="technology", product=signal.get("title", "new product")
        ).replace("[Your Name]", sender_name).replace("[Your Company]", sender_company)
