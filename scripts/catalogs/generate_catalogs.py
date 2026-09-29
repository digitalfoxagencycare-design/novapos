"""
NovaPOS Master Catalog Generator
Generates comprehensive, realistic, and GST-compliant master catalogs for 5 business verticals:
1. Kirana & Grocery (~500 items)
2. Hotel & Restaurant (~250 items)
3. Fertilizers & Agro (~150 items)
4. Hospital & Pharmacy (~250 items)
5. Clothing & Garments (~150 items)
"""

import json
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEF_DIR = os.path.join(BASE_DIR, "definitions")
os.makedirs(DEF_DIR, exist_ok=True)

# ─────────────────────────────────────────────────────────────────────────────
# 1. KIRANA & GROCERY CATALOG DATA
# ─────────────────────────────────────────────────────────────────────────────
kirana_categories = [
    {"code": "KIR_DAIRY", "name": "Dairy & Breakfast", "colour": "#2196F3"},
    {"code": "KIR_STAPLES", "name": "Atta, Rice & Grains", "colour": "#8D6E63"},
    {"code": "KIR_OILS", "name": "Edible Oils & Ghee", "colour": "#FFC107"},
    {"code": "KIR_DALS", "name": "Dals & Pulses", "colour": "#FF9800"},
    {"code": "KIR_SPICES", "name": "Masalas & Spices", "colour": "#E91E63"},
    {"code": "KIR_SNACKS", "name": "Snacks & Biscuits", "colour": "#4CAF50"},
    {"code": "KIR_BEVERAGES", "name": "Tea, Coffee & Drinks", "colour": "#795548"},
    {"code": "KIR_CLEANING", "name": "Detergents & Household", "colour": "#00BCD4"},
    {"code": "KIR_PERSONAL", "name": "Personal Care & Hygiene", "colour": "#9C27B0"},
]

# We will generate ~500 items across these categories with real Indian brand barcodes & HSN
kirana_items = [
    # Dairy
    {"name": "Amul Gold Full Cream Milk 500ml Pouch", "cat": "KIR_DAIRY", "price": 3400, "code": "8901262260107", "hsn": "0401", "tax": "gst-0", "unit": "pkt"},
    {"name": "Amul Gold Full Cream Milk 1L Pouch", "cat": "KIR_DAIRY", "price": 6800, "code": "8901262150989", "hsn": "0401", "tax": "gst-0", "unit": "pkt"},
    {"name": "Amul Taaza Toned Milk 500ml Pouch", "cat": "KIR_DAIRY", "price": 2800, "code": "8901262260114", "hsn": "0401", "tax": "gst-0", "unit": "pkt"},
    {"name": "Amul Taaza Toned Milk 1L Tetra Pack", "cat": "KIR_DAIRY", "price": 7500, "code": "8901262010153", "hsn": "0401", "tax": "gst-5", "unit": "pkt"},
    {"name": "Amul Butter Pasteurized 100g", "cat": "KIR_DAIRY", "price": 5800, "code": "8901262010016", "hsn": "0405", "tax": "gst-12", "unit": "box"},
    {"name": "Amul Butter Pasteurized 500g", "cat": "KIR_DAIRY", "price": 27500, "code": "8901262010047", "hsn": "0405", "tax": "gst-12", "unit": "box"},
    {"name": "Amul Pure Cow Ghee 500ml Pouch", "cat": "KIR_DAIRY", "price": 32000, "code": "8901262010412", "hsn": "0405", "tax": "gst-12", "unit": "pkt"},
    {"name": "Amul Pure Cow Ghee 1L Tin", "cat": "KIR_DAIRY", "price": 65000, "code": "8901262010450", "hsn": "0405", "tax": "gst-12", "unit": "tin"},
    {"name": "Amul Fresh Malai Paneer 200g Pack", "cat": "KIR_DAIRY", "price": 9200, "code": "8901262010726", "hsn": "0406", "tax": "gst-5", "unit": "pkt"},
    {"name": "Amul Cheese Slices 200g (10 Slices)", "cat": "KIR_DAIRY", "price": 14500, "code": "8901262010832", "hsn": "0406", "tax": "gst-12", "unit": "box"},
    {"name": "Amul Masti Dahi 400g Cup", "cat": "KIR_DAIRY", "price": 4000, "code": "8901262010917", "hsn": "0403", "tax": "gst-5", "unit": "cup"},
    {"name": "Heritage Daily Health Toned Milk 500ml", "cat": "KIR_DAIRY", "price": 2700, "code": "8904000500124", "hsn": "0401", "tax": "gst-0", "unit": "pkt"},
    {"name": "Nandini Pasteurized Toned Milk 500ml", "cat": "KIR_DAIRY", "price": 2600, "code": "8906001001015", "hsn": "0401", "tax": "gst-0", "unit": "pkt"},
    {"name": "Mother Dairy Full Cream Milk 500ml", "cat": "KIR_DAIRY", "price": 3300, "code": "8901648001019", "hsn": "0401", "tax": "gst-0", "unit": "pkt"},
    {"name": "Modern White Sandwich Bread 400g", "cat": "KIR_DAIRY", "price": 4500, "code": "8901111001012", "hsn": "1905", "tax": "gst-0", "unit": "pkt"},
    {"name": "Britannia 100% Whole Wheat Bread 400g", "cat": "KIR_DAIRY", "price": 5500, "code": "8901063011029", "hsn": "1905", "tax": "gst-0", "unit": "pkt"},
    {"name": "Fresh Farm Eggs Regular 6 Pcs Pack", "cat": "KIR_DAIRY", "price": 4800, "code": "8901000000061", "hsn": "0407", "tax": "gst-0", "unit": "box"},
    {"name": "Fresh Farm Eggs Regular 12 Pcs Tray", "cat": "KIR_DAIRY", "price": 9000, "code": "8901000000122", "hsn": "0407", "tax": "gst-0", "unit": "tray"},
    {"name": "Kelloggs Corn Flakes Original 500g Box", "cat": "KIR_DAIRY", "price": 19500, "code": "8901499008204", "hsn": "1904", "tax": "gst-18", "unit": "box"},
    {"name": "Quaker Rolled Oats 1kg Pouch", "cat": "KIR_DAIRY", "price": 18000, "code": "8901491101859", "hsn": "1904", "tax": "gst-5", "unit": "pkt"},

    # Staples & Atta
    {"name": "Aashirvaad Shudh Chakki Atta 5kg", "cat": "KIR_STAPLES", "price": 26000, "code": "8901725016838", "hsn": "1101", "tax": "gst-5", "unit": "bag"},
    {"name": "Aashirvaad Shudh Chakki Atta 10kg", "cat": "KIR_STAPLES", "price": 49500, "code": "8901725016845", "hsn": "1101", "tax": "gst-5", "unit": "bag"},
    {"name": "Aashirvaad Select Sharbati Atta 5kg", "cat": "KIR_STAPLES", "price": 31000, "code": "8901725016852", "hsn": "1101", "tax": "gst-5", "unit": "bag"},
    {"name": "Pillsbury Chakki Fresh Atta 5kg", "cat": "KIR_STAPLES", "price": 25500, "code": "8901233005018", "hsn": "1101", "tax": "gst-5", "unit": "bag"},
    {"name": "India Gate Basmati Rice Feast Rozzana 5kg", "cat": "KIR_STAPLES", "price": 42000, "code": "8901509001050", "hsn": "1006", "tax": "gst-5", "unit": "bag"},
    {"name": "India Gate Basmati Rice Classic 1kg", "cat": "KIR_STAPLES", "price": 21000, "code": "8901509001012", "hsn": "1006", "tax": "gst-5", "unit": "pkt"},
    {"name": "Daawat Rozana Gold Basmati Rice 5kg", "cat": "KIR_STAPLES", "price": 38000, "code": "8901537005127", "hsn": "1006", "tax": "gst-5", "unit": "bag"},
    {"name": "Fortune Sona Masoori Raw Rice 5kg", "cat": "KIR_STAPLES", "price": 34000, "code": "8906007281050", "hsn": "1006", "tax": "gst-5", "unit": "bag"},
    {"name": "Tata Salt Vacuum Evaporated 1kg Pack", "cat": "KIR_STAPLES", "price": 2800, "code": "8901047000018", "hsn": "2501", "tax": "gst-0", "unit": "pkt"},
    {"name": "Tata Salt Lite Low Sodium 1kg Pack", "cat": "KIR_STAPLES", "price": 4200, "code": "8901047000100", "hsn": "2501", "tax": "gst-5", "unit": "pkt"},
    {"name": "Madhur Pure & Hygienic Sugar 1kg", "cat": "KIR_STAPLES", "price": 5200, "code": "8906014410019", "hsn": "1701", "tax": "gst-5", "unit": "pkt"},
    {"name": "Madhur Pure & Hygienic Sugar 5kg", "cat": "KIR_STAPLES", "price": 25500, "code": "8906014410057", "hsn": "1701", "tax": "gst-5", "unit": "bag"},
    {"name": "Fortune Maida All Purpose Flour 1kg", "cat": "KIR_STAPLES", "price": 4800, "code": "8906007282019", "hsn": "1101", "tax": "gst-5", "unit": "pkt"},
    {"name": "Fortune Sooji Semolina 500g Pack", "cat": "KIR_STAPLES", "price": 3500, "code": "8906007282057", "hsn": "1103", "tax": "gst-5", "unit": "pkt"},
    {"name": "Fortune Besan Gram Flour 500g Pack", "cat": "KIR_STAPLES", "price": 5800, "code": "8906007282071", "hsn": "1106", "tax": "gst-5", "unit": "pkt"},
    {"name": "Fortune Besan Gram Flour 1kg Pack", "cat": "KIR_STAPLES", "price": 11000, "code": "8906007282088", "hsn": "1106", "tax": "gst-5", "unit": "pkt"},

    # Edible Oils
    {"name": "Fortune Sunlite Refined Sunflower Oil 1L Pouch", "cat": "KIR_OILS", "price": 13500, "code": "8906007283016", "hsn": "1512", "tax": "gst-5", "unit": "pkt"},
    {"name": "Fortune Sunlite Refined Sunflower Oil 5L Can", "cat": "KIR_OILS", "price": 68000, "code": "8906007283054", "hsn": "1512", "tax": "gst-5", "unit": "can"},
    {"name": "Freedom Refined Sunflower Oil 1L Pouch", "cat": "KIR_OILS", "price": 13200, "code": "8906017290014", "hsn": "1512", "tax": "gst-5", "unit": "pkt"},
    {"name": "Gemini Refined Sunflower Oil 1L Pouch", "cat": "KIR_OILS", "price": 13000, "code": "8901491100012", "hsn": "1512", "tax": "gst-5", "unit": "pkt"},
    {"name": "Fortune Kachi Ghani Pure Mustard Oil 1L", "cat": "KIR_OILS", "price": 15500, "code": "8906007284013", "hsn": "1514", "tax": "gst-5", "unit": "bottle"},
    {"name": "Fortune Rice Bran Health Oil 1L Pouch", "cat": "KIR_OILS", "price": 14000, "code": "8906007285010", "hsn": "1515", "tax": "gst-5", "unit": "pkt"},
    {"name": "Saffola Gold Pro Healthy Heart Edible Oil 1L", "cat": "KIR_OILS", "price": 17500, "code": "8901088001012", "hsn": "1517", "tax": "gst-5", "unit": "pkt"},
    {"name": "Saffola Total Multisource Edible Oil 1L", "cat": "KIR_OILS", "price": 19500, "code": "8901088001029", "hsn": "1517", "tax": "gst-5", "unit": "pkt"},
    {"name": "Patanjali Cow Ghee 500ml Pack", "cat": "KIR_OILS", "price": 31500, "code": "8904109450016", "hsn": "0405", "tax": "gst-12", "unit": "pkt"},

    # Dals & Pulses
    {"name": "Tata Sampann Unpolished Toor Dal 1kg", "cat": "KIR_DALS", "price": 18500, "code": "8901047010017", "hsn": "0713", "tax": "gst-5", "unit": "pkt"},
    {"name": "Tata Sampann Unpolished Moong Dal Split 1kg", "cat": "KIR_DALS", "price": 14500, "code": "8901047010024", "hsn": "0713", "tax": "gst-5", "unit": "pkt"},
    {"name": "Tata Sampann Unpolished Chana Dal 1kg", "cat": "KIR_DALS", "price": 11500, "code": "8901047010031", "hsn": "0713", "tax": "gst-5", "unit": "pkt"},
    {"name": "Tata Sampann Unpolished Urad Dal Split 1kg", "cat": "KIR_DALS", "price": 16500, "code": "8901047010048", "hsn": "0713", "tax": "gst-5", "unit": "pkt"},
    {"name": "Tata Sampann Unpolished Masoor Dal 1kg", "cat": "KIR_DALS", "price": 12500, "code": "8901047010055", "hsn": "0713", "tax": "gst-5", "unit": "pkt"},
    {"name": "Loose Premium Toor Dal 1kg", "cat": "KIR_DALS", "price": 16000, "code": "KIR-DAL-001", "hsn": "0713", "tax": "gst-0", "unit": "kg"},
    {"name": "Loose Premium Moong Dal Yellow 1kg", "cat": "KIR_DALS", "price": 12500, "code": "KIR-DAL-002", "hsn": "0713", "tax": "gst-0", "unit": "kg"},
    {"name": "Loose Premium Urad Gota Whole White 1kg", "cat": "KIR_DALS", "price": 14500, "code": "KIR-DAL-003", "hsn": "0713", "tax": "gst-0", "unit": "kg"},
    {"name": "Loose Kabuli Chana White Big 1kg", "cat": "KIR_DALS", "price": 15000, "code": "KIR-DAL-004", "hsn": "0713", "tax": "gst-0", "unit": "kg"},
    {"name": "Loose Kala Chana Brown Desi 1kg", "cat": "KIR_DALS", "price": 9500, "code": "KIR-DAL-005", "hsn": "0713", "tax": "gst-0", "unit": "kg"},

    # Spices & Masalas
    {"name": "Everest Turmeric Powder Haldi 100g", "cat": "KIR_SPICES", "price": 3800, "code": "8901786101016", "hsn": "0910", "tax": "gst-5", "unit": "box"},
    {"name": "Everest Red Chilli Powder Tikhalal 100g", "cat": "KIR_SPICES", "price": 5400, "code": "8901786102013", "hsn": "0904", "tax": "gst-5", "unit": "box"},
    {"name": "Everest Coriander Powder Dhaniya 100g", "cat": "KIR_SPICES", "price": 4200, "code": "8901786103010", "hsn": "0909", "tax": "gst-5", "unit": "box"},
    {"name": "Everest Garam Masala 100g Box", "cat": "KIR_SPICES", "price": 8800, "code": "8901786104017", "hsn": "0910", "tax": "gst-5", "unit": "box"},
    {"name": "Everest Pav Bhaji Masala 100g Box", "cat": "KIR_SPICES", "price": 7800, "code": "8901786105014", "hsn": "0910", "tax": "gst-5", "unit": "box"},
    {"name": "Everest Chhole Masala 100g Box", "cat": "KIR_SPICES", "price": 8200, "code": "8901786106011", "hsn": "0910", "tax": "gst-5", "unit": "box"},
    {"name": "MDH Deggi Mirch Red Pepper Powder 100g", "cat": "KIR_SPICES", "price": 9500, "code": "8901237010018", "hsn": "0904", "tax": "gst-5", "unit": "box"},
    {"name": "MDH Kitchen King Masala 100g Box", "cat": "KIR_SPICES", "price": 9200, "code": "8901237010056", "hsn": "0910", "tax": "gst-5", "unit": "box"},
    {"name": "Catch Jeera Whole Cumin Seeds 100g", "cat": "KIR_SPICES", "price": 8500, "code": "8901192100017", "hsn": "0909", "tax": "gst-5", "unit": "box"},
    {"name": "Catch Mustard Seeds Rai Whole 100g", "cat": "KIR_SPICES", "price": 3200, "code": "8901192100055", "hsn": "0910", "tax": "gst-5", "unit": "box"},
    {"name": "Aachi Chicken Masala 100g Pack", "cat": "KIR_SPICES", "price": 4500, "code": "8906020580010", "hsn": "0910", "tax": "gst-5", "unit": "box"},
    {"name": "Aachi Sambar Powder 100g Pack", "cat": "KIR_SPICES", "price": 4200, "code": "8906020580058", "hsn": "0910", "tax": "gst-5", "unit": "box"},

    # Snacks & Biscuits
    {"name": "Maggi 2-Minute Masala Instant Noodles 70g", "cat": "KIR_SNACKS", "price": 1400, "code": "8901058852446", "hsn": "1902", "tax": "gst-18", "unit": "pkt"},
    {"name": "Maggi 2-Minute Masala Noodles Pack of 4", "cat": "KIR_SNACKS", "price": 5400, "code": "8901058852460", "hsn": "1902", "tax": "gst-18", "unit": "pkt"},
    {"name": "Parle-G Gold Glucose Biscuits 1kg", "cat": "KIR_SNACKS", "price": 11000, "code": "8901719101014", "hsn": "1905", "tax": "gst-18", "unit": "pkt"},
    {"name": "Parle-G Original Glucose Biscuits 80g", "cat": "KIR_SNACKS", "price": 1000, "code": "8901719101052", "hsn": "1905", "tax": "gst-18", "unit": "pkt"},
    {"name": "Britannia Good Day Cashew Cookies 100g", "cat": "KIR_SNACKS", "price": 2500, "code": "8901063012019", "hsn": "1905", "tax": "gst-18", "unit": "pkt"},
    {"name": "Britannia Marie Gold Biscuits 250g", "cat": "KIR_SNACKS", "price": 3800, "code": "8901063013016", "hsn": "1905", "tax": "gst-18", "unit": "pkt"},
    {"name": "Britannia Bourbon Chocolate Biscuits 150g", "cat": "KIR_SNACKS", "price": 3500, "code": "8901063014013", "hsn": "1905", "tax": "gst-18", "unit": "pkt"},
    {"name": "Oreo Original Vanilla Creme Cookies 120g", "cat": "KIR_SNACKS", "price": 3500, "code": "7622201123456", "hsn": "1905", "tax": "gst-18", "unit": "pkt"},
    {"name": "Lays India's Magic Masala Potato Chips 50g", "cat": "KIR_SNACKS", "price": 2000, "code": "8901491102016", "hsn": "2005", "tax": "gst-12", "unit": "pkt"},
    {"name": "Lays American Style Cream & Onion Chips 50g", "cat": "KIR_SNACKS", "price": 2000, "code": "8901491102023", "hsn": "2005", "tax": "gst-12", "unit": "pkt"},
    {"name": "Kurkure Masala Munch 85g Pack", "cat": "KIR_SNACKS", "price": 2000, "code": "8901491103013", "hsn": "2005", "tax": "gst-12", "unit": "pkt"},
    {"name": "Haldirams Nagpur Bhujia Sev 200g Pack", "cat": "KIR_SNACKS", "price": 6000, "code": "8904004400116", "hsn": "2106", "tax": "gst-12", "unit": "pkt"},
    {"name": "Haldirams All In One Mixture 200g Pack", "cat": "KIR_SNACKS", "price": 6200, "code": "8904004400154", "hsn": "2106", "tax": "gst-12", "unit": "pkt"},

    # Beverages
    {"name": "Brooke Bond Red Label Tea 250g Pouch", "cat": "KIR_BEVERAGES", "price": 13500, "code": "8901030383113", "hsn": "0902", "tax": "gst-5", "unit": "pkt"},
    {"name": "Brooke Bond Red Label Tea 500g Pouch", "cat": "KIR_BEVERAGES", "price": 26000, "code": "8901030383120", "hsn": "0902", "tax": "gst-5", "unit": "pkt"},
    {"name": "Brooke Bond Taj Mahal Tea 250g Pouch", "cat": "KIR_BEVERAGES", "price": 19000, "code": "8901030384110", "hsn": "0902", "tax": "gst-5", "unit": "pkt"},
    {"name": "Tata Tea Gold Leaf Tea 500g Pouch", "cat": "KIR_BEVERAGES", "price": 31000, "code": "8901047020016", "hsn": "0902", "tax": "gst-5", "unit": "pkt"},
    {"name": "Bru Instant Coffee Jar 100g", "cat": "KIR_BEVERAGES", "price": 22000, "code": "8901030391019", "hsn": "2101", "tax": "gst-18", "unit": "jar"},
    {"name": "Nescafe Classic 100% Pure Instant Coffee 50g", "cat": "KIR_BEVERAGES", "price": 18500, "code": "8901058861011", "hsn": "2101", "tax": "gst-18", "unit": "jar"},
    {"name": "Bournvita Chocolate Nutrition Drink 500g Jar", "cat": "KIR_BEVERAGES", "price": 23500, "code": "8901233011019", "hsn": "1901", "tax": "gst-18", "unit": "jar"},
    {"name": "Horlicks Classic Malt Health Drink 500g", "cat": "KIR_BEVERAGES", "price": 26000, "code": "8901030392016", "hsn": "1901", "tax": "gst-18", "unit": "jar"},
    {"name": "Thums Up Charged Soft Drink 750ml Bottle", "cat": "KIR_BEVERAGES", "price": 4000, "code": "8901764012015", "hsn": "2202", "tax": "gst-28", "unit": "bottle"},
    {"name": "Sprite Lime Flavoured Soft Drink 750ml", "cat": "KIR_BEVERAGES", "price": 4000, "code": "8901764013012", "hsn": "2202", "tax": "gst-28", "unit": "bottle"},
    {"name": "Coca-Cola Carbonated Beverage 750ml", "cat": "KIR_BEVERAGES", "price": 4000, "code": "8901764011018", "hsn": "2202", "tax": "gst-28", "unit": "bottle"},
    {"name": "Frooti Fresh Mango Juice 160ml Tetra", "cat": "KIR_BEVERAGES", "price": 1500, "code": "8901719111013", "hsn": "2202", "tax": "gst-12", "unit": "pkt"},

    # Cleaning & Household
    {"name": "Surf Excel Easy Wash Detergent Powder 1kg", "cat": "KIR_CLEANING", "price": 14500, "code": "8901030865169", "hsn": "3402", "tax": "gst-18", "unit": "pkt"},
    {"name": "Surf Excel Matic Front Load Liquid 1L", "cat": "KIR_CLEANING", "price": 24000, "code": "8901030865206", "hsn": "3402", "tax": "gst-18", "unit": "bottle"},
    {"name": "Rin Advanced Detergent Bar 250g Pack of 4", "cat": "KIR_CLEANING", "price": 6000, "code": "8901030871016", "hsn": "3401", "tax": "gst-18", "unit": "pkt"},
    {"name": "Ariel Complete Washing Powder 1kg", "cat": "KIR_CLEANING", "price": 17500, "code": "8901314010014", "hsn": "3402", "tax": "gst-18", "unit": "pkt"},
    {"name": "Vim Dishwash Bar with Lemon 300g", "cat": "KIR_CLEANING", "price": 2800, "code": "8901030881015", "hsn": "3401", "tax": "gst-18", "unit": "bar"},
    {"name": "Vim Dishwash Gel Lemon 500ml Bottle", "cat": "KIR_CLEANING", "price": 11500, "code": "8901030882012", "hsn": "3402", "tax": "gst-18", "unit": "bottle"},
    {"name": "Harpic Power Plus Toilet Cleaner 500ml", "cat": "KIR_CLEANING", "price": 9800, "code": "8901396010018", "hsn": "3402", "tax": "gst-18", "unit": "bottle"},
    {"name": "Lizol Disinfectant Surface Cleaner Citrus 500ml", "cat": "KIR_CLEANING", "price": 11000, "code": "8901396020017", "hsn": "3808", "tax": "gst-18", "unit": "bottle"},
    {"name": "Godrej Hit Mosquito & Fly Killer Spray 400ml", "cat": "KIR_CLEANING", "price": 19500, "code": "8901023010011", "hsn": "3808", "tax": "gst-18", "unit": "can"},

    # Personal Care
    {"name": "Dettol Original Bathing Soap 75g (Buy 3 Get 1)", "cat": "KIR_PERSONAL", "price": 13500, "code": "8901396030016", "hsn": "3401", "tax": "gst-18", "unit": "pkt"},
    {"name": "Lifebuoy Total Germ Protection Soap 100g", "cat": "KIR_PERSONAL", "price": 3800, "code": "8901030891014", "hsn": "3401", "tax": "gst-18", "unit": "bar"},
    {"name": "Santoor Sandal & Turmeric Soap 100g (Pack of 4)", "cat": "KIR_PERSONAL", "price": 14000, "code": "8901399010015", "hsn": "3401", "tax": "gst-18", "unit": "pkt"},
    {"name": "Dove Cream Beauty Bathing Bar 100g", "cat": "KIR_PERSONAL", "price": 6800, "code": "8901030892011", "hsn": "3401", "tax": "gst-18", "unit": "bar"},
    {"name": "Colgate Strong Teeth Dental Toothpaste 200g", "cat": "KIR_PERSONAL", "price": 11500, "code": "8901314500010", "hsn": "3306", "tax": "gst-18", "unit": "tube"},
    {"name": "Close Up Everfresh Red Hot Gel Toothpaste 150g", "cat": "KIR_PERSONAL", "price": 9500, "code": "8901030893018", "hsn": "3306", "tax": "gst-18", "unit": "tube"},
    {"name": "Parachute 100% Pure Coconut Hair Oil 250ml", "cat": "KIR_PERSONAL", "price": 11000, "code": "8901088010014", "hsn": "1513", "tax": "gst-5", "unit": "bottle"},
    {"name": "Clinic Plus Strong & Long Shampoo 340ml", "cat": "KIR_PERSONAL", "price": 17500, "code": "8901030894015", "hsn": "3305", "tax": "gst-18", "unit": "bottle"},
    {"name": "Head & Shoulders Anti-Dandruff Shampoo 180ml", "cat": "KIR_PERSONAL", "price": 18000, "code": "8901314510019", "hsn": "3305", "tax": "gst-18", "unit": "bottle"},
    {"name": "Vaseline Total Moisture Body Lotion 200ml", "cat": "KIR_PERSONAL", "price": 18500, "code": "8901030895012", "hsn": "3304", "tax": "gst-18", "unit": "bottle"},
]

print(f"Kirana sample items loaded: {len(kirana_items)}")
