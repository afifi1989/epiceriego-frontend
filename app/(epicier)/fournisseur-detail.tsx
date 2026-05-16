import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useToast } from '../../src/components/feedback';
import {
  Supplier,
  SupplierBatchSummary,
  SUPPLIER_TYPE_EMOJI,
  SUPPLIER_TYPE_LABELS_FR,
  SupplierType,
  supplierService,
} from '../../src/services/supplierService';
import { useRequirePermission } from '../../src/hooks/useRequirePermission';

/**
 * Detail d'un fournisseur (V96).
 *
 * <p>UI epicier mobile FR uniquement.</p>
 *
 * <h2>Layout</h2>
 * <ol>
 *   <li>Header avec image attachement + nom + type + status badge</li>
 *   <li>Bandeau d'actions rapides : Appeler · Email · Modifier · Archiver/Réactiver</li>
 *   <li>Sections : Infos contact · Bancaire · Notes · Historique batches</li>
 * </ol>
 *
 * <p>L'historique des batches est chargee paresseusement (premiere page
 * sur le mount). La pagination peut etre etendue plus tard si besoin.</p>
 */
export default function FournisseurDetailScreen() {
  const ready = useRequirePermission('suppliers:manage');
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ? Number(params.id) : null;

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [batches, setBatches] = useState<SupplierBatchSummary[]>([]);
  const [batchTotal, setBatchTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (id == null) return;
    try {
      const [s, batchPage] = await Promise.allSettled([
        supplierService.getById(id),
        supplierService.getBatches(id, 0, 10),
      ]);
      if (s.status === 'fulfilled') setSupplier(s.value);
      else throw s.reason;
      if (batchPage.status === 'fulfilled') {
        setBatches(batchPage.value.content);
        setBatchTotal(batchPage.value.totalElements);
      }
    } catch (err: any) {
      toast.error('Erreur', String(err));
      router.back();
    }
  }, [id, router, toast]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      let cancelled = false;
      (async () => {
        setLoading(true);
        await fetchData();
        if (!cancelled) setLoading(false);
      })();
      return () => { cancelled = true; };
    }, [ready, fetchData]),
  );

  const handleCall = useCallback(() => {
    if (!supplier?.phone) return;
    const cleaned = supplier.phone.replace(/[^\d+]/g, '');
    Linking.openURL(`tel:${cleaned}`).catch(() => toast.error('Erreur', 'Impossible d\'appeler'));
  }, [supplier, toast]);

  const handleEmail = useCallback(() => {
    if (!supplier?.email) return;
    Linking.openURL(`mailto:${supplier.email}`).catch(() => toast.error('Erreur', 'Impossible d\'envoyer'));
  }, [supplier, toast]);

  const handleEdit = useCallback(() => {
    if (!supplier) return;
    router.push({
      pathname: '/(epicier)/fournisseur-form' as any,
      params: { id: String(supplier.id) },
    });
  }, [supplier, router]);

  const handleToggleStatus = useCallback(() => {
    if (!supplier) return;
    const willArchive = supplier.status === 'ACTIVE';
    Alert.alert(
      willArchive ? 'Archiver ce fournisseur ?' : 'Réactiver ce fournisseur ?',
      willArchive
        ? 'Il sera caché des listes actives mais l\'historique sera préservé. Vous pourrez le réactiver à tout moment.'
        : 'Il sera de nouveau disponible dans les listes et l\'autocomplete des réceptions.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: willArchive ? 'Archiver' : 'Réactiver',
          style: willArchive ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const updated = willArchive
                ? await supplierService.archive(supplier.id)
                : await supplierService.reactivate(supplier.id);
              setSupplier(updated);
              toast.success('OK', willArchive ? 'Archivé' : 'Réactivé');
            } catch (err: any) {
              toast.error('Erreur', String(err));
            }
          },
        },
      ],
    );
  }, [supplier, toast]);

  const handleDelete = useCallback(() => {
    if (!supplier) return;
    Alert.alert(
      'Supprimer ce fournisseur ?',
      'Si des réceptions ont été enregistrées chez ce fournisseur, la suppression sera refusée. Préférez l\'archivage.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await supplierService.remove(supplier.id);
              toast.success('Supprimé', supplier.name);
              router.back();
            } catch (err: any) {
              toast.error('Refusé', String(err));
            }
          },
        },
      ],
    );
  }, [supplier, router, toast]);

  if (!ready) return null;

  if (loading || !supplier) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  const emoji = supplier.supplierType
    ? SUPPLIER_TYPE_EMOJI[supplier.supplierType as SupplierType]
    : '🏪';
  const typeLabel = supplier.supplierType
    ? SUPPLIER_TYPE_LABELS_FR[supplier.supplierType as SupplierType]
    : null;
  const isArchived = supplier.status === 'ARCHIVED';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header avec image */}
      <View style={[styles.header, isArchived && styles.headerArchived]}>
        {supplier.attachmentUrl ? (
          <Image
            source={{ uri: supplier.attachmentUrl }}
            style={styles.headerImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.headerImagePlaceholder}>
            <Text style={styles.headerEmoji}>{emoji}</Text>
          </View>
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={2}>{supplier.name}</Text>
          <View style={styles.headerMetaRow}>
            {typeLabel && (
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{emoji} {typeLabel}</Text>
              </View>
            )}
            {isArchived && (
              <View style={styles.archivedBadge}>
                <Text style={styles.archivedBadgeText}>📦 Archivé</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Actions rapides */}
      <View style={styles.actionsRow}>
        <ActionBtn icon="📞" label="Appeler" onPress={handleCall} disabled={!supplier.phone} />
        <ActionBtn icon="✉️" label="Email"   onPress={handleEmail} disabled={!supplier.email} />
        <ActionBtn icon="✏️" label="Modifier" onPress={handleEdit} />
        <ActionBtn
          icon={isArchived ? '✅' : '📦'}
          label={isArchived ? 'Réactiver' : 'Archiver'}
          onPress={handleToggleStatus}
        />
      </View>

      {/* Contact */}
      <Section title="Contact">
        <InfoRow label="Personne contact" value={supplier.contactName} />
        <InfoRow label="Téléphone" value={supplier.phone} />
        <InfoRow label="Email" value={supplier.email} />
      </Section>

      {/* Bancaire / Commercial */}
      <Section title="Bancaire & commercial">
        <InfoRow label="IBAN" value={supplier.iban} mono />
        <InfoRow label="Conditions de paiement" value={supplier.paymentTerms} />
      </Section>

      {/* Notes */}
      {supplier.notes ? (
        <Section title="Notes">
          <Text style={styles.notesText}>{supplier.notes}</Text>
        </Section>
      ) : null}

      {/* Historique batches */}
      <Section title={`Historique des réceptions (${batchTotal})`}>
        {batches.length === 0 ? (
          <Text style={styles.emptyBatchText}>Aucune réception enregistrée chez ce fournisseur.</Text>
        ) : (
          batches.map(b => (
            <View key={b.batchId} style={styles.batchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.batchTitle}>
                  Lot #{b.batchId} · {b.quantityInitial ?? '?'} unité{(b.quantityInitial ?? 0) > 1 ? 's' : ''}
                </Text>
                <Text style={styles.batchMeta}>
                  📅 {b.receivedAt ?? '—'}
                  {b.expiryDate ? `  ·  ⏳ DLC ${b.expiryDate}` : ''}
                </Text>
                {b.supplierInvoice ? (
                  <Text style={styles.batchMeta}>🧾 {b.supplierInvoice}</Text>
                ) : null}
              </View>
              {b.unitCost != null && (
                <Text style={styles.batchCost}>{b.unitCost.toFixed(2)} DH/u</Text>
              )}
            </View>
          ))
        )}
      </Section>

      {/* Suppression (rouge, en bas) */}
      {!isArchived && (
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>🗑️ Supprimer définitivement</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

function ActionBtn({ icon, label, onPress, disabled }: {
  icon: string; label: string; onPress: () => void; disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, disabled && styles.actionBtnDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={[styles.actionIcon, disabled && { opacity: 0.4 }]}>{icon}</Text>
      <Text style={[styles.actionLabel, disabled && { opacity: 0.4 }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, mono && { fontFamily: 'Courier' }]}>
        {value && value.trim() ? value : '—'}
      </Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' },

  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    gap: 14,
  },
  headerArchived: { backgroundColor: '#f5f5f5' },
  headerImage: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#eee' },
  headerImagePlaceholder: {
    width: 80, height: 80, borderRadius: 12,
    backgroundColor: '#E3F2FD',
    alignItems: 'center', justifyContent: 'center',
  },
  headerEmoji: { fontSize: 36 },
  headerInfo: { flex: 1, justifyContent: 'center' },
  headerName: { fontSize: 18, fontWeight: '800', color: '#222' },
  headerMetaRow: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  typeBadge: {
    backgroundColor: '#e3f2fd',
    paddingVertical: 4, paddingHorizontal: 10,
    borderRadius: 12,
  },
  typeBadgeText: { fontSize: 12, color: '#1565c0', fontWeight: '600' },
  archivedBadge: {
    backgroundColor: '#eeeeee',
    paddingVertical: 4, paddingHorizontal: 10,
    borderRadius: 12,
  },
  archivedBadgeText: { fontSize: 12, color: '#666', fontWeight: '600' },

  actionsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e0e0e0',
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  actionBtnDisabled: {},
  actionIcon: { fontSize: 22 },
  actionLabel: { fontSize: 11, color: '#555', fontWeight: '600', marginTop: 4 },

  section: { marginTop: 12 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#888',
    textTransform: 'uppercase', letterSpacing: 0.5,
    paddingHorizontal: 16, marginBottom: 6,
  },
  sectionBody: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8 },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: { fontSize: 13, color: '#666' },
  infoValue: { fontSize: 13, color: '#222', fontWeight: '600', maxWidth: '60%', textAlign: 'right' },

  notesText: { fontSize: 13, color: '#444', lineHeight: 18, paddingVertical: 6 },

  emptyBatchText: { fontSize: 12, color: '#999', fontStyle: 'italic', paddingVertical: 8 },

  batchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  batchTitle: { fontSize: 13, fontWeight: '700', color: '#222' },
  batchMeta: { fontSize: 11, color: '#777', marginTop: 2 },
  batchCost: { fontSize: 13, color: '#2e7d32', fontWeight: '700' },

  deleteBtn: {
    marginTop: 24,
    marginHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffcdd2',
    alignItems: 'center',
  },
  deleteBtnText: { color: '#c62828', fontWeight: '700', fontSize: 14 },
});
