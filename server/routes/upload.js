import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { nanoid } from "nanoid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    cb(null, `${nanoid(12)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit for high res / longer videos
  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg|bmp|ico|tiff?)$/i.test(file.originalname);
    const isVideo = file.mimetype.startsWith("video/") || /\.(mp4|webm|mkv|mov|avi|flv|wmv|m4v|3gp|ogv)$/i.test(file.originalname);
    if (!isImage && !isVideo) {
      return cb(new Error("File không đúng định dạng hình ảnh hoặc video được hỗ trợ."));
    }
    cb(null, true);
  },
});

const router = Router();

router.post("/", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const isVideo = req.file.mimetype.startsWith("video/") || /\.(mp4|webm|mkv|mov|avi|flv|wmv|m4v|3gp|ogv)$/i.test(req.file.originalname);
  const kind = isVideo ? "video" : "image";
  res.status(201).json({
    url: `/uploads/${req.file.filename}`,
    filename: req.file.originalname,
    kind,
    size: req.file.size,
  });
});

// Multer errors (wrong type, too large) land here instead of the default HTML error page.
router.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.message });
  next();
});

export default router;
