/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StoreTemplateKey, FeatureKey } from "../shared/kernel";

export interface FrontendBrandIdentity {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  typography: string;
  themeMode: "light" | "dark" | "system";
  brandStyle: "clean" | "bold" | "editorial" | "retro" | "minimal";
  logoUrl?: string;
}

export interface FrontendStoreBootstrap {
  store: {
    id: string;
    ownerId?: string;
    name: string;
    slug: string;
    businessType: string;
    description: string;
    country: string;
    currency: string;
    language: string;
    templateKey: StoreTemplateKey;
  };
  theme: FrontendBrandIdentity;
  features: Record<FeatureKey, boolean>;
  navigation: Array<{ label: string; link: string; id: string }>;
  pages: Array<{
    id: string;
    slug: string;
    title: string;
    sections: Array<{
      id: string;
      components: Array<{
        id: string;
        type: "HERO_BANNER" | "PRODUCT_GRID" | "CMS_RICH_TEXT";
        requiredFeature: FeatureKey | null;
        payload: any;
      }>;
    }>;
  }>;
  initialCatalogPage: {
    products: any[];
    categories: any[];
    rules: any[];
    blogs: any[];
    faqs: any[];
  };
}
