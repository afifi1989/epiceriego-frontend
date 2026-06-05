/**
 * StepFinaliserStock — Étape (optionnelle) : stock de départ.
 *
 * Juste après l'import du catalogue, propose de saisir le stock initial des
 * produits importés (regroupés par rayon). N'active PAS la vente — il manque
 * encore une photo, à ajouter plus tard depuis la fiche produit. Skippable :
 * l'épicier peut le faire plus tard via la bannière « à approvisionner ».
 */

import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Alert, View } from 'react-native';
import type { StepHandle, StepProps } from './stepProps';
import { FinaliserStockList, type FinaliserStockHandle } from '../components/FinaliserStockList';

export const StepFinaliserStock = forwardRef<StepHandle, StepProps>(
  function StepFinaliserStock({ epicerie }, ref) {
    const listRef = useRef<FinaliserStockHandle>(null);

    useImperativeHandle(ref, () => ({
      async submit() {
        const res = await listRef.current?.save();
        if (res && res.failed > 0) {
          Alert.alert(
            'Stock partiellement enregistré',
            `${res.saved} produit(s) mis à jour, ${res.failed} en échec. Vous pourrez réessayer depuis « Produits ».`,
          );
        }
        // Étape optionnelle : on avance toujours (même sans saisie).
        return true;
      },
    }));

    return (
      <View style={{ flex: 1, minHeight: 300 }}>
        <FinaliserStockList ref={listRef} epicerie={epicerie} />
      </View>
    );
  }
);
