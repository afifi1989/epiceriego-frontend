import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../theme';
import { ColorPalette } from '../../theme/colors';
import { Caisse, caisseService } from '../../services/caisseService';
import { useActiveCaisse, setActiveCaisseId } from '../../services/activeCaisse';

/**
 * Sélecteur de la caisse active de CE poste (liaison device ↔ caisse).
 * Pastille compacte -> modal de choix. Mémorise via {@link setActiveCaisseId}.
 * Appelle {@link onChange} à l'init et à chaque changement pour recharger la
 * session de la bonne caisse côté écran hôte.
 */
export function CaisseSelector({ onChange }: { onChange?: (id: number | null) => void }) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const activeId = useActiveCaisse();

  const [caisses, setCaisses] = useState<Caisse[]>([]);
  const [open, setOpen] = useState(false);

  useFocusEffect(useCallback(() => {
    let alive = true;
    caisseService.list(false).then(data => {
      if (!alive) return;
      const usable = data.filter(c => !c.archivedAt && c.active);
      setCaisses(usable);
      // Sélection : mémorisée si valide, sinon défaut / première.
      const valid = activeId != null && usable.some(c => c.id === activeId);
      const fallback = usable.find(c => c.defaultCaisse)?.id ?? usable[0]?.id ?? null;
      const next = valid ? activeId : fallback;
      if (next !== activeId) setActiveCaisseId(next);
      onChange?.(next);
    }).catch(() => { /* silencieux : caisse par défaut serveur */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  if (caisses.length === 0) return null;

  const selected = caisses.find(c => c.id === activeId) ?? caisses[0];
  const single = caisses.length === 1;

  const pick = (c: Caisse) => {
    setActiveCaisseId(c.id);
    onChange?.(c.id);
    setOpen(false);
  };

  return (
    <>
      <TouchableOpacity
        style={s.pill}
        activeOpacity={single ? 1 : 0.7}
        onPress={() => { if (!single) setOpen(true); }}
      >
        <Ionicons name="wallet-outline" size={15} color={colors.info} />
        <Text style={s.pillText} numberOfLines={1}>{selected?.nom}</Text>
        {!single && <Ionicons name="chevron-down" size={14} color={colors.textMuted} />}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.overlay} onPress={() => setOpen(false)}>
          <Pressable style={s.sheet}>
            <Text style={s.sheetTitle}>Caisse de ce poste</Text>
            {caisses.map(c => {
              const sel = c.id === selected?.id;
              return (
                <TouchableOpacity key={c.id} style={s.row} onPress={() => pick(c)}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowName}>{c.nom}</Text>
                    {!!c.code && <Text style={s.rowCode}>{c.code}</Text>}
                  </View>
                  {c.defaultCaisse && <Text style={s.rowDefault}>défaut</Text>}
                  <Ionicons
                    name={sel ? 'radio-button-on' : 'radio-button-off'}
                    size={20} color={sel ? colors.info : colors.textMuted}
                  />
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (c: ColorPalette) => StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 190,
    paddingHorizontal: 11, paddingVertical: 6,
    backgroundColor: c.surfaceMuted, borderWidth: 1, borderColor: c.border, borderRadius: 999,
  },
  pillText: { fontSize: 13, fontWeight: '700', color: c.textPrimary, flexShrink: 1 },

  overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: c.surface, borderRadius: 16, padding: 16 },
  sheetTitle: { fontSize: 15, fontWeight: '800', color: c.textPrimary, marginBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.border,
  },
  rowName: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
  rowCode: { fontSize: 12, color: c.textMuted, marginTop: 1 },
  rowDefault: {
    fontSize: 11, fontWeight: '700', color: c.info,
    backgroundColor: c.infoSubtle, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden',
  },
});
