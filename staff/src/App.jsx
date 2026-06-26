import React, { useEffect, useMemo, useState } from "react";
import logo from "./assets/image/premier-logo.png";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
const STAFF_USERNAME = import.meta.env.VITE_STAFF_USERNAME || "staff";
const STAFF_PASSWORD = import.meta.env.VITE_STAFF_PASSWORD || "staff123";
const SESSION_KEY = "premier_staff_session";

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
      return "SM Terminal to Grand Terminal";
    }
    if (distanceToGrand <= TERMINAL_GEOFENCE_KM) {
      return "Grand Terminal to SM Terminal";
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

  const apiDistance = Number(bus.distanceRemainingKm ?? bus.distanceKm);
  const apiEta = Number(bus.estimatedArrivalMinutes ?? bus.etaMinutes);

  return {
    plateNumber: bus.plateNumber || "Unknown Plate",
    routeDirection,
    distanceRemainingKm: Number.isFinite(apiDistance) ? apiDistance : Math.round(distance * 10) / 10,
    estimatedArrivalMinutes: Number.isFinite(apiEta) ? apiEta : Math.max(1, Math.round((distance / speed) * 60)),
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

  function handleSubmit(event) {
    event.preventDefault();

    if (username.trim() === STAFF_USERNAME && password === STAFF_PASSWORD) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ username: username.trim(), loggedInAt: Date.now() }));
      onLogin(username.trim());
      return;
    }

    setError("Invalid staff username or password.");
  }

  return (
    <main className="min-h-screen grid place-items-center px-4 py-8 bg-[linear-gradient(135deg,#edf1f6_0%,#f8fafc_100%)]">
      <section className="grid grid-cols-[minmax(280px,1fr)_minmax(320px,1fr)] w-full max-w-5xl min-h-[35rem] overflow-hidden rounded-2xl bg-white shadow-[0_22px_52px_rgba(44,36,41,0.18)] max-[860px]:grid-cols-1">
        <div className="grid place-content-center p-8 text-white text-center bg-[linear-gradient(180deg,#6f2f3c_0%,#572631_100%)] max-[860px]:min-h-64">
          <div>
            <div className="w-24 h-24 mx-auto mb-6 border-4 border-white/75 rounded-full bg-white overflow-hidden shadow-[0_10px_22px_rgba(0,0,0,0.18)]">
              <img src={logo} alt="Premier Transit" className="w-full h-full object-cover" />
            </div>
            <h1 className="m-0 text-3xl font-black tracking-wider">PREMIER TRANSIT</h1>
            <p className="mt-3 mb-0 text-[#e8bd47] font-extrabold tracking-wider">Staff Bus Queue</p>
          </div>
        </div>

        <div className="grid content-center p-[clamp(2rem,5vw,3.5rem)] bg-white">
          <h2 className="m-0 text-[#6f2f3c] text-3xl font-black">Staff Login</h2>
          <p className="mt-1 mb-7 text-[#717680] text-sm">Sign in to monitor buses near SM Terminal and Grand Terminal.</p>

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
              className="w-full min-h-12 mb-5 px-4 border-2 border-[#d9dce2] rounded-lg bg-white text-[#352f33] outline-none transition focus:border-[#e8bd47] focus:shadow-[0_0_0_4px_rgba(232,189,71,0.18)]"
            />

            <label htmlFor="staff-password" className="block mb-2 text-[#343946] font-extrabold text-sm">Password</label>
            <input
              id="staff-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              required
              className="w-full min-h-12 mb-5 px-4 border-2 border-[#d9dce2] rounded-lg bg-white text-[#352f33] outline-none transition focus:border-[#e8bd47] focus:shadow-[0_0_0_4px_rgba(232,189,71,0.18)]"
            />

            {error ? <p className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700 border border-red-100">{error}</p> : null}

            <button type="submit" className="w-full min-h-12 rounded-lg bg-[#6f2f3c] text-white font-black transition hover:bg-[#572631] hover:-translate-y-px hover:shadow-[0_10px_20px_rgba(111,47,60,0.22)]">
              Login
            </button>
          </form>

          <p className="mt-6 text-xs text-[#717680]">Default login: staff / staff123</p>
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
        <StatTile label="Distance" value={`${bus.distanceRemainingKm.toFixed(1)} km`} />
        <StatTile label="ETA" value={`${bus.estimatedArrivalMinutes} min`} />
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

function Dashboard({ username, onLogout }) {
  const [queue, setQueue] = useState(emptyQueue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeTerminal, setActiveTerminal] = useState("grand");
  const [menuOpen, setMenuOpen] = useState(false);

  async function loadQueue({ silent = false } = {}) {
    if (!silent) setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/driver/buses`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const payload = await response.json();
      setQueue(buildQueueFromDriverBuses(payload));
      setError("");
      setLastUpdated(new Date());
    } catch (requestError) {
      setError("Live bus queue is unavailable. Check if the Spring Boot backend is running.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
    const timer = window.setInterval(() => loadQueue({ silent: true }), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const updatedLabel = useMemo(() => {
    if (!lastUpdated) return "Waiting for live update";
    return lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }, [lastUpdated]);

  const totalBuses = queue.incomingToSmTerminal.length + queue.incomingToGrandTerminal.length;
  const activeQueue = activeTerminal === "sm" ? queue.incomingToSmTerminal : queue.incomingToGrandTerminal;
  const activeTitle = activeTerminal === "sm" ? "Incoming to SM Terminal" : "Incoming to Grand Terminal";

  return (
    <main className="min-h-screen bg-[#f3f4f7] text-[#352f33]">
      <header className="bg-[#8b1a1a] text-white shadow-sm">
        <div className="relative mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="Premier Transit" className="h-11 w-11 shrink-0 rounded-full border-2 border-white/80 bg-white object-cover" />
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
                className="min-h-11 w-full rounded-lg bg-red-50 px-3 text-left text-sm font-black text-[#8b1a1a]"
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <section className="mx-auto w-full max-w-3xl px-4 py-4">
        <div className="mb-4 rounded-2xl border border-[#e6e8ee] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#6f2f3c]">Staff Dashboard</p>
              <h2 className="mt-1 text-2xl font-black text-[#352f33] max-[420px]:text-xl">Bus Queue Monitoring</h2>
              <p className="mt-1 max-w-[14rem] text-xs font-semibold text-[#717680] sm:max-w-none">Last updated: {updatedLabel} - Auto refresh every 5 seconds</p>
            </div>
            <button onClick={() => loadQueue()} className="min-h-11 shrink-0 rounded-xl bg-[#8b1a1a] px-4 text-sm font-black text-white transition hover:bg-[#6f2f3c]">
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
            onClick={() => setActiveTerminal("sm")}
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
            onClick={() => setActiveTerminal("grand")}
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
      </section>
    </main>
  );
}
export default function App() {
  const [username, setUsername] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      return saved?.username || "";
    } catch {
      return "";
    }
  });

  function handleLogout() {
    localStorage.removeItem(SESSION_KEY);
    setUsername("");
  }

  if (!username) return <LoginPage onLogin={setUsername} />;
  return <Dashboard username={username} onLogout={handleLogout} />;
}

