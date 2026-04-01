"""Signal CRM — Country Intelligence: combines compliance + buyer map + culture tips"""
from fastapi import APIRouter, Query
from app.compliance import COMPLIANCE_DATA
from app.buyer_map import BUYER_MAP

country_intel_router = APIRouter(prefix="/country-intel", tags=["Country Intelligence"])

# Best time to contact (local business hours in UTC offset + working days note)
COUNTRY_META = {
    "USA":          {"tz": "UTC-5 to UTC-8", "best_contact": "Tue–Thu 10am–3pm local", "language": "English", "currency": "USD", "greeting": "Hi [First Name]", "decision_speed": "fast"},
    "Germany":      {"tz": "UTC+1/+2",        "best_contact": "Tue–Thu 9am–12pm CET",  "language": "German (English OK for tech)", "currency": "EUR", "greeting": "Sehr geehrte/r Herr/Frau [Last Name]", "decision_speed": "slow"},
    "UK":           {"tz": "UTC+0/+1",        "best_contact": "Mon–Thu 9am–4pm GMT",   "language": "English", "currency": "GBP", "greeting": "Dear [First Name]", "decision_speed": "fast"},
    "France":       {"tz": "UTC+1/+2",        "best_contact": "Tue–Thu 10am–12pm/2pm–5pm CET", "language": "French (required for mid-market)", "currency": "EUR", "greeting": "Madame/Monsieur [Last Name]", "decision_speed": "slow"},
    "India":        {"tz": "UTC+5:30",        "best_contact": "Mon–Fri 10am–6pm IST",  "language": "English + Hindi", "currency": "INR", "greeting": "Dear [First Name]", "decision_speed": "medium"},
    "UAE":          {"tz": "UTC+4",           "best_contact": "Sun–Thu 9am–5pm GST",   "language": "English (Arabic preferred for gov)", "currency": "AED", "greeting": "Dear [First Name]", "decision_speed": "fast (SME) / slow (gov)"},
    "Singapore":    {"tz": "UTC+8",           "best_contact": "Mon–Fri 9am–5pm SGT",   "language": "English", "currency": "SGD", "greeting": "Dear [First Name]", "decision_speed": "fast"},
    "Japan":        {"tz": "UTC+9",           "best_contact": "Tue–Thu 10am–12pm/2pm–4pm JST", "language": "Japanese (mandatory)", "currency": "JPY", "greeting": "田中様 ([Last Name]-sama)", "decision_speed": "very slow"},
    "Australia":    {"tz": "UTC+8 to UTC+11", "best_contact": "Mon–Thu 9am–4pm AEST",  "language": "English", "currency": "AUD", "greeting": "Hi [First Name]", "decision_speed": "fast"},
    "Canada":       {"tz": "UTC-3.5 to UTC-8","best_contact": "Tue–Thu 10am–3pm local","language": "English + French (Quebec)", "currency": "CAD", "greeting": "Hi [First Name]", "decision_speed": "medium"},
    "Brazil":       {"tz": "UTC-3",           "best_contact": "Tue–Thu 10am–12pm BRT", "language": "Portuguese (required)", "currency": "BRL", "greeting": "Prezado(a) [First Name]", "decision_speed": "medium"},
    "Netherlands":  {"tz": "UTC+1/+2",        "best_contact": "Mon–Thu 9am–5pm CET",   "language": "Dutch (English OK)", "currency": "EUR", "greeting": "Dear [First Name]", "decision_speed": "fast"},
    "Saudi Arabia": {"tz": "UTC+3",           "best_contact": "Sun–Thu 9am–5pm AST",   "language": "Arabic + English", "currency": "SAR", "greeting": "Dr./Eng. [Last Name]", "decision_speed": "slow"},
    "South Africa": {"tz": "UTC+2",           "best_contact": "Mon–Fri 9am–4pm SAST",  "language": "English", "currency": "ZAR", "greeting": "Dear [First Name]", "decision_speed": "medium"},
    "Malaysia":     {"tz": "UTC+8",           "best_contact": "Mon–Fri 9am–5pm MYT",   "language": "English + Bahasa", "currency": "MYR", "greeting": "Dear [First Name]", "decision_speed": "medium"},
    "Indonesia":    {"tz": "UTC+7 to UTC+9",  "best_contact": "Mon–Fri 9am–5pm WIB",   "language": "Bahasa Indonesia + English", "currency": "IDR", "greeting": "Bapak/Ibu [First Name]", "decision_speed": "medium"},
    "Vietnam":      {"tz": "UTC+7",           "best_contact": "Mon–Fri 8am–5pm ICT",   "language": "Vietnamese + English (tech)", "currency": "VND", "greeting": "Dear [First Name]", "decision_speed": "medium"},
    "Philippines":  {"tz": "UTC+8",           "best_contact": "Mon–Fri 9am–6pm PHT",   "language": "English", "currency": "PHP", "greeting": "Dear [First Name]", "decision_speed": "medium"},
    "Thailand":     {"tz": "UTC+7",           "best_contact": "Mon–Fri 9am–5pm ICT",   "language": "Thai + English (enterprise)", "currency": "THB", "greeting": "Khun [First Name]", "decision_speed": "slow"},
    "Mexico":       {"tz": "UTC-5 to UTC-7",  "best_contact": "Tue–Thu 10am–2pm/4pm–6pm local", "language": "Spanish (required)", "currency": "MXN", "greeting": "Estimado(a) [First Name]", "decision_speed": "medium"},
    "Argentina":    {"tz": "UTC-3",           "best_contact": "Mon–Fri 10am–6pm ART",  "language": "Spanish (required)", "currency": "ARS", "greeting": "Estimado(a) [First Name]", "decision_speed": "medium"},
    "Nigeria":      {"tz": "UTC+1",           "best_contact": "Mon–Fri 9am–5pm WAT",   "language": "English", "currency": "NGN", "greeting": "Dear [First Name]", "decision_speed": "medium"},
    "Kenya":        {"tz": "UTC+3",           "best_contact": "Mon–Fri 8am–5pm EAT",   "language": "English + Swahili", "currency": "KES", "greeting": "Dear [First Name]", "decision_speed": "medium"},
    "Poland":       {"tz": "UTC+1/+2",        "best_contact": "Mon–Thu 9am–4pm CET",   "language": "Polish + English (IT)", "currency": "PLN", "greeting": "Szanowny/a Panie/Pani [Last Name]", "decision_speed": "medium"},
    "Sweden":       {"tz": "UTC+1/+2",        "best_contact": "Mon–Thu 8am–4pm CET",   "language": "Swedish (English native in tech)", "currency": "SEK", "greeting": "Hej [First Name]", "decision_speed": "fast"},
    "Spain":        {"tz": "UTC+1/+2",        "best_contact": "Tue–Thu 9am–2pm/4pm–7pm CET", "language": "Spanish (required)", "currency": "EUR", "greeting": "Estimado/a Sr./Sra. [Last Name]", "decision_speed": "slow"},
    "Italy":        {"tz": "UTC+1/+2",        "best_contact": "Tue–Thu 9am–1pm/3pm–6pm CET", "language": "Italian (required for mid-market)", "currency": "EUR", "greeting": "Gentile Sig./Sig.ra [Last Name]", "decision_speed": "slow"},
    "Israel":       {"tz": "UTC+2/+3",        "best_contact": "Sun–Thu 9am–5pm IST",   "language": "English + Hebrew", "currency": "ILS", "greeting": "Hi [First Name]", "decision_speed": "very fast"},
    "South Korea":  {"tz": "UTC+9",           "best_contact": "Mon–Fri 9am–5pm KST",   "language": "Korean (mandatory for non-tech)", "currency": "KRW", "greeting": "[Last Name]-님 (nim)", "decision_speed": "medium"},
    "Turkey":       {"tz": "UTC+3",           "best_contact": "Mon–Fri 9am–6pm TRT",   "language": "Turkish + English (enterprise)", "currency": "TRY", "greeting": "Sayın [Last Name]", "decision_speed": "medium"},
    "Egypt":        {"tz": "UTC+2/+3",        "best_contact": "Sun–Thu 9am–4pm EET",   "language": "Arabic + English", "currency": "EGP", "greeting": "Dear [First Name]", "decision_speed": "slow"},
    "New Zealand":  {"tz": "UTC+12/+13",      "best_contact": "Mon–Thu 9am–4pm NZST",  "language": "English", "currency": "NZD", "greeting": "Hi [First Name]", "decision_speed": "fast"},
    "Portugal":     {"tz": "UTC+0/+1",        "best_contact": "Mon–Thu 9am–6pm WET",   "language": "Portuguese (required)", "currency": "EUR", "greeting": "Caro/a [First Name]", "decision_speed": "medium"},
    "Switzerland":  {"tz": "UTC+1/+2",        "best_contact": "Mon–Thu 8am–12pm CET",  "language": "German/French/Italian (by region)", "currency": "CHF", "greeting": "Sehr geehrte/r [Last Name]", "decision_speed": "medium"},
    "Belgium":      {"tz": "UTC+1/+2",        "best_contact": "Mon–Thu 9am–5pm CET",   "language": "French or Dutch (by region)", "currency": "EUR", "greeting": "Dear [First Name]", "decision_speed": "medium"},
    "Denmark":      {"tz": "UTC+1/+2",        "best_contact": "Mon–Thu 8am–4pm CET",   "language": "Danish (English fine in tech)", "currency": "DKK", "greeting": "Kære [First Name]", "decision_speed": "fast"},
    "Norway":       {"tz": "UTC+1/+2",        "best_contact": "Mon–Thu 8am–4pm CET",   "language": "Norwegian (English fine in tech)", "currency": "NOK", "greeting": "Hei [First Name]", "decision_speed": "fast"},
    "Finland":      {"tz": "UTC+2/+3",        "best_contact": "Mon–Thu 8am–4pm EET",   "language": "Finnish (English fine in tech)", "currency": "EUR", "greeting": "Hei [First Name]", "decision_speed": "fast"},
    "Czech Republic":{"tz":"UTC+1/+2",        "best_contact": "Mon–Thu 9am–4pm CET",   "language": "Czech + English (IT)", "currency": "CZK", "greeting": "Dear [First Name]", "decision_speed": "medium"},
    "Romania":      {"tz": "UTC+2/+3",        "best_contact": "Mon–Fri 9am–5pm EET",   "language": "Romanian + English (tech)", "currency": "RON", "greeting": "Stimate/ă [Last Name]", "decision_speed": "medium"},
    "Greece":       {"tz": "UTC+2/+3",        "best_contact": "Mon–Fri 9am–2pm/5pm–8pm EET", "language": "Greek + English", "currency": "EUR", "greeting": "Dear [First Name]", "decision_speed": "slow"},
    "Chile":        {"tz": "UTC-3/-4",        "best_contact": "Mon–Fri 9am–6pm CLT",   "language": "Spanish (required)", "currency": "CLP", "greeting": "Estimado/a [First Name]", "decision_speed": "medium"},
    "Colombia":     {"tz": "UTC-5",           "best_contact": "Mon–Fri 9am–5pm COT",   "language": "Spanish (required)", "currency": "COP", "greeting": "Estimado/a [First Name]", "decision_speed": "medium"},
    "Peru":         {"tz": "UTC-5",           "best_contact": "Mon–Fri 9am–5pm PET",   "language": "Spanish (required)", "currency": "PEN", "greeting": "Estimado/a [First Name]", "decision_speed": "medium"},
    "Pakistan":     {"tz": "UTC+5",           "best_contact": "Mon–Fri 9am–5pm PKT",   "language": "English + Urdu", "currency": "PKR", "greeting": "Dear [First Name]", "decision_speed": "medium"},
    "Bangladesh":   {"tz": "UTC+6",           "best_contact": "Sun–Thu 9am–5pm BST",   "language": "Bengali + English", "currency": "BDT", "greeting": "Dear [First Name]", "decision_speed": "medium"},
    "Sri Lanka":    {"tz": "UTC+5:30",        "best_contact": "Mon–Fri 9am–5pm SLST",  "language": "English + Sinhala", "currency": "LKR", "greeting": "Dear [First Name]", "decision_speed": "medium"},
    "Taiwan":       {"tz": "UTC+8",           "best_contact": "Mon–Fri 9am–6pm TST",   "language": "Mandarin + English (tech)", "currency": "TWD", "greeting": "[Last Name] 先生/小姐", "decision_speed": "medium"},
    "Hong Kong":    {"tz": "UTC+8",           "best_contact": "Mon–Fri 9am–6pm HKT",   "language": "Cantonese + English", "currency": "HKD", "greeting": "Dear [First Name]", "decision_speed": "fast"},
    "China":        {"tz": "UTC+8",           "best_contact": "Tue–Thu 10am–12pm/2pm–5pm CST", "language": "Mandarin (required)", "currency": "CNY", "greeting": "[Last Name] 总 (zǒng)", "decision_speed": "slow"},
    "Oman":         {"tz": "UTC+4",           "best_contact": "Sun–Thu 8am–2pm GST",   "language": "Arabic + English", "currency": "OMR", "greeting": "Dear [First Name]", "decision_speed": "medium"},
    "Kuwait":       {"tz": "UTC+3",           "best_contact": "Sun–Thu 8am–2pm AST",   "language": "Arabic + English", "currency": "KWD", "greeting": "Dear [First Name]", "decision_speed": "medium"},
    "Qatar":        {"tz": "UTC+3",           "best_contact": "Sun–Thu 8am–4pm AST",   "language": "Arabic + English", "currency": "QAR", "greeting": "Dear [First Name]", "decision_speed": "medium"},
    "Bahrain":      {"tz": "UTC+3",           "best_contact": "Sun–Thu 8am–4pm AST",   "language": "Arabic + English", "currency": "BHD", "greeting": "Dear [First Name]", "decision_speed": "fast"},
    "Morocco":      {"tz": "UTC+1",           "best_contact": "Mon–Fri 9am–6pm WET",   "language": "French + Arabic", "currency": "MAD", "greeting": "Monsieur/Madame [Last Name]", "decision_speed": "medium"},
    "Ghana":        {"tz": "UTC+0",           "best_contact": "Mon–Fri 8am–5pm GMT",   "language": "English", "currency": "GHS", "greeting": "Dear [First Name]", "decision_speed": "medium"},
    "Ethiopia":     {"tz": "UTC+3",           "best_contact": "Mon–Fri 8am–5pm EAT",   "language": "Amharic + English", "currency": "ETB", "greeting": "Dear [First Name]", "decision_speed": "slow"},
    "Tanzania":     {"tz": "UTC+3",           "best_contact": "Mon–Fri 8am–5pm EAT",   "language": "Swahili + English", "currency": "TZS", "greeting": "Dear [First Name]", "decision_speed": "medium"},
    "Uganda":       {"tz": "UTC+3",           "best_contact": "Mon–Fri 8am–5pm EAT",   "language": "English", "currency": "UGX", "greeting": "Dear [First Name]", "decision_speed": "medium"},
    "Angola":       {"tz": "UTC+1",           "best_contact": "Mon–Fri 8am–5pm WAT",   "language": "Portuguese", "currency": "AOA", "greeting": "Caro/a [First Name]", "decision_speed": "slow"},
}


@country_intel_router.get("/countries")
def list_countries():
    """All countries with available intelligence."""
    all_countries = set(COMPLIANCE_DATA.keys()) | set(COUNTRY_META.keys())
    result = []
    for c in sorted(all_countries):
        comp = COMPLIANCE_DATA.get(c, {})
        meta = COUNTRY_META.get(c, {})
        result.append({
            "country": c,
            "risk_level": comp.get("risk_level", "unknown"),
            "framework": comp.get("framework", ""),
            "cold_email_allowed": comp.get("cold_email_allowed"),
            "currency": meta.get("currency", ""),
            "language": meta.get("language", ""),
            "decision_speed": meta.get("decision_speed", ""),
            "has_compliance": c in COMPLIANCE_DATA,
            "has_buyer_map": any(c in v for v in BUYER_MAP.values()),
        })
    return {"success": True, "countries": result, "total": len(result)}


@country_intel_router.get("/{country}")
def get_country_intel(country: str, industry: str = Query(default="SaaS")):
    """Full intelligence briefing for a country."""
    comp = COMPLIANCE_DATA.get(country)
    meta = COUNTRY_META.get(country)
    buyer = BUYER_MAP.get(industry, {}).get(country)

    if not comp and not meta and not buyer:
        available = sorted(set(COMPLIANCE_DATA.keys()) | set(COUNTRY_META.keys()))
        return {"success": False, "message": f"No data for '{country}'.", "available": available}

    return {
        "success": True,
        "country": country,
        "industry": industry,
        "compliance": comp or None,
        "contact_strategy": meta or None,
        "buyer_persona": buyer or None,
        "industries_available": [ind for ind, countries in BUYER_MAP.items() if country in countries],
    }
