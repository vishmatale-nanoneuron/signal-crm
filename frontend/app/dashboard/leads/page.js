"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

const STATUS_COLORS = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-700",
  replied: "bg-purple-100 text-purple-700",
  qualified: "bg-green-100 text-green-700",
  converted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

const COUNTRIES = ["India","USA","Germany","UK","Singapore","UAE","Canada","Australia","France","Brazil","Japan","Netherlands"];
const INDUSTRIES = ["SaaS","Fintech","IT Services","Logistics","Manufacturing","HR Tech","Ecommerce","Other"];

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [discovered, setDiscovered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [discoverCountry, setDiscoverCountry] = useState("India");
  const [discoverIndustry, setDiscoverIndustry] = useState("SaaS");
  const [discovering, setDiscovering] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ company: "", contact_name: "", title: "", email: "", country: "India", industry: "SaaS", notes: "" });
  const [saving, setSaving] = useState(false);
  const [importingSignals, setImportingSignals] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => { loadLeads(); loadStats(); }, []);

  async function loadLeads() {
    setLoading(true);
    const res = await apiFetch("/leads");
    if (res.success) setLeads(res.leads || []);
    setLoading(false);
  }

  async function loadStats() {
    const res = await apiFetch("/leads/stats");
    if (res.success) setStats(res);
  }

  async function discover() {
    setDiscovering(true);
    const res = await apiFetch("/leads/discover?country=" + encodeURIComponent(discoverCountry) + "&industry=" + encodeURIComponent(discoverIndustry));
    if (res.success) setDiscovered(res.leads || []);
    setDiscovering(false);
  }

  async function addDiscoveredLead(lead) {
    await apiFetch("/leads", { method: "POST", body: JSON.stringify({ company: lead.company, contact_name: lead.contact_name, title: lead.title, country: lead.country, industry: lead.industry }) });
    loadLeads(); loadStats();
  }

  async function importFromSignals() {
    setImportingSignals(true);
    const res = await apiFetch("/leads/import-from-signals", { method: "POST" });
    if (res.success) { alert("Imported " + res.imported + " leads from high-strength signals."); loadLeads(); loadStats(); }
    setImportingSignals(false);
  }

  async function saveLead(e) {
    e.preventDefault(); setSaving(true);
    const res = await apiFetch("/leads", { method: "POST", body: JSON.stringify(form) });
    if (res.success) { setShowAddForm(false); setForm({ company: "", contact_name: "", title: "", email: "", country: "India", industry: "SaaS", notes: "" }); loadLeads(); loadStats(); }
    setSaving(false);
  }

  async function updateStatus(leadId, status) {
    await apiFetch("/leads/" + leadId, { method: "PUT", body: JSON.stringify({ status }) });
    loadLeads(); loadStats();
  }

  async function deleteLead(leadId) {
    if (!confirm("Delete this lead?")) return;
    await apiFetch("/leads/" + leadId, { method: "DELETE" });
    loadLeads(); loadStats();
  }

  const filteredLeads = filterStatus ? leads.filter(l => l.status === filterStatus) : leads;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead Discovery</h1>
          <p className="text-sm text-gray-400 mt-1">Discover, track, and convert cross-border leads</p>
        </div>
        <div className="flex gap-2">
          <button onClick={importFromSignals} disabled={importingSignals}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors">
            {importingSignals ? "Importing..." : "Import from Signals"}
          </button>
          <button onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg text-sm font-medium transition-colors">
            + Add Lead
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-[#1a1a2e] rounded-xl p-4 border border-white/5">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-gray-400">Total Leads</div>
          </div>
          {Object.entries(stats.by_status || {}).slice(0, 4).map(([s, count]) => (
            <div key={s} className="bg-[#1a1a2e] rounded-xl p-4 border border-white/5">
              <div className="text-2xl font-bold text-white">{count}</div>
              <div className="text-xs text-gray-400 capitalize">{s}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-[#1a1a2e] rounded-xl border border-white/5 p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Discover Leads by Market</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Country</label>
            <select value={discoverCountry} onChange={e => setDiscoverCountry(e.target.value)}
              className="bg-[#0f0f1a] border border-white/10 text-white rounded-lg px-3 py-2 text-sm">
              {COUNTRIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Industry</label>
            <select value={discoverIndustry} onChange={e => setDiscoverIndustry(e.target.value)}
              className="bg-[#0f0f1a] border border-white/10 text-white rounded-lg px-3 py-2 text-sm">
              {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
            </select>
          </div>
          <button onClick={discover} disabled={discovering}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
            {discovering ? "Searching..." : "Discover Leads"}
          </button>
        </div>
        {discovered.length > 0 && (
          <div className="mt-4 grid gap-3">
            {discovered.map((lead, i) => (
              <div key={i} className="flex items-center justify-between bg-[#0f0f1a] rounded-lg p-3 border border-white/5">
                <div>
                  <div className="font-medium text-white">{lead.company}</div>
                  <div className="text-sm text-gray-400">{lead.contact_name} — {lead.title} · {lead.country}</div>
                </div>
                <button onClick={() => addDiscoveredLead(lead)}
                  className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs font-medium transition-colors">
                  Add
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddForm && (
        <div className="bg-[#1a1a2e] rounded-xl border border-white/5 p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Add Lead Manually</h2>
          <form onSubmit={saveLead} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[["company","Company *","text",true],["contact_name","Contact Name","text",false],["title","Title / Role","text",false],["email","Email","email",false]].map(([field, label, type, req]) => (
              <div key={field}>
                <label className="block text-xs text-gray-400 mb-1">{label}</label>
                <input type={type} value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })} required={req}
                  className="w-full bg-[#0f0f1a] border border-white/10 text-white rounded-lg px-3 py-2 text-sm" />
              </div>
            ))}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Country</label>
              <select value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}
                className="w-full bg-[#0f0f1a] border border-white/10 text-white rounded-lg px-3 py-2 text-sm">
                {COUNTRIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Industry</label>
              <select value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })}
                className="w-full bg-[#0f0f1a] border border-white/10 text-white rounded-lg px-3 py-2 text-sm">
                {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                className="w-full bg-[#0f0f1a] border border-white/10 text-white rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" disabled={saving}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg text-sm font-medium transition-colors">
                {saving ? "Saving..." : "Add Lead"}
              </button>
              <button type="button" onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-[#1a1a2e] rounded-xl border border-white/5">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">My Leads ({leads.length})</h2>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="bg-[#0f0f1a] border border-white/10 text-white rounded-lg px-3 py-2 text-sm">
            <option value="">All Status</option>
            {["new","contacted","replied","qualified","converted","rejected"].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading leads...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No leads yet. Use Discover Leads above or add manually.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredLeads.map(lead => (
              <div key={lead.id} className="flex items-center justify-between p-4 hover:bg-white/5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{lead.company}</span>
                    <span className={"text-xs px-2 py-0.5 rounded-full " + (STATUS_COLORS[lead.status] || "bg-gray-100 text-gray-700")}>{lead.status}</span>
                    {lead.source === "signal" && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">signal</span>}
                  </div>
                  <div className="text-sm text-gray-400 mt-0.5">{[lead.contact_name, lead.title, lead.country, lead.industry].filter(Boolean).join(" · ")}</div>
                  {lead.email && <div className="text-xs text-blue-400 mt-0.5">{lead.email}</div>}
                  {lead.notes && <div className="text-xs text-gray-500 mt-0.5 truncate max-w-md">{lead.notes}</div>}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <select value={lead.status} onChange={e => updateStatus(lead.id, e.target.value)}
                    className="bg-[#0f0f1a] border border-white/10 text-white rounded text-xs px-2 py-1">
                    {["new","contacted","replied","qualified","converted","rejected"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => deleteLead(lead.id)} className="text-red-400 hover:text-red-300 text-xs px-2 py-1">Del</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
