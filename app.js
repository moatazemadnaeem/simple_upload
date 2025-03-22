const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const app = express();

// Middleware setup - ensure these come before route definitions
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 9000;

// Create uploads directory if it doesn't exist
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// MongoDB connection
mongoose.connect(process.env.MONGO_URL);
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});

// Define schema
const postSchema = new mongoose.Schema({
  title: String,
  body: String,
  images: [String],
  videos: [String],
  audio: [String],
});

const Post = mongoose.model("Post", postSchema);

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5000 * 1024 * 1024 }, // 5000MB in bytes
});

const multiUpload = upload.fields([
  { name: "images" },
  { name: "videos" },
  { name: "audio" },
]);

// Serve static files - ensure this comes before route definitions
app.use("/uploads", express.static("uploads"));

// Root route - defined independently for GET and POST
app.get("/", (req, res) => {
  try {
    res.status(200).send("Hello from world! (GET)");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/", (req, res) => {
  try {
    res.status(200).send("Hello from world! (POST)");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Test route - defined independently for GET and POST
app.get("/test-create-post", (req, res) => {
  res.send("Hello test (GET)");
});

app.post("/test-create-post", (req, res) => {
  res.send("Hello test (POST)");
});

// Posts routes
app.get("/posts", async (req, res) => {
  try {
    const posts = await Post.find();
    res.status(200).json(posts);
  } catch (error) {
    res.status(500).send(error.message);
  }
});
app.get("/posts/search", async (req, res) => {
  try {
    const searchQuery = req.query.search;

    if (!searchQuery) {
      return res.status(400).send("Search query is required");
    }

    const searchRegex = new RegExp(searchQuery, "i");

    const posts = await Post.find({
      $or: [{ title: searchRegex }, { body: searchRegex }],
    });

    res.status(200).json(posts);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).send(error.message);
  }
});
app.post("/posts", multiUpload, async (req, res) => {
  try {
    const { title, body } = req.body;
    const images =
      req.files && req.files["images"]
        ? req.files["images"].map((file) => file.path)
        : [];
    const videos =
      req.files && req.files["videos"]
        ? req.files["videos"].map((file) => file.path)
        : [];
    const audio =
      req.files && req.files["audio"]
        ? req.files["audio"].map((file) => file.path)
        : [];

    const newPost = new Post({
      title,
      body,
      images,
      videos,
      audio,
    });

    await newPost.save();
    res.status(201).send("Post created successfully");
  } catch (error) {
    console.error("Post creation error:", error);
    res.status(500).send(error.message);
  }
});

// Single post routes
app.get("/post/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).send("Post not found");
    }
    res.status(200).json(post);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/post/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).send("Post not found");
    }
    res.status(200).json(post);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Starting the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
