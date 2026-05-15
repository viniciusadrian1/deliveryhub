export interface Category {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

export type ProductKind = 'single' | 'combo';
export type SalesKind = 'main' | 'side' | 'drink' | 'dessert' | 'addon';

export const SALES_KIND_LABELS: Record<SalesKind, string> = {
  main: 'Principal',
  side: 'Acompanhamento',
  drink: 'Bebida',
  dessert: 'Sobremesa',
  addon: 'Adicional',
};

export const SALES_KIND_DESCRIPTIONS: Record<SalesKind, string> = {
  main: 'Produto principal (lanche, prato, pizza). Aparece como destaque.',
  side: 'Acompanhamento — batata, arroz. Pode ser vendido sozinho ou em combo.',
  drink: 'Bebida. Ótimo candidato a cross-sell.',
  dessert: 'Sobremesa. Ótimo candidato a cross-sell.',
  addon: 'Adicional/extra. Tipicamente vendido como complemento.',
};

export interface MenuItemSummary {
  id: string;
  name: string;
  description: string | null;
  costCents: number;
  costMode: 'manual' | 'recipe';
  productKind: ProductKind;
  salesKind: SalesKind;
  prepTimeMinutes: number | null;
  imageUrl: string | null;
  allergens: string[];
  sortOrder: number;
  archivedAt: string | null;
  category: { id: string; name: string } | null;
}

export interface PlatformConfig {
  id: string;
  externalId: string | null;
  externalCategoryId: string | null;
  sellingPriceCents: number;
  isPublished: boolean;
  isAvailable: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  platform: { code: string; name: string; colorHex: string };
}

// ====== Combos ======

export interface ComboComponentResponse {
  id: string;
  organizationId: string;
  comboMenuItemId: string;
  componentMenuItemId: string;
  quantity: number;
  sortOrder: number;
  componentItem: {
    id: string;
    name: string;
    costCents: number;
    imageUrl: string | null;
    salesKind: SalesKind;
  };
}

export interface ComboResponse {
  menuItemId: string;
  costCents: number;
  components: ComboComponentResponse[];
}

export interface ComboBuilderRow {
  componentMenuItemId: string;
  quantity: number;
}

// ====== Modifier groups ======

export type ModifierGroupKind =
  | 'ingredients'
  | 'specifications'
  | 'cross_sell'
  | 'disposables';

export const MODIFIER_GROUP_KIND_LABELS: Record<ModifierGroupKind, string> = {
  ingredients: 'Ingredientes',
  specifications: 'Especificações',
  cross_sell: 'Cross-sell',
  disposables: 'Descartáveis',
};

export const MODIFIER_GROUP_KIND_DESCRIPTIONS: Record<ModifierGroupKind, string> = {
  ingredients:
    'Dê a opção de remover/adicionar ingredientes ou escolher entre opções.',
  specifications:
    'Perguntas pra cliente definir melhor o produto e modo de preparo.',
  cross_sell: 'Sugira outros produtos pra aumentar o valor do pedido.',
  disposables:
    'Pergunte se o cliente precisa de talheres plásticos, sachês ou embalagens.',
};

export interface ModifierResponse {
  id: string;
  modifierGroupId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  costDeltaCents: number;
  linkedMenuItemId: string | null;
  sortOrder: number;
}

export interface ModifierGroupResponse {
  id: string;
  menuItemId: string;
  kind: ModifierGroupKind;
  name: string;
  minSelect: number;
  maxSelect: number;
  required: boolean;
  sortOrder: number;
  modifiers: ModifierResponse[];
}
