const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const app = express();
app.use(cors());
const PORT = process.env.PORT || 9000;

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

mongoose.connect(process.env.MONGO_URL);
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});

const postSchema = new mongoose.Schema({
  title: String,
  body: String,
  images: [String],
  videos: [String],
  audio: [String],
});

const Post = mongoose.model("Post", postSchema);

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

app.use("/uploads", express.static("uploads"));

const multiUpload = upload.fields([
  { name: "images" },
  { name: "videos" },
  { name: "audio" },
]);

app.post("/create-post", multiUpload, async (req, res) => {
  try {
    const { title, body } = req.body;
    const images = req.files["images"]
      ? req.files["images"].map((file) => file.path)
      : [];
    const videos = req.files["videos"]
      ? req.files["videos"].map((file) => file.path)
      : [];
    const audio = req.files["audio"]
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

app.get("/posts", async (req, res) => {
  try {
    const posts = await Post.find();
    res.status(200).json(posts);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

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

app.get("/", async (req, res) => {
  try {
    res.status(200).send("Hello from world!");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
