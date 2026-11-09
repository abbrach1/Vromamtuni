# ורוממתנו · Striving to New Heights · Yeshiva Toras Chaim

A web app for ורוממתנו (Vromamtanu), the yeshiva's 5787 program. Bachurim sign up for the parts of the program they're taking on and mark their progress each week from their phones. Staff see everyone at a glance. The whole app works in **English** (Ashkenazi spelling) and **Hebrew** (right-to-left), with a language button on every screen.

- **Sign-up:** a bachur enters his name and ticks any of the 10 requirements, grouped by pillar. Choosing Sur Me'ra opens a field for his SMART goal. He can change his sign-up at any time.
- **My week:** runs Sunday to Shabbos, labelled with the parsha, with previous/next week arrows. Each requirement has a simple tap input, a "Met" / "In progress" badge and a progress line. A summary at the top shows "X of Y goals met this week". Every tap saves by itself, and it still works with no signal: changes are kept on the phone and sync when it's back online.
- **Wall tablet:** a tablet on the wall of the beis medrash at `/kiosk`. A bachur taps his name, types his 4-digit PIN, marks his week with big buttons and taps **Done**. Bachurim without a phone can join right there with just a name and a PIN. It signs out by itself if someone walks away.
- **Staff overview:** a table of every bachur with his requirements, goals met this week and a 4-week trend. Tap a name to see that bachur's week (read-only). It has week navigation and a CSV export.

**Stack:** Next.js (hosted on Vercel) plus Firebase (Authentication for logins, Firestore for data). Both have free tiers that easily cover a yeshiva.

---

## Changing the program

**All program rules are in one file: [`src/config/program.ts`](src/config/program.ts).** That covers the pillars, requirement titles and descriptions (English and Hebrew), the inputs, targets, rolling windows ("3 of every 4"), the yeshiva name, the logo, the time zone and the parsha setting. Edit it, commit, and Vercel redeploys on its own. No UI code needs to change.

A few rules:

- Change titles, descriptions and targets freely.
- Don't rename a requirement `id`, a row `key` or a field `key` once bachurim are logging. Those are the names stored in the database.
- `timeZone` decides when "today" and "this week" change over. It's set to `Asia/Jerusalem`; change it if the yeshiva is elsewhere (e.g. `America/Denver`). `parshaInIsrael` picks the Eretz Yisrael or chutz la'aretz parsha schedule.

Interface text (buttons, messages) is in [`src/i18n/messages.ts`](src/i18n/messages.ts), in English and Hebrew.

### Logo and look

The ורוממתנו logo is used on the login screen, in the top bar and on the wall tablet. It comes in two files, both 1000 px wide on a transparent background:

- **`public/logo.png`**: black lettering in a gold frame, for the light theme.
- **`public/logo-gold.png`**: all gold, for the dark theme.

The app icons (`src/app/icon.png`, `src/app/apple-icon.png`) are the gold logo on black. Where the logo shows, it stands in for the program's name, so the written name is kept for screen readers only.

The design takes its cue from the logo: gold on black, with a royal feel. The light theme is black ink and gold on ivory, like the logo printed on paper; the dark theme is gold on black, like a foil-stamped cover. Type is classical serif (Cormorant Garamond, with Source Serif for reading and Frank Ruhl Libre for Hebrew) with fine ruled lines. Colors are set once at the top of `src/app/globals.css`.

---

## Setup (about 20 minutes)

### 1. Create the Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (e.g. `toras-chaim-shabbos`). Google Analytics isn't needed.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable.**
3. **Build → Firestore Database → Create database.** Choose a location near the yeshiva (e.g. `europe-west` for Eretz Yisrael, `us-central` for America) and start in **production mode**.
4. **Firestore → Rules:** delete what's there, paste the whole contents of [`firestore.rules`](firestore.rules), and click **Publish**. These rules are what keep each bachur's data private.
5. **Project settings (gear icon) → General → Your apps → Web (`</>`)**: register an app (any nickname; skip Firebase Hosting). Copy the `firebaseConfig` values: `apiKey`, `authDomain`, `projectId`, `appId`.

### 2. Deploy on Vercel

1. Push this repository to GitHub (it's already there if you're reading this on GitHub).
2. At [vercel.com](https://vercel.com) → **Add New → Project** → import the repository. Vercel detects Next.js; keep the defaults.
3. Before deploying, open **Environment Variables** and add the four values from step 1.5:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` |

4. **Deploy.** If you add or change variables later, redeploy (Deployments → ⋯ → Redeploy).
5. Back in Firebase: **Authentication → Settings → Authorized domains → Add domain**, and add your Vercel address (e.g. `toras-chaim-shabbos.vercel.app`) plus any custom domain. Password-reset emails need this.

These Firebase settings are meant to be public; the security rules in `firestore.rules` are what protect the data.

### 3. Make staff accounts

Everyone registers in the app the same way, and new accounts are always bachurim. To make someone staff:

1. Have him register in the app.
2. In the Firebase console: **Firestore Database → `users`** → find his document (the `email` field shows who it is).
3. Change the `role` field from `bachur` to `staff`.

He'll see the staff overview the next time he opens the app. Only someone with access to the Firebase console can do this; the rules stop anyone from making himself staff.

To remove a bachur, delete his user in **Authentication → Users**, and his document in `users` (and his `progress` documents, if you want his history gone).

### 4. The wall tablet

The tablet page checks PINs on the server, so it needs two more settings on Vercel (Project → Settings → Environment Variables), then a redeploy:

| Name | Value |
| --- | --- |
| `KIOSK_CODE` | Any long, random code you make up. Staff type it once on each tablet. |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase console → Project settings → **Service accounts** → **Generate new private key**. Open the downloaded file and paste its whole contents as the value. |

The service account key gives full access to the database: keep it secret. Only paste it into Vercel, never into the code, and never with a `NEXT_PUBLIC_` name.

**Setting up a tablet**

1. On the tablet, open `https://your-site.vercel.app/kiosk`. It asks for the tablet code: enter `KIOSK_CODE`.
2. Add it to the home screen so it opens full screen: in Safari, Share → **Add to Home Screen**; in Chrome, ⋮ → **Add to Home screen** (or **Install app**).
3. Lock the tablet to the app: on an iPad, **Settings → Accessibility → Guided Access**; on Android, **Settings → Security → App pinning**. Also set the screen not to turn off while charging (iPad: Settings → Display → Auto-Lock → Never).

**How bachurim use it**

- **Tap your name**, enter your **PIN**, mark the week, tap **Done**. After 90 seconds without a tap it asks "Still there?" and signs out 15 seconds later. Changes are saved before it signs out.
- **New here?** joins with a name and a PIN, then picks commitments, all on the tablet. No email or phone needed.
- **Already registered on a phone?** Set a tablet PIN in the app under **My sign-up**.
- **Forgot the PIN?** Staff open his page in the overview and tap **Reset tablet PIN**. Next time at the tablet he chooses a new one.
- Five wrong PINs lock that name for 5 minutes.

The tablet keeps no sign-in or data on the device after Done. It can show any bachur's week only after his PIN is checked, and then the same security rules apply as on his phone.

**Managed tablets (optional):** the `kiosk-bundle/` folder packages the tablet for a managed kiosk app (lockdown and remote management), run from Staff → Tablets. The bundle shows this site's `/kiosk` page, so the tablets always match the web app. See [`kiosk-bundle/README.md`](kiosk-bundle/README.md).

### 5. Optional: password-reset email in Hebrew

**Authentication → Templates → Password reset → Edit (pencil) → Template language.** The app already asks Firebase to send in the language the bachur is using.

---

## Running it on your computer

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
```

```bash
cp .env.example .env.local
```

Fill in `.env.local` with the same four Firebase values, then:

```bash
npm run dev
```

Open http://localhost:3000.

### Trying it without touching real data (Firebase emulators)

The Firebase emulators run a private copy of Authentication and Firestore on your computer, using the real `firestore.rules`. They need Java 11 or newer.

```bash
npx firebase-tools emulators:start --project demo-shabbos
```

In `.env.local`, use `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-shabbos`, any value for the API key, and add `NEXT_PUBLIC_FIREBASE_EMULATORS=1`. To try the wall tablet locally, also add `KIOSK_CODE=test`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` and `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`. The emulator dashboard at http://localhost:4000 lets you set someone's `role` to `staff`.

### Checks

```bash
npm test
```

```bash
npm run typecheck
```

`npm test` runs the rules engine tests: targets, the rolling "3 of every 4" windows, weeks, Hebrew and English progress lines.

---

## How it's built

| Where | What |
| --- | --- |
| `src/config/program.ts` | The program: pillars, requirements, targets, text in both languages, settings |
| `src/lib/rules.ts` | Turns logged entries into Met / In progress and progress lines (shared by all screens and the CSV) |
| `src/lib/db.ts` | Reading and writing Firestore |
| `firestore.rules` | Who may read and write what |
| `src/app/kiosk/`, `src/components/kiosk/` | The wall tablet |
| `src/app/api/kiosk/` | Server checks for the tablet: names, PINs (hashed, with lockout), joining |
| `src/i18n/` | Interface text in English and Hebrew; the chosen language is kept in a cookie |
| `src/app/` | Screens: `login`, `sign-up`, `progress`, `staff`, `staff/bachur/[id]` |

**Data** (Firestore):

- `users/{uid}`: `name`, `email`, `role` (`bachur` / `staff`), `requirementIds`, `smartGoal`
- `kioskPins/{uid}`: hashed tablet PIN and wrong-try count. Only the server can read it.
- `progress/{uid}_{week}`: `uid`, `week` (that week's Sunday, `YYYY-MM-DD`), `entries`, with one entry per requirement, e.g. `{ "torah-halacha": { "marks": ["sun", "mon"] } }`

**Rules worth knowing:**

- A week runs Sunday to Shabbos. Things done on Shabbos and Motzaei Shabbos belong to the week that ends with that Shabbos. On Sunday and Monday, the app reminds bachurim and links them back to last week.
- Rolling requirements (Motzaei Shabbos learning, staying in yeshiva) count the selected week plus the 3 before it.
- Sur Me'ra is tracked and shown, but not counted in "goals met".
- A past week that fell short shows **Not met** instead of In progress.
- Days later in the current week can't be marked yet, and you can't go past the current week.
- Goals are counted against what a bachur is signed up for now. If he changes his sign-up, earlier weeks are re-counted with the new list.
