"""Signal CRM — Country Compliance Rules for Cross-Border Outbound Sales"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional
from app.database import get_db
from app.auth import get_current_user, get_user_no_trial_check
from app.models import User, ComplianceNote

compliance_router = APIRouter(prefix="/compliance", tags=["Compliance"])

# ─── Hardcoded compliance data ────────────────────────────────────────────────

COMPLIANCE_DB = {
    "Germany": {
        "risk_level": "high",
        "gdpr_applicable": True,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "conditional",
        "cold_call_allowed": "conditional",
        "key_frameworks": ["GDPR", "UWG", "TTDSG"],
        "checklist": [
            "Identify your lawful basis (legitimate interest requires balancing test)",
            "Document your legitimate interest assessment in writing",
            "Ensure email contains company name, registered address, and opt-out link",
            "Honour opt-outs within 14 days",
            "Do NOT email personal Gmail/Hotmail addresses for B2B",
            "Verify target is a business email at a registered company",
            "Include unsubscribe mechanism in every email",
            "Do NOT use pre-ticked consent boxes",
            "Keep suppression list of opted-out contacts",
            "Review UWG §7 before running any cold outreach campaign",
        ],
        "blocking_rules": [
            "NEVER email without legitimate interest or consent basis",
            "NEVER ignore an opt-out request",
            "NEVER use deceptive subject lines (UWG violation)",
            "NEVER scrape German business directories without checking terms",
            "NEVER cold call without checking the German Robinson List",
        ],
        "safe_channels": ["LinkedIn InMail", "XING messaging", "Trade show / event outreach", "Warm intros via partners"],
        "notes": "Germany has one of the strictest enforcement regimes in Europe. The UWG (Unfair Competition Act) means aggressive outbound can trigger legal action. B2B legitimate interest is possible but must be documented. XING is the preferred outreach channel for German professionals.",
    },
    "UK": {
        "risk_level": "medium",
        "gdpr_applicable": True,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "conditional",
        "cold_call_allowed": "yes",
        "key_frameworks": ["UK GDPR", "PECR", "ICO Guidelines"],
        "checklist": [
            "B2B cold email to business email addresses allowed under PECR with opt-out",
            "Include company name, address, and unsubscribe in every email",
            "Keep suppression list of opted-out contacts",
            "Do NOT email sole traders / partnerships without consent (treated as consumers under PECR)",
            "Cold calling businesses is allowed — check TPS for consumer numbers",
            "Document your UK GDPR legitimate interest assessment",
            "Post-Brexit: UK GDPR is separate from EU GDPR — check both if operating in both",
        ],
        "blocking_rules": [
            "NEVER email sole traders without consent",
            "NEVER ignore TPS registrations for phone calls to consumers",
            "NEVER email without an opt-out mechanism",
            "NEVER conceal your identity on cold calls",
        ],
        "safe_channels": ["LinkedIn InMail", "B2B cold email", "Cold calling (businesses)", "Events"],
        "notes": "UK PECR makes B2B cold email relatively accessible if the address is a corporate email (not personal). Sole traders are protected as consumers. Cold calling businesses is permitted but must be professional and honest.",
    },
    "France": {
        "risk_level": "high",
        "gdpr_applicable": True,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "conditional",
        "cold_call_allowed": "conditional",
        "key_frameworks": ["GDPR", "RGPD", "CNIL Guidelines", "L.34-5 Code des Postes"],
        "checklist": [
            "B2B cold email requires either consent or legitimate interest with balancing test",
            "CNIL enforcement is active — document your legal basis",
            "Ensure email is in French or clearly addressed to an international audience",
            "Include unsubscribe link in French",
            "Cold calling: register with Bloctel suppression list (required for consumer calls)",
            "Store opt-out records for minimum 3 years",
            "Privacy policy must be available in French",
        ],
        "blocking_rules": [
            "NEVER cold email without documented legal basis",
            "NEVER cold call a consumer without checking Bloctel",
            "NEVER ignore CNIL investigation requests",
            "NEVER use consent obtained from a third-party list without verification",
        ],
        "safe_channels": ["LinkedIn InMail", "B2B email with LI basis", "French trade events (Vivatech, etc.)", "Partner referrals"],
        "notes": "CNIL is France's DPA and is increasingly active in enforcement. B2B legitimate interest is recognised but must be documented. French business culture values relationships — cold outreach is less effective without a warm intro.",
    },
    "Netherlands": {
        "risk_level": "medium",
        "gdpr_applicable": True,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "conditional",
        "cold_call_allowed": "conditional",
        "key_frameworks": ["GDPR", "Telecommunicatiewet", "AP Guidelines"],
        "checklist": [
            "B2B cold email to corporate addresses: legitimate interest basis is acceptable",
            "Always include opt-out and company details",
            "AP (Autoriteit Persoonsgegevens) is the Dutch DPA — check their guidelines",
            "Telephone marketing: no Bel-me-niet register equivalent for B2B, but respect opt-outs",
            "Sole traders are treated as individuals — consent required",
        ],
        "blocking_rules": [
            "NEVER email sole traders without consent",
            "NEVER send marketing without opt-out mechanism",
        ],
        "safe_channels": ["LinkedIn", "B2B cold email", "Dutch industry events"],
        "notes": "Netherlands has a pragmatic approach to B2B marketing under GDPR. The Dutch business culture is direct — concise and value-focused outreach works well.",
    },
    "USA": {
        "risk_level": "low",
        "gdpr_applicable": False,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "yes",
        "cold_call_allowed": "yes",
        "key_frameworks": ["CAN-SPAM", "CCPA (California)", "TCPA (calls/SMS)"],
        "checklist": [
            "CAN-SPAM: include physical mailing address and opt-out mechanism in every email",
            "CAN-SPAM: honour opt-out within 10 business days",
            "Do NOT use deceptive subject lines or sender names",
            "TCPA: do NOT robocall or send marketing SMS without prior express consent",
            "CCPA: if targeting California residents, provide privacy notice and opt-out of sale",
            "Keep DNC (Do Not Call) list and check before cold calling",
            "B2B cold calling is generally legal — be professional",
        ],
        "blocking_rules": [
            "NEVER robocall without TCPA consent",
            "NEVER ignore CAN-SPAM opt-outs",
            "NEVER use false sender identity",
            "NEVER send SMS marketing without prior written consent (TCPA)",
        ],
        "safe_channels": ["Cold email (CAN-SPAM compliant)", "Cold calling", "LinkedIn", "Events"],
        "notes": "USA is the most permissive major market for B2B outbound. CAN-SPAM is relatively easy to comply with. CCPA matters for consumer data in California but B2B outreach is largely unrestricted. Focus on personalisation and value rather than compliance barriers.",
    },
    "Canada": {
        "risk_level": "high",
        "gdpr_applicable": False,
        "opt_out_required": True,
        "legitimate_interest_allowed": False,
        "cold_email_allowed": "conditional",
        "cold_call_allowed": "yes",
        "key_frameworks": ["CASL", "PIPEDA", "National Do Not Call List"],
        "checklist": [
            "CASL: one of the world's strictest anti-spam laws — read carefully",
            "Cold email requires EXPRESS consent OR fits a CASL exemption",
            "CASL exemptions include: existing business relationship, inquiry-based (within 6 months), referral from someone with relationship",
            "Every email must include sender ID, physical address, and unsubscribe mechanism",
            "Unsubscribe must be honoured within 10 business days",
            "Cold calling: check DNCL (National Do Not Call List) before calling",
            "Document all consents with timestamps",
            "B2B exemption under CASL: email to role-based address (info@, sales@) with relevant offer",
        ],
        "blocking_rules": [
            "NEVER cold email without a CASL-compliant basis",
            "NEVER ignore unsubscribe requests",
            "CASL fines can reach CAD $10M per violation",
            "NEVER assume US CAN-SPAM compliance means CASL compliance — they are very different",
        ],
        "safe_channels": ["LinkedIn InMail", "Warm referrals", "Industry events", "Phone (check DNCL)"],
        "notes": "CASL is stricter than GDPR for email. Cold email without a pre-existing relationship or role-based address is high risk. LinkedIn outreach and phone are much safer channels for Canada.",
    },
    "UAE": {
        "risk_level": "medium",
        "gdpr_applicable": False,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "yes",
        "cold_call_allowed": "yes",
        "key_frameworks": ["UAE PDPL (Personal Data Protection Law)", "TRA Regulations"],
        "checklist": [
            "UAE PDPL came into effect 2023 — review before large-scale outreach",
            "B2B cold email is generally permitted with clear opt-out",
            "Include company name and unsubscribe mechanism",
            "Cold calling businesses is widely accepted in UAE business culture",
            "Respect local business hours (Sunday-Thursday)",
            "Arabic is preferred for government/public sector outreach",
            "Free zone companies have different rules than mainland — check which applies",
        ],
        "blocking_rules": [
            "NEVER send bulk SMS without telecom operator consent",
            "NEVER misrepresent your company in marketing",
        ],
        "safe_channels": ["Cold email", "Cold calling", "WhatsApp (preferred in UAE)", "LinkedIn", "Events"],
        "notes": "UAE is business-friendly with a relationship-oriented culture. WhatsApp is widely used for business communication. Response rates are high for personalised outreach. Government entities require Arabic and formal channels.",
    },
    "Saudi Arabia": {
        "risk_level": "medium",
        "gdpr_applicable": False,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "yes",
        "cold_call_allowed": "yes",
        "key_frameworks": ["PDPL (Personal Data Protection Law)", "CITC Regulations"],
        "checklist": [
            "Saudi PDPL is in effect — similar principles to GDPR but enforcement is developing",
            "B2B outreach to businesses is generally permitted",
            "Arabic content strongly preferred for Saudi audience",
            "Relationships matter — wasta (connections) open more doors than cold outreach",
            "Include company contact details and opt-out in all emails",
            "Vision 2030 sector companies (tourism, entertainment, tech) are active buyers",
            "Government and quasi-government entities: formal channels only",
        ],
        "blocking_rules": [
            "NEVER use bulk SMS without consent",
            "NEVER ignore cultural sensitivities in messaging",
        ],
        "safe_channels": ["LinkedIn", "WhatsApp", "Cold email", "Partner introductions", "Events"],
        "notes": "Saudi Arabia is a high-growth market under Vision 2030. Relationship-based selling is critical. Local partner introductions are far more effective than cold outreach. Arabic language is a competitive advantage.",
    },
    "Singapore": {
        "risk_level": "medium",
        "gdpr_applicable": False,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "yes",
        "cold_call_allowed": "yes",
        "key_frameworks": ["PDPA (Personal Data Protection Act)", "DNC Registry"],
        "checklist": [
            "PDPA governs personal data — business contact info of employees is personal data",
            "Sending marketing to business emails without consent is technically restricted under PDPA",
            "Legitimate interest exception applies but must be proportionate",
            "Check DNC Registry before cold calling individuals",
            "Include opt-out and sender details in all emails",
            "Singapore businesses are highly responsive to professional outreach",
            "English is the business language — no translation needed",
        ],
        "blocking_rules": [
            "NEVER cold call individuals without checking DNC Registry",
            "NEVER send marketing without opt-out mechanism",
        ],
        "safe_channels": ["LinkedIn", "B2B email", "Cold calling businesses", "Events (Singapore has many fintech/tech events)"],
        "notes": "Singapore is the APAC hub for many multinationals. Decision-makers are accessible and English-speaking. PDPA compliance is important but enforcement is proportionate. Great market to enter for any B2B product.",
    },
    "Japan": {
        "risk_level": "high",
        "gdpr_applicable": False,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "conditional",
        "cold_call_allowed": "conditional",
        "key_frameworks": ["APPI (Act on Protection of Personal Information)", "Act on Regulation of Transmission of Specified Electronic Mail"],
        "checklist": [
            "Japan's anti-spam law is strict — cold email to individuals requires consent or business relationship",
            "B2B email to listed business addresses is generally acceptable",
            "Japanese business culture: relationships first, pitching second",
            "Warm introductions through shared contacts are extremely effective",
            "All marketing materials must include sender name and opt-out in Japanese",
            "Ringi-sho (approval document) process means decisions are slow — build for long cycles",
            "Business cards (meishi) are still important — account for in-person follow-ups",
        ],
        "blocking_rules": [
            "NEVER send bulk unsolicited email to personal addresses",
            "NEVER skip the relationship-building phase",
            "NEVER rush Japanese decision-making processes",
        ],
        "safe_channels": ["Warm intros", "LinkedIn (growing but less used)", "Trade shows", "Local distributor/reseller"],
        "notes": "Japan requires localisation and patience. Direct cold outreach has very low response rates. A Japanese-speaking local partner or reseller dramatically improves success. Deal cycles are 2-5x longer than US/Europe.",
    },
    "Australia": {
        "risk_level": "medium",
        "gdpr_applicable": False,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "conditional",
        "cold_call_allowed": "yes",
        "key_frameworks": ["Privacy Act 1988", "Spam Act 2003", "ACMA Regulations"],
        "checklist": [
            "Spam Act 2003: commercial email requires consent or inferred consent",
            "Inferred consent applies when email address is prominently published for business purposes",
            "Include accurate sender details and opt-out in every commercial email",
            "Honour opt-out within 5 business days",
            "Cold calling businesses is permitted — check Do Not Call Register for consumers",
            "ACMA enforces Spam Act with significant fines",
            "Australian businesses are generally direct and responsive to professional outreach",
        ],
        "blocking_rules": [
            "NEVER email without consent or inferred consent",
            "NEVER ignore opt-out requests",
            "NEVER obscure your identity",
        ],
        "safe_channels": ["B2B cold email", "Cold calling (businesses)", "LinkedIn", "Events"],
        "notes": "Australia's Spam Act is similar to CAN-SPAM but has an inferred consent provision for published business emails. Direct, concise communication is valued. Australian businesses are generally open to international vendors.",
    },
    "Brazil": {
        "risk_level": "high",
        "gdpr_applicable": False,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "conditional",
        "cold_call_allowed": "conditional",
        "key_frameworks": ["LGPD (Lei Geral de Proteção de Dados)", "ANPD"],
        "checklist": [
            "LGPD (Brazil's GDPR equivalent) is enforced by ANPD since 2021",
            "Identify your legal basis: consent or legitimate interest for marketing",
            "Legitimate interest requires a balancing test — document it",
            "Include opt-out mechanism in all commercial emails",
            "Portuguese is required for Brazil-facing communications",
            "Cold calling: no specific anti-cold-call law for B2B but LGPD applies to personal data",
            "Data transfers to Brazil from outside require ANPD standard clauses",
        ],
        "blocking_rules": [
            "NEVER process personal data without a valid LGPD legal basis",
            "NEVER ignore data subject rights requests (15-day response required)",
            "NEVER send marketing in English only — Portuguese is mandatory",
        ],
        "safe_channels": ["LinkedIn", "WhatsApp (dominant in Brazil)", "Cold email", "Local partner intros"],
        "notes": "Brazil is the largest Latin American market. WhatsApp is used for business at all levels. LGPD enforcement is increasing. Local partnership is highly recommended for Brazilian market entry.",
    },
    "India": {
        "risk_level": "low",
        "gdpr_applicable": False,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "yes",
        "cold_call_allowed": "yes",
        "key_frameworks": ["DPDP Act 2023", "TRAI Regulations", "IT Act 2000"],
        "checklist": [
            "DPDP Act 2023 is law but implementing rules not fully notified yet",
            "Current enforcement primarily through TRAI for telecom marketing",
            "Register as a telemarketer with DLT (Distributed Ledger Technology) platform if doing SMS/calls at scale",
            "Include opt-out in commercial emails",
            "B2B outreach is widely accepted and expected in Indian business culture",
            "Follow up multiple times — Indian decision-making involves multiple stakeholders",
            "English is the B2B business language",
        ],
        "blocking_rules": [
            "NEVER do high-volume SMS without DLT registration (blocked by telcos)",
            "NEVER cold call consumers using an unregistered telemarketer ID",
        ],
        "safe_channels": ["Cold email", "Cold calling (highly effective)", "LinkedIn", "WhatsApp", "Direct visits"],
        "notes": "India is one of the most outreach-friendly B2B markets. Cold email and cold calling have high response rates. Multiple follow-ups are normal and expected. Relationship-building is important for large enterprise deals.",
    },
    "Indonesia": {
        "risk_level": "medium",
        "gdpr_applicable": False,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "yes",
        "cold_call_allowed": "yes",
        "key_frameworks": ["PDP Law 2022", "MCI Regulation"],
        "checklist": [
            "Indonesia PDP Law passed 2022 — transitioning enforcement period",
            "B2B cold email to business addresses is generally acceptable",
            "Bahasa Indonesia preferred for government and local SME outreach",
            "English works for tech companies and multinationals",
            "WhatsApp and Line are primary business communication channels",
            "Local partner strongly recommended for Indonesian market entry",
        ],
        "blocking_rules": [
            "NEVER process data without implementing basic security measures (PDP Law requirement)",
        ],
        "safe_channels": ["WhatsApp", "LinkedIn", "Cold email", "Local partner", "Trade events"],
        "notes": "Indonesia is a fast-growing market with a young digital economy. Relationship-based and requires local presence or strong partner for enterprise sales.",
    },
    "Poland": {
        "risk_level": "medium",
        "gdpr_applicable": True,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "conditional",
        "cold_call_allowed": "conditional",
        "key_frameworks": ["GDPR", "Polish Electronic Communications Act", "UODO"],
        "checklist": [
            "GDPR applies — same rules as other EU countries",
            "Polish Electronic Communications Act adds requirements for direct marketing by email/SMS",
            "B2B email to corporate addresses with legitimate interest is acceptable",
            "Include opt-out and sender details in Polish or English",
            "UODO (Polish DPA) is the enforcement authority",
            "Poland is a strong IT hub — tech outreach is well received",
        ],
        "blocking_rules": [
            "NEVER email without legitimate interest or consent basis",
            "NEVER ignore opt-out requests",
        ],
        "safe_channels": ["LinkedIn", "B2B cold email", "Cold calling (businesses)", "Polish tech events"],
        "notes": "Poland is a tech-savvy market with a large IT workforce. English is widely spoken in business. Good entry point for CEE expansion.",
    },
    "Sweden": {
        "risk_level": "high",
        "gdpr_applicable": True,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "conditional",
        "cold_call_allowed": "no",
        "key_frameworks": ["GDPR", "Marknadsföringslagen", "IMY (Swedish DPA)"],
        "checklist": [
            "GDPR + Swedish Marketing Act apply",
            "Cold calling for B2B marketing is effectively prohibited under Swedish Marketing Act",
            "Cold email: legitimate interest basis can apply to B2B — document carefully",
            "IMY (Swedish Integrity Protection Authority) is active in enforcement",
            "Include opt-out and full sender details",
            "Swedish businesses value sustainability and transparency in marketing",
        ],
        "blocking_rules": [
            "NEVER cold call for marketing purposes",
            "NEVER email without documented legal basis",
        ],
        "safe_channels": ["LinkedIn InMail", "B2B email (documented LI basis)", "Industry events", "Partner referrals"],
        "notes": "Sweden has the most restrictive cold calling rules in Europe. LinkedIn and email are the only practical outbound channels. Swedish professionals are direct and respond to evidence-based pitches.",
    },
    "Nigeria": {
        "risk_level": "low",
        "gdpr_applicable": False,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "yes",
        "cold_call_allowed": "yes",
        "key_frameworks": ["NDPR (Nigeria Data Protection Regulation)", "NCC Regulations"],
        "checklist": [
            "NDPR is the Nigerian privacy law — requires data protection officer for large processors",
            "B2B cold email is widely accepted and practised",
            "Include sender details and opt-out",
            "Cold calling is common and effective in Nigerian B2B sales",
            "WhatsApp is the dominant business communication channel",
            "Building trust is crucial — scam awareness means extra verification needed",
        ],
        "blocking_rules": [
            "NEVER misrepresent your company or product",
            "NEVER use pressure tactics — trust is hard to rebuild in Nigerian market",
        ],
        "safe_channels": ["Cold email", "Cold calling", "WhatsApp", "LinkedIn", "In-person meetings"],
        "notes": "Nigeria is Africa's largest economy and tech hub (Lagos). Very receptive to international B2B vendors, especially in fintech, logistics, and enterprise software. Relationships and trust are paramount.",
    },
    "South Africa": {
        "risk_level": "medium",
        "gdpr_applicable": False,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "conditional",
        "cold_call_allowed": "conditional",
        "key_frameworks": ["POPIA (Protection of Personal Information Act)", "CPA"],
        "checklist": [
            "POPIA is South Africa's privacy law — enforced by Information Regulator",
            "Direct marketing requires consent OR existing relationship",
            "Opt-out must be offered at point of collection and in every communication",
            "Respect opt-out within 2 business days",
            "Cold calling: must offer opt-out immediately",
            "South African English is the business language — no translation needed",
        ],
        "blocking_rules": [
            "NEVER market to someone who has opted out",
            "NEVER make false claims (CPA violation)",
        ],
        "safe_channels": ["LinkedIn", "B2B email", "Cold calling (professional)", "Events"],
        "notes": "South Africa is the gateway to sub-Saharan Africa. POPIA is enforced but enforcement is proportionate. Professional cold outreach is accepted in B2B.",
    },
    "Israel": {
        "risk_level": "medium",
        "gdpr_applicable": False,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "yes",
        "cold_call_allowed": "yes",
        "key_frameworks": ["Privacy Protection Law 5741-1981", "Consumer Protection Regulations"],
        "checklist": [
            "Israeli privacy law is older but a modernisation is in progress (closer to GDPR)",
            "B2B cold email and calling are generally accepted and common practice",
            "Include opt-out in all commercial emails",
            "Israel is a tech-forward market — highly receptive to B2B SaaS",
            "Hebrew is the business language but English is widely used in tech sector",
            "Startup culture means fast decision-making — don't over-qualify",
        ],
        "blocking_rules": [
            "NEVER use deceptive practices",
            "NEVER ignore opt-out requests",
        ],
        "safe_channels": ["Cold email", "LinkedIn", "Cold calling", "Tech events (CyberWeek, DLD etc.)"],
        "notes": "Israel's tech ecosystem ('Startup Nation') is extremely active. Direct, confident outreach works well. Israelis appreciate directness — skip the small talk.",
    },
    "Turkey": {
        "risk_level": "medium",
        "gdpr_applicable": False,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "conditional",
        "cold_call_allowed": "conditional",
        "key_frameworks": ["KVKK (Personal Data Protection Law)", "Electronic Commerce Law"],
        "checklist": [
            "KVKK is Turkey's data protection law — similar to GDPR",
            "Direct marketing requires consent under KVKK",
            "B2B outreach to corporate email addresses may qualify under legitimate interest",
            "Turkish is required for most B2B communication with local companies",
            "Include opt-out in all marketing emails",
            "Data localization requirements apply for certain categories",
        ],
        "blocking_rules": [
            "NEVER process personal data without KVKK-compliant basis",
            "NEVER send commercial email without opt-out",
        ],
        "safe_channels": ["LinkedIn", "B2B email (with LI basis)", "Local partner", "Trade events"],
        "notes": "Turkey is a large and growing market. A local partner or Turkish-speaking team member significantly increases conversion rates. KVKK enforcement is increasing.",
    },
    "Mexico": {
        "risk_level": "medium",
        "gdpr_applicable": False,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "yes",
        "cold_call_allowed": "yes",
        "key_frameworks": ["LFPDPPP (Federal Personal Data Protection Law)", "PROFECO"],
        "checklist": [
            "LFPDPPP applies to personal data — publish a privacy notice",
            "B2B cold email is widely practised and accepted",
            "Spanish is required for all customer-facing communications",
            "Include opt-out in all commercial emails",
            "Relationship-building is important — invest in local connections",
            "NEARSHORING boom makes Mexico highly receptive to B2B tech vendors",
        ],
        "blocking_rules": [
            "NEVER process personal data without a privacy notice",
        ],
        "safe_channels": ["Cold email", "LinkedIn", "Cold calling", "Events", "WhatsApp"],
        "notes": "Mexico's nearshoring boom (manufacturing, tech services) creates significant B2B opportunities. Spanish is essential. Strong relationship culture — plan for multiple touchpoints.",
    },
    "Vietnam": {
        "risk_level": "low",
        "gdpr_applicable": False,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "yes",
        "cold_call_allowed": "yes",
        "key_frameworks": ["Cybersecurity Law 2018", "Decree 13/2023 on Personal Data"],
        "checklist": [
            "Vietnam Decree 13/2023 introduces GDPR-like requirements — transitioning",
            "B2B cold outreach is generally accepted",
            "Vietnamese is preferred but English works in tech sector",
            "Zalo (local app) and Facebook are popular business channels",
            "Include opt-out in commercial emails",
            "Vietnam is a fast-growing tech market with strong manufacturing sector",
        ],
        "blocking_rules": [
            "NEVER store sensitive data on servers outside Vietnam without compliance review",
        ],
        "safe_channels": ["Cold email", "LinkedIn", "Zalo", "Facebook Messenger", "Events"],
        "notes": "Vietnam is an emerging B2B market with a young tech-savvy workforce. Manufacturing and export sectors are booming. Entry is easier through local distributors or a local team.",
    },
    "Philippines": {
        "risk_level": "low",
        "gdpr_applicable": False,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "yes",
        "cold_call_allowed": "yes",
        "key_frameworks": ["Data Privacy Act 2012", "NPC (National Privacy Commission)"],
        "checklist": [
            "Philippines DPA requires consent or legitimate purpose for processing personal data",
            "B2B cold email is widely used — English is the business language",
            "Register as data processor with NPC if processing significant personal data",
            "Include opt-out in all commercial emails",
            "Cold calling is common in BPO-strong Philippines — high English proficiency",
        ],
        "blocking_rules": [
            "NEVER process sensitive personal data without explicit consent",
        ],
        "safe_channels": ["Cold email", "Cold calling", "LinkedIn", "Facebook", "Events"],
        "notes": "Philippines is an English-speaking market with a strong BPO culture. Very receptive to international B2B vendors. Great for outsourced services and SaaS tools.",
    },
    "Egypt": {
        "risk_level": "low",
        "gdpr_applicable": False,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "yes",
        "cold_call_allowed": "yes",
        "key_frameworks": ["Personal Data Protection Law 151/2020", "NTRA Regulations"],
        "checklist": [
            "Egyptian PDPL is enacted — implementing regulations in progress",
            "B2B cold outreach is widely accepted",
            "Arabic is the business language — English works in multinational companies",
            "WhatsApp is the dominant business communication channel",
            "Include opt-out in commercial emails",
            "Egypt is a large market — gateway to North Africa",
        ],
        "blocking_rules": [
            "NEVER process data without implementing basic security (PDPL requirement)",
        ],
        "safe_channels": ["Cold email", "WhatsApp", "LinkedIn", "Cold calling", "Events"],
        "notes": "Egypt is Africa's second-largest market with a growing tech ecosystem. Cairo is a major B2B hub. Relationships matter — invest in local connections.",
    },
    "Thailand": {
        "risk_level": "medium",
        "gdpr_applicable": False,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "conditional",
        "cold_call_allowed": "yes",
        "key_frameworks": ["PDPA (Personal Data Protection Act 2019)", "NBTC Regulations"],
        "checklist": [
            "Thailand PDPA is enforced — similar structure to GDPR",
            "Marketing email requires consent from individuals",
            "B2B email to business addresses may qualify under legitimate interest",
            "Thai language preferred for local SME outreach",
            "English works in tech, hospitality, and multinational companies",
            "LINE app is the dominant business communication channel in Thailand",
        ],
        "blocking_rules": [
            "NEVER send email to individuals without consent basis",
            "NEVER ignore data subject requests",
        ],
        "safe_channels": ["LINE", "LinkedIn", "B2B email", "Cold calling", "Events"],
        "notes": "Thailand's PDPA enforcement is increasing. LINE is more important than WhatsApp in Thailand. Local partner significantly helps with Thai market entry.",
    },
    "Malaysia": {
        "risk_level": "medium",
        "gdpr_applicable": False,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "yes",
        "cold_call_allowed": "yes",
        "key_frameworks": ["PDPA 2010", "MCMC Regulations"],
        "checklist": [
            "Malaysia PDPA applies to commercial transactions involving personal data",
            "B2B cold email is generally accepted",
            "English is widely used in Malaysian business",
            "Include opt-out in commercial emails",
            "WhatsApp is widely used for B2B communication",
            "KL (Kuala Lumpur) is the ASEAN hub for many regional HQs",
        ],
        "blocking_rules": [
            "NEVER process personal data without user notice",
        ],
        "safe_channels": ["Cold email", "Cold calling", "LinkedIn", "WhatsApp", "Events"],
        "notes": "Malaysia is business-friendly and English-speaking. Good hub for ASEAN expansion. Tech and manufacturing sectors are strong.",
    },
    "Argentina": {
        "risk_level": "medium",
        "gdpr_applicable": False,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "yes",
        "cold_call_allowed": "yes",
        "key_frameworks": ["PDPRA (Personal Data Protection Law 25326)", "AAIP"],
        "checklist": [
            "Argentina's PDPRA is one of the oldest privacy laws in Latin America",
            "B2B cold email is widely practised",
            "Spanish is required for all communications",
            "WhatsApp is dominant — LinkedIn growing for tech sector",
            "Economic volatility affects deal cycles and pricing — quote in USD",
            "Tech talent is strong — good market for HR and SaaS tools",
        ],
        "blocking_rules": [
            "NEVER ignore data subject access requests",
        ],
        "safe_channels": ["WhatsApp", "Cold email", "LinkedIn", "Cold calling"],
        "notes": "Argentina has a strong tech ecosystem despite economic challenges. Spanish is essential. USD pricing is preferred by local companies due to peso volatility.",
    },
    "Kenya": {
        "risk_level": "low",
        "gdpr_applicable": False,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "yes",
        "cold_call_allowed": "yes",
        "key_frameworks": ["Data Protection Act 2019", "ODPC"],
        "checklist": [
            "Kenya DPA 2019 is enforced by ODPC",
            "B2B cold outreach is widely accepted",
            "English is the business language in Kenya",
            "WhatsApp and email are the primary channels",
            "Nairobi is Africa's tech hub (Silicon Savannah)",
            "Include opt-out in commercial emails",
        ],
        "blocking_rules": [
            "NEVER process sensitive personal data without consent",
        ],
        "safe_channels": ["Cold email", "WhatsApp", "LinkedIn", "Cold calling", "Events"],
        "notes": "Kenya is Africa's fastest-growing tech ecosystem. Nairobi hosts many pan-African HQs. English-speaking, entrepreneurial culture — very receptive to B2B tech.",
    },
    "Spain": {
        "risk_level": "high",
        "gdpr_applicable": True,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "conditional",
        "cold_call_allowed": "conditional",
        "key_frameworks": ["GDPR", "LSSI", "AEPD"],
        "checklist": [
            "GDPR + Spanish LSSI (Law of Information Society Services) apply",
            "AEPD (Spanish DPA) is very active in enforcement",
            "B2B email with legitimate interest basis is acceptable — document it",
            "Include opt-out and sender details in Spanish",
            "Cold calling: business calls allowed but must comply with LSSI",
            "Spain is a relationship-oriented culture — warm intros help significantly",
        ],
        "blocking_rules": [
            "NEVER email without documented legal basis",
            "NEVER ignore AEPD investigation requests",
        ],
        "safe_channels": ["LinkedIn", "B2B email (with LI)", "Warm intros", "Events"],
        "notes": "Spain's AEPD is one of Europe's most active DPAs. Relationships matter in Spanish business. Spanish language is required for most communications.",
    },
    "Italy": {
        "risk_level": "high",
        "gdpr_applicable": True,
        "opt_out_required": True,
        "legitimate_interest_allowed": True,
        "cold_email_allowed": "conditional",
        "cold_call_allowed": "conditional",
        "key_frameworks": ["GDPR", "Codice della Privacy", "Garante"],
        "checklist": [
            "GDPR + Italian Privacy Code apply",
            "Garante (Italian DPA) is extremely active — one of Europe's strictest enforcers",
            "Legitimate interest basis requires documented balancing test",
            "All communications should be in Italian",
            "Cold email to published corporate addresses with LI basis is possible",
            "Italian business culture: relationship-first, trust before business",
        ],
        "blocking_rules": [
            "NEVER email without documented legal basis",
            "NEVER ignore Garante requests — fines are significant",
        ],
        "safe_channels": ["LinkedIn", "Warm intros", "Industry events", "B2B email (careful LI basis)"],
        "notes": "Italy has one of Europe's strictest DPAs. Building trust through relationships is essential. Italian-language communication is strongly preferred.",
    },
}


def _get_country_summary(country: str, data: dict) -> dict:
    return {
        "country": country,
        "risk_level": data["risk_level"],
        "cold_email_allowed": data["cold_email_allowed"],
        "cold_call_allowed": data["cold_call_allowed"],
        "gdpr_applicable": data["gdpr_applicable"],
        "key_frameworks": data["key_frameworks"],
    }


@compliance_router.get("/countries")
async def list_countries():
    countries = []
    for country, data in COMPLIANCE_DB.items():
        countries.append(_get_country_summary(country, data))
    countries.sort(key=lambda x: ({"low": 0, "medium": 1, "high": 2}[x["risk_level"]], x["country"]))
    return {"success": True, "countries": countries, "total": len(countries)}


@compliance_router.get("/check")
async def check_compliance(country: str = Query(..., description="Country name")):
    data = COMPLIANCE_DB.get(country)
    if not data:
        available = list(COMPLIANCE_DB.keys())
        return {
            "success": False,
            "error": f"Compliance data not available for '{country}'.",
            "available_countries": available,
        }
    return {
        "success": True,
        "country": country,
        **data,
    }


class SaveComplianceReq(BaseModel):
    country: str
    checked_items: List[str] = []
    notes: str = ""


@compliance_router.post("/save")
async def save_compliance(
    req: SaveComplianceReq,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Upsert
    r = await db.execute(
        select(ComplianceNote).where(
            ComplianceNote.user_id == user.id,
            ComplianceNote.country == req.country,
        )
    )
    note = r.scalar_one_or_none()
    data = COMPLIANCE_DB.get(req.country, {})
    if note:
        note.checked_items = req.checked_items
        note.notes = req.notes
    else:
        note = ComplianceNote(
            user_id=user.id,
            country=req.country,
            framework=", ".join(data.get("key_frameworks", [])),
            checklist=data.get("checklist", []),
            checked_items=req.checked_items,
            notes=req.notes,
        )
        db.add(note)
    await db.commit()
    await db.refresh(note)
    return {"success": True, "message": f"Compliance checklist for {req.country} saved.", "id": str(note.id)}


@compliance_router.get("/saved")
async def saved_compliance(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ComplianceNote).where(ComplianceNote.user_id == user.id)
    )
    notes = result.scalars().all()
    return {
        "success": True,
        "saved": [
            {
                "id": str(n.id),
                "country": n.country,
                "framework": n.framework,
                "checked_items": n.checked_items or [],
                "total_items": len(n.checklist or []),
                "progress_pct": int(len(n.checked_items or []) / max(len(n.checklist or []), 1) * 100),
                "notes": n.notes,
                "created_at": n.created_at.isoformat(),
            }
            for n in notes
        ],
    }
