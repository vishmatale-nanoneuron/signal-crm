"""Signal CRM — Compliance Layer (Supabase)"""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from app.auth import get_current_user
from app.database import get_db
from app.models import User, ComplianceSave
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import Depends


compliance_router = APIRouter(prefix="/compliance", tags=["Compliance"])

COMPLIANCE_DATA = {
    "Germany": {"framework": "GDPR", "law": "BDSG + EU GDPR", "cold_email_allowed": False, "opt_in_required": True, "penalty": "Up to €20M or 4% global turnover", "key_rules": ["Explicit consent required for cold email", "Data subject rights: access, deletion, portability", "DPA registration if processing EU resident data", "Data residency: EU storage preferred"], "regulator": "BfDI (Federal Commissioner for Data Protection)", "risk_level": "high", "notes": "Germany enforces GDPR strictly. Cold outreach requires legitimate interest basis + easy opt-out. B2B slightly more lenient than B2C."},
    "France": {"framework": "GDPR + CNIL", "law": "EU GDPR + French Data Protection Act", "cold_email_allowed": False, "opt_in_required": True, "penalty": "Up to €20M or 4% global turnover", "key_rules": ["Prior consent for B2C cold email", "Legitimate interest possible for B2B", "CNIL registration for certain processing", "French language required for privacy notices"], "regulator": "CNIL", "risk_level": "high", "notes": "CNIL is one of Europe's most active data protection authorities. Document all legitimate interest assessments."},
    "UK": {"framework": "UK GDPR + PECR", "law": "UK GDPR, Data Protection Act 2018, PECR", "cold_email_allowed": True, "opt_in_required": False, "penalty": "Up to £17.5M or 4% global turnover", "key_rules": ["Legitimate interest basis for B2B cold email", "Must include unsubscribe in every email", "ICO registration required if processing personal data", "PECR applies to electronic marketing"], "regulator": "ICO (Information Commissioner's Office)", "risk_level": "medium", "notes": "UK diverged from EU GDPR post-Brexit. B2B cold email allowed under legitimate interest if relevant and with opt-out."},
    "USA": {"framework": "CAN-SPAM + CCPA", "law": "CAN-SPAM Act, CCPA (California), state laws", "cold_email_allowed": True, "opt_in_required": False, "penalty": "Up to $51,744 per violation (CAN-SPAM)", "key_rules": ["No deceptive subject lines", "Physical mailing address required", "Clear unsubscribe mechanism", "CCPA: right to opt-out of data sale (California)"], "regulator": "FTC + State AGs", "risk_level": "low", "notes": "US federal law (CAN-SPAM) is permissive. California CCPA applies if you have CA customers. B2B cold email widely practiced."},
    "Canada": {"framework": "CASL", "law": "Canada's Anti-Spam Legislation (CASL)", "cold_email_allowed": False, "opt_in_required": True, "penalty": "Up to CAD $10M per violation", "key_rules": ["Express or implied consent required", "Identify sender clearly", "Include unsubscribe mechanism", "Implied consent: existing business relationship within 2 years"], "regulator": "CRTC, CRTC Competition Bureau", "risk_level": "high", "notes": "CASL is one of the strictest anti-spam laws. Implied consent exists if prior business relationship. Express consent best practice."},
    "India": {"framework": "DPDP Act 2023", "law": "Digital Personal Data Protection Act 2023", "cold_email_allowed": True, "opt_in_required": False, "penalty": "Up to ₹250 crore per violation", "key_rules": ["Consent required for processing personal data", "Data Principal rights: access, correction, erasure", "Cross-border transfer restrictions apply", "B2B cold email generally permitted"], "regulator": "Data Protection Board of India", "risk_level": "medium", "notes": "DPDP Act 2023 is India's first comprehensive data protection law. B2B outreach generally fine but consumer data needs consent."},
    "Australia": {"framework": "Spam Act + Privacy Act", "law": "Spam Act 2003, Privacy Act 1988", "cold_email_allowed": True, "opt_in_required": False, "penalty": "Up to AUD $2.2M per day for serious breaches", "key_rules": ["Inferred consent for B2B", "Unsubscribe must work within 5 business days", "No misleading subject lines", "Privacy Act: data breach notification required"], "regulator": "ACMA, OAIC", "risk_level": "low", "notes": "Australia's Spam Act allows B2B email with inferred consent (visible email address). Easy to comply — just include opt-out."},
    "Singapore": {"framework": "PDPA + SPAM Control Act", "law": "Personal Data Protection Act 2012", "cold_email_allowed": True, "opt_in_required": False, "penalty": "Up to SGD $1M", "key_rules": ["Do Not Call registry must be checked for phone", "Consent or legitimate purpose for email", "Data Protection Trustmark (DPTM) — optional", "Cross-border transfer: recipient country must have adequate protection"], "regulator": "PDPC (Personal Data Protection Commission)", "risk_level": "medium", "notes": "PDPA is relatively business-friendly. B2B email permitted with opt-out. Check DNC registry before phone outreach."},
    "Japan": {"framework": "APPI + Act on Regulation of Transmission", "law": "Act on Protection of Personal Information (APPI)", "cold_email_allowed": False, "opt_in_required": True, "penalty": "Up to ¥100M for organizations", "key_rules": ["Prior consent required for commercial email", "Opt-out must be honored within 30 days", "Cross-border transfer: third-party consent required", "Japanese language for privacy notices recommended"], "regulator": "PPC (Personal Information Protection Commission)", "risk_level": "high", "notes": "Japan's anti-spam law is strict. Cold email requires prior consent. B2B relationships make implied consent possible but risky."},
    "Brazil": {"framework": "LGPD", "law": "Lei Geral de Proteção de Dados (LGPD)", "cold_email_allowed": False, "opt_in_required": True, "penalty": "Up to R$50M or 2% of Brazilian revenue", "key_rules": ["Legal basis required for processing (consent, legitimate interest, etc.)", "Data Subject Rights: access, portability, deletion", "DPA officer (Encarregado) required for some companies", "Cross-border transfers restricted"], "regulator": "ANPD (National Data Protection Authority)", "risk_level": "high", "notes": "LGPD closely mirrors GDPR. Legitimate interest may be used for B2B but must be documented. ANPD enforcement increasing."},
    "Netherlands": {"framework": "GDPR + Telecommunicatiewet", "law": "EU GDPR + Dutch Telecommunications Act", "cold_email_allowed": False, "opt_in_required": True, "penalty": "Up to €20M or 4% global turnover", "key_rules": ["Prior consent for B2C cold email", "Existing customer exception for similar products", "ACM and AP joint enforcement", "Dutch DPA (AP) known for enforcement"], "regulator": "Autoriteit Persoonsgegevens (AP)", "risk_level": "high", "notes": "Netherlands strictly enforces GDPR. Document legitimate interest carefully for B2B. AP has issued large fines."},
    "South Africa": {"framework": "POPIA", "law": "Protection of Personal Information Act 4 of 2013", "cold_email_allowed": False, "opt_in_required": True, "penalty": "Up to ZAR 10M or 10 years imprisonment", "key_rules": ["Consent required for direct marketing by electronic means", "Must include opt-out in every communication", "Data subject must be able to object to processing", "Cross-border transfer: adequate protection required"], "regulator": "Information Regulator (POPIA)", "risk_level": "high", "notes": "POPIA fully enforced since July 2021. B2B cold email needs consent or existing relationship. CIPC registration for data processors."},
    "UAE": {"framework": "PDPL (Abu Dhabi) + DIFC + ADGM", "law": "UAE Personal Data Protection Law 2023", "cold_email_allowed": True, "opt_in_required": False, "penalty": "Up to AED 20M", "key_rules": ["Consent for processing sensitive data", "Data subject rights: access, correction", "Cross-border transfer: adequate protection required", "DIFC/ADGM have their own stricter frameworks"], "regulator": "UAE Data Office", "risk_level": "medium", "notes": "UAE federal PDPL 2023 enacted. B2B email generally permitted. DIFC companies follow stricter rules. Dubai International zones may differ."},
    "Saudi Arabia": {"framework": "PDPL", "law": "Personal Data Protection Law (PDPL)", "cold_email_allowed": False, "opt_in_required": True, "penalty": "Up to SAR 5M", "key_rules": ["Explicit consent required for marketing communication", "Data residency in Saudi Arabia for sensitive data", "Cross-border transfer restrictions", "Data Steward registration required"], "regulator": "SDAIA / NDMO", "risk_level": "high", "notes": "Saudi PDPL effective September 2023. Strict consent requirements. Data residency rules for certain sectors. Government procurement requires local data."},
    "Malaysia": {"framework": "PDPA", "law": "Personal Data Protection Act 2010", "cold_email_allowed": True, "opt_in_required": False, "penalty": "Up to MYR 500,000 / 3 years imprisonment", "key_rules": ["Must give opt-out for direct marketing", "Can only process data with consent or legal basis", "Data user registration required for certain categories", "Cross-border transfer: adequate protection required"], "regulator": "PDPD (Personal Data Protection Department)", "risk_level": "medium", "notes": "Malaysia PDPA is relatively permissive. B2B cold email permitted with opt-out. Registration required for data processors in certain sectors."},
    "Indonesia": {"framework": "PDP Law 2022", "law": "Personal Data Protection Law No. 27 of 2022", "cold_email_allowed": False, "opt_in_required": True, "penalty": "Up to IDR 50B / 5 years imprisonment", "key_rules": ["Explicit consent required for processing", "Right to erasure and correction", "Cross-border transfer: MOU with recipient country", "Data Protection Officer (DPO) required for large processors"], "regulator": "Ministry of Communications and Information Technology", "risk_level": "high", "notes": "Indonesia's PDP Law fully effective 2024. Strict consent requirements. B2B cold email needs explicit consent or legitimate interest documentation."},
    "Sweden": {"framework": "GDPR + DMAL", "law": "EU GDPR + Swedish Direct Marketing Act", "cold_email_allowed": False, "opt_in_required": True, "penalty": "Up to €20M or 4% global turnover", "key_rules": ["Prior consent for commercial email", "SPAR registry must be consulted", "IMY (Swedish Privacy Authority) actively enforces", "Legitimate interest requires LIA documentation"], "regulator": "IMY (Integritetsskyddsmyndigheten)", "risk_level": "high", "notes": "Sweden is strict on GDPR. IMY has issued significant fines. Document legitimate interest assessments carefully."},
    "Spain": {"framework": "GDPR + LSSICE", "law": "EU GDPR + Spanish Information Society Services Law", "cold_email_allowed": False, "opt_in_required": True, "penalty": "Up to €20M or 4% global turnover + LSSICE fines", "key_rules": ["Prior consent for electronic direct marketing", "AEPD known for enforcement actions", "Right to erasure ('right to be forgotten')", "Spanish language for notices required"], "regulator": "AEPD (Spanish Data Protection Agency)", "risk_level": "high", "notes": "AEPD is one of Europe's most active regulators. Cold email requires prior opt-in. B2B legitimate interest possible but risky."},
    "Italy": {"framework": "GDPR + Italian Privacy Code", "law": "EU GDPR + Legislative Decree 196/2003", "cold_email_allowed": False, "opt_in_required": True, "penalty": "Up to €20M or 4% global turnover", "key_rules": ["Explicit consent for email marketing", "Garante (Italian DPA) very active", "Soft opt-in for existing customers", "Cookie consent must be explicit"], "regulator": "Garante per la protezione dei dati personali", "risk_level": "high", "notes": "Garante is proactive and issues large fines. Cold email strictly requires consent. Existing customer relationship enables limited email."},
    "Mexico": {"framework": "LFPDPPP", "law": "Ley Federal de Protección de Datos Personales en Posesión de los Particulares", "cold_email_allowed": True, "opt_in_required": False, "penalty": "Up to MXN 320M", "key_rules": ["Privacy notice required (Aviso de Privacidad)", "Right to revoke consent", "B2B email with opt-out generally permitted", "INAI oversees compliance"], "regulator": "INAI", "risk_level": "medium", "notes": "Mexico's law is less strict than GDPR. B2B cold email permitted with proper privacy notice and opt-out. INAI enforcement is increasing."},
    "Argentina": {"framework": "PDPL 25.326", "law": "Personal Data Protection Law 25.326", "cold_email_allowed": True, "opt_in_required": False, "penalty": "Up to ARS 3M", "key_rules": ["Registration with AAIP required for data processing", "Opt-out for direct marketing", "Sensitive data requires explicit consent", "Cross-border transfer requires adequate protection"], "regulator": "AAIP (Agencia de Acceso a la Información Pública)", "risk_level": "medium", "notes": "Argentina has GDPR adequacy status. B2B cold email permitted with opt-out. Register data processing activities with AAIP."},
    "Nigeria": {"framework": "NDPR + NITDA", "law": "Nigeria Data Protection Regulation 2019", "cold_email_allowed": True, "opt_in_required": False, "penalty": "Up to NGN 10M or 2% of annual gross revenue", "key_rules": ["Data Audit required annually", "Consent or legitimate interest for processing", "DPIA required for large-scale processing", "NDPC (Nigeria Data Protection Commission) oversees"], "regulator": "NDPC", "risk_level": "medium", "notes": "Nigeria NDPR 2019 + NDPA 2023. B2B email generally permitted. Annual data audit required. Fintech sector faces stricter CBN requirements."},
    "Kenya": {"framework": "DPA 2019", "law": "Data Protection Act 2019", "cold_email_allowed": True, "opt_in_required": False, "penalty": "Up to KES 3M or 1 year imprisonment", "key_rules": ["Consent or legitimate interest for processing", "Data protection registration required", "Data subject rights: access, correction", "Office of the Data Protection Commissioner (ODPC) enforces"], "regulator": "ODPC", "risk_level": "medium", "notes": "Kenya DPA 2019 is actively enforced. B2B email with legitimate interest permitted. Registration with ODPC required for data processors."},
    "Poland": {"framework": "GDPR + UODO", "law": "EU GDPR + Polish Personal Data Protection Office Act", "cold_email_allowed": False, "opt_in_required": True, "penalty": "Up to €20M or 4% global turnover", "key_rules": ["Consent for electronic marketing", "UODO (Polish DPA) enforcement active", "Data breach notification: 72 hours", "Legitimate interest must be documented"], "regulator": "UODO (Urząd Ochrony Danych Osobowych)", "risk_level": "high", "notes": "Poland strictly enforces GDPR. UODO has issued significant fines. B2B cold email needs careful legitimate interest documentation."},
    "Vietnam": {"framework": "Decree 13/2023", "law": "Decree on Personal Data Protection 13/2023", "cold_email_allowed": False, "opt_in_required": True, "penalty": "Up to VND 100M", "key_rules": ["Consent required for processing personal data", "Data localization: critical data must stay in Vietnam", "Annual data protection impact assessment", "Ministry of Public Security oversight"], "regulator": "Ministry of Public Security (A05)", "risk_level": "high", "notes": "Vietnam Decree 13/2023 fully effective. Strict consent requirements. Data localization for certain categories. Cross-border transfer requires government approval."},
    "Philippines": {"framework": "DPA RA 10173", "law": "Data Privacy Act of 2012 (Republic Act 10173)", "cold_email_allowed": False, "opt_in_required": True, "penalty": "Up to PHP 5M / 6 years imprisonment", "key_rules": ["Consent required for direct marketing", "NPC registration for personal information controllers", "Data breach notification within 72 hours", "Data Subject Rights: access, rectification, erasure"], "regulator": "NPC (National Privacy Commission)", "risk_level": "high", "notes": "Philippines DPA is strictly enforced by NPC. NPC registration required. Cold email needs consent. Existing customer soft opt-in permitted."},
    "Thailand": {"framework": "PDPA", "law": "Personal Data Protection Act B.E. 2562 (2019)", "cold_email_allowed": False, "opt_in_required": True, "penalty": "Up to THB 5M / 1 year imprisonment", "key_rules": ["Explicit consent for direct marketing", "Right to withdraw consent", "DPO required for large-scale processing", "Cross-border transfer: adequate protection required"], "regulator": "PDPC (Personal Data Protection Committee)", "risk_level": "high", "notes": "Thailand PDPA fully effective 2022. Strict consent requirements. PDPC enforcement ramping up. B2B with existing relationship may use legitimate interest."},
}


class SaveComplianceReq(BaseModel):
    country: str
    notes: str = ""


@compliance_router.get("/countries")
def get_countries():
    return {
        "success": True,
        "countries": [
            {"country": k, "framework": v["framework"], "risk_level": v["risk_level"],
             "cold_email_allowed": v["cold_email_allowed"]}
            for k, v in COMPLIANCE_DATA.items()
        ],
        "total": len(COMPLIANCE_DATA),
    }


@compliance_router.get("/check")
def check_compliance(country: str = Query(...)):
    data = COMPLIANCE_DATA.get(country)
    if not data:
        available = sorted(COMPLIANCE_DATA.keys())
        return {"success": False, "message": f"No data for '{country}'.", "available_countries": available}
    return {"success": True, "country": country, **data}


@compliance_router.post("/save")
def save_compliance(req: SaveComplianceReq, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    data = COMPLIANCE_DATA.get(req.country, {})
    row = {
        "user_id": user["id"],
        "country": req.country,
        "framework": data.get("framework", ""),
        "notes": req.notes,
    }
    result = sb.table("compliance_saves").insert(row).execute()
    return {"success": True, "saved": result.data[0], "message": f"Compliance note for {req.country} saved."}


@compliance_router.get("/saved")
def get_saved(user: dict = Depends(get_current_user)):
    sb = get_supabase()
    result = sb.table("compliance_saves").select("*").eq("user_id", user["id"]).order("created_at", desc=True).execute()
    return {"success": True, "saved": result.data or [], "total": len(result.data or [])}


# Override the save/saved endpoints with SQLAlchemy versions
from fastapi import Depends as _Depends
from sqlalchemy.ext.asyncio import AsyncSession as _AsyncSession
from app.database import get_db as _get_db
from app.models import ComplianceSave as _ComplianceSave, User as _User
from app.auth import get_current_user as _get_current_user
from sqlalchemy import select as _select
from pydantic import BaseModel as _BaseModel

class _SaveReq(_BaseModel):
    country: str
    notes: str = ""

@compliance_router.post("/save")
async def save_compliance_pg(req: _SaveReq, user: _User = _Depends(_get_current_user), db: _AsyncSession = _Depends(_get_db)):
    data = COMPLIANCE_DATA.get(req.country, {})
    save = _ComplianceSave(user_id=user.id, country=req.country, framework=data.get("framework",""), notes=req.notes)
    db.add(save)
    await db.commit()
    await db.refresh(save)
    return {"success": True, "saved": {"id": save.id, "country": save.country}, "message": f"Saved compliance note for {req.country}."}

@compliance_router.get("/saved")
async def get_saved_pg(user: _User = _Depends(_get_current_user), db: _AsyncSession = _Depends(_get_db)):
    r = await db.execute(_select(_ComplianceSave).where(_ComplianceSave.user_id == user.id).order_by(_ComplianceSave.created_at.desc()))
    items = r.scalars().all()
    return {"success": True, "saved": [{"id": s.id, "country": s.country, "framework": s.framework, "notes": s.notes} for s in items]}
