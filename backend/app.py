import os
import json
import uuid
import shutil
import hashlib
import secrets
import string
from datetime import datetime
from functools import wraps

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

try:
    import google.generativeai as genai
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False

# ---------------------------------------------------------------------------
# App Setup
# ---------------------------------------------------------------------------
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

BASE_DIR       = os.path.dirname(os.path.abspath(__file__))
DATA_DIR       = os.path.join(BASE_DIR, "data")
IMAGES_DIR     = os.path.join(DATA_DIR, "images")
# Root-level images folder (for seed data)
ROOT_IMAGES_DIR = os.path.join(BASE_DIR, "..", "images")

USERS_FILE    = os.path.join(DATA_DIR, "users.json")
PRODUCTS_FILE = os.path.join(DATA_DIR, "products.json")
CART_FILE     = os.path.join(DATA_DIR, "cart.json")
ORDERS_FILE   = os.path.join(DATA_DIR, "orders.json")
REQUESTS_FILE = os.path.join(DATA_DIR, "requests.json")
CHATS_FILE    = os.path.join(DATA_DIR, "chats.json")
SHARED_FILE   = os.path.join(DATA_DIR, "shared.json")
REVIEWS_FILE  = os.path.join(DATA_DIR, "reviews.json")
CHAIN_FILE    = os.path.join(DATA_DIR, "review_chain.json")
PROFILE_IMAGES_DIR = os.path.join(DATA_DIR, "user-profiles")
CATEGORIES_FILE    = os.path.join(DATA_DIR, "categories.json")
CATEGORY_LOGOS_DIR = os.path.join(DATA_DIR, "categories-logo")
OCCASIONS_FILE     = os.path.join(DATA_DIR, "occasions.json")
ADDRESS_FILE       = os.path.join(DATA_DIR, "address.json")

# Gemini API key — read from env or .env.local in parent folder
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
if not GEMINI_API_KEY:
    env_path = os.path.join(BASE_DIR, "..", ".env.local")
    if os.path.exists(env_path):
        with open(env_path) as ef:
            for line in ef:
                if line.startswith("GEMINI_API_KEY="):
                    GEMINI_API_KEY = line.strip().split("=", 1)[1]

if HAS_GENAI and GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


# ---------------------------------------------------------------------------
# JSON Helpers — Thread‑safe for single‑server usage
# ---------------------------------------------------------------------------
def _ensure_dirs():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(IMAGES_DIR, exist_ok=True)
    os.makedirs(PROFILE_IMAGES_DIR, exist_ok=True)
    os.makedirs(CATEGORY_LOGOS_DIR, exist_ok=True)


def _read_json(filepath, default=None):
    if default is None:
        default = []
    if not os.path.exists(filepath):
        return default
    with open(filepath, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return default


def _write_json(filepath, data):
    _ensure_dirs()
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)


def _hash_password(password: str) -> str:
    """SHA-256 hash a password for secure storage."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash."""
    return _hash_password(password) == hashed


def _gen_temp_password(length: int = 10) -> str:
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))


def _convo_id(user1: str, user2: str) -> str:
    """Stable conversation key regardless of argument order."""
    return "__".join(sorted([user1, user2]))


# ---------------------------------------------------------------------------
# Seed default data on first run
# ---------------------------------------------------------------------------
def _seed_defaults():
    _ensure_dirs()

    # Seed admin user
    users = _read_json(USERS_FILE)
    if not any(u.get("username") == "admin" for u in users):
        users.append({
            "id": "admin_1",
            "name": "Administrator",
            "username": "admin",
            "email": "admin@smartshop.ai",
            "password": _hash_password("admin123"),
            "role": "admin",
            "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
            "createdAt": datetime.utcnow().isoformat()
        })
        _write_json(USERS_FILE, users)

    # Seed initial products (from the original data.ts)
    products = _read_json(PRODUCTS_FILE)
    if len(products) == 0:
        seed_products = [
            {
                "id": "jk-1",
                "name": "Cyber-Tech Bomber Jacket",
                "category": "Jackets",
                "price": 3499,
                "images": ["https://images.unsplash.com/photo-1551028711-031cda281d1a?auto=format&fit=crop&q=80&w=600"],
                "description": "2026 Edition tech-wear with thermal insulation and moisture-wicking tech.",
                "rating": 4.8,
                "popularityScore": 0.95,
                "createdAt": datetime.utcnow().isoformat()
            },
            {
                "id": "lp-1",
                "name": "Infinity Matte Lipstick (Crimson)",
                "category": "Lipsticks",
                "price": 1250,
                "images": ["https://images.unsplash.com/photo-1586776977607-310e9c725c37?auto=format&fit=crop&q=80&w=600"],
                "description": "AR-Ready matte finish for all-day wear without smudge.",
                "rating": 4.9,
                "popularityScore": 0.98,
                "createdAt": datetime.utcnow().isoformat()
            },
            {
                "id": "sh-1",
                "name": "Classic Silk Oxford Shirt",
                "category": "Shirts",
                "price": 1899,
                "images": ["https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=600"],
                "description": "Premium cotton-silk blend, precision tailored for 2026 professionals.",
                "rating": 4.5,
                "popularityScore": 0.75,
                "createdAt": datetime.utcnow().isoformat()
            },
            {
                "id": "so-1",
                "name": "Vortex Gravity Running Shoes",
                "category": "Shoes",
                "price": 5999,
                "images": ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600"],
                "description": "Energy-return soles with adaptive fit technology for ultimate speed.",
                "rating": 4.7,
                "popularityScore": 0.89,
                "createdAt": datetime.utcnow().isoformat()
            },
            {
                "id": "sg-1",
                "name": "Mirrored Titanium Navigators",
                "category": "Sunglasses",
                "price": 2499,
                "images": ["https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&q=80&w=600"],
                "description": "Polarized UV-Ray blocking with lightweight titanium aero-frame.",
                "rating": 4.6,
                "popularityScore": 0.82,
                "createdAt": datetime.utcnow().isoformat()
            },
            {
                "id": "jk-2",
                "name": "Maverick Denim Street Vest",
                "category": "Jackets",
                "price": 2199,
                "images": ["https://images.unsplash.com/photo-1576905355162-723d77bd343d?auto=format&fit=crop&q=80&w=600"],
                "description": "Distressed denim perfect for 2026 streetwear layering.",
                "rating": 4.4,
                "popularityScore": 0.88,
                "createdAt": datetime.utcnow().isoformat()
            },
            {
                "id": "sh-2",
                "name": "Tropical Breeze Linen Shirt",
                "category": "Shirts",
                "price": 1499,
                "images": ["https://images.unsplash.com/photo-1598033129183-c4f50c7176c8?auto=format&fit=crop&q=80&w=600"],
                "description": "Ultra-breathable linen, ideal for summer 2026 vacations.",
                "rating": 4.3,
                "popularityScore": 0.72,
                "createdAt": datetime.utcnow().isoformat()
            }
        ]
        _write_json(PRODUCTS_FILE, seed_products)

    # Seed default categories
    if not os.path.exists(CATEGORIES_FILE):
        default_categories = [
            {"name": "Jackets",     "code": "jackets",     "logoUrl": "https://cdn-icons-png.flaticon.com/512/3534/3534312.png", "subcategories": []},
            {"name": "Lipsticks",   "code": "lipsticks",   "logoUrl": "https://cdn-icons-png.flaticon.com/512/1944/1944299.png", "subcategories": []},
            {"name": "Shirts",      "code": "shirts",      "logoUrl": "https://cdn-icons-png.flaticon.com/512/2357/2357127.png", "subcategories": []},
            {"name": "Shoes",       "code": "shoes",       "logoUrl": "https://cdn-icons-png.flaticon.com/512/2742/2742674.png", "subcategories": []},
            {"name": "Sunglasses",  "code": "sunglasses",  "logoUrl": "https://cdn-icons-png.flaticon.com/512/624/624467.png", "subcategories": []},
        ]
        _write_json(CATEGORIES_FILE, default_categories)

    # Empty JSON stores on first run
    for fpath, default in [
        (CART_FILE, {}), (ORDERS_FILE, {}),
        (REQUESTS_FILE, {}), (CHATS_FILE, {}), (SHARED_FILE, {}), (REVIEWS_FILE, {}),
        (ADDRESS_FILE, {})
    ]:
        if not os.path.exists(fpath):
            _write_json(fpath, default)


# ---------------------------------------------------------------------------
# AUTH  — Register / Login
# ---------------------------------------------------------------------------
@app.route("/api/auth/register", methods=["POST"])
def register():
    data      = request.get_json(force=True)
    name      = data.get("name", "").strip()
    username  = data.get("username", "").strip()
    email     = data.get("email", "").strip()
    password  = data.get("password", "").strip()
    skin_tone = data.get("skinTone", "").strip()

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
    if not name:
        name = username  # fallback

    users = _read_json(USERS_FILE)
    if any(u["username"] == username for u in users):
        return jsonify({"error": "Username already exists"}), 409
    if email and any(u.get("email") == email for u in users):
        return jsonify({"error": "Email already registered"}), 409

    new_user = {
        "id":        f"user_{uuid.uuid4().hex[:8]}",
        "name":      name,
        "username":  username,
        "email":     email or f"{username}@smartshop.ai",
        "password":  _hash_password(password),
        "role":      "user",
        "avatar":    f"https://api.dicebear.com/7.x/avataaars/svg?seed={username}",
        "skinTone":  skin_tone or None,
        "createdAt": datetime.utcnow().isoformat()
    }
    users.append(new_user)
    _write_json(USERS_FILE, users)

    safe = {k: v for k, v in new_user.items() if k != "password"}
    return jsonify({"user": safe}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data     = request.get_json(force=True)
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    users = _read_json(USERS_FILE)
    for u in users:
        if (u["username"] == username or u.get("email") == username) and \
           _verify_password(password, u["password"]):
            safe = {k: v for k, v in u.items() if k != "password"}
            return jsonify({"user": safe}), 200

    return jsonify({"error": "Invalid credentials"}), 401


@app.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    """
    Reset password by providing username + email.
    Returns a temporary password (in production this would email the user).
    """
    data     = request.get_json(force=True)
    username = data.get("username", "").strip()
    email    = data.get("email", "").strip()

    if not username or not email:
        return jsonify({"error": "Username and email are required"}), 400

    users     = _read_json(USERS_FILE)
    match_idx = None
    for i, u in enumerate(users):
        if u["username"] == username and u.get("email", "").lower() == email.lower():
            match_idx = i
            break

    if match_idx is None:
        return jsonify({"error": "No account found with that username and email"}), 404

    temp_pass = _gen_temp_password()
    users[match_idx]["password"] = _hash_password(temp_pass)
    _write_json(USERS_FILE, users)

    return jsonify({
        "message":      "Password reset successful",
        "tempPassword": temp_pass,
        "note":         "Use this temporary password to login."
    }), 200


@app.route("/api/auth/change-password", methods=["POST"])
def change_password():
    data      = request.get_json(force=True)
    user_id   = data.get("userId", "").strip()
    old_pass  = data.get("oldPassword", "").strip()
    new_pass  = data.get("newPassword", "").strip()

    if not user_id or not old_pass or not new_pass:
        return jsonify({"error": "userId, oldPassword and newPassword are required"}), 400

    users = _read_json(USERS_FILE)
    for u in users:
        if u["id"] == user_id:
            if not _verify_password(old_pass, u["password"]):
                return jsonify({"error": "Current password is incorrect"}), 401
            u["password"] = _hash_password(new_pass)
            _write_json(USERS_FILE, users)
            return jsonify({"message": "Password changed successfully"}), 200

    return jsonify({"error": "User not found"}), 404


# ---------------------------------------------------------------------------
# PROFILE IMAGE UPLOAD & SERVING
# ---------------------------------------------------------------------------

@app.route("/api/upload/profile-image/<user_id>", methods=["POST"])
def upload_profile_image(user_id):
    import base64 as _b64
    data = request.get_json(force=True)
    image_data = data.get("imageData", "")
    if not image_data:
        return jsonify({"error": "No image data"}), 400

    header, encoded = image_data.split(",", 1) if "," in image_data else ("data:image/jpeg;base64", image_data)
    ext = "jpg"
    if "png" in header:  ext = "png"
    elif "webp" in header: ext = "webp"
    elif "gif" in header:  ext = "gif"

    code = uuid.uuid4().hex[:16]
    img_dir = os.path.join(PROFILE_IMAGES_DIR, code)
    os.makedirs(img_dir, exist_ok=True)
    filename = f"profile.{ext}"
    with open(os.path.join(img_dir, filename), "wb") as f:
        f.write(_b64.b64decode(encoded))

    avatar_url = f"/api/profile-image/{code}/{filename}"

    users = _read_json(USERS_FILE)
    for u in users:
        if u["id"] == user_id:
            u["avatar"] = avatar_url
            u["profileImageCode"] = code
            break
    _write_json(USERS_FILE, users)

    updated = next((u for u in users if u["id"] == user_id), None)
    safe = {k: v for k, v in updated.items() if k != "password"} if updated else {}
    return jsonify({"avatarUrl": avatar_url, "code": code, "user": safe}), 200


# ---------------------------------------------------------------------------
# GEMINI HELPER — tries models in fallback order, returns None on quota error
# ---------------------------------------------------------------------------
_GEMINI_MODELS = [
    "gemini-3.6-flash",           # original (may be overloaded)
    "gemini-3.5-flash",           # stable fallback
    "gemini-3.5-flash-lite",      # cheaper, separate quota pool
    "gemini-2.5-flash",           # last resort
]

def _gemini_generate(prompt, vision=False):
    """Try each model in fallback order. Returns response text or None if all quota-exceeded."""
    for model_name in _GEMINI_MODELS:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            msg = str(e)
            if "429" in msg or "quota" in msg.lower() or "RESOURCE_EXHAUSTED" in msg:
                continue  # try next model
            raise  # non-quota error → re-raise
    return None  # all models quota-exceeded


@app.route("/api/profile-image/<code>/<filename>")
def serve_profile_image(code, filename):
    img_dir = os.path.join(PROFILE_IMAGES_DIR, code)
    return send_from_directory(img_dir, filename)


@app.route("/api/users/<user_id>/profile", methods=["PUT"])
def update_user_profile(user_id):
    data = request.get_json(force=True)
    users = _read_json(USERS_FILE)
    for u in users:
        if u["id"] == user_id:
            if "name" in data and data["name"].strip():
                u["name"] = data["name"].strip()
            if "email" in data:
                u["email"] = data["email"].strip()
            if "skinTone" in data:
                u["skinTone"] = data["skinTone"]
            if "avatar" in data:
                u["avatar"] = data["avatar"]
            _write_json(USERS_FILE, users)
            safe = {k: v for k, v in u.items() if k != "password"}
            return jsonify({"user": safe}), 200
    return jsonify({"error": "User not found"}), 404


@app.route("/api/analyze/skin-tone", methods=["POST"])
def analyze_skin_tone():
    import base64 as _b64, re as _re
    if not HAS_GENAI or not GEMINI_API_KEY:
        return jsonify({"error": "Gemini AI not configured"}), 503
    data = request.get_json(force=True)
    image_data = data.get("imageData", "")
    if not image_data:
        return jsonify({"error": "No image data provided"}), 400
    try:
        header, encoded = image_data.split(",", 1) if "," in image_data else ("data:image/jpeg;base64", image_data)
        mime = "image/jpeg"
        if "png" in header:  mime = "image/png"
        elif "webp" in header: mime = "image/webp"
        prompt = (
            "Analyze the skin tone of the person in this image. "
            "Classify it as exactly ONE of these: Fair, Medium, Olive, Brown, Dark. "
            "Respond ONLY with valid JSON: {\"skinTone\": \"<category>\", "
            "\"undertone\": \"<warm|cool|neutral>\", \"description\": \"<one sentence>\"}"
        )
        image_part = {"mime_type": mime, "data": encoded}
        text = _gemini_generate([prompt, image_part], vision=True)
        if text is None:
            return jsonify({"error": "quota_exceeded", "message": "Gemini quota exceeded. Please try again in a few minutes, or select your skin tone manually."}), 429
        match = _re.search(r'\{.*\}', text, _re.DOTALL)
        if match:
            return jsonify(json.loads(match.group())), 200
        return jsonify({"skinTone": "Medium", "undertone": "neutral", "description": "Analysis complete."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analyze/product-fit", methods=["POST"])
def analyze_product_fit():
    import re as _re
    if not HAS_GENAI or not GEMINI_API_KEY:
        return jsonify({"error": "Gemini AI not configured"}), 503
    data = request.get_json(force=True)
    skin_tone    = data.get("skinTone", "Medium")
    product_name = data.get("productName", "")
    product_desc = data.get("productDescription", "")
    category     = data.get("productCategory", "")
    prompt = (
        f"You are a fashion and beauty expert. Analyze if this product suits someone with {skin_tone} skin tone.\n"
        f"Product: {product_name}\nCategory: {category}\nDescription: {product_desc}\n\n"
        f"Provide: 1) A compatibility percentage (0-100). 2) A verdict (Excellent/Good/Moderate/Not Recommended). "
        f"3) A 2-3 sentence analysis mentioning specific colors or features relevant to {skin_tone} skin. "
        f"4) One styling tip.\n"
        f"Respond ONLY with valid JSON: {{\"percentage\": <number>, \"verdict\": \"<verdict>\", "
        f"\"analysis\": \"<text>\", \"tip\": \"<text>\"}}"
    )
    text = _gemini_generate(prompt)
    if text is None:
        return jsonify({"quota_error": True, "percentage": 0, "verdict": "Unavailable", "analysis": "Gemini AI quota exceeded. Please try again in a few minutes.", "tip": "Your skin tone has been saved — the analyzer will work once quota resets."}), 200
    try:
        import re as _re2
        match = _re2.search(r'\{.*\}', text, _re2.DOTALL)
        if match:
            return jsonify(json.loads(match.group())), 200
    except Exception:
        pass
    return jsonify({"percentage": 75, "verdict": "Good", "analysis": "This product should work well for your look.", "tip": "Style with confidence!"}), 200


# ---------------------------------------------------------------------------
# USERS — CRUD (admin only in practice)
# ---------------------------------------------------------------------------
@app.route("/api/users", methods=["GET"])
def get_users():
    users = _read_json(USERS_FILE)
    safe = [{k: v for k, v in u.items() if k != "password"} for u in users]
    return jsonify(safe)


@app.route("/api/users/<user_id>", methods=["DELETE"])
def delete_user(user_id):
    users = _read_json(USERS_FILE)
    new_users = [u for u in users if u["id"] != user_id]
    if len(new_users) == len(users):
        return jsonify({"error": "User not found"}), 404
    _write_json(USERS_FILE, new_users)

    # Clean up cart
    carts = _read_json(CART_FILE, default={})
    if isinstance(carts, dict) and user_id in carts:
        del carts[user_id]
        _write_json(CART_FILE, carts)

    # Clean up orders
    all_orders = _read_json(ORDERS_FILE, default={})
    if isinstance(all_orders, dict) and user_id in all_orders:
        del all_orders[user_id]
        _write_json(ORDERS_FILE, all_orders)

    # Clean up friend requests
    all_requests = _read_json(REQUESTS_FILE, default={})
    if isinstance(all_requests, dict):
        all_requests.pop(user_id, None)
        for uid in all_requests:
            all_requests[uid] = [r for r in all_requests[uid] if r.get("fromId") != user_id]
        _write_json(REQUESTS_FILE, all_requests)

    return jsonify({"message": "User and all associated data deleted"}), 200


# ---------------------------------------------------------------------------
# PRODUCTS — CRUD + image upload
# ---------------------------------------------------------------------------
@app.route("/api/products", methods=["GET"])
def get_products():
    products = _read_json(PRODUCTS_FILE)
    return jsonify(products)


@app.route("/api/products/<product_id>", methods=["GET"])
def get_product(product_id):
    products = _read_json(PRODUCTS_FILE)
    match = next((p for p in products if p["id"] == product_id), None)
    if not match:
        return jsonify({"error": "Not found"}), 404
    return jsonify(match)



@app.route("/api/products", methods=["POST"])
def create_product():
    """
    Expects multipart/form-data with:
      - name, category, price, description, rating (form fields)
      - images (multiple file fields)
    """
    name = request.form.get("name", "").strip()
    category = request.form.get("category", "").strip()
    price = request.form.get("price", "0")
    description = request.form.get("description", "").strip()
    rating = request.form.get("rating", "4.5")

    if not name or not category:
        return jsonify({"error": "Name and category are required"}), 400

    try:
        price = float(price)
        rating = float(rating)
    except ValueError:
        return jsonify({"error": "Price and rating must be numbers"}), 400

    product_id = f"{category[:2].lower()}-{uuid.uuid4().hex[:6]}"

    # Handle image uploads
    image_urls = []
    files = request.files.getlist("images")
    if files:
        img_dir = os.path.join(IMAGES_DIR, category, product_id)
        os.makedirs(img_dir, exist_ok=True)
        for idx, f in enumerate(files):
            if f.filename:
                ext = os.path.splitext(f.filename)[1] or ".jpg"
                fname = f"{product_id}-{idx}{ext}"
                save_path = os.path.join(img_dir, fname)
                f.save(save_path)
                # URL path relative to API
                image_urls.append(f"/api/images/{category}/{product_id}/{fname}")
    else:
        # No files uploaded — try a direct URL
        image_url = request.form.get("imageUrl", "")
        if image_url:
            image_urls.append(image_url)

    new_product = {
        "id": product_id,
        "name": name,
        "category": category,
        "price": price,
        "images": image_urls,
        "description": description,
        "rating": rating,
        "stock": int(request.form.get("stock", "10")),
        "subcategory": request.form.get("subcategory", ""),
        "popularityScore": round(0.5 + (hash(name) % 50) / 100, 2),
        "createdAt": datetime.utcnow().isoformat()
    }

    products = _read_json(PRODUCTS_FILE)
    products.append(new_product)
    _write_json(PRODUCTS_FILE, products)

    return jsonify(new_product), 201


@app.route("/api/products/<product_id>", methods=["PUT"])
def update_product(product_id):
    products = _read_json(PRODUCTS_FILE)
    idx = next((i for i, p in enumerate(products) if p["id"] == product_id), None)
    if idx is None:
        return jsonify({"error": "Not found"}), 404

    product = products[idx]

    # Update text fields
    for field in ["name", "category", "price", "description", "rating"]:
        val = request.form.get(field)
        if val is not None:
            if field in ("price", "rating", "stock"):
                try:
                    val = float(val) if field != "stock" else int(float(val))
                except ValueError:
                    pass
            product[field] = val
        if "subcategory" in request.form:
            product["subcategory"] = request.form.get("subcategory")

    # Handle new images (append)
    files = request.files.getlist("images")
    if files and files[0].filename:
        category = product.get("category", "General")
        img_dir = os.path.join(IMAGES_DIR, category, product_id)
        os.makedirs(img_dir, exist_ok=True)
        existing_count = len(product.get("images", []))
        for idx_f, f in enumerate(files):
            if f.filename:
                ext = os.path.splitext(f.filename)[1] or ".jpg"
                fname = f"{product_id}-{existing_count + idx_f}{ext}"
                save_path = os.path.join(img_dir, fname)
                f.save(save_path)
                product.setdefault("images", []).append(
                    f"/api/images/{category}/{product_id}/{fname}"
                )

    products[idx] = product
    _write_json(PRODUCTS_FILE, products)
    return jsonify(product), 200


@app.route("/api/products/<product_id>", methods=["DELETE"])
def delete_product(product_id):
    products = _read_json(PRODUCTS_FILE)
    to_delete = next((p for p in products if p["id"] == product_id), None)
    if not to_delete:
        return jsonify({"error": "Not found"}), 404

    # Remove product images folder
    category = to_delete.get("category", "General")
    img_dir = os.path.join(IMAGES_DIR, category, product_id)
    if os.path.isdir(img_dir):
        shutil.rmtree(img_dir, ignore_errors=True)

    products = [p for p in products if p["id"] != product_id]
    _write_json(PRODUCTS_FILE, products)

    # Remove from all carts
    carts = _read_json(CART_FILE, default={})
    if isinstance(carts, dict):
        for uid in carts:
            carts[uid] = [item for item in carts[uid] if item.get("productId") != product_id]
        _write_json(CART_FILE, carts)

    return jsonify({"message": "Product deleted"}), 200


@app.route("/api/products/<product_id>/restock", methods=["POST"])
def restock_product(product_id):
    data = request.get_json(force=True)
    amount = data.get("amount", 0)
    products = _read_json(PRODUCTS_FILE)
    for p in products:
        if p["id"] == product_id:
            p["stock"] = p.get("stock", 0) + amount
            break
    _write_json(PRODUCTS_FILE, products)
    return jsonify({"message": "Stock updated", "id": product_id})


@app.route("/api/products/restock-all", methods=["POST"])
def restock_all_products():
    data = request.get_json(force=True)
    amount = data.get("amount", 10)
    low_only = data.get("lowOnly", True)
    products = _read_json(PRODUCTS_FILE)
    updated_count = 0
    for p in products:
        curr = p.get("stock", 0)
        if not low_only or curr <= 5:
            p["stock"] = curr + amount
            updated_count += 1
    _write_json(PRODUCTS_FILE, products)
    return jsonify({"message": f"Restocked {updated_count} items", "updated": updated_count})


# ---------------------------------------------------------------------------
# SERVE PRODUCT IMAGES
# ---------------------------------------------------------------------------
@app.route("/api/images/<path:filepath>")
def serve_image(filepath):
    """Serve uploaded product images from data/images/"""
    return send_from_directory(IMAGES_DIR, filepath)


# ---------------------------------------------------------------------------
# SERVE 3D MODELS (GLB files) for AR try-on
# ---------------------------------------------------------------------------
MODELS_DIR = os.path.join(BASE_DIR, "..", "data")

@app.route("/api/models/<path:filename>")
def serve_model(filename):
    """Serve 3D model files (GLB) from the root data/ folder."""
    return send_from_directory(
        os.path.realpath(MODELS_DIR),
        filename,
        mimetype="model/gltf-binary"
    )


@app.route("/api/static-images/<path:filepath>")
def serve_static_image(filepath):
    """Serve original images from root images/ folder (used by seed data)."""
    return send_from_directory(ROOT_IMAGES_DIR, filepath)


# ---------------------------------------------------------------------------
# CART  — per-user cart stored in cart.json  { userId: [ { productId, quantity } ] }
# ---------------------------------------------------------------------------
@app.route("/api/cart/<user_id>", methods=["GET"])
def get_cart(user_id):
    carts = _read_json(CART_FILE, default={})
    if not isinstance(carts, dict):
        carts = {}
    user_cart = carts.get(user_id, [])

    # Expand product data
    products = _read_json(PRODUCTS_FILE)
    product_map = {p["id"]: p for p in products}
    expanded = []
    for item in user_cart:
        prod = product_map.get(item["productId"])
        if prod:
            expanded.append({
                "product": prod,
                "quantity": item["quantity"]
            })
    return jsonify(expanded)


@app.route("/api/cart/<user_id>", methods=["POST"])
def add_to_cart(user_id):
    data = request.get_json(force=True)
    product_id = data.get("productId")
    quantity = data.get("quantity", 1)

    if not product_id:
        return jsonify({"error": "productId is required"}), 400

    carts = _read_json(CART_FILE, default={})
    if not isinstance(carts, dict):
        carts = {}

    user_cart = carts.get(user_id, [])

    # Check if already in cart
    existing = next((i for i in user_cart if i["productId"] == product_id), None)
    if existing:
        existing["quantity"] += quantity
    else:
        user_cart.append({"productId": product_id, "quantity": quantity})

    carts[user_id] = user_cart
    _write_json(CART_FILE, carts)
    return jsonify({"message": "Added to cart"}), 200


@app.route("/api/cart/<user_id>/<product_id>", methods=["PUT"])
def update_cart_item(user_id, product_id):
    data = request.get_json(force=True)
    quantity = data.get("quantity", 1)

    carts = _read_json(CART_FILE, default={})
    if not isinstance(carts, dict):
        carts = {}

    user_cart = carts.get(user_id, [])
    for item in user_cart:
        if item["productId"] == product_id:
            item["quantity"] = max(1, quantity)
            break

    carts[user_id] = user_cart
    _write_json(CART_FILE, carts)
    return jsonify({"message": "Cart updated"}), 200


@app.route("/api/cart/<user_id>/<product_id>", methods=["DELETE"])
def remove_from_cart(user_id, product_id):
    carts = _read_json(CART_FILE, default={})
    if not isinstance(carts, dict):
        carts = {}

    user_cart = carts.get(user_id, [])
    carts[user_id] = [i for i in user_cart if i["productId"] != product_id]
    _write_json(CART_FILE, carts)
    return jsonify({"message": "Removed from cart"}), 200


@app.route("/api/cart/<user_id>", methods=["DELETE"])
def clear_cart(user_id):
    carts = _read_json(CART_FILE, default={})
    if not isinstance(carts, dict):
        carts = {}
    carts[user_id] = []
    _write_json(CART_FILE, carts)
    return jsonify({"message": "Cart cleared"}), 200


# ---------------------------------------------------------------------------
# CHATBOT  — Uses Gemini with product context from products.json
# ---------------------------------------------------------------------------
@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json(force=True)
    history = data.get("history", [])

    if not HAS_GENAI or not GEMINI_API_KEY:
        return jsonify({
            "reply": "⚠️ AI chatbot is not configured. Please set GEMINI_API_KEY."
        }), 200

    # Build product context from the live products.json
    products = _read_json(PRODUCTS_FILE)
    product_context = "\n".join(
        f"- {p['name']} (ID: {p['id']}, Category: {p['category']}, "
        f"Price: ₹{p['price']}, Rating: {p.get('rating', 'N/A')}/5, "
        f"Description: {p.get('description', 'N/A')})"
        for p in products
    )

    system_instruction = f"""
You are the "SmartShop AI Assistant", an expert personal shopper for this e-commerce store.

STRICT GUIDELINES:
1. SCOPE: You must ONLY discuss products listed in the "Current Inventory" below. Do not answer questions about general topics unless they relate to shopping here.
2. AVAILABILITY: All products in the "Current Inventory" are IN STOCK and available for immediate shipping.
3. ASSISTANCE: Help users choose products by comparing prices, ratings, and features from the inventory. Be proactive in suggesting items.
4. TONE: Be helpful, polite, and enthusiastic. Use emojis to make the conversation engaging.
5. CURRENCY: Always quote prices in ₹ (INR).

Current Inventory:
{product_context}
"""

    try:
        contents = []
        for msg in history:
            contents.append({
                "role": msg.get("role", "user"),
                "parts": [{"text": msg.get("text", "")}]
            })

        reply = None
        for model_name in _GEMINI_MODELS:
            try:
                model = genai.GenerativeModel(
                    model_name=model_name,
                    system_instruction=system_instruction
                )
                result = model.generate_content(
                    contents,
                    generation_config={"temperature": 0.7}
                )
                reply = result.text
                break
            except Exception as e:
                msg = str(e)
                if "429" in msg or "503" in msg or "quota" in msg.lower() or "RESOURCE_EXHAUSTED" in msg or "high demand" in msg.lower():
                    continue  # try next model
                raise  # non-transient error
        if reply is None:
            reply = "⚠️ AI Error: All Gemini models are temporarily overloaded. Please try again in a few minutes."
    except Exception as e:
        reply = f"⚠️ AI Error: {str(e)}"

    return jsonify({"reply": reply}), 200


# ---------------------------------------------------------------------------
# ORDERS  — purchase history stored in orders.json  { userId: [ { orderId, items, total, ... } ] }
# ---------------------------------------------------------------------------
@app.route("/api/orders", methods=["GET"])
def get_all_orders():
    """Admin: return every order across all users, newest first, with userId attached."""
    all_orders = _read_json(ORDERS_FILE, default={})
    if not isinstance(all_orders, dict):
        return jsonify([])
    users = _read_json(USERS_FILE)
    user_map = {u["id"]: u for u in users}
    flat = []
    for uid, orders in all_orders.items():
        u = user_map.get(uid, {})
        for order in orders:
            flat.append({
                **order,
                "userId":   uid,
                "username": u.get("username", uid),
                "name":     u.get("name", uid),
                "avatar":   u.get("avatar", ""),
            })
    flat.sort(key=lambda o: o.get("date", ""), reverse=True)
    return jsonify(flat)


@app.route("/api/orders/<user_id>", methods=["GET"])
def get_orders(user_id):
    all_orders = _read_json(ORDERS_FILE, default={})
    if not isinstance(all_orders, dict):
        all_orders = {}
    user_orders = all_orders.get(user_id, [])
    return jsonify(user_orders)


@app.route("/api/orders/<user_id>", methods=["POST"])
def create_order(user_id):
    data = request.get_json(force=True)
    items = data.get("items", [])  # [ { productId, quantity } ]
    address = data.get("address", "India Academic Region, Sector 2026")

    if not items:
        return jsonify({"error": "No items in order"}), 400

    # Expand product info and calculate total
    products = _read_json(PRODUCTS_FILE)
    product_map = {p["id"]: p for p in products}
    expanded_items = []
    total = 0
    for item in items:
        prod = product_map.get(item.get("productId", ""))
        if prod:
            qty = item.get("quantity", 1)
            expanded_items.append({
                "productId": prod["id"],
                "name": prod["name"],
                "category": prod["category"],
                "price": prod["price"],
                "image": prod["images"][0] if prod.get("images") else "",
                "quantity": qty
            })
            total += prod["price"] * qty

    new_order = {
        "id": f"ORD-{uuid.uuid4().hex[:8].upper()}",
        "items": expanded_items,
        "total": total,
        "address": address,
        "paymentMethod": data.get("paymentMethod", "COD"),
        "transactionId": data.get("transactionId", ""),
        "status": "Confirmed",
        "date": datetime.utcnow().isoformat()
    }

    # Reduce stock
    for item in items:
        pid = item.get("productId")
        qty = item.get("quantity", 1)
        for p in products:
            if p["id"] == pid:
                p["stock"] = max(0, p.get("stock", 10) - qty)
                break
    _write_json(PRODUCTS_FILE, products)

    all_orders = _read_json(ORDERS_FILE, default={})
    if not isinstance(all_orders, dict):
        all_orders = {}
    user_orders = all_orders.get(user_id, [])
    user_orders.insert(0, new_order)  # newest first
    all_orders[user_id] = user_orders
    _write_json(ORDERS_FILE, all_orders)

    # Clear user's cart after purchase
    carts = _read_json(CART_FILE, default={})
    if isinstance(carts, dict):
        carts[user_id] = []
        _write_json(CART_FILE, carts)

    return jsonify(new_order), 201


# ---------------------------------------------------------------------------
# CATEGORIES
# ---------------------------------------------------------------------------
@app.route("/api/categories", methods=["GET"])
def get_categories():
    cats = _read_json(CATEGORIES_FILE, default=[])
    return jsonify(cats)


@app.route("/api/categories", methods=["POST"])
def create_category():
    """
    Expects multipart/form-data:
      - name  (required, text field)
      - logo  (optional, image file)
    """
    name = request.form.get("name", "").strip()
    if not name:
        return jsonify({"error": "Category name is required"}), 400

    cats = _read_json(CATEGORIES_FILE, default=[])
    # Prevent duplicates (case-insensitive)
    if any(c["name"].lower() == name.lower() for c in cats):
        return jsonify({"error": "Category already exists"}), 409

    code = uuid.uuid4().hex[:12]
    logo_url = ""

    logo_file = request.files.get("logo")
    if logo_file and logo_file.filename:
        ext = os.path.splitext(logo_file.filename)[1] or ".png"
        logo_dir = os.path.join(CATEGORY_LOGOS_DIR, code)
        os.makedirs(logo_dir, exist_ok=True)
        filename = f"logo{ext}"
        logo_file.save(os.path.join(logo_dir, filename))
        logo_url = f"/api/category-logo/{code}/{filename}"

    new_cat = {"name": name, "code": code, "logoUrl": logo_url, "subcategories": []}
    cats.append(new_cat)
    _write_json(CATEGORIES_FILE, cats)
    return jsonify(new_cat), 201


@app.route("/api/category-logo/<code>/<filename>", methods=["GET"])
def serve_category_logo(code, filename):
    logo_dir = os.path.join(CATEGORY_LOGOS_DIR, code)
    return send_from_directory(logo_dir, filename)


@app.route("/api/categories/<code>", methods=["DELETE"])
def delete_category(code):
    cats = _read_json(CATEGORIES_FILE, default=[])
    cats = [c for c in cats if c.get("code") != code]
    _write_json(CATEGORIES_FILE, cats)
    # Optionally remove logo folder
    logo_dir = os.path.join(CATEGORY_LOGOS_DIR, code)
    if os.path.isdir(logo_dir):
        shutil.rmtree(logo_dir, ignore_errors=True)
    return jsonify({"ok": True})


@app.route("/api/categories/<code>/subcategories", methods=["POST"])
def add_subcategory(code):
    data = request.get_json(force=True)
    sub_name = data.get("name", "").strip()
    if not sub_name:
        return jsonify({"error": "Subcategory name required"}), 400
    
    cats = _read_json(CATEGORIES_FILE, default=[])
    for c in cats:
        if c.get("code") == code:
            if "subcategories" not in c:
                c["subcategories"] = []
            if sub_name not in c["subcategories"]:
                c["subcategories"].append(sub_name)
            break
    _write_json(CATEGORIES_FILE, cats)
    return jsonify({"ok": True})


@app.route("/api/categories/<code>/subcategories/<subname>", methods=["DELETE"])
def delete_subcategory(code, subname):
    cats = _read_json(CATEGORIES_FILE, default=[])
    for c in cats:
        if c.get("code") == code:
            if "subcategories" in c:
                c["subcategories"] = [s for s in c["subcategories"] if s != subname]
            break
    _write_json(CATEGORIES_FILE, cats)
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# ADDRESSES
# ---------------------------------------------------------------------------
@app.route("/api/address/<user_id>", methods=["GET"])
def get_addresses(user_id):
    all_addr = _read_json(ADDRESS_FILE, default={})
    return jsonify(all_addr.get(user_id, []))


@app.route("/api/address/<user_id>", methods=["POST"])
def add_address(user_id):
    data = request.get_json(force=True)
    address = data.get("address", "").strip()
    if not address:
        return jsonify({"error": "Address required"}), 400
    
    all_addr = _read_json(ADDRESS_FILE, default={})
    user_addr = all_addr.get(user_id, [])
    if address not in user_addr:
        user_addr.append(address)
    all_addr[user_id] = user_addr
    _write_json(ADDRESS_FILE, all_addr)
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# OCCASIONS
# ---------------------------------------------------------------------------
@app.route("/api/occasions", methods=["GET"])
def get_occasions():
    occasions = _read_json(OCCASIONS_FILE, default=[])
    return jsonify(occasions)


@app.route("/api/occasions", methods=["POST"])
def create_occasion():
    """
    Body JSON: { name, tag, productIds }
    """
    data = request.get_json(force=True)
    name = data.get("name", "").strip()
    tag = data.get("tag", "").strip()
    product_ids = data.get("productIds", [])

    if not name:
        return jsonify({"error": "Occasion name is required"}), 400

    occasions = _read_json(OCCASIONS_FILE, default=[])
    if any(o["name"].lower() == name.lower() for o in occasions):
        return jsonify({"error": "An occasion with this name already exists"}), 409

    new_occ = {
        "id": uuid.uuid4().hex[:10],
        "name": name,
        "tag": tag,
        "productIds": product_ids,
        "createdAt": datetime.utcnow().isoformat()
    }
    occasions.append(new_occ)
    _write_json(OCCASIONS_FILE, occasions)
    return jsonify(new_occ), 201


@app.route("/api/occasions/<occ_id>", methods=["PUT"])
def update_occasion(occ_id):
    data = request.get_json(force=True)
    occasions = _read_json(OCCASIONS_FILE, default=[])
    for o in occasions:
        if o["id"] == occ_id:
            if "name" in data:
                o["name"] = data["name"].strip()
            if "tag" in data:
                o["tag"] = data["tag"].strip()
            if "productIds" in data:
                o["productIds"] = data["productIds"]
            _write_json(OCCASIONS_FILE, occasions)
            return jsonify(o)
    return jsonify({"error": "Not found"}), 404


@app.route("/api/occasions/<occ_id>", methods=["DELETE"])
def delete_occasion(occ_id):
    occasions = _read_json(OCCASIONS_FILE, default=[])
    occasions = [o for o in occasions if o.get("id") != occ_id]
    _write_json(OCCASIONS_FILE, occasions)
    return jsonify({"ok": True})


# ===========================================================================
# ===========================================================================
# BLOCKCHAIN — Review Integrity Ledger
# ===========================================================================
# Each product has its own chain stored in review_chain.json:
#   { "product_id": [ block, block, ... ] }
#
# Block structure:
#   blockIndex     – position in chain (0 = genesis)
#   reviewId       – "GENESIS" or the review's id
#   dataHash       – SHA-256 of (userId|rating|text|date)  ← content fingerprint
#   previousHash   – hash of the preceding block
#   blockHash      – SHA-256 of (blockIndex|reviewId|dataHash|previousHash|timestamp)
#   timestamp      – ISO datetime the block was sealed
#
# Tampering a review changes its dataHash → the blockHash no longer matches
# what is stored → chain is broken at that point.
# ---------------------------------------------------------------------------

GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000"


def _sha256(text: str) -> str:
    """Return lowercase hex SHA-256 digest of a UTF-8 string."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _data_hash(review: dict) -> str:
    """Fingerprint the mutable fields of a review."""
    payload = "|".join([
        str(review.get("userId", "")),
        str(review.get("rating", "")),
        str(review.get("text", "")),
        str(review.get("date", "")),
    ])
    return _sha256(payload)


def _block_hash(block_index: int, review_id: str, data_hash: str,
                previous_hash: str, timestamp: str) -> str:
    """Compute the block's own hash from all its fields."""
    payload = "|".join([
        str(block_index),
        review_id,
        data_hash,
        previous_hash,
        timestamp,
    ])
    return _sha256(payload)


def _get_chain(product_id: str) -> list:
    """Load the blockchain ledger for one product."""
    all_chains = _read_json(CHAIN_FILE, default={})
    if not isinstance(all_chains, dict):
        all_chains = {}
    return all_chains.get(product_id, [])


def _save_chain(product_id: str, chain: list):
    """Persist the chain for one product."""
    all_chains = _read_json(CHAIN_FILE, default={})
    if not isinstance(all_chains, dict):
        all_chains = {}
    all_chains[product_id] = chain
    _write_json(CHAIN_FILE, all_chains)


def _ensure_genesis(product_id: str) -> list:
    """Return the chain, creating a genesis block if empty."""
    chain = _get_chain(product_id)
    if not chain:
        ts = datetime.utcnow().isoformat()
        bh = _block_hash(0, "GENESIS", GENESIS_HASH, GENESIS_HASH, ts)
        genesis = {
            "blockIndex":    0,
            "reviewId":      "GENESIS",
            "dataHash":      GENESIS_HASH,
            "previousHash":  GENESIS_HASH,
            "blockHash":     bh,
            "timestamp":     ts,
        }
        chain = [genesis]
        _save_chain(product_id, chain)
    return chain


def _append_block(product_id: str, review: dict) -> dict:
    """
    Seal a new block for the given review and append it to the product chain.
    Returns the new block.
    """
    chain     = _ensure_genesis(product_id)
    prev      = chain[-1]
    idx       = prev["blockIndex"] + 1
    dh        = _data_hash(review)
    ts        = datetime.utcnow().isoformat()
    bh        = _block_hash(idx, review["id"], dh, prev["blockHash"], ts)
    block = {
        "blockIndex":   idx,
        "reviewId":     review["id"],
        "dataHash":     dh,
        "previousHash": prev["blockHash"],
        "blockHash":    bh,
        "timestamp":    ts,
    }
    chain.append(block)
    _save_chain(product_id, chain)
    return block


def _rebuild_chain(product_id: str, reviews: list):
    """
    Rebuild the entire chain for a product from a list of reviews
    (used after delete or when migrating existing reviews).
    """
    # Start fresh with a genesis block
    ts = datetime.utcnow().isoformat()
    bh = _block_hash(0, "GENESIS", GENESIS_HASH, GENESIS_HASH, ts)
    chain = [{
        "blockIndex":   0,
        "reviewId":     "GENESIS",
        "dataHash":     GENESIS_HASH,
        "previousHash": GENESIS_HASH,
        "blockHash":    bh,
        "timestamp":    ts,
    }]
    for i, review in enumerate(reviews, start=1):
        prev = chain[-1]
        dh = _data_hash(review)
        ts = review.get("date", datetime.utcnow().isoformat())
        bh = _block_hash(i, review["id"], dh, prev["blockHash"], ts)
        chain.append({
            "blockIndex":   i,
            "reviewId":     review["id"],
            "dataHash":     dh,
            "previousHash": prev["blockHash"],
            "blockHash":    bh,
            "timestamp":    ts,
        })
    _save_chain(product_id, chain)
    return chain


def _verify_chain(product_id: str, reviews: list) -> dict:
    """
    Verify the stored chain against live review data.
    Returns a dict with per-review verification and summary stats.
    """
    chain = _get_chain(product_id)
    if not chain:
        return {"chainExists": False, "blocks": [], "totalBlocks": 0,
                "verified": 0, "tampered": 0, "integrityPct": 0}

    # Build lookup: reviewId → review
    review_map = {r["id"]: r for r in reviews}

    results   = []
    tampered  = 0
    verified  = 0

    for i, block in enumerate(chain):
        is_genesis = block["reviewId"] == "GENESIS"

        # 1. Verify blockHash is internally consistent
        recomputed_bh = _block_hash(
            block["blockIndex"],
            block["reviewId"],
            block["dataHash"],
            block["previousHash"],
            block["timestamp"],
        )
        hash_ok = recomputed_bh == block["blockHash"]

        # 2. Verify chain link (previousHash matches previous block)
        if i == 0:
            link_ok = block["previousHash"] == GENESIS_HASH
        else:
            link_ok = block["previousHash"] == chain[i - 1]["blockHash"]

        # 3. Verify data integrity (review content unchanged)
        if is_genesis:
            data_ok = True
        elif block["reviewId"] in review_map:
            live_dh = _data_hash(review_map[block["reviewId"]])
            data_ok = live_dh == block["dataHash"]
        else:
            data_ok = False  # review deleted → orphaned block

        block_valid = hash_ok and link_ok and data_ok
        if block_valid:
            verified += 1
        else:
            tampered += 1

        results.append({
            **block,
            "hashOk":     hash_ok,
            "linkOk":     link_ok,
            "dataOk":     data_ok,
            "blockValid":  block_valid,
            "isGenesis":  is_genesis,
        })

    total       = len(chain)
    integrity   = round((verified / total) * 100, 1) if total else 0

    return {
        "chainExists":   True,
        "productId":     product_id,
        "totalBlocks":   total,
        "verified":      verified,
        "tampered":      tampered,
        "integrityPct":  integrity,
        "genesisHash":   chain[0]["blockHash"] if chain else "",
        "latestHash":    chain[-1]["blockHash"] if chain else "",
        "blocks":        results,
    }


# ---------------------------------------------------------------------------
# REVIEWS — with Fake Review Detection
# ===========================================================================

def _detect_fake_review(review_text: str, product_category: str) -> bool:
    """
    Detect if a review is potentially fake by checking if it mentions 
    a different product category than the actual product.
    
    Args:
        review_text: The review text content
        product_category: The actual category of the product being reviewed
    
    Returns:
        True if review is suspected to be fake, False otherwise
    """
    # Define category keywords that indicate what product is being mentioned
    category_keywords = {
        "Jackets": ["jacket", "coat", "blazer", "hoodie", "puffer", "windbreaker", "outerwear"],
        "Lipsticks": ["lipstick", "lip", "makeup", "cosmetic", "gloss", "balm", "lip color"],
        "Shirts": ["shirt", "blouse", "tshirt", "t-shirt", "top", "tee"],
        "Shoes": ["shoe", "sneaker", "boot", "sandal", "footwear", "heel", "slipper", "loafer"],
        "Sunglasses": ["sunglasses", "glasses", "shades", "eyewear", "sunglass", "spectacle"],
        # Generic categories
        "Dress": ["dress", "gown", "frock"],
        "Pants": ["pant", "trouser", "jean", "denim"],
        "Bag": ["bag", "purse", "handbag", "backpack"],
        "Watch": ["watch", "timepiece"],
        "Ring": ["ring", "jewelry"],
    }
    
    # Generic compliments that should NOT trigger fake detection
    generic_words = [
        "product", "item", "purchase", "buy", "quality", "price", "value",
        "nice", "good", "great", "excellent", "amazing", "awesome", "wonderful",
        "bad", "poor", "terrible", "horrible", "worst", "best", "love", "hate"
    ]
    
    review_lower = review_text.lower()
    actual_category = product_category.strip()
    
    # Check if review mentions any specific category
    for category, keywords in category_keywords.items():
        for keyword in keywords:
            # Use word boundary to match whole words only
            # This prevents "shoe" from matching in "shoes" context incorrectly
            import re
            pattern = r'\b' + re.escape(keyword) + r'\b'
            
            if re.search(pattern, review_lower):
                # If mentioned category doesn't match actual category
                if category != actual_category:
                    # Check if the keyword is part of a generic phrase
                    # Extract context around the keyword
                    match_pos = review_lower.find(keyword)
                    context_before = review_lower[max(0, match_pos - 20):match_pos].strip()
                    context_after = review_lower[match_pos + len(keyword):match_pos + len(keyword) + 20].strip()
                    
                    # Check if it's a generic compliment like "nice product" or "good quality"
                    is_generic = False
                    for generic in generic_words:
                        if generic in context_before or generic in context_after:
                            is_generic = True
                            break
                    
                    # Only flag if it's NOT part of a generic phrase
                    if not is_generic:
                        # Additional check: make sure actual category is not mentioned
                        actual_keywords = category_keywords.get(actual_category, [])
                        actual_mentioned = any(re.search(r'\b' + re.escape(kw) + r'\b', review_lower) for kw in actual_keywords)
                        
                        # If actual category is not mentioned but another category is, flag as fake
                        if not actual_mentioned:
                            return True
    
    return False


@app.route("/api/reviews/<product_id>", methods=["GET"])
def get_reviews(product_id):
    """Return all reviews for a product, newest first, with fake detection + blockchain verification."""
    all_reviews = _read_json(REVIEWS_FILE, default={})
    if not isinstance(all_reviews, dict):
        all_reviews = {}

    reviews = all_reviews.get(product_id, [])

    # Get product category for fake detection
    products = _read_json(PRODUCTS_FILE)
    product  = next((p for p in products if p["id"] == product_id), None)
    product_category = product.get("category", "") if product else ""

    # Apply fake detection to all reviews
    for review in reviews:
        if "isFake" not in review:
            review["isFake"] = _detect_fake_review(review.get("text", ""), product_category)

    # --- Blockchain: if no chain exists yet, build one from existing reviews ---
    chain = _get_chain(product_id)
    if not chain and reviews:
        chain = _rebuild_chain(product_id, list(reversed(reviews)))  # oldest→newest

    # Annotate each review with its blockchain verification status
    chain_lookup = {b["reviewId"]: b for b in chain}
    for review in reviews:
        block = chain_lookup.get(review["id"])
        if block:
            live_dh   = _data_hash(review)
            data_ok   = live_dh == block["dataHash"]
            review["blockHash"]      = block["blockHash"]
            review["blockIndex"]     = block["blockIndex"]
            review["chainVerified"]  = data_ok
            review["dataHash"]       = block["dataHash"]
        else:
            review["blockHash"]      = None
            review["blockIndex"]     = None
            review["chainVerified"]  = False
            review["dataHash"]       = None

    return jsonify(reviews)


@app.route("/api/reviews/<product_id>", methods=["POST"])
def add_review(product_id):
    """
    Add or update a review for a product with fake detection.
    Body: { userId, username, name, avatar, rating (1-5), text }
    One review per user per product — updates if already exists.
    """
    data     = request.get_json(force=True)
    user_id  = data.get("userId", "").strip()
    username = data.get("username", "").strip()
    name     = data.get("name", username).strip()
    avatar   = data.get("avatar", "").strip()
    rating   = data.get("rating", 0)
    text     = data.get("text", "").strip()

    if not user_id or not rating or not text:
        return jsonify({"error": "userId, rating and text are required"}), 400

    try:
        rating = int(rating)
        if not 1 <= rating <= 5:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"error": "rating must be an integer between 1 and 5"}), 400

    # Get product category for fake detection
    products = _read_json(PRODUCTS_FILE)
    product = next((p for p in products if p["id"] == product_id), None)
    if not product:
        return jsonify({"error": "Product not found"}), 404
    
    product_category = product.get("category", "")
    
    # Detect if review is fake
    is_fake = _detect_fake_review(text, product_category)

    all_reviews = _read_json(REVIEWS_FILE, default={})
    if not isinstance(all_reviews, dict):
        all_reviews = {}

    product_reviews = all_reviews.get(product_id, [])

    # One review per user — update if exists
    existing_idx = next((i for i, r in enumerate(product_reviews) if r["userId"] == user_id), None)

    review = {
        "id":        f"rev_{uuid.uuid4().hex[:8]}",
        "productId": product_id,
        "userId":    user_id,
        "username":  username,
        "name":      name,
        "avatar":    avatar,
        "rating":    rating,
        "text":      text,
        "date":      datetime.utcnow().isoformat(),
        "isFake":    is_fake
    }

    if existing_idx is not None:
        review["id"] = product_reviews[existing_idx]["id"]  # keep original id
        product_reviews[existing_idx] = review
    else:
        product_reviews.insert(0, review)  # newest first

    all_reviews[product_id] = product_reviews
    _write_json(REVIEWS_FILE, all_reviews)

    # --- Blockchain: seal this review into a new block ---
    if existing_idx is None:
        # New review → append a fresh block
        block = _append_block(product_id, review)
    else:
        # Updated review → rebuild the whole chain so hashes stay consistent
        oldest_first = list(reversed(product_reviews))
        chain = _rebuild_chain(product_id, oldest_first)
        chain_lookup = {b["reviewId"]: b for b in chain}
        block = chain_lookup.get(review["id"], {})

    review["blockHash"]     = block.get("blockHash")
    review["blockIndex"]    = block.get("blockIndex")
    review["chainVerified"] = True
    review["dataHash"]      = block.get("dataHash")

    # Update the product's average rating
    for p in products:
        if p["id"] == product_id:
            avg = round(sum(r["rating"] for r in product_reviews) / len(product_reviews), 1)
            p["rating"] = avg
            break
    _write_json(PRODUCTS_FILE, products)

    return jsonify(review), 201


@app.route("/api/reviews/<product_id>/<review_id>", methods=["DELETE"])
def delete_review(product_id, review_id):
    """Delete a review (admin or owner)."""
    all_reviews = _read_json(REVIEWS_FILE, default={})
    if not isinstance(all_reviews, dict):
        all_reviews = {}

    product_reviews = all_reviews.get(product_id, [])
    new_list = [r for r in product_reviews if r["id"] != review_id]
    if len(new_list) == len(product_reviews):
        return jsonify({"error": "Review not found"}), 404

    all_reviews[product_id] = new_list
    _write_json(REVIEWS_FILE, all_reviews)

    # --- Blockchain: rebuild chain after deletion so links stay valid ---
    if new_list:
        _rebuild_chain(product_id, list(reversed(new_list)))  # oldest first
    else:
        # No reviews left — clear the chain
        all_chains = _read_json(CHAIN_FILE, default={})
        if isinstance(all_chains, dict):
            all_chains.pop(product_id, None)
            _write_json(CHAIN_FILE, all_chains)

    # Recalculate rating
    products = _read_json(PRODUCTS_FILE)
    for p in products:
        if p["id"] == product_id:
            if new_list:
                p["rating"] = round(sum(r["rating"] for r in new_list) / len(new_list), 1)
            break
    _write_json(PRODUCTS_FILE, products)

    return jsonify({"message": "Review deleted"}), 200


@app.route("/api/reviews/<product_id>/verify-chain", methods=["GET"])
def verify_review_chain(product_id):
    """
    Blockchain integrity check for a product's reviews.
    Returns full block-by-block verification report.

    Test with:
      curl http://localhost:5000/api/reviews/ja-3cf84e/verify-chain
    """
    all_reviews = _read_json(REVIEWS_FILE, default={})
    if not isinstance(all_reviews, dict):
        all_reviews = {}
    reviews = all_reviews.get(product_id, [])

    # Auto-build chain if missing
    chain = _get_chain(product_id)
    if not chain and reviews:
        _rebuild_chain(product_id, list(reversed(reviews)))

    report = _verify_chain(product_id, reviews)
    return jsonify(report)


@app.route("/api/blockchain/stats", methods=["GET"])
def blockchain_stats():
    """
    Global blockchain statistics across all products.

    Test with:
      curl http://localhost:5000/api/blockchain/stats
    """
    all_chains  = _read_json(CHAIN_FILE, default={})
    all_reviews = _read_json(REVIEWS_FILE, default={})
    if not isinstance(all_chains, dict):
        all_chains = {}
    if not isinstance(all_reviews, dict):
        all_reviews = {}

    products_stats = []
    total_blocks   = 0
    total_verified = 0
    total_tampered = 0

    for product_id, chain in all_chains.items():
        reviews = all_reviews.get(product_id, [])
        report  = _verify_chain(product_id, reviews)
        products_stats.append({
            "productId":    product_id,
            "totalBlocks":  report["totalBlocks"],
            "verified":     report["verified"],
            "tampered":     report["tampered"],
            "integrityPct": report["integrityPct"],
            "latestHash":   report["latestHash"],
        })
        total_blocks   += report["totalBlocks"]
        total_verified += report["verified"]
        total_tampered += report["tampered"]

    overall_pct = round((total_verified / total_blocks) * 100, 1) if total_blocks else 0

    return jsonify({
        "totalProducts":  len(all_chains),
        "totalBlocks":    total_blocks,
        "totalVerified":  total_verified,
        "totalTampered":  total_tampered,
        "overallIntegrity": overall_pct,
        "products":       products_stats,
    })


@app.route("/api/blockchain/rebuild", methods=["POST"])
def rebuild_all_chains():
    """
    (Admin utility) Rebuild ALL product chains from current review data.
    Useful for migrating existing reviews into the blockchain.

    Test with:
      curl -X POST http://localhost:5000/api/blockchain/rebuild
    """
    all_reviews = _read_json(REVIEWS_FILE, default={})
    if not isinstance(all_reviews, dict):
        return jsonify({"error": "Invalid reviews data"}), 500

    rebuilt = []
    for product_id, reviews in all_reviews.items():
        if reviews:
            oldest_first = list(reversed(reviews))  # reviews stored newest-first
            chain = _rebuild_chain(product_id, oldest_first)
            rebuilt.append({"productId": product_id, "blocks": len(chain)})

    return jsonify({"rebuilt": len(rebuilt), "products": rebuilt})


# ===========================================================================
# SOCIAL — Friend Requests
# ===========================================================================

@app.route("/api/social/users", methods=["GET"])
def social_users():
    """Return all non-admin users (safe: no passwords)."""
    users = _read_json(USERS_FILE)
    safe  = [
        {k: v for k, v in u.items() if k != "password"}
        for u in users
        if u.get("role") != "admin"
    ]
    return jsonify(safe)


@app.route("/api/social/request", methods=["POST"])
def send_friend_request():
    data    = request.get_json(force=True)
    from_id = data.get("fromId", "").strip()
    to_id   = data.get("toId", "").strip()

    if not from_id or not to_id:
        return jsonify({"error": "fromId and toId are required"}), 400

    users  = _read_json(USERS_FILE)
    sender = next((u for u in users if u["id"] == from_id), None)
    if not sender:
        return jsonify({"error": "Sender not found"}), 404

    all_req = _read_json(REQUESTS_FILE, default={})
    if not isinstance(all_req, dict):
        all_req = {}

    to_list  = all_req.get(to_id, [])
    existing = next((r for r in to_list if r["fromId"] == from_id), None)
    if existing:
        return jsonify({"error": "Request already sent", "request": existing}), 409

    new_request = {
        "id":         f"req_{uuid.uuid4().hex[:8]}",
        "fromId":     from_id,
        "fromName":   sender.get("name") or sender.get("username", ""),
        "fromAvatar": sender.get("avatar", ""),
        "status":     "pending",
        "timestamp":  datetime.utcnow().isoformat()
    }
    to_list.append(new_request)
    all_req[to_id] = to_list
    _write_json(REQUESTS_FILE, all_req)
    return jsonify({"message": "Friend request sent", "request": new_request}), 201


@app.route("/api/social/requests/<user_id>", methods=["GET"])
def get_requests(user_id):
    """Incoming requests for user_id."""
    all_req = _read_json(REQUESTS_FILE, default={})
    if not isinstance(all_req, dict):
        all_req = {}
    return jsonify(all_req.get(user_id, []))


@app.route("/api/social/request/<request_id>", methods=["PUT"])
def respond_to_request(request_id):
    """
    Accept or decline a friend request.
    Body: { userId: <recipient>, action: 'accept' | 'decline' }
    """
    data    = request.get_json(force=True)
    user_id = data.get("userId", "").strip()
    action  = data.get("action", "").strip()

    if action not in ("accept", "decline"):
        return jsonify({"error": "action must be 'accept' or 'decline'"}), 400

    all_req   = _read_json(REQUESTS_FILE, default={})
    user_reqs = all_req.get(user_id, [])
    target    = next((r for r in user_reqs if r["id"] == request_id), None)
    if not target:
        return jsonify({"error": "Request not found"}), 404

    if action == "accept":
        target["status"] = "accepted"
        # Mirror the accepted relationship into sender's list so both see 'friends'
        sender_reqs  = all_req.get(target["fromId"], [])
        mirror_exist = next((r for r in sender_reqs if r.get("mirrorTo") == user_id), None)
        if not mirror_exist:
            users     = _read_json(USERS_FILE)
            recipient = next((u for u in users if u["id"] == user_id), None)
            if recipient:
                sender_reqs.append({
                    "id":         f"req_{uuid.uuid4().hex[:8]}",
                    "fromId":     user_id,
                    "fromName":   recipient.get("name") or recipient.get("username", ""),
                    "fromAvatar": recipient.get("avatar", ""),
                    "status":     "accepted",
                    "mirrorTo":   user_id,
                    "timestamp":  datetime.utcnow().isoformat()
                })
                all_req[target["fromId"]] = sender_reqs
    else:
        user_reqs = [r for r in user_reqs if r["id"] != request_id]

    all_req[user_id] = user_reqs
    _write_json(REQUESTS_FILE, all_req)
    return jsonify({"message": f"Request {action}ed", "request": target}), 200


@app.route("/api/social/friends/<user_id>", methods=["GET"])
def get_friends(user_id):
    """
    Returns list of accepted friends for user_id.
    A friendship exists when request status == 'accepted' in either direction.
    """
    all_req    = _read_json(REQUESTS_FILE, default={})
    if not isinstance(all_req, dict):
        all_req = {}

    friend_ids = set()
    # Requests received by user_id
    for r in all_req.get(user_id, []):
        if r.get("status") == "accepted":
            friend_ids.add(r["fromId"])
    # Requests sent by user_id (mirrored)
    for uid, reqs in all_req.items():
        for r in reqs:
            if r.get("fromId") == user_id and r.get("status") == "accepted":
                friend_ids.add(uid)

    users   = _read_json(USERS_FILE)
    friends = [{k: v for k, v in u.items() if k != "password"} for u in users if u["id"] in friend_ids]
    return jsonify(friends)


# ===========================================================================
# SOCIAL — Chat (text + shared products)
# ===========================================================================

@app.route("/api/social/chat/<user1_id>/<user2_id>", methods=["GET"])
def get_conversation(user1_id, user2_id):
    all_chats = _read_json(CHATS_FILE, default={})
    if not isinstance(all_chats, dict):
        all_chats = {}
    cid = _convo_id(user1_id, user2_id)
    return jsonify(all_chats.get(cid, []))


@app.route("/api/social/chat/<user1_id>/<user2_id>", methods=["POST"])
def send_message(user1_id, user2_id):
    """
    Body: { senderId, text, type ('text'|'product'), product? }
    type='product' means the sender is sharing a product card.
    """
    data      = request.get_json(force=True)
    sender_id = data.get("senderId", user1_id)
    msg_type  = data.get("type", "text")   # 'text' | 'product'
    text      = data.get("text", "")
    product   = data.get("product", None)  # Full product object for type='product'

    new_msg = {
        "id":        f"msg_{uuid.uuid4().hex[:8]}",
        "senderId":  sender_id,
        "type":      msg_type,
        "text":      text,
        "product":   product,
        "timestamp": datetime.utcnow().isoformat()
    }

    all_chats    = _read_json(CHATS_FILE, default={})
    if not isinstance(all_chats, dict):
        all_chats = {}
    cid          = _convo_id(user1_id, user2_id)
    conversation = all_chats.get(cid, [])
    conversation.append(new_msg)
    all_chats[cid] = conversation
    _write_json(CHATS_FILE, all_chats)

    # If product share, also record in shared.json
    if msg_type == "product" and product:
        shared      = _read_json(SHARED_FILE, default={})
        if not isinstance(shared, dict):
            shared = {}
        shared_list = shared.get(cid, [])
        shared_list.append({
            "msgId":     new_msg["id"],
            "senderId":  sender_id,
            "product":   product,
            "timestamp": new_msg["timestamp"]
        })
        shared[cid] = shared_list
        _write_json(SHARED_FILE, shared)

    return jsonify(new_msg), 201


@app.route("/api/social/shared/<user1_id>/<user2_id>", methods=["GET"])
def get_shared(user1_id, user2_id):
    """Return all products shared between two users."""
    shared = _read_json(SHARED_FILE, default={})
    if not isinstance(shared, dict):
        shared = {}
    cid = _convo_id(user1_id, user2_id)
    return jsonify(shared.get(cid, []))


# ===========================================================================
# STARTUP
# ===========================================================================
_seed_defaults()

if __name__ == "__main__":
    print("=" * 60)
    print("  SmartShop AI Backend v2  —  http://localhost:5001")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5001, debug=True)
