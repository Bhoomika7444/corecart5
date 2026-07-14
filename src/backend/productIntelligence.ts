/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ProductFamily {
  id: string;
  name: string;
  businessCategory: string;
  category: string;
  subcategory: string;
  tags: string[];
  imageType: string;
  imageUrl: string;
  minPrice: number; // in cents
  maxPrice: number; // in cents
  relatedFamilies: string[];
  bundleFamilies: string[];
  descriptionTemplate: string;
}

export const PRODUCT_FAMILIES: Record<string, ProductFamily> = {
  toor_dal: {
    id: "toor_dal",
    name: "Toor Dal",
    businessCategory: "Grocery",
    category: "Pulses",
    subcategory: "Lentils",
    tags: ["Dal", "Pulse", "Protein", "Indian Grocery", "Kitchen", "Healthy"],
    imageType: "dal",
    imageUrl: "https://images.unsplash.com/photo-1547058886-f33f9a74a17a?auto=format&fit=crop&w=600&q=80",
    minPrice: 16000,
    maxPrice: 22000,
    relatedFamilies: ["rice", "cooking_oil", "salt", "spices"],
    bundleFamilies: ["rice", "cooking_oil", "salt"],
    descriptionTemplate: "Premium quality {PRODUCT_NAME} sourced from trusted farms. Rich in protein and ideal for daily Indian cooking."
  },
  rice: {
    id: "rice",
    name: "Rice",
    businessCategory: "Grocery",
    category: "Grains",
    subcategory: "Rice",
    tags: ["Rice", "Grains", "Carbs", "Indian Grocery", "Kitchen"],
    imageType: "rice",
    imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80",
    minPrice: 35000,
    maxPrice: 65000,
    relatedFamilies: ["toor_dal", "cooking_oil", "salt", "spices"],
    bundleFamilies: ["toor_dal", "cooking_oil", "salt"],
    descriptionTemplate: "High-grade {PRODUCT_NAME} with long grains and aromatic flavor, perfect for everyday meals and special occasions."
  },
  milk: {
    id: "milk",
    name: "Milk",
    businessCategory: "Grocery",
    category: "Dairy",
    subcategory: "Milk",
    tags: ["Milk", "Dairy", "Fresh", "Calcium"],
    imageType: "milk packet",
    imageUrl: "https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=600&q=80",
    minPrice: 6000,
    maxPrice: 8000,
    relatedFamilies: ["eggs", "bread", "butter"],
    bundleFamilies: ["eggs", "bread"],
    descriptionTemplate: "Fresh and nutritious {PRODUCT_NAME}, rich in calcium and essential vitamins."
  },
  eggs: {
    id: "eggs",
    name: "Eggs",
    businessCategory: "Grocery",
    category: "Dairy & Eggs",
    subcategory: "Eggs",
    tags: ["Eggs", "Protein", "Fresh", "Breakfast"],
    imageType: "egg tray",
    imageUrl: "https://images.unsplash.com/photo-1516448620398-c5f44bf9f441?auto=format&fit=crop&w=600&q=80",
    minPrice: 6000,
    maxPrice: 15000,
    relatedFamilies: ["milk", "bread", "butter"],
    bundleFamilies: ["milk", "bread"],
    descriptionTemplate: "Farm-fresh {PRODUCT_NAME}, a great source of high-quality protein for your daily diet."
  },
  tomatoes: {
    id: "tomatoes",
    name: "Tomatoes",
    businessCategory: "Grocery",
    category: "Vegetables",
    subcategory: "Fresh Produce",
    tags: ["Tomatoes", "Vegetable", "Fresh", "Salad", "Cooking"],
    imageType: "fresh tomatoes",
    imageUrl: "https://images.unsplash.com/photo-1595855759920-86582396756a?auto=format&fit=crop&w=600&q=80",
    minPrice: 4000,
    maxPrice: 12000,
    relatedFamilies: ["onions", "potatoes", "coriander"],
    bundleFamilies: ["onions", "potatoes"],
    descriptionTemplate: "Juicy, ripe, and fresh {PRODUCT_NAME}, perfect for salads, curries, and sauces."
  },
  laptop: {
    id: "laptop",
    name: "Laptop",
    businessCategory: "Electronics",
    category: "Computers",
    subcategory: "Laptops",
    tags: ["Laptop", "Computer", "Tech", "Work", "Portable"],
    imageType: "laptop",
    imageUrl: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=600&q=80",
    minPrice: 4500000,
    maxPrice: 12000000,
    relatedFamilies: ["mouse", "keyboard", "laptop_bag", "cooling_pad", "usb_hub"],
    bundleFamilies: ["mouse", "laptop_bag"],
    descriptionTemplate: "High-performance {PRODUCT_NAME} designed for seamless multitasking, gaming, and productivity."
  },
  smartphone: {
    id: "smartphone",
    name: "Smartphone",
    businessCategory: "Electronics",
    category: "Mobiles",
    subcategory: "Smartphones",
    tags: ["Phone", "Mobile", "Smartphone", "Tech", "Gadget"],
    imageType: "smartphone",
    imageUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80",
    minPrice: 1000000,
    maxPrice: 15000000,
    relatedFamilies: ["phone_case", "charger", "earbuds", "power_bank"],
    bundleFamilies: ["phone_case", "charger", "power_bank"],
    descriptionTemplate: "The latest {PRODUCT_NAME} featuring a stunning display, powerful processor, and excellent camera system."
  },
  office_chair: {
    id: "office_chair",
    name: "Office Chair",
    businessCategory: "Furniture",
    category: "Seating",
    subcategory: "Office Chairs",
    tags: ["Chair", "Office", "Ergonomic", "Work", "Furniture"],
    imageType: "office chair",
    imageUrl: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=600&q=80",
    minPrice: 400000,
    maxPrice: 900000,
    relatedFamilies: ["office_desk", "desk_lamp"],
    bundleFamilies: ["office_desk"],
    descriptionTemplate: "Ergonomic {PRODUCT_NAME} with adjustable height and lumbar support for comfortable long working hours."
  },
  sofa: {
    id: "sofa",
    name: "Sofa",
    businessCategory: "Furniture",
    category: "Living Room",
    subcategory: "Sofas",
    tags: ["Sofa", "Couch", "Living Room", "Furniture", "Comfort"],
    imageType: "sofa",
    imageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=600&q=80",
    minPrice: 1800000,
    maxPrice: 4500000,
    relatedFamilies: ["coffee_table", "cushions", "rug"],
    bundleFamilies: ["cushions"],
    descriptionTemplate: "Luxurious and comfortable {PRODUCT_NAME}, designed to elevate the aesthetic of your living room."
  },
  dining_table: {
    id: "dining_table",
    name: "Dining Table",
    businessCategory: "Furniture",
    category: "Dining Room",
    subcategory: "Tables",
    tags: ["Dining Table", "Table", "Furniture", "Dining Room"],
    imageType: "dining table",
    imageUrl: "https://images.unsplash.com/photo-1577140917170-285929fb55b7?auto=format&fit=crop&w=600&q=80",
    minPrice: 1500000,
    maxPrice: 6000000,
    relatedFamilies: ["dining_chairs", "dinner_set", "table_runner", "flower_vase"],
    bundleFamilies: ["dining_chairs", "table_runner"],
    descriptionTemplate: "Elegant {PRODUCT_NAME} crafted with premium materials, perfect for family meals and hosting guests."
  },
  perfume: {
    id: "perfume",
    name: "Perfume",
    businessCategory: "Cosmetics",
    category: "Fragrances",
    subcategory: "Perfumes",
    tags: ["Perfume", "Fragrance", "Scent", "Beauty", "Cosmetics"],
    imageType: "perfume bottle",
    imageUrl: "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=600&q=80",
    minPrice: 80000,
    maxPrice: 500000,
    relatedFamilies: ["body_mist", "soap", "face_wash", "gift_box"],
    bundleFamilies: ["body_mist", "gift_box"],
    descriptionTemplate: "An enchanting and long-lasting {PRODUCT_NAME} that leaves a memorable impression."
  },
  apple: {
    id: "apple",
    name: "Apple",
    businessCategory: "Grocery",
    category: "Fruits",
    subcategory: "Fresh Produce",
    tags: ["Apple", "Fruit", "Fresh", "Grocery", "Healthy"],
    imageType: "fresh apples",
    imageUrl: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80",
    minPrice: 12000,
    maxPrice: 25000,
    relatedFamilies: ["banana", "orange", "mango"],
    bundleFamilies: ["banana", "orange"],
    descriptionTemplate: "Crisp, juicy {PRODUCT_NAME}, freshly sourced and packed with natural sweetness."
  },
  banana: {
    id: "banana",
    name: "Banana",
    businessCategory: "Grocery",
    category: "Fruits",
    subcategory: "Fresh Produce",
    tags: ["Banana", "Fruit", "Fresh", "Grocery", "Healthy"],
    imageType: "bananas",
    imageUrl: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80",
    minPrice: 4000,
    maxPrice: 8000,
    relatedFamilies: ["apple", "orange", "mango"],
    bundleFamilies: ["apple"],
    descriptionTemplate: "Naturally ripened {PRODUCT_NAME}, a quick and healthy energy-rich snack."
  },
  orange: {
    id: "orange",
    name: "Orange",
    businessCategory: "Grocery",
    category: "Fruits",
    subcategory: "Fresh Produce",
    tags: ["Orange", "Citrus", "Fruit", "Fresh", "Grocery"],
    imageType: "oranges",
    imageUrl: "https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?auto=format&fit=crop&w=600&q=80",
    minPrice: 8000,
    maxPrice: 18000,
    relatedFamilies: ["apple", "banana", "mango"],
    bundleFamilies: ["apple"],
    descriptionTemplate: "Juicy and tangy {PRODUCT_NAME}, loaded with Vitamin C."
  },
  mango: {
    id: "mango",
    name: "Mango",
    businessCategory: "Grocery",
    category: "Fruits",
    subcategory: "Fresh Produce",
    tags: ["Mango", "Fruit", "Seasonal", "Fresh", "Grocery"],
    imageType: "mangoes",
    imageUrl: "https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=600&q=80",
    minPrice: 15000,
    maxPrice: 40000,
    relatedFamilies: ["apple", "banana", "orange"],
    bundleFamilies: [],
    descriptionTemplate: "Sweet, fragrant {PRODUCT_NAME} - the king of fruits, at peak ripeness."
  },
  potato: {
    id: "potato",
    name: "Potato",
    businessCategory: "Grocery",
    category: "Vegetables",
    subcategory: "Fresh Produce",
    tags: ["Potato", "Vegetable", "Fresh", "Staple", "Grocery"],
    imageType: "potatoes",
    imageUrl: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80",
    minPrice: 2500,
    maxPrice: 5000,
    relatedFamilies: ["onion", "tomatoes"],
    bundleFamilies: ["onion", "tomatoes"],
    descriptionTemplate: "Farm-fresh {PRODUCT_NAME}, a versatile everyday kitchen staple."
  },
  onion: {
    id: "onion",
    name: "Onion",
    businessCategory: "Grocery",
    category: "Vegetables",
    subcategory: "Fresh Produce",
    tags: ["Onion", "Vegetable", "Fresh", "Staple", "Grocery"],
    imageType: "onions",
    imageUrl: "https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&w=600&q=80",
    minPrice: 3000,
    maxPrice: 6000,
    relatedFamilies: ["potato", "tomatoes"],
    bundleFamilies: ["potato", "tomatoes"],
    descriptionTemplate: "Fresh, flavorful {PRODUCT_NAME}, an everyday essential for Indian cooking."
  },
  bread: {
    id: "bread",
    name: "Bread",
    businessCategory: "Grocery",
    category: "Bakery",
    subcategory: "Bread & Bakery",
    tags: ["Bread", "Bakery", "Breakfast", "Fresh"],
    imageType: "bread loaf",
    imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
    minPrice: 3500,
    maxPrice: 7000,
    relatedFamilies: ["milk", "eggs", "butter"],
    bundleFamilies: ["milk", "eggs"],
    descriptionTemplate: "Soft, freshly baked {PRODUCT_NAME}, perfect for breakfast and sandwiches."
  },
  sugar: {
    id: "sugar",
    name: "Sugar",
    businessCategory: "Grocery",
    category: "Staples",
    subcategory: "Sugar & Sweeteners",
    tags: ["Sugar", "Staple", "Kitchen", "Grocery"],
    imageType: "sugar packet",
    imageUrl: "https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=600&q=80",
    minPrice: 4000,
    maxPrice: 6500,
    relatedFamilies: ["rice", "toor_dal"],
    bundleFamilies: [],
    descriptionTemplate: "Pure, refined {PRODUCT_NAME} for everyday cooking and beverages."
  },
  cooking_oil: {
    id: "cooking_oil",
    name: "Cooking Oil",
    businessCategory: "Grocery",
    category: "Staples",
    subcategory: "Edible Oils",
    tags: ["Oil", "Cooking", "Staple", "Kitchen", "Grocery"],
    imageType: "cooking oil bottle",
    imageUrl: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80",
    minPrice: 12000,
    maxPrice: 22000,
    relatedFamilies: ["rice", "toor_dal", "salt"],
    bundleFamilies: ["rice"],
    descriptionTemplate: "Refined {PRODUCT_NAME}, light and healthy for daily cooking."
  },
  tshirt: {
    id: "tshirt",
    name: "T-Shirt",
    businessCategory: "Fashion",
    category: "Apparel",
    subcategory: "T-Shirts",
    tags: ["T-Shirt", "Apparel", "Casual", "Fashion"],
    imageType: "t-shirt",
    imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=80",
    minPrice: 39900,
    maxPrice: 149900,
    relatedFamilies: [],
    bundleFamilies: [],
    descriptionTemplate: "Comfortable, breathable {PRODUCT_NAME} made from premium cotton."
  }
};

export const SYNONYMS: Record<string, string> = {
  "dal": "toor_dal",
  "toor dal": "toor_dal",
  "arhar dal": "toor_dal",
  "pigeon peas": "toor_dal",
  "arhar": "toor_dal",
  
  "rice": "rice",
  "basmati rice": "rice",
  "raw rice": "rice",
  "brown rice": "rice",
  
  "milk": "milk",
  "cow milk": "milk",
  "buffalo milk": "milk",
  "full cream milk": "milk",
  
  "eggs": "eggs",
  "egg": "eggs",
  "brown eggs": "eggs",
  "white eggs": "eggs",
  
  "tomatoes": "tomatoes",
  "tomato": "tomatoes",
  
  "phone": "smartphone",
  "smartphone": "smartphone",
  "mobile": "smartphone",
  "mobile phone": "smartphone",
  "cell phone": "smartphone",
  
  "laptop": "laptop",
  "notebook": "laptop",
  "ultrabook": "laptop",
  "macbook": "laptop",
  
  "office chair": "office_chair",
  "desk chair": "office_chair",
  "ergonomic chair": "office_chair",
  "chair": "office_chair",
  
  "sofa": "sofa",
  "couch": "sofa",
  "lounge sofa": "sofa",
  "loveseat": "sofa",
  
  "dining table": "dining_table",
  "dining set": "dining_table",
  "dining furniture": "dining_table",
  
  "perfume": "perfume",
  "fragrance": "perfume",
  "cologne": "perfume",
  "scent": "perfume",

  "apple": "apple",
  "apples": "apple",
  "red apple": "apple",
  "green apple": "apple",

  "banana": "banana",
  "bananas": "banana",

  "orange": "orange",
  "oranges": "orange",

  "mango": "mango",
  "mangoes": "mango",
  "mangos": "mango",

  "potato": "potato",
  "potatoes": "potato",
  "aloo": "potato",

  "onion": "onion",
  "onions": "onion",
  "pyaz": "onion",

  "bread": "bread",
  "loaf": "bread",
  "brown bread": "bread",
  "white bread": "bread",

  "sugar": "sugar",
  "chini": "sugar",

  "cooking oil": "cooking_oil",
  "sunflower oil": "cooking_oil",
  "mustard oil": "cooking_oil",
  "edible oil": "cooking_oil",
  "vegetable oil": "cooking_oil",

  "t-shirt": "tshirt",
  "tshirt": "tshirt",
  "t shirt": "tshirt",
  "tee": "tshirt"
};

export interface ProductIntelligenceResult {
  familyId: string | null;
  businessCategory: string;
  category: string;
  subcategory: string;
  tags: string[];
  suggestedPrice: number; // generated random price in range
  imageKeyword: string;
  description: string;
}

export function classifyProduct(
  inputName: string, 
  learningPreferences?: Record<string, { category?: string; imageKeyword?: string }>
): ProductIntelligenceResult {
  const normalizedInput = inputName.toLowerCase().trim();
  
  let matchedFamilyId: string | null = null;
  
  // Direct match
  if (SYNONYMS[normalizedInput]) {
    matchedFamilyId = SYNONYMS[normalizedInput];
  } else {
    // Partial match (longest synonym first)
    const sortedSynonyms = Object.keys(SYNONYMS).sort((a, b) => b.length - a.length);
    for (const syn of sortedSynonyms) {
      if (normalizedInput.includes(syn)) {
        matchedFamilyId = SYNONYMS[syn];
        break;
      }
    }
  }

  // Default fallback if no match
  if (!matchedFamilyId) {
    return {
      familyId: null,
      businessCategory: "General",
      category: "Uncategorized",
      subcategory: "General",
      tags: [],
      suggestedPrice: 0,
      imageKeyword: inputName, // fallback to input name itself
      description: `Premium quality ${inputName}.`
    };
  }

  const family = PRODUCT_FAMILIES[matchedFamilyId];
  const prefs = learningPreferences?.[matchedFamilyId] || {};

  // Generate random price within range rounded to nearest 10 rupees (1000 cents)
  const priceRange = family.maxPrice - family.minPrice;
  const rawPrice = family.minPrice + Math.random() * priceRange;
  const suggestedPrice = Math.round(rawPrice / 1000) * 1000;

  return {
    familyId: matchedFamilyId,
    businessCategory: family.businessCategory,
    category: prefs.category || family.category,
    subcategory: family.subcategory,
    tags: family.tags,
    suggestedPrice,
    imageKeyword: prefs.imageKeyword || family.imageUrl,
    description: family.descriptionTemplate.replace("{PRODUCT_NAME}", inputName)
  };
}

export function expandSearchQuery(query: string): string[] {
  const normalizedQuery = query.toLowerCase().trim();
  
  // First find if the query maps to a family
  let matchedFamilyId = SYNONYMS[normalizedQuery];
  
  if (!matchedFamilyId) {
    // Check partial
    const sortedSynonyms = Object.keys(SYNONYMS).sort((a, b) => b.length - a.length);
    for (const syn of sortedSynonyms) {
      if (normalizedQuery.includes(syn) || syn.includes(normalizedQuery)) {
        matchedFamilyId = SYNONYMS[syn];
        break;
      }
    }
  }

  if (!matchedFamilyId) {
    return [normalizedQuery];
  }

  // Return all synonyms for this family
  return Object.keys(SYNONYMS).filter(k => SYNONYMS[k] === matchedFamilyId);
}

export function getRelatedFamilies(familyId: string): string[] {
  if (!familyId || !PRODUCT_FAMILIES[familyId]) return [];
  return PRODUCT_FAMILIES[familyId].relatedFamilies;
}

export function getBundleFamilies(familyId: string): string[] {
  if (!familyId || !PRODUCT_FAMILIES[familyId]) return [];
  return PRODUCT_FAMILIES[familyId].bundleFamilies;
}
