// App.tsx — Life Mapper (stable build)

// ========== IMPORTS ==========
import React, { useEffect, useMemo, useState } from "react";

// ========== HELPERS ==========
const toNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const vStr = (v: any) => (v === undefined || v === null ? "" : String(v));
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

const fmtCurrency = (n: number, c = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: c }).format(Number(n) || 0);

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, d: number) => {
  const t = new Date(iso + "T00:00:00");
  t.setDate(t.getDate() + d);
  return t.toISOString().slice(0, 10);
};
const addMonths = (iso: string, m: number) => {
  const t = new Date(iso + "T00:00:00");
  t.setMonth(t.getMonth() + m);
  return t.toISOString().slice(0, 10);
};
const monthKey = (iso?: string) => {
  const d = iso ? new Date(iso + "T00:00:00") : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};
const monthName = (k: string) => {
  const [y, m] = k.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
};

// Robust unique id
const uid = () =>
  (typeof crypto !== "undefined" && (crypto as any).randomUUID)
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2) + "-" + Date.now();

// Frequencies
type Frequency = "weekly" | "fortnightly" | "monthly" | "quarterly" | "yearly";

// ========== STYLES ==========
const shell: React.CSSProperties = { background: "#0e1117", color: "#fff", minHeight: "100vh", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" };
const header: React.CSSProperties = { background: "#111522", borderBottom: "1px solid #2a2f3a", position: "sticky", top: 0, zIndex: 10 };
const container: React.CSSProperties = { maxWidth: 1160, margin: "0 auto", padding: "12px 16px" };
const tabsRow: React.CSSProperties = { display: "flex", gap: 8, overflowX: "auto", padding: "8px 16px 12px" };
const tabBtn = (active: boolean): React.CSSProperties => ({ padding: "8px 12px", borderRadius: 8, border: `1px solid ${active ? "#2563eb" : "#2a2f3a"}`, background: active ? "#1e293b" : "#151a23", color: "#fff", whiteSpace: "nowrap", cursor: "pointer" });
const card: React.CSSProperties = { background: "#151a23", border: "1px solid #2a2f3a", borderRadius: 12, padding: 16, margin: "12px 0" };
const row2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 };
const row3: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 10 };
const label: React.CSSProperties = { display: "block", fontSize: 13, marginBottom: 4, fontWeight: 600 };
const inputS: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #2a2f3a", background: "#0d1117", color: "#fff" };
const smallBtn: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, border: "1px solid #2a2f3a", background: "#2563eb", color: "#fff", cursor: "pointer" };

/* === Pager styles === */
const pagerBar: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
  position: "sticky", bottom: 0, background: "#0e1117", borderTop: "1px solid #2a2f3a",
  padding: "10px 0", marginTop: 16,
};
const pagerBtn = (disabled?: boolean): React.CSSProperties => ({
  padding: "10px 14px", borderRadius: 8,
  border: `1px solid ${disabled ? "#2a2f3a" : "#2563eb"}`,
  background: disabled ? "#151a23" : "#1e293b",
  color: disabled ? "#9ca3af" : "#fff",
  cursor: disabled ? "not-allowed" : "pointer",
  minWidth: 180, display: "inline-flex", justifyContent: "center",
});

// ========== STORAGE HOOK ==========
function useStoredState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
  }, [key, state]);
  return [state, setState] as const;
}

// ---- Reports storage helpers ----
type ReportMonth = {
  month: string;
  incomeTotal: number; expenseTotal: number; savings: number;
  byCategory: Record<string, number>;
  bnplDue: number;
};
function safeGetReports(): ReportMonth[] {
  try {
    const raw = localStorage.getItem("reports");
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveReports(arr: ReportMonth[]) {
  try { localStorage.setItem("reports", JSON.stringify(arr)); } catch {}
}

// ========== TYPES ==========
type TabKey =
  | "profile" | "income" | "expenses" | "goals" | "relationships"
  | "health" | "baby" | "immigration" | "bnpl" | "reports"
  | "feelings" | "advisor";

type Profile = { name: string; email: string; phone: string; country: string; currency: string; };

type Income = {
  id: string; name: string; amount: number;
  frequency: "weekly" | "fortnightly" | "monthly";
  nextDate: string;
  partnerContribution?: boolean; // set to false to exclude
};

type Expense = {
  id: string; name: string; amount: number;
  frequency: Frequency;
  category: string;
  nextDue?: string; // optional → used by calendar export
};

type BNPLPurchase = {
  id: string;
  provider: "Afterpay" | "StepPay";
  total: number;
  startDate: string;
  frequency: "weekly" | "fortnightly";
  paymentsLeft: number; // 0..4
  note?: string;
};

type Goal = { id: string; title: string; target: number; saved: number; deadline?: string; asap?: boolean; priority?: 1 | 2 | 3; achieved?: boolean; };

type RelationshipStatus = "single" | "dating" | "engaged" | "married";
type RelationshipData = {
  status: RelationshipStatus; partnerName?: string; monthsTogether?: number;
  valuesAlignment: number; financialHabits: number; communication: number; conflictResolution: number;
  supportiveness: number; trustSafety: number; workReliability: number; growthMindset: number;
  kidsAlignment: number; lifestyleAlignment: number;
  addictions: "none" | "recovering" | "active";
  controllingBehaviour: "no" | "sometimes" | "yes";
  financialAbuse: "no" | "maybe" | "yes";
  planningMarriageMonths?: number; planningBabyMonths?: number;
  notes?: string;
};

type HealthData = {
  gender: "male" | "female" | "other";
  age: number; heightCm: number; weightKg: number;
  jobType: "desk" | "physical"; hoursPerWeek: number;
  goal: "fat-loss" | "muscle-gain" | "strength" | "endurance";
  conditions?: string;
  weighIns: { date: string; weightKg: number }[];
  workoutsDone: { date: string; minutes: number }[];
};

type ImmigrationStep = { id: string; title: string; target: number; saved: number; notes?: string; achieved?: boolean; };

type Feeling =
  | "Joy" | "Gratitude" | "Calm" | "Proud" | "Hopeful" | "Motivated"
  | "Neutral"
  | "Stressed" | "Anxious" | "Sad" | "Angry" | "Lonely" | "Overwhelmed" | "Tired";

type FeelLog = { date: string; morning?: string; evening?: string; feelings: Feeling[] };

const FEELING_COLORS: Record<Feeling, string> = {
  Joy: "#22c55e", Gratitude: "#84cc16", Calm: "#06b6d4", Proud: "#a78bfa", Hopeful: "#34d399", Motivated: "#10b981",
  Neutral: "#9ca3af",
  Stressed: "#ef4444", Anxious: "#f97316", Sad: "#60a5fa", Angry: "#f43f5e", Lonely: "#f59e0b", Overwhelmed: "#eab308", Tired: "#71717a",
};
/* === Pager (Next/Previous) === */
const TAB_ORDER: TabKey[] = ["profile","income","expenses","goals","relationships","health","baby","immigration","bnpl","reports","feelings","advisor"];
function tabLabel(k: TabKey) {
  const map: Record<TabKey, string> = {
    profile: "Profile", income: "Income", expenses: "Expenses", goals: "Goals",
    relationships: "Relationships", health: "Health", baby: "Baby", immigration: "Immigration",
    bnpl: "BNPL", reports: "Reports", feelings: "Feelings", advisor: "Advisor"
  };
  return map[k];
}
function Pager({ tab, setTab }: { tab: TabKey; setTab: (t: TabKey) => void }) {
  const i = TAB_ORDER.indexOf(tab);
  const prev = i > 0 ? TAB_ORDER[i - 1] : null;
  const next = i < TAB_ORDER.length - 1 ? TAB_ORDER[i + 1] : null;
  return (
    <div style={pagerBar}>
      <button style={pagerBtn(!prev)} disabled={!prev} onClick={() => prev && setTab(prev)}>← {prev ? `Previous: ${tabLabel(prev)}` : "Previous"}</button>
      <button style={pagerBtn(!next)} disabled={!next} onClick={() => next && setTab(next)}>{next ? `Next: ${tabLabel(next)}` : "Next"} →</button>
    </div>
  );
}

/* === SimpleBar (mini bar chart) === */
function SimpleBar({ data, unit, currency }: { data: { label: string; value: number }[]; unit?: string; currency?: string }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div>
      {data.map((d, i) => (
        <div key={i} style={{ margin: "6px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: .9 }}>
            <span>{d.label}</span><span>{currency ? fmtCurrency(d.value, currency) : (unit ? `${d.value}${unit}` : d.value)}</span>
          </div>
          <div style={{ height: 10, background: "#222634", borderRadius: 8 }}>
            <div style={{ height: "100%", width: `${(d.value / max) * 100}%`, background: "#2563eb", borderRadius: 8 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* === Profile Tab === */
function ProfileTab({ profile, setProfile }: { profile: Profile; setProfile: (p: Profile) => void; }) {
  const p = profile;
  const up = (q: Partial<Profile>) => setProfile({ ...p, ...q });
  return (
    <div style={card}>
      <h3>👤 Profile</h3>
      <div style={row2}>
        <div><span style={label}>Name</span><input style={inputS} value={p.name} onChange={e => up({ name: e.target.value })} /></div>
        <div><span style={label}>Email</span><input style={inputS} value={p.email} onChange={e => up({ email: e.target.value })} /></div>
        <div><span style={label}>Phone</span><input style={inputS} value={p.phone} onChange={e => up({ phone: e.target.value })} /></div>
        <div><span style={label}>Country</span><input style={inputS} value={p.country} onChange={e => up({ country: e.target.value })} /></div>
        <div><span style={label}>Currency</span><input style={inputS} value={p.currency} onChange={e => up({ currency: e.target.value || "USD" })} /></div>
      </div>
      <div style={{ fontSize: 12, opacity: .8 }}>We use your currency for all budgets and reports.</div>
    </div>
  );
}

/* === Income Tab === */
function nextFromFrequency(startISO: string, freq: "weekly" | "fortnightly" | "monthly") {
  if (!startISO) return todayISO();
  if (freq === "weekly") return addDays(startISO, 7);
  if (freq === "fortnightly") return addDays(startISO, 14);
  return addMonths(startISO, 1);
}
function IncomeTab({ incomes, setIncomes, currency }: { incomes: Income[]; setIncomes: (x: Income[]) => void; currency: string; }) {
  const add = () => setIncomes([
  ...incomes,
  { id: uid(), name: "Main job", amount: 0, frequency: "fortnightly", nextDate: todayLocalISO() }
]);
  const up = (id: string, q: Partial<Income>) => setIncomes(incomes.map(i => i.id === id ? { ...i, ...q } : i));
  const del = (id: string) => setIncomes(incomes.filter(i => i.id !== id));

  const totalMonthly = useMemo(() => incomes.reduce((s, i) => {
    const mult = i.frequency === "weekly" ? 52 / 12 : i.frequency === "fortnightly" ? 26 / 12 : 1;
    return s + i.amount * mult * (i.partnerContribution === false ? 0 : 1);
  }, 0), [incomes]);

  return (
    <div style={card}>
      <h3>💼 Income</h3>
      {incomes.map((i) => (
        <div key={i.id} style={{ ...card, marginTop: 8 }}>
          <div style={row3}>
            <div><span style={label}>Name</span><input style={inputS} value={i.name} onChange={e => up(i.id, { name: e.target.value })} /></div>
            <div><span style={label}>Amount</span><input type="number" style={inputS} value={vStr(i.amount)} onChange={e => up(i.id, { amount: toNum(e.target.value) })} /></div>
            <div>
              <span style={label}>Frequency</span>
              <select style={inputS} value={i.frequency} onChange={e => up(i.id, { frequency: e.target.value as any })}>
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div><span style={label}>Next pay date</span><input type="date" style={inputS} value={i.nextDate} onChange={e => up(i.id, { nextDate: e.target.value })} /></div>
            <div>
              <span style={label}>Partner contribution?</span>
              <select style={inputS} value={i.partnerContribution === false ? "no" : "yes"} onChange={e => up(i.id, { partnerContribution: e.target.value === "no" ? false : true })}>
                <option value="yes">Yes (include)</option>
                <option value="no">No (exclude)</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={smallBtn} onClick={() => up(i.id, { nextDate: nextFromFrequency(i.nextDate, i.frequency) })}>Advance next date →</button>
            <button style={{ ...smallBtn, background: "#1f2937" }} onClick={() => del(i.id)}>Delete</button>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
        <button style={smallBtn} onClick={add}>+ Add income</button>
        <div style={{ opacity: .9 }}>Projected monthly income: <b>{fmtCurrency(totalMonthly, currency)}</b></div>
      </div>
    </div>
  );
}
/* === Expenses Tab (weekly..yearly) === */
const EXPENSE_CATEGORIES = ["Housing", "Utilities", "Groceries", "Transport", "Loans", "Insurance", "Healthcare", "Education", "Childcare", "Entertainment", "Unexpected", "Other"];
function ExpensesTab({ expenses, setExpenses, currency }: { expenses: Expense[]; setExpenses: (x: Expense[]) => void; currency: string; }) {
  const add = () => setExpenses([
  ...expenses,
  { id: uid(), name: "", amount: 0, frequency: "monthly", category: "Other" }
]);
  const up = (id: string, q: Partial<Expense>) => setExpenses(expenses.map(e => e.id === id ? { ...e, ...q } : e));
  const del = (id: string) => setExpenses(expenses.filter(e => e.id !== id));

  const monthlyTotal = useMemo(() => expenses.reduce((s, e) => {
    const factor = e.frequency === "weekly" ? 52 / 12 :
      e.frequency === "fortnightly" ? 26 / 12 :
        e.frequency === "quarterly" ? 1 / 3 :
          e.frequency === "yearly" ? 1 / 12 : 1;
    return s + e.amount * factor;
  }, 0), [expenses]);

  return (
    <div style={card}>
      <h3>🧾 Expenses</h3>
      {expenses.map(e => (
        <div key={e.id} style={{ ...card, marginTop: 8 }}>
          <div style={row3}>
            <div><span style={label}>Name</span><input style={inputS} value={e.name} onChange={ev => up(e.id, { name: ev.target.value })} /></div>
            <div><span style={label}>Amount</span><input type="number" style={inputS} value={vStr(e.amount)} onChange={ev => up(e.id, { amount: toNum(ev.target.value) })} /></div>
            <div>
              <span style={label}>Frequency</span>
              <select style={inputS} value={e.frequency} onChange={ev => up(e.id, { frequency: ev.target.value as Frequency })}>
                <option>weekly</option><option>fortnightly</option><option>monthly</option><option>quarterly</option><option>yearly</option>
              </select>
            </div>
            <div>
              <span style={label}>Category</span>
              <select style={inputS} value={e.category} onChange={ev => up(e.id, { category: ev.target.value })}>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><span style={label}>Next due (optional)</span><input type="date" style={inputS} value={e.nextDue || ""} onChange={ev => up(e.id, { nextDue: ev.target.value })} /></div>
          </div>
          <button style={{ ...smallBtn, background: "#1f2937" }} onClick={() => del(e.id)}>Delete</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
        <button style={smallBtn} onClick={add}>+ Add expense</button>
        <div>Projected monthly expenses: <b>{fmtCurrency(monthlyTotal, currency)}</b></div>
      </div>
      <div style={{ fontSize:12, opacity:.8, marginTop:6 }}>Tip: set “Next due” to include bills in the exported calendar.</div>
    </div>
  );
}

/* === BNPL (Afterpay / StepPay) === */
function generateBNPLSchedule(p: BNPLPurchase) {
  const stepDays = p.frequency === "weekly" ? 7 : 14;
  const per = Math.round((p.total / 4) * 100) / 100;
  const out: { date: string; amount: number }[] = [];
  let dt = p.startDate;
  for (let i = 0; i < Math.min(4, p.paymentsLeft); i++) {
    out.push({ date: dt, amount: per });
    dt = addDays(dt, stepDays);
  }
  return out;
}
function BNPLTab({ purchases, setPurchases, currency }: { purchases: BNPLPurchase[]; setPurchases: (x: BNPLPurchase[]) => void; currency: string; }) {
  const add = () => setPurchases([...purchases, { id: uid(), provider: "Afterpay", total: 0, startDate: todayISO(), frequency: "weekly", paymentsLeft: 4 }]);
  const up = (id: string, q: Partial<BNPLPurchase>) => setPurchases(purchases.map(p => p.id === id ? { ...p, ...q } : p));
  const del = (id: string) => setPurchases(purchases.filter(p => p.id !== id));

  const monthlyDueMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of purchases) {
      for (const s of generateBNPLSchedule(p)) {
        const k = monthKey(s.date);
        map[k] = (map[k] || 0) + s.amount;
      }
    }
    return map;
  }, [purchases]);

  return (
    <div style={card}>
      <h3>🧩 BNPL (Afterpay / StepPay)</h3>
      {purchases.map(p => (
        <div key={p.id} style={{ ...card, marginTop: 8 }}>
          <div style={row3}>
            <div>
              <span style={label}>Provider</span>
              <select style={inputS} value={p.provider} onChange={e => up(p.id, { provider: e.target.value as any })}>
                <option>Afterpay</option><option>StepPay</option>
              </select>
            </div>
            <div><span style={label}>Total purchase</span><input type="number" style={inputS} value={vStr(p.total)} onChange={e => up(p.id, { total: toNum(e.target.value) })} /></div>
            <div>
              <span style={label}>Frequency</span>
              <select style={inputS} value={p.frequency} onChange={e => up(p.id, { frequency: e.target.value as any })}>
                <option>weekly</option><option>fortnightly</option>
              </select>
            </div>
            <div><span style={label}>First payment</span><input type="date" style={inputS} value={p.startDate} onChange={e => up(p.id, { startDate: e.target.value })} /></div>
            <div><span style={label}>Payments left (max 4)</span><input type="number" min={0} max={4} style={inputS} value={vStr(p.paymentsLeft)} onChange={e => up(p.id, { paymentsLeft: clamp(toNum(e.target.value), 0, 4) })} /></div>
            <div><span style={label}>Note</span><input style={inputS} value={p.note || ""} onChange={e => up(p.id, { note: e.target.value })} /></div>
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Schedule</div>
            {generateBNPLSchedule(p).map((s, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px dashed #2a2f3a" }}>
                <div>{s.date}</div><div>{fmtCurrency(s.amount, currency)}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8 }}>
            <button style={{ ...smallBtn, background: "#1f2937" }} onClick={() => del(p.id)}>Delete</button>
          </div>
          <div style={{fontSize:12, opacity:.8, marginTop:6}}>Tip: export calendar to push these payments to your phone calendar.</div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
        <button style={smallBtn} onClick={add}>+ Add BNPL</button>
        <div>Current month BNPL due: <b>{fmtCurrency(monthlyDueMap[monthKey()] || 0, currency)}</b></div>
      </div>
    </div>
  );
}

/* === Goals (ASAP estimate & priorities) === */
function estimateMonthlySavings(incomes: Income[], expenses: Expense[], bnpl: BNPLPurchase[]) {
  const incomeMonthly = incomes.reduce((s, i) => s + i.amount * (i.frequency === "weekly" ? 52 / 12 : i.frequency === "fortnightly" ? 26 / 12 : 1) * (i.partnerContribution === false ? 0 : 1), 0);
  const expenseMonthly = expenses.reduce((s, e) => s + e.amount * (e.frequency === "weekly" ? 52 / 12 : e.frequency === "fortnightly" ? 26 / 12 : e.frequency === "quarterly" ? 1 / 3 : e.frequency === "yearly" ? 1 / 12 : 1), 0);
  const bnplMonth = bnpl.reduce((s, p) => {
    const sched = generateBNPLSchedule(p).filter(s => monthKey(s.date) === monthKey());
    return s + sched.reduce((a, b) => a + b.amount, 0);
  }, 0);
  return Math.max(0, incomeMonthly - expenseMonthly - bnplMonth);
}
function asapDateForGoal(target: number, saved: number, monthlySave: number) {
  if (target <= saved || monthlySave <= 0) return "—";
  const monthsNeeded = Math.ceil((target - saved) / monthlySave);
  return monthName(monthKey(addMonths(todayISO(), monthsNeeded)));
}
const pad2 = (n:number)=> String(n).padStart(2,"0");
const ymdLocal = (y:number,m:number,d:number)=> `${y}-${pad2(m)}-${pad2(d)}`;
const todayLocalISO = () => {
  const t = new Date();
  return ymdLocal(t.getFullYear(), t.getMonth()+1, t.getDate());
};
function GoalsTab({ goals, setGoals, incomes, expenses, bnpl, currency }: { goals: Goal[]; setGoals: (x: Goal[]) => void; incomes: Income[]; expenses: Expense[]; bnpl: BNPLPurchase[]; currency: string; }) {
  const add = () => setGoals([
  ...goals,
  { id: uid(), title: "New goal", target: 0, saved: 0, asap: true, priority: 3 }
]);
  const up = (id: string, q: Partial<Goal>) => setGoals(goals.map(g => g.id === id ? { ...g, ...q } : g));
  const del = (id: string) => setGoals(goals.filter(g => g.id !== id));

  const monthlySave = useMemo(() => estimateMonthlySavings(incomes, expenses, bnpl), [incomes, expenses, bnpl]);

  return (
    <div style={card}>
      <h3>🎯 Goals</h3>
      <div style={{ fontSize: 12, opacity: .85, marginBottom: 8 }}>Set <b>ASAP</b> or choose a deadline. Prioritize 1 / 2 / 3. Mark achieved when done.</div>
      {goals.sort((a, b) => (a.priority || 3) - (b.priority || 3)).map(g => {
        const asapEta = g.asap ? asapDateForGoal(g.target, g.saved, monthlySave) : undefined;
        return (
          <div key={g.id} style={{ ...card, marginTop: 8 }}>
            <div style={row3}>
              <div><span style={label}>Title</span><input style={inputS} value={g.title} onChange={e => up(g.id, { title: e.target.value })} /></div>
              <div><span style={label}>Target</span><input type="number" style={inputS} value={vStr(g.target)} onChange={e => up(g.id, { target: toNum(e.target.value) })} /></div>
              <div><span style={label}>Saved so far</span><input type="number" style={inputS} value={vStr(g.saved)} onChange={e => up(g.id, { saved: toNum(e.target.value) })} /></div>
              <div><span style={label}>Priority</span>
                <select style={inputS} value={g.priority || 3} onChange={e => up(g.id, { priority: toNum(e.target.value) as 1 | 2 | 3 })}>
                  <option value={1}>1 (first)</option><option value={2}>2</option><option value={3}>3</option>
                </select>
              </div>
              <div><span style={label}>ASAP?</span>
                <select style={inputS} value={g.asap ? "yes" : "no"} onChange={e => up(g.id, { asap: e.target.value === "yes" })}>
                  <option value="yes">Yes</option><option value="no">No (use deadline)</option>
                </select>
              </div>
              {!g.asap && (
                <div><span style={label}>Deadline</span><input type="date" style={inputS} value={g.deadline || ""} onChange={e => up(g.id, { deadline: e.target.value })} /></div>
              )}
            </div>
            <div style={{ marginTop: 6, fontSize: 13 }}>
              {g.asap ? <>Estimated completion: <b>{asapEta}</b> (based on current monthly savings)</> : <>Deadline: <b>{g.deadline || "—"}</b></>}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap:"wrap" }}>
              <button style={{ ...smallBtn, background: g.achieved ? "#15803d" : "#1e293b" }} onClick={() => up(g.id, { achieved: !g.achieved })}>
                {g.achieved ? "✓ Achieved" : "Mark achieved"}
              </button>
              <button style={{ ...smallBtn, background: "#1f2937" }} onClick={() => del(g.id)}>Delete</button>
            </div>
          </div>
        );
      })}
      <button style={smallBtn} onClick={add}>+ Add goal</button>
      <div style={{ marginTop: 8, fontSize: 12, opacity: .85 }}>Suggested order: Emergency fund → Debt → House → Car → Holidays</div>
    </div>
  );
}
/* === Relationships (score + advice) === */
function clamp1to5(n: number) { return clamp(Math.round(n || 1), 1, 5); }
function scoreRelationship(d: RelationshipData) {
  const items = [
    d.valuesAlignment, d.financialHabits, d.communication, d.conflictResolution,
    d.supportiveness, d.trustSafety, d.workReliability, d.growthMindset,
    d.kidsAlignment, d.lifestyleAlignment
  ].map(clamp1to5);
  let base = items.reduce((s, v) => s + v, 0) / items.length; // 1..5
  let score = ((base - 1) / 4) * 100;

  const redFlags: string[] = [];
  if (d.addictions === "active") { score -= 25; redFlags.push("Active addiction present"); }
  if (d.controllingBehaviour === "yes") { score -= 30; redFlags.push("Controlling/abusive behaviour"); }
  if (d.financialAbuse === "yes") { score -= 35; redFlags.push("Financial abuse indicators"); }
  if (d.trustSafety <= 2) { score -= 15; redFlags.push("Low trust / emotional safety"); }
  if (d.conflictResolution <= 2) { score -= 10; redFlags.push("Poor conflict resolution"); }
  score = clamp(Math.round(score), 0, 100);

  let band: "green" | "amber" | "red" = "green";
  if (score < 60) band = "red"; else if (score < 80) band = "amber";

  const summary: string[] = [];
  if (band === "green") summary.push("Overall healthy patterns. Keep nurturing habits.");
  if (band === "amber") summary.push("Promising core; address amber areas together.");
  if (band === "red") summary.push("High risk signals. Seek guidance before major commitments.");
  if (d.communication < 4) summary.push("Weekly check-ins: wins, worries, plans.");
  if (d.financialHabits < 4) summary.push("Create a shared budget & emergency fund.");
  if (d.valuesAlignment < 4) summary.push("Write individual 3-year vision and merge.");
  if (d.kidsAlignment < 4) summary.push("Clarify timing and parenting approach.");
  if (d.workReliability < 4) summary.push("Stabilize income before big commitments.");
  if (d.growthMindset < 4) summary.push("Adopt continuous learning together.");

  return { score, band, summary, redFlags };
}
function Slider({ labelText, value, onChange }: { labelText: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <span style={label}>{labelText} <b style={{ opacity: .8 }}>({value})</b></span>
      <input type="range" min={1} max={5} value={value} onChange={e => onChange(toNum(e.target.value))} style={{ width: "100%" }} />
      <div style={{ fontSize: 12, opacity: .8, marginTop: 4 }}>1 = poor • 5 = excellent</div>
    </div>
  );
}
function RelationshipsTab({ data, setData }: { data: RelationshipData; setData: (d: RelationshipData) => void; }) {
  const d = data, up = (q: Partial<RelationshipData>) => setData({ ...d, ...q });
  const adv = scoreRelationship(d);
  return (
    <div style={card}>
      <h3>❤️ Relationships</h3>
      <div style={row3}>
        <div><span style={label}>Status</span>
          <select style={inputS} value={d.status} onChange={e => up({ status: e.target.value as any })}>
            <option>single</option><option>dating</option><option>engaged</option><option>married</option>
          </select>
        </div>
        <div><span style={label}>Partner name (optional)</span><input style={inputS} value={d.partnerName || ""} onChange={e => up({ partnerName: e.target.value })} /></div>
        <div><span style={label}>Months together</span><input type="number" style={inputS} value={vStr(d.monthsTogether)} onChange={e => up({ monthsTogether: toNum(e.target.value) })} /></div>
      </div>

      <div style={{ ...card, marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>Alignment (1–5)</h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Slider labelText="Values & future" value={d.valuesAlignment} onChange={v => up({ valuesAlignment: v })} />
          <Slider labelText="Financial habits" value={d.financialHabits} onChange={v => up({ financialHabits: v })} />
          <Slider labelText="Communication" value={d.communication} onChange={v => up({ communication: v })} />
          <Slider labelText="Conflict resolution" value={d.conflictResolution} onChange={v => up({ conflictResolution: v })} />
          <Slider labelText="Supportiveness" value={d.supportiveness} onChange={v => up({ supportiveness: v })} />
          <Slider labelText="Trust & safety" value={d.trustSafety} onChange={v => up({ trustSafety: v })} />
          <Slider labelText="Work reliability" value={d.workReliability} onChange={v => up({ workReliability: v })} />
          <Slider labelText="Growth mindset" value={d.growthMindset} onChange={v => up({ growthMindset: v })} />
          <Slider labelText="Kids alignment" value={d.kidsAlignment} onChange={v => up({ kidsAlignment: v })} />
          <Slider labelText="Lifestyle alignment" value={d.lifestyleAlignment} onChange={v => up({ lifestyleAlignment: v })} />
        </div>
      </div>

      <div style={{ ...card, marginTop: 12, background: adv.band === "green" ? "#102a1b" : adv.band === "amber" ? "#2a2323" : "#2a1414", borderColor: adv.band === "green" ? "#184f31" : adv.band === "amber" ? "#4b3a2a" : "#5a2323" }}>
        <h4 style={{ marginTop: 0 }}>Assessment</h4>
        <div>Score: <b>{adv.score}/100</b> — {adv.band === "green" ? "Healthy" : adv.band === "amber" ? "Work-on areas" : "Caution"}</div>
        {adv.redFlags.length > 0 && (<div style={{ marginTop: 6 }}><div style={{ fontWeight: 700 }}>Red flags:</div><ul>{adv.redFlags.map((r, i) => <li key={i}>{r}</li>)}</ul></div>)}
        <div style={{ marginTop: 6 }}><div style={{ fontWeight: 700 }}>Suggestions:</div><ul>{adv.summary.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
        <div style={{ fontSize: 12, opacity: .8, marginTop: 6 }}>Educational guidance only — seek pro help for safety concerns.</div>
      </div>
    </div>
  );
}

/* === Health (plans + workout logging) === */
function bmiKgM2(weightKg: number, heightCm: number) {
  if (!weightKg || !heightCm) return 0;
  const m = heightCm / 100;
  return +(weightKg / (m * m)).toFixed(1);
}
function buildWorkoutPlan(h: HealthData) {
  const basePush = [{ name: "Barbell Bench Press", sets: 4, reps: "6-8" }, { name: "Overhead Press", sets: 3, reps: "8-10" }, { name: "Incline DB Press", sets: 3, reps: "10-12" }];
  const basePull = [{ name: "Deadlift", sets: 3, reps: "3-5" }, { name: "Bent-Over Row", sets: 4, reps: "6-8" }, { name: "Lat Pulldown / Pull-ups", sets: 3, reps: "8-12" }];
  const baseLegs = [{ name: "Back Squat", sets: 4, reps: "5-8" }, { name: "Romanian Deadlift", sets: 3, reps: "8-10" }, { name: "Lunges / Leg Press", sets: 3, reps: "10-12" }];
  const baseFull = [{ name: "Goblet Squat", sets: 3, reps: "10-12" }, { name: "Push-ups", sets: 3, reps: "8-15" }, { name: "DB Row", sets: 3, reps: "10-12" }, { name: "Plank", sets: 3, reps: "30-45s" }];

  const time = h.hoursPerWeek;
  const jobAdj = h.jobType === "physical" ? 0.9 : 1;
  const goal = h.goal;

  let days = 3;
  if (time >= 5) days = 4; if (time >= 7) days = 5;

  let split: { day: string; items: { name: string; sets: number; reps: string }[] }[] = [];
  if (goal === "strength") {
    split = [{ day: "Day 1 — Legs", items: baseLegs }, { day: "Day 2 — Push", items: basePush }, { day: "Day 3 — Pull", items: basePull }, ...(days >= 4 ? [{ day: "Day 4 — Full body", items: baseFull }] : [])];
  } else if (goal === "muscle-gain") {
    split = [
      { day: "Day 1 — Push (Hypertrophy)", items: basePush.concat([{ name: "Cable Fly", sets: 3, reps: "12-15" }]) },
      { day: "Day 2 — Pull (Hypertrophy)", items: basePull.concat([{ name: "Face Pulls", sets: 3, reps: "12-15" }]) },
      { day: "Day 3 — Legs (Hypertrophy)", items: baseLegs.concat([{ name: "Calf Raises", sets: 3, reps: "12-15" }]) },
      ...(days >= 4 ? [{ day: "Day 4 — Upper pump", items: [{ name: "DB Press", sets: 3, reps: "10-12" }, { name: "Lat Pulldown", sets: 3, reps: "10-12" }, { name: "Curls", sets: 3, reps: "10-12" }] }] : [])
    ];
  } else if (goal === "endurance") {
    split = [
      { day: "Day 1 — Full-body strength", items: baseFull },
      { day: "Day 2 — Cardio Intervals", items: [{ name: "Bike/Row/Run intervals", sets: 8, reps: "45s hard / 75s easy" }] },
      { day: "Day 3 — Tempo cardio", items: [{ name: "Steady state 35–45min", sets: 1, reps: "Zone 2–3" }] },
      ...(days >= 4 ? [{ day: "Day 4 — Mobility + core", items: [{ name: "Hip flow + plank", sets: 4, reps: "60–90s" }] }] : [])
    ];
  } else {
    split = [
      { day: "Day 1 — Push + Cardio", items: basePush.concat([{ name: "Incline walk 20–30min", sets: 1, reps: "Zone 2" }]) },
      { day: "Day 2 — Legs", items: baseLegs },
      { day: "Day 3 — Pull + Cardio", items: basePull.concat([{ name: "Row/Bike 15–20min", sets: 1, reps: "Zone 2" }]) },
      ...(days >= 4 ? [{ day: "Day 4 — Full body circuit", items: baseFull }] : [])
    ];
  }

  if (jobAdj < 1) split = split.map(d => ({ ...d, items: d.items.map(it => ({ ...it, sets: Math.max(2, Math.round(it.sets * jobAdj)) })) }));
  return split;
}
function buildDietAdvice(h: HealthData) {
  const bmi = bmiKgM2(h.weightKg, h.heightCm);
  const proteinG = h.goal === "muscle-gain" || h.goal === "strength" ? Math.round(h.weightKg * 1.8) : Math.round(h.weightKg * 1.6);
  const kcalHint = h.goal === "fat-loss" ? "aim ~300–500 kcal deficit" : h.goal === "muscle-gain" ? "aim ~200–300 kcal surplus" : "aim maintenance kcal";
  const focus = [
    `Protein ${proteinG} g/day (lean meats, fish, eggs, Greek yogurt, tofu)`,
    "Complex carbs (oats, brown rice, quinoa, legumes, fruit/veg)",
    "Healthy fats (olive oil, avocado, nuts, seeds)",
    "Hydration 2–3L/day; electrolytes if training hard",
    "Micronutrients: leafy greens, colorful veg, berries"
  ];
  const avoid = [
    "Ultra-processed snacks, high added sugars",
    "Sugary drinks / heavy alcohol",
    "Trans fats; limit deep-fried foods",
    "Late-night large meals if sleep suffers"
  ];
  if (h.goal === "endurance") focus.push("Carb timing: more carbs around long/interval sessions");
  if (h.goal === "strength" || h.goal === "muscle-gain") focus.push("Creatine monohydrate 3–5g/day (if appropriate)");
  if (h.jobType === "physical") focus.push("Extra carbs around shifts; prioritize sleep 7–9h");
  return { bmi, kcalHint, focus, avoid };
}
function LogWorkoutForm({onAdd}:{onAdd:(date:string, minutes:number)=>void}) {
  const [d, setD] = useState(todayISO());
  const [m, setM] = useState(45);
  return (
    <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <input type="date" style={inputS} value={d} onChange={e=>setD(e.target.value)} />
      <input type="number" style={{...inputS, width:90}} value={vStr(m)} onChange={e=>setM(toNum(e.target.value))} />
      <button style={smallBtn} onClick={()=> onAdd(d, Math.max(5, m||0))}>Add</button>
    </div>
  );
}
function HealthTab({ data, setData }: { data: HealthData; setData: (x: HealthData) => void; }) {
  const defaults: HealthData = { gender: "male", age: 30, heightCm: 175, weightKg: 75, jobType: "desk", hoursPerWeek: 4, goal: "fat-loss", conditions: "", weighIns: [], workoutsDone: [] };
  const h: HealthData = { ...defaults, ...data, weighIns: Array.isArray((data as any)?.weighIns) ? (data as any).weighIns : [], workoutsDone: Array.isArray((data as any)?.workoutsDone) ? (data as any).workoutsDone : [] };
  const up = (q: Partial<HealthData>) => setData({ ...h, ...q });
  const plan = buildWorkoutPlan(h);
  const diet = buildDietAdvice(h);
  const addWeigh = () => up({ weighIns: [...(h.weighIns || []), { date: todayISO(), weightKg: h.weightKg || 0 }] });
  const logWorkout = () => up({ workoutsDone: [...(h.workoutsDone || []), { date: todayISO(), minutes: 45 }] });

  return (
    <div style={card}>
      <h3>💪 Health & Training</h3>
      <div style={row3}>
        <div><span style={label}>Gender</span>
          <select style={inputS} value={h.gender} onChange={e => up({ gender: e.target.value as any })}>
            <option>male</option><option>female</option><option>other</option>
          </select>
        </div>
        <div><span style={label}>Age</span><input type="number" style={inputS} value={vStr(h.age)} onChange={e => up({ age: toNum(e.target.value) })} /></div>
        <div><span style={label}>Job type</span>
          <select style={inputS} value={h.jobType} onChange={e => up({ jobType: e.target.value as any })}>
            <option>desk</option><option>physical</option>
          </select>
        </div>
        <div><span style={label}>Hours available / week</span><input type="number" style={inputS} value={vStr(h.hoursPerWeek)} onChange={e => up({ hoursPerWeek: toNum(e.target.value) })} /></div>
        <div><span style={label}>Height (cm)</span><input type="number" style={inputS} value={vStr(h.heightCm)} onChange={e => up({ heightCm: toNum(e.target.value) })} /></div>
        <div><span style={label}>Weight (kg)</span><input type="number" style={inputS} value={vStr(h.weightKg)} onChange={e => up({ weightKg: toNum(e.target.value) })} /></div>
        <div><span style={label}>Goal</span>
          <select style={inputS} value={h.goal} onChange={e => up({ goal: e.target.value as any })}>
            <option value="fat-loss">Fat loss</option><option value="muscle-gain">Muscle gain</option><option value="strength">Strength</option><option value="endurance">Endurance</option>
          </select>
        </div>
        <div><span style={label}>Health conditions (if any)</span><input style={inputS} value={h.conditions || ""} onChange={e => up({ conditions: e.target.value })} /></div>
      </div>

      <div style={{ marginTop: 8 }}>BMI: <b>{diet.bmi || "—"}</b> • Calorie guidance: <b>{diet.kcalHint}</b></div>

      <div style={{ ...card, marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>Workout plan (sets × reps)</h4>
        {plan.map((d, idx) => (
          <div key={idx} style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>{d.day}</div>
            <ul style={{ marginTop: 6 }}>
              {d.items.map((it, i) => <li key={i}>{it.name} — <b>{it.sets} × {it.reps}</b></li>)}
            </ul>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, alignItems:"center", flexWrap:"wrap" }}>
          <button style={smallBtn} onClick={logWorkout}>+ Log 45min workout today</button>
          <LogWorkoutForm onAdd={(date, minutes)=> up({ workoutsDone: [...(h.workoutsDone||[]), {date, minutes}] })} />
          <button style={smallBtn} onClick={addWeigh}>+ Log current weight</button>
        </div>
      </div>

      <div style={{ ...card, marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>Diet plan</h4>
        <div><b>Focus:</b><ul>{diet.focus.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
        <div><b>Avoid / limit:</b><ul>{diet.avoid.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
        <div style={{ fontSize: 12, opacity: .8 }}>For medical issues, consult a qualified professional.</div>
      </div>
    </div>
  );
}

/* === Baby Planning === */
function BabyTab() {
  const [cfg, setCfg] = useStoredState("babyCfg", { diapers: 120, formula: 0, health: 50, clothing: 40, misc: 50, setup: 1500, bufferMonths: 3, childcare: 0, parentLeaveLostIncome: 0 });
  return (
    <div style={card}>
      <h3>👶 Baby Planning</h3>
      <div style={row3}>
        <div><span style={label}>Diapers / month</span><input type="number" style={inputS} value={vStr(cfg.diapers)} onChange={e => setCfg({ ...cfg, diapers: toNum(e.target.value) })} /></div>
        <div><span style={label}>Formula / month</span><input type="number" style={inputS} value={vStr(cfg.formula)} onChange={e => setCfg({ ...cfg, formula: toNum(e.target.value) })} /></div>
        <div><span style={label}>Healthcare / month</span><input type="number" style={inputS} value={vStr(cfg.health)} onChange={e => setCfg({ ...cfg, health: toNum(e.target.value) })} /></div>
        <div><span style={label}>Clothing / month</span><input type="number" style={inputS} value={vStr(cfg.clothing)} onChange={e => setCfg({ ...cfg, clothing: toNum(e.target.value) })} /></div>
        <div><span style={label}>Misc / month</span><input type="number" style={inputS} value={vStr(cfg.misc)} onChange={e => setCfg({ ...cfg, misc: toNum(e.target.value) })} /></div>
        <div><span style={label}>Childcare / month</span><input type="number" style={inputS} value={vStr(cfg.childcare)} onChange={e => setCfg({ ...cfg, childcare: toNum(e.target.value) })} /></div>
        <div><span style={label}>Lost income / month</span><input type="number" style={inputS} value={vStr(cfg.parentLeaveLostIncome)} onChange={e => setCfg({ ...cfg, parentLeaveLostIncome: toNum(e.target.value) })} /></div>
        <div><span style={label}>Setup one-off</span><input type="number" style={inputS} value={vStr(cfg.setup)} onChange={e => setCfg({ ...cfg, setup: toNum(e.target.value) })} /></div>
        <div><span style={label}>Buffer months</span><input type="number" style={inputS} value={vStr(cfg.bufferMonths)} onChange={e => setCfg({ ...cfg, bufferMonths: toNum(e.target.value) })} /></div>
      </div>
      <div style={{ marginTop: 8 }}>
        Monthly baby cost est.: <b>{fmtCurrency(cfg.diapers + cfg.formula + cfg.health + cfg.clothing + cfg.misc + cfg.childcare + cfg.parentLeaveLostIncome)}</b><br />
        Upfront savings target: <b>{fmtCurrency(cfg.setup + (cfg.diapers + cfg.formula + cfg.health + cfg.clothing + cfg.misc + cfg.childcare + cfg.parentLeaveLostIncome) * cfg.bufferMonths)}</b>
      </div>
    </div>
  );
}

/* === Feelings / Journal (with mini month calendar) === */
function FEELING_TALLY(logs: FeelLog[]) {
  const map: Record<Feeling, number> = {
    Joy: 0, Gratitude: 0, Calm: 0, Proud: 0, Hopeful: 0, Motivated: 0,
    Neutral: 0, Stressed: 0, Anxious: 0, Sad: 0, Angry: 0, Lonely: 0, Overwhelmed: 0, Tired: 0
  };
  for (const l of logs) for (const f of l.feelings) map[f] = (map[f] || 0) + 1;
  return map;
}
function FeelingsTab() {
const [logs, setLogs] = useStoredState<FeelLog[]>("feelLogs", []);
const [day, setDay] = useState(todayLocalISO()); // was todayISO()
  const [morning, setMorning] = useState(""); const [evening, setEvening] = useState("");
  const [sel, setSel] = useState<Feeling[]>([]);

  const save = () => {
    const rest = logs.filter(l => l.date !== day);
    setLogs([...rest, { date: day, morning: morning || undefined, evening: evening || undefined, feelings: sel }]);
  };
  const month = monthKey(day);
  const monthLogs = logs.filter(l => monthKey(l.date) === month);
  const tally = FEELING_TALLY(monthLogs);

  return (
    <div style={card}>
      <h3>🧠 Feelings & Journal</h3>
      <div style={row3}>
        <div><span style={label}>Date</span><input type="date" style={inputS} value={day} onChange={e => setDay(e.target.value)} /></div>
        <div><span style={label}>Morning (intentions)</span><input style={inputS} value={morning} onChange={e => setMorning(e.target.value)} /></div>
        <div><span style={label}>Evening (reflections)</span><input style={inputS} value={evening} onChange={e => setEvening(e.target.value)} /></div>
      </div>

      <div style={{ ...card, marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>Select feelings</h4>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(Object.keys(FEELING_COLORS) as Feeling[]).map(f => {
            const on = sel.includes(f);
            return (
              <button key={f} style={{ ...smallBtn, background: on ? FEELING_COLORS[f] : "#1e293b" }} onClick={() => setSel(on ? sel.filter(x => x !== f) : [...sel, f])}>
                {f}
              </button>
            );
          })}
        </div>
        <button style={{ ...smallBtn, marginTop: 8 }} onClick={save}>Save entry</button>
      </div>

      <div style={{ ...card, marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>This month feelings ({monthName(month)})</h4>

        {/* Mini calendar grid */}
        <div style={{display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:6, margin:"6px 0 12px"}}>
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(w=>
            <div key={w} style={{fontSize:12, opacity:.7, textAlign:"center"}}>{w}</div>
          )}
          {(() => {
            const [y,m] = month.split("-").map(Number);
            const first = new Date(y, m-1, 1);
            const last = new Date(y, m, 0);
            const pad = first.getDay();
            const cells: JSX.Element[] = [];
            for(let i=0;i<pad;i++) cells.push(<div key={"pad"+i} />);
            for(let d=1; d<=last.getDate(); d++){
              const iso = ymdLocal(y, m, d); // keep it local (no UTC conversion)
              const dayLogs = monthLogs.filter(l=>l.date===iso);
              const color = dayLogs.length && dayLogs[0].feelings[0] ? FEELING_COLORS[dayLogs[0].feelings[0]] : "#1e293b";
              cells.push(
                <div key={iso} title={iso} style={{textAlign:"center", padding:"6px 0", border:"1px solid #2a2f3a", borderRadius:6, background: color}}>
                  {d}
                </div>
              );
            }
            return cells;
          })()}
        </div>

        {Object.entries(tally).every(([, v]) => v === 0) ? <div>No entries yet.</div> : (
          <div>
            {Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([f, c]) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 6, margin: "6px 0" }}>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: FEELING_COLORS[f as Feeling] }} />
                <div style={{ width: 140 }}>{f}</div>
                <div style={{ flex: 1, height: 8, background: "#222634", borderRadius: 6 }}>
                  <div style={{ height: "100%", width: `${(c / Math.max(1, ...Object.values(tally))) * 100}%`, background: FEELING_COLORS[f as Feeling], borderRadius: 6 }} />
                </div>
                <div style={{ width: 30, textAlign: "right" }}>{c}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 8, fontSize: 12, opacity: .85 }}>
          Target feelings to embody: <b>Gratitude, Calm, Hopeful, Motivated</b>.
        </div>
      </div>
    </div>
  );
}
/* === Immigration PR Steps === */
const DEFAULT_STEPS: ImmigrationStep[] = [
  { id: uid(), title: "Emergency fund", target: 5000, saved: 0 },
  { id: uid(), title: "Reliable car", target: 0, saved: 0 },
  { id: uid(), title: "University savings", target: 0, saved: 0 },
  { id: uid(), title: "PR application", target: 0, saved: 0 },
  { id: uid(), title: "Dream car (2nd)", target: 0, saved: 0 },
  { id: uid(), title: "House deposit", target: 0, saved: 0 },
];
function ImmigrationTab({ steps, setSteps, currency }: { steps: ImmigrationStep[]; setSteps: (x: ImmigrationStep[]) => void; currency: string; }) {
  const add = () => setSteps([...steps, { id: uid(), title: "New step", target: 0, saved: 0 }]);
  const up = (id: string, q: Partial<ImmigrationStep>) => setSteps(steps.map(s => s.id === id ? { ...s, ...q } : s));
  const del = (id: string) => setSteps(steps.filter(s => s.id !== id));
  return (
    <div style={card}>
      <h3>🧭 Immigration — PR Pathway</h3>
      {steps.map(s => (
        <div key={s.id} style={{ ...card, marginTop: 8, opacity: s.achieved ? .7 : 1 }}>
          <div style={row3}>
            <div><span style={label}>Step</span><input style={inputS} value={s.title} onChange={e => up(s.id, { title: e.target.value })} /></div>
            <div><span style={label}>Target</span><input type="number" style={inputS} value={vStr(s.target)} onChange={e => up(s.id, { target: toNum(e.target.value) })} /></div>
            <div><span style={label}>Saved</span><input type="number" style={inputS} value={vStr(s.saved)} onChange={e => up(s.id, { saved: toNum(e.target.value) })} /></div>
          </div>
          <div style={{ marginTop: 6 }}>
            Progress: <b>{fmtCurrency(s.saved, currency)} / {fmtCurrency(s.target, currency)}</b>
            <div style={{ height: 10, background: "#222634", borderRadius: 8, marginTop: 4 }}>
              <div style={{ height: "100%", width: `${s.target ? (s.saved / s.target) * 100 : 0}%`, background: "#10b981", borderRadius: 8 }} />
            </div>
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap:"wrap" }}>
            <button
              style={{ ...smallBtn, background: s.achieved ? "#15803d" : "#1e293b" }}
              onClick={() => up(s.id, { achieved: !s.achieved })}
            >
              {s.achieved ? "✓ Achieved" : "Mark achieved"}
            </button>
            <button style={{ ...smallBtn, background: "#1f2937" }} onClick={() => del(s.id)}>Delete</button>
          </div>
        </div>
      ))}
      <button style={smallBtn} onClick={add}>+ Add step</button>
    </div>
  );
}

/* === Reports (Monthly summaries) === */
function closeMonth(incomes: Income[], expenses: Expense[], bnpl: BNPLPurchase[], currency: string): ReportMonth {
  const month = monthKey();
  const incomeMonthly = incomes.reduce((s, i) => s + i.amount * (i.frequency === "weekly" ? 52 / 12 : i.frequency === "fortnightly" ? 26 / 12 : 1) * (i.partnerContribution === false ? 0 : 1), 0);
  const expenseMonthly = expenses.reduce((s, e) => s + e.amount * (e.frequency === "weekly" ? 52 / 12 : e.frequency === "fortnightly" ? 26 / 12 : e.frequency === "quarterly" ? 1 / 3 : e.frequency === "yearly" ? 1 / 12 : 1), 0);
  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    const factor = e.frequency === "weekly" ? 52 / 12 : e.frequency === "fortnightly" ? 26 / 12 : e.frequency === "quarterly" ? 1 / 3 : e.frequency === "yearly" ? 1 / 12 : 1;
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount * factor;
  }
  const bnplDue = bnpl.reduce((s, p) => {
    const sched = generateBNPLSchedule(p).filter(s => monthKey(s.date) === month);
    return s + sched.reduce((a, b) => a + b.amount, 0);
  }, 0);
  const expenseTotal = expenseMonthly + bnplDue;
  const savings = Math.max(0, incomeMonthly - expenseTotal);
  return { month, incomeTotal: incomeMonthly, expenseTotal, savings, byCategory, bnplDue };
}
function ReportsTab({ reports, setReports, currency }: { reports: ReportMonth[]; setReports: (x: ReportMonth[]) => void; currency: string; }) {
  const monthsSorted = [...reports].sort((a, b) => a.month.localeCompare(b.month));

  return (
    <div style={card}>
      <h3>📊 Monthly Reports</h3>
      <div style={{ fontSize: 12, opacity: .85 }}>
        Create a monthly snapshot (income, expenses by category, BNPL due, savings). Compare progress month-to-month.
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          style={smallBtn}
          onClick={() => {
            const snap = closeMonth(
              JSON.parse(localStorage.getItem("incomes") || "[]"),
              JSON.parse(localStorage.getItem("expenses") || "[]"),
              JSON.parse(localStorage.getItem("bnpl") || "[]"),
              currency
            );
            const current = safeGetReports().filter(r => r.month !== snap.month);
            const next = [...current, snap];
            saveReports(next);
            setReports(next);
            alert(`Saved monthly report for ${monthName(snap.month)}`);
          }}
        >
          📌 Save this month now
        </button>
      </div>

      <div style={{ ...card, marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>This month — {monthName(monthKey())}</h4>
        {(() => {
          const current = reports.find(r => r.month === monthKey());
          if (!current) return <div>No snapshot saved yet this month.</div>;
          return (
            <div>
              <div>Income: <b>{fmtCurrency(current.incomeTotal, currency)}</b></div>
              <div>Expenses (incl. BNPL): <b>{fmtCurrency(current.expenseTotal, currency)}</b></div>
              <div>Savings: <b>{fmtCurrency(current.savings, currency)}</b></div>
              <div style={{ marginTop: 8 }}>
                <SimpleBar currency={currency} data={Object.entries(current.byCategory).map(([k, v]) => ({ label: k, value: v }))} />
              </div>
            </div>
          );
        })()}
      </div>

      <div style={{ ...card, marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>All reports</h4>
        {monthsSorted.length === 0
          ? <div>No reports yet.</div>
          : monthsSorted.map(r => (
            <div key={r.month} style={{ ...card, marginTop: 8 }}>
              <div style={{ fontWeight: 700 }}>{monthName(r.month)}</div>
              <div>Income: <b>{fmtCurrency(r.incomeTotal, currency)}</b></div>
              <div>Expenses (incl. BNPL): <b>{fmtCurrency(r.expenseTotal, currency)}</b></div>
              <div>Savings: <b>{fmtCurrency(r.savings, currency)}</b></div>
              <div style={{ marginTop: 8 }}>
                <SimpleBar currency={currency} data={Object.entries(r.byCategory).map(([k, v]) => ({ label: k, value: v }))} />
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

/* ---- ICS calendar export (safe) ---- */
function icsEscape(s: string) { return s.replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n"); }
function dt(iso: string) { return iso.replace(/-/g, "") + "T090000Z"; }

function buildICS(
  profile: Profile,
  incomes: Income[],
  expenses: Expense[],
  bnpl: BNPLPurchase[],
  health: HealthData
) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Life Mapper//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  const addEvent = (summary: string, dateISO: string, desc?: string) => {
    const uidStr = uid() + "@lifemapper";
    lines.push("BEGIN:VEVENT");
    lines.push("UID:" + uidStr);
    lines.push("DTSTAMP:" + dt(todayISO()));
    lines.push("DTSTART:" + dt(dateISO));
    lines.push("SUMMARY:" + icsEscape(summary));
    if (desc) lines.push("DESCRIPTION:" + icsEscape(desc));
    lines.push("END:VEVENT");
  };

  // incomes: create 6 future paydays
  for (const inc of incomes) {
    let d = inc.nextDate || todayISO();
    for (let k = 0; k < 6; k++) {
      addEvent(`Payday — ${inc.name} (${profile.currency})`, d, `Amount: ${inc.amount} • ${inc.frequency}`);
      d = inc.frequency === "weekly" ? addDays(d, 7) : inc.frequency === "fortnightly" ? addDays(d, 14) : addMonths(d, 1);
    }
  }

  // expenses: if nextDue set, roll 6 occurrences (SAFE version — no IIFE)
  for (const e of expenses) {
    if (!e.nextDue) continue;
    let d = e.nextDue;

    const advance = (date: string, f: Frequency) =>
      f === "weekly" ? addDays(date, 7)
      : f === "fortnightly" ? addDays(date, 14)
      : f === "monthly" ? addMonths(date, 1)
      : f === "quarterly" ? addMonths(date, 3)
      : addMonths(date, 12);

    for (let k = 0; k < 6; k++) {
      addEvent(`Bill — ${e.name}`, d, `Amount: ${e.amount} ${profile.currency} • ${e.category}`);
      d = advance(d, e.frequency);
    }
  }

  // BNPL schedule
  for (const p of bnpl) {
    const N = Math.min(4, p.paymentsLeft || 0);
    const a = Math.round((p.total / 4) * 100) / 100;
    let d = p.startDate;
    for (let k = 0; k < N; k++) {
      addEvent(`BNPL — ${p.provider}`, d, `Amount: ${a} ${profile.currency}`);
      d = p.frequency === "weekly" ? addDays(d, 7) : addDays(d, 14);
    }
  }

  // Health workouts
  for (const w of (health.workoutsDone || [])) {
    addEvent(`Workout (${w.minutes}min)`, w.date, "Logged via Life Mapper");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
function downloadICS(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
/* === Advisor (quick guidance + month close) === */
function AdvisorTab({
  incomes, expenses, bnpl, goals, health, setReports, currency
}: {
  incomes: Income[]; expenses: Expense[]; bnpl: BNPLPurchase[];
  goals: Goal[]; health: HealthData; setReports: (x: ReportMonth[]) => void; currency: string;
}) {
  const monthlySave = estimateMonthlySavings(incomes, expenses, bnpl);

  const advice: string[] = [];
  if (monthlySave < 200) advice.push("Increase income or cut expenses to reach goals faster.");
  if (!goals.some(g => /emergency/i.test(g.title))) advice.push("Add an 'Emergency fund' goal to build resilience.");
  if (!health || !Array.isArray(health.weighIns)) advice.push("Open Health tab once to initialize tracking.");
  if (advice.length === 0) advice.push("Great work — keep executing your plan!");

  const doCloseMonth = () => {
    try {
      const snap = closeMonth(incomes, expenses, bnpl, currency);
      const ls = safeGetReports();
      const merged = new Map<string, ReportMonth>();
      for (const r of ls) merged.set(r.month, r);
      merged.set(snap.month, snap);
      const next = Array.from(merged.values());
      saveReports(next);
      setReports(next);
      alert(`Saved monthly report for ${monthName(snap.month)}`);
    } catch (e) {
      console.error(e);
      alert("Could not save report. Please try again.");
    }
  };

  return (
    <div style={card}>
      <h3>🧠 Advisor</h3>
      <div style={{ ...card }}>
        <div><b>Projected monthly savings:</b> {fmtCurrency(monthlySave, currency)}</div>
        <ul style={{ marginTop: 6 }}>{advice.map((a, i) => <li key={i}>{a}</li>)}</ul>
        <button style={smallBtn} onClick={doCloseMonth}>📌 Save this month as a report</button>
      </div>
    </div>
  );
}

// === ROOT APP ===
export default function App() {
  // Core state
  const [tab, setTab] = useStoredState<TabKey>("tab", "profile");
  const [profile, setProfile] = useStoredState<Profile>("profile", { name: "", email: "", phone: "", country: "", currency: "USD" });
  const [incomes, setIncomes] = useStoredState<Income[]>("incomes", [{ id: uid(), name: "Job", amount: 0, frequency: "fortnightly", nextDate: todayISO() }]);
  const [expenses, setExpenses] = useStoredState<Expense[]>("expenses", []);
  const [purchases, setPurchases] = useStoredState<BNPLPurchase[]>("bnpl", []);
  const [goals, setGoals] = useStoredState<Goal[]>("goals", []);
  const [relationship, setRelationship] = useStoredState<RelationshipData>("relationship", {
    status: "single", valuesAlignment: 3, financialHabits: 3, communication: 3, conflictResolution: 3,
    supportiveness: 3, trustSafety: 3, workReliability: 3, growthMindset: 3, kidsAlignment: 3, lifestyleAlignment: 3,
    addictions: "none", controllingBehaviour: "no", financialAbuse: "no"
  });
  const [health, setHealth] = useStoredState<HealthData>("health", {
    gender: "male", age: 30, heightCm: 175, weightKg: 75, jobType: "desk", hoursPerWeek: 4, goal: "fat-loss", conditions: "", weighIns: [], workoutsDone: []
  });
  const [immSteps, setImmSteps] = useStoredState<ImmigrationStep[]>("immigrationSteps", DEFAULT_STEPS);
  const [reports, setReports] = useStoredState<ReportMonth[]>("reports", []);

 // Retro-fix IDs if any old data lacks them
useEffect(()=>{
  const fix = <T extends {id?:string}>(key:string, arr:T[])=>{
    const patched = (arr||[]).map(x=> x.id ? x : ({...x, id: uid()} as T));
    localStorage.setItem(key, JSON.stringify(patched));
  };
  fix("incomes", incomes as any);
  fix("expenses", expenses as any);
  fix("bnpl", purchases as any);
  fix("goals", goals as any);
  fix("immigrationSteps", immSteps as any);
  // Reload in-memory state from the patched storage (optional but helps instantly)
  try {
    setIncomes(JSON.parse(localStorage.getItem("incomes")||"[]"));
    setExpenses(JSON.parse(localStorage.getItem("expenses")||"[]"));
    setPurchases(JSON.parse(localStorage.getItem("bnpl")||"[]"));
    setGoals(JSON.parse(localStorage.getItem("goals")||"[]"));
    setImmSteps(JSON.parse(localStorage.getItem("immigrationSteps")||"[]"));
  } catch {}
// eslint-disable-next-line react-hooks/exhaustive-deps
},[]);


  const currency = profile.currency || "USD";

  return (
    <div style={shell}>
      <header style={header}>
        <div style={container}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:12}}>
            <div style={{ fontWeight: 800 }}>🌍 Life Mapper</div>
            <div style={tabsRow}>
              {(["profile", "income", "expenses", "goals", "relationships", "health", "baby", "immigration", "bnpl", "reports", "feelings", "advisor"] as TabKey[])
                .map(k => (
                  <button key={k} style={tabBtn(tab === k)} onClick={() => setTab(k)}>{tabLabel(k)}</button>
                ))}
            </div>
            <button
              style={{...smallBtn, whiteSpace:"nowrap"}}
              onClick={()=>{
                try{
                  const ics = buildICS(profile, incomes, expenses, purchases, health);
                  downloadICS("life-mapper-calendar.ics", ics);
                  alert("Calendar (.ics) downloaded — import into iPhone/Android/Google Calendar.");
                }catch(e){ console.error(e); alert("Could not build calendar."); }
              }}
            >
              📅 Export Calendar (.ics)
            </button>
          </div>
        </div>
      </header>

      <main style={container}>
        {tab === "profile" && <ProfileTab profile={profile} setProfile={setProfile} />}
        {tab === "income" && <IncomeTab incomes={incomes} setIncomes={setIncomes} currency={currency} />}
        {tab === "expenses" && <ExpensesTab expenses={expenses} setExpenses={setExpenses} currency={currency} />}
        {tab === "goals" && <GoalsTab goals={goals} setGoals={setGoals} incomes={incomes} expenses={expenses} bnpl={purchases} currency={currency} />}
        {tab === "relationships" && <RelationshipsTab data={relationship} setData={setRelationship} />}
        {tab === "health" && <HealthTab data={health} setData={setHealth} />}
        {tab === "baby" && <BabyTab />}
        {tab === "immigration" && <ImmigrationTab steps={immSteps} setSteps={setImmSteps} currency={currency} />}
        {tab === "bnpl" && <BNPLTab purchases={purchases} setPurchases={setPurchases} currency={currency} />}
        {tab === "reports" && <ReportsTab reports={reports} setReports={setReports} currency={currency} />}
        {tab === "feelings" && <FeelingsTab />}
        {tab === "advisor" && <AdvisorTab incomes={incomes} expenses={expenses} bnpl={purchases} goals={goals} health={health} setReports={setReports} currency={currency} />}

        <Pager tab={tab} setTab={setTab} />
      </main>
    </div>
  );
}
