export interface Category {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

export interface MenuItemSummary {
  id: string;
  name: string;
  description: string | null;
  costCents: number;
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
