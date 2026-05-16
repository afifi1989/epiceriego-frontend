import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import {
  AppliedPromoCode,
  PromoCodeChannel,
  PromoCodeRejectionReason,
  promoCodeService,
} from '../../services/promoCodeService';
import { Currency } from '../../type';
import { formatPrice } from '../../utils/helpers';

/**
 * Composant reutilisable de saisie d'un code promo.
 *
 * <p>Encapsule trois etats UI :
 * <ol>
 *   <li><strong>Vierge</strong> : input + bouton "Appliquer"</li>
 *   <li><strong>Loading</strong> : input desactive, spinner sur le bouton</li>
 *   <li><strong>Applique</strong> : pilule verte avec code + montant, bouton "Retirer"</li>
 * </ol>
 *
 * <h2>Architecture</h2>
 * Le composant est <strong>controle</strong> par le parent via la prop {@code value}.
 * Le parent gere le state applique (typiquement un useState dans cart.tsx) et
 * recoit les notifications via {@code onApplied} / {@code onRemoved}. Ce
 * decouplage permet :
 * <ul>
 *   <li>Au parent de transmettre {@code value.code} dans la requete de creation
 *       de commande sans avoir a interroger le composant.</li>
 *   <li>Au composant d'etre reutilise cote POS (vente-directe epicier) avec
 *       le meme contrat.</li>
 * </ul>
 *
 * <h2>Auto-revalidation</h2>
 * Quand le subtotal change apres application (panier modifie), le composant
 * re-valide automatiquement apres 700ms de debouncing. Si le code devient
 * invalide (ex: MIN_AMOUNT_NOT_MET car panier descendu sous le seuil), le
 * code est retire et un toast d'erreur s'affiche.
 */
export interface PromoCodeInputProps {
  /** Identifiant de l'epicerie (scope multi-tenant). */
  epicerieId: number;

  /** Subtotal panier hors livraison, dans la devise de l'epicerie. */
  subtotal: number;

  /** Defaut: 'APP'. Le POS epicier envoie 'POS'. */
  channel?: PromoCodeChannel;

  /** Code applique courant ; null = aucun. */
  value: AppliedPromoCode | null;

  /** Notifie le parent qu'un code vient d'etre applique. */
  onApplied: (applied: AppliedPromoCode) => void;

  /** Notifie le parent du retrait du code (manuel ou auto-invalidation). */
  onRemoved: () => void;

  /** Devise pour formatter le montant de la remise. */
  currency?: Currency | null;

  /** Desactive l'interaction (ex: pendant un order submit). */
  disabled?: boolean;
}

/** Debounce de la re-validation auto sur changement de subtotal (ms). */
const REVALIDATE_DEBOUNCE_MS = 700;

export default function PromoCodeInput(props: PromoCodeInputProps) {
  const { t } = useLanguage();
  const {
    epicerieId,
    subtotal,
    channel = 'APP',
    value,
    onApplied,
    onRemoved,
    currency,
    disabled = false,
  } = props;

  const [inputCode, setInputCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorReason, setErrorReason] = useState<PromoCodeRejectionReason | 'NETWORK' | null>(null);

  const revalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-revalidation : si le subtotal change pendant qu'un code est applique,
  // on re-verifie apres debouncing. Si la revalidation echoue (ex: MIN_AMOUNT
  // non atteint), on retire le code et expose la raison.
  useEffect(() => {
    if (!value) return;
    if (revalidateTimerRef.current) clearTimeout(revalidateTimerRef.current);

    revalidateTimerRef.current = setTimeout(async () => {
      try {
        const resp = await promoCodeService.validate({
          epicerieId,
          code: value.code,
          subtotal,
          channel,
        });
        if (!resp.valid) {
          setErrorReason(resp.reason ?? 'INVALID');
          onRemoved();
        } else if (Math.abs(resp.discountAmount - value.discountAmount) > 0.01) {
          // Montant change (ex: cap PERCENT atteint different) — refresh.
          onApplied({ code: resp.code, discountAmount: resp.discountAmount });
        }
      } catch {
        // Reseau : on ne retire pas le code (le serveur tranchera au checkout).
      }
    }, REVALIDATE_DEBOUNCE_MS);

    return () => {
      if (revalidateTimerRef.current) clearTimeout(revalidateTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  const handleApply = useCallback(async () => {
    const trimmed = inputCode.trim();
    if (!trimmed) return;
    setLoading(true);
    setErrorReason(null);
    try {
      const resp = await promoCodeService.validate({
        epicerieId,
        code: trimmed,
        subtotal,
        channel,
      });
      if (resp.valid) {
        onApplied({ code: resp.code, discountAmount: resp.discountAmount });
        setInputCode('');
      } else {
        setErrorReason(resp.reason ?? 'INVALID');
      }
    } catch {
      setErrorReason('NETWORK');
    } finally {
      setLoading(false);
    }
  }, [inputCode, epicerieId, subtotal, channel, onApplied]);

  const handleRemove = useCallback(() => {
    setErrorReason(null);
    onRemoved();
  }, [onRemoved]);

  // ── Etat "applique" : pilule verte avec code + remise + bouton Retirer ──
  if (value) {
    return (
      <View style={styles.appliedBox}>
        <View style={styles.appliedInfo}>
          <Text style={styles.appliedCode}>{value.code}</Text>
          <Text style={styles.appliedDiscount}>
            −{formatPrice(value.discountAmount, currency)}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={handleRemove}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={styles.removeBtnText}>{t('promoCodes.remove')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Etat "vierge" : input + bouton Appliquer ──
  const errorMsg = errorReason
    ? (t(`promoCodes.errors.${errorReason}`) as string)
    : null;

  return (
    <View>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, errorMsg && styles.inputError]}
          placeholder={t('promoCodes.placeholder') as string}
          placeholderTextColor="#999"
          autoCapitalize="characters"
          autoCorrect={false}
          value={inputCode}
          onChangeText={(txt) => {
            setInputCode(txt);
            if (errorReason) setErrorReason(null);
          }}
          onSubmitEditing={handleApply}
          editable={!loading && !disabled}
          returnKeyType="done"
          maxLength={40}
        />
        <TouchableOpacity
          style={[
            styles.applyBtn,
            (loading || !inputCode.trim() || disabled) && styles.applyBtnDisabled,
          ]}
          onPress={handleApply}
          disabled={loading || !inputCode.trim() || disabled}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.applyBtnText}>{t('promoCodes.apply')}</Text>
          )}
        </TouchableOpacity>
      </View>
      {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#d4d4d4',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#222',
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#e53935',
  },
  applyBtn: {
    height: 44,
    minWidth: 96,
    paddingHorizontal: 16,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnDisabled: {
    backgroundColor: '#b5b5b5',
  },
  applyBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  errorText: {
    color: '#e53935',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  appliedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    borderColor: '#4CAF50',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  appliedInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  appliedCode: {
    fontWeight: '700',
    color: '#2e7d32',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  appliedDiscount: {
    color: '#2e7d32',
    fontWeight: '600',
    fontSize: 14,
  },
  removeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  removeBtnText: {
    color: '#c62828',
    fontWeight: '600',
    fontSize: 13,
  },
});
