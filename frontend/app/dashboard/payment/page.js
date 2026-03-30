"use client";
import { useState, useEffect } from "react";
import { apiFetch, getUser } from "../../../lib/api";

export default function PaymentPage() {
  const [plans, setPlans] = useState([]);
  const [methods, setMethods] = useState(null);
  const [selected, setSelected] = useState("pro");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [msg, setMsg] = useState("");
  const [showBank, setShowBank] = useState(false);
  const user = getUser();

  useEffect(() => {
    Promise.all([apiFetch("/payment/plans"), apiFetch("/payment/methods")]).then(([p, m]) => {
      if (p.success) setPlans(p.plans || []);
      if (m.success) setMethods(m);
      setLoading(false);
    });
  }, []);

  async function payWithRazorpay() {
    setPaying(true); setMsg("");
    const orderRes = await apiFetch("/payment/razorpay/create-order", {
      method: "POST",
      body: JSON.stringify({ plan_id: selected, currency: "INR" }),
    });
    if (!orderRes.success) { setMsg("Error: " + (orderRes.detail || "Could not create order")); setPaying(false); return; }

    const plan = plans.find(p => p.id === selected);
    const options = {
      key: orderRes.key_id,
      amount: orderRes.amount,
      currency: orderRes.currency,
      name: "Signal CRM",
      description: `${plan?.name} Plan — Monthly`,
      order_id: orderRes.order_id,
      handler: async (response) => {
        const verifyRes = await apiFetch("/payment/razorpay/verify", {
          method: "POST",
          body: JSON.stringify({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            plan_id: selected,
          }),
        });
        if (verifyRes.success) {
          setMsg("✓ Payment successful! Your " + plan?.name + " plan is now active. Refreshing…");
          setTimeout(() => window.location.href = "/dashboard", 2500);
        } else {
          setMsg("Payment verification failed. Contact support@nanoneuron.ai");
        }
      },
      prefill: { name: user?.name || "", email: user?.email || "" },
      theme: { color: "#00D9FF" },
      modal: { ondismiss: () => { setPaying(false); } },
    };

    if (typeof window.Razorpay !== "undefined") {
      const rzp = new window.Razorpay(options);
      rzp.open();
    } else {
      setMsg("Loading payment gateway… please wait and try again.");
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => { const rzp = new window.Razorpay(options); rzp.open(); };
      document.body.appendChild(s);
    }
    setPaying(false);
  }

  if (loading) return <div style={{color:"var(--text3)",padding:40}}>Loading plans…</div>;

  const bankMethod = methods?.methods?.find(m=>m.id==="bank_transfer_inr");

  return (
    <div>
      <div style={{marginBottom:28}}>
        <h1 style={{fontSize:22,fontWeight:800,marginBottom:4}}>💳 Upgrade Signal CRM</h1>
        <p style={{color:"var(--text2)",fontSize:13}}>Choose a plan that fits your team. Cancel anytime. One closed deal pays for months.</p>
      </div>

      {msg && (
        <div style={{background:msg.startsWith("✓")?"rgba(63,185,80,0.1)":"rgba(248,81,73,0.1)",border:`1px solid ${msg.startsWith("✓")?"rgba(63,185,80,0.3)":"rgba(248,81,73,0.3)"}`,borderRadius:8,padding:"12px 16px",marginBottom:20,fontSize:13,color:msg.startsWith("✓")?"#3FB950":"#F85149"}}>{msg}</div>
      )}

      {/* Plans */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:28}}>
        {plans.map(p=>(
          <div key={p.id} onClick={()=>setSelected(p.id)} style={{background:p.highlighted?"rgba(0,217,255,0.05)":"var(--surface)",border:`2px solid ${selected===p.id?"var(--accent)":p.highlighted?"rgba(0,217,255,0.3)":"var(--border)"}`,borderRadius:12,padding:"22px 20px",cursor:"pointer",position:"relative",transition:"border-color 0.15s"}}>
            {p.highlighted && <div style={{position:"absolute",top:-1,right:16,background:"linear-gradient(135deg,#00D9FF,#A855F7)",color:"#06080D",fontSize:10,fontWeight:800,padding:"3px 10px",borderRadius:"0 0 8px 8px",letterSpacing:"0.05em"}}>POPULAR</div>}
            <div style={{fontWeight:800,fontSize:16,marginBottom:4}}>{p.name}</div>
            <div style={{fontSize:24,fontWeight:900,color:"var(--accent)",marginBottom:2}}>₹{p.price_inr.toLocaleString()}<span style={{fontSize:13,color:"var(--text3)"}}>/mo</span></div>
            <div style={{fontSize:11,color:"var(--text3)",marginBottom:16}}>USD ${p.price_usd}/mo</div>
            <div style={{fontSize:12,color:"var(--text2)",marginBottom:14,lineHeight:1.5}}>{p.best_for}</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {p.features.map((f,i)=>(
                <div key={i} style={{display:"flex",gap:8,fontSize:12,color:"var(--text2)"}}>
                  <span style={{color:"#3FB950",flexShrink:0}}>✓</span><span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Payment actions */}
      <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:"22px 24px",maxWidth:480}}>
        <div style={{fontWeight:700,marginBottom:4}}>Pay for {plans.find(p=>p.id===selected)?.name} Plan</div>
        <div style={{fontSize:13,color:"var(--text2)",marginBottom:18}}>₹{plans.find(p=>p.id===selected)?.price_inr?.toLocaleString()}/month · Cancel anytime</div>

        <button onClick={payWithRazorpay} disabled={paying} style={{width:"100%",padding:"13px",borderRadius:8,background:"linear-gradient(135deg,#00D9FF,#A855F7)",color:"#06080D",fontWeight:800,fontSize:15,cursor:paying?"not-allowed":"pointer",border:"none",marginBottom:10,opacity:paying?0.7:1}}>
          {paying ? "Opening payment…" : "Pay with Razorpay (UPI / Card / Net Banking)"}
        </button>

        <button onClick={()=>setShowBank(!showBank)} style={{width:"100%",padding:"10px",borderRadius:8,background:"rgba(255,255,255,0.04)",border:"1px solid var(--border)",color:"var(--text2)",fontSize:13,cursor:"pointer"}}>
          {showBank?"Hide":"Show"} Bank Transfer Details
        </button>

        {showBank && bankMethod && (
          <div style={{marginTop:14,background:"rgba(0,0,0,0.25)",borderRadius:8,padding:"14px 16px",fontSize:13}}>
            <div style={{fontWeight:700,marginBottom:10,fontSize:12,color:"var(--text3)",letterSpacing:"0.06em"}}>NEFT / RTGS / IMPS — {bankMethod.bank_name}</div>
            <div style={{display:"flex",flexDirection:"column",gap:6,color:"var(--text2)"}}>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"var(--text3)"}}>Account Name</span><span style={{fontWeight:600}}>{bankMethod.account_holder}</span></div>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"var(--text3)"}}>Account Number</span><span style={{fontWeight:600}}>{bankMethod.account_number}</span></div>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"var(--text3)"}}>IFSC Code</span><span style={{fontWeight:600}}>{bankMethod.ifsc}</span></div>
            </div>
            <div style={{marginTop:10,fontSize:12,color:"var(--text3)"}}>After payment, email receipt to <span style={{color:"var(--accent)"}}>support@nanoneuron.ai</span> — activated within 4 hours.</div>
          </div>
        )}
      </div>
    </div>
  );
}
