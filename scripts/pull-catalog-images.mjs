#!/usr/bin/env node
/**
 * pull-catalog-images.mjs
 *
 * Downloads product images from Unsplash (open source, free to use) and uploads
 * them to a Google Cloud Storage bucket organized by business profile.
 *
 * Usage:
 *   node scripts/pull-catalog-images.mjs
 *
 * Prerequisites:
 *   - gcloud CLI authenticated
 *   - gsutil / gcloud storage available
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const BUCKET = 'pos-catalog-images-7ad74935';
const BASE_URL = `https://storage.googleapis.com/${BUCKET}`;
const LOCAL_DIR = path.join(process.cwd(), '.catalog-images');

// ─────────────────────── Image Catalog ───────────────────────
// All images are from Unsplash (free, open-source, no attribution required for software)
// Organized: bucket/profile/category/item-name.jpg

const CATALOG = {
  // ═══════════════════════════════════════════════════════════
  // KIRANA & SUPERMARKET
  // ═══════════════════════════════════════════════════════════
  kirana: {
    'rice-staples': {
      'sona-masoori-rice':    'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=80',
      'basmati-rice':         'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=400&auto=format&fit=crop&q=80',
      'toor-dal':             'https://images.unsplash.com/photo-1612257999756-3e6f2e4e2f74?w=400&auto=format&fit=crop&q=80',
      'moong-dal':            'https://images.unsplash.com/photo-1612257999756-3e6f2e4e2f74?w=400&auto=format&fit=crop&q=80',
      'urad-dal':             'https://images.unsplash.com/photo-1612257999756-3e6f2e4e2f74?w=400&auto=format&fit=crop&q=80',
      'chana-dal':            'https://images.unsplash.com/photo-1612257999756-3e6f2e4e2f74?w=400&auto=format&fit=crop&q=80',
    },
    'flour-atta': {
      'aashirvaad-atta':      'https://images.unsplash.com/photo-1608686207856-001b95cf60ca?w=400&auto=format&fit=crop&q=80',
      'maida-flour':          'https://images.unsplash.com/photo-1608686207856-001b95cf60ca?w=400&auto=format&fit=crop&q=80',
      'bombay-rava':          'https://images.unsplash.com/photo-1608686207856-001b95cf60ca?w=400&auto=format&fit=crop&q=80',
    },
    'sugar-salt': {
      'crystal-sugar':        'https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=400&auto=format&fit=crop&q=80',
      'tata-salt':            'https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=400&auto=format&fit=crop&q=80',
    },
    'edible-oils': {
      'sunflower-oil':        'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80',
      'groundnut-oil':        'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80',
    },
    'dairy-ghee': {
      'cow-ghee':             'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&auto=format&fit=crop&q=80',
      'toned-milk':           'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&auto=format&fit=crop&q=80',
      'amul-butter':          'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&auto=format&fit=crop&q=80',
      'curd-dahi':            'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&auto=format&fit=crop&q=80',
    },
    'spices-masala': {
      'turmeric-haldi':       'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&auto=format&fit=crop&q=80',
      'red-chilli-powder':    'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&auto=format&fit=crop&q=80',
      'coriander-powder':     'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&auto=format&fit=crop&q=80',
      'mustard-seeds':        'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&auto=format&fit=crop&q=80',
      'jeera-cumin':          'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&auto=format&fit=crop&q=80',
      'garam-masala':         'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&auto=format&fit=crop&q=80',
    },
    'beverages': {
      'red-label-tea':        'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=80',
      'bru-instant-coffee':   'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=80',
      'bournvita':            'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&auto=format&fit=crop&q=80',
      'coca-cola':            'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&auto=format&fit=crop&q=80',
      'sprite':               'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=400&auto=format&fit=crop&q=80',
    },
    'snacks-biscuits': {
      'maggi-noodles':        'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=400&auto=format&fit=crop&q=80',
      'parle-g-biscuits':     'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&auto=format&fit=crop&q=80',
      'britannia-good-day':   'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&auto=format&fit=crop&q=80',
      'lays-chips':           'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&auto=format&fit=crop&q=80',
      'haldirams-bhujia':     'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&auto=format&fit=crop&q=80',
      'dairy-milk-silk':      'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=400&auto=format&fit=crop&q=80',
    },
    'personal-home-care': {
      'lifebuoy-soap':        'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80',
      'dettol-soap':          'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80',
      'colgate-toothpaste':   'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80',
      'clinic-plus-shampoo':  'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80',
      'surf-excel-powder':    'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80',
      'vim-dishwash':         'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80',
      'harpic-cleaner':       'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80',
      'goodknight-refill':    'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80',
    },
  },

  // ═══════════════════════════════════════════════════════════
  // RESTAURANT & CAFE
  // ═══════════════════════════════════════════════════════════
  restaurant: {
    'biryanis-rice': {
      'chicken-dum-biryani':      'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&auto=format&fit=crop&q=80',
      'mutton-biryani':           'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=400&auto=format&fit=crop&q=80',
      'paneer-dum-biryani':       'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&auto=format&fit=crop&q=80',
      'jeera-rice-dal-tadka':     'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&auto=format&fit=crop&q=80',
      'veg-biryani':              'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&auto=format&fit=crop&q=80',
      'veg-fried-rice':           'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&auto=format&fit=crop&q=80',
    },
    'breakfast-tiffins': {
      'masala-dosa':              'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400&auto=format&fit=crop&q=80',
      'plain-dosa':               'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400&auto=format&fit=crop&q=80',
      'idli-sambar':              'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&auto=format&fit=crop&q=80',
      'medu-vada':                'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=400&auto=format&fit=crop&q=80',
      'poori-bhaji':              'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=400&auto=format&fit=crop&q=80',
      'onion-dosa':               'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400&auto=format&fit=crop&q=80',
      'bonda':                    'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&auto=format&fit=crop&q=80',
      'chapathi':                 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&auto=format&fit=crop&q=80',
      'upma':                     'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&auto=format&fit=crop&q=80',
    },
    'curries-gravies': {
      'paneer-butter-masala':     'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&auto=format&fit=crop&q=80',
      'butter-chicken':           'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&auto=format&fit=crop&q=80',
      'chicken-curry':            'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&auto=format&fit=crop&q=80',
      'mutton-curry':             'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&auto=format&fit=crop&q=80',
      'dal-makhani':              'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&auto=format&fit=crop&q=80',
      'dal-tadka':                'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&auto=format&fit=crop&q=80',
      'egg-curry':                'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&auto=format&fit=crop&q=80',
    },
    'starters-appetizers': {
      'chicken-65':               'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=400&auto=format&fit=crop&q=80',
      'chilli-paneer':            'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400&auto=format&fit=crop&q=80',
      'veg-spring-rolls':         'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=400&auto=format&fit=crop&q=80',
      'samosa':                   'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&auto=format&fit=crop&q=80',
    },
    'breads-tandoor': {
      'butter-naan':              'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&auto=format&fit=crop&q=80',
      'tandoori-roti':            'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&auto=format&fit=crop&q=80',
      'paratha':                  'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&auto=format&fit=crop&q=80',
    },
    'meals-thali': {
      'veg-meals-unlimited':      'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=400&auto=format&fit=crop&q=80',
      'non-veg-meals':            'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=400&auto=format&fit=crop&q=80',
      'south-indian-thali':       'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=400&auto=format&fit=crop&q=80',
    },
    'beverages-desserts': {
      'filter-coffee':            'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=80',
      'masala-chai':              'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=80',
      'irani-chai':               'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=80',
      'sweet-lassi':              'https://images.unsplash.com/photo-1528740561666-dc2479dc08ab?w=400&auto=format&fit=crop&q=80',
      'fresh-lime-soda':          'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&auto=format&fit=crop&q=80',
      'masala-buttermilk':        'https://images.unsplash.com/photo-1528740561666-dc2479dc08ab?w=400&auto=format&fit=crop&q=80',
      'mineral-water':            'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=400&auto=format&fit=crop&q=80',
      'gulab-jamun-icecream':     'https://images.unsplash.com/photo-1560008511-11c63416e52d?w=400&auto=format&fit=crop&q=80',
    },
  },

  // ═══════════════════════════════════════════════════════════
  // BAKERY & SWEETS
  // ═══════════════════════════════════════════════════════════
  bakery: {
    'dry-fruit-sweets': {
      'kaju-katli':              'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=400&auto=format&fit=crop&q=80',
      'kaju-pista-roll':         'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=400&auto=format&fit=crop&q=80',
    },
    'ghee-sweets': {
      'mysore-pak':              'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&auto=format&fit=crop&q=80',
      'motichoor-laddu':         'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&auto=format&fit=crop&q=80',
    },
    'syrup-sweets': {
      'gulab-jamun':             'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&auto=format&fit=crop&q=80',
      'rasgulla':                'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&auto=format&fit=crop&q=80',
    },
    'fresh-breads': {
      'milk-bread':              'https://images.unsplash.com/photo-1549931319-a545753467c8?w=400&auto=format&fit=crop&q=80',
      'brown-wheat-bread':       'https://images.unsplash.com/photo-1549931319-a545753467c8?w=400&auto=format&fit=crop&q=80',
      'pav-buns':                'https://images.unsplash.com/photo-1549931319-a545753467c8?w=400&auto=format&fit=crop&q=80',
    },
    'pastries-buns': {
      'butter-croissant':        'https://images.unsplash.com/photo-1555507036-ab1f4038024a?w=400&auto=format&fit=crop&q=80',
    },
    'savouries-puffs': {
      'veg-puff':                'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&auto=format&fit=crop&q=80',
      'paneer-tikka-puff':       'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&auto=format&fit=crop&q=80',
      'egg-puff':                'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&auto=format&fit=crop&q=80',
    },
    'cakes-pastries': {
      'black-forest-pastry':     'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&auto=format&fit=crop&q=80',
      'red-velvet-pastry':       'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&auto=format&fit=crop&q=80',
      'chocolate-cake':          'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&auto=format&fit=crop&q=80',
      'pineapple-cake':          'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&auto=format&fit=crop&q=80',
    },
    'cookies-biscuits': {
      'osmania-biscuits':        'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&auto=format&fit=crop&q=80',
      'fruit-biscuits':          'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&auto=format&fit=crop&q=80',
    },
    'gift-boxes': {
      'assorted-sweet-box':      'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=400&auto=format&fit=crop&q=80',
    },
  },

  // ═══════════════════════════════════════════════════════════
  // GENERAL RETAIL
  // ═══════════════════════════════════════════════════════════
  retail: {
    'mens-wear': {
      'polo-tshirt':             'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&auto=format&fit=crop&q=80',
      'denim-jeans':             'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&auto=format&fit=crop&q=80',
      'formal-shirt':            'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&auto=format&fit=crop&q=80',
    },
    'womens-wear': {
      'cotton-kurti':            'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=400&auto=format&fit=crop&q=80',
      'printed-leggings':        'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=400&auto=format&fit=crop&q=80',
    },
    'kids-wear': {
      'kids-casual-set':         'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=400&auto=format&fit=crop&q=80',
    },
    'stationery-books': {
      'classmate-notebook':      'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400&auto=format&fit=crop&q=80',
      'ballpoint-pens':          'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400&auto=format&fit=crop&q=80',
      'a4-copier-paper':         'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400&auto=format&fit=crop&q=80',
    },
    'home-kitchen': {
      'storage-basket':          'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&auto=format&fit=crop&q=80',
      'water-bottle-steel':      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&auto=format&fit=crop&q=80',
      'non-stick-frypan':        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&auto=format&fit=crop&q=80',
    },
    'electronics-mobiles': {
      'usb-c-cable':             'https://images.unsplash.com/photo-1606904825846-647eb07f5be2?w=400&auto=format&fit=crop&q=80',
      'power-bank':              'https://images.unsplash.com/photo-1606904825846-647eb07f5be2?w=400&auto=format&fit=crop&q=80',
      'bluetooth-earbuds':       'https://images.unsplash.com/photo-1606904825846-647eb07f5be2?w=400&auto=format&fit=crop&q=80',
    },
    'accessories': {
      'leather-wallet':          'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&auto=format&fit=crop&q=80',
      'travel-backpack':         'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&auto=format&fit=crop&q=80',
      'duffle-bag':              'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&auto=format&fit=crop&q=80',
    },
  },
};

// ─────────────────────── Helpers ───────────────────────

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest);
    fs.mkdirSync(dir, { recursive: true });

    const doRequest = (requestUrl, redirectCount = 0) => {
      if (redirectCount > 5) return reject(new Error(`Too many redirects for ${url}`));
      const proto = requestUrl.startsWith('https') ? https : http;
      proto.get(requestUrl, { headers: { 'User-Agent': 'NovaPOS-ImageFetcher/1.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return doRequest(res.headers.location, redirectCount + 1);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${requestUrl}`));
        }
        const stream = fs.createWriteStream(dest);
        res.pipe(stream);
        stream.on('finish', () => { stream.close(); resolve(); });
        stream.on('error', reject);
      }).on('error', reject);
    };
    doRequest(url);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─────────────────────── Main ───────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  NovaPOS — Pull Catalog Images to GCS');
  console.log(`  Bucket: gs://${BUCKET}`);
  console.log('═══════════════════════════════════════════════════\n');

  // Build flat list of { gcsPath, sourceUrl, localPath }
  const tasks = [];
  for (const [profile, categories] of Object.entries(CATALOG)) {
    for (const [category, items] of Object.entries(categories)) {
      for (const [itemName, sourceUrl] of Object.entries(items)) {
        const gcsPath = `${profile}/${category}/${itemName}.jpg`;
        const localPath = path.join(LOCAL_DIR, gcsPath);
        tasks.push({ gcsPath, sourceUrl, localPath, profile, category, itemName });
      }
    }
  }

  console.log(`Total images to process: ${tasks.length}\n`);

  // Step 1: Download all images locally
  console.log('-- Step 1: Downloading images from Unsplash --\n');
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const task of tasks) {
    if (fs.existsSync(task.localPath)) {
      skipped++;
      continue;
    }
    try {
      process.stdout.write(`  > ${task.gcsPath}...`);
      await downloadFile(task.sourceUrl, task.localPath);
      downloaded++;
      console.log(' OK');
      await sleep(200); // Rate limit
    } catch (err) {
      failed++;
      console.log(` FAIL ${err.message}`);
    }
  }

  console.log(`\n  Downloaded: ${downloaded} | Skipped (cached): ${skipped} | Failed: ${failed}\n`);

  // Step 2: Upload to GCS
  console.log('-- Step 2: Uploading to Google Cloud Storage --\n');

  try {
    // Make bucket publicly readable for serving images
    console.log('  Setting bucket public read access...');
    execSync(
      `gcloud storage buckets add-iam-policy-binding gs://${BUCKET} --member=allUsers --role=roles/storage.objectViewer --quiet`,
      { stdio: 'pipe' }
    );
    console.log('  OK Bucket is publicly readable\n');
  } catch (e) {
    console.log('  WARNING: Could not set public access (may already be set)\n');
  }

  // Upload all files
  console.log(`  Uploading ${tasks.length} images...\n`);
  try {
    execSync(
      `gcloud storage cp --recursive "${LOCAL_DIR}${path.sep}*" gs://${BUCKET}/ --cache-control="public, max-age=31536000"`,
      { stdio: 'inherit' }
    );
    console.log('\n  OK All images uploaded!\n');
  } catch (e) {
    console.error('  FAIL Upload failed, trying individual uploads...\n');
    for (const task of tasks) {
      if (!fs.existsSync(task.localPath)) continue;
      try {
        execSync(
          `gcloud storage cp "${task.localPath}" gs://${BUCKET}/${task.gcsPath} --cache-control="public, max-age=31536000"`,
          { stdio: 'pipe' }
        );
        process.stdout.write('.');
      } catch {
        process.stdout.write('x');
      }
    }
    console.log('\n');
  }

  // Step 3: Generate the URL mapping
  console.log('-- Step 3: Generating URL mapping --\n');

  const mapping = {};
  for (const task of tasks) {
    const gcsUrl = `${BASE_URL}/${task.gcsPath}`;
    if (!mapping[task.profile]) mapping[task.profile] = {};
    if (!mapping[task.profile][task.category]) mapping[task.profile][task.category] = {};
    mapping[task.profile][task.category][task.itemName] = gcsUrl;
  }

  const mappingFile = path.join(process.cwd(), 'apps', 'pos', 'src', 'lib', 'catalogImageUrls.ts');
  const lines = [
    '// AUTO-GENERATED by scripts/pull-catalog-images.mjs',
    '// DO NOT EDIT — re-run the script to update',
    `// Generated: ${new Date().toISOString()}`,
    `// Source: gs://${BUCKET}`,
    '',
    `export const GCS_BASE = '${BASE_URL}';`,
    '',
    '/** GCS-hosted product images organized by profile/category/item */',
    `export const CATALOG_IMAGES: Record<string, Record<string, Record<string, string>>> = ${JSON.stringify(mapping, null, 2)};`,
    '',
    '/** Flat lookup: item slug -> GCS URL */',
    'export const ITEM_IMAGE_MAP: Record<string, string> = {};',
    'for (const categories of Object.values(CATALOG_IMAGES)) {',
    '  for (const items of Object.values(categories)) {',
    '    for (const [slug, url] of Object.entries(items)) {',
    '      ITEM_IMAGE_MAP[slug] = url;',
    '    }',
    '  }',
    '}',
    '',
  ];

  fs.writeFileSync(mappingFile, lines.join('\n'), 'utf-8');
  console.log(`  OK Written: ${mappingFile}\n`);

  // Summary
  console.log('═══════════════════════════════════════════════════');
  console.log('  DONE!');
  console.log(`  ${tasks.length} product images -> gs://${BUCKET}/`);
  console.log(`  Public URL pattern: ${BASE_URL}/{profile}/{category}/{item}.jpg`);
  console.log('');
  console.log('  Example URLs:');
  console.log(`    ${BASE_URL}/restaurant/biryanis-rice/chicken-dum-biryani.jpg`);
  console.log(`    ${BASE_URL}/kirana/spices-masala/turmeric-haldi.jpg`);
  console.log(`    ${BASE_URL}/bakery/cakes-pastries/black-forest-pastry.jpg`);
  console.log(`    ${BASE_URL}/retail/mens-wear/polo-tshirt.jpg`);
  console.log('═══════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
