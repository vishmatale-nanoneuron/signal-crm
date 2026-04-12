"use client";
import { useState, useEffect } from "react";
import { apiFetch, getUser } from "../../../lib/api";

// ── 16 currencies ─────────────────────────────────────────────────────────────
const CURRENCIES = [
  { code:"INR", symbol:"₹",   flag:"🇮🇳", name:"Indian Rupee",       method:"razorpay", region:"India" },
  { code:"USD", symbol:"$",   flag:"🇺🇸", name:"US Dollar",           method:"swift",    region:"Americas / Global" },
  { code:"EUR", symbol:"€",   flag:"🇪🇺", name:"Euro",                method:"swift",    region:"Europe" },
  { code:"GBP", symbol:"£",   flag:"🇬🇧", name:"British Pound",       method:"swift",    region:"United Kingdom" },
  { code:"AED", symbol:"د.إ", flag:"🇦🇪", name:"UAE Dirham",          method:"swift",    region:"UAE / Gulf" },
  { code:"SGD", symbol:"S$",  flag:"🇸🇬", name:"Singapore Dollar",    method:"swift",    region:"Southeast Asia" },
  { code:"AUD", symbol:"A$",  flag:"🇦🇺", name:"Australian Dollar",   method:"swift",    region:"Oceania" },
  { code:"CAD", symbol:"C$",  flag:"🇨🇦", name:"Canadian Dollar",     method:"swift",    region:"Canada" },
  { code:"JPY", symbol:"¥",   flag:"🇯🇵", name:"Japanese Yen",        method:"swift",    region:"Japan" },
  { code:"BRL", symbol:"R$",  flag:"🇧🇷", name:"Brazilian Real",      method:"swift",    region:"Brazil / LatAm" },
  { code:"MYR", symbol:"RM",  flag:"🇲🇾", name:"Malaysian Ringgit",   method:"swift",    region:"Malaysia" },
  { code:"SAR", symbol:"﷼",   flag:"🇸🇦", name:"Saudi Riyal",         method:"swift",    region:"Saudi Arabia" },
  { code:"ZAR", symbol:"R",   flag:"🇿🇦", name:"South African Rand",  method:"swift",    region:"Africa" },
  { code:"IDR", symbol:"Rp",  flag:"🇮🇩", name:"Indonesian Rupiah",   method:"swift",    region:"Indonesia" },
  { code:"THB", symbol:"฿",   flag:"🇹🇭", name:"Thai Baht",           method:"swift",    region:"Thailand" },
  { code:"NGN", symbol:"₦",   flag:"🇳🇬", name:"Nigerian Naira",      method:"swift",    region:"Nigeria" },
];

const SWIFT_INFO = {
  bank_name:        "Axis Bank Ltd",
  account_holder:   "Nanoneuron Services",
  account_number:   "922020067340454",
  ifsc:             "UTIB0005124",
  swift_code:       "AXISINBB",
  bank_address:     "Tilekar Road Branch, Pune, Maharashtra, India — 411030",
};

const LOCALE_CURRENCY = {
  "en-IN": "INR", "hi": "INR", "hi-IN": "INR",
  "en-GB": "GBP", "en-AU": "AUD", "en-CA": "CAD", "en-SG": "SGD", "en-NG": "NGN",
  "de": "EUR", "fr": "EUR", "es": "EUR", "it": "EUR", "nl": "EUR", "pt": "EUR",
  "ar": "AED", "ar-SA": "SAR", "ms": "MYR", "ja": "JPY", "id": "IDR", "th": "THB",
  "pt-BR": "BRL", "af": "ZAR", "zu": "ZAR",
};

function fmt(n, sym) {
  if (!n) return `${sym}0`;
  if (n >= 1000000) return `${sym}${(n/1000000).toFixed(1)}M`;
  if (n >= 1000) return `${sym}${n.toLocaleString()}`;
  return `${sym}${n}`;
}

export default function PaymentPage() {
  const [plans,      setPlans]      = useState([]);
  const [selected,   setSelected]   = useState("pro");
  const [currency,   setCurrency]   = useState("USD");
  const [billing,    setBilling]    = useState("monthly"); // monthly | annual
  const [loading,    setLoading]    = useState(true);
  const [paying,     setPaying]     = useState(false);
  const [showWire,   setShowWire]   = useState(false);
  const [txRef,      setTxRef]      = useState("");
  const [confirming, setConfirming] = useState(false);
  const [msg,        setMsg]        = useState("");
  const [msgOk,      setMsgOk]      = useState(true);
  const [trial,      setTrial]      = useState(null);
  const [refCode,    setRefCode]    = useState("");
  const [copied,     setCopied]     = useState(false);
  const user = getUser();

  // Auto-detect currency from browser locale
  useEffect(() => {
    const lang = navigator?.language || "en-US";
    const auto = LOCALE_CURRENCY[lang] || LOCALE_CURRENCY[lang.split("-")[0]] || "USD";
    setCurrency(auto);

    Promise.all([
      apiFetch(`/payment/plans?currency=${auto}&billing=monthly`),
      apiFetch("/auth/me"),
      apiFetch("/payment/referral/code").catch(() => null),
    ]).then(([p, me, ref]) => {
      if (p.success) setPlans(p.plans || []);
      if (me.success) setTrial(me.trial);
      if (ref?.success) setRefCode(ref.referral_code);
      setLoading(false);
    });
  }, []);

  // Reload plans when currency or billing changes
  useEffect(() => {
    if (loading) return;
    apiFetch(`/payment/plans?currency=${currency}&billing=${billing}`).then(p => {
      if (p.success) setPlans(p.plans || []);
    });
  }, [currency, billing]);

  const curMeta   = CURRENCIES.find(c => c.code === currency) || CURRENCIES[1];
  const plan      = plans.find(p => p.id === selected);
  const price     = plan?.price_local || plan?.all_prices?.[currency] || plan?.all_prices?.USD || 0;
  const isIndia   = currency === "INR";
  const isAnnual  = billing === "annual";

  function toast(text, ok = true) { setMsg(text); setMsgOk(ok); setTimeout(() => setMsg(""), 8000); }

  async function payRazorpay() {
    setPaying(true);
    const order = await apiFetch("/payment/razorpay/create-order", {
      method: "POST", body: JSON.stringify({ plan_id: selected, currency: "INR" }),
    });
    if (!order.success) { toast("Error: " + (order.detail || "Could not create order"), false); setPaying(false); return; }
    const opts = {
      key: order.key_id, amount: order.amount, currency: "INR",
      name: "Signal CRM — Nanoneuron",
      description: `${plan?.name} Plan ${isAnnual ? "(Annual)" : "(Monthly)"}`,
      order_id: order.order_id,
      handler: async (res) => {
        const v = await apiFetch("/payment/razorpay/verify", {
          method: "POST", body: JSON.stringify({
            razorpay_order_id:  res.razorpay_order_id,
            razorpay_payment_id: res.razorpay_payment_id,
            razorpay_signature:  res.razorpay_signature,
            plan_id: selected,
          }),
        });
        if (v.success) {
          toast(`Payment successful! ${plan?.name} plan activated.`);
          setTimeout(() => window.location.href = "/dashboard", 2200);
        } else {
          toast("Verification failed. Contact support@nanoneuron.ai", false);
        }
      },
      prefill: { name: user?.name || "", email: user?.email || "" },
      theme: { color: "#7C3AED" },
      modal: { ondismiss: () => setPaying(false) },
    };
    const load = () => new window.Razorpay(opts).open();
    if (typeof window.Razorpay !== "undefined") { load(); }
    else {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = load; document.body.appendChild(s);
    }
    setPaying(false);
  }

  async function confirmSWIFT() {
    if (!txRef.trim()) { toast("Enter your SWIFT transaction reference number.", false); return; }
    setConfirming(true);
    const r = await apiFetch("/payment/manual/confirm", {
      method: "POST", body: JSON.stringify({
        plan_id: selected, currency, transaction_ref: txRef,
        notes: `${isAnnual ? "Annual" : "Monthly"} billing — ${curMeta.name}`,
      }),
    });
    if (r.success) toast(r.message + " — " + r.next_step);
    else toast("Error submitting. Email sales@nanoneuron.ai directly.", false);
    setConfirming(false);
  }

  function copyRef() {
    navigator.clipboard?.writeText(refCode);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:300, gap:12, color:"#737373" }}>
      <div style={{ width:22,height:22,border:"2px solid #7C3AED",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite" }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      Loading plans…
    </div>
  );

  return (
    <div style={{ maxWidth:1100, margin:"0 auto", fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif" }}>

      {/* Message bar */}
      {msg && (
        <div style={{ background:msgOk?"rgba(34,197,94,0.08)":"rgba(239,68,68,0.08)", border:`1px solid ${msgOk?"rgba(34,197,94,0.25)":"rgba(239,68,68,0.3)"}`, borderRadius:8, padding:"14px 20px", marginBottom:24, fontSize:13, color:msgOk?"#22c55e":"#ef4444", fontWeight:600 }}>
          {msg}
        </div>
      )}

      {/* Header */}
      <div style={{ textAlign:"center", marginBottom:48 }}>
        {trial?.status === "active" && (
          <div style={{ display:"inline-flex", alignItems:"center", gap:10, background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.2)", borderRadius:10, padding:"10px 20px", marginBottom:24, fontSize:13, color:"#22c55e", fontWeight:600 }}>
            <span style={{ width:8,height:8,background:"#22c55e",borderRadius:"50%",display:"inline-block",boxShadow:"0 0 8px #22c55e" }}/>
            Free trial active — {trial?.days_left ?? 0} days remaining · Upgrade anytime
          </div>
        )}
        {trial?.status === "expired" && (
          <div style={{ display:"inline-flex", alignItems:"center", gap:10, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", borderRadius:10, padding:"12px 24px", marginBottom:24, fontSize:14, color:"#ef4444", fontWeight:700 }}>
            Trial expired — upgrade to restore access
          </div>
        )}
        <div style={{ fontSize:12, fontWeight:700, letterSpacing:"0.12em", color:"#7C3AED", marginBottom:12 }}>SIGNAL CRM — GLOBAL PRICING</div>
        <h1 style={{ fontSize:"clamp(28px,4vw,44px)", fontWeight:800, letterSpacing:"-1.5px", marginBottom:12, background:"linear-gradient(180deg,#fff 60%,rgba(255,255,255,0.5))", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
          Choose your plan
        </h1>
        <p style={{ color:"rgba(255,255,255,0.4)", fontSize:16 }}>Available in 195 countries · Pay in your local currency · Cancel anytime</p>
      </div>

      {/* Billing toggle */}
      <div style={{ display:"flex", justifyContent:"center", marginBottom:32 }}>
        <div style={{ display:"flex", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:3, gap:3 }}>
          {[["monthly","Monthly"],["annual","Annual — 2 months free"]].map(([key,label]) => (
            <button key={key} onClick={() => setBilling(key)} style={{ padding:"9px 22px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:14, fontWeight:600, transition:"all 0.15s", background:billing===key?"#fff":"transparent", color:billing===key?"#141414":"rgba(255,255,255,0.4)" }}>
              {label}
              {key==="annual" && <span style={{ marginLeft:8, fontSize:11, background:"#22c55e", color:"#fff", padding:"2px 8px", borderRadius:99, fontWeight:700 }}>17% OFF</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Currency selector — all 16 */}
      <div style={{ marginBottom:36 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.3)", letterSpacing:"0.1em", textAlign:"center", marginBottom:12 }}>SELECT YOUR CURRENCY</div>
        <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:6 }}>
          {CURRENCIES.map(c => (
            <button key={c.code} onClick={() => setCurrency(c.code)} style={{
              padding:"6px 12px", borderRadius:7, fontSize:12, cursor:"pointer",
              background: currency===c.code ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.04)",
              color: currency===c.code ? "#A855F7" : "rgba(255,255,255,0.4)",
              border: `1px solid ${currency===c.code ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.07)"}`,
              fontWeight: currency===c.code ? 700 : 400,
              transition:"all 0.15s",
            }}>
              {c.flag} {c.code}
            </button>
          ))}
        </div>
        <div style={{ textAlign:"center", marginTop:8, fontSize:12, color:"rgba(255,255,255,0.25)" }}>
          {curMeta.flag} {curMeta.name} · {curMeta.region} · Payment via: {curMeta.method === "razorpay" ? "Razorpay (UPI/Card/NetBanking)" : "SWIFT Wire Transfer"}
        </div>
      </div>

      {/* Plans grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:2, marginBottom:40, alignItems:"start" }}>
        {plans.map(p => {
          const pPrice   = p.price_local || p.all_prices?.[currency] || p.all_prices?.USD || 0;
          const isActive = selected === p.id;
          const annualTotal = isAnnual ? pPrice * 12 : null;
          return (
            <div key={p.id} onClick={() => setSelected(p.id)}
              style={{
                position:"relative", padding:"32px 26px", cursor:"pointer",
                background: isActive ? "rgba(124,58,237,0.08)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${isActive ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.06)"}`,
                transition:"all 0.15s",
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}>

              {p.highlighted && (
                <div style={{ position:"absolute",top:-1,left:"50%",transform:"translateX(-50%)", background:"linear-gradient(135deg,#7C3AED,#A855F7)",color:"#fff",fontSize:10,fontWeight:800,padding:"5px 18px",letterSpacing:"0.1em" }}>
                  MOST POPULAR
                </div>
              )}

              {isActive && (
                <div style={{ position:"absolute",top:12,right:12,width:18,height:18,borderRadius:"50%",background:"#7C3AED",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",fontWeight:800 }}>✓</div>
              )}

              <div style={{ fontSize:12,color:"rgba(255,255,255,0.3)",marginBottom:4 }}>{p.best_for}</div>
              <div style={{ fontSize:20,fontWeight:800,color:"#fff",letterSpacing:"-0.5px",marginBottom:12 }}>{p.name}</div>

              <div style={{ marginBottom:isAnnual?6:20 }}>
                <span style={{ fontSize:40,fontWeight:800,letterSpacing:"-2px",color:isActive?"#A855F7":"#fff" }}>
                  {curMeta.symbol}{pPrice.toLocaleString()}
                </span>
                <span style={{ fontSize:13,color:"rgba(255,255,255,0.3)" }}>/mo</span>
              </div>

              {isAnnual && (
                <div style={{ fontSize:12,color:"#22c55e",marginBottom:20,fontWeight:600 }}>
                  {curMeta.symbol}{(pPrice*10).toLocaleString()} billed annually (2 months free)
                </div>
              )}

              <div style={{ display:"flex",flexDirection:"column",gap:9,marginBottom:24 }}>
                {p.features?.map((f,i) => (
                  <div key={i} style={{ display:"flex",gap:9,fontSize:13 }}>
                    <span style={{ color:isActive?"#A855F7":"#22c55e",flexShrink:0,fontWeight:700,marginTop:1 }}>✓</span>
                    <span style={{ color:"rgba(255,255,255,0.55)",lineHeight:1.5 }}>{f}</span>
                  </div>
                ))}
              </div>

              <button onClick={e => { e.stopPropagation(); setSelected(p.id); }}
                style={{ width:"100%",padding:"11px",border:"none",borderRadius:8,fontFamily:"inherit",fontSize:14,fontWeight:700,cursor:"pointer",transition:"all 0.15s", background:isActive?"linear-gradient(135deg,#7C3AED,#A855F7)":"rgba(255,255,255,0.06)", color:"#fff" }}>
                {isActive ? "Selected ✓" : "Select Plan"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Payment box */}
      <div style={{ maxWidth:560, margin:"0 auto 48px", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, padding:"28px 32px" }}>
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:16,fontWeight:700,color:"#fff",marginBottom:4 }}>
            {plan?.name} Plan · {isAnnual ? "Annual" : "Monthly"}
          </div>
          <div style={{ color:"rgba(255,255,255,0.4)",fontSize:14 }}>
            {curMeta.symbol}{price?.toLocaleString()} {currency}/month
            {isAnnual && <span style={{ color:"#22c55e",marginLeft:8 }}>— billed {curMeta.symbol}{(price*10).toLocaleString()} now (2 months free)</span>}
          </div>
          <div style={{ marginTop:8,fontSize:12,color:"rgba(255,255,255,0.25)",display:"flex",alignItems:"center",gap:6 }}>
            {curMeta.flag} Payment via: {isIndia ? "Razorpay (UPI / Card / Net Banking)" : `SWIFT Wire Transfer — ${curMeta.name}`}
          </div>
        </div>

        {/* India — Razorpay */}
        {isIndia && (
          <button onClick={payRazorpay} disabled={paying}
            style={{ width:"100%",padding:"15px",borderRadius:8,background:"linear-gradient(135deg,#7C3AED,#A855F7)",color:"#fff",fontWeight:700,fontSize:15,cursor:paying?"not-allowed":"pointer",border:"none",marginBottom:10,opacity:paying?0.7:1,fontFamily:"inherit" }}>
            {paying ? "Opening Razorpay…" : `Pay ₹${price?.toLocaleString()} via UPI / Card / Net Banking`}
          </button>
        )}

        {/* International — SWIFT */}
        {!isIndia && (
          <>
            <button onClick={() => setShowWire(w => !w)}
              style={{ width:"100%",padding:"15px",borderRadius:8,background:"linear-gradient(135deg,#7C3AED,#A855F7)",color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer",border:"none",marginBottom:10,fontFamily:"inherit" }}>
              {showWire ? "Hide" : "View"} SWIFT Transfer Details — {curMeta.symbol}{price?.toLocaleString()} {currency}
            </button>

            {showWire && (
              <div style={{ background:"rgba(0,0,0,0.4)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:"20px 22px",marginBottom:12 }}>
                <div style={{ fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.3)",letterSpacing:"0.1em",marginBottom:16 }}>SWIFT / WIRE TRANSFER DETAILS</div>
                {[
                  ["Beneficiary",      SWIFT_INFO.account_holder],
                  ["Bank",             SWIFT_INFO.bank_name],
                  ["Account Number",   SWIFT_INFO.account_number],
                  ["SWIFT / BIC",      SWIFT_INFO.swift_code],
                  ["IFSC",             SWIFT_INFO.ifsc],
                  ["Branch",           SWIFT_INFO.bank_address],
                  ["Amount",           `${curMeta.symbol}${isAnnual?(price*10).toLocaleString():price?.toLocaleString()} ${currency}`],
                  ["Reference",        `Signal CRM ${plan?.name} ${user?.email||""}`],
                ].map(([k,v]) => (
                  <div key={k} style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",gap:12 }}>
                    <span style={{ color:"rgba(255,255,255,0.3)",fontSize:12,flexShrink:0 }}>{k}</span>
                    <span style={{ color:"#fff",fontWeight:600,fontSize:12,textAlign:"right",wordBreak:"break-all" }}>{v}</span>
                  </div>
                ))}

                <div style={{ marginTop:14,padding:"12px 14px",background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:6 }}>
                  <div style={{ fontSize:12,color:"#ef4444",fontWeight:700,marginBottom:4 }}>After transfer:</div>
                  <div style={{ fontSize:12,color:"rgba(255,255,255,0.5)",lineHeight:1.8 }}>
                    1. Email receipt to <strong style={{ color:"#ef4444" }}>sales@nanoneuron.ai</strong><br/>
                    2. Subject: <em>Signal CRM Payment — {user?.email}</em><br/>
                    3. Activated within <strong style={{ color:"#fff" }}>4–8 business hours</strong>
                  </div>
                </div>

                <div style={{ marginTop:16 }}>
                  <div style={{ fontSize:12,color:"rgba(255,255,255,0.4)",marginBottom:8 }}>SWIFT transaction reference (after transfer):</div>
                  <input value={txRef} onChange={e => setTxRef(e.target.value)} placeholder="e.g. AXIS20260412XXXXXXXX"
                    style={{ width:"100%",padding:"10px 14px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,color:"#fff",fontSize:13,outline:"none",boxSizing:"border-box" }}/>
                  <button onClick={confirmSWIFT} disabled={confirming||!txRef.trim()}
                    style={{ width:"100%",marginTop:10,padding:"12px",borderRadius:6,background:txRef.trim()?"#22c55e":"rgba(255,255,255,0.05)",color:txRef.trim()?"#fff":"rgba(255,255,255,0.3)",fontWeight:700,fontSize:14,cursor:txRef.trim()?"pointer":"not-allowed",border:"none",fontFamily:"inherit" }}>
                    {confirming ? "Submitting…" : "Confirm Transfer → Notify Team"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* India: also show NEFT */}
        {isIndia && (
          <>
            <button onClick={() => setShowWire(w => !w)}
              style={{ width:"100%",padding:"11px",borderRadius:8,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.5)",fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:500 }}>
              {showWire ? "Hide" : "Pay via"} NEFT / RTGS / UPI instead
            </button>
            {showWire && (
              <div style={{ marginTop:12,background:"rgba(0,0,0,0.4)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:"16px 20px" }}>
                <div style={{ fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.3)",letterSpacing:"0.08em",marginBottom:14 }}>NEFT / RTGS / IMPS / UPI</div>
                {[["Name",SWIFT_INFO.account_holder],["Account",SWIFT_INFO.account_number],["IFSC",SWIFT_INFO.ifsc],["Bank",SWIFT_INFO.bank_name]].map(([k,v]) => (
                  <div key={k} style={{ display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ color:"rgba(255,255,255,0.3)",fontSize:12 }}>{k}</span>
                    <span style={{ color:"#fff",fontWeight:600,fontSize:12 }}>{v}</span>
                  </div>
                ))}
                <div style={{ marginTop:10,fontSize:12,color:"rgba(255,255,255,0.4)" }}>
                  After transfer → email receipt to <span style={{ color:"#7C3AED" }}>support@nanoneuron.ai</span> — activated within 4 hours.
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ marginTop:16,fontSize:12,color:"rgba(255,255,255,0.25)",textAlign:"center",lineHeight:2 }}>
          🔒 Secure · Cancel anytime · No hidden fees<br/>
          Questions? <span style={{ color:"rgba(255,255,255,0.4)" }}>sales@nanoneuron.ai</span>
        </div>
      </div>

      {/* Referral program */}
      {refCode && (
        <div style={{ background:"rgba(124,58,237,0.06)",border:"1px solid rgba(124,58,237,0.2)",borderRadius:12,padding:"24px 28px",marginBottom:40 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:16 }}>
            <div>
              <div style={{ fontSize:14,fontWeight:700,color:"#A855F7",marginBottom:6 }}>Refer a friend — get 1 month free</div>
              <div style={{ fontSize:13,color:"rgba(255,255,255,0.4)" }}>Share your referral link. Every paid signup earns you 1 free month of Pro.</div>
            </div>
            <div style={{ display:"flex",gap:8,alignItems:"center" }}>
              <div style={{ background:"rgba(0,0,0,0.4)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"9px 16px",fontSize:13,fontWeight:700,color:"#fff",fontFamily:"monospace" }}>
                {refCode}
              </div>
              <button onClick={copyRef}
                style={{ padding:"9px 16px",borderRadius:6,background:copied?"#22c55e":"rgba(124,58,237,0.2)",border:`1px solid ${copied?"#22c55e":"rgba(124,58,237,0.4)"}`,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s" }}>
                {copied ? "Copied!" : "Copy Link"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global coverage */}
      <div style={{ padding:"24px 28px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:12,textAlign:"center" }}>
        <div style={{ fontSize:22,marginBottom:12 }}>🌍</div>
        <div style={{ fontSize:14,fontWeight:700,color:"#fff",marginBottom:8 }}>Available in 195 countries</div>
        <div style={{ fontSize:13,color:"rgba(255,255,255,0.35)",lineHeight:2 }}>
          India → Razorpay (UPI / Cards / Net Banking) &nbsp;·&nbsp; USA, UK, EU, Canada, Australia → SWIFT<br/>
          UAE, Saudi Arabia, Singapore, Japan, Brazil, Nigeria + 100 more → SWIFT wire transfer<br/>
          16 currencies supported &nbsp;·&nbsp; Enterprise custom invoicing: <span style={{ color:"#A855F7" }}>sales@nanoneuron.ai</span>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
