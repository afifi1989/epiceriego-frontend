import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useToast } from '../../src/components/feedback';
import {
  CreateSupplierRequest,
  SUPPLIER_TYPE_EMOJI,
  SUPPLIER_TYPE_LABELS_FR,
  SupplierType,
  supplierService,
} from '../../src/services/supplierService';
import { useRequirePermission } from '../../src/hooks/useRequirePermission';

const TYPES: SupplierType[] = ['FOOD', 'BEVERAGE', 'HOUSEHOLD', 'OTHER'];

/**
 * Formulaire unifie creation / edition d'un fournisseur.
 *
 * <p>Mode determine par le parametre URL {@code id} :
 * - {@code id} absent : creation (POST /api/suppliers)
 * - {@code id} present : edition (PUT /api/suppliers/{id})</p>
 *
 * <p>UI epicier mobile FR uniquement.</p>
 */
export default function FournisseurFormScreen() {
  const ready = useRequirePermission('suppliers:manage');
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : null;
  const isEdit = editId != null;

  // ── Form state ─────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [supplierType, setSupplierType] = useState<SupplierType | null>(null);
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [iban, setIban] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [notes, setNotes] = useState('');

  // Attachment : URI locale (selection en cours) OU URL backend (deja persisted).
  const [attachmentLocalUri, setAttachmentLocalUri] = useState<string | null>(null);
  const [attachmentRemoteUrl, setAttachmentRemoteUrl] = useState<string | null>(null);

  const [loadingInitial, setLoadingInitial] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // ── Edit : chargement initial ──────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    if (!isEdit) return;
    let cancelled = false;
    (async () => {
      setLoadingInitial(true);
      try {
        const s = await supplierService.getById(editId!);
        if (cancelled) return;
        setName(s.name);
        setSupplierType(s.supplierType ?? null);
        setContactName(s.contactName ?? '');
        setPhone(s.phone ?? '');
        setEmail(s.email ?? '');
        setIban(s.iban ?? '');
        setPaymentTerms(s.paymentTerms ?? '');
        setNotes(s.notes ?? '');
        setAttachmentRemoteUrl(s.attachmentUrl ?? null);
      } catch (err: any) {
        toast.error('Erreur', String(err));
        router.back();
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    })();
    return () => { cancelled = true; };
  }, [editId, isEdit, ready, router, toast]);

  // ── Validation ─────────────────────────────────────────────────────────
  const validate = useCallback((): string | null => {
    if (!name.trim()) return 'Le nom est obligatoire';
    if (name.length > 255) return 'Nom trop long';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return 'Email invalide';
    }
    return null;
  }, [name, email]);

  // ── Image picker ──────────────────────────────────────────────────────
  const pickAttachment = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission refusée', 'Autorisez l\'accès aux photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled) {
        setAttachmentLocalUri(result.assets[0].uri);
      }
    } catch {
      toast.error('Erreur', 'Sélection d\'image impossible');
    }
  }, [toast]);

  // ── Save ──────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const err = validate();
    if (err) {
      toast.warning('Validation', err);
      return;
    }

    const payload: CreateSupplierRequest = {
      name: name.trim(),
      supplierType: supplierType,
      contactName: contactName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      iban: iban.trim(),
      paymentTerms: paymentTerms.trim(),
      notes: notes.trim(),
    };

    setSaving(true);
    try {
      let supplier;
      if (isEdit) {
        supplier = await supplierService.update(editId!, payload);
      } else {
        supplier = await supplierService.create(payload);
      }

      // V96 — Si l'utilisateur a selectionne une image locale, upload apres
      // create/update. L'upload se fait via fetch (cf. SSL note) et echoue
      // gracieusement sans bloquer la sauvegarde des autres champs.
      if (attachmentLocalUri) {
        setUploadingPhoto(true);
        try {
          await supplierService.uploadAttachment(supplier.id, attachmentLocalUri);
        } catch (uploadErr) {
          toast.warning('Pièce jointe', 'Le fournisseur est enregistré mais l\'upload de l\'image a échoué.');
        } finally {
          setUploadingPhoto(false);
        }
      }

      toast.success('OK', isEdit ? 'Fournisseur mis à jour' : 'Fournisseur créé');
      router.back();
    } catch (e: any) {
      if (!e?.__subscriptionGateHandled) {
        toast.error('Erreur', e?.response?.data?.message ?? e?.message ?? String(e));
      }
    } finally {
      setSaving(false);
    }
  }, [validate, name, supplierType, contactName, phone, email, iban, paymentTerms, notes,
      isEdit, editId, attachmentLocalUri, router, toast]);

  if (!ready) return null;

  if (loadingInitial) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  const previewUri = attachmentLocalUri ?? attachmentRemoteUrl;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* SECTION 1 — Identite */}
        <Text style={styles.sectionTitle}>Identité</Text>

        <Text style={styles.fieldLabel}>Nom *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ex: Bim Maroc"
          placeholderTextColor="#aaa"
          maxLength={255}
          editable={!saving}
        />

        <Text style={styles.fieldLabel}>Catégorie</Text>
        <View style={styles.typeRow}>
          {TYPES.map(t => {
            const active = supplierType === t;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.typeBtn, active && styles.typeBtnActive]}
                onPress={() => setSupplierType(active ? null : t)}
                activeOpacity={0.7}
              >
                <Text style={styles.typeEmoji}>{SUPPLIER_TYPE_EMOJI[t]}</Text>
                <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>
                  {SUPPLIER_TYPE_LABELS_FR[t]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* SECTION 2 — Contact */}
        <Text style={styles.sectionTitle}>Contact</Text>

        <Text style={styles.fieldLabel}>Personne contact</Text>
        <TextInput
          style={styles.input}
          value={contactName}
          onChangeText={setContactName}
          placeholder="Ex: M. Hassan"
          placeholderTextColor="#aaa"
          maxLength={150}
          editable={!saving}
        />

        <View style={styles.row2}>
          <View style={styles.col}>
            <Text style={styles.fieldLabel}>Téléphone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="06 12 34 56 78"
              placeholderTextColor="#aaa"
              keyboardType="phone-pad"
              maxLength={30}
              editable={!saving}
            />
          </View>
          <View style={styles.col}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="contact@..."
              placeholderTextColor="#aaa"
              keyboardType="email-address"
              autoCapitalize="none"
              maxLength={150}
              editable={!saving}
            />
          </View>
        </View>

        {/* SECTION 3 — Bancaire / commercial */}
        <Text style={styles.sectionTitle}>Bancaire & commercial</Text>

        <Text style={styles.fieldLabel}>IBAN (optionnel)</Text>
        <TextInput
          style={[styles.input, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}
          value={iban}
          onChangeText={setIban}
          placeholder="MA64 XXX..."
          placeholderTextColor="#aaa"
          autoCapitalize="characters"
          maxLength={40}
          editable={!saving}
        />

        <Text style={styles.fieldLabel}>Conditions de paiement</Text>
        <TextInput
          style={styles.input}
          value={paymentTerms}
          onChangeText={setPaymentTerms}
          placeholder="Ex: 30 jours net, à la livraison..."
          placeholderTextColor="#aaa"
          maxLength={100}
          editable={!saving}
        />

        {/* SECTION 4 — Notes */}
        <Text style={styles.sectionTitle}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes libres (jours de livraison, particularités...)"
          placeholderTextColor="#aaa"
          multiline
          numberOfLines={3}
          editable={!saving}
        />

        {/* SECTION 5 — Pièce jointe */}
        <Text style={styles.sectionTitle}>Pièce jointe</Text>
        <Text style={styles.sectionHint}>Carte de visite scannée, RIB photo, contrat...</Text>

        <TouchableOpacity style={styles.attachBtn} onPress={pickAttachment} disabled={saving}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.attachPreview} resizeMode="cover" />
          ) : (
            <View style={styles.attachPlaceholder}>
              <Text style={styles.attachPlaceholderIcon}>📎</Text>
              <Text style={styles.attachPlaceholderText}>Ajouter une image</Text>
            </View>
          )}
        </TouchableOpacity>
        {previewUri && (
          <TouchableOpacity
            onPress={() => { setAttachmentLocalUri(null); setAttachmentRemoteUrl(null); }}
            disabled={saving}
          >
            <Text style={styles.attachRemove}>Retirer l'image</Text>
          </TouchableOpacity>
        )}

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, (saving || uploadingPhoto) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving || uploadingPhoto}
          activeOpacity={0.85}
        >
          {(saving || uploadingPhoto)
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>{isEdit ? 'Enregistrer' : 'Créer le fournisseur'}</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' },
  scroll: { padding: 16, paddingBottom: 32 },

  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#444',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: 18, marginBottom: 8,
  },
  sectionHint: { fontSize: 12, color: '#888', marginBottom: 8 },

  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#666', marginTop: 8, marginBottom: 4 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#e0e0e0',
    fontSize: 14, color: '#222',
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },

  row2: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },

  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1, borderColor: '#e0e0e0',
    gap: 6,
  },
  typeBtnActive: { borderColor: '#2196F3', backgroundColor: '#e3f2fd' },
  typeEmoji: { fontSize: 16 },
  typeLabel: { fontSize: 13, color: '#666', fontWeight: '600' },
  typeLabelActive: { color: '#1565c0' },

  attachBtn: {
    height: 160,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1, borderStyle: 'dashed', borderColor: '#bbb',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  attachPreview: { width: '100%', height: '100%' },
  attachPlaceholder: { alignItems: 'center' },
  attachPlaceholderIcon: { fontSize: 36, marginBottom: 6 },
  attachPlaceholderText: { fontSize: 13, color: '#999', fontWeight: '600' },
  attachRemove: {
    fontSize: 12, color: '#c62828', marginTop: 6,
    textAlign: 'center', fontWeight: '600',
  },

  saveBtn: {
    marginTop: 24, paddingVertical: 14,
    backgroundColor: '#2196F3', borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#90caf9' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
