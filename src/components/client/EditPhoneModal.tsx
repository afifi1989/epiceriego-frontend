/**
 * EditPhoneModal — Ajout / modification du numero de telephone du user, en 2
 * etapes :
 *   1. Saisie du numero -> envoi du SMS OTP
 *   2. Saisie du code recu -> validation et update du profil
 *
 * Le backend protege le flow (POST /users/me/phone/request-otp puis verify),
 * un user ne peut pas reclamer le numero d'un autre compte verifie.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { phoneChangeService } from '../../services/phoneChangeService';
import { User } from '../../type';

const GREEN = '#4CAF50';

/**
 * Compare deux numeros de telephone en tolerant les differences de format
 * (espaces, tirets, parentheses, prefixe local 0… vs international +212…).
 *
 * <p>On compare les chiffres bruts, puis en repli le numero national
 * significatif (9 derniers chiffres) pour reconnaitre "+212660571796" et
 * "0660571796" comme identiques. Suffisant pour eviter d'envoyer un OTP
 * inutile quand le client ressaisit son propre numero.</p>
 */
const samePhoneNumber = (a?: string, b?: string): boolean => {
  const da = (a ?? '').replace(/\D/g, '');
  const db = (b ?? '').replace(/\D/g, '');
  if (!da || !db) return false;
  if (da === db) return true;
  return da.length >= 9 && db.length >= 9 && da.slice(-9) === db.slice(-9);
};

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Numero actuel (pre-rempli si dispo). */
  currentPhone?: string;
  /** Callback apres update reussi avec le profil rafraichi. */
  onSuccess: (updatedUser: User) => void;
}

type Step = 'phone' | 'otp';

export function EditPhoneModal({ visible, onClose, currentPhone, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState(currentPhone ?? '');
  const [code, setCode] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Pour permettre de revenir a step 1 si le user s'est trompe de numero.
  const [sentToPhone, setSentToPhone] = useState('');

  // Vrai si le numero saisi est deja celui enregistre : on bloque alors l'envoi
  // d'OTP (inutile) cote bouton + message. Le champ est pre-rempli avec le
  // numero actuel, donc le bouton reste inactif tant que rien n'est modifie.
  const isSameAsCurrent = samePhoneNumber(phone, currentPhone);

  const resetAndClose = () => {
    setStep('phone');
    setPhone(currentPhone ?? '');
    setCode('');
    setToken(null);
    setSentToPhone('');
    setLoading(false);
    onClose();
  };

  const handleRequestOtp = async () => {
    const cleaned = phone.trim();
    if (!cleaned || cleaned.length < 6) {
      Alert.alert('Erreur', 'Entrez un numero valide (incluez le prefixe pays, ex: +33...).');
      return;
    }
    // Garde-fou : inutile d'envoyer un OTP si le numero saisi est deja celui
    // enregistre (comparaison tolerante aux formats local/international).
    if (samePhoneNumber(cleaned, currentPhone)) {
      Alert.alert(
        'Numero identique',
        "C'est deja votre numero actuel — aucun changement necessaire, pas besoin de code.",
      );
      return;
    }
    setLoading(true);
    try {
      const resp = await phoneChangeService.requestOtp(cleaned);
      setToken(resp.token);
      setSentToPhone(cleaned);
      setStep('otp');
    } catch (err: any) {
      const msg = err?.response?.data?.message
        || err?.response?.data?.error
        || err?.message
        || 'Impossible d\'envoyer le code';
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const trimmed = code.trim();
    if (!trimmed || trimmed.length < 4) {
      Alert.alert('Erreur', 'Entrez le code recu par SMS.');
      return;
    }
    if (!token) {
      Alert.alert('Erreur', 'Session expiree, demandez un nouveau code.');
      setStep('phone');
      return;
    }
    setLoading(true);
    try {
      const updated = await phoneChangeService.verifyOtp(token, trimmed);
      Alert.alert('Numero verifie', `Votre numero ${sentToPhone} a ete confirme.`);
      onSuccess(updated);
      resetAndClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message
        || err?.response?.data?.error
        || err?.message
        || 'Code incorrect';
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!sentToPhone) return;
    setLoading(true);
    try {
      const resp = await phoneChangeService.requestOtp(sentToPhone);
      setToken(resp.token);
      Alert.alert('Code renvoye', 'Un nouveau SMS a ete envoye.');
    } catch (err: any) {
      const msg = err?.response?.data?.message
        || err?.message
        || 'Impossible de renvoyer le code';
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetAndClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {step === 'phone' ? 'Numero de telephone' : 'Code de verification'}
            </Text>
            <TouchableOpacity onPress={resetAndClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={26} color="#333" />
            </TouchableOpacity>
          </View>

          {step === 'phone' ? (
            <View style={styles.body}>
              <Text style={styles.helpText}>
                Ajoutez ou modifiez votre numero. Vous recevrez un code SMS sur
                ce numero pour confirmer qu'il vous appartient.
              </Text>

              <Text style={styles.fieldLabel}>Numero (avec prefixe pays)</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="+33 6 60 57 17 96"
                placeholderTextColor="#bbb"
                autoFocus
                editable={!loading}
              />

              {isSameAsCurrent ? (
                <Text style={styles.sameHint}>
                  C'est deja votre numero actuel. Modifiez-le pour recevoir un code.
                </Text>
              ) : (
                <Text style={styles.hint}>
                  Format international recommande pour eviter toute ambiguite
                  (ex: +33 pour la France, +212 pour le Maroc).
                </Text>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, (loading || isSameAsCurrent) && styles.btnDisabled]}
                onPress={handleRequestOtp}
                disabled={loading || isSameAsCurrent}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Envoyer le code</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.body}>
              <Text style={styles.helpText}>
                Un code a 6 chiffres a ete envoye au <Text style={{ fontWeight: '700' }}>{sentToPhone}</Text>.
                Saisissez-le ci-dessous pour confirmer.
              </Text>

              <Text style={styles.fieldLabel}>Code recu par SMS</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={code}
                onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
                keyboardType="number-pad"
                placeholder="123456"
                placeholderTextColor="#ccc"
                autoFocus
                maxLength={6}
                editable={!loading}
              />

              <View style={styles.linkRow}>
                <TouchableOpacity onPress={() => { setStep('phone'); setCode(''); }} disabled={loading}>
                  <Text style={styles.linkText}>‹ Changer le numero</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleResend} disabled={loading}>
                  <Text style={styles.linkText}>Renvoyer le code</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, (loading || code.length < 4) && styles.btnDisabled]}
                onPress={handleVerifyOtp}
                disabled={loading || code.length < 4}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Verifier</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#222' },
  body: { padding: 18, gap: 14 },
  helpText: { fontSize: 14, color: '#555', lineHeight: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 4 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 14,
    fontSize: 16,
    color: '#222',
  },
  codeInput: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 8,
  },
  hint: { fontSize: 12, color: '#999', lineHeight: 16 },
  sameHint: { fontSize: 12, color: '#E65100', lineHeight: 16, fontWeight: '600' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 4,
  },
  linkText: { color: GREEN, fontSize: 13, fontWeight: '600' },
});
