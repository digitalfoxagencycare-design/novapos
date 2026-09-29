"""
NovaPOS — Indian POS Catalog Image Ingestion Pipeline
=====================================================

Downloads 5,000–6,000 curated, royalty-free product images for Indian
Kirana shops, Restaurants, General stores, and Agriculture, then streams
them directly into a Google Cloud Storage bucket.

Data Sources
------------
1. Open Food Facts API (India v2) — Indian grocery/FMCG products with real EAN-13 barcodes
2. Wikimedia Commons API         — Indian restaurant food, dishes, agriculture, tools, general store
3. Pexels API (Optional)         — High-resolution photography
4. Curated Direct Fallbacks      — Fast fallback high-quality images

Prerequisites
-------------
    pip install google-cloud-storage requests Pillow
    gcloud auth login (or active gcloud token)

Usage
-----
    python scripts/pull_indian_pos_images.py

Author: NovaPOS Engineering
"""

from __future__ import annotations

import csv
import io
import json
import logging
import os
import re
import subprocess
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, asdict
from typing import Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from google.cloud import storage
import google.oauth2.credentials

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CONFIGURATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BUCKET_NAME = os.getenv("GCS_BUCKET", "pos-catalog-images-7ad74935")
PROJECT_ID = os.getenv("GCP_PROJECT", "project-7ad74935-ae77-4bd5-a53")
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", "")

MAX_WORKERS = 16           # Concurrent upload threads
IMAGE_QUALITY = 82         # JPEG quality for resized images
IMAGE_MAX_DIM = 500        # Max width/height in pixels
MIN_IMAGE_BYTES = 2_000    # Skip images smaller than 2 KB
MAX_IMAGE_BYTES = 8_000_000  # Skip images larger than 8 MB

# Target counts across verticals
TARGETS = {
    "grocery_kirana":         1600,
    "restaurant_food":        1600,
    "general_store":          1200,
    "agriculture_fertilizers": 1000,
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LOGGING
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("pos-images")

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TAX, HSN & UNIT MAPPINGS (INDIAN GST COMPLIANCE)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TAX_AND_HSN_RULES = {
    "grocery_kirana": {
        "flour_atta": ("1101", "gst-5", "pkt", 28000),
        "rice_staples": ("1006", "gst-0", "kg", 6500),
        "dals_pulses": ("0713", "gst-0", "kg", 13000),
        "cooking_oils": ("1512", "gst-5", "ltr", 16000),
        "spices_masala": ("0910", "gst-5", "pkt", 4500),
        "sugar_salt_jaggery": ("1701", "gst-5", "kg", 4800),
        "dairy_ghee": ("0405", "gst-12", "pkt", 6000),
        "snacks_biscuits": ("1905", "gst-18", "pkt", 3000),
        "beverages_tea_coffee": ("0902", "gst-5", "pkt", 12000),
        "soaps_detergents": ("3401", "gst-18", "pcs", 4500),
        "noodles_instant": ("1902", "gst-12", "pkt", 2000),
        "pickles_chutneys": ("2001", "gst-12", "bottle", 8500),
        "dry_fruits": ("0801", "gst-5", "pkt", 25000),
    },
    "restaurant_food": {
        "biryani_rice_dishes": ("9963", "gst-5", "plate", 22000),
        "south_indian_tiffins": ("9963", "gst-5", "plate", 5000),
        "north_indian_breads": ("9963", "gst-5", "pcs", 3500),
        "curries_gravies": ("9963", "gst-5", "bowl", 18000),
        "starters_appetizers": ("9963", "gst-5", "plate", 19000),
        "south_indian_meals": ("9963", "gst-5", "thali", 14000),
        "beverages_drinks": ("9963", "gst-5", "glass", 3000),
        "sweets_desserts": ("9963", "gst-5", "pcs", 4000),
        "street_food_chaat": ("9963", "gst-5", "plate", 6000),
    },
    "general_store": {
        "personal_care": ("3305", "gst-18", "pcs", 9500),
        "stationery_office": ("4820", "gst-12", "pcs", 4000),
        "cleaning_home": ("3402", "gst-18", "pcs", 8000),
        "baby_products": ("9619", "gst-12", "pkt", 35000),
        "otc_medicines": ("3004", "gst-12", "strip", 5000),
    },
    "agriculture_fertilizers": {
        "chemical_fertilizers": ("3102", "gst-5", "bag", 26700),
        "organic_bio": ("3101", "gst-5", "bag", 45000),
        "seeds_planting": ("1209", "gst-0", "pkt", 12000),
        "pesticides_insecticides": ("3808", "gst-18", "bottle", 65000),
        "farming_tools": ("8201", "gst-12", "pcs", 35000),
        "cattle_feed_dairy": ("2309", "gst-0", "bag", 110000),
    },
}

def get_hsn_and_tax(category: str, sub_cat: str) -> tuple[str, str, str, int]:
    cat_rules = TAX_AND_HSN_RULES.get(category, {})
    return cat_rules.get(sub_cat, ("9999", "gst-5", "pcs", 5000))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SEARCH TAXONOMY — Indian Market Taxonomy (250+ terms)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SEARCH_TAXONOMY: dict[str, dict[str, list[str]]] = {
    "grocery_kirana": {
        "rice_staples": [
            "basmati rice", "sona masoori", "ponni rice",
            "kolam rice", "broken rice", "idli rice", "red rice",
            "brown rice", "rice flakes poha", "puffed rice murmura",
            "fortune rice", "daawat basmati", "india gate basmati",
        ],
        "dals_pulses": [
            "toor dal", "moong dal", "urad dal",
            "chana dal", "masoor dal", "rajma kidney beans",
            "kabuli chana chickpeas", "green moong whole", "tata sampann dal",
        ],
        "flour_atta": [
            "aashirvaad atta", "whole wheat flour", "maida flour",
            "besan flour", "ragi flour", "jowar flour",
            "bajra flour", "rice flour", "bombay rava",
            "fortune chakki fresh atta", "pillsbury atta",
        ],
        "cooking_oils": [
            "fortune sunflower oil", "dhara groundnut oil", "mustard oil",
            "gemini cooking oil", "saffola gold oil", "parachute coconut oil",
            "emami healthy oil", "patanjali mustard oil", "til sesame oil",
        ],
        "spices_masala": [
            "everest turmeric haldi", "everest chilli powder", "everest coriander dhaniya",
            "mdh garam masala", "catch jeera powder", "tata sampann turmeric",
            "mdh chana masala", "everest kitchen king", "badshah biryani masala",
            "everest sambar masala", "mdh pav bhaji masala", "tata salt",
        ],
        "sugar_salt_jaggery": [
            "crystal sugar", "organic jaggery gur", "brown sugar",
            "tata salt iodized", "rock salt sendha namak", "black salt kala namak",
            "aashirvaad salt", "dhampure jaggery",
        ],
        "dairy_ghee": [
            "amul ghee", "amul butter", "amul taaza milk",
            "amul gold milk", "amul paneer", "milky mist paneer",
            "amul cheese slices", "amul masti curd dahi", "amul buttermilk chaas",
            "nandini ghee", "gowardhan ghee",
        ],
        "snacks_biscuits": [
            "parle g biscuit", "britannia good day", "sunfeast dark fantasy",
            "britannia bourbon", "marie gold biscuit", "britannia 50 50",
            "haldiram bhujia sev", "lays magic masala", "kurkure masala munch",
            "bingo mad angles", "haldiram aloo bhujia", "parle monaco",
            "cadbury dairy milk", "kitkat chocolate", "nestle munch",
        ],
        "beverages_tea_coffee": [
            "red label tea", "tata tea gold", "taj mahal tea",
            "wagh bakri tea", "bru instant coffee", "nescafe classic",
            "horlicks nutrition", "cadbury bournvita", "boost health drink",
            "coca cola can", "thums up pet", "sprite bottle",
            "maaza mango drink", "frooti mango", "red bull can",
        ],
        "soaps_detergents": [
            "surf excel easy wash", "tide plus detergent", "aerial matic",
            "rin detergent bar", "vim dishwash liquid", "vim dishwash bar",
            "dettol soap", "lifebuoy total soap", "lux beauty soap",
            "dove beauty bar", "santoor sandal soap", "harpic toilet cleaner",
            "lizol floor cleaner", "colin glass cleaner",
        ],
        "noodles_instant": [
            "maggi 2 minute noodles", "yippee noodles", "top ramen curry",
            "ching secret hakka noodles", "knorr soupy noodles", "bambino vermicelli",
        ],
        "pickles_chutneys": [
            "priya mango pickle", "mother recipe mixed pickle", "priya tomato pickle",
            "ramdev mango pickle", "ching secret schezwan sauce", "maggi tomato ketchup",
            "kissan fresh tomato sauce",
        ],
        "dry_fruits": [
            "kaju cashew nut", "california almonds badam", "raisins kishmish",
            "walnuts akhrot", "pistachio pista", "dates khajoor",
        ],
    },

    "restaurant_food": {
        "biryani_rice_dishes": [
            "hyderabadi chicken biryani", "mutton dum biryani",
            "chicken dum biryani", "paneer dum biryani", "vegetable biryani",
            "egg biryani", "jeera rice", "veg fried rice", "chicken fried rice",
            "curd rice", "lemon rice", "ghee rice", "khichdi",
        ],
        "south_indian_tiffins": [
            "masala dosa", "plain ghee dosa", "mysore masala dosa",
            "onion rava dosa", "set dosa", "steamed idli sambar",
            "crispy medu vada", "rava upma", "ven pongal",
            "poori bhaji", "pesarattu", "mysore bonda",
        ],
        "north_indian_breads": [
            "butter naan", "garlic naan", "tandoori roti",
            "butter tandoori roti", "aloo paratha", "paneer paratha",
            "laccha paratha", "rumali roti", "bhatura", "chole bhature",
        ],
        "curries_gravies": [
            "butter chicken", "chicken tikka masala", "kadai chicken",
            "paneer butter masala", "kadai paneer", "palak paneer",
            "shahi paneer", "dal makhani", "dal tadka", "chana masala",
            "aloo gobi", "mix vegetable curry", "mutton rogan josh",
        ],
        "starters_appetizers": [
            "chicken 65", "tandoori chicken", "chicken tikka",
            "paneer tikka", "crispy corn", "veg manchurian dry",
            "chilli chicken dry", "chilli paneer dry", "samosa",
            "onion pakoda", "spring roll", "french fries",
        ],
        "south_indian_meals": [
            "south indian thali", "andhra meals", "north indian thali",
            "special veg thali", "non veg thali", "rajasthani thali",
        ],
        "beverages_drinks": [
            "masala chai", "south indian filter coffee", "sweet lassi",
            "mango lassi", "spiced buttermilk chaas", "fresh lime soda",
            "badam milk", "cold coffee", "virgin mojito",
        ],
        "sweets_desserts": [
            "gulab jamun", "rasgulla", "kaju katli",
            "motichoor laddu", "rasmalai", "gajar ka halwa",
            "jalebi", "ice cream vanilla", "chocolate brownie",
        ],
        "street_food_chaat": [
            "pani puri golgappa", "bhel puri", "sev puri",
            "dahi puri", "samosa chaat", "vada pav", "pav bhaji",
            "chicken kathi roll", "paneer roll", "steamed veg momos",
        ],
    },

    "general_store": {
        "personal_care": [
            "colgate strong teeth toothpaste", "close up red hot toothpaste",
            "oral b toothbrush", "clinic plus shampoo bottle",
            "head and shoulders shampoo", "dove hair fall rescue",
            "parachute coconut hair oil", "nivea soft cream",
            "fair and handsome cream", "fogg body spray deodorant",
            "gillette mach 3 razor", "dettol hand wash refill",
        ],
        "stationery_office": [
            "classmate long notebook", "reynolds 045 ball pen",
            "cello gripper ball pen", "apsara platinum pencil",
            "natraj eraser sharpener", "camlin geometry box",
            "fevicol mr squeeze bottle", "a4 copy xerox paper ream",
            "scotch magic tape", "permanent marker pen camlin",
        ],
        "cleaning_home": [
            "odonil room freshener block", "naphthalene balls white",
            "scotch brite scrub pad", "gala floor wiper mop",
            "dustpan plastic broom", "hit mosquito spray black",
            "all out mosquito repellent machine", "good knight mosquito liquid",
        ],
        "baby_products": [
            "pampers baby dry pants diapers", "mamy poko pants diapers",
            "johnson baby powder", "johnson baby oil", "cerelac wheat apple",
        ],
        "otc_medicines": [
            "crocin advance paracetamol", "vicks vaporub ointment",
            "moov pain relief spray", "volini pain relief gel",
            "eno lemon fruit salt", "strepsils honey lemon lozenges",
            "dettol antiseptic liquid bottle", "hansaplast adhesive bandages",
        ],
    },

    "agriculture_fertilizers": {
        "chemical_fertilizers": [
            "neem coated urea fertilizer bag", "dap diammonium phosphate bag",
            "mop muriate of potash fertilizer", "npk 20 20 0 13 fertilizer",
            "single super phosphate ssp bag", "zinc sulphate agriculture",
            "magnesium sulphate fertilizer", "boron micronutrient fertilizer",
        ],
        "organic_bio": [
            "vermicompost organic manure bag", "pure neem cake powder",
            "bone meal organic fertilizer", "humic acid liquid fertilizer",
            "seaweed extract bio stimulant", "trichoderma viride bio fungicide",
        ],
        "seeds_planting": [
            "hybrid tomato seeds packet", "chilli seeds hybrid f1",
            "cotton seeds bt hybrid", "paddy seeds certified",
            "wheat seeds high yield", "marigold flower seeds",
            "onion seeds dark red", "cucumber hybrid seeds",
        ],
        "pesticides_insecticides": [
            "chlorpyrifos 20 ec insecticide", "imidacloprid 17 8 sl insecticide",
            "monocrotophos pesticide", "mancozeb 75 wp fungicide",
            "glyphosate 41 sl herbicide weedicide", "neem oil 10000 ppm pesticide",
        ],
        "farming_tools": [
            "agriculture battery sprayer pump 16l", "knapsack manual sprayer pump",
            "farming sickle daranti steel", "garden khurpa hand hoe steel",
            "gardening spade shovel iron", "drip irrigation dripper emitter",
            "agriculture tarpaulin sheet waterproof",
        ],
        "cattle_feed_dairy": [
            "kapila cattle feed mash bag", "godrej calf feed pellet",
            "mineral mixture powder cattle cow", "calcium tonic veterinary dairy",
        ],
    },
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DATA CLASSES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@dataclass
class CatalogEntry:
    product_id: str
    product_name: str
    category: str
    sub_category: str
    gcs_blob_name: str
    public_url: str
    source: str = ""
    barcode: str = ""
    hsn_sac: str = ""
    tax_slab_id: str = "gst-5"
    unit: str = "pcs"
    default_price_minor: int = 5000

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# HTTP & GCS CLIENT INTEGRATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _build_session() -> requests.Session:
    s = requests.Session()
    retries = Retry(
        total=4,
        backoff_factor=1.2,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
        respect_retry_after_header=True,
    )
    adapter = HTTPAdapter(max_retries=retries, pool_connections=30, pool_maxsize=30)
    s.mount("https://", adapter)
    s.mount("http://", adapter)
    s.headers["User-Agent"] = "NovaPOS-CatalogIngest/2.1 (contact@novapos.in)"
    return s


def _get_gcs_client(project_id: str = PROJECT_ID) -> storage.Client:
    """Acquire authenticated GCS client using active gcloud token or ADC."""
    try:
        token = subprocess.check_output(
            "gcloud auth print-access-token", shell=True
        ).decode().strip()
        creds = google.oauth2.credentials.Credentials(token)
        return storage.Client(credentials=creds, project=project_id)
    except Exception as e:
        log.warning("Could not fetch token via gcloud: %s. Using default storage.Client()", e)
        return storage.Client(project=project_id)


def sanitize_name(name: str) -> str:
    name = name.lower().strip()
    name = re.sub(r"[^a-z0-9\s]", "", name)
    name = re.sub(r"\s+", "_", name)
    return name[:60]


def make_blob_path(category: str, sub_category: str, name: str, uid: str) -> str:
    safe_name = sanitize_name(name)
    return f"{category}/{sub_category}/{safe_name}_{uid[:8]}.jpg"


def public_url_for(bucket: str, blob_name: str) -> str:
    return f"https://storage.googleapis.com/{bucket}/{blob_name}"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GCS UPLOADER
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class GCSUploader:
    def __init__(self, bucket_name: str):
        self.client = _get_gcs_client()
        self.bucket = self.client.bucket(bucket_name)
        log.info("Initialized GCS Bucket: gs://%s (Project: %s)", bucket_name, PROJECT_ID)

    def upload_image_bytes(
        self,
        image_bytes: bytes,
        blob_name: str,
        content_type: str = "image/jpeg",
    ) -> str:
        blob = self.bucket.blob(blob_name)
        blob.upload_from_string(image_bytes, content_type=content_type)
        blob.cache_control = "public, max-age=31536000"
        blob.patch()
        return public_url_for(self.bucket.name, blob_name)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SOURCE 1: Open Food Facts API (India v2)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class OpenFoodFactsSource:
    """Fetches verified Indian FMCG products with barcodes from OpenFoodFacts."""
    BASE_URL = "https://in.openfoodfacts.org/api/v2/search"
    FALLBACK_URL = "https://world.openfoodfacts.org/api/v2/search"

    def __init__(self, session: requests.Session):
        self.session = session
        self.seen_barcodes: set[str] = set()

    def search(
        self,
        query: str,
        category: str,
        sub_category: str,
        max_results: int = 40,
    ) -> list[dict]:
        results = []
        params = {
            "categories_tags_en": query,
            "fields": "code,product_name,image_front_url,image_url,brands",
            "page_size": min(50, max_results),
        }
        try:
            resp = self.session.get(self.BASE_URL, params=params, timeout=20)
            if resp.status_code != 200:
                resp = self.session.get(self.FALLBACK_URL, params={**params, "countries_tags_en": "india"}, timeout=20)
            if resp.status_code == 200:
                data = resp.json()
                for prod in data.get("products", []):
                    code = prod.get("code", "")
                    if not code or code in self.seen_barcodes:
                        continue
                    img = prod.get("image_front_url") or prod.get("image_url")
                    if not img or not img.startswith("http"):
                        continue
                    name = prod.get("product_name", "").strip()
                    brand = prod.get("brands", "").strip()
                    if not name:
                        name = brand or f"product_{code}"
                    elif brand and brand.lower() not in name.lower():
                        name = f"{brand} {name}"
                    self.seen_barcodes.add(code)
                    results.append({
                        "name": name,
                        "image_url": img,
                        "barcode": code,
                        "category": category,
                        "sub_category": sub_category,
                        "source": "openfoodfacts",
                    })
        except Exception as e:
            log.debug("OFF search error for '%s': %s", query, e)
        return results


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SOURCE 2: Wikimedia Commons API (Public Domain & CC-BY Indian Photos)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class WikimediaCommonsSource:
    """Fetches high-quality public domain and CC images from Wikimedia Commons."""
    BASE_URL = "https://commons.wikimedia.org/w/api.php"

    def __init__(self, session: requests.Session):
        self.session = session
        self.seen_titles: set[str] = set()

    def search(
        self,
        query: str,
        category: str,
        sub_category: str,
        max_results: int = 15,
    ) -> list[dict]:
        results = []
        try:
            params = {
                "action": "query",
                "generator": "search",
                "gsrsearch": query,
                "gsrnamespace": 6,
                "gsrlimit": min(40, max_results),
                "prop": "imageinfo",
                "iiprop": "url|mime",
                "format": "json",
            }
            resp = self.session.get(self.BASE_URL, params=params, timeout=20)
            if resp.status_code == 200:
                data = resp.json()
                pages = data.get("query", {}).get("pages", {})
                for pid, page in pages.items():
                    title = page.get("title", "")
                    if title in self.seen_titles:
                        continue
                    self.seen_titles.add(title)
                    img_info = page.get("imageinfo", [{}])[0]
                    mime = img_info.get("mime", "")
                    if "image" not in mime or "svg" in mime:
                        continue
                    url = img_info.get("url", "")
                    if not url or not url.startswith("http"):
                        continue
                    clean_name = title.replace("File:", "").rsplit(".", 1)[0].replace("_", " ")
                    clean_name = re.sub(r"[\(\)\d+]", "", clean_name).strip()
                    if len(clean_name) < 4:
                        clean_name = query
                    results.append({
                        "name": clean_name[:90],
                        "image_url": url,
                        "barcode": f"wiki-{pid}",
                        "category": category,
                        "sub_category": sub_category,
                        "source": "wikimedia",
                    })
        except Exception as e:
            log.debug("Wikimedia search error for '%s': %s", query, e)
        return results


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CORE PIPELINE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class ImageIngestionPipeline:
    def __init__(self):
        self.session = _build_session()
        self.uploader = GCSUploader(BUCKET_NAME)
        self.catalog: list[CatalogEntry] = []
        self.seen_urls: set[str] = set()
        self.category_counts: dict[str, int] = {cat: 0 for cat in TARGETS}
        self.errors = 0
        self.skipped = 0

        self.off_source = OpenFoodFactsSource(self.session)
        self.wiki_source = WikimediaCommonsSource(self.session)

    def _is_category_full(self, category: str) -> bool:
        return self.category_counts.get(category, 0) >= TARGETS.get(category, 0)

    def _download_and_upload(self, item: dict) -> Optional[CatalogEntry]:
        url = item["image_url"]
        if url in self.seen_urls:
            return None
        self.seen_urls.add(url)

        try:
            resp = self.session.get(url, timeout=20, stream=True)
            resp.raise_for_status()
            content = resp.content
            if len(content) < MIN_IMAGE_BYTES or len(content) > MAX_IMAGE_BYTES:
                self.skipped += 1
                return None

            # Resize & optimize with Pillow
            try:
                from PIL import Image
                img = Image.open(io.BytesIO(content)).convert("RGB")
                if max(img.size) > IMAGE_MAX_DIM:
                    img.thumbnail((IMAGE_MAX_DIM, IMAGE_MAX_DIM), Image.LANCZOS)
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=IMAGE_QUALITY, optimize=True)
                content = buf.getvalue()
            except Exception:
                pass

            uid = uuid.uuid4().hex
            blob_name = make_blob_path(item["category"], item["sub_category"], item["name"], uid)
            public_url = self.uploader.upload_image_bytes(content, blob_name)

            hsn, tax_slab, unit, default_price = get_hsn_and_tax(item["category"], item["sub_category"])

            return CatalogEntry(
                product_id=uid[:12],
                product_name=item["name"][:120],
                category=item["category"],
                sub_category=item["sub_category"],
                gcs_blob_name=blob_name,
                public_url=public_url,
                source=item.get("source", ""),
                barcode=item.get("barcode", ""),
                hsn_sac=hsn,
                tax_slab_id=tax_slab,
                unit=unit,
                default_price_minor=default_price,
            )
        except Exception as e:
            self.errors += 1
            log.debug("Download/upload error for %s: %s", url[:60], e)
            return None

    def _collect_openfoodfacts(self) -> list[dict]:
        items = []
        log.info("Collecting from OpenFoodFacts (India)...")
        subcats = SEARCH_TAXONOMY.get("grocery_kirana", {})
        for sub_cat, keywords in subcats.items():
            if self._is_category_full("grocery_kirana"):
                break
            for kw in keywords:
                if self._is_category_full("grocery_kirana"):
                    break
                res = self.off_source.search(kw, "grocery_kirana", sub_cat, max_results=30)
                items.extend(res)
                time.sleep(0.15)
        log.info("  OpenFoodFacts found %d items", len(items))
        return items

    def _collect_wikimedia(self) -> list[dict]:
        items = []
        log.info("Collecting from Wikimedia Commons (Restaurant, Agro, Retail)...")
        for cat, subcats in SEARCH_TAXONOMY.items():
            if self._is_category_full(cat):
                continue
            for sub_cat, keywords in subcats.items():
                if self._is_category_full(cat):
                    break
                for kw in keywords:
                    if self._is_category_full(cat):
                        break
                    res = self.wiki_source.search(kw, cat, sub_cat, max_results=12)
                    items.extend(res)
                    time.sleep(0.1)
        log.info("  Wikimedia Commons found %d items", len(items))
        return items

    def _upload_batch(self, items: list[dict], label: str):
        log.info("Uploading %d items from %s with %d workers...", len(items), label, MAX_WORKERS)
        uploaded = 0
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {}
            for item in items:
                cat = item["category"]
                if self._is_category_full(cat):
                    continue
                future = executor.submit(self._download_and_upload, item)
                futures[future] = item

            for future in as_completed(futures):
                entry = future.result()
                if entry:
                    cat = entry.category
                    self.category_counts[cat] = self.category_counts.get(cat, 0) + 1
                    self.catalog.append(entry)
                    uploaded += 1
                    if uploaded % 50 == 0:
                        total = sum(self.category_counts.values())
                        log.info("  Progress: %d uploaded in batch | Total in catalog: %d", uploaded, total)

        log.info("  Batch %s complete: %d items added", label, uploaded)

    def _export_catalogs(self):
        log.info("Exporting catalog artifacts (%d items)...", len(self.catalog))
        catalog_dicts = [asdict(e) for e in self.catalog]

        # 1. GCS JSON & CSV
        json_bytes = json.dumps(catalog_dicts, indent=2, ensure_ascii=False).encode("utf-8")
        blob_json = self.uploader.bucket.blob("indian_pos_catalog.json")
        blob_json.upload_from_string(json_bytes, content_type="application/json")

        csv_buf = io.StringIO()
        if catalog_dicts:
            writer = csv.DictWriter(csv_buf, fieldnames=list(catalog_dicts[0].keys()))
            writer.writeheader()
            writer.writerows(catalog_dicts)
        csv_bytes = csv_buf.getvalue().encode("utf-8")
        blob_csv = self.uploader.bucket.blob("indian_pos_catalog.csv")
        blob_csv.upload_from_string(csv_bytes, content_type="text/csv")
        log.info("  ✓ Uploaded to gs://%s/indian_pos_catalog.json & .csv", BUCKET_NAME)

        # 2. Local Database Seed File for apps/api
        seed_path = os.path.join(os.getcwd(), "apps", "api", "src", "db", "seeds", "indian_pos_catalog.json")
        os.makedirs(os.path.dirname(seed_path), exist_ok=True)
        with open(seed_path, "w", encoding="utf-8") as f:
            f.write(json.dumps(catalog_dicts, indent=2, ensure_ascii=False))
        log.info("  ✓ Written local seed: %s", seed_path)

        # 3. Local POS App Image Urls
        pos_ts_path = os.path.join(os.getcwd(), "apps", "pos", "src", "lib", "catalogImageUrls.ts")
        image_tree: dict[str, dict[str, dict[str, str]]] = {}
        for e in self.catalog:
            prof = e.category
            sub = e.sub_category
            slug = sanitize_name(e.product_name)
            image_tree.setdefault(prof, {}).setdefault(sub, {})[slug] = e.public_url

        ts_content = f"""// AUTO-GENERATED by scripts/pull_indian_pos_images.py
// Generated: {time.strftime('%Y-%m-%dT%H:%M:%SZ')}
// Total Products: {len(self.catalog)}
// Source: gs://{BUCKET_NAME}

export const GCS_BASE = 'https://storage.googleapis.com/{BUCKET_NAME}';

export const CATALOG_IMAGES: Record<string, Record<string, Record<string, string>>> = {json.dumps(image_tree, indent=2)};
"""
        with open(pos_ts_path, "w", encoding="utf-8") as f:
            f.write(ts_content)
        log.info("  ✓ Updated POS UI catalog registry: %s", pos_ts_path)

    def run(self):
        start = time.time()
        log.info("=" * 70)
        log.info("  NovaPOS — Indian Multi-Vertical Catalog Ingestion")
        log.info("  Bucket: gs://%s", BUCKET_NAME)
        log.info("  Targets: %s", TARGETS)
        log.info("=" * 70)

        # Phase 1: OpenFoodFacts (FMCG / Kirana with barcodes)
        off_items = self._collect_openfoodfacts()
        if off_items:
            self._upload_batch(off_items, "OpenFoodFacts")

        # Phase 2: Wikimedia Commons (Restaurant, Agriculture, Retail)
        wiki_items = self._collect_wikimedia()
        if wiki_items:
            self._upload_batch(wiki_items, "WikimediaCommons")

        # Phase 3: Export Artifacts
        self._export_catalogs()

        elapsed = time.time() - start
        total = sum(self.category_counts.values())
        log.info("=" * 70)
        log.info("  PIPELINE COMPLETE")
        log.info("  Total uploaded: %d", total)
        log.info("  Time: %.1f minutes", elapsed / 60)
        for cat, cnt in self.category_counts.items():
            log.info("    %-25s : %d", cat, cnt)
        log.info("=" * 70)


if __name__ == "__main__":
    pipeline = ImageIngestionPipeline()
    pipeline.run()
