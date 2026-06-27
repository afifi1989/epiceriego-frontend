export { EpicierErrorBoundary as ErrorBoundary } from "@/src/components/errorBoundaries";
import { Colors } from '../../src/constants/colors';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import helpSupportService, {
  ContactInfo,
  HelpCategory,
  HelpPage,
} from '../../src/services/helpSupportService';

/**
 * Aide & Support — version épicier (mobile).
 *
 * Charge `/help/page?audience=EPICIER` (FAQ + contacts seedés en V92).
 * UX FR uniquement, conformément à la règle "UI épicier mobile en français".
 */

// ─── FAQ item with animated chevron ─────────────────────────────────────────
function FaqItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const animRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animRotate, {
      toValue: isOpen ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [isOpen]);

  const rotate = animRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onToggle} style={styles.faqItem}>
      <View style={styles.faqHeader}>
        <Text style={styles.faqQuestion}>{question}</Text>
        <Animated.Text style={[styles.faqChevron, { transform: [{ rotate }] }]}>›</Animated.Text>
      </View>
      {isOpen && (
        <View style={styles.faqAnswerBox}>
          <Text style={styles.faqAnswer}>{answer}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Category accordion (filtre + n'affiche que si articles matchent) ──────
function CategorySection({ category, query }: { category: HelpCategory; query: string }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? category.articles.filter(
        (a) => a.question.toLowerCase().includes(q) || a.answer.toLowerCase().includes(q),
      )
    : category.articles;

  if (filtered.length === 0) return null;

  return (
    <View style={styles.categorySection}>
      <View style={[styles.categoryHeader, { borderLeftColor: category.color }]}>
        <View style={[styles.categoryIconBox, { backgroundColor: category.color }]}>
          <Text style={styles.categoryIcon}>{category.icon}</Text>
        </View>
        <Text style={styles.categoryName}>{category.name}</Text>
        <Text style={styles.categoryCount}>{filtered.length}</Text>
      </View>
      <View style={styles.faqList}>
        {filtered.map((article) => (
          <FaqItem
            key={article.id}
            question={article.question}
            answer={article.answer}
            isOpen={openId === article.id}
            onToggle={() => setOpenId(openId === article.id ? null : article.id)}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Contact button ─────────────────────────────────────────────────────────
function ContactButton({ contact }: { contact: ContactInfo }) {
  const handlePress = () => {
    const val = contact.value;
    switch (contact.type) {
      case 'WHATSAPP':
        Linking.openURL(`https://wa.me/${val.replace(/\D/g, '')}`);
        break;
      case 'PHONE':
        Linking.openURL(`tel:${val}`);
        break;
      case 'EMAIL':
        Linking.openURL(`mailto:${val}?subject=${encodeURIComponent('Support EpicerieGo Pro')}`);
        break;
    }
  };

  return (
    <TouchableOpacity
      style={[styles.contactBtn, { borderColor: contact.color }]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={[styles.contactIconBox, { backgroundColor: contact.color }]}>
        <Text style={styles.contactIcon}>{contact.icon}</Text>
      </View>
      <View style={styles.contactTextBox}>
        <Text style={styles.contactType}>{contact.type}</Text>
        <Text style={styles.contactValue}>{contact.value}</Text>
      </View>
      <Text style={styles.contactChevron}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────
export default function AideSupportEpicierScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [helpPage, setHelpPage] = useState<HelpPage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    helpSupportService
      .getHelpPage('EPICIER')
      .then(setHelpPage)
      .catch(() => Alert.alert('Erreur', 'Impossible de charger la page d\'aide.'))
      .finally(() => setLoading(false));
  }, []);

  const handleReport = () => {
    const email = helpPage?.contactInfo.find((c) => c.type === 'EMAIL');
    if (!email) {
      Alert.alert('Indisponible', 'Aucun contact email configuré côté support.');
      return;
    }
    const subject = encodeURIComponent('Signalement — Espace épicier');
    const body = encodeURIComponent(
      'Décrivez le problème rencontré ici (écran, étapes pour reproduire, captures si possible).',
    );
    Linking.openURL(`mailto:${email.value}?subject=${subject}&body=${body}`);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const hasResults =
    helpPage?.categories?.some((cat) =>
      searchQuery.trim().length === 0
        ? true
        : cat.articles.some(
            (a) =>
              a.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
              a.answer.toLowerCase().includes(searchQuery.toLowerCase()),
          ),
    ) ?? false;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header bleu épicier (cohérent avec le thème) */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Aide & Support</Text>
        <Text style={styles.headerSubtitle}>
          Questions fréquentes et contact direct du support EpicerieGo Pro.
        </Text>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher dans la FAQ…"
            placeholderTextColor="#a8c8e8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* FAQ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {searchQuery.length > 0 ? 'Résultats' : 'Questions fréquentes'}
        </Text>

        {helpPage?.categories.map((cat) => (
          <CategorySection key={cat.id} category={cat} query={searchQuery} />
        ))}

        {!hasResults && searchQuery.length > 0 && (
          <View style={styles.noResults}>
            <Text style={styles.noResultsIcon}>🤔</Text>
            <Text style={styles.noResultsText}>
              Aucun article ne correspond à « {searchQuery} ».
            </Text>
          </View>
        )}
      </View>

      {/* Contact */}
      {searchQuery.length === 0 && (helpPage?.contactInfo?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nous contacter</Text>
          <View style={styles.contactList}>
            {helpPage!.contactInfo.map((c) => (
              <ContactButton key={c.id} contact={c} />
            ))}
          </View>
        </View>
      )}

      {/* Signaler */}
      {searchQuery.length === 0 && (
        <TouchableOpacity style={styles.reportBtn} onPress={handleReport} activeOpacity={0.85}>
          <Text style={styles.reportIcon}>🚩</Text>
          <Text style={styles.reportText}>Signaler un problème</Text>
        </TouchableOpacity>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },

  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingTop: 50,
    paddingBottom: 22,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  backBtn: { position: 'absolute', top: 48, left: 14, padding: 6 },
  backText: { color: '#fff', fontSize: 32, lineHeight: 32 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 8, marginLeft: 38 },
  headerSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 6, marginLeft: 38, lineHeight: 18 },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    marginTop: 16,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#1e293b' },
  clearIcon: { fontSize: 14, color: '#94a3b8', paddingHorizontal: 6 },

  section: { paddingHorizontal: 15, paddingTop: 18 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 10, marginLeft: 4 },

  categorySection: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingVertical: 4,
    borderLeftWidth: 4,
    marginBottom: 8,
  },
  categoryIconBox: {
    width: 30, height: 30, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10,
  },
  categoryIcon: { fontSize: 16 },
  categoryName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1e293b' },
  categoryCount: {
    fontSize: 11, color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
  },

  faqList: {},
  faqItem: { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingVertical: 10 },
  faqHeader: { flexDirection: 'row', alignItems: 'center' },
  faqQuestion: { flex: 1, fontSize: 13.5, fontWeight: '500', color: '#1e293b', lineHeight: 18 },
  faqChevron: { fontSize: 20, color: '#94a3b8', marginLeft: 10 },
  faqAnswerBox: { paddingTop: 8, paddingRight: 28 },
  faqAnswer: { fontSize: 13, color: '#475569', lineHeight: 19 },

  noResults: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 32,
    alignItems: 'center',
  },
  noResultsIcon: { fontSize: 36, marginBottom: 8 },
  noResultsText: { fontSize: 13, color: '#64748b', textAlign: 'center', paddingHorizontal: 30 },

  contactList: {},
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  contactIconBox: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  contactIcon: { fontSize: 18 },
  contactTextBox: { flex: 1 },
  contactType: { fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 2 },
  contactValue: { fontSize: 14, fontWeight: '500', color: '#1e293b' },
  contactChevron: { fontSize: 22, color: '#cbd5e1' },

  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E0',
    borderWidth: 1.5,
    borderColor: '#FFB74D',
    borderRadius: 14,
    paddingVertical: 14,
    marginHorizontal: 15,
    marginTop: 8,
  },
  reportIcon: { fontSize: 18, marginRight: 8 },
  reportText: { fontSize: 14, fontWeight: '600', color: '#E65100' },
});
