import { queueView } from './lib/telemetry';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  BusFront,
  ChevronDown,
  Clock3,
  CreditCard,
  Eye,
  EyeOff,
  ListChecks,
  LoaderCircle,
  MoreVertical,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { Client } from "@stomp/stompjs";
import logo from "./assets/image/logo-premier.webp";
import { BRAND_NAME } from "./constants/brand";
import { captureEvent, capturePageView, identifyUser, resetAnalytics } from "./lib/posthog";
import { formatPhtTime } from "./time";

const API_BASE_URL = (
  import.meta.env.DEV
    ? ""
    : (import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_API_URL ||
      "https://api-proxy.rayjomar15.workers.dev")
).replace(/\/$/, "");
const SESSION_KEY = "premier_staff_session";
const WEBSOCKET_URL = import.meta.env.DEV
  ? `ws://${window.location.host}/ws-native`
  : `${API_BASE_URL.replace(/^http/, "ws")}/ws-native`;

const emptyQueue = {
  incomingToSmTerminal: [],
  incomingToGrandTerminal: [],
};

const statusStyles = {
  "At Terminal": "bg-slate-100 text-slate-700 border-slate-200",
  Departed: "bg-blue-50 text-blue-700 border-blue-200",
  "On Route": "bg-[#fff7df] text-[#8a5a00] border-[#e8bd47]",
  "Near Terminal": "bg-emerald-50 text-emerald-700 border-emerald-200",
  Arriving: "bg-orange-50 text-orange-700 border-orange-200",
  Arrived: "bg-green-50 text-green-700 border-green-200",
};

function normalizeStatus(status, statusLabel) {
  return statusLabel || String(status || "On Route").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeBuses(items = []) {
  return [...items]
    .map((bus, index) => ({
      ...bus,
      plateNumber: bus.plateNumber || bus.plate || "Unknown Plate",
      routeDirection: bus.routeDirection || bus.route || "Route unavailable",
      distanceRemainingKm: (bus.distanceRemainingKm ?? bus.distanceKm) == null ? null : Number(bus.distanceRemainingKm ?? bus.distanceKm),
      estimatedArrivalMinutes: (bus.estimatedArrivalMinutes ?? bus.etaMinutes) == null ? null : Number(bus.estimatedArrivalMinutes ?? bus.etaMinutes),
      queuePosition: Number(bus.queuePosition ?? index + 1),
      statusLabel: normalizeStatus(bus.status, bus.statusLabel),
    }))
    .sort((a, b) => {
      if (a.distanceRemainingKm !== b.distanceRemainingKm) {
        return (a.distanceRemainingKm ?? Infinity) - (b.distanceRemainingKm ?? Infinity);
      }
      return (a.estimatedArrivalMinutes ?? Infinity) - (b.estimatedArrivalMinutes ?? Infinity);
    })
    .map((bus, index) => ({ ...bus, queuePosition: index + 1 }));
}

function normalizeQueuePayload(payload) {
  const data = payload?.data ?? payload ?? emptyQueue;

  return {
    incomingToSmTerminal: normalizeBuses(data.incomingToSmTerminal || data.sm || []),
    incomingToGrandTerminal: normalizeBuses(data.incomingToGrandTerminal || data.grand || []),
  };
}

function formatDistance(value) {
  if (value == null) return "Unknown";
  const distance = Number(value);
  return Number.isFinite(distance) ? `${distance.toFixed(1)} km` : "Unknown";
}

function formatEta(value) {
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes > 0 ? `${Math.round(minutes)} min` : "Unknown";
}

function routeLabel(routeDirection) {
  return String(routeDirection || "").replace(" to ", " -> ");
}

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const hasError = Boolean(error);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    captureEvent("staff_login_started");

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || `Login failed (${response.status})`);
      }

      const account = payload?.data || payload;
      if (account?.role !== "STAFF") {
        throw new Error("Only staff accounts can open the staff dashboard.");
      }

      const session = {
        token: account.token,
        userId: account.id ?? account.adminId ?? null,
        username: account.username || username.trim(),
        fullName: account.fullName || account.username || username.trim(),
        role: account.role,
        loggedInAt: Date.now(),
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      captureEvent("staff_login_success");
      onLogin(session);
    } catch (loginError) {
      captureEvent("staff_login_failed");
      setError(loginError.message || "Invalid staff username or password.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleForgotPassword() {
    window.alert("Please contact your administrator to reset your password");
  }

  return (
    <main className="min-h-screen grid place-items-center px-4 py-8 bg-[linear-gradient(135deg,#edf1f6_0%,#f8fafc_100%)]">
      <section className="grid grid-cols-[minmax(280px,1fr)_minmax(320px,1fr)] w-full max-w-5xl min-h-[35rem] overflow-hidden rounded-2xl bg-white shadow-[0_22px_52px_rgba(44,36,41,0.18)] max-[860px]:grid-cols-1">
        <div
          className="grid place-content-center p-8 text-white text-center bg-brand-primary max-[860px]:min-h-64"
          style={{ backgroundColor: "#5c2028" }}
        >
          <div>
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-white p-4 overflow-hidden shadow-[0_10px_22px_rgba(0,0,0,0.18)] ring-4 ring-white/75">
              <img src={logo} alt={BRAND_NAME} className="w-full h-full object-contain" />
            </div>
            <h1 className="m-0 text-3xl font-black tracking-wider">{BRAND_NAME}</h1>
            <p className="mt-3 mb-0 text-brand-accent font-extrabold tracking-wider">Staff Bus Queue</p>
          </div>
        </div>

        <div className="grid content-center p-[clamp(2rem,5vw,3.5rem)] bg-white">
          <h2 className="m-0 text-brand-primary text-3xl font-black" style={{ color: "#5c2028" }}>Staff Login</h2>
          <p className="mt-1 mb-7 text-[#717680] text-sm">Sign in using the staff account created by the admin.</p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="staff-username" className="block mb-2 text-[#343946] font-extrabold text-sm">Username</label>
            <input
              id="staff-username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter staff username"
              autoComplete="username"
              required
              className={`w-full min-h-12 mb-5 px-4 border-2 rounded-lg bg-white text-[#352f33] outline-none transition focus:border-brand-primary focus:shadow-[0_0_0_4px_rgba(92,32,40,0.14)] ${hasError ? "border-red-500" : "border-[#d9dce2]"}`}
            />

            <label htmlFor="staff-password" className="block mb-2 text-[#343946] font-extrabold text-sm">Password</label>
            <div className="relative">
              <input
                id="staff-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                required
                className={`w-full min-h-12 px-4 pr-12 border-2 rounded-lg bg-white text-[#352f33] outline-none transition focus:border-brand-primary focus:shadow-[0_0_0_4px_rgba(92,32,40,0.14)] ${hasError ? "border-red-500" : "border-[#d9dce2]"}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-3 grid place-items-center text-[#717680] transition hover:text-brand-primary"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className="mb-5 mt-2 flex justify-end">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm font-semibold text-brand-primary hover:underline"
              >
                Forgot your password?
              </button>
            </div>

            {error ? <p className="mb-5 text-sm font-semibold text-red-600">{error}</p> : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-12 rounded-lg bg-brand-primary text-white font-black transition hover:bg-brand-primary-dark hover:-translate-y-px hover:shadow-[0_10px_20px_rgba(92,32,40,0.22)] disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: submitting ? "rgba(92, 32, 40, 0.55)" : "#5c2028", color: "#ffffff" }}
            >
              {submitting ? "Signing in..." : "Log In"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="min-w-0 rounded-xl border border-[#dfe3e8] bg-white p-3.5">
      <div className="flex items-start justify-between gap-2">
        <dt className="text-[11px] font-extrabold uppercase leading-tight tracking-[0.08em] text-[#536172]">{label}</dt>
        {Icon ? <Icon size={17} strokeWidth={2} className="shrink-0 text-[#742434]" aria-hidden="true" /> : null}
      </div>
      <dd className="mt-2 text-xl font-black leading-none text-[#172438] sm:text-2xl">{value}</dd>
    </div>
  );
}

function RefreshButton({ onClick, loading = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#7a2938] bg-white px-3.5 text-xs font-extrabold text-[#6b202f] transition hover:bg-[#fbf5f6] focus:outline-none focus:ring-2 focus:ring-[#9d5360] focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
    >
      <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" />
      {loading ? "Refreshing" : "Refresh"}
    </button>
  );
}

function PageHeader({ eyebrow, title, description, updatedLabel, loading, onRefresh }) {
  return (
    <div className="flex items-start justify-between gap-4 max-[560px]:flex-col">
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#742434]">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-black leading-tight tracking-[-0.02em] text-[#172438] max-[420px]:text-xl">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-[#557087]">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3 max-[560px]:w-full max-[560px]:justify-between">
        {updatedLabel ? (
          <div className="flex items-center gap-2 text-[#647182]">
            <Clock3 size={17} aria-hidden="true" />
            <div className="text-[11px] leading-tight">
              <span className="block">Last updated</span>
              <span className="font-bold text-[#334155]">{updatedLabel}</span>
            </div>
          </div>
        ) : null}
        <RefreshButton onClick={onRefresh} loading={loading} />
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="grid min-h-32 place-items-center rounded-xl border border-[#dfe3e8] bg-[#fbfcfd] px-4 py-7 text-center">
      <div>
        {Icon ? <Icon size={23} strokeWidth={1.8} className="mx-auto text-[#3f5d74]" aria-hidden="true" /> : null}
        <p className="mt-3 text-sm font-semibold text-[#334e63]">{title}</p>
        {description ? <p className="mt-1 text-xs text-[#7890a2]">{description}</p> : null}
      </div>
    </div>
  );
}

function LoadingState({ label }) {
  return (
    <div className="grid min-h-32 place-items-center rounded-xl border border-[#dfe3e8] bg-[#fbfcfd] px-4 py-7 text-center" role="status">
      <div>
        <LoaderCircle size={26} className="mx-auto animate-spin text-[#742434]" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-[#557087]">{label}</p>
      </div>
    </div>
  );
}

function ErrorState({ title, description, onRetry }) {
  return (
    <div className="rounded-xl border border-[#e6c5ca] bg-[#fff9fa] p-4" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="mt-0.5 shrink-0 text-[#8b293b]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-[#63202d]">{title}</p>
          <p className="mt-1 text-sm leading-5 text-[#6f5960]">{description}</p>
          <button type="button" onClick={onRetry} className="mt-3 min-h-10 rounded-lg bg-[#6b202f] px-4 text-xs font-extrabold text-white transition hover:bg-[#531824] focus:outline-none focus:ring-2 focus:ring-[#9d5360] focus:ring-offset-2">
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}

function TerminalSelector({ label, colorClass, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-h-11 items-center rounded-lg border bg-white px-3.5 text-left transition focus:outline-none focus:ring-2 focus:ring-[#9d5360] focus:ring-offset-2 ${selected ? "border-[#8b3242] bg-[#fffafb] shadow-[inset_0_0_0_1px_rgba(139,50,66,0.08)]" : "border-[#d8dde3] hover:border-[#a9b2bc]"}`}
    >
      <span className="flex items-center gap-2.5 text-sm font-bold text-[#27364a]">
        <span className={`h-2.5 w-2.5 rounded-full ${colorClass}`} aria-hidden="true" />
        {label}
      </span>
    </button>
  );
}

function QueueCard({ bus }) {
  const badgeClass = statusStyles[bus.statusLabel] || "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <article className="rounded-lg border border-[#e6e8ee] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8b95a7]">Queue #{bus.queuePosition}</p>
          <h3 className="mt-2 text-3xl font-black tracking-wide text-[#352f33]">{bus.plateNumber}</h3>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[11px] font-black ${badgeClass}`}>{bus.statusLabel}</span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="col-span-2 rounded-lg bg-[#f8fafc] border border-[#e6e8ee] p-3">
          <dt className="text-[10px] font-black uppercase tracking-wide text-[#717680]">Route</dt>
          <dd className="mt-1 font-bold text-[#352f33]">{routeLabel(bus.routeDirection)}</dd>
        </div>
        <StatCard label="Distance" value={formatDistance(bus.distanceRemainingKm)} />
        <StatCard label="ETA" value={formatEta(bus.estimatedArrivalMinutes)} />
      </dl>
    </article>
  );
}

function QueueSection({ title, buses }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xl font-black text-[#352f33]">{title}</h2>
        <span className="rounded-full bg-[#f2e8ea] px-2 py-1 text-[11px] font-black text-[#6f2f3c]">{buses.length} buses</span>
      </div>
      {buses.length ? (
        <div className="grid gap-4">
          {buses.map((bus) => <QueueCard key={`${bus.plateNumber}-${bus.queuePosition}-${bus.routeDirection}`} bus={bus} />)}
        </div>
      ) : (
        <EmptyState icon={BusFront} title="No incoming buses in this queue." description="Check back later for updates." />
      )}
    </section>
  );
}

function peso(value) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value || 0));
}

function CashTransactions({ data, loading, error, onRefresh }) {
  const rows = data?.transactions || [];
  return (
    <section className="rounded-2xl border border-[#dfe3e8] bg-white p-4 shadow-[0_8px_24px_rgba(18,35,52,0.06)] sm:p-5">
      <PageHeader
        eyebrow="Today’s Transactions"
        title="Staff-Assisted Cash Fares"
        description="Transactions recorded by your regular and discounted RFID cash cards."
        loading={loading}
        onRefresh={onRefresh}
      />

      <dl className="my-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard label="Regular" value={data?.regularCount || 0} />
        <StatCard label="Discounted" value={data?.discountedCount || 0} />
        <StatCard label="Passengers" value={data?.totalPassengers || 0} />
        <StatCard label="Expected Cash" value={peso(data?.expectedCash)} />
      </dl>

      {loading ? <LoadingState label="Loading transactions…" /> : null}
      {error ? <ErrorState title="Transactions unavailable" description="Please check your connection and try again." onRetry={onRefresh} /> : null}
      {!loading && !error ? (
        <div>
          {rows.length ? <>
          <div className="hidden overflow-hidden rounded-xl border border-[#dfe3e8] sm:block">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-[#f7f1f2] text-[#6f2f3c]">
                <tr>{[
                  ["Time", "w-[5rem]"], ["Vehicle", "w-[5.75rem]"], ["Category", "w-[7.25rem]"], ["Amount", "w-[6rem]"], ["Reference", "w-[10.5rem]"],
                ].map(([label, width]) => <th key={label} className={`${width} whitespace-nowrap px-3 py-3 text-xs font-black uppercase tracking-wide sm:px-4`}>{label}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#eceef2]">
                    <td className="whitespace-nowrap px-3 py-3 font-semibold sm:px-4">{formatPhtTime(row.createdAt)}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-black sm:px-4">{row.plateNumber}</td>
                    <td className="whitespace-nowrap px-3 py-3 sm:px-4"><span className="rounded-full bg-[#f2e8ea] px-2 py-1 text-xs font-black text-[#6f2f3c]">{row.fareCategory === "REGULAR_CASH" ? "Regular" : "Discounted"}</span></td>
                    <td className="whitespace-nowrap px-3 py-3 font-black sm:px-4">{peso(row.finalFare)}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-[#717680] sm:px-4">{row.referenceNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-2.5 sm:hidden">
            {rows.map((row) => (
              <article key={row.id} className="rounded-xl border border-[#dfe3e8] bg-[#fbfcfd] p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-extrabold text-[#172438]">{row.plateNumber}</p>
                  <p className="font-black text-[#172438]">{peso(row.finalFare)}</p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[#647182]">
                  <span>{formatPhtTime(row.createdAt)}</span>
                  <span className="rounded-full bg-[#f2e8ea] px-2 py-1 font-extrabold text-[#6f2f3c]">{row.fareCategory === "REGULAR_CASH" ? "Regular" : "Discounted"}</span>
                </div>
                <p className="mt-2 break-all font-mono text-[11px] text-[#7a8794]">{row.referenceNumber}</p>
              </article>
            ))}
          </div>
          </> : <EmptyState icon={CreditCard} title="No cash fares recorded today." />}
        </div>
      ) : null}
    </section>
  );
}

function Dashboard({ username, onLogout }) {
  const [queue, setQueue] = useState(emptyQueue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [telemetryNow, setTelemetryNow] = useState(() => Date.now());
  useEffect(() => {
    const clock = setInterval(() => setTelemetryNow(Date.now()), 5000);
    return () => clearInterval(clock);
  }, []);
  const [activeTerminal, setActiveTerminal] = useState("grand");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState("queue");
  const [cashData, setCashData] = useState(null);
  const [cashLoading, setCashLoading] = useState(false);
  const [cashError, setCashError] = useState("");
  const queueLoaderRef = useRef(null);
  const cashLoaderRef = useRef(null);

  const loadQueue = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);

    try {
      const savedSession = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      if (!savedSession?.token) {
        sessionStorage.removeItem(SESSION_KEY);
        throw new Error("STAFF_SESSION_EXPIRED");
      }
      const response = await fetch(`${API_BASE_URL}/api/staff/bus-queue`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${savedSession?.token || ""}`,
        },
      });
      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem(SESSION_KEY);
        throw new Error("STAFF_SESSION_EXPIRED");
      }
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const payload = await response.json();
      const nextQueue = normalizeQueuePayload(payload);
      setQueue(nextQueue);
      setError("");
      setLastUpdated(new Date());
      if (!silent) {
        captureEvent("staff_bus_queue_loaded", {
          incoming_sm_count: nextQueue.incomingToSmTerminal.length,
          incoming_grand_count: nextQueue.incomingToGrandTerminal.length,
        });
      }
    } catch (requestError) {
      if (requestError.message === "STAFF_SESSION_EXPIRED") {
        captureEvent("staff_session_expired");
        setError("Staff session expired. Please sign in again.");
        onLogout();
        return;
      }
      if (!silent) captureEvent("staff_bus_queue_load_failed");
      setError("Live bus queue is unavailable. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  const loadCashTransactions = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setCashLoading(true);
    try {
      const savedSession = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      if (!savedSession?.token) {
        sessionStorage.removeItem(SESSION_KEY);
        onLogout();
        return;
      }
      const response = await fetch(`${API_BASE_URL}/api/staff/cash-transactions/today`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${savedSession?.token || ""}` },
      });
      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem(SESSION_KEY);
        onLogout();
        return;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) throw new Error(payload?.message || `API returned ${response.status}`);
      setCashData(payload?.data || payload);
      setCashError("");
    } catch (requestError) {
      setCashError(requestError.message || "Cash transactions are unavailable.");
    } finally {
      setCashLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    queueLoaderRef.current = loadQueue;
  }, [loadQueue]);

  useEffect(() => {
    cashLoaderRef.current = loadCashTransactions;
  }, [loadCashTransactions]);

  useEffect(() => {
    queueMicrotask(() => loadQueue());
    const timer = window.setInterval(() => loadQueue({ silent: true }), 30000);
    return () => window.clearInterval(timer);
  }, [loadQueue]);

  useEffect(() => {
    if (activeView !== "transactions") return undefined;
    queueMicrotask(() => loadCashTransactions());
    const timer = window.setInterval(() => loadCashTransactions({ silent: true }), 30000);
    return () => window.clearInterval(timer);
  }, [activeView, loadCashTransactions]);

  useEffect(() => {
    const savedSession = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    if (!savedSession?.token) return undefined;
    const client = new Client({
      brokerURL: WEBSOCKET_URL,
      connectHeaders: { Authorization: `Bearer ${savedSession.token}` },
      reconnectDelay: 3000,
      onConnect: () => client.subscribe("/topic/staff/realtime", (frame) => {
        try {
          const event = JSON.parse(frame.body);
          if (event.entity === "VEHICLE_LOCATION" || event.entity === "VEHICLE") queueLoaderRef.current?.({ silent: true });
          if (event.entity === "STAFF_CASH_TRANSACTION") cashLoaderRef.current?.({ silent: true });
        } catch { /* Ignore malformed realtime envelopes. */ }
      }),
    });
    client.activate();
    return () => client.deactivate();
  }, []);

  const updatedLabel = useMemo(() => {
    if (!lastUpdated) return "Waiting for live update";
    return formatPhtTime(lastUpdated);
  }, [lastUpdated]);

  const totalBuses = queue.incomingToSmTerminal.length + queue.incomingToGrandTerminal.length;
  const activeQueue = (activeTerminal === "sm" ? queue.incomingToSmTerminal : queue.incomingToGrandTerminal).map(bus => queueView(bus, telemetryNow));
  const activeTitle = activeTerminal === "sm" ? "Incoming to SM Terminal" : "Incoming to Grand Terminal";

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f3f5f7] text-[#172438]">
      <header className="bg-[#641d2a] text-white shadow-[0_3px_14px_rgba(48,14,20,0.16)]">
        <div className="relative mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="Premier Transit" className="h-11 w-11 shrink-0 rounded-full border-2 border-white/90 bg-white p-1 object-contain sm:h-12 sm:w-12" />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.23em] text-[#efc862]">Premier Transit</p>
              <h1 className="truncate text-lg font-black leading-tight sm:text-xl">Staff Bus Queue</h1>
              <p className="truncate text-[11px] font-medium text-white/80">Logged in as: {username}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 border-r border-white/25 pr-3 sm:flex">
              <UserRound size={16} aria-hidden="true" />
              <span className="max-w-28 truncate text-xs font-semibold">{username}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="grid min-h-10 min-w-10 place-items-center rounded-lg bg-white/10 text-white transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/70"
              aria-label="Open staff menu"
              aria-expanded={menuOpen}
            >
              <MoreVertical size={19} aria-hidden="true" />
            </button>
          </div>

          {menuOpen ? (
            <div className="absolute right-4 top-[4.1rem] z-20 w-48 rounded-xl border border-[#dfe3e8] bg-white p-3 text-[#172438] shadow-[0_12px_32px_rgba(16,31,46,0.18)]">
              <p className="mb-2 text-sm font-bold">Logged in as staff</p>
              <button
                type="button"
                onClick={onLogout}
                className="min-h-11 w-full rounded-lg bg-[#f5ebed] px-3 text-left text-sm font-black text-[#641d2a] transition hover:bg-[#ecdadd]"
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <section className="mx-auto w-full max-w-3xl px-4 py-3.5 sm:px-5 sm:py-4">
        <nav className="mb-3.5 grid grid-cols-2 rounded-xl border border-[#dce1e6] bg-white p-1 shadow-[0_3px_12px_rgba(18,35,52,0.04)]" aria-label="Staff pages">
          <button type="button" onClick={() => setActiveView("queue")} aria-current={activeView === "queue" ? "page" : undefined} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-extrabold transition focus:outline-none focus:ring-2 focus:ring-[#9d5360] focus:ring-inset ${activeView === "queue" ? "bg-[#6b202f] text-white shadow-sm" : "text-[#27364a] hover:bg-[#f6f7f9]"}`}>
            <BusFront size={18} /> Queue
          </button>
          <button type="button" onClick={() => setActiveView("transactions")} aria-current={activeView === "transactions" ? "page" : undefined} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-extrabold transition focus:outline-none focus:ring-2 focus:ring-[#9d5360] focus:ring-inset ${activeView === "transactions" ? "bg-[#6b202f] text-white shadow-sm" : "text-[#27364a] hover:bg-[#f6f7f9]"}`}>
            <ListChecks size={18} /> Transactions
          </button>
        </nav>

        {activeView === "transactions" ? (
          <CashTransactions data={cashData} loading={cashLoading} error={cashError} onRefresh={() => loadCashTransactions()} />
        ) : (
        <section className="rounded-2xl border border-[#dfe3e8] bg-white p-4 shadow-[0_8px_24px_rgba(18,35,52,0.06)] sm:p-5">
          <PageHeader
            eyebrow="Staff Dashboard"
            title="Bus Queue Monitoring"
            description="Live queue status and incoming buses per terminal. Auto-refreshes every 30 seconds."
            updatedLabel={updatedLabel}
            loading={loading}
            onRefresh={() => loadQueue()}
          />

          <dl className="my-5 grid grid-cols-3 gap-2.5">
            <StatCard label="Total Buses" value={totalBuses} icon={BusFront} />
            <StatCard label="Incoming SM" value={queue.incomingToSmTerminal.length} icon={ArrowLeftRight} />
            <StatCard label="Incoming Grand" value={queue.incomingToGrandTerminal.length} icon={ArrowLeftRight} />
          </dl>

          <div className="mb-4 grid grid-cols-2 gap-2.5 max-[560px]:grid-cols-1">
            <TerminalSelector
              label="SM Terminal"
              colorClass="bg-[#397fa1]"
              selected={activeTerminal === "sm"}
              onClick={() => {
                setActiveTerminal("sm");
                captureEvent("staff_terminal_tab_selected", { terminal: "sm" });
              }}
            />
            <TerminalSelector
              label="Grand Terminal"
              colorClass="bg-[#5d957f]"
              selected={activeTerminal === "grand"}
              onClick={() => {
                setActiveTerminal("grand");
                captureEvent("staff_terminal_tab_selected", { terminal: "grand" });
              }}
            />
          </div>

          <div className="border-t border-[#e4e7eb] pt-4">
            {loading ? <LoadingState label="Loading queue data…" /> : null}
            {error ? <ErrorState title="Queue unavailable" description="Please check your connection and try again." onRetry={() => loadQueue()} /> : null}
            {!loading && !error ? <QueueSection title={activeTitle} buses={activeQueue} /> : null}
          </div>
        </section>
        )}
      </section>
    </main>
  );
}
export default function App() {
  const [session, setSession] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      if (saved?.role === "STAFF" && typeof saved?.token === "string" && saved.token.length > 20) {
        return saved;
      }
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  });

  useEffect(() => {
    capturePageView({
      path: window.location.pathname,
      route: session ? "staff_dashboard" : "staff_login",
      title: document.title,
    });
    if (session?.userId) identifyUser(session.userId, { role: "STAFF" });
  }, [session]);

  function handleLogout() {
    resetAnalytics();
    sessionStorage.removeItem(SESSION_KEY);
    captureEvent("staff_logout");
    setSession(null);
  }

  if (!session) return <LoginPage onLogin={setSession} />;
  return <Dashboard username={session.fullName || session.username} onLogout={handleLogout} />;
}
