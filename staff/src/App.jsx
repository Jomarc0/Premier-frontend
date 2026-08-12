import React, { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, ListChecks, BusFront } from "lucide-react";
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
      "http://localhost:8080")
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
      distanceRemainingKm: Number(bus.distanceRemainingKm ?? bus.distanceKm ?? 0),
      estimatedArrivalMinutes: Number(bus.estimatedArrivalMinutes ?? bus.etaMinutes ?? 0),
      queuePosition: Number(bus.queuePosition ?? index + 1),
      statusLabel: normalizeStatus(bus.status, bus.statusLabel),
    }))
    .sort((a, b) => {
      if (a.distanceRemainingKm !== b.distanceRemainingKm) {
        return a.distanceRemainingKm - b.distanceRemainingKm;
      }
      return a.estimatedArrivalMinutes - b.estimatedArrivalMinutes;
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

const SM_TERMINAL = { latitude: 13.954781, longitude: 121.163096 };
const GRAND_TERMINAL = { latitude: 13.790391, longitude: 121.062721 };
const DEFAULT_SPEED_KMH = 30;
const TERMINAL_GEOFENCE_KM = 5;

function distanceKm(fromLat, fromLng, toLat, toLng) {
  const earthRadiusKm = 6371;
  const dLat = ((toLat - fromLat) * Math.PI) / 180;
  const dLng = ((toLng - fromLng) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((fromLat * Math.PI) / 180) * Math.cos((toLat * Math.PI) / 180)
    * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function statusFor(destinationDistanceKm, originDistanceKm) {
  if (destinationDistanceKm <= 0.05) return "Arrived";
  if (destinationDistanceKm <= 0.3) return "Arriving";
  if (destinationDistanceKm <= 1.0) return "Near Terminal";
  if (originDistanceKm <= TERMINAL_GEOFENCE_KM) return "At Terminal";
  return "On Route";
}

function normalizeRouteText(route) {
  return String(route || "").toLowerCase().replace(/\u2192/g, "to").replace("->", "to").replaceAll("-", " ").replace(/\s+/g, " ").trim();
}

function routeMatches(route, target) {
  return normalizeRouteText(route) === normalizeRouteText(target);
}

function routeFromStoredValue(route) {
  if (routeMatches(route, "Grand Terminal to SM Terminal")) return "Grand Terminal to SM Terminal";
  if (routeMatches(route, "SM Terminal to Grand Terminal")) return "SM Terminal to Grand Terminal";
  return null;
}

function routeForBus(bus) {
  const latitude = Number(bus.latitude);
  const longitude = Number(bus.longitude);

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    const distanceToSm = distanceKm(latitude, longitude, SM_TERMINAL.latitude, SM_TERMINAL.longitude);
    const distanceToGrand = distanceKm(latitude, longitude, GRAND_TERMINAL.latitude, GRAND_TERMINAL.longitude);

    if (distanceToSm <= TERMINAL_GEOFENCE_KM && distanceToSm <= distanceToGrand) {
      return "Grand Terminal to SM Terminal";
    }
    if (distanceToGrand <= TERMINAL_GEOFENCE_KM) {
      return "SM Terminal to Grand Terminal";
    }

    return routeFromStoredValue(bus.route || bus.routeDirection)
      || (distanceToSm <= distanceToGrand ? "Grand Terminal to SM Terminal" : "SM Terminal to Grand Terminal");
  }

  return routeFromStoredValue(bus.route || bus.routeDirection);
}

function terminalsForRoute(routeDirection) {
  const incomingToSm = routeMatches(routeDirection, "Grand Terminal to SM Terminal");
  return {
    destination: incomingToSm ? SM_TERMINAL : GRAND_TERMINAL,
    origin: incomingToSm ? GRAND_TERMINAL : SM_TERMINAL,
  };
}

function toQueueItem(bus, routeDirection, destination, origin) {
  const latitude = Number(bus.latitude);
  const longitude = Number(bus.longitude);
  const speed = Number(bus.speed) > 0 ? Number(bus.speed) : DEFAULT_SPEED_KMH;
  const distance = Number.isFinite(latitude) && Number.isFinite(longitude)
    ? distanceKm(latitude, longitude, destination.latitude, destination.longitude)
    : 0;
  const originDistance = Number.isFinite(latitude) && Number.isFinite(longitude)
    ? distanceKm(latitude, longitude, origin.latitude, origin.longitude)
    : 999;

  return {
    plateNumber: bus.plateNumber || "Unknown Plate",
    routeDirection,
    distanceRemainingKm: Math.round(distance * 10) / 10,
    estimatedArrivalMinutes: Math.max(1, Math.round((distance / speed) * 60)),
    statusLabel: statusFor(distance, originDistance),
  };
}

function buildQueueFromDriverBuses(payload) {
  const buses = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
  const queueItems = buses.map((bus) => {
    const routeDirection = routeForBus(bus);
    if (!routeDirection) return null;
    const terminals = terminalsForRoute(routeDirection);
    return toQueueItem(bus, routeDirection, terminals.destination, terminals.origin);
  }).filter(Boolean);

  return {
    incomingToSmTerminal: normalizeBuses(queueItems.filter((bus) => routeMatches(bus.routeDirection, "Grand Terminal to SM Terminal"))),
    incomingToGrandTerminal: normalizeBuses(queueItems.filter((bus) => routeMatches(bus.routeDirection, "SM Terminal to Grand Terminal"))),
  };
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
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
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

function StatTile({ label, value }) {
  return (
    <div className="rounded-lg bg-[#f8fafc] border border-[#e6e8ee] p-3">
      <dt className="text-[10px] font-black uppercase tracking-wide text-[#717680]">{label}</dt>
      <dd className="mt-1 text-xl font-black text-[#352f33]">{value}</dd>
    </div>
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
        <StatTile label="Distance" value={formatDistance(bus.distanceRemainingKm)} />
        <StatTile label="ETA" value={formatEta(bus.estimatedArrivalMinutes)} />
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
        <div className="rounded-lg border border-dashed border-[#d9dce2] bg-white p-6 text-center text-sm font-bold text-[#717680]">
          No incoming buses in this queue.
        </div>
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
    <section>
      <div className="mb-4 rounded-2xl border border-[#e6e8ee] bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#6f2f3c]">Today&apos;s Transactions</p>
            <h2 className="mt-1 text-2xl font-black text-[#352f33]">Staff-Assisted Cash Fares</h2>
            <p className="mt-1 text-xs font-semibold text-[#717680]">Read-only records created by your regular and discounted RFID cash cards.</p>
          </div>
          <button type="button" onClick={onRefresh} className="min-h-11 rounded-xl bg-brand-primary px-4 text-sm font-black text-white">Refresh</button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Regular" value={data?.regularCount || 0} />
        <StatTile label="Discounted" value={data?.discountedCount || 0} />
        <StatTile label="Passengers" value={data?.totalPassengers || 0} />
        <StatTile label="Expected Cash" value={peso(data?.expectedCash)} />
      </div>

      {loading ? <p className="rounded-lg border border-[#e6e8ee] bg-white p-4 text-sm font-bold text-[#717680]">Loading cash transactions...</p> : null}
      {error ? <p className="rounded-lg border border-[#e8bd47] bg-[#fff7df] p-4 text-sm font-bold text-[#8a5a00]">{error}</p> : null}
      {!loading && !error ? (
        <div className="overflow-hidden rounded-2xl border border-[#e6e8ee] bg-white shadow-sm">
          {rows.length ? <>
          <div className="border-b border-[#eceef2] px-4 py-2 text-right text-[11px] font-bold text-[#717680] sm:hidden">Swipe left to view all columns</div>
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[560px] table-fixed text-left text-sm">
              <thead className="bg-[#f2e8ea] text-[#6f2f3c]">
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
          </> : <div className="px-4 py-10 text-center text-sm font-bold text-[#717680]">No cash fares recorded today.</div>}
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
  const [activeTerminal, setActiveTerminal] = useState("grand");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState("queue");
  const [cashData, setCashData] = useState(null);
  const [cashLoading, setCashLoading] = useState(false);
  const [cashError, setCashError] = useState("");
  const queueLoaderRef = useRef(null);
  const cashLoaderRef = useRef(null);

  async function loadQueue({ silent = false } = {}) {
    if (!silent) setLoading(true);

    try {
      const savedSession = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      if (!savedSession?.token) {
        localStorage.removeItem(SESSION_KEY);
        throw new Error("STAFF_SESSION_EXPIRED");
      }
      const response = await fetch(`${API_BASE_URL}/api/staff/bus-queue`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${savedSession?.token || ""}`,
        },
      });
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem(SESSION_KEY);
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
      setError("Live bus queue is unavailable. Check if the Spring Boot backend is running.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCashTransactions({ silent = false } = {}) {
    if (!silent) setCashLoading(true);
    try {
      const savedSession = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      if (!savedSession?.token) {
        localStorage.removeItem(SESSION_KEY);
        onLogout();
        return;
      }
      const response = await fetch(`${API_BASE_URL}/api/staff/cash-transactions/today`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${savedSession?.token || ""}` },
      });
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem(SESSION_KEY);
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
  }

  queueLoaderRef.current = loadQueue;
  cashLoaderRef.current = loadCashTransactions;

  useEffect(() => {
    loadQueue();
    const timer = window.setInterval(() => loadQueue({ silent: true }), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeView !== "transactions") return undefined;
    loadCashTransactions();
    const timer = window.setInterval(() => loadCashTransactions({ silent: true }), 30000);
    return () => window.clearInterval(timer);
  }, [activeView]);

  useEffect(() => {
    const savedSession = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
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
  const activeQueue = activeTerminal === "sm" ? queue.incomingToSmTerminal : queue.incomingToGrandTerminal;
  const activeTitle = activeTerminal === "sm" ? "Incoming to SM Terminal" : "Incoming to Grand Terminal";

  return (
    <main className="min-h-screen bg-[#f3f4f7] text-[#352f33]">
      <header className="bg-brand-primary text-white shadow-sm">
        <div className="relative mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="Premier Transit" className="h-11 w-11 shrink-0 rounded-full border-2 border-white/80 bg-white p-1 object-contain" />
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#f8d26a]">Premier Transit</p>
              <h1 className="truncate text-lg font-black leading-tight">Staff Bus Queue</h1>
              <p className="text-[11px] font-semibold text-white/75">Logged in as {username}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-white/10 text-2xl font-black text-white"
            aria-label="Open staff menu"
          >
            ...
          
          </button>

          {menuOpen ? (
            <div className="absolute right-4 top-[3.8rem] z-20 w-48 rounded-xl border border-[#e6e8ee] bg-white p-3 text-[#352f33] shadow-lg">
              <p className="mb-2 text-sm font-bold">Logged in as staff</p>
              <button
                type="button"
                onClick={onLogout}
                className="min-h-11 w-full rounded-lg bg-brand-primary/10 px-3 text-left text-sm font-black text-brand-primary"
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <section className="mx-auto w-full max-w-3xl px-4 py-4">
        <nav className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-[#e6e8ee] bg-white p-2 shadow-sm" aria-label="Staff pages">
          <button type="button" onClick={() => setActiveView("queue")} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-black ${activeView === "queue" ? "bg-brand-primary text-white" : "text-[#6f2f3c]"}`}>
            <BusFront size={18} /> Queue
          </button>
          <button type="button" onClick={() => setActiveView("transactions")} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-black ${activeView === "transactions" ? "bg-brand-primary text-white" : "text-[#6f2f3c]"}`}>
            <ListChecks size={18} /> Transactions
          </button>
        </nav>

        {activeView === "transactions" ? (
          <CashTransactions data={cashData} loading={cashLoading} error={cashError} onRefresh={() => loadCashTransactions()} />
        ) : (
        <>
        <div className="mb-4 rounded-2xl border border-[#e6e8ee] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#6f2f3c]">Staff Dashboard</p>
              <h2 className="mt-1 text-2xl font-black text-[#352f33] max-[420px]:text-xl">Bus Queue Monitoring</h2>
              <p className="mt-1 max-w-[14rem] text-xs font-semibold text-[#717680] sm:max-w-none">Last updated: {updatedLabel} - Auto refresh every 5 seconds</p>
            </div>
            <button onClick={() => loadQueue()} className="min-h-11 shrink-0 rounded-xl bg-brand-primary px-4 text-sm font-black text-white transition hover:bg-brand-primary-dark">
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white border border-[#e6e8ee] p-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#717680]">Total Buses</p>
            <p className="mt-2 text-2xl font-black text-[#6f2f3c]">{totalBuses}</p>
          </div>
          <div className="rounded-xl bg-white border border-[#e6e8ee] p-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#717680]">Incoming SM</p>
            <p className="mt-2 text-2xl font-black text-[#6f2f3c]">{queue.incomingToSmTerminal.length}</p>
          </div>
          <div className="rounded-xl bg-white border border-[#e6e8ee] p-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#717680]">Incoming Grand</p>
            <p className="mt-2 text-2xl font-black text-[#6f2f3c]">{queue.incomingToGrandTerminal.length}</p>
          </div>
        </div>

        {loading ? <p className="mb-4 rounded-lg bg-white border border-[#e6e8ee] p-4 text-sm font-bold text-[#717680]">Loading bus queue...</p> : null}
        {error ? <p className="mb-4 rounded-lg bg-[#fff7df] border border-[#e8bd47] p-4 text-sm font-bold text-[#8a5a00]">{error}</p> : null}

        <div className="mb-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              setActiveTerminal("sm");
              captureEvent("staff_terminal_tab_selected", {
                terminal: "sm",
              });
            }}
            className={[
              "min-h-20 rounded-2xl border-2 bg-white p-3 text-left transition shadow-sm",
              activeTerminal === "sm" ? "border-blue-500 bg-blue-50" : "border-[#e6e8ee] hover:border-blue-200",
            ].join(" ")}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-black text-[#352f33]">
                <span className="h-3 w-3 rounded-full bg-blue-500" />
                SM Terminal
              </span>
              <span className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-black text-blue-700">
                {queue.incomingToSmTerminal.length} bus
              </span>
            </div>
            <p className="text-xs font-semibold text-[#717680]">Show buses incoming to SM Terminal</p>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTerminal("grand");
              captureEvent("staff_terminal_tab_selected", {
                terminal: "grand",
              });
            }}
            className={[
              "min-h-20 rounded-2xl border-2 bg-white p-3 text-left transition shadow-sm",
              activeTerminal === "grand" ? "border-green-500 bg-green-50" : "border-[#e6e8ee] hover:border-green-200",
            ].join(" ")}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-black text-[#352f33]">
                <span className="h-3 w-3 rounded-full bg-green-500" />
                Grand Terminal
              </span>
              <span className="rounded-full bg-green-100 px-2 py-1 text-[11px] font-black text-green-700">
                {queue.incomingToGrandTerminal.length} bus
              </span>
            </div>
            <p className="text-xs font-semibold text-[#717680]">Show buses incoming to Grand Terminal</p>
          </button>
        </div>

        <QueueSection title={activeTitle} buses={activeQueue} />
        </>
        )}
      </section>
    </main>
  );
}
export default function App() {
  const [session, setSession] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      if (saved?.role === "STAFF" && typeof saved?.token === "string" && saved.token.length > 20) {
        return saved;
      }
      localStorage.removeItem(SESSION_KEY);
      return null;
    } catch {
      localStorage.removeItem(SESSION_KEY);
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
    localStorage.removeItem(SESSION_KEY);
    captureEvent("staff_logout");
    setSession(null);
  }

  if (!session) return <LoginPage onLogin={setSession} />;
  return <Dashboard username={session.fullName || session.username} onLogout={handleLogout} />;
}
