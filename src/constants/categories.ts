/**
 * Comprehensive category structure with subcategories
 */

export interface SubCategory {
  id: string;
  label: string;
  parentId: number;
}

export interface Category {
  id: number;
  label: string;
  icon: string;
  subcategories?: SubCategory[];
}

export const CATEGORIES: Category[] = [
  {
    id: 1,
    label: 'Fruits & Légumes',
    icon: 'fruit-cherries',
    subcategories: [
      { id: '1-1', label: 'Fruits frais', parentId: 1 },
      { id: '1-2', label: 'Légumes frais', parentId: 1 },
      { id: '1-3', label: 'Herbes aromatiques', parentId: 1 },
      { id: '1-4', label: 'Fruits secs', parentId: 1 },
      { id: '1-5', label: 'Légumes secs', parentId: 1 },
    ],
  },
  {
    id: 2,
    label: 'Produits laitiers',
    icon: 'cheese',
    subcategories: [
      { id: '2-1', label: 'Lait', parentId: 2 },
      { id: '2-2', label: 'Yaourts', parentId: 2 },
      { id: '2-3', label: 'Fromages', parentId: 2 },
      { id: '2-4', label: 'Beurre & Crème', parentId: 2 },
      { id: '2-5', label: 'Desserts lactés', parentId: 2 },
    ],
  },
  {
    id: 3,
    label: 'Viandes & Poisson',
    icon: 'food-steak',
    subcategories: [
      { id: '3-1', label: 'Boeuf', parentId: 3 },
      { id: '3-2', label: 'Poulet', parentId: 3 },
      { id: '3-3', label: 'Agneau', parentId: 3 },
      { id: '3-4', label: 'Poisson frais', parentId: 3 },
      { id: '3-5', label: 'Fruits de mer', parentId: 3 },
      { id: '3-6', label: 'Charcuterie', parentId: 3 },
    ],
  },
  {
    id: 4,
    label: 'Boulangerie',
    icon: 'baguette',
    subcategories: [
      { id: '4-1', label: 'Pain', parentId: 4 },
      { id: '4-2', label: 'Viennoiseries', parentId: 4 },
      { id: '4-3', label: 'Pâtisseries', parentId: 4 },
      { id: '4-4', label: 'Biscuits', parentId: 4 },
    ],
  },
  {
    id: 5,
    label: 'Épicerie sèche',
    icon: 'pasta',
    subcategories: [
      { id: '5-1', label: 'Pâtes & Riz', parentId: 5 },
      { id: '5-2', label: 'Conserves', parentId: 5 },
      { id: '5-3', label: 'Céréales', parentId: 5 },
      { id: '5-4', label: 'Huiles & Vinaigres', parentId: 5 },
      { id: '5-5', label: 'Épices & Condiments', parentId: 5 },
      { id: '5-6', label: 'Sauces', parentId: 5 },
      { id: '5-7', label: 'Snacks', parentId: 5 },
    ],
  },
  {
    id: 6,
    label: 'Boissons',
    icon: 'bottle-soda',
    subcategories: [
      { id: '6-1', label: 'Eau', parentId: 6 },
      { id: '6-2', label: 'Jus de fruits', parentId: 6 },
      { id: '6-3', label: 'Sodas', parentId: 6 },
      { id: '6-4', label: 'Café & Thé', parentId: 6 },
      { id: '6-5', label: 'Boissons chaudes', parentId: 6 },
    ],
  },
  {
    id: 7,
    label: 'Surgelés',
    icon: 'snowflake',
    subcategories: [
      { id: '7-1', label: 'Légumes surgelés', parentId: 7 },
      { id: '7-2', label: 'Poissons surgelés', parentId: 7 },
      { id: '7-3', label: 'Plats préparés', parentId: 7 },
      { id: '7-4', label: 'Glaces', parentId: 7 },
    ],
  },
  {
    id: 8,
    label: 'Produits bio',
    icon: 'leaf',
    subcategories: [
      { id: '8-1', label: 'Fruits & Légumes bio', parentId: 8 },
      { id: '8-2', label: 'Laitiers bio', parentId: 8 },
      { id: '8-3', label: 'Épicerie bio', parentId: 8 },
      { id: '8-4', label: 'Viandes bio', parentId: 8 },
    ],
  },
];

/**
 * Search categories and subcategories by keyword
 */
export function searchCategories(query: string): { category: Category; subcategory?: SubCategory }[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return [];

  const results: { category: Category; subcategory?: SubCategory }[] = [];

  CATEGORIES.forEach((category) => {
    // Search in category name
    if (category.label.toLowerCase().includes(normalizedQuery)) {
      results.push({ category });
    }

    // Search in subcategories
    category.subcategories?.forEach((subcategory) => {
      if (subcategory.label.toLowerCase().includes(normalizedQuery)) {
        results.push({ category, subcategory });
      }
    });
  });

  return results;
}

/**
 * Get category by ID
 */
export function getCategoryById(id: number): Category | undefined {
  return CATEGORIES.find((cat) => cat.id === id);
}

/**
 * Get full category path (for display)
 */
export function getCategoryPath(categoryId: number, subcategoryId?: string): string {
  const category = getCategoryById(categoryId);
  if (!category) return '';

  if (subcategoryId) {
    const subcategory = category.subcategories?.find((sub) => sub.id === subcategoryId);
    return subcategory ? `${category.label} > ${subcategory.label}` : category.label;
  }

  return category.label;
}
