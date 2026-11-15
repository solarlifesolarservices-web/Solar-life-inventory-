# Solar Life Inventory — Android Debug APK Build & Installation Guide

This project is configured with **Capacitor**, **@capacitor-community/sqlite** (local offline SQLite database), **@capacitor-mlkit/barcode-scanning** (native camera barcode/QR scanner), and **@capacitor/app** (Android hardware back-button support).

## 1. Prerequisites on Your Computer

1. **Node.js 18+** and **npm**
2. **Android Studio** (Ladybug or newer) with:
   - Android SDK Platform 34 / 35
   - Android SDK Build-Tools
   - Java JDK 17 or JDK 21 (bundled with Android Studio)
3. **Android Phone** (Android 8.0+ recommended) with **USB Debugging** enabled:
   - Open **Settings → About phone** and tap **Build number** 7 times to enable Developer options.
   - Open **Settings → System → Developer options** and enable **USB debugging**.

## 2. Sync Latest Web Code to Android

Whenever you pull or modify the React/TypeScript source code, run:

```bash
npm install
npm run build
npx cap sync android
```

## 3. Build the Debug APK in Android Studio

1. Open Android Studio and click **Open** (or run `npx cap open android` from the project root).
2. Select the `android/` folder inside this project.
3. Wait for **Gradle Sync** to finish downloading Android dependencies (first sync takes a few minutes and requires internet once on your PC).
4. In the top menu, click:
   **Build → Build Bundle(s) / APK(s) → Build APK(s)**
5. When Gradle finishes, click **locate** in the bottom-right notification popup, or browse to:
   `android/app/build/outputs/apk/debug/app-debug.apk`

## 4. Install the APK on Your Android Phone

### Option A: Direct Install via USB Cable (Fastest)
1. Connect your Android phone to your computer with a USB data cable.
2. Accept the **"Allow USB debugging"** prompt on your phone screen.
3. In Android Studio, select your phone in the device dropdown at the top and click the green **Run (▶)** button.

### Option B: Copy & Install `app-debug.apk` Manually
1. Copy `android/app/build/outputs/apk/debug/app-debug.apk` to your Android phone's **Downloads** folder (via USB, Google Drive, or WhatsApp).
2. Open the **Files** app on your phone and tap `app-debug.apk`.
3. If prompted, tap **Settings → Allow from this source**, then tap **Install**.
4. Open **Solar Life Inventory**.

## 5. Offline Data Safety Reminder

- All inventory, serial numbers, customer issues, and transaction history are stored locally in the phone's SQLite database (`solar_life_inventory.db`).
- **Uninstalling the app or tapping "Clear storage / Clear data" in Android Settings permanently deletes local records.**
- Always export a `.json` backup from **Backup and Restore** regularly and store a copy outside the phone.
