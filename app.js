const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const app = express();

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

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

app
  .route("/")
  .get(async (req, res) => {
    try {
      res.status(200).send("Hello from world!");
    } catch (error) {
      res.status(500).send(error.message);
    }
  })
  .post(async (req, res) => {
    try {
      res.status(200).send("Hello from world!");
    } catch (error) {
      res.status(500).send(error.message);
    }
  });

app
  .route("/test-create-post")
  .get(async (req, res) => {
    res.send("Hello test");
  })
  .post(async (req, res) => {
    res.send("Hello test");
  });

app
  .route("/posts")
  .get(async (req, res) => {
    try {
      const posts = await Post.find();
      res.status(200).json(posts);
    } catch (error) {
      res.status(500).send(error.message);
    }
  })
  .post(multiUpload, async (req, res) => {
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

app.route("/post/:id").get(async (req, res) => {
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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
