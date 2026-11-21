# MatchRV mobile (Expo / React Native)

This is the cross-platform (Android + iOS) port of the native Kotlin/Compose MatchRV app in `../app`.
It uses Expo SDK 58, Expo Router and TypeScript. It talks to the same MatchRV MCP server (`https://matchrv.com/mcp`) and the same Firestore collections as the Kotlin app.

## Features

| Area | Status |
| --- | --- |
| **Discover**: swipe deck (right = save, left = pass, undo), grid view toggle, filter sheet (same fields as `FilterBottomSheet.kt`), live inventory count from `search_rvs` → `inventoryQuality.eligibleUnits`, automatic next-page prefetch | Built |
| **RV detail** (`/rv/[id]`) via `get_rv`: photos, price + price note, specs, features, boondocking, dealer, listing/walkthrough links, save, tow-fit entry, inquiry entry | Built |
| **Ask AI**: prompt → structured filters → `search_rvs`, behind the `AskAiProvider` interface. Uses Gemini through Firebase AI Logic (`firebase/ai`) when configured, otherwise a deterministic on-device keyword parser | Built (see App Check note below) |
| **Saved**: favorites (Firestore), compare 2–4 RVs (`compare_rvs`), price-drop check (re-fetches each saved RV and compares it with the saved price) | Built |
| **Saved-search alerts**: save the current filters, "Check for New Matches Now" (tracks seen IDs in `lastCheckedUnitIds`), optional local notification | Built (no background checks, no push) |
| **Tow-fit** (`/tow-fit/[id]`) via `evaluate_tow_fit` (vehicle + optional door-sticker payload, same inputs as Kotlin) | Built |
| **Dealer inquiry** (`/inquiry/[id]`): `prepare_dealer_inquiry` → preview → explicit confirm → `send_dealer_inquiry` (optional dry run), stored in Firestore; **Inquiries** tab refreshes via `get_dealer_inquiry_status` | Built |
| **Welcome / sign-in gate** (`/sign-in`): required on first open. Google sign-in (all platforms) and Sign in with Apple (iOS) → Firebase Auth, persisted with AsyncStorage. Headline shows the live LIVE count from `search_rvs` | Built (needs a dev build, see below; Apple needs owner setup) |
| **Account**: signed-in profile and sign out (returns to the welcome screen) | Built |

## Authentication

**Sign-in is required.** On first open (and whenever nobody is signed in) the app shows the welcome / sign-in screen (`src/app/sign-in.tsx`, a port of `AuthScreen.kt`). The tabs and detail screens are behind an Expo Router `Stack.Protected` guard in `src/app/_layout.tsx`. While Firebase restores a saved session the native splash / a loading view stays up, so the tabs never flash. Signing in goes to the tabs. **Sign out** (Account tab) goes back to the welcome screen.

- **Google**: every platform (`expo-auth-session` → `GoogleAuthProvider` credential → `signInWithCredential`).
- **Apple**: iOS only, and only when `AppleAuthentication.isAvailableAsync()` is true (`expo-apple-authentication` → `OAuthProvider('apple.com')` credential using the identity token plus a raw nonce; Apple receives the SHA-256 of the nonce, made with `expo-crypto`). App Store guideline 4.8 requires it because Google sign-in is offered. The code is fully wired, but it won't work until the owner finishes the Apple setup below.
- **Headline**: "Swipe <N> Live Dealer RVs". N is the LIVE eligible-unit count (`inventoryQuality.eligibleUnits`) from the default `search_rvs` call the Discover store makes at launch. If the count is loading or unavailable, the headline reads "Swipe Live Dealer RVs". No count is ever hardcoded.

### Dev-only "Preview without sign-in (testing)"
The welcome screen shows this link **only** when `__DEV__` is true **or** Firebase isn't configured (`firebaseStatus().configured === false`). The rule is `canShowPreviewBypass()` in `src/lib/auth/gate.ts`, and it is unit-tested. A production build with Firebase configured never renders the link, and `AuthProvider.startPreview()` refuses to enter preview mode there. Preview mode lives in memory only and is gone after a restart. In preview mode:
- a "Preview mode — sign in" banner above the tabs returns you to the welcome screen;
- saving RVs, search alerts and dealer inquiries show "Sign-in required" (`requireSignIn`) instead of working.

### Expo Go
Google and Apple OAuth **won't complete in Expo Go** (Google rejects the Expo Go redirect URI, and Expo Go doesn't have this app's Sign in with Apple entitlement). In Expo Go, use the preview link (it shows because Expo Go runs in `__DEV__`), or make a development build to test real sign-in.

### Apple sign-in setup (owner)
1. **Apple Developer Program** membership. In Certificates, Identifiers & Profiles, turn on the **Sign in with Apple** capability for the App ID `com.matchrv.app`. `ios.usesAppleSignIn: true` in `app.config.ts` adds the entitlement, and EAS syncs capabilities when it builds.
2. **Firebase console → Authentication → Sign-in method → Apple**: enable it. For native iOS sign-in the bundle id is enough. If you also want Apple sign-in on web/Android later, create a **Services ID**, a **Sign in with Apple key** (Key ID + .p8 private key) and your **Team ID** in the Apple Developer portal, enter them in the Firebase Apple provider, and add Firebase's OAuth redirect URL (`https://<project>.firebaseapp.com/__/auth/handler`) to the Services ID.
3. Rebuild the iOS app (`npx eas-cli@latest build --profile development --platform ios`). Test on a real device or a simulator signed in to an Apple ID.

If Firebase isn't configured at all, the welcome screen shows a "Sign-in isn't configured" notice, and the preview link stays available so the build is still testable.

## Project layout

```
src/app/                 Expo Router routes (screens only)
  (tabs)/                Discover (index), Ask AI, Saved, Inquiries, Account
  rv/[id].tsx            RV detail          tow-fit/[id].tsx   Tow-fit check
  inquiry/[id].tsx       Dealer inquiry     compare.tsx        Compare saved RVs
src/lib/mcp/             MCP JSON-RPC client (port of MatchRvMcpClient.kt), arg builders, pure parsers
src/lib/models/          Typed models (RvModels.kt, FirestoreModels.kt)
src/lib/ai/              AskAiProvider, Firebase AI Logic provider, local fallback parser
src/lib/logic/           Pure business logic: price drop, alert new-match, deck paging, filter form
src/lib/firebase/        Firebase init, Firestore payload builders + repository
src/state/               React context stores (auth, discover deck, user data, toast)
src/components/          UI components (swipe deck, filter sheet, cards…)
```

## Setup

```bash
cd mobile
npm install
cp .env.example .env.local     # fill in values (never commit .env / .env.local)
npx expo start
```

### Environment variables

All values are read from the environment (`app.config.ts` + `src/lib/config.ts`). Leave a value empty to turn off the feature that uses it.

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_MCP_URL` | MCP endpoint (default `https://matchrv.com/mcp`) |
| `EXPO_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID` | Firebase **Web app** config. Without API key, project ID and app ID nobody can sign in (the welcome screen shows a notice and the preview link) |
| `EXPO_PUBLIC_FIRESTORE_DATABASE_ID` | Firestore database id. The Kotlin app uses a **named (non-default) database**; its id is in `../firebase.json` and `app/src/main/res/values/firebase_applet_config.xml`. Leave it empty and the `(default)` database is used, which will **not** contain existing user data |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `_IOS_CLIENT_ID`, `_ANDROID_CLIENT_ID` | Google OAuth client IDs for sign-in |
| `EXPO_PUBLIC_GEMINI_MODEL` | Model for Ask AI (defaults to the Kotlin app's `gemini-3.8-flash`) |
| `GOOGLE_SERVICES_JSON`, `GOOGLE_SERVICE_INFO_PLIST` | Optional paths to native Firebase files. They are only used if the file exists, and both file types are gitignored. The JS SDK doesn't need them |

`EXPO_PUBLIC_*` values are bundled into the app. They are client configuration, not secrets, but still keep them out of git. For EAS builds, set them as EAS environment variables.

## Running

### Expo Go (quickest, UI testing)
`npx expo start`, then scan the QR code. **Google/Apple sign-in won't complete in Expo Go**, so tap "Preview without sign-in (testing)" on the welcome screen to look at Discover, detail, Ask AI and tow-fit. Use a development build for real sign-in and account features.

### Development build (full features incl. Google / Apple sign-in)
```bash
npx expo run:android        # or: npx expo run:ios  (needs Android Studio / Xcode locally)
# or in the cloud:
npx eas-cli@latest build --profile development --platform android   # / ios
```
`ios/` and `android/` are generated (Continuous Native Generation) and gitignored. Configure native settings only in `app.config.ts`.

### Checks
```bash
npx tsc --noEmit
npx expo lint
npm test -- --watchAll=false
npx expo-doctor
npx expo export --platform android --platform ios --output-dir /tmp/expo-export3
```

## EAS build & submit

`eas.json` has three profiles:
- `development`: dev client, internal distribution
- `preview`: internal distribution, Android APK
- `production`: store builds, remote auto-incremented build numbers

```bash
npx eas-cli@latest login
npx eas-cli@latest init                       # links the project (writes extra.eas.projectId)
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --platform android  # Google Play
npx eas-cli@latest submit --platform ios      # App Store Connect / TestFlight
```

## What the owner must provide

Nothing below has been created. These are accounts and credentials only the owner can set up:

1. **Firebase project** (the same one the Kotlin app uses):
   - Add a **Web app** and copy its config into the `EXPO_PUBLIC_FIREBASE_*` variables.
   - Register an **Android app** (`com.matchrv.app`) and an **iOS app** (`com.matchrv.app`). Download `google-services.json` / `GoogleService-Info.plist` only if you later need native Firebase SDKs.
   - Enable **Google** and **Apple** as sign-in providers in Firebase Auth (Apple: see Authentication → Apple sign-in setup).
   - Enable **Firebase AI Logic** (Gemini Developer API) if you want Gemini-powered Ask AI.
2. **Google OAuth client IDs** (Google Cloud console → Credentials): a Web client (also used by Firebase), an iOS client (bundle id `com.matchrv.app`), and an Android client (package `com.matchrv.app` plus your signing-key SHA-1, including the EAS-managed key).
3. **Apple Developer Program** membership ($99/yr) for iOS builds and App Store/TestFlight.
4. **Google Play Console** account ($25 one-time) for Play Store distribution.
5. **Confirm the app id**: `com.matchrv.app` is used for both the iOS bundle identifier and the Android package, **pending owner confirmation**. It can't be changed after the first store release.

## Firestore

- **Security rules are unchanged.** `../firestore.rules` is used as-is. The app writes the same collections and document shapes as `MatchRvFirestoreRepository.kt`:
  `users/{uid}/saved_rvs`, `users/{uid}/saved_alerts`, `users/{uid}/inquiries`, `users/{uid}/analytics_events`.
  Integer fields that the rules check with `is int` (`sleeps`, `year`, `matchCount`, `newMatchCount`, `sleepsMin`) are rounded before writing. Optional fields are omitted rather than written as null.
- The **named database** id must be set in `EXPO_PUBLIC_FIRESTORE_DATABASE_ID` (see above).

## Known limitations / stubs

- **App Check & Ask AI**: the Kotlin app protects Firebase AI Logic with App Check (Play Integrity / reCAPTCHA). The Firebase JS SDK has **no native App Check attestation provider in React Native**. If App Check enforcement is on for the Gemini API, Gemini calls are rejected. The app then **falls back automatically to the on-device keyword parser** and shows a banner. To use Gemini on mobile you can turn off enforcement for AI Logic, use a debug token for testing, or later move to `@react-native-firebase` (native) App Check.
- **Alerts are on-demand**: there is no push server and no background task, as in the Kotlin app. Checks run when you tap "Check for New Matches Now" or "Check Drops". When something new is found, a **local** notification is posted. The app asks for notification permission only when you turn on "Notify me on this device".
- **Tow-fit parsing**: the live server returns `fits` / `payloadFits`, which the Kotlin parser doesn't read (it looks for `results` / `evaluations` / `units`). The TS client accepts both shapes and merges the payload details.
- **Compare** shows the server's `comparison.rows` spec table when present. Otherwise it falls back to the Kotlin per-unit fields.
- **Filter sliders** (radius, max length) are stepped chip rows, because React Native has no built-in slider.
- **Analytics events** are written to Firestore only for signed-in users, like the Kotlin app.
- **Icons**: the tab bar uses text glyphs (no icon font dependency). The app icon is the 256×256 MatchRV logo from the Kotlin app. Supply a 1024×1024 source before store submission.
- The UI is dark-only, matching the Kotlin brand theme.
