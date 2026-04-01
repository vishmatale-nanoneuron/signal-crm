"""Signal CRM — Compliant Email Template Generator (rule-based, culture-aware)"""
from fastapi import APIRouter, Query
from app.compliance import COMPLIANCE_DATA
from app.buyer_map import BUYER_MAP
from app.country_intel import COUNTRY_META

email_router = APIRouter(prefix="/email-templates", tags=["Email Templates"])

REGION_STYLE = {
    "USA": "direct",         "Canada": "direct",      "Australia": "direct",
    "UK":  "direct",         "New Zealand": "direct", "Israel": "direct",
    "Germany":    "formal",  "France":    "formal",   "Netherlands": "formal",
    "Sweden":     "formal",  "Denmark":   "formal",   "Norway":      "formal",
    "Finland":    "formal",  "Switzerland":"formal",  "Belgium":     "formal",
    "Spain":      "formal",  "Italy":     "formal",   "Poland":      "formal",
    "Portugal":   "formal",  "Czech Republic":"formal","Romania":    "formal",
    "Japan":      "relation","South Korea":"relation", "China":      "relation",
    "Indonesia":  "relation","Thailand":  "relation",  "Vietnam":    "relation",
    "Philippines":"relation","Malaysia":  "relation",  "India":      "relation",
    "Singapore":  "relation","Taiwan":    "relation",  "Hong Kong":  "relation",
    "Brazil":     "relation","Mexico":    "relation",  "Argentina":  "relation",
    "UAE":        "arabic",  "Saudi Arabia":"arabic",  "Qatar":      "arabic",
    "Kuwait":     "arabic",  "Bahrain":   "arabic",    "Oman":       "arabic",
    "Morocco":    "arabic",
}

OPENERS = {
    "direct":   "I'll keep this short — I noticed {company_signal} and wanted to reach out.",
    "formal":   "I am writing to you regarding a solution that may be of considerable value to your organisation.",
    "relation": "I hope this message finds you well. I recently came across your work at {company} and was genuinely impressed.",
    "arabic":   "I hope this message finds you and your team in good health and prosperity.",
}

FOLLOW_UP = {
    "very fast": "Follow up in 1-2 days. Israelis expect fast replies — be direct.",
    "fast":      "Follow up in 2-3 days if no reply. Max 3 touchpoints.",
    "medium":    "Follow up in 5-7 days. Max 3-4 touchpoints over 3 weeks.",
    "slow":      "Wait 10-14 days before following up. Relationship matters more than speed.",
    "very slow": "Wait 2-3 weeks. Consider referral or partner introduction — cold outreach rarely works alone.",
}


def _generate(country: str, industry: str, offering: str, sender_name: str, sender_company: str) -> dict:
    comp   = COMPLIANCE_DATA.get(country, {})
    meta   = COUNTRY_META.get(country, {})
    buyer  = BUYER_MAP.get(industry, {}).get(country, {})
    style  = REGION_STYLE.get(country, "direct")

    greeting     = meta.get("greeting", "Dear [First Name]")
    best_contact = meta.get("best_contact", "Monday–Friday 9am–5pm local time")
    language     = meta.get("language", "English")
    speed        = meta.get("decision_speed", "medium")
    currency     = meta.get("currency", "USD")

    primary_buyer = buyer.get("primary_buyer", "Decision Maker")
    deal_cycle    = buyer.get("typical_deal_cycle", 60)
    buyer_notes   = buyer.get("notes", "")

    opener = OPENERS[style].format(
        company=f"[{country} company]",
        company_signal="you are expanding / hiring in this market",
    )

    # 3 subject line variants
    subjects = [
        f"Quick question about {offering} for {country}",
        f"How {industry} teams in {country} use {offering}",
        f"{primary_buyer} at [Company] — 3-minute read",
    ]

    # Email body
    body = f"""{greeting.replace('[First Name]','[Name]').replace('[Last Name]','[Name]')},

{opener}

I'm {sender_name} from {sender_company}. We help {industry} companies with {offering}.

I noticed [Company] is [specific trigger — e.g., hiring 20 engineers in {country}, launching a new market]. That's exactly when teams like yours evaluate tools to [specific pain point your product solves].

One result we delivered: "[Client type] in {country} reduced [metric] by [X%] in [timeframe]."

Worth a 20-minute call? I'm available {best_contact}.

{sender_name}
{sender_company}

P.S. If you're not the right person, who should I speak with about {offering}?"""

    # Compliance guidance
    cold_ok  = comp.get("cold_email_allowed", True)
    opt_in   = comp.get("opt_in_required", False)
    risk     = comp.get("risk_level", "low")
    framework = comp.get("framework", "")
    penalty  = comp.get("penalty", "")
    key_rules = comp.get("key_rules", [])

    warnings = []
    if not cold_ok:
        warnings.append({"type": "error", "text": f"⚠ Cold email may NOT be permitted in {country} ({framework}). You need explicit consent or documented legitimate interest."})
    if opt_in:
        warnings.append({"type": "error", "text": "⚠ Opt-in required before sending. Verify consent exists before outreach."})
    if risk == "high":
        warnings.append({"type": "warn", "text": f"🔴 High-risk jurisdiction. Penalty: {penalty}. Consult legal before mass outreach."})
    if key_rules:
        warnings.append({"type": "info", "text": f"📋 {key_rules[0]}"})
        if len(key_rules) > 1:
            warnings.append({"type": "info", "text": f"📋 {key_rules[1]}"})
    if cold_ok and not opt_in:
        warnings.append({"type": "success", "text": f"✓ Cold email is permitted in {country}. Always include an unsubscribe link."})

    cultural_tips = [
        f"🕐 Best send time: {best_contact}",
        f"🌍 Language: {language}" + (" — consider local-language follow-up" if language != "English" else ""),
        f"✉ Greeting style: {greeting}",
        f"⚡ Decision speed: {speed} — {FOLLOW_UP.get(speed, FOLLOW_UP['medium'])}",
        f"💼 Typical deal cycle in {country}: {deal_cycle} days",
    ]
    if buyer_notes:
        cultural_tips.append(f"💡 {buyer_notes[:200]}")

    return {
        "country":           country,
        "industry":          industry,
        "buyer_role":        primary_buyer,
        "language":          language,
        "currency":          currency,
        "subject_lines":     subjects,
        "email_body":        body,
        "greeting_style":    greeting,
        "cultural_tips":     cultural_tips,
        "compliance_status": "allowed" if cold_ok else "restricted",
        "compliance_warnings": warnings,
        "follow_up_cadence": FOLLOW_UP.get(speed, FOLLOW_UP["medium"]),
        "risk_level":        risk,
    }


@email_router.get("/generate")
def generate(
    country:        str = Query(...),
    industry:       str = Query(default="SaaS"),
    offering:       str = Query(default="cross-border CRM software"),
    sender_name:    str = Query(default="[Your Name]"),
    sender_company: str = Query(default="[Your Company]"),
):
    return {"success": True, "template": _generate(country, industry, offering, sender_name, sender_company)}


@email_router.get("/countries")
def list_countries():
    all_c = sorted(set(list(COMPLIANCE_DATA.keys()) + list(COUNTRY_META.keys())))
    return {"success": True, "countries": all_c, "total": len(all_c)}
