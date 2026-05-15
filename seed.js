const bcrypt = require("bcryptjs");
const db = require("./db");

const products = [
  [
    "stussy-black",
    "Stussy",
    "8 BALL TEE PIGMENT DYED",
    "Black",
    45,
    "img/p1.png",
    "Oversized tee in pigment dyed cotton with screenprinted graphics."
  ],
  [
    "stussy-white",
    "Stussy",
    "8 BALL TEE PIGMENT DYED",
    "White",
    45,
    "img/p2.png",
    "Oversized tee in pigment dyed cotton with screenprinted graphics."
  ],
  [
    "stussy-olive",
    "Stussy",
    "8 BALL TEE PIGMENT DYED",
    "Olive",
    45,
    "img/p3.png",
    "Oversized tee in pigment dyed cotton with screenprinted graphics."
  ],
  [
    "stussy-navy",
    "Stussy",
    "8 BALL TEE PIGMENT DYED",
    "Navy",
    45,
    "img/p4.png",
    "Oversized tee in pigment dyed cotton with screenprinted graphics."
  ],
  [
    "cole-buxton-vintage-black",
    "COLE BUXTON",
    "CB STAR RACING SWEATSHIRT",
    "Vintage Black",
    145,
    "img/p5.png",
    "CB star racing logo printed boldly across the chest and back."
  ],
  [
    "cole-buxton-khaki",
    "COLE BUXTON",
    "CB STAR RACING SWEATSHIRT",
    "Khaki",
    145,
    "img/p6.png",
    "CB star racing logo printed boldly across the chest and back."
  ],
  [
    "acne-faded-black",
    "ACNE STUDIOS",
    "EXFORD 1996 T-SHIRT",
    "Faded Black",
    270,
    "img/p7.png",
    "Relaxed cotton T-shirt with a soft faded look."
  ],
  [
    "acne-dusty-white",
    "ACNE STUDIOS",
    "EXFORD 1996 T-SHIRT",
    "Dusty White",
    270,
    "img/p8.png",
    "Relaxed cotton T-shirt with a clean everyday style."
  ],
  [
    "arcteryx-black",
    "ARC'TERYX",
    "BETA GORE-TEX JACKET",
    "Black",
    349,
    "img/p9.png",
    "Durable Gore-Tex jacket built for outdoor conditions."
  ],
  [
    "arcteryx-spotlight",
    "ARC'TERYX",
    "BETA GORE-TEX JACKET",
    "Spotlight",
    349,
    "img/p10.png",
    "Durable Gore-Tex jacket built for outdoor conditions."
  ],
  [
    "ami-blanc-creme",
    "AMI PARIS",
    "ELASTICATED WAIST SHORTS",
    "Blanc Creme",
    150,
    "img/p11.png",
    "Lightweight shorts with effortless summer style."
  ],
  [
    "ami-noir",
    "AMI PARIS",
    "ELASTICATED WAIST SHORTS",
    "Noir",
    150,
    "img/p12.png",
    "Lightweight shorts with effortless summer style."
  ],
  [
    "adidas-firebird-1",
    "ADIDAS",
    "FIREBIRD TRACK PANT",
    "Black",
    50,
    "img/p13.png",
    "Classic Adidas Firebird track pants with streetwear heritage."
  ],
  [
    "adidas-firebird-2",
    "ADIDAS",
    "FIREBIRD TRACK PANT",
    "Blue",
    50,
    "img/p14.png",
    "Classic Adidas Firebird track pants with streetwear heritage."
  ],
  [
    "carhartt-newel-1",
    "CARHARTT WIP",
    "NEWEL RELAXED TAPERED JEANS",
    "Denim",
    95,
    "img/p15.png",
    "Relaxed tapered jeans with rugged streetwear styling."
  ],
  [
    "carhartt-newel-2",
    "CARHARTT WIP",
    "NEWEL RELAXED TAPERED JEANS",
    "Black",
    95,
    "img/p16.png",
    "Relaxed tapered jeans with rugged streetwear styling."
  ]
];

db.serialize(async () => {
  const adminPassword = await bcrypt.hash("admin123", 10);

  db.run(
    "INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
    ["Admin", "admin@patstore.com", adminPassword, "admin"]
  );

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO products
    (slug, brand, name, color, price, image, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const product of products) {
    stmt.run(product);
  }

  stmt.finalize(() => {
    console.log("Database seeded successfully");
    console.log("Admin login: admin@patstore.com / admin123");
    db.close();
  });
});
