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
  res.send('https://ltp65qvsepbjguhn.public.blob.vercel-storage.com/');
});

// ——— NEWS ———
app.get("/news", (req, res) => {
  connection.query(
    "SELECT id, title, date, description, image FROM news",
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

// ——— CREATE NEWS ———
app.post("/news", (req, res) => {
  const { title, date, description, image } = req.body;
  connection.query(
    "INSERT INTO news (title, date, description, image) VALUES (?, ?, ?, ?)",
    [title, date, description, image],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        id: results.insertId,
        title, date, description, image
      });
    }
  );
});

// ——— UPDATE NEWS ———
app.put("/news/:id", (req, res) => {
  const { id } = req.params;
  const { title, date, description, image } = req.body;
  connection.query(
    "UPDATE news SET title = ?, date = ?, description = ?, image = ? WHERE id = ?",
    [title, date, description, image, id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.affectedRows === 0) {
        return res.status(404).json({ error: "News not found" });
      }
      res.json({ id, title, date, description, image });
    }
  );
});

// ——— DELETE NEWS ———
app.delete("/news/:id", (req, res) => {
  const { id } = req.params;
  connection.query(
    "DELETE FROM news WHERE id = ?",
    [id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.affectedRows === 0) {
        return res.status(404).json({ error: "News not found" });
      }
      res.json({ success: true });
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
app.put("/brands/:id", (req, res) => {
  const { id } = req.params;
  const { name, image } = req.body;
  connection.query(
    "UPDATE brands SET name = ?, image = ? WHERE id = ?",
    [name, image, id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.affectedRows === 0) {
        return res.status(404).json({ error: "Brand not found" });
      }
      res.json({ id, name, image });
    }
  );
});

app.delete("/brands/:id", (req, res) => {
  const { id } = req.params;
  connection.query(
    "DELETE FROM brands WHERE id = ?",
    [id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.affectedRows === 0) {
        return res.status(404).json({ error: "Brand not found" });
      }
      res.json({ success: true });
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
          "SELECT id, model, price, description, car_image FROM car_models WHERE brand_id = ?",
          [brand.id],
          (err2, models) => {
            if (err2) return res.status(500).json({ error: err2.message });

            // แปลง URL ภาพแบรนด์
            const rawBrand = brand.image || "";
            const brandFile = path.basename(rawBrand);
            const brandImg = rawBrand.startsWith("http")
              ? rawBrand
              : `${blobBase}/brands/${brandFile}`;

            // แปลง URL ภาพโมเดล
            const mods = models.map(m => {
              let ci = m.car_image || "";
              if (ci && !ci.startsWith("http")) {
                ci = `${blobBase}/cars/${path.basename(ci)}`;
              }
              return {
                id: m.id,
                model: m.model,
                price: m.price,
                description: m.description,
                car_image: ci
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

// ——— CREATE CAR_MODEL ———
app.post("/cars", (req, res) => {
  const { brand_id, model, price, description, car_image } = req.body;
  connection.query(
    "INSERT INTO car_models (brand_id, model, price, description, car_image) VALUES (?, ?, ?, ?, ?)",
    [brand_id, model, price, description, car_image],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: results.insertId, brand_id, model, price, description, car_image });
    }
  );
});

// ——— UPDATE CAR_MODEL ———
app.put("/cars/:id", (req, res) => {
  const { id } = req.params;
  const { brand_id, model, price, description, car_image } = req.body;
  connection.query(
    "UPDATE car_models SET brand_id=?, model=?, price=?, description=?, car_image=? WHERE id=?",
    [brand_id, model, price, description, car_image, id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.affectedRows === 0) return res.status(404).json({ error: "Not found" });
      res.json({ id, brand_id, model, price, description, car_image });
    }
  );
});

// ——— DELETE CAR_MODEL ———
app.delete("/cars/:id", (req, res) => {
  const { id } = req.params;
  connection.query(
    "DELETE FROM car_models WHERE id = ?",
    [id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.affectedRows === 0) return res.status(404).json({ error: "Not found" });
      res.json({ success: true });
    }
  );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
module.exports = app;
