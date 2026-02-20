# 🚀 SIMplify: Developer Guide & Documentation

Welcome to the **SIMplify** codebase! If you are new to Next.js, Tailwind CSS, or GitHub, do not panic. This guide is written specifically for our team. Please read this before you start coding!

Our app is built with **Next.js 15 (App Router)**, **Tailwind CSS v4**, and **Supabase**.

---

## 👑 Team Roles

* **Alex (Tech & Project Lead):** The architect. Set up the repo, database, and handles the tricky API connections. Ask Alex if your code won't compile or if you get a merge conflict!
* **Ameer (Backend Lead):** The data master. Writes the logic to fetch, update, and save data (Points, Locations, Users) from our Supabase database.
* **Kimbery (UI/UX Lead):** The visionary. Designs the Figma wireframes and sets the rules for our "Relax View" color palette and typography.
* **Helen & Chris (Frontend Developers):** The builders. You turn Kimbery's designs into actual, clickable React code using Tailwind CSS. 

---

## 📂 Where Does Everything Go? (Folder Guide)

We use a strict **MVC (Model-View-Controller)** pattern. Do not put files in random places!



```text
/src
  ├── /app                 <-- PAGES: This is where the website URLs live.
  │    ├── globals.css     <-- TAILWIND COLORS: Our "Relax View" palette lives here.
  │    ├── layout.tsx      <-- THE WRAPPER: The Sidebar and background live here.
  │    └── page.tsx        <-- HOMEPAGE: The main dashboard.
  │
  ├── /components          <-- LEGO BLOCKS: Reusable UI pieces.
  │    ├── /features       <-- Smart components (e.g., InteractiveMap.tsx).
  │    └── /layout         <-- Structure components (e.g., Sidebar.tsx).
  │
  ├── /lib/api             <-- BACKEND LOGIC: Ameer works here (e.g., locations.ts).
  ├── /types               <-- TYPESCRIPT RULES: Defines what our database looks like.
  └── /utils/supabase      <-- SUPABASE ENGINES: Do not touch these!

```

---

## 🎨 1. Frontend Guide (For Helen & Chris)

### A. Styling with Tailwind CSS v4

We do **not** write separate `.css` files for our components. We use Tailwind utility classes directly in the `className`.

* ❌ **Rule 1: Avoid Inline Styles!** Do not use `style={{ ... }}` for regular positioning or colors.
* *Wrong:* `<div style={{ display: "flex", marginTop: "20px", backgroundColor: "#F5D2D2" }}>`
* *Right:* `<div className="flex mt-5 bg-rose-200">`
* *Exception:* Only use inline styles for dynamic math, like placing a pin on the map: `style={{ left: \`{y}%` }}`.


* 🙋 **"Kimbery gave us a new color! How do I add it?"**
If we need a new custom color, add it to the `@theme inline` section in `src/app/globals.css`.
```css
@theme inline {
  --color-purple-200: #E9D5FF; /* <-- Add new color here */
}

```


Now you can use `<div className="bg-purple-200">` anywhere!

### B. Creating New Pages

Next.js uses **Folder-Based Routing**.

* ❌ **Wrong:** Creating `rewards.tsx` in the `app` folder.
* ✅ **Right:** Create a new folder called `rewards`, and put a `page.tsx` file inside it: `src/app/rewards/page.tsx`. This automatically creates the URL `localhost:3000/rewards`.

### C. Importing Files

Always use our `@/` shortcut to import things! It tells the app to start looking from the `src` folder.

* ❌ **Wrong:** `import Sidebar from '../../components/layout/Sidebar';`
* ✅ **Right:** `import Sidebar from '@/components/layout/Sidebar';`

---

## ⚙️ 2. Backend Guide (For Ameer)

### A. Database to UI Flow

When you need to get data from Supabase to the screen, follow this 3-step rule:

1. **Test the SQL:** Make sure your query works in the Supabase Dashboard SQL Editor first.
2. **Write the Function:** Create a fetch function in `src/lib/api/` (use `locations.ts` as an example). Use `await createClient()` from our utils folder to talk to the database safely.
3. **Pass to Frontend:** Helen/Chris will call your function inside their `page.tsx` files to display the data.

### B. TypeScript is your Friend

Always ensure your database queries use the interfaces defined in `src/types/database.types.ts`. This prevents the frontend team from guessing what the data looks like and stops the app from crashing if a column name changes.

---

## 🐙 3. GitHub Desktop Workflow (Crucial!)

We are using **GitHub Desktop** to manage our code visually.

🚨 **THE GOLDEN RULE: NO ONE PUSHES DIRECTLY TO `main`!** Everyone works on their own personal branch (e.g., `branch-helen`, `branch-chris`).

### 🔄 The Daily Step-by-Step UI Guide:

1. **Get the latest updates (Always do this first!)**
* Open GitHub Desktop. Make sure your "Current Branch" says `main`.
* Click **"Fetch origin"** at the top right. If it changes to **"Pull origin"**, click it to download your teammates' new code.


2. **Go to your branch**
* Click "Current Branch" and select your personal branch (e.g., `branch-helen`).
* If it asks to bring changes from `main` into your branch, **say YES**.


3. **Write your code & Save**
* Go to VS Code, write your code, and hit Save.


4. **Commit your work**
* Go back to GitHub Desktop. You will see your changed files on the left.
* At the bottom left, write a short summary (e.g., *"Added the interactive map UI"*).
* Click the blue button: **"Commit to branch-helen"**.


5. **Send it to the internet**
* Click the **"Push origin"** button at the top right.
* Go to GitHub.com, find your branch, and click **"Compare & pull request"**.
* **Alex (Tech Lead)** will review it and merge it into `main`.



### ⚠️ WARNING: The `package-lock.json` Crash

If two people run `npm install` to add a new package (like icons) at the same time, the `package.json` files get confused when merging. It causes the app to crash.

* **How to fix it:** If GitHub Desktop yells about a "Merge Conflict" in `package.json` or `package-lock.json`, **do not panic**. Stop what you are doing and **tell Alex immediately.** Alex will manually fix the file conflict in VS Code.
* **Rule of thumb:** Do not run `npm install <package>` without asking Alex first!

---

*Stuck on an error for more than 20 minutes? Stop, breathe, and ask the group chat. We are a team! 🚀*
