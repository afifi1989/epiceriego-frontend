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
import { useLanguage } from '../../src/context/LanguageContext';
import helpSupportService, {
  ContactInfo,
  HelpCategory,
  HelpPage,
} from '../../src/services/helpSupportService';

// ─── Quick-start steps (static, always displayed) ────────────────────────────
const QUICK_STEPS = [
  { icon: '🏪', labelKey: 'help.step1' },
  { icon: '🛒', labelKey: 'help.step2' },
  { icon: '🛍️', labelKey: 'help.step3' },
  { icon: '🚚', labelKey: 'help.step4' },
];

const STEP_LABELS: Record<string, Record<string, string>> = {
  'help.step1': { fr: 'Trouver une épicerie', ar: 'اختر متجرك', en: 'Find a store' },
  'help.step2': { fr: 'Parcourir les produits', ar: 'تصفح المنتجات', en: 'Browse products' },
  'help.step3': { fr: 'Ajouter au panier', ar: 'أضف للسلة', en: 'Add to cart' },
  'help.step4': { fr: 'Suivre la livraison', ar: 'تابع التوصيل', en: 'Track delivery' },
};

// ─── Single FAQ item with animated expand ────────────────────────────────────
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
  const animHeight = useRef(new Animated.Value(0)).current;
  const animRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(animHeight, {
        toValue: isOpen ? 1 : 0,
        duration: 260,
        useNativeDriver: false,
      }),
      Animated.timing(animRotate, {
        toValue: isOpen ? 1 : 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isOpen]);

  const rotate = animRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onToggle} style={styles.faqItem}>
      <View style={styles.faqHeader}>
        <Text style={styles.faqQuestion}>{question}</Text>
        <Animated.Text style={[styles.faqChevron, { transform: [{ rotate }] }]}>
          ›
        </Animated.Text>
      </View>
      {isOpen && (
        <View style={styles.faqAnswerBox}>
          <Text style={styles.faqAnswer}>{answer}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Category accordion ───────────────────────────────────────────────────────
function CategorySection({
  category,
  query,
}: {
  category: HelpCategory;
  query: string;
}) {
  const [openId, setOpenId] = useState<number | null>(null);

  const filtered = category.articles.filter(
    (a) =>
      a.question.toLowerCase().includes(query.toLowerCase()) ||
      a.answer.toLowerCase().includes(query.toLowerCase()),
  );

  if (filtered.length === 0) return null;

  return (
    <View style={styles.categorySection}>
      <View style={[styles.categoryHeader, { borderLeftColor: category.color }]}>
        <Text style={styles.categoryIcon}>{category.icon}</Text>
        <Text style={styles.categoryName}>{category.name}</Text>
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

// ─── Contact action button ────────────────────────────────────────────────────
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
        Linking.openURL(`mailto:${val}`);
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
      <Text style={styles.contactValue}>{contact.value}</Text>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function AideSupportScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [helpPage, setHelpPage] = useState<HelpPage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadHelpPage();
  }, []);

  const loadHelpPage = async () => {
    try {
      const data = await helpSupportService.getHelpPage();
      setHelpPage(data);
    } catch (error) {
      console.error('[AideSupport] Erreur chargement:', error);
      Alert.alert(t('common.error'), t('common.networkError'));
    } finally {
      setLoading(false);
    }
  };

  const handleReport = () => {
    Alert.alert(
      t('help.reportTitle'),
      t('help.reportMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('help.reportContact'),
          onPress: () => {
            const email = helpPage?.contactInfo.find((c) => c.type === 'EMAIL');
            if (email) Linking.openURL(`mailto:${email.value}?subject=Signalement problème`);
          },
        },
      ],
    );
  };

  const lang = language || 'fr';

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile.helpSupport')}</Text>
        <Text style={styles.headerSubtitle}>{t('help.subtitle')}</Text>

        {/* Search */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={t('help.searchPlaceholder')}
            placeholderTextColor="#a0c4a0"
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

      {/* ── Guide de démarrage rapide ── */}
      {searchQuery.length === 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('help.quickGuide')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stepsRow}>
            {QUICK_STEPS.map((step, index) => (
              <View key={step.labelKey} style={styles.stepCard}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNum}>{index + 1}</Text>
                </View>
                <Text style={styles.stepIcon}>{step.icon}</Text>
                <Text style={styles.stepLabel}>
                  {STEP_LABELS[step.labelKey]?.[lang] ?? STEP_LABELS[step.labelKey]?.fr}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── FAQ ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {searchQuery.length > 0 ? t('help.searchResults') : t('help.faqTitle')}
        </Text>

        {helpPage?.categories.map((cat) => (
          <CategorySection key={cat.id} category={cat} query={searchQuery} />
        ))}

        {searchQuery.length > 0 &&
          helpPage?.categories.every(
            (cat) =>
              !cat.articles.some(
                (a) =>
                  a.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  a.answer.toLowerCase().includes(searchQuery.toLowerCase()),
              ),
          ) && (
            <View style={styles.noResults}>
              <Text style={styles.noResultsIcon}>🤔</Text>
              <Text style={styles.noResultsText}>{t('help.noResults')}</Text>
            </View>
          )}
      </View>

      {/* ── Nous contacter ── */}
      {searchQuery.length === 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('help.contactTitle')}</Text>
          <View style={styles.contactList}>
            {helpPage?.contactInfo.map((contact) => (
              <ContactButton key={contact.id} contact={contact} />
            ))}
          </View>
        </View>
      )}

      {/* ── Signaler un problème ── */}
      {searchQuery.length === 0 && (
        <TouchableOpacity style={styles.reportBtn} onPress={handleReport} activeOpacity={0.8}>
          <Text style={styles.reportIcon}>🚩</Text>
          <Text style={styles.reportText}>{t('help.reportIssue')}</Text>
        </TouchableOpacity>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('app.version')}</Text>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },

  // Header
  header: {
    backgroundColor: '#4CAF50',
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  backBtn: {
    marginBottom: 8,
  },
  backText: {
    fontSize: 30,
    color: '#fff',
    fontWeight: 'bold',
    lineHeight: 32,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 20,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
  },
  clearIcon: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 4,
  },

  // Sections
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#222',
    marginBottom: 14,
  },

  // Quick steps
  stepsRow: {
    marginBottom: 8,
  },
  stepCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginRight: 12,
    width: 110,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  stepNum: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  stepLabel: {
    fontSize: 12,
    color: '#444',
    textAlign: 'center',
    lineHeight: 16,
    fontWeight: '500',
  },

  // Category FAQ
  categorySection: {
    marginBottom: 18,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingLeft: 12,
    borderLeftWidth: 3,
  },
  categoryIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  faqList: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    flex: 1,
    paddingRight: 10,
    lineHeight: 20,
  },
  faqChevron: {
    fontSize: 22,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  faqAnswerBox: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
    backgroundColor: '#fafff8',
    borderTopWidth: 1,
    borderTopColor: '#e8f5e9',
  },
  faqAnswer: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
  },

  // No results
  noResults: {
    alignItems: 'center',
    padding: 40,
  },
  noResultsIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  noResultsText: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
  },

  // Contact
  contactList: {
    gap: 12,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  contactIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  contactIcon: {
    fontSize: 22,
  },
  contactValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
  },

  // Report
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#ffcccc',
  },
  reportIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  reportText: {
    fontSize: 14,
    color: '#e53935',
    fontWeight: '600',
  },

  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#bbb',
  },
});
