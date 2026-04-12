"use client";
import { useState, useEffect } from "react";
import { apiFetch, getUser } from "../../../lib/api";

const CURRENCIES = [
  { code:"INR", symbol:"₹",  flag:"🇮🇳", name:"Indian Rupee",       method:"razorpay" },
  { code:"USD", symbol:"$",  flag:"🇺🇸", name:"US Dollar",           method:"swift" },
  { code:"EUR", symbol:"€",  flag:"🇪🇺", name:"Euro",                method:"swift" },
  { code:"GBP", symbol:"£",  flag:"🇬🇧", name:"British Pound",       method:"swift" },
  { code:"AED", symbol:"د.إ",flag:"🇦🇪", name:"UAE Dirham",          method:"swift" },
  { code:"SGD", symbol:"S$", flag:"🇸🇬", name:"Singapore Dollar",    method:"swift" },
  { code:"AUD", symbol:"A$", flag:"🇦🇺", name:"Australian Dollar",   method:"swift" },
  { code:"CAD", symbol:"C$", flag:"🇨🇦", name:"Canadian Dollar",     method:"swift" },
];

const SWIFT_INFO = {
  bank_name: "Axis Bank Ltd",
  account_holder: "Nanoneuron Services",
  account_number: "922020067340454",
  ifsc: "UTIB0005124",
  swift_code: "AXISINBB",
  bank_address: "Tilekar Road Branch, Pune, Maharashtra, India — 411030",
};

export default function PaymentPage() {
  const [plans, setPlans]     = useState([]);
  const [methods, setMethods] = useState(null);
  const [selected, setSelected] = useState("pro");
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading]   = useState(true);
  const [paying, setPaying]     = useState(false);
  const [msg, setMsg]           = useState("");
  const [showWire, setShowWire] = useState(false);
  const [txRef, setTxRef]       = useState("");
  const [confirming, setConfirming] = useState(false);
  const [trial, setTrial]       = useState(null);
  const user = getUser();

  useEffect(() => {
    // Auto-detect currency from browser locale
    const locale = navigator?.language || "en-US";
    if (locale.includes("IN")) setCurrency("INR");
    else if (locale.includes("GB")) setCurrency("GBP");
    else if (locale.includes("DE") || locale.includes("FR") || locale.includes("NL") ||
             locale.includes("ES") || locale.includes("IT")) setCurrency("EUR");
    else if (locale.includes("AU") || locale.includes("NZ")) setCurrency("AUD");
    else if (locale.includes("SG") || locale.includes("MY")) setCurrency("SGD");
    else if (locale.includes("CA")) setCurrency("CAD");
    else setCurrency("USD");

    Promise.all([
      apiFetch("/payment/plans?currency=USD"),
      apiFetch("/payment/methods"),
      apiFetch("/auth/me"),
    ]).then(([p, m, me]) => {
      if (p.success) setPlans(p.plans || []);
      if (m.success) setMethods(m);
      if (me.success) setTrial(me.trial);
      setLoading(false);
    });
  }, []);

  const curMeta = CURRENCIES.find(c => c.code === currency) || CURRENCIES[1];
  const plan = plans.find(p => p.id === selected);
  const price = plan?.all_prices?.[currency] ?? plan?.price_usd ?? 0;
  const isIndia = currency === "INR";

  async function payRazorpay() {
    setPaying(true); setMsg("");
    const order = await apiFetch("/payment/razorpay/create-order", {
      method:"POST", body: JSON.stringify({ plan_id: selected, currency:"INR" }),
    });
    if (!order.success) { setMsg("Error: " + (order.detail || "Could not create order")); setPaying(false); return; }
    const opts = {
      key: order.key_id, amount: order.amount, currency:"INR",
      name:"Signal CRM", description:`${plan?.name} Plan`, order_id: order.order_id,
      handler: async (res) => {
        const v = await apiFetch("/payment/razorpay/verify", { method:"POST", body: JSON.stringify({
          razorpay_order_id: res.razorpay_order_id,
          razorpay_payment_id: res.razorpay_payment_id,
          razorpay_signature: res.razorpay_signature,
          plan_id: selected,
        })});
        setMsg(v.success ? `✓ Payment successful! ${plan?.name} plan is now active.` : "Verification failed. Contact support@nanoneuron.ai");
        if (v.success) setTimeout(() => window.location.href = "/dashboard", 2500);
      },
      prefill:{ name: user?.name || "", email: user?.email || "" },
      theme:{ color:"#7C3AED" },
      modal:{ ondismiss: () => setPaying(false) },
    };
    if (typeof window.Razorpay !== "undefined") { new window.Razorpay(opts).open(); }
    else {
      const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => new window.Razorpay(opts).open(); document.body.appendChild(s);
    }
    setPaying(false);
  }

  async function confirmSWIFT() {
    if (!txRef.trim()) { setMsg("Please enter your SWIFT transaction reference number."); return; }
    setConfirming(true); setMsg("");
    const r = await apiFetch("/payment/manual/confirm", { method:"POST", body: JSON.stringify({
      plan_id: selected, currency, transaction_ref: txRef,
      notes: `SWIFT payment — ${curMeta.name}`,
    })});
    if (r.success) {
      setMsg(`✓ ${r.message} — ${r.next_step}`);
    } else {
      setMsg("Error submitting. Email sales@nanoneuron.ai directly.");
    }
    setConfirming(false);
  }

  if (loading) return <div style={{ color:"#737373", padding:48, textAlign:"center" }}>Loading plans…</div>;

  return (
    <div style={{ maxWidth:1000, margin:"0 auto" }}>

      {/* Header */}
      <div style={{ textAlign:"center", marginBottom:48 }}>
        {/* Payment required banner */}
        <div style={{ display:"inline-flex", alignItems:"center", gap:10, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", borderRadius:10, padding:"12px 24px", marginBottom:24, fontSize:14, color:"#ef4444", fontWeight:700 }}>
          <span style={{ fontSize:18 }}>🔒</span>
          Subscription required — complete payment to unlock Signal CRM
        </div>
        <div style={{ fontSize:12, fontWeight:700, letterSpacing:"0.12em", marginBottom:10, background:"linear-gradient(135deg,#00F0FF,#7C3AED)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>SIGNAL CRM — GLOBAL PRICING</div>
        <h1 style={{ fontSize:38, fontWeight:900, color:"#fff", marginBottom:12 }}>Choose your plan</h1>
        <p style={{ color:"#b3b3b3", fontSize:15 }}>
          Available worldwide. Pay in your local currency via SWIFT or Razorpay. Cancel anytime.
        </p>
      </div>

      {/* Currency selector */}
      <div style={{ display:"flex", justifyContent:"center", gap:8, marginBottom:40, flexWrap:"wrap" }}>
        {CURRENCIES.map(c => (
          <button key={c.code} onClick={() => setCurrency(c.code)} style={{
            padding:"8px 16px", borderRadius:2, fontSize:13, cursor:"pointer",
            background: currency === c.code ? "#fff" : "rgba(255,255,255,0.06)",
            color: currency === c.code ? "#141414" : "#b3b3b3",
            border: currency === c.code ? "none" : "1px solid rgba(255,255,255,0.1)",
            fontWeight: currency === c.code ? 700 : 400,
            transition:"all 0.15s",
          }}>
            {c.flag} {c.code}
          </button>
        ))}
      </div>

      {msg && (
        <div style={{
          background: msg.startsWith("✓") ? "rgba(70,211,105,0.08)" : "rgba(229,9,20,0.08)",
          border: `1px solid ${msg.startsWith("✓") ? "rgba(70,211,105,0.25)" : "rgba(229,9,20,0.3)"}`,
          borderRadius:4, padding:"14px 20px", marginBottom:28,
          fontSize:13, color: msg.startsWith("✓") ? "#46d369" : "#E50914",
        }}>
          {msg}
        </div>
      )}

      {/* Plans grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:4, marginBottom:40 }}>
        {plans.map(p => {
          const pPrice = p.all_prices?.[currency] ?? p.price_usd;
          const isSelected = selected === p.id;
          return (
            <div key={p.id} onClick={() => setSelected(p.id)} style={{
              background: isSelected ? "#fff" : "#1a1a1a",
              border: isSelected ? "none" : "1px solid rgba(255,255,255,0.08)",
              borderRadius:4, padding:"32px 26px",
              cursor:"pointer", position:"relative",
              transition:"all 0.15s",
            }}>
              {p.highlighted && (
                <div style={{ position:"absolute", top:-1, left:"50%", transform:"translateX(-50%)", background:"#E50914", color:"#fff", fontSize:10, fontWeight:800, padding:"4px 14px", borderRadius:"0 0 4px 4px", letterSpacing:"0.08em" }}>
                  MOST POPULAR
                </div>
              )}
              <div style={{ fontSize:18, fontWeight:700, color: isSelected ? "#141414" : "#fff", marginBottom:4 }}>{p.name}</div>
              <div style={{ fontSize:12, color:"#737373", marginBottom:20 }}>{p.best_for}</div>
              <div style={{ marginBottom:4 }}>
                <span style={{ fontSize:36, fontWeight:900, color: isSelected ? "#141414" : "#fff" }}>
                  {curMeta.symbol}{pPrice.toLocaleString()}
                </span>
                <span style={{ fontSize:14, color:"#737373" }}>/mo</span>
              </div>
              <div style={{ fontSize:12, color:"#737373", marginBottom:24 }}>
                {currency !== "USD" && `≈ $${p.price_usd} USD`}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
                {p.features.map((f, i) => (
                  <div key={i} style={{ display:"flex", gap:10, fontSize:13, color: isSelected ? "#232323" : "#b3b3b3" }}>
                    <span style={{ color: isSelected ? "#141414" : "#46d369", flexShrink:0, fontWeight:700 }}>✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment box */}
      <div style={{ background:"#1a1a1a", border:"1px solid rgba(255,255,255,0.1)", borderRadius:4, padding:"28px 32px", maxWidth:540, margin:"0 auto" }}>
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:"#fff", marginBottom:4 }}>{plan?.name} Plan</div>
          <div style={{ color:"#b3b3b3", fontSize:14 }}>
            {curMeta.symbol}{price?.toLocaleString()} {currency}/month · Cancel anytime
          </div>
          <div style={{ marginTop:8, fontSize:12, color:"#737373" }}>
            Payment via: {isIndia ? "🇮🇳 Razorpay (UPI / Card / Net Banking)" : `🌍 SWIFT Wire Transfer (${currency})`}
          </div>
        </div>

        {/* India — Razorpay */}
        {isIndia && (
          <button onClick={payRazorpay} disabled={paying} style={{
            width:"100%", padding:"15px", borderRadius:2,
            background:"#E50914", color:"#fff",
            fontWeight:700, fontSize:15, cursor: paying ? "not-allowed" : "pointer",
            border:"none", marginBottom:10, opacity: paying ? 0.7 : 1,
          }}>
            {paying ? "Opening Razorpay…" : `Pay ₹${price?.toLocaleString()} — UPI / Card / Net Banking`}
          </button>
        )}

        {/* International — SWIFT */}
        {!isIndia && (
          <>
            <button onClick={() => setShowWire(w => !w)} style={{
              width:"100%", padding:"15px", borderRadius:2,
              background:"#E50914", color:"#fff",
              fontWeight:700, fontSize:15, cursor:"pointer",
              border:"none", marginBottom:10,
            }}>
              {showWire ? "Hide" : "Show"} SWIFT Wire Transfer Details — {curMeta.symbol}{price?.toLocaleString()} {currency}
            </button>

            {showWire && (
              <div style={{ background:"rgba(0,0,0,0.45)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:4, padding:"20px 22px", marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#737373", letterSpacing:"0.1em", marginBottom:16 }}>
                  SWIFT / WIRE TRANSFER DETAILS
                </div>

                {[
                  ["Beneficiary Name",    SWIFT_INFO.account_holder],
                  ["Bank Name",           SWIFT_INFO.bank_name],
                  ["Account Number",      SWIFT_INFO.account_number],
                  ["SWIFT / BIC Code",    SWIFT_INFO.swift_code],
                  ["IFSC Code",           SWIFT_INFO.ifsc],
                  ["Bank Address",        SWIFT_INFO.bank_address],
                  ["Amount",              `${curMeta.symbol}${price?.toLocaleString()} ${currency}`],
                  ["Reference",           `Signal CRM - ${plan?.name} - ${user?.email || "your email"}`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.05)", gap:12 }}>
                    <span style={{ color:"#737373", fontSize:13, flexShrink:0 }}>{k}</span>
                    <span style={{ color:"#fff", fontWeight:600, fontSize:13, textAlign:"right" }}>{v}</span>
                  </div>
                ))}

                <div style={{ marginTop:14, padding:"12px 14px", background:"rgba(229,9,20,0.06)", border:"1px solid rgba(229,9,20,0.2)", borderRadius:4 }}>
                  <div style={{ fontSize:12, color:"#E50914", fontWeight:600, marginBottom:4 }}>Important</div>
                  <div style={{ fontSize:12, color:"#b3b3b3", lineHeight:1.7 }}>
                    1. Include your email in the transfer reference<br/>
                    2. Email your SWIFT receipt to <span style={{ color:"#E50914" }}>sales@nanoneuron.ai</span><br/>
                    3. Account will be activated within <strong style={{ color:"#fff" }}>4–8 business hours</strong>
                  </div>
                </div>

                {/* Transaction ref input */}
                <div style={{ marginTop:16 }}>
                  <div style={{ fontSize:12, color:"#b3b3b3", marginBottom:8 }}>Enter SWIFT transaction reference (after transfer):</div>
                  <input
                    value={txRef}
                    onChange={e => setTxRef(e.target.value)}
                    placeholder="e.g. AXIS2024031500001"
                    style={{ width:"100%", padding:"11px 14px", background:"#232323", border:"1px solid rgba(255,255,255,0.12)", borderRadius:2, color:"#fff", fontSize:13 }}
                  />
                  <button onClick={confirmSWIFT} disabled={confirming || !txRef.trim()} style={{
                    width:"100%", marginTop:10, padding:"12px", borderRadius:2,
                    background: txRef.trim() ? "#E50914" : "rgba(255,255,255,0.06)",
                    color: txRef.trim() ? "#fff" : "#737373",
                    fontWeight:700, fontSize:14, cursor: txRef.trim() ? "pointer" : "not-allowed",
                    border:"none", transition:"all 0.15s",
                  }}>
                    {confirming ? "Submitting…" : "Confirm Transfer — Notify Team"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Also show NEFT for India */}
        {isIndia && (
          <button onClick={() => setShowWire(w => !w)} style={{
            width:"100%", padding:"11px", borderRadius:2,
            background:"transparent", border:"1px solid rgba(255,255,255,0.12)",
            color:"#b3b3b3", fontSize:13, cursor:"pointer",
          }}>
            {showWire ? "Hide" : "Show"} Bank Transfer (NEFT / RTGS / UPI)
          </button>
        )}

        {isIndia && showWire && (
          <div style={{ marginTop:12, background:"rgba(0,0,0,0.4)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:4, padding:"16px 18px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#737373", letterSpacing:"0.08em", marginBottom:14 }}>NEFT / RTGS / IMPS / UPI</div>
            {[
              ["Account Name",   SWIFT_INFO.account_holder],
              ["Account Number", SWIFT_INFO.account_number],
              ["IFSC Code",      SWIFT_INFO.ifsc],
              ["Bank",           SWIFT_INFO.bank_name],
            ].map(([k, v]) => (
              <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ color:"#737373", fontSize:13 }}>{k}</span>
                <span style={{ color:"#fff", fontWeight:600, fontSize:13 }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop:10, fontSize:12, color:"#737373" }}>
              After transfer, email receipt to <span style={{ color:"#E50914" }}>support@nanoneuron.ai</span> — activated within 4 hours.
            </div>
          </div>
        )}

        <div style={{ marginTop:16, fontSize:12, color:"#737373", textAlign:"center", lineHeight:1.9 }}>
          🔒 Secure · Cancel anytime · No hidden fees<br/>
          📧 Questions? <span style={{ color:"#b3b3b3" }}>sales@nanoneuron.ai</span>
        </div>
      </div>

      {/* Country coverage note */}
      <div style={{ marginTop:40, padding:"20px 24px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:4, textAlign:"center" }}>
        <div style={{ fontSize:13, color:"#737373", lineHeight:1.9 }}>
          🌍 Available in <strong style={{ color:"#fff" }}>195+ countries</strong> via SWIFT wire transfer &nbsp;·&nbsp;
          🇮🇳 India clients via <strong style={{ color:"#fff" }}>Razorpay + NEFT/UPI</strong><br/>
          Currencies accepted: USD · EUR · GBP · AED · SGD · AUD · CAD · INR<br/>
          Enterprise clients: <span style={{ color:"#E50914" }}>sales@nanoneuron.ai</span> for custom invoicing
        </div>
      </div>
    </div>
  );
}
