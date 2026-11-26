# Building HireNow (plain React Native, no Expo)

The app is a standard React Native 0.86 project. `android/` and `ios/` are real
source folders now (committed to git), not generated.

## Day-to-day development

Run these from `homlo-job-marketplace-main/`.

1. Start the API server and the JS bundler (Metro) together:

   ```bash
   pnpm dev
   ```

2. In another terminal, install and open the app:

   ```bash
   pnpm ios        # iPhone Simulator
   pnpm android    # Android emulator or a USB-connected phone
   ```

The first iOS build takes a few minutes. After that, saving a `.tsx` file
reloads the app instantly.

### Settings the app reads (`.env`)

Only variables that start with `PUBLIC_` reach the app (for example
`PUBLIC_API_BASE_URL`, `PUBLIC_RC_ANDROID_KEY`, `PUBLIC_RC_IOS_KEY`). Everything
else in `.env`, such as `SUPABASE_SERVICE_ROLE_KEY`, stays on the server and is
never put into the app. After you change a `PUBLIC_` value, stop and restart
`pnpm dev`.

### After adding a screen, font or native library

- **New or renamed screen in `app/`:** run `node scripts/gen-routes.mjs`.
- **New font in `assets/fonts`:** run `npx react-native-asset`.
- **New native library:** run `cd ios && pod install`, then rebuild with
  `pnpm ios` and `pnpm android`.

## One-time Android setup on this Mac

1. Install Java 17 and Android Studio (Homebrew):

   ```bash
   brew install --cask zulu@17 android-studio
   ```

2. Open **Android Studio** once and click through the setup wizard ("Standard"
   install). It downloads the Android SDK into `~/Library/Android/sdk`.
3. In Android Studio go to **Settings → Languages & Frameworks → Android SDK →
   SDK Tools** and tick **NDK (Side by side)** and **Android SDK Command-line
   Tools**. Click Apply.
4. Tell your terminal where they are. Add these lines to `~/.zshrc`, then open a
   new terminal window:

   ```bash
   export JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools
   ```

5. Make an emulator: Android Studio → **Device Manager → Create device** (any
   recent Pixel). Then `pnpm android` installs the app on it.

## Signed release build for Google Play

### 1. Create your upload key (once, keep it forever)

Run this yourself and choose your own passwords. Nobody else should see them.

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore ~/hirenow-upload.keystore -alias hirenow-upload -keyalg RSA -keysize 2048 -validity 10000
```

Back up `~/hirenow-upload.keystore` and the passwords somewhere safe, such as a
password manager. If you lose them you have to ask Google to reset the upload
key.

### 2. Tell Gradle where the key is

Open (or create) `~/.gradle/gradle.properties`, which is in your home folder and
not in the project, and add:

```properties
HIRENOW_UPLOAD_STORE_FILE=/Users/YOUR_MAC_USERNAME/hirenow-upload.keystore
HIRENOW_UPLOAD_KEY_ALIAS=hirenow-upload
HIRENOW_UPLOAD_STORE_PASSWORD=the store password you chose
HIRENOW_UPLOAD_KEY_PASSWORD=the key password you chose
```

`android/app/build.gradle` reads these values. Without them, release builds are
signed with the debug key, and Google Play rejects those.

### 3. Build the bundle

First make sure `.env` has the production values: `PUBLIC_API_BASE_URL`
pointing at your online server (https), the Supabase `PUBLIC_` values, and the
live `PUBLIC_RC_ANDROID_KEY` (`goog_…`). Then run:

```bash
node scripts/check-release.mjs
```

```bash
cd android && ./gradlew bundleRelease
```

The file to upload is `android/app/build/outputs/bundle/release/app-release.aab`.
Before each new upload, raise `versionCode` (and `versionName` if you want) in
`android/app/build.gradle`.
