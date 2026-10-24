# HCM Lite - HR Management System

HCM Lite ek chhoti, complete HR web application hai jo sirf **HTML, CSS aur Vanilla JavaScript** se bani hai. Koi framework, server ya database nahi chahiye. Sara data browser ke **localStorage** mein save hota hai.

Isme do roles hain: **Admin** (company aur employees manage karta hai) aur **Employee** (apni attendance, leave aur payslip dekhta hai).

---

## 1. Kaise chalayein

1. Zip ko unzip karein (folders `css/` aur `js/` apni jagah rehne dein).
2. `index.html` ko browser (Chrome/Edge) mein double-click karke kholein.
3. **Pehli baar** setup form aayega: company ka naam, Admin ka naam, email aur password dein. Isse company aur Admin account ban jata hai.
4. Admin dashboard se **Employees** page par ja kar employees add karein (email + password dein).
5. Logout karke login page par **Employee** tab se us employee ke email/password se login karein.

> Note: data usi browser mein rehta hai jisme aapne kaam kiya. Dusre browser ya computer par data nahi dikhega. Reset karne ke liye Settings page par **Reset All Data** button hai.

---

## 2. Folder structure

```
hcm-lite/
├── index.html        Login + first-run setup
├── admin.html        Admin dashboard
├── employees.html    Admin: employees manage
├── leaves.html       Admin: leave approve/reject
├── settings.html     Admin: company settings
├── employee.html     Employee dashboard
├── payslip.html      Employee payslip
├── css/
│   └── style.css     Sab pages ki shared styling
└── js/
    ├── storage.js    localStorage + date helpers
    ├── auth.js       Login, setup, logout, role check
    ├── helper.js     Sidebar/topbar, toast, modal, Smart Helper
    ├── employees.js  Employee CRUD
    ├── attendance.js Check-in/out, rules, dashboards, payslip
    └── leave.js      Leave rules, requests, approvals
```

---

## 3. Pages ka kaam

| Page | Kaun dekh sakta hai | Kaam |
|------|---------------------|------|
| `index.html` | Sab | Pehli baar company + Admin setup, phir Admin/Employee login |
| `admin.html` | Admin | 6 stat cards, department chart, 7-day trend, aaj ki attendance table, Smart Helper |
| `employees.html` | Admin | Employee add, edit, delete, search aur department filter |
| `leaves.html` | Admin | Leave requests ko comment ke saath approve ya reject karna |
| `settings.html` | Admin | Office start time, grace minutes, yearly leave quota, company name, currency |
| `employee.html` | Employee | Check-in/out, leave apply, leave balance, apni attendance history |
| `payslip.html` | Employee | Mahine ka payslip banana aur print / PDF save karna |

---

## 4. Role-Based Access Control (RBAC)

Har protected page ke neeche ye line chalti hai:

```js
initPage("admin", "dashboard", "Executive Overview")
```

`initPage` andar `requireLogin(role)` (auth.js) chalata hai:

- Login nahi hai ya account delete ho gaya hai -> `index.html` par redirect.
- Role galat hai (jaise employee ne `admin.html` khola) -> uske apne page par redirect (`employee.html`). Admin agar employee page khole to `admin.html` par jata hai.

Admin sidebar: Dashboard, Employees, Leave Requests, Company Settings.
Employee sidebar: My Dashboard, My Payslip.

> Yeh sirf front-end check hai. Koi bhi browser DevTools se localStorage badal sakta hai, isliye ye real security nahi, demo/learning project ke liye theek hai.

---

## 5. Data storage (localStorage keys)

| Key | Kya store hota hai |
|-----|--------------------|
| `hcm_company` | `{ name, startTime, graceMinutes, yearlyLeaveQuota, currency }` |
| `hcm_users` | Users ki list (Admin + Employees) |
| `hcm_attendance` | Roz ka check-in/check-out record |
| `hcm_leaves` | Leave requests |
| `hcm_session` | Abhi login user: `{ userId, role, name }` |
| `hcm_theme` | `light` ya `dark` (extra, sirf theme ke liye) |

**User object**
```js
{ id, name, email, password (hash), role: "admin" | "employee",
  department, designation, salary, joinDate }
```

**Attendance record**
```js
{ id, userId, date: "YYYY-MM-DD", checkIn: ISO, checkOut: ISO | null,
  workHours, isLate, isHalfDay }
```

**Leave record**
```js
{ id, userId, userName, type, from, to, days, reason,
  status: "pending" | "approved" | "rejected",
  adminComment, appliedOn, decidedOn }
```

Passwords plain text mein nahi, ek simple hash (`hashPassword` in storage.js) ke saath save hote hain. Yeh demo-level hai, real security nahi.

---

## 6. Business rules

**Late**: check-in time agar `Start Time + Grace Minutes` ke baad ho.
Example: start 09:00, grace 15 min -> 09:16 ya uske baad check-in "Late".

**Half-day**: check-out ke waqt total work hours `< 5` hon.

**Absent**: working day par koi check-in record nahi, aur us din approved leave bhi nahi.

**Weekend**: Saturday aur Sunday off hain. Na attendance chahiye, na absent count hota hai, na leave mein ginte hain.

**Leave rules**
- Sirf working days ginte hain (weekends exclude).
- Pichli date ki leave apply nahi ho sakti.
- Dusri pending/approved leave ke saath dates overlap nahi ho sakti.
- Yearly quota se zyada leave apply nahi ho sakti (pending requests ke din bhi reserve count hote hain).
- Admin approve karte waqt quota dobara check hota hai. Reject karne par comment zaroori hai.

**Payslip**
```
Daily Rate  = Monthly Base Salary / us mahine ke working days
Net Salary  = Base - (Daily Rate x Absents + Daily Rate x 0.5 x Half-days)
```
Late par koi deduction nahi. Approved leave paid hai. Maujooda mahine ka payslip "provisional" hota hai kyunke sirf aaj tak ke din ginte hain.

---

## 7. JavaScript files ka detail

### `storage.js`
- `loadData / saveData`: localStorage se JSON parhna aur likhna.
- `getCompany, getUsers, getAttendance, getLeaves` aur unke `save...` functions.
- `getSession / setSession / clearSession`.
- `generateId`, `hashPassword`.
- Date helpers: `todayStr`, `parseDate`, `isWeekend`, `getDatesBetween`, `countWorkingDays`. Sab dates local `YYYY-MM-DD` string hain.

### `auth.js`
- `initLoginPage`: setup form ya login form dikhata hai (`isFirstRun` se decide hota hai).
- `handleSetup`: company + Admin banata hai.
- `handleLogin`, `logout`, `selectRole`.
- `requireLogin(role)`: RBAC guard. `getCurrentUser()`.

### `helper.js`
- `initPage`: login check + sidebar + topbar + clock banata hai.
- `showToast`, `openModal / closeModal`, `toggleTheme`, `toggleSidebar`.
- Formatting: `formatDate, formatTime, formatHours, formatMoney, initials, escapeHtml, badge`.
- **Smart Helper**: `getSmartInsights` / `renderSmartHelper`. Admin ko aaj ki salahen deta hai, jaise kaun check-in nahi kar saka, kitne late hain, pending leaves, jinki leave balance kam hai.

### `employees.js`
- `renderEmployees`: search + department filter ke saath table.
- `openEmployeeModal`, `saveEmployee` (add aur edit dono), `deleteEmployee` (us ki attendance aur leaves bhi hat jati hain).

### `attendance.js`
- Rules: `isLateCheckIn`, `calcWorkHours`, `getDayStatus` (kisi din ka status: present/late/half/leave/absent/weekend), `calcMonthStats`.
- Employee: `handleCheckIn`, `handleCheckOut`, `renderEmployeePage` aur uske parts.
- Admin: `getTodayStats`, `renderAdminDashboard`, department chart, 7-day trend, aaj ki table.
- Payslip: `generatePayslip`, `printPayslip`.

### `leave.js`
- `getUsedLeaveDays`, `isOnLeave`, `countLeaveDaysInYear`.
- Employee: `handleApplyLeave`, `renderLeaveBalance`, `renderMyLeaves`, `cancelLeave`.
- Admin: `renderAdminLeaves`, `openDecision`, `submitDecision`.

---

## 8. Coding style

- Vanilla JS: arrow functions, template literals aur `map / filter / find` ke saath traditional `for` loops.
- DOM selection sirf `document.getElementById()` se.
- Buttons par inline `onclick="..."` (addEventListener nahi).
- Har JS file ek kaam karti hai aur comments ke saath likhi hai.

---

## 9. Design aur customization

- Ek hi `css/style.css` sab pages par lagti hai. Responsive hai (mobile par sidebar hamburger menu ban jata hai) aur dark mode support karti hai.
- **Colors badalne ke liye** `css/style.css` ke top par `:root` mein `--primary`, `--primary-dark`, `--primary-soft`, `--bg`, `--green` wagaira badlein. Dark mode ke liye `[data-theme="dark"]` block hai.
- Weekend ke din badalne hon to `isWeekend` function (storage.js) mein badlein.
- Nayi sidebar link ke liye `helper.js` ka `NAV` object edit karein.

---

## 10. Known limitations

- Data sirf ek browser ke localStorage mein hai (koi backend nahi).
- Password hash aur RBAC front-end level hain, real security nahi.
- Public holidays support nahi hain, sirf Saturday/Sunday off hain.
- Agar employee check-out bhool jaye to uske ghante calculate nahi hote aur din "Present/Late" hi rehta hai.
- Admin ke liye alag payslip view nahi hai. Payslip sirf employee ko dikhta hai.
