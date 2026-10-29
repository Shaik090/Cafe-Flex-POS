# Cafe Flex POS release readiness

## Production Android identity

- Display name: Cafe Flex POS
- Expo version / Android version name: `1.0.0`
- Android version code: `1`
- Production Android application ID: `com.cafeflex.pos`

`com.cafeflex.pos` is the permanent Android identity. Treat it as final before the first Play Store publication: changing it later creates a separate Play listing and cannot update installed copies.

## Local data and privacy inventory

Cafe Flex POS is local-first. The app stores business data in device-local AsyncStorage and app-private files:

- shop profile and settings
- sales, held orders, receipts, tax snapshots, and cost snapshots
- expenses, stock, purchases, suppliers, supplier payments, tables, kitchen tickets, and recipes
- staff names, roles, shifts, and salted PIN hashes (never plaintext PINs)
- printer names, Bluetooth identifiers, and receipt settings
- user-created JSON backups and receipt PDFs in app-private document/cache locations

The current code has no cloud synchronization, advertising SDK, analytics SDK, account service, or code path that sends this business data to an external server. There are no cloud accounts, so cloud account deletion is not applicable. This is an implementation inventory, not legal advice or a completed Play Console declaration.

## Android permissions

- `BLUETOOTH` and `BLUETOOTH_ADMIN` on Android 11 and lower: paired thermal-printer discovery and connection.
- `ACCESS_FINE_LOCATION` on Android 11 and lower: required by Android Bluetooth discovery permission rules used by the existing printer flow.
- `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT` on Android 12 and higher: paired Bluetooth thermal-printer selection, connection, and printing. `BLUETOOTH_SCAN` is marked `neverForLocation`.

The release manifest does not request contacts, microphone, camera, SMS, call logs, broad storage, system-alert-window, or Internet permissions. Core POS operations work without a network connection. Backup export/import, receipt PDF generation, system print/share, and Bluetooth printing use local platform APIs; physical Bluetooth output requires a paired compatible printer.

## Files and sharing

Backups use Expo DocumentPicker, FileSystem, and Sharing. Backups and receipt PDFs are written to app-private document or cache locations, then supplied to Android system share/print UI by content URI. No file operation depends on a package-specific external path.

## Release signing

- Production signing configuration: configured locally through the ignored `android/keystore.properties` file.
- Signed release APK: generated and signature-verified for `com.cafeflex.pos` version `1.0.0` (version code `1`).
- Signed release AAB: generated and signature-verified for `com.cafeflex.pos` version `1.0.0` (version code `1`).

The native release variant never falls back to the debug keystore. It can load real signing material from either:

- local-only `android/keystore.properties` (copy `android/keystore.properties.example` and keep the copy out of Git), or
- the release-machine environment / Gradle properties: `CAFE_FLEX_RELEASE_STORE_FILE`, `CAFE_FLEX_RELEASE_STORE_PASSWORD`, `CAFE_FLEX_RELEASE_KEY_ALIAS`, and `CAFE_FLEX_RELEASE_KEY_PASSWORD`.

Create one upload/release key on a secure release machine, replacing every placeholder and providing true business identity values interactively:

```powershell
keytool -genkeypair -v -keystore C:\secure\YOUR_RELEASE_KEY.jks -alias YOUR_KEY_ALIAS -keyalg RSA -keysize 2048 -validity 10000
```

Keep the keystore, alias, and passwords in secure backed-up storage. Do not commit them, paste them into source, or put them in `keystore.properties.example`.

A locally signed upload/release key is separate from **Google Play App Signing**. Play App Signing is not configured until the app is enrolled and a signed upload artifact is accepted by Google Play.

## Production branding

- Launcher icon: configured from `assets/branding/icon.png`.
- Adaptive icon: configured from `assets/branding/adaptive-icon.png` with solid `#FFF8E7` background.
- Splash: configured from `assets/branding/splash-icon.png` with centered contain scaling on `#FFF8E7`.
- Play Store listing icon source: `assets/branding/play-store-icon-512.png`.

The Play Store listing icon is retained as a listing asset and is not unnecessarily embedded as a runtime Android resource. The adaptive foreground is supplied with safe transparent padding for Android masks; do not replace it with a cropped or stretched wordmark.

## Toolchain observed

- Expo SDK 54 / React Native 0.81
- JDK 17 configured in `android/gradle.properties`
- Gradle 8.14.3
- min SDK 24, compile SDK 36, target SDK 36

No toolchain upgrade was made in release hardening.
