// src/main/untis.js
import { WebUntisAnonymousAuth, WebUntisElementType } from "webuntis";
import dotenv from "dotenv";
import { BrowserWindow } from "electron";
import ElectronStore from "electron-store";

export { WebUntisElementType };

dotenv.config();
const Store = ElectronStore.default;

/* -------------------- Cache Layer -------------------- */
const cache = {
  classes: null,
  teachers: null,
  subjects: null,
};

export function invalidateCache() {
  cache.classes = null;
  cache.teachers = null;
  cache.subjects = null;
  console.log("Cache invalidated.");
}

function isCacheValid() {
  return cache.classes !== null;
}

/* -------------------- Singleton Untis Client -------------------- */
const client = new WebUntisAnonymousAuth(
  process.env.UNTIS_SCHOOL || "Vinnuhaskulin Torshavn",
  process.env.UNTIS_SERVER || "hektor.webuntis.com"
);

let loginPromise = null;

const getLoginPromise = () => {
    if (!loginPromise) {
        loginPromise = client.login().catch(err => {
            loginPromise = null; // Allow retries on failure
            throw err;
        });
    }
    return loginPromise;
};

async function withClient(task) {
  try {
    await getLoginPromise();
    return await task(client);
  } catch (err) {
    // This handles cases where the session expires between calls
    if (String(err?.message).includes("Current Session is not valid") || err?.code === -8505) {
      console.warn("Untis session expired. Attempting to re-login...");
      try { await client.logout(); } catch { /* ignore */ }
      loginPromise = null; // Force a new login
      
      await getLoginPromise(); // Wait for the new login
      return await task(client); // Retry the task
    }
    loginPromise = null; // Also reset on other errors
    throw err;
  }
}

/* -------------------- Untis helpers -------------------- */
function getServer() { return process.env.UNTIS_SERVER || "hektor.webuntis.com"; }
function getSchool() { return process.env.UNTIS_SCHOOL || "Vinnuhaskulin Torshavn"; }
export function getBaseUrl() { return `https://${getServer()}/WebUntis`; }

function parseUntisTime(date, hhmm) {
  const h = Math.floor(hhmm / 100), m = hhmm % 100;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0, 0);
}

/* ---------- mapping helpers (RPC + public weekly) ---------- */
function toInitialsFromString(s) {
  const clean = String(s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  if (/^[A-ZÁÐÍÓÚÝÆØÅ]{1,5}$/.test(clean.trim())) return clean.trim();
  const parts = clean.split(/[\s.\-_/]+/).filter(Boolean);
  return parts.map(p => p[0]).join("").toUpperCase();
}

function normStr(s) {
  return String(s || "")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim();
}

const GENERIC_SUBJECTS = new Set([
  "undirvísing","undirvising","undervisning","lektion","lesson","class"
].map(normStr));

function makeElemLookup(root) {
  const arr =
    (Array.isArray(root?.elements) && root.elements) ||
    (Array.isArray(root?.elementList) && root.elementList) ||
    (Array.isArray(root?.elementIds) && root.elementIds) ||
    [];
  const m = new Map();
  for (const e of arr) m.set(`${Number(e?.type)}:${Number(e?.id)}`, e);
  return m;
}
function pickLabel(e, pref) {
  if (!e) return "";
  if (pref === "room")  return e.name || e.displayname || e.displayName || e.longname || e.longName || "";
  if (pref === "teacher") return e.name || e.displayname || e.displayName || e.longname || e.longName || "";
  return e.longname || e.longName || e.name || e.displayname || e.displayName || "";
}
function getPeriodElem(period) {
  const els = Array.isArray(period?.elements) ? period.elements : (Array.isArray(period?.els) ? period.els : []);
  return (type) => els.find(x => Number(x?.type) === Number(type)) || null;
}
function mapLesson(l, lookup) {
  const day = l.date || l.startDate || l.endDate;
  const yyyy = Math.floor(day / 10000), mm = Math.floor((day % 10000) / 100) - 1, dd = day % 100;
  const base = new Date(yyyy, mm, dd, 0, 0, 0, 0);
  const start = l.startTime ? parseUntisTime(base, l.startTime) : base;
  const end   = l.endTime   ? parseUntisTime(base, l.endTime)   : base;

  let subject = l.su?.[0]?.longname || l.su?.[0]?.longName || l.su?.[0]?.name || l.subjects?.[0]?.longname || l.subjects?.[0]?.longName || l.subjects?.[0]?.name || "";
  let room = l.ro?.[0]?.name || l.rooms?.[0]?.name || l.ro?.[0]?.longname || l.rooms?.[0]?.longname || "";
  let teacher = l.te?.[0]?.name || l.teachers?.[0]?.name || l.te?.[0]?.displayname || l.teachers?.[0]?.displayname || l.te?.[0]?.longName || l.teachers?.[0]?.longname || "";

  const pe = getPeriodElem(l);
  if (lookup) {
    if (!subject || GENERIC_SUBJECTS.has(normStr(subject))) {
      const e = pe(WebUntisElementType.SUBJECT);
      const ref = e && lookup.get(`${WebUntisElementType.SUBJECT}:${Number(e.id)}`);
      const lab = pickLabel(e || ref, "subject") || (ref && pickLabel(ref, "subject")) || "";
      if (lab && !GENERIC_SUBJECTS.has(normStr(lab))) subject = lab;
    }
    if (!room) {
      const e = pe(WebUntisElementType.ROOM);
      const ref = e && lookup.get(`${WebUntisElementType.ROOM}:${Number(e.id)}`);
      const lab = pickLabel(e || ref, "room") || (ref && pickLabel(ref, "room")) || "";
      if (lab) room = lab;
    }
    if (!teacher) {
      const e = pe(WebUntisElementType.TEACHER);
      const ref = e && lookup.get(`${WebUntisElementType.TEACHER}:${Number(e.id)}`);
      let lab = pickLabel(e || ref, "teacher") || (ref && pickLabel(ref, "teacher")) || "";
      if (lab) teacher = lab;
    }
  }

  if (teacher) teacher = toInitialsFromString(teacher);

  const code = String(l.code || l.lstext || "").toLowerCase();
  const state = String(l.cellState || l.state || "").toLowerCase();
  const isCancelled = code.includes("cancel") || state.includes("cancel");

  return {
    id: l.id || `${day}-${l.startTime}-${subject || "unknown"}`,
    start, end,
    subject: subject || "—",
    room: room || "—",
    teacher: teacher || "",
    isCancelled
  };
}

function teacherLabelFromAny(te) {
  const n = te?.name || te?.displayname || te?.longName || te?.longname || "";
  return toInitialsFromString(n) || String(te?.id || "");
}
const norm = (s) => String(s || "").toLowerCase().trim();
const normInits = (s) => String(s || "").toLowerCase().replace(/[ .]/g, "").trim();

async function preflightSchool() {
  try { await fetch(`${getBaseUrl()}/?school=${encodeURIComponent(getSchool())}`, { cache: "no-store" }); } catch {}
}
function withSchool(pathAndQuery) {
  const sep = pathAndQuery.includes("?") ? "&" : "?";
  return `${pathAndQuery}${sep}school=${encodeURIComponent(getSchool())}`;
}
async function fetchJSONPublic(pathAndQuery) {
  await preflightSchool();
  const url = `${getBaseUrl()}${withSchool(pathAndQuery)}`;
  const res = await fetch(url, { headers: {
      accept: "application/json",
      "User-Agent": "Faroese Timetable Helper"
    } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
function yyyymmddOf(dateStrOrDate) {
  const d = (dateStrOrDate instanceof Date) ? dateStrOrDate : new Date(dateStrOrDate);
  const yyyy = d.getFullYear(), mm = String(d.getMonth()+1).padStart(2,"0"), dd = String(d.getDate()).padStart(2,"0");
  return Number(`${yyyy}${mm}${dd}`);
}

function formatIdForElementType(elementType) {
  const t = Number(elementType);
  if (t === WebUntisElementType.TEACHER) return 3;
  if (t === WebUntisElementType.CLASS)   return 1;
  if (t === WebUntisElementType.ROOM)    return 4;
  return 1;
}
async function fetchPublicDay(elementType, elementId, dateStr) {
  const target = yyyymmddOf(dateStr);
  const primary = formatIdForElementType(elementType);
  const tryIds = Array.from(new Set([primary, 1, 3, 4]));

  for (const fid of tryIds) {
    try {
      const json = await fetchJSONPublic(
        `/api/public/timetable/weekly/data?elementType=${encodeURIComponent(elementType)}&elementId=${encodeURIComponent(elementId)}&date=${encodeURIComponent(dateStr)}&formatId=${encodeURIComponent(fid)}`
      );
      const root = json?.data?.result?.data || {};
      const lookup = makeElemLookup(root);

      const epById = root.elementPeriods?.[String(elementId)] || [];
      const todays1 = epById.filter(r => Number(r.date || r.startDate || r.endDate) === target);
      if (todays1.length) return todays1.map(r => mapLesson(r, lookup)).sort((a,b)=>a.start-b.start);

      const periods = Array.isArray(root.periods) ? root.periods : [];
      const todays2 = periods.filter(p => {
        const dnum = Number(p.date || p.startDate || p.endDate);
        if (dnum !== target) return false;
        const els = Array.isArray(p.elements) ? p.elements : [];
        return els.some(e => Number(e?.type) === Number(elementType) && Number(e?.id) === Number(elementId));
      });
      if (todays2.length) return todays2.map(r => mapLesson(r, lookup)).sort((a,b)=>a.start-b.start);
    } catch { /* try next */ }
  }
  return [];
}

async function fetchPublicTeachers() {
    // This function uses a public, unauthenticated endpoint, so it doesn't need the session.
    // However, to prevent it from running concurrently with a login, we can wrap it.
    return withClient(async () => {
        const json = await fetchJSONPublic(`/api/public/timetable/weekly/pageconfig?type=2`);
        const arr = json?.data?.elements || [];
        const out = arr.map(el => ({
            id: el?.id,
            type: WebUntisElementType.TEACHER,
            label: (/^[A-ZÁÐÍÓÚÝÆØÅ]{1,5}$/.test(String(el?.name || "").trim()))
              ? String(el.name).trim()
              : toInitialsFromString(el?.name || el?.displayname || el?.longname || "")
        })).filter(x => x.id && x.label);
        const seen = new Set();
        return out.filter(x => (seen.has(x.label) ? false : (seen.add(x.label), true)))
                  .sort((a,b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
    });
}

export async function resolveElementByName(name) {
  const allElements = await listElements();
  const target = norm(name);

  const classHit = allElements.classes.find(cl => norm(cl.label) === target);
  if (classHit) return { id: classHit.id, type: WebUntisElementType.CLASS, label: classHit.label };

  const teacherHit = allElements.teachers.find(p => normInits(p.label) === normInits(target));
  if (teacherHit) return { id: teacherHit.id, type: WebUntisElementType.TEACHER, label: teacherHit.label };

  throw new Error(`Fann ikki "${name}" sum flokk ella lærara.`);
}

export async function getToday(id, type) {
  return withClient(async (c) => {
    const lessons = await c.getTimetableForToday(id, Number(type));
    return lessons.map(l => mapLesson(l)).sort((a, b) => a.start - b.start);
  });
}

export async function getForDate(id, type, dateStr) {
  // This function seems to be using a public fetch method which doesn't require the authenticated client.
  // It can remain as is, but for consistency, we could wrap it if it ever needs authentication.
  return await fetchPublicDay(type, id, dateStr);
}

export async function listElements() {
  if (isCacheValid()) {
    return {
      classes: cache.classes,
      teachers: cache.teachers,
      subjects: cache.subjects,
      meta: {
        classesAvailable: cache.classes.length > 0,
        teachersAvailable: cache.teachers.length > 0,
        fromCache: true
      }
    };
  }

  return withClient(async (c) => {
    let classes = [], teachers = [], subjects = [];
    try {
      const cl = await c.getClasses();
      classes = cl.map(cls => ({
        id: cls.id, type: WebUntisElementType.CLASS,
        label: cls.longName || cls.name || String(cls.id)
      })).sort((a,b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
    } catch {}

    try {
        const su = await c.getSubjects();
        subjects = su.map(s => ({
            id: s.id,
            name: s.name,
            longName: s.longName
        })).sort((a, b) => (a.longName || a.name).localeCompare(b.longName || b.name, undefined, { sensitivity: "base" }));
    } catch {}

    try {
      const t = await c.getTeachers();
      teachers = t.map(te => ({
        id: te.id, type: WebUntisElementType.TEACHER, label: teacherLabelFromAny(te)
      })).filter(x => x.id && x.label);
    } catch {}
    try {
      const pub = await fetchPublicTeachers();
      const byId = new Map(teachers.map(t => [String(t.id), t]));
      for (const p of pub) {
        const existing = byId.get(String(p.id));
        if (!existing || !existing.label) byId.set(String(p.id), { id: p.id, type: WebUntisElementType.TEACHER, label: p.label });
      }
      teachers = Array.from(byId.values());
      const seen = new Set();
      teachers = teachers.filter(x => (seen.has(x.label) ? false : (seen.add(x.label), true)));
    } catch {}

    teachers.sort((a,b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

    // Populate cache
    cache.classes = classes;
    cache.teachers = teachers;
    cache.subjects = subjects;

    return { classes, teachers, subjects, meta: { classesAvailable: classes.length>0, teachersAvailable: teachers.length>0 } };
  });
}

export function buildUntisUrl(elementId, elementType, dateStrOptional) {
    const d = dateStrOptional ? new Date(dateStrOptional) : new Date();
    const yyyy = d.getFullYear(), mm = String(d.getMonth()+1).padStart(2,"0"), dd = String(d.getDate()).padStart(2,"0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const base = `${getBaseUrl()}/?school=${encodeURIComponent(getSchool())}`;
    return `${base}#/timetable?elementType=${encodeURIComponent(elementType)}&elementId=${encodeURIComponent(elementId)}&date=${encodeURIComponent(dateStr)}`;
}

export async function fetchAndSchedule() {
    const store = new Store();
    const savedElements = store.get("untis.elements"); // Correct key
    let resolvedElements = [];
    if (savedElements) { try { resolvedElements = JSON.parse(savedElements); } catch {} }

    if (!Array.isArray(resolvedElements) || resolvedElements.length === 0) {
        console.log("Background Fetch: No selected elements, skipping fetch.");
        return;
    }

    try {
        // Fetch lessons for all resolved elements, filtering out the "empty" placeholder
        const allLessonsPromises = resolvedElements
            .filter(element => element.id !== -1)
            .map(element => getToday(element.id, element.type));

        const lessonGroups = await Promise.all(allLessonsPromises);

        // Combine and deduplicate lessons, just like in the renderer
        const lessonMap = new Map();
        for (const lessonList of lessonGroups) {
            for (const lesson of lessonList) {
                if (lesson.id && !lessonMap.has(lesson.id)) {
                    lessonMap.set(lesson.id, lesson);
                }
            }
        }
        const combinedLessons = Array.from(lessonMap.values());

        // Send the complete, updated list to the active window
        const mainWin = BrowserWindow.getAllWindows()[0];
        if (mainWin && !mainWin.isDestroyed()) {
            mainWin.webContents.send("lessons-updated", combinedLessons);
        }
    } catch (error) {
        console.error("Background Fetch: Failed to fetch lessons for scheduling:", error);
    }
}
