require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");
const Stripe = require("stripe");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "pat-store-secret",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
  })
);

app.use(express.static(path.join(__dirname, "public")));

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function cleanEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Please login first" });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access only" });
  }
  next();
}

/* AUTH */
app.post("/api/auth/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = cleanEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!name || !email || password.length < 6) {
      return res.status(400).json({ error: "Name, email and password with at least 6 characters are required" });
    }

    const existing = await get("SELECT id FROM users WHERE email = ?", [email]);
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await run(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [name, email, passwordHash, "customer"]
    );

    req.session.user = { id: result.lastID, name, email, role: "customer" };
    res.json({ message: "Registered successfully", user: req.session.user });
  } catch (err) {
    res.status(500).json({ error: "Could not register" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = cleanEmail(req.body.email);
    const password = String(req.body.password || "");

    const user = await get("SELECT * FROM users WHERE email = ?", [email]);
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });

    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.json({ message: "Logged in successfully", user: req.session.user });
  } catch (err) {
    res.status(500).json({ error: "Could not login" });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out successfully" });
  });
});

app.get("/api/auth/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

/* PRODUCTS */
app.get("/api/products", async (req, res) => {
  try {
    const products = await all("SELECT * FROM products ORDER BY id ASC");
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Could not load products" });
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    const product = await get("SELECT * FROM products WHERE id = ?", [req.params.id]);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: "Could not load product" });
  }
});

/* ADMIN PRODUCTS */
app.post("/api/admin/products", requireAdmin, async (req, res) => {
  try {
    const { slug, brand, name, color, price, image, description, category, stock } = req.body;
    if (!slug || !brand || !name || !price || !image) {
      return res.status(400).json({ error: "Slug, brand, name, price and image are required" });
    }

    const result = await run(
      `INSERT INTO products (slug, brand, name, color, price, image, description, category, stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [slug, brand, name, color || "", Number(price), image, description || "", category || "streetwear", Number(stock || 20)]
    );

    res.json({ message: "Product added", id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: "Could not add product" });
  }
});

app.put("/api/admin/products/:id", requireAdmin, async (req, res) => {
  try {
    const { brand, name, color, price, image, description, category, stock } = req.body;

    await run(
      `UPDATE products
       SET brand = ?, name = ?, color = ?, price = ?, image = ?, description = ?, category = ?, stock = ?
       WHERE id = ?`,
      [brand, name, color || "", Number(price), image, description || "", category || "streetwear", Number(stock || 0), req.params.id]
    );

    res.json({ message: "Product updated" });
  } catch (err) {
    res.status(500).json({ error: "Could not update product" });
  }
});

app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
  try {
    await run("DELETE FROM products WHERE id = ?", [req.params.id]);
    res.json({ message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ error: "Could not delete product" });
  }
});

/* CART */
app.post("/api/cart", async (req, res) => {
  try {
    const sessionId = req.sessionID;
    const userId = req.session.user ? req.session.user.id : null;
    const { productId, size, quantity } = req.body;

    if (!productId) return res.status(400).json({ error: "Product is required" });

    const product = await get("SELECT * FROM products WHERE id = ?", [productId]);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const qty = Math.max(1, Number(quantity || 1));

    const existing = await get(
      "SELECT * FROM cart_items WHERE session_id = ? AND product_id = ? AND IFNULL(size, '') = IFNULL(?, '')",
      [sessionId, productId, size || ""]
    );

    if (existing) {
      await run("UPDATE cart_items SET quantity = quantity + ? WHERE id = ?", [qty, existing.id]);
    } else {
      await run(
        "INSERT INTO cart_items (session_id, user_id, product_id, size, quantity) VALUES (?, ?, ?, ?, ?)",
        [sessionId, userId, productId, size || null, qty]
      );
    }

    res.json({ message: "Added to cart" });
  } catch (err) {
    res.status(500).json({ error: "Could not add item to cart" });
  }
});

app.get("/api/cart", async (req, res) => {
  try {
    const items = await all(
      `SELECT 
        cart_items.id AS cart_item_id,
        cart_items.quantity,
        cart_items.size,
        products.id AS product_id,
        products.name,
        products.brand,
        products.price,
        products.image
       FROM cart_items
       JOIN products ON products.id = cart_items.product_id
       WHERE cart_items.session_id = ?
       ORDER BY cart_items.id DESC`,
      [req.sessionID]
    );

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    res.json({ items, subtotal, shipping: 0, total: subtotal });
  } catch (err) {
    res.status(500).json({ error: "Could not load cart" });
  }
});

app.patch("/api/cart/:cartItemId", async (req, res) => {
  try {
    const qty = Math.max(1, Number(req.body.quantity || 1));
    await run("UPDATE cart_items SET quantity = ? WHERE id = ? AND session_id = ?", [
      qty,
      req.params.cartItemId,
      req.sessionID
    ]);
    res.json({ message: "Cart updated" });
  } catch (err) {
    res.status(500).json({ error: "Could not update cart" });
  }
});

app.delete("/api/cart/:cartItemId", async (req, res) => {
  try {
    await run("DELETE FROM cart_items WHERE id = ? AND session_id = ?", [
      req.params.cartItemId,
      req.sessionID
    ]);
    res.json({ message: "Item removed" });
  } catch (err) {
    res.status(500).json({ error: "Could not remove item" });
  }
});

/* CONTACT + NEWSLETTER */
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: "All fields are required" });
    }

    await run(
      "INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)",
      [name.trim(), cleanEmail(email), subject.trim(), message.trim()]
    );

    res.json({ message: "Message saved successfully" });
  } catch (err) {
    res.status(500).json({ error: "Could not save message" });
  }
});

app.post("/api/newsletter", async (req, res) => {
  try {
    const email = cleanEmail(req.body.email);
    if (!email) return res.status(400).json({ error: "Email is required" });

    await run("INSERT OR IGNORE INTO newsletter_subscribers (email) VALUES (?)", [email]);
    res.json({ message: "Thank you for subscribing" });
  } catch (err) {
    res.status(500).json({ error: "Could not subscribe" });
  }
});

/* CHECKOUT */
app.post("/api/checkout", async (req, res) => {
  try {
    const { name, email, address } = req.body;

    if (!name || !email || !address) {
      return res.status(400).json({ error: "Name, email and address are required" });
    }

    const cart = await all(
      `SELECT 
        cart_items.quantity,
        cart_items.size,
        products.id AS product_id,
        products.name,
        products.price
       FROM cart_items
       JOIN products ON products.id = cart_items.product_id
       WHERE cart_items.session_id = ?`,
      [req.sessionID]
    );

    if (cart.length === 0) return res.status(400).json({ error: "Cart is empty" });

    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const userId = req.session.user ? req.session.user.id : null;

    const order = await run(
      "INSERT INTO orders (user_id, customer_name, customer_email, customer_address, total, payment_status) VALUES (?, ?, ?, ?, ?, ?)",
      [userId, name.trim(), cleanEmail(email), address.trim(), total, "pending"]
    );

    for (const item of cart) {
      await run(
        `INSERT INTO order_items (order_id, product_id, product_name, size, quantity, price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [order.lastID, item.product_id, item.name, item.size, item.quantity, item.price]
      );
    }

    await run("DELETE FROM cart_items WHERE session_id = ?", [req.sessionID]);
    res.json({ message: "Order placed successfully", orderId: order.lastID, total });
  } catch (err) {
    res.status(500).json({ error: "Could not place order" });
  }
});

app.post("/api/create-payment-session", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(400).json({
        error: "Payment system is currently unavailable."
      });
    }

    const cart = await all(
      `SELECT cart_items.quantity, products.name, products.price
       FROM cart_items
       JOIN products ON products.id = cart_items.product_id
       WHERE cart_items.session_id = ?`,
      [req.sessionID]
    );

    if (cart.length === 0) return res.status(400).json({ error: "Cart is empty" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: cart.map((item) => ({
        price_data: {
          currency: "gbp",
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100)
        },
        quantity: item.quantity
      })),
      success_url: `${req.protocol}://${req.get("host")}/success.html`,
      cancel_url: `${req.protocol}://${req.get("host")}/cart.html`
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: "Could not create payment session" });
  }
});

/* CUSTOMER ORDER HISTORY */
app.get("/api/my-orders", requireLogin, async (req, res) => {
  try {
    const orders = await all("SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC", [req.session.user.id]);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "Could not load orders" });
  }
});

/* ADMIN DATA */
app.get("/admin/data", requireAdmin, async (req, res) => {
  try {
    const orders = await all("SELECT * FROM orders ORDER BY id DESC");
    const orderItems = await all("SELECT * FROM order_items ORDER BY id DESC");
    const messages = await all("SELECT * FROM contact_messages ORDER BY id DESC");
    const newsletter = await all("SELECT * FROM newsletter_subscribers ORDER BY id DESC");
    const products = await all("SELECT * FROM products ORDER BY id ASC");
    const users = await all("SELECT id, name, email, role, created_at FROM users ORDER BY id DESC");

    res.json({ orders, orderItems, messages, newsletter, products, users });
  } catch (err) {
    res.status(500).json({ error: "Could not load admin data" });
  }
});

app.listen(PORT, () => {
  console.log(`PAT Store backend running on http://localhost:${PORT}`);
});
