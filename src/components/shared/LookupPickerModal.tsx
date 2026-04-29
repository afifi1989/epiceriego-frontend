/**
 * LookupPickerModal — modale plein-écran générique pour sélectionner un
 * élément dans une liste avec recherche.
 *
 * Bâti sur le même pattern que CategoryPickerModal : un tap = une
 * sélection (pas de bouton Confirmer). Conçu pour être branché à
 * n'importe quel référentiel (pays, ville, quartier, devise…) sans
 * dupliquer le boilerplate FlatList + recherche + état vide.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export interface LookupItem {
  id: string | number;
  label: string;
  /** Optionnel : ligne secondaire (ex: code ISO du pays, symbole devise). */
  sublabel?: string;
  /** Optionnel : préfixe (drapeau, emoji). */
  prefix?: string;
}

interface LookupPickerModalProps {
  visible: boolean;
  items: LookupItem[];
  selectedId: string | number | null;
  onSelect: (item: LookupItem) => void;
  onClose: () => void;
  title: string;
  /** Affiche le spinner si la liste n'est pas encore chargée. */
  loading?: boolean;
  /** Texte affiché quand items est vide après chargement. */
  emptyText?: string;
  searchPlaceholder?: string;
}

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[àâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ûü]/g, 'u')
    .replace(/[ç]/g, 'c');

export const LookupPickerModal: React.FC<LookupPickerModalProps> = ({
  visible,
  items,
  selectedId,
  onSelect,
  onClose,
  title,
  loading = false,
  emptyText = 'Aucun élément',
  searchPlaceholder = 'Rechercher…',
}) => {
  const [query, setQuery] = useState('');
  const searchRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setQuery('');
      const t = setTimeout(() => searchRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = normalize(query.trim());
    return items.filter(
      it => normalize(it.label).includes(q)
        || (it.sublabel && normalize(it.sublabel).includes(q)),
    );
  }, [items, query]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              ref={searchRef}
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor="#9aa3ad"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => setQuery('')}
                style={styles.clearBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Chargement…</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.emptyIcon}>🔎</Text>
            <Text style={styles.emptyTitle}>{emptyText}</Text>
            {query.length > 0 && (
              <Text style={styles.emptyHint}>
                Aucun résultat pour « {query} »
              </Text>
            )}
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(it) => String(it.id)}
            renderItem={({ item }) => {
              const selected = item.id === selectedId;
              return (
                <TouchableOpacity
                  style={[styles.row, selected && styles.rowSelected]}
                  onPress={() => onSelect(item)}
                  activeOpacity={0.7}
                >
                  {item.prefix && <Text style={styles.prefix}>{item.prefix}</Text>}
                  <View style={styles.rowText}>
                    <Text style={[styles.label, selected && styles.labelSelected]}>
                      {item.label}
                    </Text>
                    {item.sublabel && (
                      <Text style={styles.sublabel}>{item.sublabel}</Text>
                    )}
                  </View>
                  {selected && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              );
            }}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 19, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  closeBtn: {
    padding: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { fontSize: 16, color: '#4b5563', fontWeight: '600' },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f3f5',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
    opacity: 0.6,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a1a1a',
  },
  clearBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  clearBtnText: { fontSize: 14, color: '#9aa3ad', fontWeight: '600' },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: { fontSize: 14, color: '#9aa3ad' },
  emptyIcon: { fontSize: 48, marginBottom: 4, opacity: 0.5 },
  emptyTitle: { fontSize: 15, color: '#374151', fontWeight: '600', textAlign: 'center' },
  emptyHint: { fontSize: 13, color: '#9aa3ad', textAlign: 'center', marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
    gap: 14,
  },
  rowSelected: { backgroundColor: '#F1F8F2' },
  prefix: { fontSize: 22 },
  rowText: { flex: 1 },
  label: { fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  labelSelected: { color: '#2E7D32', fontWeight: '700' },
  sublabel: { fontSize: 12, color: '#9aa3ad', marginTop: 2 },
  checkmark: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
    backgroundColor: '#4CAF50',
    width: 24,
    height: 24,
    borderRadius: 999,
    textAlign: 'center',
    lineHeight: 24,
    overflow: 'hidden',
  },
});
