# Homlo Jobs

Homlo Jobs is a native-style Expo and React Native marketplace for discovering flexible work, applying to jobs, and managing employer listings. The project uses Expo Router, NativeWind, and a server-only Supabase service boundary.

## Expo Go SDK 54 setup

This repository is maintained as a managed Expo project and does not require `expo prebuild`, a custom development client, or committed `ios/` or `android/` folders.

```bash
npm install
npx expo start
```

After `npx expo start` starts, scan the displayed QR code with **Expo Go SDK 54**. For web preview, press `w` in the Expo CLI or use the local web URL it prints.

The project is pinned to Expo SDK 54 and its compatible Expo packages. Use the Expo installer for future Expo-adjacent dependency changes:

```bash
npx expo install <package-name>
```

Validate dependency alignment before committing changes:

```bash
npx expo-doctor
```

## Environment configuration

The mobile client does not contain Supabase service credentials and does not access Supabase tables directly. Server secrets are configured through the project’s secure environment settings. The repository includes `.env.example` only as a naming reference; never copy real credentials into a committed file.

The server-side Supabase service uses `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and, where configured, `SUPABASE_DB_URL`. `SUPABASE_ANON_KEY` is client-safe configuration metadata but is not required by the Expo client for the server-mediated API flows.

## Expo Go limitations

Push notifications through `expo-notifications` require a physical device and platform credentials. Remote push behavior is not available in Expo Go on Android for SDK 53 and later; test that behavior in a release or development build when push delivery is enabled. Local in-app notification behavior and the rest of the app remain available in Expo Go. No custom dev client is required for the current default app flows.

The interactive native map uses `react-native-maps`, which is available during Expo Go testing. Store deployment may require provider-specific map credentials and a rebuilt app binary; those credentials are not included in this repository.

## Project commands

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies from the lockfile-compatible manifest. |
| `npx expo start` | Start the managed Expo development server for Expo Go. |
| `npx expo-doctor` | Check Expo SDK compatibility and dependency health. |
| `npm run check` | Run TypeScript validation. |
| `npm test` | Run the automated regression suite. |
| `npm run lint` | Run Expo lint checks. |

## Security

Never commit `.env` files, Supabase service-role keys, database URLs, webhook secrets, or other credentials. The mobile app calls authenticated Homlo server procedures; administrative Supabase access remains on the server and in the deployed Supabase gateway.
