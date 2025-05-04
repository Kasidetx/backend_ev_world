const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static images (including nested folders) under /images/*
const blobBase = process.env.BLOB_URL;

const connection = mysql.createConnection(process.env.DATABASE_URL);

app.get('/', (req, res) => {
  res.send('/news, /cars, or /brands');
});

// ——— NEWS ———
app.get("/news", (req, res) => {
  connection.query(
    "SELECT title, date, description, image FROM news",
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });

      const months = [
        "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
        "พฤษภาคม", "มิถุนายน", "กรกฎาคม",
        "สิงหาคม", "กันยายน", "ตุลาคม",
        "พฤศจิกายน", "ธันวาคม"
      ];

      const formatted = results.map(item => {
        const d = new Date(item.date);
        const day = d.getDate();
        const month = months[d.getMonth()];
        const year = d.getFullYear();

        // prefix sub-folder news
        let img = item.image || "";
        if (img && !img.startsWith("http")) {
          img = `${blobBase}/news/${img}`;
        }

        return {
          title: item.title,
          date: `${day} ${month} ${year}`,
          description: item.description,
          image: img
        };
      });

      res.json(formatted);
    }
  );
});

// ——— BRANDS ———
app.get("/brands", (req, res) => {
  connection.query(
    "SELECT id, name, image FROM brands",
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });

      const formatted = results.map(b => {
        const raw = b.image || "";
        const fileName = path.basename(raw); // เช่น "byd_logo.png"
        const img = raw.startsWith("http")
          ? raw
          : `${blobBase}/brands/${fileName}`; // ใช้ blob storage แทน /images

        return {
          id: b.id,
          name: b.name,
          image: img
        };
      });

      res.json(formatted);
    }
  );
});

// ——— ADD / UPDATE / DELETE BRANDS ———
// ถ้าต้องการให้ POST/PUT เก็บแค่ชื่อไฟล์แล้วให้เรา prefix ใน response ก็ทำเหมือน GET ได้เลย
app.post("/brands", (req, res) => {
  const { name, image } = req.body;
  connection.query(
    "INSERT INTO brands (name, image) VALUES (?, ?)",
    [name, image],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: results.insertId, name, image });
    }
  );
});

// ——— CARS & MODELS ———
app.get("/cars", (req, res) => {
  connection.query(
    "SELECT id, name, image FROM brands",
    (err, brands) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!brands.length) return res.json([]);

      const output = [];
      let remaining = brands.length;

      brands.forEach(brand => {
        connection.query(
          "SELECT model, price, description, car_image FROM car_models WHERE brand_id = ?",
          [brand.id],
          (err2, models) => {
            if (err2) return res.status(500).json({ error: err2.message });

            // brand image
            const rawBrand = brand.image || "";
            const brandFile = path.basename(rawBrand);
            const brandImg = rawBrand.startsWith("http")
              ? rawBrand
              : `${blobBase}/brands/${brandFile}`; // ถ้าต้องการดึงจาก blob ด้วยก็ปรับตรงนี้ด้วย

            // models images
            const mods = models.map(m => {
              let ci = m.car_image || "";
              if (ci && !ci.startsWith("/images/") && !ci.startsWith("http")) {
                ci = `${blobBase}/images/cars/${ci}`;
              }
              return {
                model: m.model,
                price: m.price,
                description: m.description,
                carImage: ci
              };
            });

            output.push({
              id: brand.id,
              name: brand.name,
              image: brandImg,
              models: mods
            });

            if (--remaining === 0) {
              res.json(output);
            }
          }
        );
      });
    }
  );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
module.exports = app;
