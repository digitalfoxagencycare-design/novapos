import { GCS_BASE } from './catalogImageUrls';

export const UNITS = ['kg', 'g', 'pcs', 'pack', 'box', 'litre', 'ml'] as const;
export type Uom = typeof UNITS[number];
export const PROFILES = {
  kirana: 'Kirana & Supermarket', bakery: 'Bakery & Sweets',
  restaurant: 'Restaurant & Cafe', retail: 'General Retail',
} as const;
export type BusinessProfile = keyof typeof PROFILES;
export const unitOf = (item: { uom?: string; isWeighed?: boolean }): Uom =>
  UNITS.includes(item.uom as Uom) ? item.uom as Uom : item.isWeighed ? 'kg' : 'pcs';
export const isWeight = (unit: Uom) => unit === 'kg' || unit === 'g';
export const lineAmount = (price: number, quantity: number) => Math.round((price * quantity + Number.EPSILON) * 100) / 100;
export function quantityFromGrams(grams: number, unit: 'kg' | 'g') {
  if (!Number.isFinite(grams) || grams <= 0) throw new Error('Enter a valid positive quantity.');
  return unit === 'kg' ? Math.round((grams / 1000) * 1000) / 1000 : Math.round(grams);
}
export function financialYear(date: Date) {
  const start = date.getFullYear() - (date.getMonth() < 3 ? 1 : 0);
  return `${String(start).slice(-2)}${String(start + 1).slice(-2)}`;
}

export interface PresetItemDef {
  name: string;
  category: string;
  price: number;
  uom: Uom;
  gstRate: number; // 0, 5, 12, 18, 28
  hsnSac: string;
  isVeg: boolean;
  stockQty?: number;
  barcode?: string;
  imageUrl?: string;
}

// 40+ Realistic products per business profile with GST rates & HSN
const presets: Record<BusinessProfile, PresetItemDef[]> = {
  kirana: [
    { name: 'Sona Masoori Rice (1kg)', category: 'Rice & Staples', price: 62.00, uom: 'kg', gstRate: 0, hsnSac: '1006', isVeg: true, stockQty: 250, barcode: '890103000101', imageUrl: `${GCS_BASE}/kirana/rice-staples/sona-masoori-rice.jpg` },
    { name: 'Basmati Rice Premium (1kg)', category: 'Rice & Staples', price: 135.00, uom: 'kg', gstRate: 0, hsnSac: '1006', isVeg: true, stockQty: 180, barcode: '890103000102', imageUrl: `${GCS_BASE}/kirana/rice-staples/basmati-rice.jpg` },
    { name: 'Toor Dal Desi (1kg)', category: 'Rice & Staples', price: 165.00, uom: 'kg', gstRate: 0, hsnSac: '0713', isVeg: true, stockQty: 140, barcode: '890103000103', imageUrl: `${GCS_BASE}/kirana/rice-staples/toor-dal.jpg` },
    { name: 'Moong Dal Yellow (1kg)', category: 'Rice & Staples', price: 120.00, uom: 'kg', gstRate: 0, hsnSac: '0713', isVeg: true, stockQty: 95, barcode: '890103000104', imageUrl: `${GCS_BASE}/kirana/rice-staples/moong-dal.jpg` },
    { name: 'Urad Dal Gota (1kg)', category: 'Rice & Staples', price: 140.00, uom: 'kg', gstRate: 0, hsnSac: '0713', isVeg: true, stockQty: 80, barcode: '890103000105', imageUrl: `${GCS_BASE}/kirana/rice-staples/urad-dal.jpg` },
    { name: 'Chana Dal (1kg)', category: 'Rice & Staples', price: 90.00, uom: 'kg', gstRate: 0, hsnSac: '0713', isVeg: true, stockQty: 110, barcode: '890103000106', imageUrl: `${GCS_BASE}/kirana/rice-staples/chana-dal.jpg` },
    { name: 'Aashirvaad Shudh Chakki Atta (5kg)', category: 'Flour & Atta', price: 245.00, uom: 'pack', gstRate: 5, hsnSac: '1101', isVeg: true, stockQty: 60, barcode: '890103000107', imageUrl: `${GCS_BASE}/kirana/flour-atta/aashirvaad-atta.jpg` },
    { name: 'Maida Refined Flour (1kg)', category: 'Flour & Atta', price: 45.00, uom: 'kg', gstRate: 0, hsnSac: '1101', isVeg: true, stockQty: 75, barcode: '890103000108', imageUrl: `${GCS_BASE}/kirana/flour-atta/maida-flour.jpg` },
    { name: 'Bombay Rava / Sooji (1kg)', category: 'Flour & Atta', price: 50.00, uom: 'kg', gstRate: 0, hsnSac: '1103', isVeg: true, stockQty: 65, barcode: '890103000109', imageUrl: `${GCS_BASE}/kirana/flour-atta/bombay-rava.jpg` },
    { name: 'Crystal Sugar (1kg)', category: 'Sugar & Salt', price: 48.00, uom: 'kg', gstRate: 5, hsnSac: '1701', isVeg: true, stockQty: 320, barcode: '890103000110', imageUrl: `${GCS_BASE}/kirana/sugar-salt/crystal-sugar.jpg` },
    { name: 'Tata Iodized Salt (1kg)', category: 'Sugar & Salt', price: 28.00, uom: 'pack', gstRate: 0, hsnSac: '2501', isVeg: true, stockQty: 150, barcode: '890103000111', imageUrl: `${GCS_BASE}/kirana/sugar-salt/tata-salt.jpg` },
    { name: 'Freedom Refined Sunflower Oil (1L)', category: 'Edible Oils', price: 142.00, uom: 'pack', gstRate: 5, hsnSac: '1512', isVeg: true, stockQty: 120, barcode: '890103000112', imageUrl: `${GCS_BASE}/kirana/edible-oils/sunflower-oil.jpg` },
    { name: 'Fortune Groundnut Oil (1L)', category: 'Edible Oils', price: 185.00, uom: 'pack', gstRate: 5, hsnSac: '1508', isVeg: true, stockQty: 85, barcode: '890103000113', imageUrl: `${GCS_BASE}/kirana/edible-oils/groundnut-oil.jpg` },
    { name: 'Vijaya Pure Cow Ghee (500ml)', category: 'Dairy & Ghee', price: 340.00, uom: 'pack', gstRate: 12, hsnSac: '0405', isVeg: true, stockQty: 45, barcode: '890103000114', imageUrl: `${GCS_BASE}/kirana/dairy-ghee/cow-ghee.jpg` },
    { name: 'Amul Taaza Toned Milk (500ml)', category: 'Dairy & Ghee', price: 27.00, uom: 'pack', gstRate: 0, hsnSac: '0401', isVeg: true, stockQty: 80, barcode: '890103000115', imageUrl: `${GCS_BASE}/kirana/dairy-ghee/toned-milk.jpg` },
    { name: 'Amul Butter (100g)', category: 'Dairy & Ghee', price: 58.00, uom: 'pack', gstRate: 12, hsnSac: '0405', isVeg: true, stockQty: 55, barcode: '890103000116', imageUrl: `${GCS_BASE}/kirana/dairy-ghee/amul-butter.jpg` },
    { name: 'Nandini Curd / Dahi (500g)', category: 'Dairy & Ghee', price: 30.00, uom: 'pack', gstRate: 0, hsnSac: '0403', isVeg: true, stockQty: 60, barcode: '890103000117', imageUrl: `${GCS_BASE}/kirana/dairy-ghee/curd-dahi.jpg` },
    { name: 'Turmeric Powder Haldi (100g)', category: 'Spices & Masala', price: 38.00, uom: 'pack', gstRate: 5, hsnSac: '0910', isVeg: true, stockQty: 90, barcode: '890103000118', imageUrl: `${GCS_BASE}/kirana/spices-masala/turmeric-haldi.jpg` },
    { name: 'Everest Red Chilli Powder (100g)', category: 'Spices & Masala', price: 52.00, uom: 'pack', gstRate: 5, hsnSac: '0904', isVeg: true, stockQty: 85, barcode: '890103000119', imageUrl: `${GCS_BASE}/kirana/spices-masala/red-chilli-powder.jpg` },
    { name: 'Coriander Dhaniya Powder (100g)', category: 'Spices & Masala', price: 35.00, uom: 'pack', gstRate: 5, hsnSac: '0909', isVeg: true, stockQty: 70, barcode: '890103000120', imageUrl: `${GCS_BASE}/kirana/spices-masala/coriander-powder.jpg` },
    { name: 'Mustard Seeds / Rai (100g)', category: 'Spices & Masala', price: 22.00, uom: 'pack', gstRate: 5, hsnSac: '0910', isVeg: true, stockQty: 65, barcode: '890103000121', imageUrl: `${GCS_BASE}/kirana/spices-masala/mustard-seeds.jpg` },
    { name: 'Jeera Cumin Seeds (100g)', category: 'Spices & Masala', price: 65.00, uom: 'pack', gstRate: 5, hsnSac: '0909', isVeg: true, stockQty: 75, barcode: '890103000122', imageUrl: `${GCS_BASE}/kirana/spices-masala/jeera-cumin.jpg` },
    { name: 'Garam Masala Pack (50g)', category: 'Spices & Masala', price: 42.00, uom: 'pack', gstRate: 5, hsnSac: '0910', isVeg: true, stockQty: 50, barcode: '890103000123', imageUrl: `${GCS_BASE}/kirana/spices-masala/garam-masala.jpg` },
    { name: 'Red Label Tea (250g)', category: 'Beverages', price: 130.00, uom: 'pack', gstRate: 5, hsnSac: '0902', isVeg: true, stockQty: 90, barcode: '890103000124', imageUrl: `${GCS_BASE}/kirana/beverages/red-label-tea.jpg` },
    { name: 'Bru Instant Coffee (50g)', category: 'Beverages', price: 95.00, uom: 'pack', gstRate: 18, hsnSac: '2101', isVeg: true, stockQty: 45, barcode: '890103000125', imageUrl: `${GCS_BASE}/kirana/beverages/bru-instant-coffee.jpg` },
    { name: 'Bournvita Health Drink (500g)', category: 'Beverages', price: 240.00, uom: 'pack', gstRate: 18, hsnSac: '1901', isVeg: true, stockQty: 35, barcode: '890103000126', imageUrl: `${GCS_BASE}/kirana/beverages/bournvita.jpg` },
    { name: 'Coca Cola Pet Bottle (750ml)', category: 'Beverages', price: 40.00, uom: 'pcs', gstRate: 28, hsnSac: '2202', isVeg: true, stockQty: 100, barcode: '890103000127', imageUrl: `${GCS_BASE}/kirana/beverages/coca-cola.jpg` },
    { name: 'Sprite Cold Drink (750ml)', category: 'Beverages', price: 40.00, uom: 'pcs', gstRate: 28, hsnSac: '2202', isVeg: true, stockQty: 85, barcode: '890103000128', imageUrl: `${GCS_BASE}/kirana/beverages/sprite.jpg` },
    { name: 'Maggi 2-Minute Noodles (70g)', category: 'Snacks & Biscuits', price: 14.00, uom: 'pack', gstRate: 12, hsnSac: '1902', isVeg: true, stockQty: 200, barcode: '890103000129', imageUrl: `${GCS_BASE}/kirana/snacks-biscuits/maggi-noodles.jpg` },
    { name: 'Parle-G Gold Biscuits (100g)', category: 'Snacks & Biscuits', price: 10.00, uom: 'pack', gstRate: 18, hsnSac: '1905', isVeg: true, stockQty: 250, barcode: '890103000130', imageUrl: `${GCS_BASE}/kirana/snacks-biscuits/parle-g-biscuits.jpg` },
    { name: 'Britannia Good Day Butter (120g)', category: 'Snacks & Biscuits', price: 30.00, uom: 'pack', gstRate: 18, hsnSac: '1905', isVeg: true, stockQty: 140, barcode: '890103000131', imageUrl: `${GCS_BASE}/kirana/snacks-biscuits/britannia-good-day.jpg` },
    { name: 'Lays Magic Masala Chips (50g)', category: 'Snacks & Biscuits', price: 20.00, uom: 'pack', gstRate: 12, hsnSac: '2005', isVeg: true, stockQty: 160, barcode: '890103000132', imageUrl: `${GCS_BASE}/kirana/snacks-biscuits/lays-chips.jpg` },
    { name: 'Haldirams Bhujia Sev (150g)', category: 'Snacks & Biscuits', price: 55.00, uom: 'pack', gstRate: 12, hsnSac: '2106', isVeg: true, stockQty: 75, barcode: '890103000133', imageUrl: `${GCS_BASE}/kirana/snacks-biscuits/haldirams-bhujia.jpg` },
    { name: 'Cadbury Dairy Milk Silk (60g)', category: 'Snacks & Biscuits', price: 80.00, uom: 'pcs', gstRate: 18, hsnSac: '1806', isVeg: true, stockQty: 90, barcode: '890103000134', imageUrl: `${GCS_BASE}/kirana/snacks-biscuits/dairy-milk-silk.jpg` },
    { name: 'Lifebuoy Total Soap Bar (100g)', category: 'Personal & Home Care', price: 36.00, uom: 'pcs', gstRate: 18, hsnSac: '3401', isVeg: true, stockQty: 120, barcode: '890103000135', imageUrl: `${GCS_BASE}/kirana/personal-home-care/lifebuoy-soap.jpg` },
    { name: 'Dettol Original Soap (125g)', category: 'Personal & Home Care', price: 58.00, uom: 'pcs', gstRate: 18, hsnSac: '3401', isVeg: true, stockQty: 95, barcode: '890103000136', imageUrl: `${GCS_BASE}/kirana/personal-home-care/dettol-soap.jpg` },
    { name: 'Colgate Strong Teeth (100g)', category: 'Personal & Home Care', price: 62.00, uom: 'pack', gstRate: 18, hsnSac: '3306', isVeg: true, stockQty: 80, barcode: '890103000137', imageUrl: `${GCS_BASE}/kirana/personal-home-care/colgate-toothpaste.jpg` },
    { name: 'Clinic Plus Shampoo (175ml)', category: 'Personal & Home Care', price: 98.00, uom: 'pcs', gstRate: 18, hsnSac: '3305', isVeg: true, stockQty: 60, barcode: '890103000138', imageUrl: `${GCS_BASE}/kirana/personal-home-care/clinic-plus-shampoo.jpg` },
    { name: 'Surf Excel Quick Wash Powder (1kg)', category: 'Personal & Home Care', price: 145.00, uom: 'pack', gstRate: 18, hsnSac: '3402', isVeg: true, stockQty: 70, barcode: '890103000139', imageUrl: `${GCS_BASE}/kirana/personal-home-care/surf-excel-powder.jpg` },
    { name: 'Vim Dishwash Liquid Gel (500ml)', category: 'Personal & Home Care', price: 110.00, uom: 'pcs', gstRate: 18, hsnSac: '3402', isVeg: true, stockQty: 65, barcode: '890103000140', imageUrl: `${GCS_BASE}/kirana/personal-home-care/vim-dishwash.jpg` },
    { name: 'Harpic Power Plus Cleaner (500ml)', category: 'Personal & Home Care', price: 92.00, uom: 'pcs', gstRate: 18, hsnSac: '3402', isVeg: true, stockQty: 55, barcode: '890103000141', imageUrl: `${GCS_BASE}/kirana/personal-home-care/harpic-cleaner.jpg` },
    { name: 'GoodKnight Gold Flash Liquid Refill', category: 'Personal & Home Care', price: 82.00, uom: 'pack', gstRate: 18, hsnSac: '3808', isVeg: true, stockQty: 50, barcode: '890103000142', imageUrl: `${GCS_BASE}/kirana/personal-home-care/goodknight-refill.jpg` }
  ],
  bakery: [
    { name: 'Kaju Katli (250g)', category: 'Dry Fruit Sweets', price: 240.00, uom: 'pack', gstRate: 5, hsnSac: '2106', isVeg: true, stockQty: 40, imageUrl: `${GCS_BASE}/bakery/dry-fruit-sweets/kaju-katli.jpg` },
    { name: 'Kaju Pista Roll (250g)', category: 'Dry Fruit Sweets', price: 275.00, uom: 'pack', gstRate: 5, hsnSac: '2106', isVeg: true, stockQty: 30, imageUrl: `${GCS_BASE}/bakery/dry-fruit-sweets/kaju-pista-roll.jpg` },
    { name: 'Special Pure Ghee Mysore Pak (250g)', category: 'Ghee Sweets', price: 180.00, uom: 'pack', gstRate: 5, hsnSac: '2106', isVeg: true, stockQty: 45, imageUrl: `${GCS_BASE}/bakery/ghee-sweets/mysore-pak.jpg` },
    { name: 'Motichoor Laddu (500g)', category: 'Ghee Sweets', price: 220.00, uom: 'pack', gstRate: 5, hsnSac: '2106', isVeg: true, stockQty: 35, imageUrl: `${GCS_BASE}/bakery/ghee-sweets/motichoor-laddu.jpg` },
    { name: 'Gulab Jamun (Box of 8)', category: 'Syrup Sweets', price: 160.00, uom: 'box', gstRate: 5, hsnSac: '2106', isVeg: true, stockQty: 25, imageUrl: `${GCS_BASE}/bakery/syrup-sweets/gulab-jamun.jpg` },
    { name: 'Rasgulla Tin (1kg)', category: 'Syrup Sweets', price: 240.00, uom: 'pack', gstRate: 5, hsnSac: '2106', isVeg: true, stockQty: 20, imageUrl: `${GCS_BASE}/bakery/syrup-sweets/rasgulla.jpg` },
    { name: 'Fresh Milk Bread (400g)', category: 'Fresh Breads', price: 45.00, uom: 'pack', gstRate: 0, hsnSac: '1905', isVeg: true, stockQty: 50, imageUrl: `${GCS_BASE}/bakery/fresh-breads/milk-bread.jpg` },
    { name: 'Brown Wheat Bread (400g)', category: 'Fresh Breads', price: 55.00, uom: 'pack', gstRate: 0, hsnSac: '1905', isVeg: true, stockQty: 40, imageUrl: `${GCS_BASE}/bakery/fresh-breads/brown-wheat-bread.jpg` },
    { name: 'Pav Buns (Pack of 6)', category: 'Fresh Breads', price: 35.00, uom: 'pack', gstRate: 0, hsnSac: '1905', isVeg: true, stockQty: 60, imageUrl: `${GCS_BASE}/bakery/fresh-breads/pav-buns.jpg` },
    { name: 'Butter Croissant', category: 'Pastries & Buns', price: 75.00, uom: 'pcs', gstRate: 18, hsnSac: '1905', isVeg: true, stockQty: 30, imageUrl: `${GCS_BASE}/bakery/pastries-buns/butter-croissant.jpg` },
    { name: 'Veg Puff / Curry Patty', category: 'Savouries & Puffs', price: 25.00, uom: 'pcs', gstRate: 5, hsnSac: '1905', isVeg: true, stockQty: 80, imageUrl: `${GCS_BASE}/bakery/savouries-puffs/veg-puff.jpg` },
    { name: 'Paneer Tikka Puff', category: 'Savouries & Puffs', price: 40.00, uom: 'pcs', gstRate: 5, hsnSac: '1905', isVeg: true, stockQty: 60, imageUrl: `${GCS_BASE}/bakery/savouries-puffs/paneer-tikka-puff.jpg` },
    { name: 'Egg Puff Deluxe', category: 'Savouries & Puffs', price: 30.00, uom: 'pcs', gstRate: 5, hsnSac: '1905', isVeg: false, stockQty: 50, imageUrl: `${GCS_BASE}/bakery/savouries-puffs/egg-puff.jpg` },
    { name: 'Black Forest Pastry', category: 'Cakes & Pastries', price: 85.00, uom: 'pcs', gstRate: 18, hsnSac: '1905', isVeg: true, stockQty: 35, imageUrl: `${GCS_BASE}/bakery/cakes-pastries/black-forest-pastry.jpg` },
    { name: 'Red Velvet Pastry', category: 'Cakes & Pastries', price: 95.00, uom: 'pcs', gstRate: 18, hsnSac: '1905', isVeg: true, stockQty: 25, imageUrl: `${GCS_BASE}/bakery/cakes-pastries/red-velvet-pastry.jpg` },
    { name: 'Dutch Chocolate Cake (500g)', category: 'Cakes & Pastries', price: 450.00, uom: 'pcs', gstRate: 18, hsnSac: '1905', isVeg: true, stockQty: 15, imageUrl: `${GCS_BASE}/bakery/cakes-pastries/chocolate-cake.jpg` },
    { name: 'Pineapple Fresh Cream Cake (500g)', category: 'Cakes & Pastries', price: 380.00, uom: 'pcs', gstRate: 18, hsnSac: '1905', isVeg: true, stockQty: 12, imageUrl: `${GCS_BASE}/bakery/cakes-pastries/pineapple-cake.jpg` },
    { name: 'Osmania Biscuits (Box 400g)', category: 'Cookies & Biscuits', price: 160.00, uom: 'box', gstRate: 18, hsnSac: '1905', isVeg: true, stockQty: 60, imageUrl: `${GCS_BASE}/bakery/cookies-biscuits/osmania-biscuits.jpg` },
    { name: 'Fruit Biscuits Karachi Style (400g)', category: 'Cookies & Biscuits', price: 180.00, uom: 'box', gstRate: 18, hsnSac: '1905', isVeg: true, stockQty: 50, imageUrl: `${GCS_BASE}/bakery/cookies-biscuits/fruit-biscuits.jpg` },
    { name: 'Assorted Sweet Gift Box (500g)', category: 'Gift Boxes', price: 480.00, uom: 'box', gstRate: 5, hsnSac: '2106', isVeg: true, stockQty: 40, imageUrl: `${GCS_BASE}/bakery/gift-boxes/assorted-sweet-box.jpg` }
  ],
  restaurant: [
    { name: 'Hyderabadi Chicken Dum Biryani', category: 'Biryanis & Rice', price: 260.00, uom: 'pcs', gstRate: 5, hsnSac: '9963', isVeg: false, stockQty: 100, imageUrl: `${GCS_BASE}/restaurant/biryanis-rice/chicken-dum-biryani.jpg` },
    { name: 'Hyderabadi Mutton Biryani', category: 'Biryanis & Rice', price: 360.00, uom: 'pcs', gstRate: 5, hsnSac: '9963', isVeg: false, stockQty: 60, imageUrl: `${GCS_BASE}/restaurant/biryanis-rice/mutton-biryani.jpg` },
    { name: 'Paneer Dum Biryani', category: 'Biryanis & Rice', price: 220.00, uom: 'pcs', gstRate: 5, hsnSac: '9963', isVeg: true, stockQty: 50, imageUrl: `${GCS_BASE}/restaurant/biryanis-rice/paneer-dum-biryani.jpg` },
    { name: 'Jeera Rice with Dal Tadka', category: 'Biryanis & Rice', price: 160.00, uom: 'pcs', gstRate: 5, hsnSac: '9963', isVeg: true, stockQty: 40, imageUrl: `${GCS_BASE}/restaurant/biryanis-rice/jeera-rice-dal-tadka.jpg` },
    { name: 'Masala Dosa (Ghee Roast)', category: 'Breakfast & Tiffins', price: 85.00, uom: 'pcs', gstRate: 5, hsnSac: '9963', isVeg: true, stockQty: 120, imageUrl: `${GCS_BASE}/restaurant/breakfast-tiffins/masala-dosa.jpg` },
    { name: 'Plain Dosa', category: 'Breakfast & Tiffins', price: 60.00, uom: 'pcs', gstRate: 5, hsnSac: '9963', isVeg: true, stockQty: 100, imageUrl: `${GCS_BASE}/restaurant/breakfast-tiffins/plain-dosa.jpg` },
    { name: 'Steamed Idli (2 Pcs) with Chutney', category: 'Breakfast & Tiffins', price: 50.00, uom: 'pcs', gstRate: 5, hsnSac: '9963', isVeg: true, stockQty: 150, imageUrl: `${GCS_BASE}/restaurant/breakfast-tiffins/idli-sambar.jpg` },
    { name: 'Medu Vada (2 Pcs) with Sambar', category: 'Breakfast & Tiffins', price: 60.00, uom: 'pcs', gstRate: 5, hsnSac: '9963', isVeg: true, stockQty: 110, imageUrl: `${GCS_BASE}/restaurant/breakfast-tiffins/medu-vada.jpg` },
    { name: 'Poori Bhaji (3 Pcs)', category: 'Breakfast & Tiffins', price: 75.00, uom: 'pcs', gstRate: 5, hsnSac: '9963', isVeg: true, stockQty: 90, imageUrl: `${GCS_BASE}/restaurant/breakfast-tiffins/poori-bhaji.jpg` },
    { name: 'Paneer Butter Masala', category: 'Curries & Gravies', price: 210.00, uom: 'pcs', gstRate: 5, hsnSac: '9963', isVeg: true, stockQty: 75, imageUrl: `${GCS_BASE}/restaurant/curries-gravies/paneer-butter-masala.jpg` },
    { name: 'Butter Chicken Gravy', category: 'Curries & Gravies', price: 260.00, uom: 'pcs', gstRate: 5, hsnSac: '9963', isVeg: false, stockQty: 80, imageUrl: `${GCS_BASE}/restaurant/curries-gravies/butter-chicken.jpg` },
    { name: 'Dal Makhani Creamy', category: 'Curries & Gravies', price: 180.00, uom: 'pcs', gstRate: 5, hsnSac: '9963', isVeg: true, stockQty: 60, imageUrl: `${GCS_BASE}/restaurant/curries-gravies/dal-makhani.jpg` },
    { name: 'Butter Naan / Tandoori Roti', category: 'Breads & Tandoor', price: 45.00, uom: 'pcs', gstRate: 5, hsnSac: '9963', isVeg: true, stockQty: 200, imageUrl: `${GCS_BASE}/restaurant/breads-tandoor/butter-naan.jpg` },
    { name: 'Chicken 65 Crispy', category: 'Starters & Appetizers', price: 230.00, uom: 'pcs', gstRate: 5, hsnSac: '9963', isVeg: false, stockQty: 90, imageUrl: `${GCS_BASE}/restaurant/starters-appetizers/chicken-65.jpg` },
    { name: 'Chilli Paneer Dry', category: 'Starters & Appetizers', price: 195.00, uom: 'pcs', gstRate: 5, hsnSac: '9963', isVeg: true, stockQty: 70, imageUrl: `${GCS_BASE}/restaurant/starters-appetizers/chilli-paneer.jpg` },
    { name: 'Crispy Veg Spring Rolls', category: 'Starters & Appetizers', price: 150.00, uom: 'pcs', gstRate: 5, hsnSac: '9963', isVeg: true, stockQty: 60, imageUrl: `${GCS_BASE}/restaurant/starters-appetizers/veg-spring-rolls.jpg` },
    { name: 'South Indian Veg Thali Meal', category: 'Thali & Combos', price: 160.00, uom: 'pcs', gstRate: 5, hsnSac: '9963', isVeg: true, stockQty: 140, imageUrl: `${GCS_BASE}/restaurant/meals-thali/south-indian-thali.jpg` },
    { name: 'Authentic Filter Coffee', category: 'Beverages & Desserts', price: 35.00, uom: 'pcs', gstRate: 5, hsnSac: '9963', isVeg: true, stockQty: 180, imageUrl: `${GCS_BASE}/restaurant/beverages-desserts/filter-coffee.jpg` },
    { name: 'Masala Chai / Irani Tea', category: 'Beverages & Desserts', price: 25.00, uom: 'pcs', gstRate: 5, hsnSac: '9963', isVeg: true, stockQty: 250, imageUrl: `${GCS_BASE}/restaurant/beverages-desserts/masala-chai.jpg` },
    { name: 'Sweet Lassi (Glass)', category: 'Beverages & Desserts', price: 60.00, uom: 'pcs', gstRate: 5, hsnSac: '9963', isVeg: true, stockQty: 70, imageUrl: `${GCS_BASE}/restaurant/beverages-desserts/sweet-lassi.jpg` },
    { name: 'Gulab Jamun with Ice Cream', category: 'Beverages & Desserts', price: 80.00, uom: 'pcs', gstRate: 5, hsnSac: '9963', isVeg: true, stockQty: 50, imageUrl: `${GCS_BASE}/restaurant/beverages-desserts/gulab-jamun-icecream.jpg` },
    { name: 'Packaged Mineral Water (1L)', category: 'Beverages & Desserts', price: 20.00, uom: 'pcs', gstRate: 18, hsnSac: '2201', isVeg: true, stockQty: 200, imageUrl: `${GCS_BASE}/restaurant/beverages-desserts/mineral-water.jpg` }
  ],
  retail: [
    { name: 'Men Cotton Polo T-Shirt (M)', category: 'Mens Wear', price: 499.00, uom: 'pcs', gstRate: 5, hsnSac: '6109', isVeg: true, stockQty: 40, imageUrl: `${GCS_BASE}/retail/mens-wear/polo-tshirt.jpg` },
    { name: 'Men Cotton Polo T-Shirt (L)', category: 'Mens Wear', price: 499.00, uom: 'pcs', gstRate: 5, hsnSac: '6109', isVeg: true, stockQty: 45, imageUrl: `${GCS_BASE}/retail/mens-wear/polo-tshirt.jpg` },
    { name: 'Men Cotton Polo T-Shirt (XL)', category: 'Mens Wear', price: 549.00, uom: 'pcs', gstRate: 5, hsnSac: '6109', isVeg: true, stockQty: 30, imageUrl: `${GCS_BASE}/retail/mens-wear/polo-tshirt.jpg` },
    { name: 'Men Denim Slim Jeans (32)', category: 'Mens Wear', price: 999.00, uom: 'pcs', gstRate: 12, hsnSac: '6203', isVeg: true, stockQty: 25, imageUrl: `${GCS_BASE}/retail/mens-wear/denim-jeans.jpg` },
    { name: 'Men Formal Cotton Shirt', category: 'Mens Wear', price: 799.00, uom: 'pcs', gstRate: 5, hsnSac: '6205', isVeg: true, stockQty: 35, imageUrl: `${GCS_BASE}/retail/mens-wear/formal-shirt.jpg` },
    { name: 'Womens Cotton Kurti (M)', category: 'Womens Wear', price: 599.00, uom: 'pcs', gstRate: 5, hsnSac: '6204', isVeg: true, stockQty: 40, imageUrl: `${GCS_BASE}/retail/womens-wear/cotton-kurti.jpg` },
    { name: 'Womens Printed Leggings', category: 'Womens Wear', price: 299.00, uom: 'pcs', gstRate: 5, hsnSac: '6104', isVeg: true, stockQty: 50, imageUrl: `${GCS_BASE}/retail/womens-wear/printed-leggings.jpg` },
    { name: 'Kids Casual Wear Set', category: 'Kids Wear', price: 450.00, uom: 'pcs', gstRate: 5, hsnSac: '6111', isVeg: true, stockQty: 30, imageUrl: `${GCS_BASE}/retail/kids-wear/kids-casual-set.jpg` },
    { name: 'Classmate Long Ruled Notebook (160p)', category: 'Stationery & Books', price: 65.00, uom: 'pcs', gstRate: 12, hsnSac: '4820', isVeg: true, stockQty: 100, imageUrl: `${GCS_BASE}/retail/stationery-books/classmate-notebook.jpg` },
    { name: 'Reynolds Ballpoint Pens (Pack of 5)', category: 'Stationery & Books', price: 50.00, uom: 'pack', gstRate: 18, hsnSac: '9608', isVeg: true, stockQty: 80, imageUrl: `${GCS_BASE}/retail/stationery-books/ballpoint-pens.jpg` },
    { name: 'A4 Copier Paper Ream (500 Sheets)', category: 'Stationery & Books', price: 280.00, uom: 'pack', gstRate: 12, hsnSac: '4802', isVeg: true, stockQty: 40, imageUrl: `${GCS_BASE}/retail/stationery-books/a4-copier-paper.jpg` },
    { name: 'Plastic Multipurpose Storage Basket', category: 'Home & Kitchen', price: 140.00, uom: 'pcs', gstRate: 18, hsnSac: '3924', isVeg: true, stockQty: 50, imageUrl: `${GCS_BASE}/retail/home-kitchen/storage-basket.jpg` },
    { name: 'Stainless Steel Water Bottle (1L)', category: 'Home & Kitchen', price: 320.00, uom: 'pcs', gstRate: 18, hsnSac: '7323', isVeg: true, stockQty: 35, imageUrl: `${GCS_BASE}/retail/home-kitchen/water-bottle-steel.jpg` },
    { name: 'Non-Stick Fry Pan 24cm', category: 'Home & Kitchen', price: 650.00, uom: 'pcs', gstRate: 18, hsnSac: '7615', isVeg: true, stockQty: 20, imageUrl: `${GCS_BASE}/retail/home-kitchen/non-stick-frypan.jpg` },
    { name: 'Fast USB Type-C Charging Cable 1.2m', category: 'Electronics & Mobiles', price: 199.00, uom: 'pcs', gstRate: 18, hsnSac: '8544', isVeg: true, stockQty: 60, imageUrl: `${GCS_BASE}/retail/electronics-mobiles/usb-c-cable.jpg` },
    { name: '10000mAh Fast Charging Power Bank', category: 'Electronics & Mobiles', price: 899.00, uom: 'pcs', gstRate: 18, hsnSac: '8507', isVeg: true, stockQty: 25, imageUrl: `${GCS_BASE}/retail/electronics-mobiles/power-bank.jpg` },
    { name: 'Wireless Bluetooth Earbuds', category: 'Electronics & Mobiles', price: 999.00, uom: 'pcs', gstRate: 18, hsnSac: '8518', isVeg: true, stockQty: 20, imageUrl: `${GCS_BASE}/retail/electronics-mobiles/bluetooth-earbuds.jpg` },
    { name: 'Casual Leather Wallet for Men', category: 'Accessories', price: 349.00, uom: 'pcs', gstRate: 18, hsnSac: '4202', isVeg: true, stockQty: 40, imageUrl: `${GCS_BASE}/retail/accessories/leather-wallet.jpg` },
    { name: 'Waterproof Travel Backpack 30L', category: 'Accessories', price: 799.00, uom: 'pcs', gstRate: 18, hsnSac: '4202', isVeg: true, stockQty: 25, imageUrl: `${GCS_BASE}/retail/accessories/travel-backpack.jpg` },
    { name: 'Duffle Travel Bag', category: 'Accessories', price: 650.00, uom: 'pcs', gstRate: 18, hsnSac: '4202', isVeg: true, stockQty: 20, imageUrl: `${GCS_BASE}/retail/accessories/duffle-bag.jpg` }
  ]
};

export function presetCatalog(profile: BusinessProfile) {
  const list = presets[profile] || presets.kirana;
  const categories = [...new Set(list.map(row => row.category))].map(name => ({ id: `${profile}:${name}`, name }));
  return {
    categories,
    items: list.map((item, i) => ({
      id: `preset:${profile}:${i}`,
      name: item.name,
      categoryId: `${profile}:${item.category}`,
      categoryName: item.category,
      priceMinor: Math.round(item.price * 100),
      uom: item.uom,
      isWeighed: isWeight(item.uom),
      isVeg: item.isVeg,
      gstRate: item.gstRate,
      hsnSac: item.hsnSac,
      stockQty: item.stockQty ?? 100,
      barcode: item.barcode || `89010300${String(i + 1).padStart(4, '0')}`,
      code: `${profile.toUpperCase().slice(0, 3)}-${String(i + 1).padStart(3, '0')}`,
      imageUrl: item.imageUrl,
    })),
  };
}

interface SaleLine { itemId: string; name: string; category: string; price: number; quantity: number; uom?: Uom }
interface Sale { date: string; createdAt?: string; total: number; paymentMode: string; lines: SaleLine[] }
function dateKey(sale: Sale) {
  if (sale.createdAt) {
    const date = new Date(sale.createdAt);
    return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  }
  const [day, month, year] = sale.date.split('/').map(Number);
  return year * 10000 + month * 100 + day;
}
function aggregate(sales: Sale[]) {
  const payments = { cash: 0, upi: 0, card: 0 };
  const products = new Map<string, { name: string; quantity: number; revenue: number; uom: Uom }>();
  const categories = new Map<string, number>();
  let revenue = 0;
  for (const sale of sales) {
    revenue += sale.total;
    if (sale.paymentMode in payments) payments[sale.paymentMode as keyof typeof payments] += sale.total;
    for (const line of sale.lines) {
      const uom = line.uom || 'pcs';
      const key = `${line.itemId}:${uom}`;
      const product = products.get(key) || { name: line.name, quantity: 0, revenue: 0, uom };
      product.quantity = Math.round((product.quantity + line.quantity) * 1000) / 1000;
      product.revenue += lineAmount(line.price, line.quantity);
      products.set(key, product);
      categories.set(line.category, (categories.get(line.category) || 0) + lineAmount(line.price, line.quantity));
    }
  }
  return { revenue, bills: sales.length, aov: sales.length ? revenue / sales.length : 0, payments,
    products: [...products.values()].sort((a, b) => b.revenue - a.revenue),
    categories: [...categories].map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue) };
}
export function summarizeSales(sales: Sale[], now: Date) {
  const today = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const start = today - now.getDate() + 1;
  return { today: aggregate(sales.filter(sale => dateKey(sale) === today)),
    month: aggregate(sales.filter(sale => dateKey(sale) >= start && dateKey(sale) <= today)) };
}
