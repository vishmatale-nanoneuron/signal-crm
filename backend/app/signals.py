"""Signal CRM — Web Signal Management + Demo Seeder"""
from datetime import datetime, timedelta
import random
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.auth import get_current_user
from app.models import User, WebSignal, WatchlistAccount

signals_router = APIRouter(prefix="/signals", tags=["Signals"])

# ---------------------------------------------------------------------------
# Demo seed data
# ---------------------------------------------------------------------------

DEMO_WATCHLIST = [
    {"company_name": "Freshworks", "domain": "freshworks.com", "industry": "SaaS", "country": "USA", "priority": "high"},
    {"company_name": "Razorpay", "domain": "razorpay.com", "industry": "Fintech", "country": "India", "priority": "high"},
    {"company_name": "Zoho", "domain": "zoho.com", "industry": "SaaS", "country": "India", "priority": "medium"},
    {"company_name": "Deel", "domain": "deel.com", "industry": "HR Tech", "country": "USA", "priority": "high"},
    {"company_name": "Shopify", "domain": "shopify.com", "industry": "Ecommerce", "country": "Canada", "priority": "medium"},
    {"company_name": "Stripe", "domain": "stripe.com", "industry": "Fintech", "country": "USA", "priority": "high"},
    {"company_name": "Infosys", "domain": "infosys.com", "industry": "IT Services", "country": "India", "priority": "medium"},
    {"company_name": "Remote.com", "domain": "remote.com", "industry": "HR Tech", "country": "Netherlands", "priority": "medium"},
]

DEMO_SIGNALS = [
    {
        "company_name": "Freshworks", "domain": "freshworks.com",
        "signal_type": "hiring_spike", "signal_strength": "high",
        "title": "Freshworks hiring 45+ enterprise sales roles in DACH region",
        "summary": "Freshworks posted 45 new enterprise sales, pre-sales, and customer success roles in Germany, Austria, and Switzerland in the last 30 days — a 3x spike vs. prior quarter.",
        "proof_text": "Job posting: 'Enterprise Account Executive - DACH' | Location: Munich, Germany | 'We are looking for experienced enterprise sales professionals to join our rapidly growing DACH team...' | Posted: 3 days ago | 12 similar roles active",
        "proof_url": "https://careers.freshworks.com/jobs/enterprise-sales-dach",
        "country_hint": "Germany",
        "recommended_action": "Contact VP Sales DACH. They are staffing up fast — likely in pre-launch mode for a DACH push. Offer localization or partner services now before they hire in-house.",
        "days_ago": 1,
    },
    {
        "company_name": "Razorpay", "domain": "razorpay.com",
        "signal_type": "new_country_page", "signal_strength": "high",
        "title": "Razorpay launches new /malaysia page with local payment rail content",
        "summary": "Razorpay quietly added a Malaysia-specific landing page listing FPX, DuitNow, and GrabPay integrations. This signals imminent go-to-market entry into Malaysia.",
        "proof_text": "Page title: 'Accept Payments in Malaysia | Razorpay' | URL: razorpay.com/malaysia | Content snippet: 'Accept FPX, DuitNow, GrabPay, and all major Malaysian payment methods. Integrate in minutes.' | Page first indexed: 5 days ago | Hreflang: en-MY added",
        "proof_url": "https://razorpay.com/malaysia",
        "country_hint": "Malaysia",
        "recommended_action": "Razorpay entering Malaysia means they need local banking partners, compliance support, and potentially a local team. Reach out to their Head of International Expansion this week.",
        "days_ago": 2,
    },
    {
        "company_name": "Deel", "domain": "deel.com",
        "signal_type": "pricing_change", "signal_strength": "high",
        "title": "Deel raises EOR pricing for India market by 18%",
        "summary": "Deel updated their India Employer-of-Record pricing page, raising per-employee cost from $499/mo to $589/mo. This creates an opening for competitors to offer better rates.",
        "proof_text": "Pricing page diff: India EOR | Old price: $499/month per employee | New price: $589/month per employee | Change detected: 4 days ago | Additional fees section expanded with 'compliance management fee' line item | Cache-busted URL confirms live change",
        "proof_url": "https://www.deel.com/pricing",
        "country_hint": "India",
        "recommended_action": "18% price hike is a retention risk for Deel's India customers. Target Deel India EOR customers — especially Series A-C startups that are cost-sensitive. Lead with price comparison.",
        "days_ago": 3,
    },
    {
        "company_name": "Zoho", "domain": "zoho.com",
        "signal_type": "new_product", "signal_strength": "medium",
        "title": "Zoho launches Zoho Finance Plus bundle targeting SME accountants in UK",
        "summary": "Zoho quietly launched a UK-specific Finance Plus bundle combining Books, Payroll, Expense, and Inventory with MTD (Making Tax Digital) compliance built-in.",
        "proof_text": "Product page: 'Zoho Finance Plus for UK Businesses' | Released: 8 days ago | Blog post: 'Introducing MTD-Ready Accounting Suite' | Pricing: £25/month | Target: 'accounting firms managing multiple SME clients' | App directory listing updated with UK flag",
        "proof_url": "https://www.zoho.com/finance/uk/",
        "country_hint": "UK",
        "recommended_action": "Zoho entering UK SME accounting creates channel partner opportunities. UK accounting firms will need implementation support. Reach out to the Zoho UK partner team immediately.",
        "days_ago": 5,
    },
    {
        "company_name": "Stripe", "domain": "stripe.com",
        "signal_type": "compliance_update", "signal_strength": "high",
        "title": "Stripe updates KYC requirements for Indian merchants — PAN + GSTIN now mandatory",
        "summary": "Stripe India updated their merchant verification page to require both PAN and GSTIN from all new merchant sign-ups, and retroactively for existing merchants by Q2 2026.",
        "proof_text": "Stripe India Help Center: 'Updated verification requirements for Indian businesses' | Updated: 6 days ago | 'Effective March 15, 2026, all Stripe India merchants must provide: (1) PAN Card, (2) GST Registration Certificate, (3) Cancelled cheque or bank statement' | Non-compliant accounts will face payout holds",
        "proof_url": "https://support.stripe.com/in/topics/verification",
        "country_hint": "India",
        "recommended_action": "Indian merchants scrambling to comply with new Stripe KYC requirements. Compliance consulting services or fintech onboarding tools will be in demand. Target Indian export-heavy SMEs.",
        "days_ago": 4,
    },
    {
        "company_name": "Shopify", "domain": "shopify.com",
        "signal_type": "leadership_change", "signal_strength": "medium",
        "title": "Shopify appoints new VP of APAC Merchant Success — based in Singapore",
        "summary": "Shopify's LinkedIn shows a new VP-level hire for APAC Merchant Success, based out of Singapore. Profile shows they previously led expansion at BigCommerce APAC.",
        "proof_text": "LinkedIn profile: 'VP, Merchant Success — APAC at Shopify' | Start date: February 2026 | Location: Singapore | Previous: 'Director, Partner Growth at BigCommerce' | Connections celebrating hire include Shopify SVP Global Sales | Company headcount in Singapore +12 in last 60 days",
        "proof_url": "https://linkedin.com/company/shopify",
        "country_hint": "Singapore",
        "recommended_action": "New APAC leadership at Shopify signals aggressive merchant acquisition push in SE Asia. App developers, logistics partners, and payment processors should engage Shopify APAC within 30 days.",
        "days_ago": 7,
    },
    {
        "company_name": "Infosys", "domain": "infosys.com",
        "signal_type": "partner_page", "signal_strength": "medium",
        "title": "Infosys adds new cloud migration partner section for SME segment",
        "summary": "Infosys launched an SME-focused cloud migration partner page listing certified implementation partners. The page targets sub-500 employee companies in Europe and ANZ.",
        "proof_text": "Partner page: 'Infosys Cloud Accelerate — SME Partner Program' | URL: /services/cloud/sme-partner | Target: 'organizations with 50-500 employees' | Geographies listed: UK, Germany, Netherlands, Australia, NZ | Partners accepted: system integrators, managed service providers | Application form added 11 days ago",
        "proof_url": "https://www.infosys.com/services/cloud/sme-partner",
        "country_hint": "Germany",
        "recommended_action": "Infosys SME partner program is actively onboarding. If you're a cloud MSP or system integrator, apply within this quarter to get early listed. Strong opportunity in German market.",
        "days_ago": 9,
    },
    {
        "company_name": "Remote.com", "domain": "remote.com",
        "signal_type": "hiring_spike", "signal_strength": "high",
        "title": "Remote.com posts 28 roles in Nigeria, Kenya, and Egypt — Africa expansion confirmed",
        "summary": "Remote.com's job board shows 28 new Africa-focused roles including Country Lead Nigeria, Country Lead Kenya, and a Head of Africa Operations hired internally. This is the clearest signal yet of Africa expansion.",
        "proof_text": "Careers page: remote.com/careers?location=Africa | Active listings: 28 | Roles include: 'Country Lead - Nigeria', 'Country Lead - Kenya', 'Compliance Specialist - Egypt', 'Head of Africa Operations (Internal Transfer announced)' | LinkedIn: 3 Remote employees recently added 'Lagos', 'Nairobi', 'Cairo' to location | All posted in last 21 days",
        "proof_url": "https://remote.com/careers",
        "country_hint": "Nigeria",
        "recommended_action": "Remote.com is entering Africa — this means they need local EOR legal infrastructure, banking relationships, and payroll processors in Nigeria/Kenya/Egypt. High-value B2B partnership opportunity.",
        "days_ago": 2,
    },
    {
        "company_name": "Freshworks", "domain": "freshworks.com",
        "signal_type": "new_country_page", "signal_strength": "medium",
        "title": "Freshworks adds Dutch-language landing page and Amsterdam contact details",
        "summary": "Freshworks updated their Europe section with a Netherlands-specific page in Dutch, listing an Amsterdam office address and local support hours.",
        "proof_text": "Page: freshworks.com/nl/ | Language: Dutch (nl-NL) | Content: 'Klantenservice software voor het MKB' | Address added: Herengracht 450, 1017 CA Amsterdam | Phone: Dutch local number (+31) | Google My Business listing created 14 days ago | Dutch VAT number: NL123456789B01",
        "proof_url": "https://freshworks.com/nl/",
        "country_hint": "Netherlands",
        "recommended_action": "Freshworks is setting up a physical Netherlands presence. They'll need Dutch implementation partners, local accountants familiar with Dutch tax, and potentially office facilities support.",
        "days_ago": 12,
    },
    {
        "company_name": "Razorpay", "domain": "razorpay.com",
        "signal_type": "hiring_spike", "signal_strength": "high",
        "title": "Razorpay International hiring 18 roles in UAE — dedicated Gulf expansion team",
        "summary": "Razorpay posted 18 UAE-specific roles including Head of UAE Operations, Enterprise Sales UAE, and Compliance Manager MENA. This is a coordinated Gulf market entry.",
        "proof_text": "LinkedIn Jobs: 18 active Razorpay postings in Dubai/Abu Dhabi | Roles include: 'Head of Operations - UAE', 'Enterprise Account Executive - Gulf', 'AML Compliance Officer MENA' | Job descriptions reference 'Razorpay International' entity | UAE Trade License number visible on new Contact Us page | CEO posted 'exciting new geography' on LinkedIn 3 days ago",
        "proof_url": "https://careers.razorpay.com/jobs?location=UAE",
        "country_hint": "UAE",
        "recommended_action": "Razorpay UAE is a major B2B opportunity. They need CBUAE compliance support, local banking partners, Arabic UI/UX vendors, and possibly accounting firms familiar with UAE free zone setup.",
        "days_ago": 1,
    },
    {
        "company_name": "Deel", "domain": "deel.com",
        "signal_type": "new_product", "signal_strength": "high",
        "title": "Deel launches Deel HR — free HRIS to compete with BambooHR and Rippling",
        "summary": "Deel announced Deel HR, a free HR information system bundled with their EOR product. This is a major product expansion designed to lock customers into the Deel ecosystem.",
        "proof_text": "Product launch: 'Deel HR — Free for Deel Customers' | Announcement date: 18 days ago | Features: 'Employee database, org chart, time-off tracking, performance reviews — all free when using any Deel product' | Techcrunch coverage: 'Deel launches free HRIS targeting Rippling' | App store listing updated | 50k+ companies notified via in-app banner",
        "proof_url": "https://www.deel.com/blog/deel-hr-launch",
        "country_hint": "USA",
        "recommended_action": "Deel HR launch will cannibalize standalone HRIS vendors. If you sell HR software, reposition against Deel now. If you're an integrator, Deel HR API partnerships are available early.",
        "days_ago": 15,
    },
    {
        "company_name": "Zoho", "domain": "zoho.com",
        "signal_type": "expansion", "signal_strength": "medium",
        "title": "Zoho opens new data center in Saudi Arabia — KSA-residency compliance unlocked",
        "summary": "Zoho announced a new data center in Riyadh, Saudi Arabia, enabling data residency for Saudi customers. This makes Zoho compliant with NCA (Saudi National Cybersecurity Authority) mandates.",
        "proof_text": "Zoho Blog: 'Zoho opens Riyadh Data Center — Data Residency for Saudi Arabia' | Published: 22 days ago | Quote: 'All data for Saudi-based customers will be stored and processed within the Kingdom, meeting NCA Cloud Computing Regulatory Framework requirements' | NCA compliance certification attached | Pricing page: 'Saudi Arabia — Local Data Residency' toggle added",
        "proof_url": "https://www.zoho.com/blog/general/zoho-riyadh-data-center.html",
        "country_hint": "Saudi Arabia",
        "recommended_action": "Zoho KSA data residency opens the door for Saudi enterprise sales. Large Saudi enterprises that previously couldn't use Zoho are now eligible. Target Saudi Vision 2030 companies in retail, logistics, and manufacturing.",
        "days_ago": 20,
    },
    {
        "company_name": "Shopify", "domain": "shopify.com",
        "signal_type": "compliance_update", "signal_strength": "medium",
        "title": "Shopify updates EU consumer rights disclosure requirements for EU merchants",
        "summary": "Shopify updated their EU checkout compliance settings, adding mandatory consumer rights disclosures under the EU Digital Services Act for all EU-based stores selling to consumers.",
        "proof_text": "Shopify Help: 'EU Digital Services Act compliance updates' | Updated: 16 days ago | 'As of February 17, 2026, all Shopify stores with EU consumers must display: (1) Trader verification badge, (2) DSA complaint mechanism link, (3) Recommender system transparency notice' | Non-compliant stores to receive warning banner | Checkout editor updated with new DSA fields",
        "proof_url": "https://help.shopify.com/en/manual/markets/eu-compliance",
        "country_hint": "Germany",
        "recommended_action": "EU merchants on Shopify need DSA compliance help immediately. Legal consultancies and compliance SaaS tools should reach out to Shopify EU merchant base now — deadline pressure creates urgency.",
        "days_ago": 14,
    },
    {
        "company_name": "Stripe", "domain": "stripe.com",
        "signal_type": "partner_page", "signal_strength": "medium",
        "title": "Stripe adds dedicated Southeast Asia Partner Directory with integration tiers",
        "summary": "Stripe launched a SEA-specific partner directory listing integration partners in Indonesia, Vietnam, Philippines, and Thailand with tiered certification levels.",
        "proof_text": "Stripe Partner Page: 'Southeast Asia Partner Directory' | URL: stripe.com/partners/sea | Launched: 19 days ago | Countries listed: Indonesia, Vietnam, Philippines, Thailand, Malaysia, Singapore | Partner tiers: Registered, Select, Premier | Quote: 'We're investing heavily in SEA partner ecosystem to support the next 10 million businesses' | Applications open",
        "proof_url": "https://stripe.com/partners/sea",
        "country_hint": "Indonesia",
        "recommended_action": "Stripe SEA partner program is open for applications. If you do Stripe integration work in Indonesia/Vietnam/Philippines, apply for Premier tier — early partners get lead sharing and co-marketing.",
        "days_ago": 17,
    },
    {
        "company_name": "Infosys", "domain": "infosys.com",
        "signal_type": "leadership_change", "signal_strength": "low",
        "title": "Infosys appoints new Chief Sustainability Officer with BRSR focus",
        "summary": "Infosys appointed a new Chief Sustainability Officer with a mandate covering BRSR (Business Responsibility and Sustainability Reporting) compliance for India-listed companies.",
        "proof_text": "Press release: 'Infosys appoints [Name] as Chief Sustainability Officer' | Date: 25 days ago | Quote: 'The role will lead our BRSR compliance roadmap and ESG reporting for institutional investors' | LinkedIn: New CSO profile updated, 1st post: 'Excited to lead sustainability at Infosys — BRSR is table stakes for Indian large-caps now' | Previous role: Head of ESG at a Big 4 firm",
        "proof_url": "https://www.infosys.com/newsroom/press-releases/2026/sustainability-officer.html",
        "country_hint": "India",
        "recommended_action": "Infosys CSO hire signals ESG/BRSR compliance becoming a board-level priority. BRSR consulting firms, sustainability software vendors, and ESG data providers should target Infosys immediately.",
        "days_ago": 23,
    },
    {
        "company_name": "Remote.com", "domain": "remote.com",
        "signal_type": "pricing_change", "signal_strength": "medium",
        "title": "Remote.com introduces new contractor payment fee structure — 0.5% FX fee added",
        "summary": "Remote updated their contractor payment pricing to add a 0.5% foreign exchange fee on all cross-border contractor payments. Previously this was included in their flat fee.",
        "proof_text": "Remote Pricing Page diff | Section: 'Contractor Management' | Old: '$29/month per contractor, all-inclusive' | New: '$29/month per contractor + 0.5% FX fee on international payments' | Change detected: 8 days ago | FAQ updated: 'FX fees apply when contractor and company are in different currencies' | Existing customers notified by email",
        "proof_url": "https://remote.com/pricing",
        "country_hint": "Netherlands",
        "recommended_action": "Remote's new FX fee will hurt companies with contractors in multiple countries. Competitive fintech products that offer zero-FX contractor payments should reach out to Remote's customer base with a cost comparison.",
        "days_ago": 6,
    },
    {
        "company_name": "Freshworks", "domain": "freshworks.com",
        "signal_type": "partner_page", "signal_strength": "medium",
        "title": "Freshworks launches Freshworks Marketplace partner accelerator for India ISVs",
        "summary": "Freshworks launched a dedicated accelerator program for India-based ISVs to build and publish apps on the Freshworks Marketplace, with co-marketing and revenue sharing.",
        "proof_text": "Freshworks Marketplace Blog: 'India ISV Accelerator — Build on Freshworks' | Published: 13 days ago | 'Applications open for India-based software vendors to join our Marketplace Accelerator: 6-month program, INR 10L co-marketing fund, 70-30 revenue split, dedicated technical support' | Target: 50 ISVs in cohort | Previous cohort case study: 'Startup grew from 0 to 400 customers using Freshworks Marketplace'",
        "proof_url": "https://marketplace.freshworks.com/accelerator",
        "country_hint": "India",
        "recommended_action": "If you build software that complements Freshworks (HR, Finance, Marketing, IT), apply to this accelerator immediately. INR 10L co-marketing + distribution is hard to pass up for early-stage India SaaS.",
        "days_ago": 11,
    },
    {
        "company_name": "Deel", "domain": "deel.com",
        "signal_type": "compliance_update", "signal_strength": "high",
        "title": "Deel updates Brazil EOR contract terms for new CLT reform compliance",
        "summary": "Deel updated all Brazil Employer-of-Record contract templates to comply with new CLT labor reform rules effective January 2026, including updated profit-sharing and remote work allowance rules.",
        "proof_text": "Deel Help Center: 'Brazil EOR Contract Updates — CLT Reform 2026' | Updated: 5 days ago | Changes: '(1) PLR (profit-sharing) disclosure now mandatory in contracts, (2) Home office stipend: BRL 1,200/month minimum for remote workers, (3) Working hours tracking via app required for all CLT employees' | Existing contracts auto-updated | Customer notification sent",
        "proof_url": "https://help.deel.com/hc/en-us/articles/brazil-clt-2026",
        "country_hint": "Brazil",
        "recommended_action": "Brazil CLT changes mean all EOR customers with Brazilian employees need to review contracts. HR consultants specializing in Brazilian labor law should proactively reach out to multinational companies with Brazil headcount.",
        "days_ago": 3,
    },
    {
        "company_name": "Zoho", "domain": "zoho.com",
        "signal_type": "hiring_spike", "signal_strength": "medium",
        "title": "Zoho hiring 30+ customer success roles in Philippines and Vietnam",
        "summary": "Zoho posted 30+ customer success and support roles in Manila and Ho Chi Minh City, signaling a major ASEAN customer success hub buildout.",
        "proof_text": "Zoho Careers: 30+ active listings in Manila and HCMC | Roles: 'Customer Success Specialist', 'Technical Support Lead', 'Implementation Consultant' | Job description: 'Support Zoho CRM, Books, and Creator customers in ASEAN region' | Manila office address updated on website | LinkedIn: Zoho Philippines employee count grew from 12 to 67 in 90 days",
        "proof_url": "https://careers.zoho.com/jobs?location=Philippines",
        "country_hint": "Philippines",
        "recommended_action": "Zoho building ASEAN CS hub means they need training vendors, office fit-out partners, and potentially HR/payroll setup support in Philippines. Also signals aggressive ASEAN growth — good time to become a Zoho reseller in ASEAN.",
        "days_ago": 8,
    },
    {
        "company_name": "Stripe", "domain": "stripe.com",
        "signal_type": "new_product", "signal_strength": "high",
        "title": "Stripe launches Stripe Tax for India — automated GST filing for SaaS companies",
        "summary": "Stripe launched Stripe Tax India, enabling automatic GST calculation, filing, and reconciliation for SaaS and digital products sold to Indian customers.",
        "proof_text": "Stripe Blog: 'Stripe Tax now available in India — Automate your GST compliance' | Published: 10 days ago | 'Stripe Tax India supports IGST, CGST, SGST calculations, automatic GSTR-1 report generation, and reconciliation with your CA' | Pricing: 0.5% of tax-applicable transactions | Compatible with Stripe Billing and Payment Links | Available to all India-verified businesses immediately",
        "proof_url": "https://stripe.com/in/blog/stripe-tax-india",
        "country_hint": "India",
        "recommended_action": "Stripe Tax India launch disrupts CA-dependent GST filing for small SaaS companies. Accounting firms that rely on manual Stripe reconciliation should update their service offering. ISVs can integrate Stripe Tax API to add value.",
        "days_ago": 8,
    },
]


def _fmt_signal(s: WebSignal) -> dict:
    return {
        "id": str(s.id),
        "account_id": str(s.account_id) if s.account_id else None,
        "company_name": s.company_name,
        "domain": s.domain,
        "signal_type": s.signal_type,
        "signal_strength": s.signal_strength,
        "title": s.title,
        "summary": s.summary,
        "proof_text": s.proof_text,
        "proof_url": s.proof_url,
        "country_hint": s.country_hint,
        "recommended_action": s.recommended_action,
        "is_actioned": s.is_actioned,
        "is_dismissed": s.is_dismissed,
        "detected_at": s.detected_at.isoformat(),
        "created_at": s.created_at.isoformat(),
    }


@signals_router.get("")
async def list_signals(
    signal_type: str = Query(None),
    signal_strength: str = Query(None),
    actioned: bool = Query(None),
    dismissed: bool = Query(False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(WebSignal).where(
        WebSignal.user_id == user.id,
        WebSignal.is_dismissed == dismissed,
    )
    if signal_type:
        q = q.where(WebSignal.signal_type == signal_type)
    if signal_strength:
        q = q.where(WebSignal.signal_strength == signal_strength)
    if actioned is not None:
        q = q.where(WebSignal.is_actioned == actioned)

    result = await db.execute(q.order_by(WebSignal.detected_at.desc()))
    signals = result.scalars().all()

    return {"success": True, "signals": [_fmt_signal(s) for s in signals], "total": len(signals)}


@signals_router.get("/feed")
async def signal_feed(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Latest 20 non-dismissed signals, sorted by strength then recency
    result = await db.execute(
        select(WebSignal)
        .where(WebSignal.user_id == user.id, WebSignal.is_dismissed == False)
        .order_by(WebSignal.detected_at.desc())
        .limit(20)
    )
    signals = result.scalars().all()

    # Sort: high first, then medium, then low
    strength_order = {"high": 0, "medium": 1, "low": 2}
    sorted_signals = sorted(signals, key=lambda s: (strength_order.get(s.signal_strength, 1), -s.detected_at.timestamp()))

    # Stats
    total = await db.execute(select(func.count(WebSignal.id)).where(WebSignal.user_id == user.id, WebSignal.is_dismissed == False))
    high_count = await db.execute(select(func.count(WebSignal.id)).where(WebSignal.user_id == user.id, WebSignal.signal_strength == "high", WebSignal.is_dismissed == False))
    actioned_count = await db.execute(select(func.count(WebSignal.id)).where(WebSignal.user_id == user.id, WebSignal.is_actioned == True))
    watchlist_count = await db.execute(select(func.count(WatchlistAccount.id)).where(WatchlistAccount.user_id == user.id))

    return {
        "success": True,
        "feed": [_fmt_signal(s) for s in sorted_signals],
        "stats": {
            "total": total.scalar() or 0,
            "high_priority": high_count.scalar() or 0,
            "actioned": actioned_count.scalar() or 0,
            "watchlisted_companies": watchlist_count.scalar() or 0,
        },
    }


@signals_router.post("/{signal_id}/action")
async def action_signal(
    signal_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WebSignal).where(WebSignal.id == signal_id, WebSignal.user_id == user.id)
    )
    signal = result.scalar_one_or_none()
    if not signal:
        raise HTTPException(404, "Signal not found")

    signal.is_actioned = True
    await db.commit()
    return {"success": True, "message": "Signal marked as actioned."}


@signals_router.post("/{signal_id}/dismiss")
async def dismiss_signal(
    signal_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WebSignal).where(WebSignal.id == signal_id, WebSignal.user_id == user.id)
    )
    signal = result.scalar_one_or_none()
    if not signal:
        raise HTTPException(404, "Signal not found")

    signal.is_dismissed = True
    await db.commit()
    return {"success": True, "message": "Signal dismissed."}


@signals_router.post("/seed")
async def seed_signals(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check if already seeded
    existing = await db.execute(
        select(func.count(WebSignal.id)).where(WebSignal.user_id == user.id)
    )
    if (existing.scalar() or 0) > 0:
        return {"success": True, "message": "Demo data already exists.", "seeded": 0}

    # Create watchlist accounts
    account_map = {}
    for aw in DEMO_WATCHLIST:
        acc = WatchlistAccount(
            user_id=user.id,
            company_name=aw["company_name"],
            domain=aw["domain"],
            industry=aw["industry"],
            country=aw["country"],
            priority=aw["priority"],
            last_checked=datetime.utcnow(),
        )
        db.add(acc)
        await db.flush()
        account_map[aw["domain"]] = str(acc.id)

    # Create signals
    now = datetime.utcnow()
    seeded = 0
    for sd in DEMO_SIGNALS:
        detected = now - timedelta(days=sd.get("days_ago", random.randint(1, 20)))
        account_id = account_map.get(sd["domain"])
        signal = WebSignal(
            user_id=user.id,
            account_id=account_id,
            company_name=sd["company_name"],
            domain=sd["domain"],
            signal_type=sd["signal_type"],
            signal_strength=sd["signal_strength"],
            title=sd["title"],
            summary=sd["summary"],
            proof_text=sd["proof_text"],
            proof_url=sd["proof_url"],
            country_hint=sd["country_hint"],
            recommended_action=sd["recommended_action"],
            detected_at=detected,
        )
        db.add(signal)
        seeded += 1

    await db.commit()
    return {
        "success": True,
        "message": f"Seeded {seeded} demo signals across {len(DEMO_WATCHLIST)} watchlist accounts.",
        "seeded": seeded,
        "accounts_created": len(DEMO_WATCHLIST),
    }
