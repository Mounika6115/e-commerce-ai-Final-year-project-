"""
SmartShop AI — Dynamic Data Seeding Script  (v2.0)
===================================================
Copies local product images (../images/*) into  data/images/<Category>/<product_id>/
Creates rich product entries in  data/products.json
Creates demo user accounts in  data/users.json  (passwords are SHA-256 hashed)

Usage:
    cd backend
    python seed_data.py           # full seed (appends / deduplicates by name)
    python seed_data.py --reset   # wipes products.json then re-seeds
"""

import os
import sys
import json
import uuid
import shutil
import hashlib
from datetime import datetime, timedelta
import random

# ---------------------------------------------------------------------------
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DATA_DIR   = os.path.join(BASE_DIR, "data")
IMAGES_DIR = os.path.join(DATA_DIR, "images")
ROOT_IMAGES = os.path.join(BASE_DIR, "..", "images")

PRODUCTS_FILE = os.path.join(DATA_DIR, "products.json")
USERS_FILE    = os.path.join(DATA_DIR, "users.json")
CART_FILE     = os.path.join(DATA_DIR, "cart.json")
ORDERS_FILE   = os.path.join(DATA_DIR, "orders.json")
REQUESTS_FILE = os.path.join(DATA_DIR, "requests.json")
CHATS_FILE    = os.path.join(DATA_DIR, "chats.json")
SHARED_FILE   = os.path.join(DATA_DIR, "shared.json")


def _ensure_dirs():
    os.makedirs(DATA_DIR,   exist_ok=True)
    os.makedirs(IMAGES_DIR, exist_ok=True)


def _read_json(path, default=None):
    if default is None:
        default = []
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return default


def _write_json(path, data):
    _ensure_dirs()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)


def _hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Product catalogue definition
# Maps  source_image_filename  →  (name, price, rating, description, category)
# ---------------------------------------------------------------------------
SEED_PRODUCTS = [
    # ── JACKETS ─────────────────────────────────────────────────────────────
    {
        "source_folder": "Jackets",
        "source_file":   "fashionable-modern-motorcycle-jacket-mockup.webp",
        "name":          "Moto Rebel Leather Jacket",
        "price":         4299,
        "rating":        4.8,
        "popularityScore": 0.93,
        "description":   "Genuine leather biker jacket with asymmetric zip and quilted lining. Built for the road and the runway.",
    },
    {
        "source_folder": "Jackets",
        "source_file":   "still-life-rendering-jackets-display (1).webp",
        "name":          "Urban Street Puffer Jacket",
        "price":         2799,
        "rating":        4.6,
        "popularityScore": 0.87,
        "description":   "Lightweight puffer with water-resistant shell, perfect for city commutes in 2026 winters.",
    },
    {
        "source_folder": "Jackets",
        "source_file":   "still-life-rendering-jackets-display (2).webp",
        "name":          "Alpine Trek Windbreaker",
        "price":         3199,
        "rating":        4.5,
        "popularityScore": 0.82,
        "description":   "Technical windbreaker with ventilated back and packable hood, ready for any terrain.",
    },
    {
        "source_folder": "Jackets",
        "source_file":   "still-life-rendering-jackets-display.webp",
        "name":          "Classic Bomber Heritage Jacket",
        "price":         3699,
        "rating":        4.7,
        "popularityScore": 0.91,
        "description":   "Timeless MA-1 bomber in premium nylon. An icon reimagined for 2026 streetwear.",
    },
    {
        "source_folder": "Jackets",
        "source_file":   "stylish-mustard-yellow-jacket-hanging-wooden-hanger-against-neutral-wall.webp",
        "name":          "Harvest Gold Blazer Jacket",
        "price":         2499,
        "rating":        4.4,
        "popularityScore": 0.79,
        "description":   "Bold mustard-yellow blazer cut for slim profiles. Stand out at every event this season.",
    },

    # ── LIPSTICKS ────────────────────────────────────────────────────────────
    {
        "source_folder": "Lipsticks",
        "source_file":   "16248.webp",
        "name":          "Rosewood Romance Matte Lipstick",
        "price":         899,
        "rating":        4.7,
        "popularityScore": 0.88,
        "description":   "Warm rosewood matte liquid lipstick with up to 16-hour wear and a velvety soft finish.",
    },
    {
        "source_folder": "Lipsticks",
        "source_file":   "18940.webp",
        "name":          "Berry Bliss Velvet Lipstick",
        "price":         1050,
        "rating":        4.8,
        "popularityScore": 0.92,
        "description":   "Deep berry velvet formula enriched with hyaluronic acid for plump, hydrated lips all day.",
    },
    {
        "source_folder": "Lipsticks",
        "source_file":   "close-up-pink-lipstick-against-white-background.webp",
        "name":          "Baby Pink Satin Lip Colour",
        "price":         749,
        "rating":        4.6,
        "popularityScore": 0.85,
        "description":   "Sheer baby-pink satin lipstick, ultra-glossy and perfect for everyday feminine elegance.",
    },
    {
        "source_folder": "Lipsticks",
        "source_file":   "close-up-red-lipsticks-arrangement.webp",
        "name":          "Scarlet Affair Matte Set",
        "price":         1499,
        "rating":        4.9,
        "popularityScore": 0.97,
        "description":   "Iconic red matte lipstick set — power on your lips, confidence in your stride.",
    },
    {
        "source_folder": "Lipsticks",
        "source_file":   "high-angle-lipsticks-arrangement.webp",
        "name":          "Luxe Spectrum Lipstick Collection",
        "price":         2199,
        "rating":        4.8,
        "popularityScore": 0.94,
        "description":   "A curated multi-shade collection spanning nudes, corals and bold berries. Gift-ready packaging.",
    },
    {
        "source_folder": "Lipsticks",
        "source_file":   "red-lipstick-with-opened-cap-cosmetics-levitation-white-background.webp",
        "name":          "Crimson Vortex Bold Lipstick",
        "price":         1250,
        "rating":        4.9,
        "popularityScore": 0.98,
        "description":   "AR-Ready bold crimson matte finish. Smudge-proof, feather-proof, confidence-proof.",
    },
    {
        "source_folder": "Lipsticks",
        "source_file":   "Vector lipstick assortment on white background-01.webp",
        "name":          "Prism 7-Shade Lip Kit",
        "price":         2999,
        "rating":        4.7,
        "popularityScore": 0.90,
        "description":   "Complete 7-shade kit from barely-there nudes to dramatic darks. One kit, infinite looks.",
    },

    # ── SHIRTS ───────────────────────────────────────────────────────────────
    {
        "source_folder": "Shirts",
        "source_file":   "basic-white-shirt-men-s-fashion-apparel-studio-shoot.webp",
        "name":          "Clean Slate White Casual Shirt",
        "price":         1199,
        "rating":        4.5,
        "popularityScore": 0.80,
        "description":   "Essential white cotton shirt with a clean minimal design. The perfect blank canvas.",
    },
    {
        "source_folder": "Shirts",
        "source_file":   "clothing-rack-with-floral-hawaiian-shirts-hangers-hat.webp",
        "name":          "Island Bloom Hawaiian Shirt",
        "price":         1599,
        "rating":        4.4,
        "popularityScore": 0.77,
        "description":   "Vibrant floral-print camp collar shirt in breathable rayon. Summer vibes, 2026 edition.",
    },
    {
        "source_folder": "Shirts",
        "source_file":   "confident-serious-handsome-man-wears-black-leather-jacket-gray-t-shirt-stylish-eyewear-looks-directly-into-camera-isolated-people-style-concept.webp",
        "name":          "Street Edge Grey T-Shirt",
        "price":         799,
        "rating":        4.3,
        "popularityScore": 0.73,
        "description":   "Premium combed cotton grey tee with a relaxed fit. Layer it, style it, own it.",
    },
    {
        "source_folder": "Shirts",
        "source_file":   "men-s-fashion-shirts.webp",
        "name":          "Metro Elite Fashion Shirt",
        "price":         1899,
        "rating":        4.6,
        "popularityScore": 0.86,
        "description":   "Sharp-cut fashion shirt with subtle texture weave. Board-room to bar — effortless.",
    },
    {
        "source_folder": "Shirts",
        "source_file":   "shirt-with-tag-that-says-touch-it.webp",
        "name":          "Minimal Touch Linen Shirt",
        "price":         1499,
        "rating":        4.5,
        "popularityScore": 0.82,
        "description":   "100% linen short-sleeve shirt. Breathes as you move, wrinkles that look intentional.",
    },
    {
        "source_folder": "Shirts",
        "source_file":   "still-life-with-classic-shirts-hanger (1).webp",
        "name":          "Classic Oxford Premium Shirt",
        "price":         2199,
        "rating":        4.7,
        "popularityScore": 0.89,
        "description":   "Oxford weave button-down in premium cotton — the cornerstone of every wardrobe.",
    },
    {
        "source_folder": "Shirts",
        "source_file":   "still-life-with-classic-shirts-hanger.webp",
        "name":          "Heritage Stripe Cotton Shirt",
        "price":         1699,
        "rating":        4.4,
        "popularityScore": 0.78,
        "description":   "Classic Bengal-stripe shirt in two-ply cotton. Crisp, clean and timeless.",
    },
    {
        "source_folder": "Shirts",
        "source_file":   "style-everyday-mens-casual-shirt-photoshoot-poses-boys-shirt.webp",
        "name":          "Everyday Flex Casual Shirt",
        "price":         1099,
        "rating":        4.3,
        "popularityScore": 0.74,
        "description":   "Stretch-cotton casual shirt with a modern slim cut. Made for those always on the move.",
    },

    # ── SHOES ────────────────────────────────────────────────────────────────
    {
        "source_folder": "Shoes",
        "source_file":   "brown-leather-shoes.webp",
        "name":          "Cocoa Craft Leather Oxford",
        "price":         4999,
        "rating":        4.8,
        "popularityScore": 0.92,
        "description":   "Hand-crafted full-grain leather oxford in rich cocoa brown. Ageless elegance, modern comfort.",
    },
    {
        "source_folder": "Shoes",
        "source_file":   "f4cf9ae8-aab1-4e9e-a59f-6cbdaf2b198b.webp",
        "name":          "Air Sprint Running Shoes",
        "price":         5499,
        "rating":        4.7,
        "popularityScore": 0.90,
        "description":   "Responsive foam midsole with a breathable mesh upper. Engineered for personal bests.",
    },
    {
        "source_folder": "Shoes",
        "source_file":   "fashion-shoes-sneakers.webp",
        "name":          "Tempo Street Sneakers",
        "price":         3799,
        "rating":        4.6,
        "popularityScore": 0.87,
        "description":   "Street-ready sneakers with chunky sole and retro tooling. The 2026 silhouette you need.",
    },
    {
        "source_folder": "Shoes",
        "source_file":   "fashion-shoes.webp",
        "name":          "Vogue Edge Platform Shoes",
        "price":         3299,
        "rating":        4.5,
        "popularityScore": 0.83,
        "description":   "Bold platform silhouette that adds height and attitude. Fashion-forward for every occasion.",
    },
    {
        "source_folder": "Shoes",
        "source_file":   "men-shoes.webp",
        "name":          "Executive Classic Derby Shoes",
        "price":         5999,
        "rating":        4.9,
        "popularityScore": 0.95,
        "description":   "Premium Goodyear-welted derby in smooth calfskin. Boardroom to gala — boardroom wins.",
    },
    {
        "source_folder": "Shoes",
        "source_file":   "pair-blue-running-sneakers-white-background-isolated.webp",
        "name":          "BlueZone Performance Runners",
        "price":         4299,
        "rating":        4.7,
        "popularityScore": 0.89,
        "description":   "Electric-blue run shoe with carbon-infused plate for explosive energy return.",
    },
    {
        "source_folder": "Shoes",
        "source_file":   "shoes-2.webp",
        "name":          "Urban Trail Trekking Shoes",
        "price":         3599,
        "rating":        4.5,
        "popularityScore": 0.84,
        "description":   "Hybrid trail-to-street shoe with grip outsole and waterproof membrane.",
    },
    {
        "source_folder": "Shoes",
        "source_file":   "shoes.webp",
        "name":          "Essential Everyday Canvas Shoes",
        "price":         1499,
        "rating":        4.3,
        "popularityScore": 0.76,
        "description":   "Classic canvas sneaker in pure white. Simple, clean and perpetually cool.",
    },

    # ── SUNGLASSES ──────────────────────────────────────────────────────────
    {
        "source_folder": "Sunglases",  # Note: folder has this spelling
        "category_name": "Sunglasses",
        "source_file":   "fdfe8b35-cab5-453b-98f1-745c43bb0c92.webp",
        "name":          "Infinity Shield Sport Glasses",
        "price":         2999,
        "rating":        4.6,
        "popularityScore": 0.86,
        "description":   "Wraparound sport lens with TR90 frame and UV400 protection. Built for speed.",
    },
    {
        "source_folder": "Sunglases",
        "category_name": "Sunglasses",
        "source_file":   "image-modern-fashionable-sunglasses-isolated-white.webp",
        "name":          "Neo Pilot Classic Sunglasses",
        "price":         2499,
        "rating":        4.7,
        "popularityScore": 0.88,
        "description":   "Iconic pilot frame in polished gunmetal with polarized gradient lenses.",
    },
    {
        "source_folder": "Sunglases",
        "category_name": "Sunglasses",
        "source_file":   "nikopol-ukraine-july-12022-sunglasses-men-white-fabric-tshirt-view-top.webp",
        "name":          "Titanium Frame Aviator Shades",
        "price":         3499,
        "rating":        4.8,
        "popularityScore": 0.93,
        "description":   "Feather-light titanium aviator with photochromic grey lenses — clarity in all conditions.",
    },
    {
        "source_folder": "Sunglases",
        "category_name": "Sunglasses",
        "source_file":   "pink-sunglasses-around-beatiful-flowers-grey-surface.webp",
        "name":          "Rosé Bloom Fashion Shades",
        "price":         1999,
        "rating":        4.5,
        "popularityScore": 0.81,
        "description":   "Chic cat-eye frames in blush pink with rose-tinted lenses — effortlessly feminine.",
    },
    {
        "source_folder": "Sunglases",
        "category_name": "Sunglasses",
        "source_file":   "sport-windshield-sun-brown-summer.webp",
        "name":          "Cyclone Sport Shield Goggles",
        "price":         2199,
        "rating":        4.6,
        "popularityScore": 0.84,
        "description":   "Full-coverage shield goggle with anti-fog ventilation. Cycling, skiing or just looking fierce.",
    },
    {
        "source_folder": "Sunglases",
        "category_name": "Sunglasses",
        "source_file":   "stylish-black-aviator-glasses-with-clear-lenses.webp",
        "name":          "Noir Eclipse Aviator Shades",
        "price":         2699,
        "rating":        4.7,
        "popularityScore": 0.90,
        "description":   "All-black matte aviator with clear-to-dark photochromic lenses. Night mode activated.",
    },
]

# ---------------------------------------------------------------------------
# Demo users (besides admin which is seeded by app.py)
# ---------------------------------------------------------------------------
DEMO_USERS = [
    {"name": "Riya Sharma",    "username": "riya",    "email": "riya@smartshop.ai",    "password": "riya123"},
    {"name": "Arjun Patel",    "username": "arjun",   "email": "arjun@smartshop.ai",   "password": "arjun123"},
    {"name": "Priya Mehta",    "username": "priya",   "email": "priya@smartshop.ai",   "password": "priya123"},
    {"name": "Kabir Khan",     "username": "kabir",   "email": "kabir@smartshop.ai",   "password": "kabir123"},
    {"name": "Sneha Reddy",    "username": "sneha",   "email": "sneha@smartshop.ai",   "password": "sneha123"},
]


# ---------------------------------------------------------------------------
# Core functions
# ---------------------------------------------------------------------------
def seed_products(reset: bool = False) -> list:
    _ensure_dirs()

    existing = [] if reset else _read_json(PRODUCTS_FILE)
    existing_names = {p["name"] for p in existing}
    added = []

    for item in SEED_PRODUCTS:
        if item["name"] in existing_names:
            print(f"  SKIP  (already exists): {item['name']}")
            continue

        src_folder   = item["source_folder"]
        src_file     = item["source_file"]
        category     = item.get("category_name", src_folder)  # Sunglases → Sunglasses
        src_path     = os.path.join(ROOT_IMAGES, src_folder, src_file)

        if not os.path.exists(src_path):
            print(f"  WARN  Image not found, skipping: {src_path}")
            continue

        product_id = f"{category[:2].lower()}-{uuid.uuid4().hex[:6]}"
        dest_dir   = os.path.join(IMAGES_DIR, category, product_id)
        os.makedirs(dest_dir, exist_ok=True)

        ext       = os.path.splitext(src_file)[1]
        dest_file = f"{product_id}-0{ext}"
        shutil.copy2(src_path, os.path.join(dest_dir, dest_file))

        image_url = f"/api/images/{category}/{product_id}/{dest_file}"

        product = {
            "id":              product_id,
            "name":            item["name"],
            "category":        category,
            "price":           item["price"],
            "images":          [image_url],
            "description":     item["description"],
            "rating":          item["rating"],
            "popularityScore": item["popularityScore"],
            "createdAt":       datetime.utcnow().isoformat()
        }

        existing.append(product)
        existing_names.add(item["name"])
        added.append(product)
        print(f"  ADD   {category:12s}  {item['name']}")

    _write_json(PRODUCTS_FILE, existing)
    return added


def seed_users() -> list:
    existing  = _read_json(USERS_FILE)
    existing_usernames = {u["username"] for u in existing}
    added = []

    for demo in DEMO_USERS:
        if demo["username"] in existing_usernames:
            print(f"  SKIP  (user exists): {demo['username']}")
            continue
        user = {
            "id":        f"user_{uuid.uuid4().hex[:8]}",
            "name":      demo["name"],
            "username":  demo["username"],
            "email":     demo["email"],
            "password":  _hash_password(demo["password"]),
            "role":      "user",
            "avatar":    f"https://api.dicebear.com/7.x/avataaars/svg?seed={demo['username']}",
            "createdAt": datetime.utcnow().isoformat()
        }
        existing.append(user)
        existing_usernames.add(demo["username"])
        added.append(user)
        print(f"  ADD   user: {demo['username']} / {demo['password']}")

    _write_json(USERS_FILE, existing)
    return added


def ensure_empty_stores():
    for fpath, default in [
        (CART_FILE, {}), (ORDERS_FILE, {}),
        (REQUESTS_FILE, {}), (CHATS_FILE, {}), (SHARED_FILE, {})
    ]:
        if not os.path.exists(fpath):
            _write_json(fpath, default)
            print(f"  INIT  {os.path.basename(fpath)}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    reset_flag = "--reset" in sys.argv

    print()
    print("=" * 60)
    print("  SmartShop AI — Data Seeder v2")
    print("=" * 60)

    if reset_flag:
        print("\n  ⚠  RESET mode — wiping products.json\n")
        _write_json(PRODUCTS_FILE, [])

    print("\n[1/3] Seeding products …")
    new_products = seed_products(reset=reset_flag)

    print(f"\n[2/3] Seeding demo users …")
    new_users = seed_users()

    print(f"\n[3/3] Ensuring empty JSON stores …")
    ensure_empty_stores()

    print()
    print("=" * 60)
    print(f"  Done!  {len(new_products)} products added, {len(new_users)} users added.")
    print()
    print("  Demo credentials:")
    for demo in DEMO_USERS:
        print(f"    {demo['username']:10s}  /  {demo['password']}")
    print("    admin      /  admin123")
    print("=" * 60)
    print()
