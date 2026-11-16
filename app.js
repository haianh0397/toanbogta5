// GTA V Resource Hub - Application Logic & Backend Integration

// Tự động nhận diện nếu mở trực tiếp bằng file:/// thì trỏ về http://localhost:3000
const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

// Supabase Cloud Database Config (Toàn cầu, online 24/7)
const SUPABASE_URL = "https://xsjrdsiiokptahuzcwgl.supabase.co";
const SUPABASE_KEY = "sb_publishable_GEgx9R3u38FSvqK1Y5Gu3w_23b2ynuv";

// Khởi tạo Supabase Client toàn cục cho Realtime & Xác thực OAuth (Google / Discord)
const supabaseClient = (window.supabase && typeof window.supabase.createClient === 'function')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// Biến lưu thông tin người dùng đang đăng nhập
let currentUser = null;
try {
  const cachedUser = localStorage.getItem('gta_cached_user');
  if (cachedUser) currentUser = JSON.parse(cachedUser);
} catch (e) {}

function getMediaUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE}${url}`;
}

// Chuẩn hóa dữ liệu trả về từ Supabase (snake_case) và Local JSON (camelCase)
function normalizeResource(r) {
  if (!r) return null;
  const directUrl = r.direct_url || r.directUrl || "";
  const isCloud = r.is_cloud_link !== undefined ? r.is_cloud_link : (r.isCloudLink !== undefined ? r.isCloudLink : Boolean(directUrl));
  const isDrive = Boolean(directUrl.includes("drive.google.com") || isCloud);
  let authorName = r.author;
  if (!authorName && r.preview && r.preview.author) {
    authorName = r.preview.author;
  }
  if (!authorName) {
    authorName = "Hải Anh";
  }
  const authorAvatar = r.author_avatar || (r.preview && r.preview.author_avatar) || "";
  const uploaderEmail = r.uploader_email || (r.preview && r.preview.uploader_email) || "";

  // Trích xuất banner / ảnh minh họa chính (ưu tiên ảnh đã tải lên)
  let bannerImg = r.banner || "";
  if (!bannerImg && r.preview) {
    if (r.preview.banner) bannerImg = r.preview.banner;
    else if (r.preview.type === 'image' && r.preview.url) bannerImg = r.preview.url;
  }

  return {
    ...r,
    id: String(r.id),
    title: r.title || "Tài nguyên GTA 5",
    author: authorName,
    authorAvatar: authorAvatar,
    uploaderEmail: uploaderEmail,
    category: r.category || "gunsound",
    banner: bannerImg,
    originalName: r.original_name || r.originalName || r.title,
    filename: r.filename || null,
    files: Array.isArray(r.files) ? r.files : [],
    isMultiFile: r.is_multi_file !== undefined ? r.is_multi_file : (r.isMultiFile || false),
    fileCount: r.file_count || r.fileCount || (r.files ? r.files.length : 1),
    size: r.size || "--",
    version: r.version || "v1.0",
    format: r.format || ".rar",
    description: r.description || r.desc || "",
    desc: r.description || r.desc || "",
    guide: r.guide || "Giải nén file và copy vào thư mục GTA 5 hoặc FiveM.",
    preview: r.preview || null,
    downloads: r.downloads || 0,
    isCloudLink: isCloud,
    directUrl: directUrl,
    isDrive: isDrive,
    createdAt: r.created_at || r.createdAt || new Date().toISOString()
  };
}

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function uploadFileToSupabase(file, onProgress) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("Không tìm thấy file để tải lên!"));

    // Giới hạn 50MB của Supabase Storage
    if (file.size > 50 * 1024 * 1024) {
      return reject(new Error(`File "${file.name}" (${formatBytes(file.size)}) vượt quá giới hạn 50 MB của Cloud lưu trữ trực tiếp! Hãy dùng tab "Dán Link Google Drive" để đăng tải file lớn không giới hạn.`));
    }

    const fileExt = file.name.split('.').pop();
    const safeName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/mods/${safeName}`;

    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);
    xhr.setRequestHeader('apikey', SUPABASE_KEY);
    xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_KEY}`);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    if (xhr.upload && typeof onProgress === 'function') {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent, event.loaded, event.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          filename: safeName,
          originalName: file.name,
          size: formatBytes(file.size),
          sizeBytes: file.size,
          format: '.' + fileExt,
          url: `${SUPABASE_URL}/storage/v1/object/public/mods/${safeName}`
        });
      } else if (xhr.status === 413 || (xhr.responseText && xhr.responseText.includes('EntityTooLarge'))) {
        reject(new Error(`File "${file.name}" quá lớn (${formatBytes(file.size)})! Giới hạn lưu trữ trực tiếp là 50MB. Vui lòng chuyển sang tab "Dán Link Google Drive" để tải lên file này.`));
      } else {
        reject(new Error(`Lỗi tải lên Cloud (${xhr.status}): ${xhr.responseText || xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error("Lỗi kết nối mạng khi tải file lên Cloud!"));
    xhr.send(file);
  });
}

function updateDownloadCount(id, count) {
  try {
    fetch(`${SUPABASE_URL}/rest/v1/resources?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ downloads: count })
    }).catch(() => {});
  } catch (e) {}
}

// No sample files: The hub starts 100% clean so user uploads their own files
const SAMPLE_TEMPLATES = [];

// State
let state = {
  resources: [],
  activeCategory: "all",
  searchQuery: "",
  sortBy: "newest",
  favorites: JSON.parse(localStorage.getItem("gta_favorites") || "[]"),
  activeItem: null,
  isBackendConnected: false
};

// DOM References
const fileGrid = document.getElementById("fileGrid");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const sortSelect = document.getElementById("sortSelect");
const categoryNav = document.getElementById("categoryNav");
const currentCategoryTitle = document.getElementById("currentCategoryTitle");
const filteredCountBadge = document.getElementById("filteredCountBadge");
const favBadge = document.getElementById("favBadge");

// Counters
const countAll = document.getElementById("countAll");
const countGun = document.getElementById("countGun");
const countReshade = document.getElementById("countReshade");
const countDump = document.getElementById("countDump");
const countSource = document.getElementById("countSource");
const countSoftware = document.getElementById("countSoftware");

// Detail Modal
const detailModal = document.getElementById("detailModal");
const closeDetailModal = document.getElementById("closeDetailModal");
const modalIconBox = document.getElementById("modalIconBox");
const modalCategoryBadge = document.getElementById("modalCategoryBadge");
const modalVersion = document.getElementById("modalVersion");
const modalTitle = document.getElementById("modalTitle");
const modalBannerImg = document.getElementById("modalBannerImg");
const modalSize = document.getElementById("modalSize");
const modalDownloads = document.getElementById("modalDownloads");
const modalFormat = document.getElementById("modalFormat");
const modalAuthor = document.getElementById("modalAuthor");
const modalDesc = document.getElementById("modalDesc");
const modalInstallGuide = document.getElementById("modalInstallGuide");
const modalFavBtn = document.getElementById("modalFavBtn");
const modalDownloadBtn = document.getElementById("modalDownloadBtn");
const modalMediaContainer = document.getElementById("modalMediaContainer");

// Media Preview Modal
const mediaModal = document.getElementById("mediaModal");
const closeMediaModal = document.getElementById("closeMediaModal");
const mediaModalTitle = document.getElementById("mediaModalTitle");
const mediaModalBody = document.getElementById("mediaModalBody");

// Upload Modal
const uploadModal = document.getElementById("uploadModal");
const openUploadBtn = document.getElementById("openUploadBtn");
const closeUploadModal = document.getElementById("closeUploadModal");
const cancelUploadBtn = document.getElementById("cancelUploadBtn");
const uploadForm = document.getElementById("uploadForm");
const upFile = document.getElementById("upFile");
const upFile2 = document.getElementById("upFile2");
const selectedFileName = document.getElementById("selectedFileName");
const selectedFileName2 = document.getElementById("selectedFileName2");
const file2Container = document.getElementById("file2Container");
const upPreviewFile = document.getElementById("upPreviewFile");
const selectedPreviewFileName = document.getElementById("selectedPreviewFileName");
const upYoutubeUrl = document.getElementById("upYoutubeUrl");
const upDirectUrl = document.getElementById("upDirectUrl");
const upDirectSize = document.getElementById("upDirectSize");
const upDirectFormat = document.getElementById("upDirectFormat");
const upCategory = document.getElementById("upCategory");
const upTitle = document.getElementById("upTitle");
const upVersion = document.getElementById("upVersion");
const upNote = document.getElementById("upNote");
const upGuide = document.getElementById("upGuide");
const uploadProgressContainer = document.getElementById("uploadProgressContainer");
const uploadProgressBar = document.getElementById("uploadProgressBar");
const uploadPercent = document.getElementById("uploadPercent");
const submitUploadBtn = document.getElementById("submitUploadBtn");

const openFavoritesBtn = document.getElementById("openFavoritesBtn");
const categoryNoticeBadge = document.getElementById("categoryNoticeBadge");
const categoryUploadBtn = document.getElementById("categoryUploadBtn");
const categoryUploadBtnText = document.getElementById("categoryUploadBtnText");
const emptyStateUploadBtnText = document.getElementById("emptyStateUploadBtnText");

const CATEGORY_MAP = {
  gunsound: {
    name: "Tiếng Súng GTA 5",
    icon: "fa-solid fa-volume-high",
    color: "amber",
    badgeClass: "bg-amber-950/60 text-amber-400 border-amber-600/40",
    banner: "https://images.unsplash.com/photo-1595590424283-b8f17842773f?auto=format&fit=crop&w=800&q=80"
  },
  reshade: {
    name: "ReShade Đồ Họa",
    icon: "fa-solid fa-wand-magic-sparkles",
    color: "cyan",
    badgeClass: "bg-cyan-950/60 text-cyan-400 border-cyan-600/40",
    banner: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80"
  },
  dump: {
    name: "File Dump & Crash",
    icon: "fa-solid fa-file-code",
    color: "rose",
    badgeClass: "bg-rose-950/60 text-rose-400 border-rose-600/40",
    banner: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80"
  },
  source: {
    name: "Source GTA 5",
    icon: "fa-solid fa-code",
    color: "purple",
    badgeClass: "bg-purple-950/60 text-purple-400 border-purple-600/40",
    banner: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80"
  },
  software: {
    name: "Phần Mềm Hỗ Trợ",
    icon: "fa-solid fa-screwdriver-wrench",
    color: "blue",
    badgeClass: "bg-blue-950/60 text-blue-400 border-blue-600/40",
    banner: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80"
  }
};

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  const toastMsg = document.getElementById("toastMsg");
  const toastIcon = document.getElementById("toastIcon");

  toastMsg.textContent = message;
  if (type === "success") {
    toastIcon.className = "fa-solid fa-circle-check text-emerald-400";
  } else if (type === "info") {
    toastIcon.className = "fa-solid fa-circle-info text-cyan-400";
  } else {
    toastIcon.className = "fa-solid fa-triangle-exclamation text-amber-400";
  }

  toast.classList.remove("translate-y-20", "opacity-0");
  toast.classList.add("translate-y-0", "opacity-100");

  setTimeout(() => {
    toast.classList.remove("translate-y-0", "opacity-100");
    toast.classList.add("translate-y-20", "opacity-0");
  }, 3000);
}

// GTA V Style Success HUD Notification
window.showSuccessHUD = function(title, desc) {
  const hud = document.getElementById("successHUD");
  const hudTitle = document.getElementById("hudTitle");
  const hudDesc = document.getElementById("hudDesc");

  if (!hud) {
    showToast(`${title}: ${desc}`);
    return;
  }

  hudTitle.textContent = title || "TẢI LÊN THÀNH CÔNG!";
  hudDesc.textContent = desc || "File đã xuất hiện trên thư viện web.";

  hud.classList.remove("hidden");
  void hud.offsetWidth; // Force reflow for animation

  hud.classList.remove("-translate-y-10", "opacity-0");
  hud.classList.add("translate-y-0", "opacity-100");

  setTimeout(() => {
    hud.classList.remove("translate-y-0", "opacity-100");
    hud.classList.add("-translate-y-10", "opacity-0");
    setTimeout(() => {
      hud.classList.add("hidden");
    }, 500);
  }, 4000);
};

// Fetch resources from Supabase Cloud Database, Server API or static database
async function loadResources() {
  let loadedItems = [];

  // Ưu tiên 1: Tải trực tiếp từ Supabase Cloud Database (Online 24/7, cập nhật tức thì toàn cầu)
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/resources?select=*&order=created_at.desc`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        loadedItems = data.map(normalizeResource);
        state.isBackendConnected = true;
      }
    }
  } catch (supabaseErr) {
    console.warn("Supabase load error, switching to fallback:", supabaseErr);
  }

  // Ưu tiên 2: Backend local API (nếu có Node server.js chạy)
  if (loadedItems.length === 0) {
    try {
      const res = await fetch(API_BASE ? (API_BASE + "/api/files") : "/api/files");
      if (res.ok) {
        const serverFiles = await res.json();
        if (Array.isArray(serverFiles) && serverFiles.length > 0) {
          loadedItems = serverFiles.map(normalizeResource);
          state.isBackendConnected = true;
        }
      }
    } catch (apiErr) {}
  }

  // Ưu tiên 3: Nếu trên Vercel không có backend server, đọc file uploads/database.json tĩnh
  if (loadedItems.length === 0) {
    try {
      const staticRes = await fetch("uploads/database.json");
      if (staticRes.ok) {
        const staticFiles = await staticRes.json();
        if (Array.isArray(staticFiles) && staticFiles.length > 0) {
          loadedItems = staticFiles.map(normalizeResource);
        }
      }
    } catch (stErr) {}
  }

  const localData = localStorage.getItem("toanbo_gta5_uploads");
  const localList = localData ? JSON.parse(localData).map(normalizeResource) : [];

  const combined = [...loadedItems, ...localList, ...SAMPLE_TEMPLATES];

  // Lọc trùng theo id
  const seen = new Set();
  state.resources = combined.filter(item => {
    if (!item || !item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  updateCounters();
  renderGrid();
}

function updateCounters() {
  countAll.textContent = state.resources.length;
  countGun.textContent = state.resources.filter(r => r.category === "gunsound").length;
  countReshade.textContent = state.resources.filter(r => r.category === "reshade").length;
  countDump.textContent = state.resources.filter(r => r.category === "dump").length;
  countSource.textContent = state.resources.filter(r => r.category === "source").length;
  if (countSoftware) countSoftware.textContent = state.resources.filter(r => r.category === "software").length;
  favBadge.textContent = state.favorites.length;
}

function getFilteredResources() {
  let list = [...state.resources];

  if (state.activeCategory === "favorites") {
    list = list.filter(r => state.favorites.includes(r.id));
  } else if (state.activeCategory !== "all") {
    list = list.filter(r => r.category === state.activeCategory);
  }

  if (state.searchQuery.trim() !== "") {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(r => 
      (r.title && r.title.toLowerCase().includes(q)) ||
      (r.desc && r.desc.toLowerCase().includes(q)) ||
      (r.originalName && r.originalName.toLowerCase().includes(q))
    );
  }

  if (state.sortBy === "downloads") {
    list.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
  } else if (state.sortBy === "newest") {
    // Newest first
  } else if (state.sortBy === "name") {
    list.sort((a, b) => a.title.localeCompare(b.title));
  }

  return list;
}

function renderGrid() {
  const items = getFilteredResources();
  filteredCountBadge.textContent = `${items.length} files`;

  if (state.activeCategory === "favorites") {
    currentCategoryTitle.innerHTML = `<i class="fa-solid fa-heart text-pink-400"></i> <span>Tài Nguyên Đã Lưu Yêu Thích</span>`;
  } else if (state.activeCategory === "all") {
    currentCategoryTitle.innerHTML = `<i class="fa-solid fa-layer-group text-emerald-400"></i> <span>Tất Cả File Đã Đăng Tải</span>`;
  } else {
    const catMeta = CATEGORY_MAP[state.activeCategory] || { name: "Chuyên mục", icon: "fa-solid fa-folder", color: "emerald" };
    currentCategoryTitle.innerHTML = `<i class="${catMeta.icon} text-${catMeta.color}-400"></i> <span>Chuyên Mục: ${catMeta.name}</span>`;
  }

  // Cập nhật nhãn nút đăng tải nhanh theo chuyên mục đang xem
  if (categoryUploadBtnText) {
    if (state.activeCategory === "all" || state.activeCategory === "favorites") {
      categoryUploadBtnText.textContent = "Đăng Tải File Mới";
    } else {
      const catMeta = CATEGORY_MAP[state.activeCategory] || { name: "Mục Này" };
      categoryUploadBtnText.textContent = `+ Đăng Tải ${catMeta.name}`;
    }
  }

  if (emptyStateUploadBtnText) {
    if (state.activeCategory === "all" || state.activeCategory === "favorites") {
      emptyStateUploadBtnText.textContent = "ĐĂNG TẢI FILE ĐẦU TIÊN CỦA BẠN";
    } else {
      const catMeta = CATEGORY_MAP[state.activeCategory] || { name: "MỤC NÀY" };
      emptyStateUploadBtnText.textContent = `+ ĐĂNG TẢI FILE ${catMeta.name.toUpperCase()} ĐẦU TIÊN`;
    }
  }

  fileGrid.innerHTML = "";

  if (items.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  items.forEach(item => {
    const cat = CATEGORY_MAP[item.category] || { name: "Tài nguyên", icon: "fa-solid fa-file", color: "gray", badgeClass: "bg-gray-800 text-gray-300", banner: "" };
    const isFav = state.favorites.includes(item.id);
    const bannerUrl = item.banner || (item.preview && item.preview.type === 'image' ? item.preview.url : null) || (item.preview && item.preview.banner ? item.preview.banner : null) || cat.banner || "https://images.unsplash.com/photo-1595590424283-b8f17842773f?auto=format&fit=crop&w=800&q=80";

    const hasTwoFiles = (item.files && item.files.length > 1) || item.isMultiFile;
    const hasPlayableMedia = item.preview && (item.preview.type === 'video' || item.preview.type === 'youtube' || item.preview.type === 'audio');

    const card = document.createElement("div");
    card.className = "bg-[#121522] border border-gray-800/90 hover:border-gray-700 rounded-2xl overflow-hidden shadow-xl card-hover flex flex-col justify-between group";

    card.innerHTML = `
      <div>
        <div class="h-44 w-full relative overflow-hidden bg-black/60">
          <img src="${bannerUrl}" alt="${item.title}" class="w-full h-full object-cover group-hover:scale-105 transition-all duration-500">
          <div class="absolute inset-0 bg-gradient-to-t from-[#121522] via-[#121522]/40 to-transparent"></div>
          
          <div class="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
            <span class="text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg border backdrop-blur-md ${cat.badgeClass}">
              <i class="${cat.icon} mr-1"></i> ${cat.name}
            </span>
            ${hasTwoFiles ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-400 text-black shadow"><i class="fa-solid fa-layer-group mr-1"></i> BỘ 2 FILE</span>' : ''}
            ${item.isCloudLink || item.isDrive ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-500 text-black shadow flex items-center gap-1"><i class="fa-brands fa-google-drive"></i>GOOGLE DRIVE</span>' : (!item.isSample ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500 text-black shadow">FILE CỦA BẠN</span>' : '')}
          </div>

          <button onclick="toggleFavorite(event, '${item.id}')" class="absolute top-3 right-3 w-8 h-8 rounded-lg bg-black/60 backdrop-blur hover:bg-black/80 flex items-center justify-center transition-all ${isFav ? 'text-pink-500' : 'text-gray-400 hover:text-white'}">
            <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart text-xs"></i>
          </button>

          ${hasPlayableMedia ? `
            <div class="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <button onclick="openMediaModal(event, '${item.id}')" class="pointer-events-auto px-3.5 py-1.5 rounded-full bg-black/80 hover:bg-emerald-500 hover:text-black border border-emerald-500/50 text-emerald-300 text-xs font-bold transition-all flex items-center gap-2 shadow-2xl backdrop-blur-md group/btn">
                <i class="fa-solid ${item.preview.type === 'audio' ? 'fa-volume-high text-amber-400' : 'fa-play text-emerald-400'} group-hover/btn:text-black text-xs"></i>
                <span>${item.preview.type === 'audio' ? 'Nghe Thử Âm Thanh' : 'Xem Video Test'}</span>
              </button>
            </div>
          ` : ''}
          
          <div class="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] text-gray-300">
            <span class="font-semibold bg-black/70 px-2 py-0.5 rounded-md"><i class="fa-regular fa-hard-drive mr-1 text-cyan-400"></i>${item.size || '--'}</span>
            <span class="font-semibold bg-black/70 px-2 py-0.5 rounded-md text-emerald-400"><i class="fa-solid fa-download mr-1"></i>${(item.downloads || 0).toLocaleString()} lượt</span>
          </div>
        </div>

        <div class="p-5 space-y-2">
          <div class="flex items-center justify-between text-[11px] text-gray-400">
            <span class="truncate max-w-[170px]">File: <strong class="text-gray-200">${item.originalName || item.title}</strong></span>
            <span class="text-cyan-400 font-mono font-bold">${hasTwoFiles ? '2 Files' : (item.format || '.zip')}</span>
          </div>

          <h3 class="font-heading font-bold text-base text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
            ${item.title}
          </h3>

          <div class="flex items-center gap-1.5 text-[11px] text-gray-400">
            ${item.authorAvatar ? `
              <img src="${item.authorAvatar}" class="w-5 h-5 rounded-full object-cover border border-emerald-400/60 shrink-0" alt="${item.author}">
            ` : `
              <span class="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-[10px] shrink-0">
                <i class="fa-solid fa-user-pen"></i>
              </span>
            `}
            <span class="truncate flex items-center gap-1">
              <span>Đăng bởi:</span>
              <strong class="text-emerald-400 font-semibold truncate">${item.author || 'Hải Anh'}</strong>
              ${item.authorAvatar ? `<i class="fa-solid fa-circle-check text-emerald-400 text-[10px]" title="Tài khoản đã xác thực"></i>` : ''}
            </span>
          </div>

          <p class="text-xs text-gray-400 line-clamp-2 leading-relaxed">
            ${item.desc || item.description || "Nhấp vào để xem chi tiết hướng dẫn và tải về."}
          </p>

          ${hasTwoFiles && item.files ? `
            <div class="pt-1.5 space-y-1">
              <span class="text-[10px] font-semibold text-gray-400 block">Danh sách file đi kèm:</span>
              <div class="flex flex-col gap-1 text-[11px] bg-black/40 p-2 rounded-lg border border-gray-800">
                <span class="truncate text-emerald-400 font-mono">1. ${item.files[0].originalName} (${item.files[0].size})</span>
                <span class="truncate text-cyan-400 font-mono">2. ${item.files[1].originalName} (${item.files[1].size})</span>
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="p-4 pt-0 space-y-2">
        <div class="flex items-center gap-2">
          <button onclick="openDetail('${item.id}')" class="flex-1 py-2 px-3 bg-gray-800/80 hover:bg-gray-700 text-white rounded-xl text-xs font-semibold transition-all border border-gray-700/70 flex items-center justify-center gap-1.5">
            <i class="fa-solid fa-circle-info text-cyan-400"></i>
            Chi tiết
          </button>
          
          ${hasTwoFiles ? `
            <button onclick="downloadFile(event, '${item.id}', 'zip')" class="flex-1 py-2 px-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 font-heading">
              <i class="fa-solid fa-file-zipper"></i>
              Tải Gộp .ZIP
            </button>
          ` : `
            <button onclick="downloadFile(event, '${item.id}')" class="flex-1 py-2 px-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 font-heading">
              <i class="fa-solid fa-download"></i>
              Tải Về
            </button>
          `}

          ${canEditResource(item) ? `
            <button onclick="openEditModal(event, '${item.id}')" class="p-2 text-gray-400 hover:text-amber-400 rounded-xl hover:bg-gray-800 transition-colors" title="Chỉnh sửa sản phẩm">
              <i class="fa-solid fa-pen-to-square text-xs"></i>
            </button>
          ` : ''}

          ${canDeleteResource(item) ? `
            <button onclick="deleteFile(event, '${item.id}')" class="p-2 text-gray-500 hover:text-rose-400 rounded-xl hover:bg-gray-800 transition-colors" title="Xóa file này">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          ` : ''}
        </div>

        ${hasTwoFiles ? `
          <div class="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-800/60">
            <span>Hoặc tải từng file rời:</span>
            <div class="flex items-center gap-2">
              <button onclick="downloadSingleSubFile(event, '${item.files[0].filename}', '${item.files[0].originalName}')" class="text-cyan-400 hover:underline">
                File 1 (.rpf)
              </button>
              <span>|</span>
              <button onclick="downloadSingleSubFile(event, '${item.files[1].filename}', '${item.files[1].originalName}')" class="text-amber-400 hover:underline">
                File 2 (.rpf)
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    fileGrid.appendChild(card);
  });
}

// Helper tải file bảo toàn 100% đúng tên gốc (kể cả file .ini, .rpf, .exe, .zip...)
async function downloadFileWithOriginalName(url, filename) {
  if (!url) return;
  const safeFilename = filename || "download_mod";

  // Nếu là Google Drive
  if (url.includes("drive.google.com") || url.includes("drive.usercontent.google.com")) {
    window.open(url, "_blank");
    showToast(`Đang chuyển hướng tới Google Drive để tải "${safeFilename}"! 🚀`);
    return;
  }

  showToast(`Đang tải file: ${safeFilename}... ⏳`);

  // Cách 1: Tải trực tiếp bằng fetch -> Blob để giữ 100% đúng tên gốc trên máy tính
  try {
    const res = await fetch(url);
    if (res.ok) {
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = safeFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
      showToast(`Đã tải thành công: ${safeFilename}! 🚀`);
      return;
    } else if (res.status === 404) {
      showToast(`Lỗi 404: File "${safeFilename}" không tồn tại trên kho lưu trữ Cloud (file cũ đã bị xóa). Vui lòng tải lên lại hoặc liên hệ admin!`, "error");
      return;
    }
  } catch (err) {
    console.warn("Fetch blob download fallback:", err);
  }

  // Cách 2: Tải qua tham số ?download= của Supabase Storage (máy chủ sẽ trả về header Content-Disposition)
  try {
    const separator = url.includes("?") ? "&" : "?";
    const downloadUrl = `${url}${separator}download=${encodeURIComponent(safeFilename)}`;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = safeFilename;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) {
    window.open(url, "_blank");
  }
}

// Download handler
window.downloadFile = function(event, id, mode = 'separate') {
  if (event) event.stopPropagation();
  const item = state.resources.find(r => r.id === id);
  if (!item) return;

  const hasMultiple = (item.files && item.files.length > 1) || item.isMultiFile;

  // 1. Nếu là bộ nhiều file
  if (hasMultiple) {
    if (API_BASE && mode === 'zip') {
      window.location.href = `${API_BASE}/api/download-zip/${item.id}`;
      item.downloads = (item.downloads || 0) + 1;
      updateDownloadCount(item.id, item.downloads);
      showToast(`Đang tải trọn gói ZIP (gộp cả 2 file: ${item.files[0]?.originalName} & ${item.files[1]?.originalName})! 📦`);
      renderGrid();
      return;
    }

    // Tải rời các file (giữ nguyên tên gốc)
    showToast(`Đang tải trọn bộ ${item.files.length} file...`);
    item.files.forEach((f, idx) => {
      setTimeout(() => {
        const subName = f.originalName || `${item.title}_part${idx + 1}${f.format || ''}`;
        const fileUrl = f.url || (API_BASE ? `${API_BASE}/api/download-file/${f.filename}/${encodeURIComponent(subName)}` : `${SUPABASE_URL}/storage/v1/object/public/mods/${f.filename}`);
        downloadFileWithOriginalName(fileUrl, subName);
      }, idx * 1000);
    });
    item.downloads = (item.downloads || 0) + 1;
    updateDownloadCount(item.id, item.downloads);
    renderGrid();
    return;
  }

  // 2. Nếu là file đơn (Google Drive, Cloud Supabase hoặc Local)
  const targetName = item.originalName || item.fileName || (item.title + (item.format ? (item.format.startsWith('.') ? item.format : '.' + item.format) : ''));
  const targetUrl = item.directUrl || item.rawDriveUrl || (item.filename ? (API_BASE ? `${API_BASE}/api/download/${item.id}` : `${SUPABASE_URL}/storage/v1/object/public/mods/${item.filename}`) : null);

  if (targetUrl) {
    downloadFileWithOriginalName(targetUrl, targetName);
    item.downloads = (item.downloads || 0) + 1;
    updateDownloadCount(item.id, item.downloads);
    renderGrid();
    return;
  }

  showToast("Không tìm thấy link tải của file này!", "warning");
};

// Download single sub-file
window.downloadSingleSubFile = function(event, filename, originalName) {
  if (event) event.stopPropagation();
  let fileUrl = `${SUPABASE_URL}/storage/v1/object/public/mods/${filename}`;
  if (API_BASE) {
    fileUrl = `${API_BASE}/api/download-file/${filename}/${encodeURIComponent(originalName)}`;
  }
  downloadFileWithOriginalName(fileUrl, originalName || filename);
};

// Delete real file
window.deleteFile = async function(event, id) {
  if (event) event.stopPropagation();
  if (!confirm("Bạn có chắc chắn muốn xóa file này khỏi hệ thống lưu trữ?")) return;

  // Xóa khỏi Supabase Cloud Database (đồng bộ toàn cầu)
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/resources?id=eq.${id}`, {
      method: "DELETE",
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
  } catch (e) {}

  // Xóa khỏi backend nếu có chạy localhost
  if (API_BASE) {
    try {
      await fetch(`${API_BASE}/api/files/${id}`, { method: "DELETE" });
    } catch (e) {}
  }

  showToast("Đã xóa file thành công!");
  state.resources = state.resources.filter(r => r.id !== id);
  renderGrid();
  updateCounters();
};

window.openDetail = function(id) {
  const item = state.resources.find(r => r.id === id);
  if (!item) return;

  state.activeItem = item;
  const cat = CATEGORY_MAP[item.category] || { name: "Tài nguyên", icon: "fa-solid fa-file", color: "gray", badgeClass: "bg-gray-800 text-gray-300" };

  modalCategoryBadge.className = `text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${cat.badgeClass}`;
  modalCategoryBadge.innerHTML = `<i class="${cat.icon} mr-1"></i> ${cat.name}`;
  
  modalIconBox.className = `w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-lg bg-${cat.color}-500/20 border border-${cat.color}-500/40 text-${cat.color}-400`;
  modalIconBox.innerHTML = `<i class="${cat.icon}"></i>`;

  modalTitle.textContent = item.title;
  modalVersion.textContent = item.version || "v1.0";
  modalSize.textContent = item.size || "--";
  modalDownloads.textContent = (item.downloads || 0).toLocaleString();
  modalFormat.textContent = item.format || ".zip";
  if (item.authorAvatar) {
    modalAuthor.innerHTML = `<span class="inline-flex items-center gap-1.5"><img src="${item.authorAvatar}" class="w-4 h-4 rounded-full object-cover border border-emerald-400"> ${item.author || "Hải Anh"} <i class="fa-solid fa-circle-check text-emerald-400 text-[10px]"></i></span>`;
  } else {
    modalAuthor.textContent = item.author || "Hải Anh";
  }
  modalDesc.textContent = item.desc || item.description || "Không có mô tả.";
  modalInstallGuide.textContent = item.guide || "Giải nén file và copy vào thư mục GTA 5 hoặc FiveM.";

  // Media preview inside Detail Modal
  const displayBanner = item.banner || (item.preview && item.preview.type === 'image' ? item.preview.url : null) || (item.preview && item.preview.banner ? item.preview.banner : null) || cat.banner || "";

  if (item.preview && (item.preview.type === "video" || item.preview.type === "audio" || item.preview.type === "youtube")) {
    modalBannerImg.classList.add("hidden");
    modalMediaContainer.classList.remove("hidden");
    modalMediaContainer.innerHTML = "";

    if (item.preview.type === "video") {
      modalMediaContainer.innerHTML = `
        <video controls autoplay class="w-full h-full max-h-[280px] rounded-xl bg-black">
          <source src="${getMediaUrl(item.preview.url)}">
        </video>
      `;
    } else if (item.preview.type === "audio") {
      modalMediaContainer.innerHTML = `
        <div class="w-full p-6 text-center bg-gradient-to-r from-emerald-950/60 to-cyan-950/60 rounded-xl border border-emerald-500/30">
          <i class="fa-solid fa-volume-high text-3xl text-emerald-400 mb-2 block"></i>
          <h4 class="text-xs font-semibold text-white mb-2">Đang phát âm thanh nghe thử:</h4>
          <audio controls autoplay class="w-full max-w-md mx-auto">
            <source src="${getMediaUrl(item.preview.url)}">
          </audio>
        </div>
      `;
    } else if (item.preview.type === "youtube") {
      modalMediaContainer.innerHTML = `
        <iframe class="w-full h-[280px] rounded-xl border-0" src="${getMediaUrl(item.preview.url)}?autoplay=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      `;
    }
  } else {
    modalMediaContainer.classList.add("hidden");
    modalMediaContainer.innerHTML = "";
    modalBannerImg.classList.remove("hidden");
    modalBannerImg.src = displayBanner;
  }

  detailModal.classList.remove("hidden");
};

// Open standalone Media Player Modal
window.openMediaModal = function(event, id) {
  if (event) event.stopPropagation();
  const item = state.resources.find(r => r.id === id);
  if (!item || !item.preview) return;

  mediaModalTitle.textContent = `Demo: ${item.title}`;
  mediaModalBody.innerHTML = "";

  if (item.preview.type === "video") {
    mediaModalBody.innerHTML = `
      <video controls autoplay class="w-full max-h-[70vh] rounded-xl bg-black">
        <source src="${getMediaUrl(item.preview.url)}">
      </video>
    `;
  } else if (item.preview.type === "audio") {
    mediaModalBody.innerHTML = `
      <div class="p-8 text-center bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-md shadow-2xl">
        <i class="fa-solid fa-volume-high text-4xl text-amber-400 mb-4 block animate-bounce"></i>
        <h4 class="text-sm font-bold text-white mb-3">Đang phát mẫu tiếng súng</h4>
        <audio controls autoplay class="w-full">
          <source src="${getMediaUrl(item.preview.url)}">
        </audio>
      </div>
    `;
  } else if (item.preview.type === "youtube") {
    mediaModalBody.innerHTML = `
      <iframe class="w-full h-[65vh] rounded-xl border-0" src="${getMediaUrl(item.preview.url)}?autoplay=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    `;
  }

  mediaModal.classList.remove("hidden");
};

function closeMedia() {
  mediaModal.classList.add("hidden");
  mediaModalBody.innerHTML = ""; // Stop playing
}

closeMediaModal.addEventListener("click", closeMedia);
mediaModal.addEventListener("click", (e) => {
  if (e.target === mediaModal) closeMedia();
});

closeDetailModal.addEventListener("click", () => {
  detailModal.classList.add("hidden");
  state.activeItem = null;
});

modalDownloadBtn.addEventListener("click", () => {
  if (state.activeItem) {
    downloadFile(null, state.activeItem.id);
  }
});

// File upload selection label update & Kiểm tra giới hạn 50MB
upFile.addEventListener("change", () => {
  if (upFile.files && upFile.files[0]) {
    const f = upFile.files[0];
    selectedFileName.textContent = `File 1: ${f.name} (${(f.size / (1024 * 1024)).toFixed(2)} MB)`;
    if (!upTitle.value) {
      upTitle.value = f.name.replace(/\.[^/.]+$/, "");
    }
    if (f.size > 50 * 1024 * 1024) {
      showToast(`⚠️ File "${f.name}" (${(f.size / (1024 * 1024)).toFixed(1)} MB) vượt giới hạn 50MB! Hãy dùng tab "Dán Link Google Drive".`, "warning");
      setTimeout(() => {
        if (confirm(`File "${f.name}" có dung lượng ${(f.size / (1024 * 1024)).toFixed(1)} MB (vượt quá mức 50MB của lưu trữ trực tiếp).\n\nBạn có muốn tự động chuyển sang tab "Dán Link Google Drive" để dán link tải tốc độ cao không?`)) {
          switchUploadMode('drive');
          const directSize = document.getElementById("upDirectSize");
          if (directSize) directSize.value = `${(f.size / (1024 * 1024)).toFixed(1)} MB`;
        }
      }, 200);
    }
  }
});

upFile2.addEventListener("change", () => {
  if (upFile2.files && upFile2.files[0]) {
    const f = upFile2.files[0];
    selectedFileName2.textContent = `File 2: ${f.name} (${(f.size / (1024 * 1024)).toFixed(2)} MB)`;
    if (f.size > 50 * 1024 * 1024) {
      showToast(`⚠️ File 2 "${f.name}" vượt giới hạn 50MB! Hãy dùng tab "Dán Link Google Drive".`, "warning");
    }
  }
});

upPreviewFile.addEventListener("change", () => {
  if (upPreviewFile.files && upPreviewFile.files[0]) {
    const f = upPreviewFile.files[0];
    selectedPreviewFileName.textContent = `Đã chọn: ${f.name} (${(f.size / (1024 * 1024)).toFixed(2)} MB)`;
  }
});

let currentUploadMode = 'local';
window.switchUploadMode = function(mode) {
  currentUploadMode = mode;
  const tabLocal = document.getElementById("tabModeLocal");
  const tabDrive = document.getElementById("tabModeDrive");
  const localSection = document.getElementById("localFilesSection");
  const cloudSection = document.getElementById("cloudLinkSection");

  if (mode === 'drive') {
    if (tabDrive) tabDrive.className = "flex-1 py-1.5 px-3 rounded-lg text-[11px] font-bold transition-all bg-amber-500 text-black flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20";
    if (tabLocal) tabLocal.className = "flex-1 py-1.5 px-3 rounded-lg text-[11px] font-bold transition-all text-gray-400 hover:text-white flex items-center justify-center gap-1.5";
    if (localSection) localSection.classList.add("hidden");
    if (cloudSection) cloudSection.classList.remove("hidden");
  } else {
    if (tabLocal) tabLocal.className = "flex-1 py-1.5 px-3 rounded-lg text-[11px] font-bold transition-all bg-emerald-500 text-black flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20";
    if (tabDrive) tabDrive.className = "flex-1 py-1.5 px-3 rounded-lg text-[11px] font-bold transition-all text-gray-400 hover:text-white flex items-center justify-center gap-1.5";
    if (localSection) localSection.classList.remove("hidden");
    if (cloudSection) cloudSection.classList.add("hidden");
  }
};

// Cập nhật giao diện form theo chuyên mục được chọn
function updateCategoryFormUI(cat) {
  if (cat === "gunsound") {
    file2Container.classList.remove("hidden");
    selectedFileName.textContent = "Chọn File 1 (ví dụ: WEAPONS_PLAYER.rpf / weapons.awc)";
    selectedFileName2.textContent = "Chọn File 2 đi kèm (ví dụ: RESIDENT.rpf / resident.awc)";
  } else if (cat === "reshade") {
    file2Container.classList.add("hidden");
    selectedFileName.textContent = "Chọn File Preset ReShade (ví dụ: .ini / .fx / .zip)";
  } else if (cat === "dump") {
    file2Container.classList.add("hidden");
    selectedFileName.textContent = "Chọn File Dump / Crash log / File exe (ví dụ: .dmp / .log / .exe)";
  } else if (cat === "source") {
    file2Container.classList.add("hidden");
    selectedFileName.textContent = "Chọn File Source GTA 5 / Script (ví dụ: .zip / .rar / .lua / .cs / .bat)";
  } else if (cat === "software") {
    file2Container.classList.add("hidden");
    selectedFileName.textContent = "Chọn File Phần Mềm / Công Cụ (OpenIV, ScriptHookV, .exe, .zip, .rar...)";
  } else {
    file2Container.classList.remove("hidden");
    selectedFileName.textContent = "Chọn File Mod chính từ máy";
  }
}

// Helper lưu thông tin tài nguyên lên Supabase an toàn (hỗ trợ tác giả, avatar & banner)
async function saveResourceToSupabase(item) {
  const payload = {
    id: String(item.id),
    category: item.category,
    title: item.title,
    original_name: item.original_name || item.originalName || item.title,
    filename: item.filename || null,
    files: Array.isArray(item.files) ? item.files : [],
    is_multi_file: Boolean(item.is_multi_file),
    file_count: item.file_count || 1,
    size: item.size || "--",
    version: item.version || "v1.0",
    format: item.format || ".rar",
    description: item.description || item.desc || "",
    guide: item.guide || "",
    preview: item.preview || {},
    downloads: item.downloads || 0,
    is_cloud_link: Boolean(item.is_cloud_link),
    direct_url: item.direct_url || item.directUrl || null
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/resources`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(payload)
  });

  return res;
}

// Category change reaction
upCategory.addEventListener("change", () => {
  updateCategoryFormUI(upCategory.value);
});

// Real File Upload with Progress Bar
uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const isDriveMode = currentUploadMode === 'drive';

  if (isDriveMode) {
    if (!upDirectUrl.value.trim()) {
      showToast("Vui lòng dán link Google Drive hoặc link tải trực tiếp!", "warning");
      return;
    }
  } else {
    if (!upFile.files || !upFile.files[0]) {
      showToast("Vui lòng chọn ít nhất File 1 từ máy tính hoặc bấm tab 'Dán Link Google Drive'!", "warning");
      return;
    }
  }

  let finalTitle = upTitle.value.trim();
  if (!finalTitle) {
    if (isDriveMode) {
      finalTitle = "Gói Mod GTA 5 (Google Drive)";
    } else {
      const file1 = upFile.files[0];
      const file2 = upFile2.files && upFile2.files[0] ? upFile2.files[0] : null;
      finalTitle = file2 ? `${file1.name.replace(/\.[^/.]+$/, "")} + ${file2.name}` : file1.name.replace(/\.[^/.]+$/, "");
    }
  }

  const upAuthorInput = document.getElementById("upAuthor");
  const finalAuthor = (upAuthorInput && upAuthorInput.value.trim()) ? upAuthorInput.value.trim() : (currentUser ? currentUser.name : "Hải Anh");
  const currentAuthorAvatar = (currentUser && currentUser.avatar) ? currentUser.avatar : '';
  const currentUploaderEmail = (currentUser && currentUser.email) ? currentUser.email : '';

  // TRƯỜNG HỢP 1: Dán link Google Drive (Đăng trực tiếp lên Cloud Supabase - Không cần Node.js)
  if (isDriveMode) {
    uploadProgressContainer.classList.remove("hidden");
    uploadProgressBar.style.width = "40%";
    uploadPercent.textContent = "40%";
    submitUploadBtn.disabled = true;

    let finalDriveUrl = upDirectUrl.value.trim();
    const driveMatch = finalDriveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || finalDriveUrl.match(/id=([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      finalDriveUrl = `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
    }

    let previewObj = null;
    if (upYoutubeUrl.value.trim()) {
      const ytVal = upYoutubeUrl.value.trim();
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = ytVal.match(regExp);
      const ytId = (match && match[2].length === 11) ? match[2] : null;
      if (ytId) {
        previewObj = { type: 'youtube', youtubeId: ytId, url: `https://www.youtube.com/embed/${ytId}`, author: finalAuthor, author_avatar: currentAuthorAvatar, uploader_email: currentUploaderEmail };
      } else {
        previewObj = { type: 'video', url: ytVal, author: finalAuthor, author_avatar: currentAuthorAvatar, uploader_email: currentUploaderEmail };
      }
    } else {
      previewObj = { author: finalAuthor, author_avatar: currentAuthorAvatar, uploader_email: currentUploaderEmail };
    }

    const newItem = {
      id: Date.now().toString(),
      category: upCategory.value,
      title: finalTitle,
      author: finalAuthor,
      author_avatar: currentAuthorAvatar,
      original_name: finalTitle,
      filename: null,
      files: [],
      is_multi_file: false,
      file_count: 1,
      size: upDirectSize.value.trim() || "Google Drive",
      version: upVersion.value.trim() || "v1.0",
      format: upDirectFormat.value.trim() || ".rar",
      description: upNote.value.trim() || "File mod GTA 5 dung lượng lớn được lưu trên Google Drive để tải mượt mà 24/7.",
      guide: upGuide.value.trim() || "Giải nén file và copy vào thư mục GTA 5 hoặc FiveM.",
      preview: previewObj,
      downloads: 0,
      is_cloud_link: true,
      direct_url: finalDriveUrl
    };

    try {
      uploadProgressBar.style.width = "80%";
      uploadPercent.textContent = "80%";

      const supRes = await saveResourceToSupabase(newItem);

      uploadProgressContainer.classList.add("hidden");
      submitUploadBtn.disabled = false;
      uploadProgressBar.style.width = "0%";

      let savedItem = normalizeResource(newItem);
      if (supRes.ok) {
        const respJson = await supRes.json();
        if (Array.isArray(respJson) && respJson[0]) {
          savedItem = normalizeResource(respJson[0]);
        }
      }

      closeUpload();

      state.resources = state.resources.filter(r => r.id !== savedItem.id);
      state.resources.unshift(savedItem);

      if (state.activeCategory !== 'all' && state.activeCategory !== savedItem.category) {
        state.activeCategory = savedItem.category;
        document.querySelectorAll(".cat-pill").forEach(p => {
          const isMatch = p.dataset.cat === savedItem.category;
          p.classList.toggle("active", isMatch);
          p.classList.toggle("bg-emerald-500", isMatch);
          p.classList.toggle("border-emerald-400", isMatch);
          p.classList.toggle("text-black", isMatch);
          p.classList.toggle("shadow-lg", isMatch);
          p.classList.toggle("shadow-emerald-500/20", isMatch);
          p.classList.toggle("bg-gray-900/90", !isMatch);
          p.classList.toggle("border-gray-800", !isMatch);
          p.classList.toggle("text-gray-300", !isMatch);
        });
      }

      renderGrid();
      updateCounters();
      showSuccessHUD("TẢI LÊN THÀNH CÔNG! 🔥", `"${savedItem.title}" (Cre: ${savedItem.author}) đã xuất hiện trên web!`);
      return;
    } catch (err) {
      console.error("Upload drive mode error:", err);
      uploadProgressContainer.classList.add("hidden");
      submitUploadBtn.disabled = false;
      showToast("Lỗi khi kết nối Supabase Cloud. Hãy thử lại!", "warning");
      return;
    }
  }

  // TRƯỜNG HỢP 2: Tải file trực tiếp từ máy tính / điện thoại lên Cloud Supabase Storage
  const file1 = upFile.files[0];
  const file2 = upFile2.files && upFile2.files[0] ? upFile2.files[0] : null;

  // Kiểm tra kích thước file: giới hạn 50MB của lưu trữ trực tiếp Cloud
  if (file1.size > 50 * 1024 * 1024 || (file2 && file2.size > 50 * 1024 * 1024)) {
    showToast("⚠️ File vượt quá giới hạn 50MB của lưu trữ trực tiếp! Hãy dùng tab 'Dán Link Google Drive'.", "warning");
    switchUploadMode('drive');
    const directSize = document.getElementById("upDirectSize");
    if (directSize) directSize.value = formatBytes(file1.size + (file2 ? file2.size : 0));
    return;
  }

  uploadProgressContainer.classList.remove("hidden");
  uploadProgressBar.style.width = "5%";
  uploadPercent.textContent = "Bắt đầu tải lên...";
  submitUploadBtn.disabled = true;

  try {
    // 1. Tải File 1 lên Supabase Storage với phần trăm thật theo thời gian thực
    const uploaded1 = await uploadFileToSupabase(file1, (percent, loaded, total) => {
      const share = file2 ? 0.45 : 0.85;
      const cur = Math.round(percent * share);
      uploadProgressBar.style.width = `${cur}%`;
      uploadPercent.textContent = `${cur}% (${formatBytes(loaded)} / ${formatBytes(total)})`;
    });

    // 2. Nếu có File 2 đi kèm
    let uploaded2 = null;
    if (file2) {
      uploadProgressBar.style.width = "45%";
      uploadPercent.textContent = "45% (Đang tải File 2...)";
      uploaded2 = await uploadFileToSupabase(file2, (percent, loaded, total) => {
        const cur = 45 + Math.round(percent * 0.4);
        uploadProgressBar.style.width = `${cur}%`;
        uploadPercent.textContent = `${cur}% (${formatBytes(loaded)} / ${formatBytes(total)})`;
      });
    }

    // 3. Xử lý Preview (Video / Audio file, YouTube link hoặc Ảnh minh họa / Banner)
    let previewObj = null;
    let bannerUrl = "";
    if (upPreviewFile.files && upPreviewFile.files[0]) {
      uploadPercent.textContent = "Đang tải ảnh / video xem thử...";
      const pFile = upPreviewFile.files[0];
      const pUp = await uploadFileToSupabase(pFile);
      const ext = pFile.name.split('.').pop().toLowerCase();
      const isVideo = ['mp4', 'webm', 'mov'].includes(ext);
      const isAudio = ['mp3', 'wav', 'ogg', 'm4a'].includes(ext);
      const mediaType = isVideo ? 'video' : (isAudio ? 'audio' : 'image');
      if (mediaType === 'image') {
        bannerUrl = pUp.url;
      }
      previewObj = {
        type: mediaType,
        filename: pUp.filename,
        originalName: pFile.name,
        url: pUp.url,
        banner: bannerUrl,
        author: finalAuthor,
        author_avatar: currentAuthorAvatar,
        uploader_email: currentUploaderEmail
      };
    } else if (upYoutubeUrl.value.trim()) {
      const ytVal = upYoutubeUrl.value.trim();
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = ytVal.match(regExp);
      const ytId = (match && match[2].length === 11) ? match[2] : null;
      if (ytId) {
        previewObj = { type: 'youtube', youtubeId: ytId, url: `https://www.youtube.com/embed/${ytId}`, author: finalAuthor, author_avatar: currentAuthorAvatar, uploader_email: currentUploaderEmail };
      } else {
        previewObj = { type: 'video', url: ytVal, author: finalAuthor, author_avatar: currentAuthorAvatar, uploader_email: currentUploaderEmail };
      }
    } else {
      previewObj = { author: finalAuthor, author_avatar: currentAuthorAvatar, uploader_email: currentUploaderEmail };
    }

    const modFiles = [uploaded1];
    if (uploaded2) modFiles.push(uploaded2);

    const totalBytes = (file1.size || 0) + (file2 ? file2.size : 0);

    const newItem = {
      id: Date.now().toString(),
      category: upCategory.value,
      title: finalTitle,
      author: finalAuthor,
      author_avatar: currentAuthorAvatar,
      original_name: file1.name,
      filename: uploaded1.filename,
      files: modFiles,
      is_multi_file: Boolean(uploaded2),
      file_count: modFiles.length,
      size: formatBytes(totalBytes),
      version: upVersion.value.trim() || "v1.0",
      format: modFiles.map(f => f.format).join(' / '),
      description: upNote.value.trim() || "File mod GTA 5 tải trực tiếp từ thiết bị.",
      guide: upGuide.value.trim() || "Giải nén file và copy vào thư mục GTA 5 hoặc FiveM.",
      preview: previewObj,
      banner: bannerUrl,
      downloads: 0,
      is_cloud_link: true,
      direct_url: uploaded1.url
    };

    uploadProgressBar.style.width = "95%";
    uploadPercent.textContent = "Đang lưu lên hệ thống...";

    const supRes = await saveResourceToSupabase(newItem);

    uploadProgressContainer.classList.add("hidden");
    submitUploadBtn.disabled = false;
    uploadProgressBar.style.width = "0%";

    let savedItem = normalizeResource(newItem);
    if (supRes.ok) {
      const respJson = await supRes.json();
      if (Array.isArray(respJson) && respJson[0]) {
        savedItem = normalizeResource(respJson[0]);
      }
    }

    closeUpload();

    state.resources = state.resources.filter(r => r.id !== savedItem.id);
    state.resources.unshift(savedItem);

    if (state.activeCategory !== 'all' && state.activeCategory !== savedItem.category) {
      state.activeCategory = savedItem.category;
      document.querySelectorAll(".cat-pill").forEach(p => {
        const isMatch = p.dataset.cat === savedItem.category;
        p.classList.toggle("active", isMatch);
        p.classList.toggle("bg-emerald-500", isMatch);
        p.classList.toggle("border-emerald-400", isMatch);
        p.classList.toggle("text-black", isMatch);
        p.classList.toggle("shadow-lg", isMatch);
        p.classList.toggle("shadow-emerald-500/20", isMatch);
        p.classList.toggle("bg-gray-900/90", !isMatch);
        p.classList.toggle("border-gray-800", !isMatch);
        p.classList.toggle("text-gray-300", !isMatch);
      });
    }

    renderGrid();
    updateCounters();
    showSuccessHUD("TẢI LÊN THÀNH CÔNG! 🔥", `"${savedItem.title}" (Cre: ${savedItem.author}) đã xuất hiện trên web!`);
    return;
  } catch (err) {
    console.error("Direct upload error:", err);
    uploadProgressContainer.classList.add("hidden");
    submitUploadBtn.disabled = false;
    showToast("Lỗi khi tải file: " + err.message, "warning");
    return;
  }
});

// 1. Nút "ĐĂNG TẢI FILE" ở góc trên cùng: Duy nhất nút này cho phép TỰ DO CHỌN CHUYÊN MỤC
window.openUploadModalFree = function() {
  upCategory.disabled = false;
  upCategory.classList.remove("opacity-75", "cursor-not-allowed", "border-emerald-500/50", "bg-gray-950");
  
  if (categoryNoticeBadge) {
    categoryNoticeBadge.classList.remove("hidden");
    categoryNoticeBadge.innerHTML = `<span class="text-emerald-400 font-semibold"><i class="fa-solid fa-list-check mr-1"></i>Được tự do chọn chuyên mục</span>`;
  }

  // Nếu đang xem ở 1 mục cụ thể, chọn sẵn mục đó nhưng vẫn cho phép chọn mục khác tùy ý
  if (state.activeCategory && state.activeCategory !== 'all' && state.activeCategory !== 'favorites') {
    upCategory.value = state.activeCategory;
  }
  updateCategoryFormUI(upCategory.value);
  uploadModal.classList.remove("hidden");
};

// 2. Nút bấm trong chuyên mục đang xem: TỰ ĐỘNG GÁN ĐÚNG MỤC ĐÓ & KHÓA LẠI (Khỏi cần chọn)
window.openUploadModalForCurrentCategory = function(specificCat) {
  let targetCat = specificCat || state.activeCategory;
  if (!targetCat || targetCat === 'all' || targetCat === 'favorites') {
    return openUploadModalFree();
  }

  upCategory.value = targetCat;
  upCategory.disabled = true; // Khóa lại, người dùng khỏi cần chọn!
  upCategory.classList.add("opacity-75", "cursor-not-allowed", "border-emerald-500/50", "bg-gray-950");

  const catMeta = CATEGORY_MAP[targetCat] || { name: targetCat };
  if (categoryNoticeBadge) {
    categoryNoticeBadge.classList.remove("hidden");
    categoryNoticeBadge.innerHTML = `<span class="text-cyan-300 font-bold"><i class="fa-solid fa-lock text-emerald-400 mr-1"></i>Cố định mục: ${catMeta.name} (Khỏi cần chọn)</span>`;
  }

  updateCategoryFormUI(targetCat);
  uploadModal.classList.remove("hidden");
};

openUploadBtn.addEventListener("click", () => {
  openUploadModalFree();
});

function closeUpload() {
  uploadModal.classList.add("hidden");
  uploadForm.reset();
  switchUploadMode('local');
  upCategory.disabled = false;
  upCategory.classList.remove("opacity-75", "cursor-not-allowed", "border-emerald-500/50", "bg-gray-950");
  if (categoryNoticeBadge) categoryNoticeBadge.classList.add("hidden");
  file2Container.classList.remove("hidden");
  selectedFileName.textContent = "Chọn File 1 (File chính: ví dụ weapons.awc / .oiv)";
  selectedFileName2.textContent = "Chọn File 2 đi kèm (ví dụ: resident.awc / weapons.dat / file phụ)";
  selectedPreviewFileName.textContent = "Tải file Video / Audio / Ảnh";
}

closeUploadModal.addEventListener("click", closeUpload);
cancelUploadBtn.addEventListener("click", closeUpload);

categoryNav.addEventListener("click", (e) => {
  const btn = e.target.closest(".cat-pill");
  if (!btn) return;

  document.querySelectorAll(".cat-pill").forEach(p => {
    p.classList.remove("active", "bg-emerald-500", "border-emerald-400", "text-black", "shadow-lg", "shadow-emerald-500/20");
    p.classList.add("bg-gray-900/90", "border-gray-800", "text-gray-300");
  });

  btn.classList.add("active", "bg-emerald-500", "border-emerald-400", "text-black", "shadow-lg", "shadow-emerald-500/20");
  btn.classList.remove("bg-gray-900/90", "border-gray-800", "text-gray-300");

  state.activeCategory = btn.dataset.cat;
  renderGrid();
});

openFavoritesBtn.addEventListener("click", () => {
  state.activeCategory = "favorites";
  renderGrid();
});

searchInput.addEventListener("input", (e) => {
  state.searchQuery = e.target.value;
  clearSearchBtn.classList.toggle("hidden", state.searchQuery.length === 0);
  renderGrid();
});

clearSearchBtn.addEventListener("click", () => {
  searchInput.value = "";
  state.searchQuery = "";
  clearSearchBtn.classList.add("hidden");
  renderGrid();
});

sortSelect.addEventListener("change", (e) => {
  state.sortBy = e.target.value;
  renderGrid();
});

// TỰ ĐỘNG CẬP NHẬT TỨC THÌ (REALTIME) KHÔNG CẦN F5 TRANG WEB
let lastDataFingerprint = "";

async function syncRealtimeChanges() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/resources?select=*&order=created_at.desc`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    if (!res.ok) return;
    const freshList = (await res.json()).map(normalizeResource);
    const fingerprint = freshList.map(r => `${r.id}_${r.downloads || 0}`).join('|');

    if (!lastDataFingerprint) {
      lastDataFingerprint = fingerprint;
      return;
    }

    if (lastDataFingerprint !== fingerprint) {
      console.log("[REALTIME] Có file mới tải lên từ máy khác! Tự động hiển thị lên web ngay...");
      lastDataFingerprint = fingerprint;
      state.resources = freshList;
      updateCounters();
      renderGrid();
    }
  } catch (err) {}
}

function initSupabaseRealtime() {
  // 1. Quét nền tự động mỗi 3 giây (đảm bảo 100% không bao giờ cần F5)
  setInterval(syncRealtimeChanges, 3000);

  // 2. Kênh WebSocket Supabase Realtime (Cập nhật trong 0.1 giây)
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    try {
      const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      client
        .channel('resources-realtime-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'resources' }, (payload) => {
          console.log('[REALTIME WS] Có thay đổi dữ liệu trực tiếp:', payload);
          loadResources();
        })
        .subscribe();
    } catch (e) {
      console.warn("Supabase Realtime socket warning:", e);
    }
  }
}

// ==========================================
// HỆ THỐNG XÁC THỰC OAUTH & GMAIL OTP 6 SỐ
// Tự động nhận diện Tên Thật & Ảnh đại diện
// ==========================================

let currentOtpEmail = "";

window.openAuthModal = function() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('hidden');
  backToEmailStep();
};

window.closeAuthModal = function() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.add('hidden');
};

window.backToEmailStep = function() {
  const stepEmail = document.getElementById('otpStepEmail');
  const stepCode = document.getElementById('otpStepCode');
  if (stepEmail) stepEmail.classList.remove('hidden');
  if (stepCode) stepCode.classList.add('hidden');
  const emailInput = document.getElementById('authEmailInput');
  if (emailInput) setTimeout(() => emailInput.focus(), 100);
};

window.handleSendOtp = async function(isResend = false) {
  if (!supabaseClient) {
    showToast("Đang kết nối dịch vụ Supabase, vui lòng đợi 1 giây...", "warning");
    return;
  }
  const emailInput = document.getElementById('authEmailInput');
  const email = (isResend && currentOtpEmail) ? currentOtpEmail : (emailInput ? emailInput.value.trim() : "");
  
  if (!email || !email.includes('@') || !email.includes('.')) {
    showToast("Vui lòng nhập địa chỉ email/Gmail hợp lệ!", "warning");
    if (emailInput) emailInput.focus();
    return;
  }

  currentOtpEmail = email;
  const sendBtn = document.getElementById('sendOtpBtn');
  const resendBtn = document.getElementById('resendOtpBtn');
  const oldText = sendBtn ? sendBtn.innerHTML : "";
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>ĐANG GỬI MÃ ĐẾN GMAIL...</span>`;
  }
  if (resendBtn) resendBtn.textContent = "Đang gửi...";

  try {
    const { data, error } = await supabaseClient.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: true
      }
    });

    if (error) throw error;

    // Chuyển sang Bước 2: Nhập mã 6 chữ số
    const stepEmail = document.getElementById('otpStepEmail');
    const stepCode = document.getElementById('otpStepCode');
    const sentToText = document.getElementById('sentToEmailText');
    const otpInput = document.getElementById('authOtpInput');

    if (sentToText) sentToText.textContent = email;
    if (stepEmail) stepEmail.classList.add('hidden');
    if (stepCode) stepCode.classList.remove('hidden');
    if (otpInput) {
      otpInput.value = "";
      setTimeout(() => otpInput.focus(), 150);
    }

    showToast(`Đã gửi mã xác thực 6 số đến ${email}! Vui lòng mở Gmail để xem mã.`, "success");
  } catch (err) {
    console.error("Lỗi gửi OTP:", err);
    showToast(`Không thể gửi mã: ` + (err.message || err), "error");
  } finally {
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerHTML = oldText;
    }
    if (resendBtn) resendBtn.textContent = "Gửi lại mã";
  }
};

window.handleVerifyOtp = async function() {
  if (!supabaseClient) {
    showToast("Đang kết nối dịch vụ Supabase...", "warning");
    return;
  }
  const otpInput = document.getElementById('authOtpInput');
  const token = otpInput ? otpInput.value.trim().replace(/\s+/g, '') : "";

  if (!token || token.length < 6) {
    showToast("Vui lòng nhập đủ mã xác thực từ Gmail!", "warning");
    if (otpInput) otpInput.focus();
    return;
  }

  const verifyBtn = document.getElementById('verifyOtpBtn');
  const oldText = verifyBtn ? verifyBtn.innerHTML : "";
  if (verifyBtn) {
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>ĐANG XÁC THỰC MÃ...</span>`;
  }

  try {
    const { data, error } = await supabaseClient.auth.verifyOtp({
      email: currentOtpEmail,
      token: token,
      type: 'email'
    });

    if (error) throw error;

    if (data && data.user) {
      extractUserData(data.user);
      closeAuthModal();
      showToast("Đăng nhập bằng mã OTP Gmail thành công! 🎉", "success");
    } else {
      showToast("Xác thực thành công!", "success");
      closeAuthModal();
    }
  } catch (err) {
    console.error("Lỗi xác minh OTP:", err);
    showToast("Mã xác thực không đúng hoặc đã hết hạn. Vui lòng kiểm tra lại!", "error");
  } finally {
    if (verifyBtn) {
      verifyBtn.disabled = false;
      verifyBtn.innerHTML = oldText;
    }
  }
};

window.loginWithProvider = async function(provider) {
  if (!supabaseClient) {
    showToast("Đang kết nối dịch vụ xác thực, vui lòng thử lại sau 1 giây...", "warning");
    return;
  }
  try {
    showToast(`Đang chuyển hướng tới ${provider === 'google' ? 'Google' : 'Discord'}...`, "info");
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) throw error;
  } catch (err) {
    console.error("Login error:", err);
    showToast(`Đăng nhập ${provider} lỗi: ` + (err.message || err), "error");
  }
};

window.handleLogout = async function() {
  if (supabaseClient) {
    try {
      await supabaseClient.auth.signOut();
    } catch (e) {}
  }
  currentUser = null;
  localStorage.removeItem('gta_cached_user');
  localStorage.removeItem('gta_admin_unlocked');
  updateAuthUI();
  renderGrid();
  showToast("Đã đăng xuất tài khoản!", "info");
};

function updateAuthUI() {
  const loginBtn = document.getElementById('loginBtn');
  const userProfile = document.getElementById('userProfile');
  const userAvatar = document.getElementById('userAvatar');
  const userName = document.getElementById('userName');
  const upAuthorInput = document.getElementById("upAuthor");
  const adminBtn = document.getElementById('adminBtn');

  // Nút Quản Trị Vàng: CHỈ HIỆN khi đăng nhập 1 trong 3 email Chủ Web
  if (adminBtn) {
    if (isUserAdmin()) {
      adminBtn.classList.remove('hidden');
    } else {
      adminBtn.classList.add('hidden');
    }
  }

  if (currentUser) {
    if (loginBtn) loginBtn.classList.add('hidden');
    if (userProfile) userProfile.classList.remove('hidden');
    if (userAvatar) {
      userAvatar.src = currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=10b981&color=000&bold=true`;
    }
    if (userName) userName.textContent = currentUser.name;
    if (upAuthorInput && (!upAuthorInput.value || upAuthorInput.value === 'Hải Anh')) {
      upAuthorInput.value = currentUser.name;
    }
  } else {
    if (loginBtn) loginBtn.classList.remove('hidden');
    if (userProfile) userProfile.classList.add('hidden');
    if (upAuthorInput && upAuthorInput.value === 'Hải Anh') {
      upAuthorInput.value = '';
    }
  }
}

function extractUserData(user) {
  if (!user) return;
  const meta = user.user_metadata || {};
  // Nhận diện tên thật từ Google / Discord / Email
  let realName = meta.full_name || meta.name || meta.custom_claims?.global_name || meta.user_name || meta.preferred_username;
  if (!realName && user.email) {
    const prefix = user.email.split('@')[0];
    realName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  if (!realName) realName = "Hải Anh";

  // Nhận diện avatar thật hoặc UI Avatar
  let realAvatar = meta.avatar_url || meta.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(realName)}&background=10b981&color=000&bold=true`;

  currentUser = {
    id: user.id,
    name: realName,
    avatar: realAvatar,
    email: user.email || ""
  };

  localStorage.setItem('gta_cached_user', JSON.stringify(currentUser));
  updateAuthUI();
  renderGrid();
  closeAuthModal();
  showToast(`Xin chào, ${currentUser.name}! 👋`, "success");
}

async function initAuth() {
  updateAuthUI();

  // Lắng nghe phím Enter và tự động submit khi gõ đủ 6 số
  const authEmailInput = document.getElementById('authEmailInput');
  if (authEmailInput) {
    authEmailInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSendOtp();
      }
    });
  }

  const authOtpInput = document.getElementById('authOtpInput');
  if (authOtpInput) {
    let otpDebounceTimer = null;
    authOtpInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleVerifyOtp();
      }
    });
    authOtpInput.addEventListener('input', () => {
      const val = authOtpInput.value.trim().replace(/\s+/g, '');
      clearTimeout(otpDebounceTimer);
      // Tự động kích hoạt khi người dùng gõ hoặc dán đủ 6 số hoặc 8 số
      if (val.length === 6 || val.length === 8) {
        otpDebounceTimer = setTimeout(() => {
          handleVerifyOtp();
        }, 350);
      }
    });
  }

  if (!supabaseClient) return;

  try {
    // 1. Kiểm tra session hiện tại
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && session.user) {
      extractUserData(session.user);
    }

    // 2. Lắng nghe trạng thái đăng nhập thay đổi realtime
    supabaseClient.auth.onAuthStateChange((event, session) => {
      console.log("[AUTH EVENT]", event, session);
      if (session && session.user) {
        extractUserData(session.user);
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        updateAuthUI();
      }
    });
  } catch (err) {
    console.warn("Lỗi khởi tạo Auth:", err);
  }
}

// Cập nhật tên tác giả tự động khi mở Modal Upload
const originalOpenUploadBtn = document.getElementById("openUploadBtn");
if (originalOpenUploadBtn) {
  originalOpenUploadBtn.addEventListener("click", () => {
    const upAuthorInput = document.getElementById("upAuthor");
    if (currentUser && upAuthorInput) {
      upAuthorInput.value = currentUser.name;
    }
  });
}

// ==========================================
// TRUNG TÂM QUẢN TRỊ & PHÂN QUYỀN (CHỦ WEB & NGƯỜI ĐĂNG)
// ==========================================

// 3 Email DUY NHẤT được quyền làm Chủ Web
const ADMIN_EMAILS = [
  'nguyenhaianh6a9tg@gmail.com',
  'haianh01831@gmail.com',
  'haianh0031@gmail.com'
];

// Chỉ duy nhất 3 email trên mới có quyền Chủ Web
function isUserAdmin() {
  if (currentUser && currentUser.email) {
    return ADMIN_EMAILS.includes(currentUser.email.toLowerCase().trim());
  }
  return false;
}

// Kiểm tra quyền SỬA bài:
// 1. Chủ web (3 email trên): Được quyền sửa TẤT CẢ các bài.
// 2. Người đăng bài: CHỈ ĐƯỢC PHÉP SỬA BÀI CỦA CHÍNH MÌNH.
function canEditResource(item) {
  if (!item) return false;
  if (isUserAdmin()) return true; // Chủ web toàn quyền
  if (!currentUser || !currentUser.email) return false;

  const currentEmail = currentUser.email.toLowerCase().trim();
  const uploaderEmail = (item.uploaderEmail || (item.preview && item.preview.uploader_email) || '').toLowerCase().trim();
  if (uploaderEmail && uploaderEmail === currentEmail) return true;

  // So khớp tên tác giả nếu bài đăng chưa lưu email
  if (item.author && currentUser.name && item.author.toLowerCase().trim() === currentUser.name.toLowerCase().trim()) {
    return true;
  }
  return false;
}

// Kiểm tra quyền XÓA bài:
// 1. Chủ web (3 email trên): Được quyền xóa TẤT CẢ các bài của bất kỳ ai.
// 2. Người đăng bài: Được quyền xóa bài của chính mình.
function canDeleteResource(item) {
  if (!item) return false;
  if (isUserAdmin()) return true; // Chủ web toàn quyền
  if (!currentUser || !currentUser.email) return false;

  const currentEmail = currentUser.email.toLowerCase().trim();
  const uploaderEmail = (item.uploaderEmail || (item.preview && item.preview.uploader_email) || '').toLowerCase().trim();
  if (uploaderEmail && uploaderEmail === currentEmail) return true;

  if (item.author && currentUser.name && item.author.toLowerCase().trim() === currentUser.name.toLowerCase().trim()) {
    return true;
  }
  return false;
}

window.checkAndOpenAdmin = function() {
  if (isUserAdmin()) {
    openAdminModal();
  } else {
    showToast("Mục Quản Trị & Check Log chỉ dành riêng cho Chủ Web!", "error");
  }
};

window.closeAdminPinModal = function() {
  const pinModal = document.getElementById('adminPinModal');
  if (pinModal) pinModal.classList.add('hidden');
};

window.verifyAdminPin = function() {
  if (isUserAdmin()) {
    closeAdminPinModal();
    openAdminModal();
  } else {
    showToast("Vui lòng đăng nhập bằng đúng Gmail Chủ Web!", "error");
  }
};

window.openAdminModal = function() {
  const modal = document.getElementById('adminModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  renderAdminTable();
};

window.closeAdminModal = function() {
  const modal = document.getElementById('adminModal');
  if (modal) modal.classList.add('hidden');
};

window.renderAdminTable = function() {
  const tableBody = document.getElementById('adminTableBody');
  const statFiles = document.getElementById('adminStatFiles');
  const statDownloads = document.getElementById('adminStatDownloads');
  const statCloud = document.getElementById('adminStatCloud');
  const logCount = document.getElementById('adminLogCount');
  const searchInput = document.getElementById('adminSearchInput');
  const filterText = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const totalFiles = state.resources.length;
  const totalDownloads = state.resources.reduce((sum, r) => sum + (Number(r.downloads) || 0), 0);
  const totalCloud = state.resources.filter(r => r.isCloudLink || r.directUrl).length;

  if (statFiles) statFiles.textContent = totalFiles;
  if (statDownloads) statDownloads.textContent = totalDownloads.toLocaleString();
  if (statCloud) statCloud.textContent = totalCloud;

  let list = [...state.resources];
  if (filterText) {
    list = list.filter(r => 
      (r.title && r.title.toLowerCase().includes(filterText)) ||
      (r.author && r.author.toLowerCase().includes(filterText)) ||
      (r.category && r.category.toLowerCase().includes(filterText))
    );
  }

  if (logCount) logCount.textContent = `${list.length} file`;

  if (!tableBody) return;
  if (list.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="p-8 text-center text-gray-500">
          Chưa có bài đăng nào khớp với tìm kiếm.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = list.map(item => {
    const cat = CATEGORY_MAP[item.category] || { name: item.category, badgeClass: "bg-gray-800 text-gray-300" };
    const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : 'Mới đây';
    return `
      <tr class="hover:bg-gray-800/40 transition-colors">
        <td class="p-3">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${item.isCloudLink ? 'bg-cyan-400' : 'bg-emerald-400'}"></span>
            <div class="flex flex-col">
              <span class="font-bold text-white text-xs hover:text-amber-400 cursor-pointer" onclick="closeAdminModal(); openDetail('${item.id}')">${item.title}</span>
              <span class="text-[10px] text-gray-500">${item.originalName || item.format || ''} • ${item.size || '--'}</span>
            </div>
          </div>
        </td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${cat.badgeClass}">${cat.name}</span>
        </td>
        <td class="p-3">
          <div class="flex items-center gap-1.5">
            ${item.authorAvatar ? `<img src="${item.authorAvatar}" class="w-4 h-4 rounded-full object-cover border border-emerald-400">` : ''}
            <span class="text-emerald-400 font-semibold">${item.author || 'Hải Anh'}</span>
          </div>
        </td>
        <td class="p-3 font-mono font-bold text-amber-400">${(item.downloads || 0).toLocaleString()}</td>
        <td class="p-3 text-[11px] text-gray-500">${dateStr}</td>
        <td class="p-3 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="openEditModal(event, '${item.id}')" class="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all" title="Chỉnh sửa tên và thông tin">
              <i class="fa-solid fa-pen-to-square"></i>
              <span>Sửa</span>
            </button>
            <button onclick="deleteFile(event, '${item.id}')" class="p-1 text-gray-500 hover:text-red-400 rounded-lg hover:bg-gray-800 transition-colors" title="Xóa">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
};

window.handleEditBannerFileSelected = async function(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const label = document.getElementById('editBannerFileName');
  if (label) label.textContent = `Đang tải: ${file.name}...`;

  try {
    const uploaded = await uploadFileToSupabase(file);
    const editBannerInput = document.getElementById('editBanner');
    if (editBannerInput) {
      editBannerInput.value = uploaded.url;
    }
    if (label) label.textContent = `Đã tải: ${file.name} ✅`;
    showToast(`Đã tải ảnh bìa lên Cloud thành công! Hãy bấm 'LƯU THAY ĐỔI' để cập nhật.`, 'success');
  } catch (err) {
    if (label) label.textContent = "Tải ảnh thất bại!";
    showToast("Lỗi tải ảnh: " + err.message, "error");
  }
};

window.openEditModal = function(e, id) {
  if (e && e.stopPropagation) e.stopPropagation();
  const item = state.resources.find(r => r.id === id);
  if (!item) return;

  const modal = document.getElementById('editResourceModal');
  if (!modal) return;

  document.getElementById('editItemId').value = item.id;
  document.getElementById('editTitle').value = item.title || '';
  document.getElementById('editCategory').value = item.category || 'gunsound';
  document.getElementById('editAuthor').value = item.author || 'Hải Anh';
  document.getElementById('editVersion').value = item.version || 'v1.0';
  document.getElementById('editSize').value = item.size || '';
  document.getElementById('editDirectUrl').value = item.directUrl || '';
  document.getElementById('editNote').value = item.desc || item.description || '';
  document.getElementById('editGuide').value = item.guide || '';

  const editBanner = document.getElementById('editBanner');
  if (editBanner) {
    editBanner.value = item.banner || (item.preview && (item.preview.banner || (item.preview.type === 'image' ? item.preview.url : ''))) || '';
  }
  const editBannerFileName = document.getElementById('editBannerFileName');
  if (editBannerFileName) {
    editBannerFileName.textContent = 'Tải ảnh bìa mới từ máy tính';
  }

  modal.classList.remove('hidden');
};

window.closeEditModal = function() {
  const modal = document.getElementById('editResourceModal');
  if (modal) modal.classList.add('hidden');
};

window.handleSaveEditResource = async function(e) {
  e.preventDefault();
  const id = document.getElementById('editItemId').value;
  const item = state.resources.find(r => r.id === id);
  if (!item) return;

  const title = document.getElementById('editTitle').value.trim();
  const category = document.getElementById('editCategory').value;
  const author = document.getElementById('editAuthor').value.trim() || 'Hải Anh';
  const version = document.getElementById('editVersion').value.trim() || 'v1.0';
  const size = document.getElementById('editSize').value.trim() || item.size;
  const directUrl = document.getElementById('editDirectUrl').value.trim();
  const bannerUrl = document.getElementById('editBanner') ? document.getElementById('editBanner').value.trim() : '';
  const note = document.getElementById('editNote').value.trim();
  const guide = document.getElementById('editGuide').value.trim();

  const saveBtn = document.getElementById('saveEditBtn');
  const oldText = saveBtn ? saveBtn.innerHTML : '';
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>ĐANG LƯU...</span>`;
  }

  // Update preview object
  const previewObj = item.preview ? { ...item.preview } : {};
  previewObj.author = author;
  if (bannerUrl) {
    previewObj.banner = bannerUrl;
    if (previewObj.type === 'image' || !previewObj.type) {
      previewObj.url = bannerUrl;
      previewObj.type = 'image';
    }
  }

  const patchPayload = {
    title: title,
    category: category,
    version: version,
    size: size,
    direct_url: directUrl,
    is_cloud_link: Boolean(directUrl),
    description: note,
    guide: guide,
    preview: previewObj
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/resources?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(patchPayload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn("Patch warning:", errText);
    }

    // Cập nhật state cục bộ
    item.title = title;
    item.category = category;
    item.author = author;
    item.version = version;
    item.size = size;
    item.directUrl = directUrl;
    item.isCloudLink = Boolean(directUrl);
    item.description = note;
    item.desc = note;
    item.guide = guide;
    if (bannerUrl) {
      item.banner = bannerUrl;
    }
    if (item.preview) {
      item.preview.author = author;
      if (bannerUrl) {
        item.preview.banner = bannerUrl;
        if (item.preview.type === 'image' || !item.preview.type) {
          item.preview.url = bannerUrl;
        }
      }
    }

    closeEditModal();
    renderGrid();
    updateCounters();
    renderAdminTable();

    showToast(`Đã sửa thông tin "${title}" thành công! 🔥`, 'success');
  } catch (err) {
    console.error("Lỗi cập nhật sản phẩm:", err);
    showToast("Lỗi khi lưu: " + (err.message || err), 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = oldText;
    }
  }
};

// Run
loadResources();
initSupabaseRealtime();
initAuth();
