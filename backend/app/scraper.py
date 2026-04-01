"""Signal CRM — Web Scraper & Signal Detection Engine

Three detection types:
  A. Hiring Spike       — detects surge in country-specific job postings
  B. Country Page       — detects new country/region pages added to site
  C. New Product Page   — detects new products/solutions listed on site
"""
import hashlib
import json
import re
import asyncio
from datetime import datetime
from typing import Optional
import httpx
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Target export markets for Exporters / IT / SaaS
# ---------------------------------------------------------------------------
EXPORT_COUNTRIES = [
    "Germany","USA","United States","UK","United Kingdom","France","Singapore",
    "UAE","Dubai","Saudi Arabia","Australia","Canada","Japan","Netherlands",
    "Sweden","Israel","South Korea","Brazil","Mexico","Indonesia","Malaysia",
    "South Africa","Nigeria","Kenya","Poland","Czech Republic","Portugal",
    "Belgium","Denmark","Norway","Switzerland","New Zealand","Philippines",
    "Thailand","Vietnam","Egypt","Turkey","Qatar","Bahrain","Kuwait",
]

COUNTRY_SLUGS = [
    "de","fr","sg","ae","au","ca","jp","nl","se","il","kr","br","mx","id",
    "my","za","ng","ke","pl","cz","pt","be","dk","no","ch","nz","ph","th",
    "vn","eg","tr","qa","bh","kw","gb","en-gb","en-us","en-au","en-ca",
    "usa","uae","germany","france","singapore","australia","canada","japan",
    "malaysia","indonesia","south-africa","nigeria","kenya","brazil","mexico",
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; SignalCRM/2.0; +https://nanoneuron.ai)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

TIMEOUT = httpx.Timeout(15.0, connect=8.0)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _md5(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


async def _fetch(client: httpx.AsyncClient, url: str) -> Optional[str]:
    """Fetch URL, return HTML string or None on failure."""
    try:
        resp = await client.get(url, follow_redirects=True, timeout=TIMEOUT, headers=HEADERS)
        if resp.status_code == 200 and "text/html" in resp.headers.get("content-type", ""):
            return resp.text
    except Exception:
        pass
    return None


async def _fetch_xml(client: httpx.AsyncClient, url: str) -> Optional[str]:
    """Fetch sitemap XML."""
    try:
        resp = await client.get(url, follow_redirects=True, timeout=TIMEOUT, headers=HEADERS)
        if resp.status_code == 200:
            return resp.text
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# A. Hiring Spike Detection
# ---------------------------------------------------------------------------

CAREER_PATHS = ["/careers", "/jobs", "/join-us", "/about/careers", "/company/careers",
                "/work-with-us", "/open-positions", "/hiring"]


def _extract_jobs(html: str) -> dict:
    """Extract job postings and country mentions from careers page HTML."""
    soup = BeautifulSoup(html, "html.parser")
    text = _clean(soup.get_text(" "))

    # Count country mentions
    country_counts: dict[str, int] = {}
    for country in EXPORT_COUNTRIES:
        pattern = re.compile(rf"\b{re.escape(country)}\b", re.IGNORECASE)
        count = len(pattern.findall(text))
        if count > 0:
            country_counts[country] = count

    # Count job listing items (heuristic: li/div with "Apply", role titles)
    job_items = soup.find_all(["li", "div", "article"], class_=re.compile(
        r"job|position|role|opening|vacancy|career", re.I))
    job_count = len(job_items)

    # Fallback: count Apply button occurrences
    if job_count == 0:
        job_count = len(re.findall(r"\bApply\b", html, re.IGNORECASE))

    return {
        "job_count": max(job_count, sum(country_counts.values()) // 2),
        "countries": country_counts,
        "excerpt": text[:800],
    }


async def detect_hiring_spike(
    domain: str, client: httpx.AsyncClient,
    prev_job_count: int = 0, prev_countries: dict | None = None
) -> Optional[dict]:
    """Scrape careers page and detect hiring spikes."""
    prev_countries = prev_countries or {}
    base = f"https://{domain.lstrip('https://').lstrip('http://').rstrip('/')}"

    html = None
    found_url = None
    for path in CAREER_PATHS:
        html = await _fetch(client, base + path)
        if html:
            found_url = base + path
            break

    if not html:
        return None

    data = _extract_jobs(html)
    current_count = data["job_count"]
    current_countries = data["countries"]
    content_hash = _md5(data["excerpt"])

    # New country markets detected
    new_countries = [c for c in current_countries if c not in prev_countries]

    # Spike: job count grew by ≥3 or doubled
    spike = (current_count - prev_job_count >= 3) or \
            (prev_job_count > 0 and current_count >= prev_job_count * 1.5)

    if not spike and not new_countries:
        return None

    # Build before/after summary
    before = f"Jobs tracked: {prev_job_count} | Markets: {', '.join(prev_countries.keys()) or 'None'}"
    after_countries = ", ".join(sorted(current_countries.keys())[:8]) or "Various"
    after = f"Jobs detected: {current_count} | Markets: {after_countries}"

    country_hint = new_countries[0] if new_countries else (
        max(current_countries, key=current_countries.get) if current_countries else ""
    )

    description_parts = []
    if new_countries:
        description_parts.append(f"new markets: {', '.join(new_countries[:4])}")
    if spike:
        description_parts.append(f"job count: {prev_job_count} → {current_count}")

    title = (
        f"{domain.split('.')[0].capitalize()} hiring surge detected — "
        + " | ".join(description_parts)
    )

    return {
        "signal_type": "hiring_spike",
        "signal_strength": "high" if (len(new_countries) >= 2 or current_count - prev_job_count >= 10) else "medium",
        "title": title,
        "summary": (
            f"Detected {current_count} job openings"
            + (f" across {', '.join(sorted(current_countries.keys())[:5])}" if current_countries else "")
            + (f". New markets: {', '.join(new_countries[:4])}." if new_countries else ".")
        ),
        "proof_text": f"Careers page: {found_url} | Jobs found: {current_count} | New countries: {', '.join(new_countries[:4]) or 'N/A'}",
        "proof_url": found_url,
        "country_hint": country_hint,
        "recommended_action": (
            f"This company is scaling into {country_hint}. "
            "Reach out this week — they need local partnerships, compliance, or tooling now."
        ),
        "score": min(10, 6 + len(new_countries) + (1 if spike else 0)),
        "before_snapshot": before,
        "after_snapshot": after,
        "content_hash": content_hash,
        "page_url": found_url,
        "page_type": "careers",
        "current_count": current_count,
        "current_countries": current_countries,
    }


# ---------------------------------------------------------------------------
# B. Country Page Detection
# ---------------------------------------------------------------------------

def _extract_country_urls(xml_or_html: str, domain: str) -> list[str]:
    """Extract country/locale-specific URLs from sitemap XML or nav HTML."""
    found = []
    text = xml_or_html

    # From XML sitemap
    urls = re.findall(r"<loc>(https?://[^<]+)</loc>", text)
    for url in urls:
        path = url.lower().replace(f"https://{domain}", "").replace(f"http://{domain}", "")
        for slug in COUNTRY_SLUGS:
            if f"/{slug}" in path or f"/{slug}/" in path or path.startswith(f"/{slug}"):
                found.append(url)
                break

    # From HTML (href attributes in nav)
    if not urls:
        soup = BeautifulSoup(text, "html.parser")
        for a in soup.find_all("a", href=True):
            href = a["href"].lower()
            for slug in COUNTRY_SLUGS:
                if f"/{slug}/" in href or href.startswith(f"/{slug}"):
                    full = href if href.startswith("http") else f"https://{domain}{href}"
                    found.append(full)
                    break

    return list(set(found))


async def detect_country_page(
    domain: str, client: httpx.AsyncClient,
    prev_countries_json: str = "[]"
) -> Optional[dict]:
    """Detect new country/locale pages added to company website."""
    base = f"https://{domain.lstrip('https://').lstrip('http://').rstrip('/')}"
    prev_countries = set(json.loads(prev_countries_json or "[]"))

    # Try sitemap first
    content = await _fetch_xml(client, f"{base}/sitemap.xml")
    source_url = f"{base}/sitemap.xml"
    if not content:
        content = await _fetch(client, base)
        source_url = base
    if not content:
        return None

    current_urls = _extract_country_urls(content, domain)
    current_slugs = set()
    for url in current_urls:
        path = url.lower().replace(f"https://{domain}", "")
        for slug in COUNTRY_SLUGS:
            if f"/{slug}" in path:
                current_slugs.add(slug)
                break

    new_slugs = current_slugs - prev_countries
    if not new_slugs:
        return None

    content_hash = _md5(";".join(sorted(current_slugs)))

    # Map slug back to country name
    SLUG_MAP = {
        "de":"Germany","fr":"France","sg":"Singapore","ae":"UAE","au":"Australia",
        "ca":"Canada","jp":"Japan","nl":"Netherlands","se":"Sweden","il":"Israel",
        "kr":"South Korea","br":"Brazil","mx":"Mexico","id":"Indonesia","my":"Malaysia",
        "za":"South Africa","ng":"Nigeria","ke":"Kenya","pl":"Poland","cz":"Czech Republic",
        "pt":"Portugal","be":"Belgium","dk":"Denmark","no":"Norway","ch":"Switzerland",
        "nz":"New Zealand","ph":"Philippines","th":"Thailand","vn":"Vietnam","eg":"Egypt",
        "tr":"Turkey","qa":"Qatar","gb":"UK","en-gb":"UK","en-us":"USA","en-au":"Australia",
        "germany":"Germany","france":"France","singapore":"Singapore","uae":"UAE",
        "usa":"USA","malaysia":"Malaysia","indonesia":"Indonesia","south-africa":"South Africa",
        "nigeria":"Nigeria","kenya":"Kenya","brazil":"Brazil","mexico":"Mexico",
    }
    new_country_names = [SLUG_MAP.get(s, s.upper()) for s in new_slugs]
    country_hint = new_country_names[0] if new_country_names else ""

    before = f"Country pages: {', '.join(SLUG_MAP.get(s, s) for s in prev_countries) or 'None'}"
    after = f"Country pages: {', '.join(new_country_names[:6])} (NEW) + {len(prev_countries)} existing"

    return {
        "signal_type": "new_country_page",
        "signal_strength": "high" if len(new_slugs) >= 2 else "medium",
        "title": f"{domain.split('.')[0].capitalize()} launches {', '.join(new_country_names[:3])} country page(s)",
        "summary": (
            f"Detected {len(new_slugs)} new country/locale page(s): "
            f"{', '.join(new_country_names[:5])}. "
            "This signals active geographic expansion — a buying trigger for local services."
        ),
        "proof_text": (
            f"Sitemap/nav scan: {source_url} | "
            f"New: {', '.join(f'/{s}/' for s in list(new_slugs)[:4])}"
        ),
        "proof_url": source_url,
        "country_hint": country_hint,
        "recommended_action": (
            f"They just launched in {', '.join(new_country_names[:2])}. "
            "Reach out with local market knowledge, compliance guidance, or channel partnerships."
        ),
        "score": min(10, 7 + len(new_slugs)),
        "before_snapshot": before,
        "after_snapshot": after,
        "content_hash": content_hash,
        "page_url": source_url,
        "page_type": "sitemap",
        "current_countries": list(current_slugs),
    }


# ---------------------------------------------------------------------------
# C. New Product Page Detection
# ---------------------------------------------------------------------------

PRODUCT_PATHS = ["/products", "/solutions", "/features", "/platform",
                 "/services", "/offerings", "/what-we-do"]


def _extract_products(html: str) -> list[str]:
    """Extract product/solution names from a product listing page."""
    soup = BeautifulSoup(html, "html.parser")

    products = []
    # Common product card patterns
    for el in soup.find_all(["h2", "h3", "h4", "strong"], limit=80):
        text = _clean(el.get_text())
        if 3 < len(text) < 80 and not any(x in text.lower() for x in
            ["read more", "learn more", "contact", "sign up", "get started", "pricing",
             "customers", "about us", "copyright", "privacy", "terms"]):
            products.append(text)

    return list(dict.fromkeys(products))[:30]  # dedupe, cap at 30


async def detect_new_product(
    domain: str, client: httpx.AsyncClient,
    prev_products_json: str = "[]"
) -> Optional[dict]:
    """Detect new products/solutions added to company website."""
    base = f"https://{domain.lstrip('https://').lstrip('http://').rstrip('/')}"
    prev_products = set(json.loads(prev_products_json or "[]"))

    html = None
    found_url = None
    for path in PRODUCT_PATHS:
        html = await _fetch(client, base + path)
        if html:
            found_url = base + path
            break

    if not html:
        return None

    current_products = _extract_products(html)
    current_set = set(current_products)
    content_hash = _md5(";".join(sorted(current_set)))

    new_products = [p for p in current_products if p not in prev_products]
    if not new_products:
        return None

    before = f"Products listed: {len(prev_products)} | {', '.join(list(prev_products)[:4])}"
    after = f"Products listed: {len(current_set)} | NEW: {', '.join(new_products[:4])}"

    return {
        "signal_type": "new_product",
        "signal_strength": "high" if len(new_products) >= 3 else "medium",
        "title": f"{domain.split('.')[0].capitalize()} launches new product(s): {', '.join(new_products[:2])}",
        "summary": (
            f"Detected {len(new_products)} new product/solution listing(s): "
            f"{', '.join(new_products[:4])}. "
            "New launches create implementation, integration, and reseller opportunities."
        ),
        "proof_text": (
            f"Products page: {found_url} | "
            f"New items: {', '.join(new_products[:3])}"
        ),
        "proof_url": found_url,
        "country_hint": "",
        "recommended_action": (
            f"They launched '{new_products[0]}'. "
            "Be first to position yourself as the local implementation/integration partner."
        ),
        "score": min(10, 6 + len(new_products)),
        "before_snapshot": before,
        "after_snapshot": after,
        "content_hash": content_hash,
        "page_url": found_url,
        "page_type": "products",
        "current_products": current_products,
    }


# ---------------------------------------------------------------------------
# Full company scan
# ---------------------------------------------------------------------------

async def scan_company(
    domain: str,
    watch_hiring: bool = True,
    watch_expansion: bool = True,
    watch_products: bool = True,
    prev_data: dict | None = None,
) -> list[dict]:
    """Run all detectors on a company domain. Returns list of detected signals."""
    prev = prev_data or {}
    signals = []

    async with httpx.AsyncClient(
        timeout=TIMEOUT, headers=HEADERS, follow_redirects=True
    ) as client:
        tasks = []
        if watch_hiring:
            tasks.append(detect_hiring_spike(
                domain, client,
                prev.get("job_count", 0),
                prev.get("countries", {}),
            ))
        if watch_expansion:
            tasks.append(detect_country_page(
                domain, client,
                prev.get("country_slugs_json", "[]"),
            ))
        if watch_products:
            tasks.append(detect_new_product(
                domain, client,
                prev.get("products_json", "[]"),
            ))

        results = await asyncio.gather(*tasks, return_exceptions=True)

    for r in results:
        if isinstance(r, dict):
            signals.append(r)

    return signals
