# EMI Reminder - iOS Build & Deployment Guide

This project is fully converted and configured as a native **iOS App (Capacitor + Xcode + Swift)**.

---

## What Has Been Configured

1. **Native iOS Project**:
   - Location: `ios/App/App.xcodeproj`
   - Bundle Identifier: `com.splendapps.todolist`
   - Display Name: `EMI Reminder`
   - Target: iOS 14.0+ (Universal iPhone & iPad)
2. **App Icons & Assets**:
   - 1024x1024 AppIcon configured in `ios/App/App/Assets.xcassets/AppIcon.appiconset`.
   - Dark theme status bar (`UIStatusBarStyleLightContent`) configured in `Info.plist`.
   - Full iPhone Notch & Dynamic Island safe area support (`viewport-fit=cover` & CSS safe-area insets).
3. **Sound & Notifications**:
   - Packaged `reminder_sound.wav` in the iOS app bundle (`ios/App/App/public/reminder_sound.wav`).
   - Integrated with iOS `UserNotifications` framework via `@capacitor/local-notifications`.
4. **Cloud Build CI/CD**:
   - Pre-configured GitHub Actions workflow in `.github/workflows/build-ios.yml` to compile the `.ipa` on macOS runners automatically.

---

## 3 Ways to Build & Run on iOS

### Option 1: Open in Xcode on any Mac (Recommended for Direct Install)
If you or a friend have a Mac:
1. Copy or extract `EMI_Reminder_iOS_Xcode_Project.zip` (available on your Desktop/Downloads) to the Mac.
2. In the project folder on the Mac, run:
   ```bash
   npx cap open ios
   ```
   *(or double-click `ios/App/App.xcodeproj` directly)*
3. Connect your iPhone via USB, select your device in the top bar, and press **Cmd + R (Play)**.
4. To export for friends: Choose **Product > Archive > Distribute App (Ad-Hoc / TestFlight)**.

---

### Option 2: Free Automated Cloud Build via GitHub (No Mac Needed!)
You can build the iOS `.ipa` directly in the cloud without owning a Mac:
1. Create a repository on [GitHub](https://github.com) and push this folder.
2. Go to the **Actions** tab in your GitHub repository.
3. The workflow **"Build iOS App"** (`.github/workflows/build-ios.yml`) will run on a free GitHub macOS runner with Xcode and output a ready `EMI_Reminder.ipa` file under Artifacts!

---

### Option 3: Instant iPhone PWA (Run on iPhone Right Now)
You can also run the app full-screen on any iPhone immediately without needing an Apple Developer account:
1. Connect your iPhone to the same Wi-Fi network as this PC.
2. Open Safari on your iPhone and visit:
   ```
   http://<YOUR_PC_IP>:3000
   ```
3. Tap the **Share** button (box with upward arrow) at the bottom of Safari.
4. Tap **"Add to Home Screen"**.
5. The **EMI Reminder** icon appears on the iPhone home screen and launches full-screen with offline caching, high-performance animations, and reminder chimes!
