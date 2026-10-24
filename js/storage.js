/* ==========================================================
   storage.js - localStorage helpers + date utilities
   Keys: hcm_company, hcm_users, hcm_attendance, hcm_leaves, hcm_session
   ========================================================== */

const KEYS = {
  company: "hcm_company",
  users: "hcm_users",
  attendance: "hcm_attendance",
  leaves: "hcm_leaves",
  session: "hcm_session"
};

// ---------- Generic read / write ----------
const loadData = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback; // corrupted JSON -> use default
  }
};

const saveData = (key, value) => localStorage.setItem(key, JSON.stringify(value));

// ---------- Company (settings have safe defaults) ----------
const getCompany = () => {
  const defaults = { name: "My Company", startTime: "09:00", graceMinutes: 15, yearlyLeaveQuota: 20, currency: "PKR" };
  return Object.assign(defaults, loadData(KEYS.company, {}));
};
const saveCompany = (company) => saveData(KEYS.company, company);

// ---------- Collections ----------
const getUsers = () => loadData(KEYS.users, []);
const saveUsers = (list) => saveData(KEYS.users, list);
const getAttendance = () => loadData(KEYS.attendance, []);
const saveAttendance = (list) => saveData(KEYS.attendance, list);
const getLeaves = () => loadData(KEYS.leaves, []);
const saveLeaves = (list) => saveData(KEYS.leaves, list);

// ---------- Session ----------
const getSession = () => loadData(KEYS.session, null);
const setSession = (user) => saveData(KEYS.session, { userId: user.id, role: user.role, name: user.name });
const clearSession = () => localStorage.removeItem(KEYS.session);

// ---------- IDs & password hashing ----------
const generateId = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Simple hash so passwords are not stored as plain text.
// NOTE: this is a demo-level hash, not real security (everything lives in the browser).
function hashPassword(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) + hash + text.charCodeAt(i);
    hash |= 0;
  }
  return "h" + Math.abs(hash).toString(36);
}

// ---------- Date utilities (all dates are local "YYYY-MM-DD" strings) ----------
const toDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const todayStr = () => toDateStr(new Date());
const parseDate = (str) => new Date(`${str}T00:00:00`);

const isWeekend = (str) => {
  const day = parseDate(str).getDay();
  return day === 0 || day === 6; // Sunday or Saturday
};

// Every date from "from" to "to" (inclusive)
function getDatesBetween(from, to) {
  const result = [];
  const current = parseDate(from);
  const end = parseDate(to);
  while (current <= end) {
    result.push(toDateStr(current));
    current.setDate(current.getDate() + 1);
  }
  return result;
}

// Working days only (weekends excluded)
const countWorkingDays = (from, to) => getDatesBetween(from, to).filter((d) => !isWeekend(d)).length;
