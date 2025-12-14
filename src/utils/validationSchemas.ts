/**
 * Yup validation schemas for forms
 */

import * as yup from 'yup';

// Product creation schema
export const productCreationSchema = yup.object().shape({
  nom: yup
    .string()
    .required('Nom du produit requis')
    .min(3, 'Minimum 3 caractères')
    .max(100, 'Maximum 100 caractères'),

  description: yup
    .string()
    .max(500, 'Maximum 500 caractères')
    .optional(),

  categoryId: yup
    .number()
    .required('Catégorie requise')
    .positive('Catégorie invalide'),

  prix: yup
    .number()
    .required('Prix requis')
    .positive('Prix doit être positif')
    .min(0.01, 'Prix minimum: 0.01'),

  uniteVente: yup
    .string()
    .required('Unité de mesure requise')
    .oneOf(
      ['PIECE', 'KILOGRAM', 'GRAM', 'LITER', 'MILLILITER', 'DOZEN', 'PAIR', 'PACK'],
      'Unité invalide'
    ),

  stockThreshold: yup
    .number()
    .required('Seuil d\'alerte requis')
    .min(0, 'Ne peut pas être négatif')
    .max(9999, 'Maximum 9999'),

  stockInitial: yup
    .number()
    .required('Stock initial requis')
    .min(0, 'Ne peut pas être négatif')
    .max(99999, 'Maximum 99999'),

  codeBarreExterne: yup
    .string()
    .optional()
    .matches(/^\d{8,13}$/, 'Code-barre invalide (8-13 chiffres)'),
});

// Product update schema (all fields optional)
export const productUpdateSchema = yup.object().shape({
  nom: yup
    .string()
    .min(3, 'Minimum 3 caractères')
    .max(100, 'Maximum 100 caractères')
    .optional(),

  description: yup
    .string()
    .max(500, 'Maximum 500 caractères')
    .optional(),

  categoryId: yup
    .number()
    .positive('Catégorie invalide')
    .optional(),

  prix: yup
    .number()
    .positive('Prix doit être positif')
    .min(0.01, 'Prix minimum: 0.01')
    .optional(),

  uniteVente: yup
    .string()
    .oneOf(
      ['PIECE', 'KILOGRAM', 'GRAM', 'LITER', 'MILLILITER', 'DOZEN', 'PAIR', 'PACK'],
      'Unité invalide'
    )
    .optional(),

  stockThreshold: yup
    .number()
    .min(0, 'Ne peut pas être négatif')
    .max(9999, 'Maximum 9999')
    .optional(),
});

// Stock adjustment schema
export const stockAdjustmentSchema = yup.object().shape({
  adjustmentType: yup
    .string()
    .required('Type requis')
    .oneOf(['ADD', 'REMOVE'], 'Type invalide'),

  quantity: yup
    .string()
    .required('Quantité requise')
    .test('is-valid-number', 'Quantité invalide', function(value) {
      if (!value) return false;
      const num = parseFloat(value);
      return !isNaN(num) && num > 0;
    }),

  reason: yup
    .string()
    .required('Motif requis')
    .oneOf(
      ['RECEPTION', 'INVENTORY', 'DAMAGE', 'EXPIRATION', 'LOSS', 'RETURN', 'OTHER'],
      'Motif invalide'
    ),

  notes: yup
    .string()
    .max(250, 'Maximum 250 caractères')
    .optional(),
});

// Barcode input schema
export const barcodeInputSchema = yup.object().shape({
  barcode: yup
    .string()
    .required('Code-barre requis')
    .min(8, 'Code-barre trop court')
    .max(13, 'Code-barre trop long')
    .matches(/^\d+$/, 'Code-barre invalide (chiffres uniquement)'),
});

// Quantity input schema (for weight/volume products)
export const quantityInputSchema = yup.object().shape({
  quantity: yup
    .number()
    .required('Quantité requise')
    .typeError('Quantité invalide')
    .positive('Quantité doit être positive')
    .min(0.01, 'Quantité minimum: 0.01')
    .max(99999, 'Quantité maximum: 99999'),
});

// Order notes schema
export const orderNotesSchema = yup.object().shape({
  notes: yup
    .string()
    .max(500, 'Maximum 500 caractères')
    .optional(),
});

/**
 * Validate form data and return errors
 */
export const validateFormData = async (
  schema: yup.SchemaOf<any>,
  data: any
): Promise<{ [key: string]: string } | null> => {
  try {
    await schema.validate(data, { abortEarly: false });
    return null;
  } catch (error: any) {
    const errors: { [key: string]: string } = {};
    if (error.inner) {
      error.inner.forEach((err: any) => {
        errors[err.path] = err.message;
      });
    }
    return errors;
  }
};
