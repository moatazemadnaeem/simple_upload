const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || "9000";
const JWT_SECRET = process.env.JWT_SECRET || "secret";

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dlvpxvcor",
  api_key: process.env.CLOUDINARY_API_KEY || "397861572619641",
  api_secret: process.env.CLOUDINARY_API_SECRET || "8qiDf4bOWY88K8pUQLNx",
});

// Cloudinary Storage Configuration
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "uploads",
    allowed_formats: ["jpg", "png", "jpeg"],
    public_id: (req, file) => Date.now() + "-" + file.originalname,
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
});

// MongoDB Connection
mongoose.connect(
  process.env.MONGO_URL ||
    "mongodb+srv://moatazlabs:c6cbTO9nUuRo6zHh@cluster0.k33hd.mongodb.net/"
);

// Schemas
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["normal", "admin"], default: "normal" },
});

const podcastSchema = new mongoose.Schema({
  name: { type: String, required: true },
  content: String,
  image: String,
  questions: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
      question: String,
      answer: String,
    },
  ],
});

const fontSchema = new mongoose.Schema({
  fontColor: String,
  fontSize: Number,
  fontFamily: String,
});

const platformSchema = new mongoose.Schema({
  text: String,
  image: String,
});

const contactSchema = new mongoose.Schema({
  text: String,
});

// Models
const User = mongoose.model("User", userSchema);
const Podcast = mongoose.model("Podcast", podcastSchema);
const Font = mongoose.model("Font", fontSchema);
const Platform = mongoose.model("Platform", platformSchema);
const Contact = mongoose.model("Contact", contactSchema);

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["token"];
  const token = authHeader;

  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// User Routes
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: "User created" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET);
    res.json({ user, token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/get-current-user", authenticateToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  const { password, __v, ...rest } = await User.findById(req.user.id).lean();
  res.json(rest);
});

app.post("/logout", authenticateToken, (req, res) => {
  res.json({ message: "Logout successful", token: null });
});

app.get("/users", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().lean();
    const sanitizedUsers = users.map(({ password, __v, ...rest }) => rest);
    res.json(sanitizedUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete("/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    const { password, __v, ...rest } = user;
    res.json(rest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put(
  "/users/:id/admin",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { role: "admin" },
        { new: true }
      ).lean();
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password, __v, ...rest } = user;
      res.json(rest);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

app.put("/users/:id", authenticateToken, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) updateData.password = await bcrypt.hash(password, 10);

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No fields provided for update" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    ).lean();

    if (!user) return res.status(404).json({ message: "User not found" });
    const { password: _, __v, ...rest } = user;
    res.json(rest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Podcast Routes
app.post(
  "/podcasts",
  authenticateToken,
  requireAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      const { name, content } = req.body;
      const podcast = new Podcast({
        name,
        content,
        image: req.file?.path,
      });
      await podcast.save();
      res.status(201).json(podcast);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

app.get("/podcasts", async (req, res) => {
  try {
    const podcasts = await Podcast.find().sort({ _id: -1 });
    res.json(podcasts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/podcasts/search", async (req, res) => {
  try {
    const { q } = req.query;
    const podcasts = await Podcast.find({
      $or: [{ name: new RegExp(q, "i") }, { content: new RegExp(q, "i") }],
    });
    res.json(podcasts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put(
  "/podcasts/:id",
  authenticateToken,
  requireAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      const updateData = {};
      if (req.body.name) updateData.name = req.body.name;
      if (req.body.content) updateData.content = req.body.content;
      if (req.file) updateData.image = req.file.path;

      const podcast = await Podcast.findByIdAndUpdate(
        req.params.id,
        { $set: updateData },
        { new: true }
      );
      if (!podcast)
        return res.status(404).json({ message: "Podcast not found" });
      res.json(podcast);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

app.delete(
  "/podcasts/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const podcast = await Podcast.findByIdAndDelete(req.params.id);
      if (!podcast)
        return res.status(404).json({ message: "Podcast not found" });
      res.json({ message: "Podcast deleted" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

app.get("/podcasts/:id", async (req, res) => {
  try {
    const podcast = await Podcast.findById(req.params.id);
    if (!podcast) return res.status(404).json({ message: "Podcast not found" });
    res.json(podcast);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Question Routes
app.post(
  "/podcasts/:id/questions",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { question, answer } = req.body;
      const podcast = await Podcast.findById(req.params.id);
      if (!podcast)
        return res.status(404).json({ message: "Podcast not found" });
      podcast.questions.push({ question, answer });
      await podcast.save();
      res.json(podcast);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

app.put(
  "/podcasts/:id/questions/:qId",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const updateData = {};
      if (req.body.question)
        updateData["questions.$.question"] = req.body.question;
      if (req.body.answer) updateData["questions.$.answer"] = req.body.answer;

      const podcast = await Podcast.findOneAndUpdate(
        { _id: req.params.id, "questions._id": req.params.qId },
        { $set: updateData },
        { new: true }
      );
      if (!podcast)
        return res
          .status(404)
          .json({ message: "Podcast or question not found" });
      res.json(podcast);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

app.delete(
  "/podcasts/:id/questions/:qId",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const podcast = await Podcast.findByIdAndUpdate(
        req.params.id,
        { $pull: { questions: { _id: req.params.qId } } },
        { new: true }
      );
      if (!podcast)
        return res
          .status(404)
          .json({ message: "Podcast or question not found" });
      res.json(podcast);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Platform Routes
app.post(
  "/platform",
  authenticateToken,
  requireAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      await Platform.deleteMany({});
      const { text } = req.body;
      const platform = new Platform({
        text,
        image: req.file?.path,
      });
      await platform.save();
      res.status(201).json(platform);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

app.put(
  "/platform/:id",
  authenticateToken,
  requireAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      const updateData = {};
      if (req.body.text) updateData.text = req.body.text;
      if (req.file) updateData.image = req.file.path;

      const platform = await Platform.findByIdAndUpdate(
        req.params.id,
        { $set: updateData },
        { new: true }
      );
      if (!platform)
        return res.status(404).json({ message: "Platform not found" });
      res.json(platform);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

app.delete(
  "/platform/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const platform = await Platform.findByIdAndDelete(req.params.id);
      if (!platform)
        return res.status(404).json({ message: "Platform not found" });
      res.json({ message: "Platform deleted" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

app.get("/platform", async (req, res) => {
  try {
    const platform = await Platform.findOne();
    res.json(platform);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Contact Routes
app.post("/contact", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await Contact.deleteMany({});
    const { text } = req.body;
    const contact = new Contact({ text });
    await contact.save();
    res.status(201).json(contact);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/contact", async (req, res) => {
  try {
    const contact = await Contact.findOne();
    res.json(contact);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/contact/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const updateData = {};
    if (req.body.text) updateData.text = req.body.text;

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    res.json(contact);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete(
  "/contact/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const contact = await Contact.findByIdAndDelete(req.params.id);
      if (!contact)
        return res.status(404).json({ message: "Contact not found" });
      res.json({ message: "Contact deleted" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Font Routes
app.post("/fonts", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await Font.deleteMany({});
    const { fontColor, fontSize, fontFamily } = req.body;
    const font = new Font({ fontColor, fontSize, fontFamily });
    await font.save();
    res.status(201).json(font);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/fonts", async (req, res) => {
  try {
    const font = await Font.findOne();
    res.json(font);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/fonts/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const updateData = {};
    if (req.body.fontColor) updateData.fontColor = req.body.fontColor;
    if (req.body.fontSize) updateData.fontSize = req.body.fontSize;
    if (req.body.fontFamily) updateData.fontFamily = req.body.fontFamily;

    const font = await Font.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );
    if (!font) return res.status(404).json({ message: "Font not found" });
    res.json(font);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete("/fonts/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const font = await Font.findByIdAndDelete(req.params.id);
    if (!font) return res.status(404).json({ message: "Font not found" });
    res.json({ message: "Font deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Server Start
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
