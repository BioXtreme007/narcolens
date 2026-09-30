# Expo SDK 57 cheat sheet (Android focus)

Sources: docs.expo.dev/versions/v57.0.0/sdk/*.md plus installed `node_modules/*/build/*.d.ts` (ground truth where docs were thin).
Always install with `npx expo install <pkg>`. Verify with `npx tsc --noEmit`.
Project facts: src/app routing, `@/*` -> `src/*`, `@/assets/*` -> `assets/*`, `experiments.typedRoutes` and `reactCompiler` are ON, react-native-worklets 0.10.1 installed.

## 1. expo-camera
```tsx
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';

const ref = useRef<CameraView>(null);
const [ready, setReady] = useState(false);
const [perm, requestPerm] = useCameraPermissions();
if (!perm) return null;                       // still loading
if (!perm.granted) return <Button title="Allow camera" onPress={requestPerm} />;

<CameraView ref={ref} style={{ flex: 1 }} facing="back" mode="picture"
  flash="off"            // 'off'|'on'|'auto'|'screen' (fires at capture)
  enableTorch={false}    // continuous light
  autofocus="on"         // FocusMode 'on'|'off'
  ratio="4:3"            // Android only ('4:3'|'16:9'|'1:1')
  animateShutter={false}
  onCameraReady={() => setReady(true)} />

const photo = await ref.current?.takePictureAsync({
  quality: 0.7, base64: false, exif: false, skipProcessing: false, shutterSound: false,
});
// photo: { uri, width, height, base64?, exif? }  -> photo.uri = file:///...cache/Camera/xxx.jpg
```
Gotchas
- Wait for `onCameraReady` before `takePictureAsync` (fails otherwise). Do not call while preview is paused (throws on Android).
- `skipProcessing: true` discards `quality` and can return wrongly rotated images (Samsung/Sony). Leave false.
- Only one CameraView preview live at a time: unmount on blur (`useIsFocused`).
- No exposure/focus-lock API on Android. Docs mark `autofocus` iOS-only (type comment: 'on' = focus once then lock). Do not rely on it.
- Other takePictureAsync options: `additionalExif`, `onPictureSaved` (promise then resolves with no data), `pictureRef`. `imageType` is web only.

## 2. expo-image-picker
```ts
import * as ImagePicker from 'expo-image-picker';
const res = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ['images'],        // MediaType = 'images' | 'videos' | 'livePhotos'
  allowsEditing: false, allowsMultipleSelection: false,
  quality: 0.8, base64: false, exif: false,
});
if (!res.canceled) { const a = res.assets[0]; /* a.uri a.width a.height a.fileName a.fileSize a.mimeType a.base64? a.exif? */ }
```
- `ImagePicker.MediaTypeOptions.*` is DEPRECATED. Use string array.
- Canceled: `{ canceled: true, assets: null }`.
- `allowsEditing` is incompatible with `allowsMultipleSelection`.
- Camera capture: `launchCameraAsync` needs `requestCameraPermissionsAsync()`. Library picking on Android 13+ uses the system photo picker (verify on device).

## 3. expo-image-manipulator (new API is current; `manipulateAsync` is @deprecated but still exported)
```ts
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
export async function toJpegB64(uri: string) {
  const ctx = ImageManipulator.manipulate(uri);           // file:// uri
  ctx.resize({ width: 480 });                             // height auto, aspect kept
  const ref = await ctx.renderAsync();                    // ImageRef {width,height,saveAsync}
  return ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  // -> { uri, width, height, base64 }   (base64 has NO data: prefix)
}
```
- Chain: `.resize() .rotate(deg) .flip('horizontal'|'vertical') .crop({originX,originY,width,height}) .extent() .reset()`.
- `useImageManipulator(uri)` is a hook (components only); outside components use `ImageManipulator.manipulate`.
- Formats: JPEG, PNG, WEBP.
- Legacy: `manipulateAsync(uri, [{ resize: { width: 480 } }], { format: SaveFormat.JPEG, base64: true, compress: 0.8 })`.

## 4. expo-file-system (object API is the default export; legacy under /legacy)
```ts
import { File, Directory, Paths } from 'expo-file-system';
// Paths.document (persistent), Paths.cache (evictable), Paths.bundle

const src = new File(photo.uri);
const b64 = await src.base64();               // or src.base64Sync()
const bytes = await src.bytes();              // Uint8Array (bytesSync)
const text = await src.text();                // textSync

const dir = new Directory(Paths.document, 'scans');
if (!dir.exists) dir.create({ intermediates: true });     // sync
const dest = new File(dir, `${Date.now()}.jpg`);
src.copy(dest);                               // copySync / move / moveSync; opts {overwrite:true}
// write
const f = new File(Paths.document, 'a.txt'); f.create({ overwrite: true });
f.write('text'); f.write(uint8); f.write(b64, { encoding: 'base64' });   // { append: true } ok
f.uri; f.size; f.exists; f.delete();
await File.downloadFileAsync(url, new Directory(Paths.cache));
```
- Legacy: `import * as FS from 'expo-file-system/legacy'` (readAsStringAsync, EncodingType.Base64, documentDirectory...). Calling legacy functions via bare `'expo-file-system'` throws at runtime.
- File/Directory can point at nonexistent paths; using the wrong class on an existing path errors.
- `write(b64, {encoding:'base64'})` is how to save decoded bytes (e.g. server TTS audio) before playing.

## 5. expo-sqlite
```ts
import * as SQLite from 'expo-sqlite';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';

const db = await SQLite.openDatabaseAsync('narcolens.db');    // or openDatabaseSync
await db.execAsync(`PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS scans (id INTEGER PRIMARY KEY, sha TEXT, created INTEGER);`);
const r = await db.runAsync('INSERT INTO scans (sha, created) VALUES (?, ?)', sha, Date.now());
r.lastInsertRowId; r.changes;
const row  = await db.getFirstAsync<{ id: number }>('SELECT * FROM scans WHERE id = ?', 1);
const rows = await db.getAllAsync<{ id: number }>('SELECT * FROM scans');
for await (const x of db.getEachAsync('SELECT * FROM scans')) { /* stream */ }
const st = await db.prepareAsync('INSERT INTO scans (sha) VALUES ($sha)');
try { await st.executeAsync({ $sha: 'abc' }); } finally { await st.finalizeAsync(); }
await db.withTransactionAsync(async () => { /* ... */ });
await db.withExclusiveTransactionAsync(async (txn) => { await txn.execAsync('...'); });
```
Provider (root layout):
```tsx
<SQLiteProvider databaseName="narcolens.db" onInit={migrate}><Slot /></SQLiteProvider>
// child: const db = useSQLiteContext();
async function migrate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((row?.user_version ?? 0) < 1) await db.execAsync('CREATE TABLE ...; PRAGMA user_version = 1');
}
```
- Never interpolate user input into `execAsync`. Use `runAsync` params (`?` or `$name`).
- Always `finalizeAsync`. Queries outside `withTransactionAsync` may interleave with it; use the exclusive variant for isolation.
- `expo-sqlite` plugin already in app.json.

## 6. expo-crypto
```ts
import * as Crypto from 'expo-crypto';
const hex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, 'text');      // hex default
const b64 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, 'text',
  { encoding: Crypto.CryptoEncoding.BASE64 });
const id = Crypto.randomUUID();               // v4, sync
const bytes = Crypto.getRandomBytes(16);      // sync (getRandomBytesAsync too)
```
Also: `Crypto.digest(alg, BufferSource)`, AES-GCM (`aesEncryptAsync`, `AESEncryptionKey`).

## 7. expo-location
```ts
import * as Location from 'expo-location';
const { status } = await Location.requestForegroundPermissionsAsync();
if (status !== 'granted') return;
const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
pos.coords.latitude; pos.coords.longitude; pos.coords.accuracy;
const [addr] = await Location.reverseGeocodeAsync(pos.coords);   // needs {latitude, longitude}
addr?.city; addr?.region; addr?.postalCode; addr?.country; addr?.district; addr?.formattedAddress; // formattedAddress Android only
```
- `Accuracy`: Lowest=1, Low=2, Balanced=3 (default), High=4, Highest=5, BestForNavigation=6.
- `mayShowUserSettingsDialog` (Android, default true) may pop a system "improve accuracy" dialog.
- `getLastKnownPositionAsync()` is a fast fallback. Android reverse geocode needs permission first and can return `[]` offline. Wrap position calls in a timeout (emulator without mock location can hang).

## 8. expo-audio (expo-av replacement)
```ts
import { useAudioRecorder, RecordingPresets, setAudioModeAsync, requestRecordingPermissionsAsync,
  useAudioPlayer, createAudioPlayer, IOSOutputFormat, AudioQuality } from 'expo-audio';

const { granted } = await requestRecordingPermissionsAsync();   // also AudioModule.requestRecordingPermissionsAsync
await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
const rec = useAudioRecorder(RecordingPresets.HIGH_QUALITY);    // hook: component only
await rec.prepareToRecordAsync();
rec.record();                                                   // record({ forDuration: sec }) also
await rec.stop();
const uri = rec.uri;                                            // file:///...cache/Audio/xxx.m4a ; read AFTER stop
await setAudioModeAsync({ allowsRecording: false });            // before playback (iOS)
```
Custom options (speech-to-text friendly, 16 kHz mono):
```ts
const STT_OPTS = {
  extension: '.m4a', sampleRate: 16000, numberOfChannels: 1, bitRate: 64000,
  android: { extension: '.m4a', outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: { outputFormat: IOSOutputFormat.LINEARPCM, audioQuality: AudioQuality.HIGH,
         linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
};
```
- HIGH_QUALITY = .m4a (MPEG4/AAC, 44.1 kHz, stereo, 128 kbps). LOW_QUALITY = .3gp/AMR on Android.
- Android `outputFormat`: `default|3gp|mpeg4|amrnb|amrwb|aac_adts|mpeg2ts|webm`; `audioEncoder`: `default|amr_nb|amr_wb|aac|he_aac|aac_eld`.
- **Android cannot record WAV** (MediaRecorder has no WAV). Send m4a/aac (server must decode via ffmpeg) or amrwb. Only iOS can produce linear PCM WAV. Server-side convert to 16 kHz WAV.
- Default directory is cache; `{ ...preset, directory: 'document' }` persists.
- app.json plugin: `["expo-audio", { "microphonePermission": "...", "recordAudioAndroid": true }]` (bare "expo-audio" currently listed).
- Playback: `useAudioPlayer(source)` / `createAudioPlayer(source)` (call `p.remove()` when done). Source: `require()`, `'https://..'`, `{ uri }`, or `data:audio/mpeg;base64,...` (per docs). `p.play() p.pause() p.seekTo(s) p.replace(src) p.volume p.loop`. `useAudioPlayerStatus(p)` for state. For large base64 write a cache File and pass its uri (safer).

## 9. expo-speech
```ts
import * as Speech from 'expo-speech';
Speech.speak('नमस्ते', { language: 'hi-IN', rate: 0.95, pitch: 1.0, onDone() {}, onError(e) {} });
Speech.stop(); await Speech.isSpeakingAsync(); const v = await Speech.getAvailableVoicesAsync();
```
- Uses device TTS engine; Hindi voice data may be absent (check `getAvailableVoicesAsync`, pass `voice` id). `pause/resume` iOS/web only. iOS silent switch mutes it.

## 10. expo-router (src/app)
Template (read from repo): `src/app/_layout.tsx` = `ThemeProvider` (from `expo-router`) + `<AnimatedSplashOverlay/>` + `<AppTabs/>`, calls `SplashScreen.preventAutoHideAsync()` at module scope. Routes: `index.tsx`, `explore.tsx`.
`src/components/app-tabs.tsx`:
```tsx
import { NativeTabs } from 'expo-router/unstable-native-tabs';
<NativeTabs backgroundColor={c.background} indicatorColor={c.backgroundElement}
  labelStyle={{ selected: { color: c.text } }}>
  <NativeTabs.Trigger name="index">              {/* name = route file name */}
    <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
    <NativeTabs.Trigger.Icon src={require('@/assets/images/tabIcons/home.png')} renderingMode="template" />
  </NativeTabs.Trigger>
</NativeTabs>
```
- NativeTabs is `unstable-` (API may change). Native Material bottom bar on Android; icons via PNG `src`; no `tabBar` prop. `app-tabs.web.tsx` is the web variant.
- SDK 56+: do NOT import `@react-navigation/*` in app code. Import from `expo-router` (`Stack, Tabs, Slot, Link, router, useRouter, useLocalSearchParams, useIsFocused?, useFocusEffect, ThemeProvider, DarkTheme, DefaultTheme`). Verify `useIsFocused` export in expo-router before use; `useFocusEffect` is safe.

Root Stack with modal + hidden header:
```tsx
<Stack screenOptions={{ headerShown: false }}>
  <Stack.Screen name="(tabs)" />
  <Stack.Screen name="result" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
  <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
</Stack>
```
JS Tabs with custom bar (move screens into `src/app/(tabs)/`):
```tsx
import { Tabs } from 'expo-router';
<Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <MyTabBar {...props} />}>
  <Tabs.Screen name="index" options={{ title: 'Home' }} />
</Tabs>
// props: { state, descriptors, navigation }; navigation.navigate(route.name); state.index = focused index
```
Navigation: `router.push('/result')`, `router.push({ pathname: '/result/[id]', params: { id } })`, `router.replace('/(tabs)')`, `router.back()`, `router.dismissAll()`. Params: `useLocalSearchParams<{ id: string }>()` (all strings; pass ids, load data from SQLite).
Typed routes: types generated to `.expo/types/router.d.ts` when `expo start` runs; new files unknown until regenerated (use `as Href` from `expo-router` temporarily). Use `router.replace` for one-way flows (onboarding -> app).

## 11. react-native-reanimated 4.5 + worklets
```tsx
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, withRepeat, withSequence,
  Easing, FadeIn, FadeOut, SlideInDown, Keyframe, LinearTransition } from 'react-native-reanimated';
const s = useSharedValue(0);
const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: s.value }));
s.value = withSpring(1, { damping: 15 });   // or withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) })
<Animated.View style={st} entering={FadeIn.duration(300)} exiting={FadeOut} layout={LinearTransition} />
<Animated.View entering={SlideInDown.springify().damping(18)} />
const kf = new Keyframe({ 0: { opacity: 0, transform: [{ scale: 0.8 }] }, 100: { opacity: 1, transform: [{ scale: 1 }] } }).duration(400);
<Animated.View entering={kf} />
```
- v4 = New Architecture only. Worklet runtime moved to `react-native-worklets` (already installed; keep versions via `npx expo install`).
- Babel: docs say `babel-preset-expo` auto-configures the plugin. Do NOT add `react-native-reanimated/plugin` manually; no babel.config.js exists or is needed.
- Threading helpers (`runOnJS`, `runOnUI`) come from `react-native-worklets` in v4 (`scheduleOnRN`/`scheduleOnUI` are newer names; see unverified).
- Included in Expo Go. React Compiler is on: mutate `sv.value` only in handlers/effects, not during render.

## 12. Splash + icons
```ts
import * as SplashScreen from 'expo-splash-screen';
SplashScreen.preventAutoHideAsync();          // module scope of root layout
await SplashScreen.hideAsync();               // when ready (or sync SplashScreen.hide())
SplashScreen.setOptions({ duration: 300, fade: true });
```
app.json plugin (already present): `["expo-splash-screen", { "backgroundColor": "#208AEF", "image": "./assets/images/splash-icon.png", "imageWidth": 76 }]` (optional `dark: {...}`).
- Expo Go and dev builds cannot replicate the real splash (Android 12 API); test on a release build.
- **Icons must be PNG** (icon.png 1024x1024; adaptive foreground/background/monochrome PNG 1024x1024, keep art in the centre ~66% safe zone). SVG is not accepted by `icon`/`adaptiveIcon`. Convert: `npx sharp-cli -i icon.svg -o icon.png resize 1024 1024`, or Node `sharp(svgBuffer).resize(1024,1024).png().toFile(...)`, or `rsvg-convert -w 1024`. Icon changes need a rebuild (not shown in Expo Go). NativeTabs icons: PNGs @1x/@2x/@3x.

## 13. Font / Haptics / Sharing
```ts
import { useFonts } from 'expo-font';
const [loaded, err] = useFonts({ Inter: require('@/assets/fonts/Inter.ttf') });   // hide splash when loaded || err
// build-time embedding (preferred prod, dev build): plugins: [["expo-font", { "fonts": ["./assets/fonts/Inter.ttf"] }]]
import * as Haptics from 'expo-haptics';
await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);                    // Light|Medium|Heavy|Rigid|Soft
await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);       // Warning|Error
await Haptics.selectionAsync();  // Android extra: Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
import * as Sharing from 'expo-sharing';
if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'Share' });
```
- Style `fontFamily` must equal the key in `useFonts`.
- `shareAsync` takes a local `file://` URI (not plain text or remote URL): write to cache first. Incoming shares (`useIncomingShare`) are config-plugin driven (dev build).

## 14. Expo Go (Android) vs dev build
Docs rule: need a dev build if a library has config-plugin requirements or native code not bundled in Expo Go.
Docs pages list Expo Go among supported platforms for: expo-crypto, expo-location (foreground), expo-speech, expo-sharing (outgoing), expo-font (runtime), expo-haptics (inferred), reanimated, router, expo-audio(inferred), camera/image-picker/manipulator/file-system/sqlite (core, inferred).
Dev build needed for: background location, real splash/app icon, embedded fonts via plugin, incoming share, custom plugin permission strings, cleartext http config. NativeTabs may behave differently in Expo Go (unverified).
The Play Store Expo Go must be a build supporting SDK 57.

## 15. Env vars
```
# .env (project root; restart with `npx expo start -c` after edits)
EXPO_PUBLIC_API_URL=https://api.example.com
```
```ts
const url = process.env.EXPO_PUBLIC_API_URL;   // static dot access ONLY
```
- `process.env['X']` and destructuring are NOT inlined -> undefined.
- Values are baked into the bundle in plain text: no secrets. Files: `.env`, `.env.local`, `.env.development`, `.env.production`. `EXPO_NO_DOTENV=1` disables loading. Non-`EXPO_PUBLIC_` vars are not exposed to app code.
- Android emulator reaches the host at `http://10.0.2.2:PORT`; a physical device needs the LAN IP.

## Could not verify
- Any dedicated "Expo Go SDK 57 supported modules" page (none found); section 14 is partly inferred.
- expo-audio / expo-camera Expo Go caveats on SDK 57.
- Android 13+ photo picker permission behaviour for image-picker.
- `useIsFocused` export from expo-router; `Crypto.CryptoEncoding` enum names; `SQLiteProvider` `useSuspense` prop.
- Reanimated/worklets renamed helpers (`scheduleOnRN`) and Keyframe typing (not fetched).
- `File.copy` overwrite semantics; `ImageManipulatorContext` cleanup method.
- SVG-to-PNG CLI command syntax (from memory).
- Hindi TTS voice availability on target device.
