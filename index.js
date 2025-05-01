const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const connection = mysql.createConnection(process.env.DATABASE_URL);

// ดึงข่าวทั้งหมด
app.get("/news", (req, res) => {
  connection.query(
    "SELECT title, date, description, image FROM news",
    function (err, results, fields) {
      res.send(results);
    }
  );
});

// ดึงรถยนต์ทั้งหมด พร้อมรุ่น (join ผ่าน foreign key brand_id)
app.get("/cars", (req, res) => {
    // 1) ดึง list แบรนด์จากตาราง brands
    connection.query(
      "SELECT id, name, image FROM brands",
      (err, brands) => {
        if (err) {
          console.error("Error fetching brands:", err);
          return res.status(500).json({ error: err.message });
        }
        if (brands.length === 0) {
          return res.json([]);
        }
  
        const result = [];
        let remaining = brands.length;
  
        // 2) สำหรับแต่ละแบรนด์ ดึงรุ่นจากตาราง car_models
        brands.forEach(brand => {
          connection.query(
            `SELECT model, price, description, car_image 
             FROM car_models 
             WHERE brand_id = ?`,
            [brand.id],
            (err2, models) => {
              if (err2) {
                console.error(`Error fetching models for brand ${brand.id}:`, err2);
                return res.status(500).json({ error: err2.message });
              }
  
              result.push({
                id: brand.id,
                name: brand.name,
                image: brand.image,
                models: models.map(m => ({
                  model: m.model,
                  price: m.price,
                  description: m.description,
                  carImage: m.car_image
                }))
              });
  
              remaining -= 1;
              if (remaining === 0) {
                res.json(result);
              }
            }
          );
        });
      }
    );
  });  

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
