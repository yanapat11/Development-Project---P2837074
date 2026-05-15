const API = "";

function money(value) {
  return `£${Number(value).toFixed(2)}`;
}

function productIdFromImage(image) {
  const map = {
    "img/p1.png": 1, "img/p2.png": 2, "img/p3.png": 3, "img/p4.png": 4,
    "img/p5.png": 5, "img/p6.png": 6, "img/p7.png": 7, "img/p8.png": 8,
    "img/p9.png": 9, "img/p10.png": 10, "img/p11.png": 11, "img/p12.png": 12,
    "img/p13.png": 13, "img/p14.png": 14, "img/p15.png": 15, "img/p16.png": 16
  };
  return map[image] || null;
}

async function addProductToCart(productId, quantity = 1, size = "") {
  const response = await fetch(`${API}/api/cart`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, quantity, size })
  });

  const data = await response.json();
  alert(data.message || data.error || "Cart updated");
}

function setupProductDetailAddToCart() {
  const productDetails = document.querySelector(".single-pro-deatails");
  if (!productDetails) return;

  const button = productDetails.querySelector("button.normal");
  const quantityInput = productDetails.querySelector("input[type='number']");
  const sizeSelect = productDetails.querySelector("select");
  const mainImg = document.querySelector("#MainImg");

  if (!button || !mainImg) return;

  button.addEventListener("click", async (event) => {
    event.preventDefault();

    const productId = productIdFromImage(mainImg.getAttribute("src"));
    const quantity = quantityInput ? Number(quantityInput.value || 1) : 1;
    const size = sizeSelect ? sizeSelect.value : "";

    if (!productId) return alert("Product could not be found.");

    if (!size || size === "Select Size") {
      return alert("Please select a size.");
    }

    await addProductToCart(productId, quantity, size);
  });
}

function setupShopCartButtons() {
  const products = document.querySelectorAll("#product1 .pro");

  products.forEach((product) => {
    const cartIcon = product.querySelector(".fa-cart-shopping");
    if (!cartIcon) return;

    cartIcon.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const img = product.querySelector("img")?.getAttribute("src");
      const productId = productIdFromImage(img);

      if (productId) await addProductToCart(productId, 1, "");
    });
  });
}

async function loadCartPage() {
  const cartSection = document.querySelector("#cart tbody");
  const subtotalBox = document.querySelector("#Subtotal table");
  const checkoutButton = document.querySelector("#Subtotal button.normal");

  if (!cartSection || !subtotalBox) return;

  const response = await fetch(`${API}/api/cart`);
  const cart = await response.json();

  cartSection.innerHTML = cart.items.map((item) => `
    <tr>
      <td><a href="#" data-remove="${item.cart_item_id}"><i class="fa-solid fa-ban"></i></a></td>
      <td><img src="${item.image}" alt="${item.name}"></td>
      <td>${item.name}${item.size ? ` (${item.size})` : ""}</td>
      <td>${money(item.price)}</td>
      <td><input type="number" min="1" value="${item.quantity}" data-qty="${item.cart_item_id}"></td>
      <td>${money(item.price * item.quantity)}</td>
    </tr>
  `).join("");

  subtotalBox.innerHTML = `
    <tr><td>Cart Subtotal</td><td>${money(cart.subtotal)}</td></tr>
    <tr><td>Shipping</td><td>Free</td></tr>
    <tr><td><strong>Total</strong></td><td><strong>${money(cart.total)}</strong></td></tr>
  `;

  if (checkoutButton) {
    checkoutButton.onclick = () => {
      window.location.href = "checkout.html";
    };
  }

  document.querySelectorAll("[data-remove]").forEach((link) => {
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      await fetch(`${API}/api/cart/${link.getAttribute("data-remove")}`, { method: "DELETE" });
      loadCartPage();
    });
  });

  document.querySelectorAll("[data-qty]").forEach((input) => {
    input.addEventListener("change", async () => {
      await fetch(`${API}/api/cart/${input.getAttribute("data-qty")}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: input.value })
      });
      loadCartPage();
    });
  });
}

function setupContactForm() {
  const form = document.querySelector("#contact-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const inputs = form.querySelectorAll("input");
    const textarea = form.querySelector("textarea");

    const data = {
      name: inputs[0].value.trim(),
      email: inputs[1].value.trim(),
      subject: inputs[2].value.trim(),
      message: textarea.value.trim()
    };

    const response = await fetch("/api/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    alert(result.message || result.error);

    if (response.ok) {
      form.reset();
    }
  });
}

function setupNewsletterForms() {
  document.querySelectorAll("#newsletter-form").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);

      const response = await fetch(`${API}/api/newsletter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData.entries()))
      });

      const data = await response.json();
      alert(data.message || data.error);
      if (response.ok) form.reset();
    });
  });
}

async function updateAuthArea() {
  const authArea = document.querySelector("#auth-area");
  if (!authArea) return;

  const response = await fetch("/api/auth/me");
  const data = await response.json();

  if (data.user) {
    authArea.innerHTML = `
      <span>Hi, ${data.user.name}</span>
      <button id="logout-btn">Logout</button>
    `;

    document.querySelector("#logout-btn").addEventListener("click", async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.reload();
    });
  } else {
    authArea.innerHTML = `<a href="login.html">Login</a> | <a href="register.html">Register</a>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setupProductDetailAddToCart();
  setupShopCartButtons();
  loadCartPage();
  setupContactForm();
  setupNewsletterForms();
  updateAuthArea();
});
