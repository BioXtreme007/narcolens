import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Btn, Field, FlowBar } from '@/components/Chrome';
import { ScrollView } from '@/components/Scroll';
import { DocumentFlow } from '@/components/DocumentFlow';
import { L } from '@/lib/i18n';
import { EdgeBlur } from '@/components/EdgeBlur';
import { Icon } from '@/components/Icon';
import { C, R } from '@/constants/brand';
import { API_URL } from '@/config';
import { subscribeCase, takeQueuedCase, type CasePatch } from '@/lib/case';
import type { DocField } from '@/lib/ocr';
import { DEFAULT_PLACE, useApp } from '@/lib/store';
import {
  DEFAULT_MARKERS,
  PRESETS,
  REAGENTS,
  SAMPLES,
  detectMarkers,
  readPlate,
  readSample,
  type Marker,
  type PlateRead,
} from '@/ml/engine';
import jpeg from 'jpeg-js';

type Step = 'case' | 'setup' | 'photo' | 'analyzing';
type Sheet = null | 'place' | 'fir' | 'kit' | 'reagent' | 'tips' | 'discard';

type Kept = {
  name: string;
  age: string;
  gender: string;
  fir: string;
  item: string;
  place: string;
  coords: { lat?: number; lng?: number; acc?: number };
  witness: string;
  batch: string;
  expiry: string;
  wells: string[];
};
let kept: Kept | null = null;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function mmss(s: number) {
  const n = Math.max(0, s);
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}
function bytesFromBase64(b64: string): Uint8Array {
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function decodePlate(uri: string) {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 640 });
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.82, base64: true });
  const decoded = jpeg.decode(bytesFromBase64(saved.base64 ?? ''), { useTArray: true, formatAsRGBA: true });
  return { rgba: decoded.data as Uint8Array, width: decoded.width as number, height: decoded.height as number, uri: saved.uri, b64: saved.base64 ?? '' };
}

function WellMarker({
  marker,
  label,
  rFrac,
  stage,
  onChange,
}: {
  marker: Marker;
  label: string;
  rFrac: number;
  stage: { w: number; h: number };
  onChange: (m: Marker) => void;
}) {
  const pos = useRef(marker);
  const grant = useRef(marker);
  const stageRef = useRef(stage);
  const onChangeRef = useRef(onChange);
  pos.current = marker;
  stageRef.current = stage;
  onChangeRef.current = onChange;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        grant.current = { ...pos.current };
      },
      onPanResponderMove: (_, g) => {
        const st = stageRef.current;
        if (!st.w || !st.h) return;
        onChangeRef.current({
          x: Math.min(1, Math.max(0, grant.current.x + g.dx / st.w)),
          y: Math.min(1, Math.max(0, grant.current.y + g.dy / st.h)),
        });
      },
    }),
  ).current;
  const d = Math.max(28, 2 * rFrac * stage.w);
  if (!stage.w) return null;
  return (
    <View
      {...pan.panHandlers}
      style={[styles.marker, { width: d, height: d, left: marker.x * stage.w - d / 2, top: marker.y * stage.h - d / 2 }]}>
      <Text style={styles.markerLbl}>{label}</Text>
    </View>
  );
}

export default function Scan() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ preset?: string; retest?: string }>();
  const { saveRecord, session } = useApp();
  const c = L(session.lang);
  const cam = useRef<CameraView>(null);
  const [perm, requestPerm] = useCameraPermissions();
  const preset = typeof params.preset === 'string' ? params.preset : '';
  const retest = params.retest === '1' && kept;
  const [step, setStep] = useState<Step>(retest ? 'photo' : 'case');
  const [name, setName] = useState(retest ? kept!.name : '');
  const [age, setAge] = useState(retest ? kept!.age : '');
  const [gender, setGender] = useState(retest ? kept!.gender : 'Male');
  const [fir, setFir] = useState(retest ? kept!.fir : '');
  const [item, setItem] = useState(retest ? kept!.item : 'Powder');
  const [place, setPlace] = useState(retest ? kept!.place : DEFAULT_PLACE.place);
  const [coords, setCoords] = useState<{ lat?: number; lng?: number; acc?: number }>(retest ? kept!.coords : {});
  const [witness, setWitness] = useState(retest ? kept!.witness : '');
  const [batch, setBatch] = useState(retest ? kept!.batch : '');
  const [expiry, setExpiry] = useState(retest ? kept!.expiry : '');
  const [wells, setWells] = useState<string[]>(retest ? [...kept!.wells] : [...(PRESETS.find((p) => p.id === preset)?.wells ?? PRESETS[0].wells)]);
  const [openAcc, setOpenAcc] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [plateOk, setPlateOk] = useState(false);
  const [markers, setMarkers] = useState<Marker[]>(DEFAULT_MARKERS);
  const [rFrac, setRFrac] = useState(0.085);
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [sheet, setSheet] = useState<Sheet>(null);
  const [reagentAt, setReagentAt] = useState(0);
  const [placeDraft, setPlaceDraft] = useState(place);
  const [gpsNote, setGpsNote] = useState('');
  const [headH, setHeadH] = useState(108);
  const [edge, setEdge] = useState(0);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const [phase, setPhase] = useState(-1);
  const [error, setError] = useState('');
  const [camOn, setCamOn] = useState(false);
  const [camReady, setCamReady] = useState(false);
  const [left, setLeft] = useState<Record<number, number>>({});
  const beam = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  function applyCase(patch: CasePatch) {
    if (patch.name) setName(patch.name);
    if (patch.age) setAge(patch.age);
    if (patch.gender) setGender(patch.gender);
    if (patch.fir) setFir(patch.fir);
    if (patch.batch) setBatch(patch.batch);
    if (patch.expiry) setExpiry(patch.expiry);
  }

  useEffect(() => {
    setEdge(0);
    scroller.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  useEffect(() => {
    const queued = takeQueuedCase();
    if (queued) applyCase(queued);
    return subscribeCase(applyCase);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setLeft((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (next[+key] > 0) {
            next[+key] -= 1;
            changed = true;
            if (next[+key] === 0) {
              const line = session.lang === 'hi' ? `वेल ${+key + 1} का समय पूरा। रंग देखें।` : `Well ${+key + 1}, time is up. Read the colour.`;
              Speech.speak(line, { language: session.lang === 'hi' ? 'hi-IN' : 'en-IN' });
            }
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [session.lang]);

  useEffect(() => {
    if (step !== 'analyzing') return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(beam, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(beam, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    const spinner = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    spinner.start();
    return () => {
      loop.stop();
      spinner.stop();
    };
  }, [beam, spin, step]);

  const stepNo = step === 'setup' ? 2 : step === 'photo' || step === 'analyzing' ? 3 : 1;

  function back() {
    if (step === 'case') setSheet('discard');
    else if (step === 'setup') setStep('case');
    else if (step === 'photo') setStep('setup');
  }

  async function locate() {
    setGpsNote(c.gpsGetting);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setGpsNote(c.gpsDenied);
      return;
    }
    try {
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
      ]);
      const acc = Math.round(pos.coords.accuracy ?? 0);
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc });
      const [addr] = await Location.reverseGeocodeAsync(pos.coords);
      if (addr) {
        const named = [addr.name, addr.district, addr.city, addr.region].filter(Boolean).join(', ');
        if (named) {
          setPlace(named);
          setPlaceDraft(named);
        }
      }
      setGpsNote(c.gpsSaved(acc));
      setSheet(null);
    } catch {
      setGpsNote(c.gpsTimeout);
    }
  }

  async function useUri(uri: string) {
    setError('');
    setSampleId(null);
    try {
      const plate = await decodePlate(uri);
      const found = detectMarkers(plate.rgba, plate.width, plate.height);
      setPhoto(plate.uri);
      setPlateOk(false);
      setMarkers(found?.markers ?? DEFAULT_MARKERS);
      setRFrac(found?.rFrac ?? 0.085);
      setCamOn(false);
    } catch {
      setError(c.photoFail);
    }
  }

  async function gallery() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled && res.assets[0]) await useUri(res.assets[0].uri);
  }

  async function shoot() {
    if (!cam.current || !camReady) {
      setError(c.camWait);
      return;
    }
    const shot = await cam.current.takePictureAsync({ quality: 0.7, shutterSound: false });
    if (shot?.uri) await useUri(shot.uri);
  }

  function retake() {
    setPhoto(null);
    setPlateOk(false);
    setSampleId(null);
    setError('');
    setCamReady(false);
    setCamOn(true);
  }

  function pickSample(id: string) {
    const s = SAMPLES.find((x) => x.id === id);
    if (!s) return;
    setSampleId(id);
    setPhoto(null);
    setWells([...s.wells]);
    setMarkers(DEFAULT_MARKERS);
    setRFrac(0.085);
    setCamOn(false);
  }

  function fillFields(fields: DocField[]) {
    applyCase(Object.fromEntries(fields.map((field) => [field.key, field.value])));
    setSheet(null);
  }

  async function finish() {
    if (!name.trim()) {
      setError(c.needName);
      setStep('case');
      return;
    }
    if (!sampleId && !photo) {
      setError(c.needPhoto);
      setStep('photo');
      return;
    }
    setError('');
    setStep('analyzing');
    setPhase(0);
    try {
      let read: PlateRead | null = null;
      let photoUri: string | null = photo;
      let photoHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, 'no-photo');
      for (let i = 0; i < c.phases.length; i++) {
        setPhase(i);
        if (i === 1) {
          if (sampleId) {
            read = readSample(sampleId);
            photoUri = null;
          } else if (photo) {
            const plate = await decodePlate(photo);
            read = readPlate(plate.rgba, plate.width, plate.height, wells, markers, rFrac);
            photoHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, plate.b64.slice(0, 8000));
            photoUri = plate.uri;
          }
        }
        await wait(i === 0 ? 1000 : 900);
      }
      if (!read) throw new Error(c.plateFail);
      kept = { name, age, gender, fir, item, place, coords, witness, batch, expiry, wells: [...wells] };
      const rec = await saveRecord({
        suspect: { name: name.trim(), age, gender },
        fir,
        item,
        location: { place, ...coords, gps: !!coords.lat },
        witness,
        kit: { batch, expiry },
        wells: read.wells,
        light: read.light,
        quality: read.quality,
        photoUri,
        photoHash,
        synthetic: !!sampleId,
      });
      router.replace({ pathname: '/record', params: { id: rec.id, from: 'scan' } });
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : c.analysisFail);
      setStep('photo');
      setPhase(-1);
    }
  }

  const sample = SAMPLES.find((s) => s.id === sampleId);
  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const beamY = beam.interpolate({ inputRange: [0, 1], outputRange: [16, 300] });

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.frame}>
        {step === 'analyzing' ? (
          <>
            <View style={styles.appbar}>
              <Text style={[styles.appTitle, { textAlign: 'center' }]}>{c.readingWells}</Text>
            </View>
            <ScrollView style={styles.analyzing} contentContainerStyle={{ paddingBottom: 24 }}>
            <Text style={styles.aCaption}>{photo ? c.plateReading : c.samplePlate}</Text>
            <View style={styles.aPhoto}>
              {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="contain" /> : (
                <View style={styles.samplePlate}>
                  {(sample?.colours ?? ['#EFEADF', '#EFEADF', '#EFEADF']).map((c, i) => (
                    <View key={i} style={[styles.sampleWell, { backgroundColor: c }]} />
                  ))}
                </View>
              )}
              <Animated.View style={[styles.beam, { transform: [{ translateY: beamY }] }]} />
            </View>
            <View style={styles.checklist}>
              {c.phases.map((label, n) => (
                <View key={label} style={styles.checkRow}>
                  <View style={styles.ck}>
                    {n < phase ? <Icon name="check" size={18} color={C.neg} strokeWidth={2.8} /> : n === phase ? (
                      <Animated.View style={[styles.spinner, { transform: [{ rotate: spinDeg }] }]} />
                    ) : null}
                  </View>
                  <Text style={[styles.checkText, n <= phase && { color: C.ink }]}>{label}</Text>
                </View>
              ))}
            </View>
            </ScrollView>
          </>
        ) : (
          <View style={styles.stepBody}>
            <ScrollView
              ref={scroller}
              scrollEventThrottle={16}
              onScroll={(e) => {
                const y = e.nativeEvent.contentOffset.y;
                const next = y <= 2 ? 0 : Math.min(1, (y - 2) / 36);
                setEdge((prev) => (Math.abs(prev - next) < 0.08 ? prev : next));
              }}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: headH }}
            >
            {step === 'case' && (
              <>
                <Text style={styles.headline}>{c.who}</Text>
                <View style={styles.autofill}>
                  <Pressable style={styles.auto} onPress={() => setSheet('fir')}>
                    <Icon name="doc" color={C.onBrand} />
                    <Text style={styles.autoT}>{c.scanFir}</Text>
                    <Text style={styles.autoS}>{c.scanFirSub}</Text>
                  </Pressable>
                  <Pressable style={styles.auto} onPress={() => setSheet('kit')}>
                    <Icon name="flask" color={C.onBrand} />
                    <Text style={styles.autoT}>{c.scanKit}</Text>
                    <Text style={styles.autoS}>{c.scanKitSub}</Text>
                  </Pressable>
                </View>
                <Field label={c.suspectName} value={name} onChangeText={setName} />
                <View style={styles.grid}>
                  <View style={{ flex: 1 }}><Field label={c.age} value={age} onChangeText={setAge} keyboardType="number-pad" maxLength={3} /></View>
                  <View style={{ flex: 1 }}><Field label={c.firCase} value={fir} onChangeText={setFir} /></View>
                </View>
                <Text style={styles.fieldLabel}>{c.gender}</Text>
                <Chips options={c.genders} value={gender} onPick={setGender} />
                <Text style={styles.fieldLabel}>{c.material}</Text>
                <Chips options={c.materials} value={item} onPick={setItem} />
                <View style={styles.grid}>
                  <View style={{ flex: 1 }}><Field label={c.kitBatchNo} value={batch} onChangeText={setBatch} /></View>
                  <View style={{ flex: 1 }}><Field label={c.kitExpiry} value={expiry} onChangeText={setExpiry} /></View>
                </View>
                <Pressable style={styles.li} onPress={() => { setPlaceDraft(place); setSheet('place'); }}>
                  <View style={styles.lead}><Icon name="pin" size={20} color={C.ink2} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.liH} numberOfLines={1}>{place}</Text>
                    <Text style={styles.liS}>{coords.lat ? `${coords.lat.toFixed(4)}°N, ${coords.lng?.toFixed(4)}°E${coords.acc ? ` · ±${Math.round(coords.acc)} m` : ''}` : c.gpsOff}</Text>
                  </View>
                  <Text style={styles.change}>{c.change}</Text>
                </Pressable>
                <Field label={c.witnessOpt} value={witness} onChangeText={setWitness} />
              </>
            )}
            {step === 'setup' && (
              <>
                <Text style={styles.headline}>{c.setupTitle}</Text>
                <Text style={styles.sub}>{c.setupSub}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 14 }}>
                  {PRESETS.map((p) => {
                    const on = p.wells.join() === wells.join();
                    return (
                      <Pressable key={p.id} onPress={() => setWells([...p.wells])} style={[styles.chip, on && styles.chipOn]}>
                        {on ? <Icon name="check" size={16} color={C.onBrand} strokeWidth={2.4} /> : null}
                        <Text style={{ color: on ? C.onBrand : C.ink2, fontWeight: '500' }}>{c.presetName(p.id, p.name)}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <View style={styles.plate}>
                  {wells.map((id, i) => (
                    <Pressable key={id + i} style={styles.well} onPress={() => { setReagentAt(i); setSheet('reagent'); }}>
                      <View style={styles.cup}><Text style={styles.cupN}>{i + 1}</Text></View>
                      <Text style={styles.wellName}>{REAGENTS[id].short}</Text>
                      <Text style={styles.edit}>{c.change}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.section}>
                  <Text style={styles.titleM}>{c.stepsTitle}</Text>
                  <Text style={styles.label}>{c.tapExpand}</Text>
                </View>
                {wells.map((id, i) => {
                  const Rg = REAGENTS[id];
                  const open = openAcc === i;
                  const remain = left[i] ?? Rg.timer;
                  const running = left[i] != null && left[i] > 0;
                  return (
                    <View key={id + i} style={styles.acc}>
                      <Pressable style={styles.accHead} onPress={() => setOpenAcc(open ? -1 : i)}>
                        <View style={styles.accN}><Text style={styles.accNT}>{i + 1}</Text></View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.accName}>{Rg.name}</Text>
                          <Text style={styles.accTarget}>{Rg.target}</Text>
                        </View>
                        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}><Icon name="chevd" size={20} color={C.ink2} /></View>
                      </Pressable>
                      {open ? (
                        <View style={styles.accBody}>
                          {Rg.steps.map((s, n) => (
                            <View key={n} style={styles.stepLine}>
                              <View style={styles.stepN}><Text style={styles.stepNT}>{n + 1}</Text></View>
                              <Text style={styles.stepTxt}>{s}</Text>
                            </View>
                          ))}
                          <View style={styles.note}><Icon name="drop" size={18} color={C.ink2} /><Text style={styles.noteTxt}><Text style={{ fontWeight: '700' }}>{c.positive}</Text>{Rg.positive}</Text></View>
                          <View style={styles.timer}>
                            <Icon name="timer" size={20} color={C.ink} />
                            <Text style={styles.timerB}>{mmss(remain)}</Text>
                            <Text style={styles.timerL}>{c.reaction}</Text>
                            <Pressable
                              style={[styles.timerBtn, running && { backgroundColor: C.surface2 }]}
                              onPress={() => { if (!running) setLeft((p) => ({ ...p, [i]: Rg.timer })); }}>
                              <Text style={{ color: running ? C.ink : '#fff', fontWeight: '700' }}>{remain === 0 && left[i] === 0 ? c.timerDone : running ? c.timerRun : c.timerStart}</Text>
                            </Pressable>
                          </View>
                          <Pressable
                            style={styles.readBtn}
                            onPress={() => Speech.speak(`${Rg.name}. ${Rg.steps.join('. ')}. Positive: ${Rg.positive}`, { language: session.lang === 'hi' ? 'hi-IN' : 'en-IN' })}>
                            <Icon name="speaker" size={18} color={C.ink} />
                            <Text style={{ fontWeight: '600' }}>{c.readAloud}</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
                <View style={[styles.note, { backgroundColor: C.warnSoft, marginTop: 16 }]}>
                  <Icon name="alert" size={18} color="#5B3A00" />
                  <Text style={[styles.noteTxt, { color: '#5B3A00' }]}>{c.gloves}</Text>
                </View>
              </>
            )}
            {step === 'photo' && (
              <>
                <View style={styles.stage} onLayout={(e) => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
                  {camOn && perm?.granted ? (
                    <CameraView ref={cam} style={StyleSheet.absoluteFill} facing="back" mode="picture" animateShutter={false} onCameraReady={() => setCamReady(true)} />
                  ) : photo ? (
                    <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="contain" />
                  ) : sample ? (
                    <View style={styles.samplePlate}>
                      {sample.colours.map((c, i) => <View key={i} style={[styles.sampleWell, { backgroundColor: c }]} />)}
                    </View>
                  ) : (
                    <>
                      <View style={styles.reticle} pointerEvents="none">
                        <View style={[styles.corner, { left: 0, top: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 }]} />
                        <View style={[styles.corner, { right: 0, top: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 }]} />
                        <View style={[styles.corner, { left: 0, bottom: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 }]} />
                        <View style={[styles.corner, { right: 0, bottom: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 }]} />
                      </View>
                      <View style={styles.empty}>
                        <Text style={styles.emptyT}>{c.placePlate}</Text>
                        <Text style={styles.emptyS}>{c.placePlateSub}</Text>
                      </View>
                    </>
                  )}
                  {photo && plateOk ? wells.map((id, i) => (
                    <WellMarker
                      key={id + i}
                      marker={markers[i] ?? DEFAULT_MARKERS[i]}
                      label={`${i + 1} · ${REAGENTS[id].short}`}
                      rFrac={rFrac}
                      stage={stage}
                      onChange={(m) => setMarkers((list) => list.map((x, n) => (n === i ? m : x)))}
                    />
                  )) : null}
                </View>
                {photo && !plateOk ? (
                  <>
                    <View style={[styles.note, { marginTop: 12 }]}>
                      <Icon name="camera" size={18} color={C.ink2} />
                      <Text style={styles.noteTxt}>{c.plateCheck}</Text>
                    </View>
                    <View style={{ marginTop: 12 }}>
                      <Btn kind="tonal" icon="camera" label={c.retake} onPress={retake} />
                    </View>
                  </>
                ) : photo ? (
                  <>
                    <View style={[styles.note, { marginTop: 12 }]}>
                      <Icon name="scan" size={18} color={C.ink2} />
                      <Text style={styles.noteTxt}>{c.drag}</Text>
                    </View>
                    <Text style={styles.fieldLabel}>{c.circleSize}</Text>
                    <View
                      style={styles.range}
                      onStartShouldSetResponder={() => true}
                      onResponderGrant={(e) => setRFrac(0.03 + Math.min(1, Math.max(0, e.nativeEvent.locationX / Math.max(1, stage.w))) * 0.13)}
                      onResponderMove={(e) => setRFrac(0.03 + Math.min(1, Math.max(0, e.nativeEvent.locationX / Math.max(1, stage.w))) * 0.13)}>
                      <View style={[styles.rangeFill, { width: `${((rFrac - 0.03) / 0.13) * 100}%` }]} />
                    </View>
                    <View style={[styles.grid, { marginTop: 12 }]}>
                      <View style={{ flex: 1 }}><Btn kind="tonal" icon="gallery" label={c.changePhoto} onPress={gallery} /></View>
                      <View style={{ flex: 1 }}><Btn kind="tonal" icon="refresh" label={c.resetCircles} onPress={() => { setMarkers(DEFAULT_MARKERS); setRFrac(0.085); }} /></View>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.tray}>
                      <Pressable style={styles.sideAct} onPress={gallery}>
                        <View style={styles.sideI}><Icon name="gallery" size={22} /></View>
                        <Text style={styles.sideT}>{c.gallery}</Text>
                      </Pressable>
                      <Pressable
                        style={styles.shutter}
                        onPress={async () => {
                          if (!perm?.granted) {
                            const next = await requestPerm();
                            if (!next.granted) {
                              setError(c.docCamDenied);
                              return;
                            }
                          }
                          setError('');
                          if (!camOn) { setCamReady(false); setCamOn(true); }
                          else await shoot();
                        }}>
                        <View style={styles.shutterIn}><Icon name="camera" size={28} color="#fff" /></View>
                      </Pressable>
                      <Pressable style={styles.sideAct} onPress={() => setSheet('tips')}>
                        <View style={styles.sideI}><Icon name="bulb" size={22} /></View>
                        <Text style={styles.sideT}>{c.tips}</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.camNote}>{camOn ? (camReady ? c.camReady : c.camOpening) : c.camHint}</Text>
                  </>
                )}
                {!photo ? <View style={styles.section}><Text style={styles.titleM}>{c.trySample}</Text></View> : null}
                {!photo ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {SAMPLES.map((s) => {
                    const on = sampleId === s.id;
                    return (
                      <Pressable key={s.id} onPress={() => pickSample(s.id)} style={[styles.chip, on && styles.chipOn]}>
                        <View style={{ flexDirection: 'row', gap: 3 }}>
                          {s.colours.map((c, i) => <View key={i} style={[styles.sw, { backgroundColor: c }]} />)}
                        </View>
                        <Text style={{ color: on ? C.onBrand : C.ink2, fontWeight: '500' }}>{c.sampleLabel(s.id, s.label)}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView> : null}
              </>
            )}
            {error ? <Text style={styles.err}>{error}</Text> : null}
            </ScrollView>
            <View pointerEvents="box-none" style={styles.overlayHead}>
              <View style={styles.overlaySolid} onLayout={(e) => setHeadH(Math.ceil(e.nativeEvent.layout.height))}>
                <View style={styles.appbar}>
                  <Pressable style={styles.iconBtn} onPress={back}><Icon name="back" color={C.ink2} /></Pressable>
                  <Text style={styles.appTitle}>{c.newTest}</Text>
                  <Pressable style={styles.iconBtn} onPress={() => setSheet('discard')}><Icon name="x" color={C.ink2} /></Pressable>
                </View>
                <View style={styles.progress}>
                  {[1, 2, 3].map((n) => (
                    <View key={n} style={[styles.seg, n <= stepNo && { backgroundColor: C.brand }]} />
                  ))}
                </View>
                <Text style={styles.stepLabel}>{c.stepOf(stepNo, c.steps[stepNo])}</Text>
              </View>
              <EdgeBlur amount={edge} />
            </View>
          </View>
        )}

        {step !== 'analyzing' ? (
          <FlowBar backLabel={step === 'case' ? c.cancel : c.back} onBack={back}>
            {step === 'photo' && photo && !plateOk ? (
              <Btn label={c.usePhoto} kind="brand" icon="check" onPress={() => setPlateOk(true)} />
            ) : step === 'photo' ? (
              <Btn label={c.analyse} kind="brand" icon="spark" disabled={!photo && !sampleId} onPress={finish} />
            ) : (
              <Btn label={c.continue} kind="dark" onPress={() => {
                if (step === 'case' && !name.trim()) { setError(c.needName); return; }
                setError('');
                setStep(step === 'case' ? 'setup' : 'photo');
              }} />
            )}
          </FlowBar>
        ) : null}

        <Modal visible={sheet != null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
          <Pressable style={styles.scrim} onPress={() => setSheet(null)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.grab} />
            {sheet === 'discard' && (
              <View style={{ padding: 24 }}>
                <Icon name="alert" size={28} color={C.warn} />
                <Text style={styles.headline}>{c.discardTitle}</Text>
                <Text style={styles.sub}>{c.discardSub}</Text>
                <View style={styles.dialogActs}>
                  <Pressable onPress={() => setSheet(null)}><Text style={styles.dialogBtn}>{c.keep}</Text></Pressable>
                  <Pressable onPress={() => router.replace('/home')}><Text style={[styles.dialogBtn, { color: C.pos }]}>{c.discard}</Text></Pressable>
                </View>
              </View>
            )}
            {sheet === 'place' && (
              <View style={{ paddingHorizontal: 20 }}>
                <Text style={styles.headline}>{c.locationTitle}</Text>
                <Text style={styles.sub}>{c.locationSub}</Text>
                <View style={{ marginTop: 16 }}><Btn kind="dark" icon="pin" label={c.useGps} onPress={locate} /></View>
                <Field label={c.placeName} value={placeDraft} onChangeText={setPlaceDraft} />
                {gpsNote ? <Text style={styles.sub}>{gpsNote}</Text> : null}
                <View style={{ marginTop: 12 }}><Btn kind="tonal" label={c.savePlace} onPress={() => { if (placeDraft.trim()) { setPlace(placeDraft.trim()); setSheet(null); } }} /></View>
              </View>
            )}
            {(sheet === 'fir' || sheet === 'kit') && (
              <DocumentFlow
                initial={sheet}
                backend={API_URL}
                lang={session.lang}
                applyLabel={c.docFill}
                onClose={() => setSheet(null)}
                onApply={fillFields}
              />
            )}
            {sheet === 'reagent' && (
              <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                <Text style={styles.headline}>{c.reagentFor(reagentAt + 1)}</Text>
                {Object.values(REAGENTS).map((Rg) => {
                  const on = wells[reagentAt] === Rg.id;
                  return (
                    <Pressable key={Rg.id} style={[styles.opt, on && styles.optOn]} onPress={() => { setWells((w) => w.map((id, i) => (i === reagentAt ? Rg.id : id))); setSheet(null); }}>
                      <View style={{ flexDirection: 'row', gap: 3 }}>{Rg.outcomes.map((o) => <View key={o.hex} style={[styles.sw, { width: 14, height: 14, backgroundColor: o.hex }]} />)}</View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '600', fontSize: 16 }}>{Rg.name}</Text>
                        <Text style={{ color: C.muted, fontSize: 13 }}>{Rg.target}</Text>
                      </View>
                      {on ? <Icon name="check" color={C.brand} strokeWidth={2.6} /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            {sheet === 'tips' && (
              <View style={{ paddingHorizontal: 20 }}>
                <Text style={styles.headline}>{c.photoTips}</Text>
                <Text style={[styles.tipHead, { color: C.neg }]}>{c.doThis}</Text>
                {c.tipDo.map((tip) => <Text key={tip} style={styles.tip}>{tip}</Text>)}
                <Text style={[styles.tipHead, { color: C.pos }]}>{c.avoid}</Text>
                {c.tipAvoid.map((tip) => <Text key={tip} style={styles.tip}>{tip}</Text>)}
                <View style={{ marginTop: 16 }}><Btn kind="dark" label={c.gotIt} onPress={() => setSheet(null)} /></View>
              </View>
            )}
          </View>
        </Modal>
      </View>
    </View>
  );
}

function Chips({ options, value, onPick }: { options: { id: string; label: string }[]; value: string; onPick: (v: string) => void }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <Pressable key={o.id} onPress={() => onPick(o.id)} style={[styles.chip, on && styles.chipOn]}>
            {on ? <Icon name="check" size={16} color={C.onBrand} strokeWidth={2.4} /> : null}
            <Text style={{ color: on ? C.onBrand : C.ink2, fontWeight: '500' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, alignItems: 'center' },
  frame: { flex: 1, width: '100%', maxWidth: 480 },
  stepBody: { flex: 1 },
  overlayHead: { position: 'absolute', top: 0, left: 0, right: 0 },
  overlaySolid: { backgroundColor: C.bg },
  appbar: { height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  appTitle: { flex: 1, fontSize: 20, fontWeight: '600', color: C.ink },
  iconBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: 16 },
  seg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.surface3 },
  stepLabel: { paddingHorizontal: 16, paddingTop: 8, fontSize: 13, fontWeight: '600', color: C.muted },
  headline: { fontSize: 24, fontWeight: '700', color: C.ink, marginTop: 18 },
  sub: { color: C.muted, fontSize: 14, lineHeight: 20, marginTop: 6 },
  autofill: { flexDirection: 'row', gap: 10, marginTop: 12 },
  auto: { flex: 1, backgroundColor: C.brandSoft, borderRadius: R.card, padding: 14, gap: 6 },
  autoT: { color: C.onBrand, fontWeight: '700', fontSize: 14 },
  autoS: { color: C.onBrand, opacity: 0.85, fontSize: 12 },
  grid: { flexDirection: 'row', gap: 12 },
  fieldLabel: { fontSize: 14, fontWeight: '500', color: C.ink2, marginTop: 18, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: R.chip, borderWidth: 1, borderColor: C.outline, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipOn: { backgroundColor: C.brandSoft, borderColor: 'transparent' },
  li: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, minHeight: 64 },
  lead: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  liH: { fontSize: 16, fontWeight: '500', color: C.ink },
  liS: { fontSize: 13, color: C.muted, marginTop: 2 },
  change: { color: C.brand, fontWeight: '700', fontSize: 14 },
  plate: { backgroundColor: C.surface, borderRadius: 24, paddingVertical: 20, flexDirection: 'row', justifyContent: 'space-around', marginTop: 4 },
  well: { width: '31%', alignItems: 'center', gap: 8 },
  cup: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 3px 8px rgba(0,0,0,.12)' },
  cupN: { fontSize: 20, fontWeight: '700', color: C.muted },
  wellName: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  edit: { fontSize: 11, color: C.brand, fontWeight: '700' },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 8 },
  titleM: { fontSize: 16, fontWeight: '600', color: C.ink },
  label: { fontSize: 12, fontWeight: '600', color: C.muted, letterSpacing: 0.4 },
  acc: { borderWidth: 1, borderColor: C.line, borderRadius: R.card, marginTop: 10, overflow: 'hidden' },
  accHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  accN: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  accNT: { color: '#fff', fontWeight: '700', fontSize: 13 },
  accName: { fontSize: 16, fontWeight: '500' },
  accTarget: { fontSize: 13, color: C.muted },
  accBody: { paddingHorizontal: 16, paddingBottom: 16 },
  stepLine: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  stepN: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  stepNT: { fontSize: 12, fontWeight: '700' },
  stepTxt: { flex: 1, color: C.ink2, fontSize: 14, lineHeight: 20 },
  note: { flexDirection: 'row', gap: 10, backgroundColor: C.surface, borderRadius: R.input, padding: 12, marginBottom: 10 },
  noteTxt: { flex: 1, color: C.ink2, fontSize: 13, lineHeight: 18 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: 12, padding: 8 },
  timerB: { fontSize: 18, fontWeight: '700', minWidth: 56, fontVariant: ['tabular-nums'] },
  timerL: { flex: 1, fontSize: 13, color: C.muted },
  timerBtn: { backgroundColor: C.ink, borderRadius: 20, paddingHorizontal: 16, height: 40, alignItems: 'center', justifyContent: 'center' },
  readBtn: { marginTop: 10, alignSelf: 'flex-start', flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: C.surface2, borderRadius: 20, paddingHorizontal: 14, height: 40 },
  stage: { marginTop: 12, backgroundColor: '#141517', borderRadius: 24, overflow: 'hidden', aspectRatio: 4 / 3.4 },
  reticle: { position: 'absolute', left: '18%', right: '18%', top: '18%', bottom: '18%' },
  corner: { position: 'absolute', width: 26, height: 26, borderWidth: 3, borderColor: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyT: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyS: { color: '#A9ABB2', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  samplePlate: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  sampleWell: { width: 64, height: 64, borderRadius: 32, borderWidth: 6, borderColor: '#fff' },
  marker: { position: 'absolute', borderRadius: 999, borderWidth: 2.5, borderColor: '#fff', alignItems: 'center' },
  markerLbl: { position: 'absolute', top: -22, backgroundColor: '#fff', color: C.ink, fontSize: 11, fontWeight: '700', paddingHorizontal: 6, borderRadius: 6, overflow: 'hidden' },
  range: { height: 28, borderRadius: 14, backgroundColor: C.surface2, justifyContent: 'center' },
  rangeFill: { height: 6, borderRadius: 3, backgroundColor: C.brand, marginLeft: 8 },
  tray: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 14 },
  sideAct: { width: 80, alignItems: 'center', gap: 6 },
  sideI: { width: 48, height: 48, borderRadius: 16, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  sideT: { fontSize: 12, fontWeight: '700', color: C.ink2 },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  shutterIn: { width: 60, height: 60, borderRadius: 30, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  camNote: { textAlign: 'center', color: C.muted, fontSize: 12, marginTop: 2 },
  sw: { width: 10, height: 10, borderRadius: 5 },
  err: { color: C.pos, marginTop: 12 },
  analyzing: { flex: 1 },
  aCaption: { textAlign: 'center', color: C.ink2, fontSize: 14, marginTop: 4, marginHorizontal: 24 },
  aPhoto: { marginHorizontal: 16, marginTop: 12, borderRadius: 24, overflow: 'hidden', height: 320, backgroundColor: '#141517' },
  beam: { position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: C.brand2, boxShadow: '0 0 16px rgba(255,138,61,.8)' },
  checklist: { marginTop: 24, marginHorizontal: 48 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  ck: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  spinner: { width: 18, height: 18, borderRadius: 9, borderWidth: 2.5, borderColor: C.surface3, borderTopColor: C.brand },
  checkText: { fontSize: 16, color: C.muted },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,.32)' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '88%' },
  grab: { width: 32, height: 4, borderRadius: 2, backgroundColor: C.outline, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  dialogActs: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 22 },
  dialogBtn: { color: C.brand, fontWeight: '700', padding: 12, fontSize: 15 },
  card: { marginTop: 14, borderWidth: 1, borderColor: C.line, borderRadius: R.card, paddingHorizontal: 16 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line, gap: 12 },
  kvK: { color: C.muted, fontSize: 14 },
  kvV: { fontWeight: '600', fontSize: 14, textAlign: 'right', flexShrink: 1 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderWidth: 1, borderColor: C.line, borderRadius: R.card, marginTop: 10 },
  optOn: { borderWidth: 2, borderColor: C.brand },
  tipHead: { fontWeight: '700', marginTop: 16, marginBottom: 6 },
  tip: { color: C.ink2, fontSize: 14, lineHeight: 20, marginBottom: 6 },
});
