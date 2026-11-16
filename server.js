const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { ZipArchive } = require('archiver');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure directories exist
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(UPLOADS_DIR, 'database.json');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
}

// Helpers to read/write DB
function getDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Helper: Format bytes to human readable size
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Multer Storage Configuration (Hỗ trợ file siêu lớn tới 25GB)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 * 1024 } // Hỗ trợ tới 25GB mỗi file (vượt xa 6.6GB)
});

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 1. API: Get list of all uploaded files
app.get('/api/files', (req, res) => {
  const db = getDB();
  res.json(db);
});

// Helper: Chuyển đổi link Google Drive thông thường thành link tải trực tiếp tốc độ cao
function convertDriveUrl(url) {
  if (!url) return { directUrl: '', isDrive: false };
  const match = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/) ||
                url.match(/drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return {
      directUrl: `https://drive.google.com/uc?export=download&id=${match[1]}`,
      driveId: match[1],
      isDrive: true
    };
  }
  return { directUrl: url, isDrive: false };
}

// 2. API: Upload real files hoặc Lưu Link Google Drive
app.post('/api/upload', upload.any(), (req, res) => {
  try {
    const { category, title, description, guide, version, youtubeUrl, directUrl, directSize, directFormat } = req.body;

    const hasDirectUrl = directUrl && directUrl.trim();
    if ((!req.files || req.files.length === 0) && !hasDirectUrl) {
      return res.status(400).json({ error: 'Vui lòng chọn file từ máy hoặc dán link Google Drive!' });
    }

    // Phân loại: file nào là mod, file nào là preview (video/audio/ảnh)
    const modFiles = [];
    let previewData = null;

    if (req.files && req.files.length > 0) {
      req.files.forEach(f => {
        const ext = path.extname(f.originalname).toLowerCase();
        const isVideo = ['.mp4', '.webm', '.mkv', '.mov'].includes(ext);
        const isAudio = ['.mp3', '.wav', '.ogg', '.m4a'].includes(ext);
        const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);

        if (f.fieldname === 'preview' || (isVideo || isAudio || isImage && f.fieldname !== 'files')) {
          previewData = {
            type: isVideo ? 'video' : (isAudio ? 'audio' : 'image'),
            filename: f.filename,
            originalName: f.originalname,
            url: `/api/download-file/${f.filename}/${encodeURIComponent(f.originalname)}`
          };
        } else {
          modFiles.push({
            originalName: f.originalname,
            filename: f.filename,
            size: formatBytes(f.size),
            sizeBytes: f.size,
            format: ext || '.dat'
          });
        }
      });
    }

    // Xử lý link YouTube nếu người dùng dán link thay vì upload video
    if (youtubeUrl && youtubeUrl.trim()) {
      let ytId = '';
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = youtubeUrl.match(regExp);
      if (match && match[2].length === 11) {
        ytId = match[2];
      }
      if (ytId) {
        previewData = {
          type: 'youtube',
          youtubeId: ytId,
          url: `https://www.youtube.com/embed/${ytId}`
        };
      }
    }

    // TRƯỜNG HỢP 1: Dán link Google Drive / Link tải trực tiếp
    if (modFiles.length === 0 && hasDirectUrl) {
      const driveInfo = convertDriveUrl(directUrl.trim());
      const newEntry = {
        id: Date.now().toString(),
        category: category || 'gunsound',
        title: title || 'File Mod GTA 5 (Google Drive)',
        isCloudLink: true,
        directUrl: driveInfo.directUrl,
        rawDriveUrl: directUrl.trim(),
        isDrive: driveInfo.isDrive,
        originalName: title || 'Google Drive File',
        filename: null,
        files: [],
        isMultiFile: false,
        fileCount: 1,
        size: (directSize && directSize.trim()) ? directSize.trim() : '6.6 GB',
        sizeBytes: 0,
        version: version || 'v1.0',
        format: (directFormat && directFormat.trim()) ? directFormat.trim() : '.rar',
        description: description || 'File mod dung lượng lớn lưu trên Google Drive để tải mượt mà 24/7.',
        guide: guide || 'Bấm tải trực tiếp hoặc mở liên kết Google Drive để tải về.',
        preview: previewData,
        downloads: 0,
        createdAt: new Date().toISOString()
      };

      const db = getDB();
      db.unshift(newEntry);
      saveDB(db);

      console.log(`[UPLOAD CLOUD] Đã lưu link Drive: ${newEntry.title} (${newEntry.size})`);
      return res.json({ success: true, item: newEntry });
    }

    // TRƯỜNG HỢP 2: Tải file từ máy tính
    if (modFiles.length === 0 && req.files.length > 0) {
      const f = req.files[0];
      modFiles.push({
        originalName: f.originalname,
        filename: f.filename,
        size: formatBytes(f.size),
        sizeBytes: f.size,
        format: path.extname(f.originalname).toLowerCase() || '.dat'
      });
      if (req.files.length === 1) previewData = null;
    }

    const totalBytes = modFiles.reduce((acc, f) => acc + f.sizeBytes, 0);

    const newEntry = {
      id: Date.now().toString(),
      category: category || 'gunsound',
      title: title || (modFiles.length > 1 ? `${modFiles[0].originalName} + ${modFiles[1].originalName}` : modFiles[0].originalName),
      originalName: modFiles[0].originalName,
      filename: modFiles[0].filename,
      files: modFiles,
      isMultiFile: modFiles.length > 1,
      fileCount: modFiles.length,
      size: formatBytes(totalBytes),
      sizeBytes: totalBytes,
      version: version || 'v1.0',
      format: modFiles.map(f => f.format).join(' / '),
      description: description || 'File tài nguyên tải lên cho GTA 5 / FiveM.',
      guide: guide || 'Giải nén file và copy vào thư mục cài đặt tương ứng.',
      preview: previewData,
      downloads: 0,
      createdAt: new Date().toISOString()
    };

    const db = getDB();
    db.unshift(newEntry);
    saveDB(db);

    console.log(`[UPLOAD] Đã lưu: ${newEntry.title} (${newEntry.size}) - Preview: ${previewData ? previewData.type : 'none'}`);
    res.json({ success: true, item: newEntry });
  } catch (err) {
    console.error('[UPLOAD ERROR]', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi lưu file!' });
  }
});

// 3. API: Download specific file by filename
function handleFileDownload(req, res) {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Không tìm thấy file trên server!');
  }
  const originalName = req.params.originalname || req.params.filename;
  res.download(filePath, originalName);
}

app.get('/api/download-file/:filename', handleFileDownload);
app.get('/api/download-file/:filename/:originalname', handleFileDownload);

// 4. API: Tải trọn gói cả 2 file nén thành 1 file .ZIP duy nhất (Không bao giờ bị trình duyệt chặn)
app.get('/api/download-zip/:id', async (req, res) => {
  try {
    const db = getDB();
    const item = db.find(f => f.id === req.params.id);

    if (!item) {
      return res.status(404).send('Không tìm thấy file trên server!');
    }

    item.downloads = (item.downloads || 0) + 1;
    saveDB(db);

    const safeTitle = (item.title || 'gta5_mod').replace(/[^a-zA-Z0-9_-]/g, '_');
    const zipName = `${safeTitle}_FullPack.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = new ZipArchive({ store: true });
    archive.pipe(res);

    if (item.files && item.files.length > 0) {
      item.files.forEach(f => {
        const filePath = path.join(UPLOADS_DIR, f.filename);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: f.originalName });
        }
      });
    } else if (item.filename) {
      const filePath = path.join(UPLOADS_DIR, item.filename);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: item.originalName });
      }
    }

    await archive.finalize();
  } catch (err) {
    console.error('[ZIP ERROR]', err);
    if (!res.headersSent) {
      res.status(500).send('Lỗi khi nén file zip!');
    }
  }
});

// 5. API: Download entry by ID (nếu có 1 file tải trực tiếp, nếu có 2 file trả về file đầu hoặc chi tiết)
app.get('/api/download/:id', (req, res) => {
  const db = getDB();
  const item = db.find(f => f.id === req.params.id);

  if (!item) {
    return res.status(404).send('Không tìm thấy file trên server!');
  }

  // Increment download count
  item.downloads = (item.downloads || 0) + 1;
  saveDB(db);

  // Nếu là file lưu trên Google Drive / Cloud, chuyển hướng tải ngay lập tức
  if (item.isCloudLink || item.directUrl) {
    return res.redirect(item.directUrl || item.rawDriveUrl);
  }

  // If item has files array, send first file
  const firstFilename = item.files && item.files[0] ? item.files[0].filename : item.filename;
  const firstOriginalName = item.files && item.files[0] ? item.files[0].originalName : item.originalName;

  const filePath = path.join(UPLOADS_DIR, firstFilename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File không còn tồn tại trên server!');
  }

  res.download(filePath, firstOriginalName);
});

// 5. API: Delete file(s)
app.delete('/api/files/:id', (req, res) => {
  const db = getDB();
  const index = db.findIndex(f => f.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'File không tồn tại!' });
  }

  const item = db[index];

  // Delete all physical files
  const filesToDelete = item.files || [{ filename: item.filename }];
  filesToDelete.forEach(f => {
    if (f.filename) {
      const filePath = path.join(UPLOADS_DIR, f.filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
    }
  });

  db.splice(index, 1);
  saveDB(db);

  console.log(`[DELETE] Đã xóa: ${item.title}`);
  res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`  TOÀN BỘ GTA 5 (toanbogta5.click) SERVER ĐANG CHẠY!`);
  console.log(`  Truy cập trên máy nhà: http://localhost:${PORT}`);
  console.log(`====================================================`);
});

module.exports = app;

