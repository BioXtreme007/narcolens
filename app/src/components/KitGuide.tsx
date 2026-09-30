import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { ScrollView } from '@/components/Scroll';
import { C, R } from '@/constants/brand';
import { L, type Lang } from '@/lib/i18n';
import { REAGENTS, type Reagent } from '@/ml/engine';

export function KitGuide({ open, onClose, lang = 'en' }: { open: boolean; onClose: () => void; lang?: Lang }) {
  const [reagent, setReagent] = useState<Reagent | null>(null);
  const current = reagent;
  const c = L(lang);

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.grab} />
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
          {current ? (
            <>
              <Pressable onPress={() => setReagent(null)} style={styles.back}>
                <Icon name="back" />
                <Text style={styles.backText}>{c.kitGuide}</Text>
              </Pressable>
              <Text style={styles.kicker}>{current.kit}</Text>
              <Text style={styles.h}>{current.name}</Text>
              <Text style={styles.sub}>{current.target}</Text>
              {current.steps.map((s, i) => (
                <Text key={s} style={styles.step}>{i + 1}. {s}</Text>
              ))}
              <View style={styles.card}>
                <Row hex={current.baseline} label={current.baselineName} badge={c.notDetected} />
                {current.outcomes.map((o) => (
                  <Row key={o.drug + o.hex} hex={o.hex} label={o.colour} badge={o.drug} pos />
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.h}>{c.kitGuide}</Text>
              <Text style={styles.sub}>{c.kitGuideBody}</Text>
              {Object.values(REAGENTS).map((Rgt) => (
                <Pressable key={Rgt.id} style={styles.opt} onPress={() => setReagent(Rgt)}>
                  <View style={styles.dots}>
                    {Rgt.outcomes.map((o) => (
                      <View key={o.hex} style={[styles.dot, { backgroundColor: o.hex }]} />
                    ))}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optTitle}>{Rgt.name}</Text>
                    <Text style={styles.sub}>{Rgt.target}</Text>
                  </View>
                  <Icon name="chev" color={C.ink2} />
                </Pressable>
              ))}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Row({ hex, label, badge, pos }: { hex: string; label: string; badge: string; pos?: boolean }) {
  return (
    <View style={styles.row}>
      <View style={[styles.sw, { backgroundColor: hex }]} />
      <Text style={{ flex: 1, color: C.ink }}>{label}</Text>
      <Text style={[styles.badge, { backgroundColor: pos ? C.posSoft : C.negSoft, color: pos ? C.pos : C.neg }]}>{badge}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,.32)' },
  sheet: { maxHeight: '88%', backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  grab: { width: 32, height: 4, borderRadius: 2, backgroundColor: C.outline, alignSelf: 'center', marginTop: 12 },
  h: { fontSize: 28, fontWeight: '700', color: C.ink },
  kicker: { color: C.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  sub: { color: C.muted, marginTop: 4, lineHeight: 20 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.line, borderRadius: R.card, padding: 14, marginTop: 10 },
  optTitle: { fontSize: 16, fontWeight: '500', color: C.ink },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  step: { color: C.ink2, marginTop: 10, lineHeight: 20 },
  card: { marginTop: 16, backgroundColor: C.surface, borderRadius: R.card, padding: 14, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sw: { width: 28, height: 28, borderRadius: 14 },
  badge: { overflow: 'hidden', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, fontWeight: '700', fontSize: 12 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  backText: { fontWeight: '600', color: C.ink },
});
