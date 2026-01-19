require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const port = process.env.PORT || 5001;

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:3000", //Local
      "https://plantify-client.vercel.app", //Production
    ],
    credentials: true,
  }),
);
app.use(express.json());

// MongoDB URI
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set in .env");
  process.exit(1);
}

// MongoDB Client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Test route
app.get("/", (req, res) => {
  res.send("Plantify API is running!");
});

async function run() {
  try {
    // await client.connect();
    // await client.db("admin").command({ ping: 1 });

    // ==================== Ping MongoDB ==================== //
    console.log("Connected to MongoDB! (Plantify Database)");

    // Collections
    const db = client.db('plantify-db')
    const plantsCollection = db.collection("plants");

    // ==================== Routes ==================== //

    // 1. Seed Plants Data
    app.post("/plants/seed", async (req, res) => {
      try {
        const plantsData = require("./plantsData");
        const result = await plantsCollection.insertMany(plantsData);
        res.status(201).send({
          message: "Plants seeded successfully!",
          count: result.insertedCount,
        });
      } catch (error) {
        console.error("Error seeding plants:", error);
        res.status(500).send({ message: "Failed to seed plants" });
      }
    });

    // 2. Get All Plants
    app.get("/plants", async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        // Filters
        const query = {};
        if (req.query.category) {
          query.category = req.query.category;
        }
        if (req.query.minPrice || req.query.maxPrice) {
          query.price = {};
          if (req.query.minPrice)
            query.price.$gte = parseFloat(req.query.minPrice);
          if (req.query.maxPrice)
            query.price.$lte = parseFloat(req.query.maxPrice);
        }
        if (req.query.rating) {
          query.rating = { $gte: parseFloat(req.query.rating) };
        }
        if (req.query.search) {
          query.name = { $regex: req.query.search, $options: "i" };
        }

        // Sorting
        let sortOptions = {};
        if (req.query.sort) {
          if (req.query.sort === "price-asc") sortOptions.price = 1;
          else if (req.query.sort === "price-desc") sortOptions.price = -1;
          else if (req.query.sort === "rating-desc") sortOptions.rating = -1;
        }

        console.log("Fetching plants with query:", query);

        const total = await plantsCollection.countDocuments(query);
        const plants = await plantsCollection
          .find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .toArray();

        res.send({
          plants,
          total,
          page,
          totalPages: Math.ceil(total / limit),
        });
      } catch (error) {
        console.error("Error fetching plants:", error);
        res.status(500).send({ message: "Failed to fetch plants" });
      }
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
}
run().catch(console.dir);

// Start server
app.listen(port, () => {
  console.log(`Plantify server running on http://localhost:${port}`);
});
