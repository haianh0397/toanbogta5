// GTA V Resource Hub - Application Logic & Backend Integration

// Tự động nhận diện nếu mở trực tiếp bằng file:/// thì trỏ về http://localhost:3000
const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

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
    name: "Mã Nguồn & Script",
    icon: "fa-solid fa-code",
    color: "purple",
    badgeClass: "bg-purple-950/60 text-purple-400 border-purple-600/40",
    banner: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80"
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

// Fetch resources from Server API
async function loadResources() {
  try {
    const res = await fetch(API_BASE + "/api/files");
    if (res.ok) {
      const serverFiles = await res.json();
      state.isBackendConnected = true;

      // Merge server files with sample templates
      state.resources = [...serverFiles, ...SAMPLE_TEMPLATES];
    } else {
      throw new Error("Backend not responding");
    }
  } catch (e) {
    // Fallback to localStorage or sample templates
    const local = localStorage.getItem("gta_local_uploads");
    const uploadedList = local ? JSON.parse(local) : [];
    state.resources = [...uploadedList, ...SAMPLE_TEMPLATES];
    state.isBackendConnected = false;
  }

  updateCounters();
  renderGrid();
}

function updateCounters() {
  countAll.textContent = state.resources.length;
  countGun.textContent = state.resources.filter(r => r.category === "gunsound").length;
  countReshade.textContent = state.resources.filter(r => r.category === "reshade").length;
  countDump.textContent = state.resources.filter(r => r.category === "dump").length;
  countSource.textContent = state.resources.filter(r => r.category === "source").length;
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
    const bannerUrl = item.banner || cat.banner || "https://images.unsplash.com/photo-1595590424283-b8f17842773f?auto=format&fit=crop&w=800&q=80";

    const hasTwoFiles = (item.files && item.files.length > 1) || item.isMultiFile;

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

          ${item.preview ? `
            <div class="absolute inset-0 flex items-center justify-center z-10">
              <button onclick="openMediaModal(event, '${item.id}')" class="px-3.5 py-1.5 rounded-full bg-black/80 hover:bg-emerald-500 hover:text-black border border-emerald-500/50 text-emerald-300 text-xs font-bold transition-all flex items-center gap-2 shadow-2xl backdrop-blur-md group/btn">
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

          ${!item.isSample ? `
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

// Download real file(s)
window.downloadFile = function(event, id, mode = 'zip') {
  if (event) event.stopPropagation();
  const item = state.resources.find(r => r.id === id);
  if (!item) return;

  // Nếu là file lưu trên Google Drive hoặc link tải trực tiếp
  if (item.isCloudLink || item.directUrl) {
    const targetUrl = item.directUrl || item.rawDriveUrl;
    window.open(targetUrl, '_blank');
    item.downloads = (item.downloads || 0) + 1;
    showToast(`Đang tải file từ Google Drive! ⚡`);
    renderGrid();
    return;
  }

  const hasMultiple = item.files && item.files.length > 1;

  if (hasMultiple && mode === 'zip') {
    // Mode 1: Tải trọn gói gộp cả 2 file thành 1 file .ZIP (Không bao giờ bị Chrome chặn, 100% mượt mà)
    window.location.href = `${API_BASE}/api/download-zip/${item.id}`;
    item.downloads = (item.downloads || 0) + 1;
    showToast(`Đang tải trọn gói ZIP (gộp cả 2 file: ${item.files[0].originalName} & ${item.files[1].originalName})! 📦`);
    renderGrid();
  } else if (hasMultiple) {
    // Mode 2: Tải rời 2 file
    showToast(`Đang tải 2 file rời. Lưu ý: Bấm [Allow] trên góc trái Chrome nếu có hỏi nhé!`);
    item.files.forEach((f, idx) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = `${API_BASE}/api/download-file/${f.filename}/${encodeURIComponent(f.originalName)}`;
        a.download = f.originalName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, idx * 1000);
    });
    item.downloads = (item.downloads || 0) + 1;
    renderGrid();
  } else if (item.filename) {
    // Single file download
    window.location.href = `${API_BASE}/api/download/${item.id}`;
    item.downloads = (item.downloads || 0) + 1;
    showToast(`Đang tải file: ${item.originalName || item.title}! 🚀`);
    renderGrid();
  }
};

// Download single sub-file
window.downloadSingleSubFile = function(event, filename, originalName) {
  if (event) event.stopPropagation();
  const a = document.createElement("a");
  a.href = `${API_BASE}/api/download-file/${filename}/${encodeURIComponent(originalName)}`;
  a.download = originalName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast(`Đang tải riêng file: ${originalName}!`);
};

// Delete real file
window.deleteFile = async function(event, id) {
  if (event) event.stopPropagation();
  if (!confirm("Bạn có chắc chắn muốn xóa file này khỏi hệ thống lưu trữ?")) return;

  try {
    const res = await fetch(`${API_BASE}/api/files/${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Đã xóa file thành công!");
    }
  } catch (e) {
    // Delete from local
    const local = localStorage.getItem("gta_local_uploads");
    if (local) {
      let list = JSON.parse(local);
      list = list.filter(f => f.id !== id);
      localStorage.setItem("gta_local_uploads", JSON.stringify(list));
    }
  }

  loadResources();
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
  modalAuthor.textContent = item.author || "Bạn (Tải lên từ máy nhà)";
  modalDesc.textContent = item.desc || item.description || "Không có mô tả.";
  modalInstallGuide.textContent = item.guide || "Giải nén file và copy vào thư mục GTA 5 hoặc FiveM.";

  // Media preview inside Detail Modal
  if (item.preview) {
    modalBannerImg.classList.add("hidden");
    modalMediaContainer.classList.remove("hidden");
    modalMediaContainer.innerHTML = "";

    if (item.preview.type === "video") {
      modalMediaContainer.innerHTML = `
        <video controls autoplay class="w-full h-full max-h-[280px] rounded-xl bg-black">
          <source src="${API_BASE}${item.preview.url}">
        </video>
      `;
    } else if (item.preview.type === "audio") {
      modalMediaContainer.innerHTML = `
        <div class="w-full p-6 text-center bg-gradient-to-r from-emerald-950/60 to-cyan-950/60 rounded-xl border border-emerald-500/30">
          <i class="fa-solid fa-volume-high text-3xl text-emerald-400 mb-2 block"></i>
          <h4 class="text-xs font-semibold text-white mb-2">Đang phát âm thanh nghe thử:</h4>
          <audio controls autoplay class="w-full max-w-md mx-auto">
            <source src="${API_BASE}${item.preview.url}">
          </audio>
        </div>
      `;
    } else if (item.preview.type === "youtube") {
      modalMediaContainer.innerHTML = `
        <iframe class="w-full h-[280px] rounded-xl border-0" src="${item.preview.url}?autoplay=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      `;
    } else {
      modalMediaContainer.innerHTML = `<img src="${API_BASE}${item.preview.url}" class="w-full h-full object-cover">`;
    }
  } else {
    modalMediaContainer.classList.add("hidden");
    modalMediaContainer.innerHTML = "";
    modalBannerImg.classList.remove("hidden");
    modalBannerImg.src = item.banner || cat.banner;
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
        <source src="${API_BASE}${item.preview.url}">
      </video>
    `;
  } else if (item.preview.type === "audio") {
    mediaModalBody.innerHTML = `
      <div class="p-8 text-center bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-md shadow-2xl">
        <i class="fa-solid fa-volume-high text-4xl text-amber-400 mb-4 block animate-bounce"></i>
        <h4 class="text-sm font-bold text-white mb-3">Đang phát mẫu tiếng súng</h4>
        <audio controls autoplay class="w-full">
          <source src="${API_BASE}${item.preview.url}">
        </audio>
      </div>
    `;
  } else if (item.preview.type === "youtube") {
    mediaModalBody.innerHTML = `
      <iframe class="w-full h-[65vh] rounded-xl border-0" src="${item.preview.url}?autoplay=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
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

// File upload selection label update
upFile.addEventListener("change", () => {
  if (upFile.files && upFile.files[0]) {
    const f = upFile.files[0];
    selectedFileName.textContent = `File 1: ${f.name} (${(f.size / (1024 * 1024)).toFixed(2)} MB)`;
    if (!upTitle.value) {
      upTitle.value = f.name.replace(/\.[^/.]+$/, "");
    }
  }
});

upFile2.addEventListener("change", () => {
  if (upFile2.files && upFile2.files[0]) {
    const f = upFile2.files[0];
    selectedFileName2.textContent = `File 2: ${f.name} (${(f.size / (1024 * 1024)).toFixed(2)} MB)`;
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
    selectedFileName.textContent = "Chọn File Mã Nguồn / Script FiveM (ví dụ: .lua / .cs / .bat / .zip)";
  } else {
    file2Container.classList.remove("hidden");
    selectedFileName.textContent = "Chọn File Mod chính từ máy";
  }
}

// Category change reaction
upCategory.addEventListener("change", () => {
  updateCategoryFormUI(upCategory.value);
});

// Real File Upload with Progress Bar
uploadForm.addEventListener("submit", (e) => {
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

  const formData = new FormData();

  if (isDriveMode) {
    formData.append("directUrl", upDirectUrl.value.trim());
    formData.append("directSize", upDirectSize.value.trim() || "6.6 GB");
    formData.append("directFormat", upDirectFormat.value.trim() || ".rar");
  } else {
    const file1 = upFile.files[0];
    const file2 = upFile2.files && upFile2.files[0] ? upFile2.files[0] : null;
    formData.append("files", file1);
    if (file2) {
      formData.append("files", file2);
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

  formData.append("category", upCategory.value);
  formData.append("title", finalTitle);
  formData.append("version", upVersion.value.trim() || "v1.0");
  formData.append("description", upNote.value.trim() || (isDriveMode ? "File mod GTA 5 dung lượng lớn được lưu trên Google Drive để tải mượt mà 24/7." : "File mod GTA 5 tải lên từ máy nhà."));
  formData.append("guide", upGuide.value.trim() || "Giải nén file và dán vào thư mục GTA 5 hoặc FiveM.");

  // Append Preview (Video / Audio / Image file or YouTube link)
  if (upPreviewFile.files && upPreviewFile.files[0]) {
    formData.append("preview", upPreviewFile.files[0]);
  }
  if (upYoutubeUrl.value.trim()) {
    formData.append("youtubeUrl", upYoutubeUrl.value.trim());
  }

  uploadProgressContainer.classList.remove("hidden");
  submitUploadBtn.disabled = true;

  const xhr = new XMLHttpRequest();
  xhr.open("POST", API_BASE + "/api/upload", true);

  xhr.upload.onprogress = function(e) {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      uploadProgressBar.style.width = percent + "%";
      uploadPercent.textContent = percent + "%";
    }
  };

  xhr.onload = function() {
    uploadProgressContainer.classList.add("hidden");
    submitUploadBtn.disabled = false;
    uploadProgressBar.style.width = "0%";

    if (xhr.status === 200) {
      let createdItem = null;
      try {
        const resp = JSON.parse(xhr.responseText);
        if (resp && resp.item) {
          createdItem = resp.item;
        }
      } catch (err) {
        console.error("Parse response error", err);
      }

      // 1. Tự động đóng ngay lập tức bảng popup tải file (mất bảng upfile đó)
      closeUpload();

      // 2. Đưa file mới lên web ngay lập tức mà KHÔNG CẦN LOAD LẠI WEB
      if (createdItem) {
        // Lọc tránh trùng
        state.resources = state.resources.filter(r => r.id !== createdItem.id);
        state.resources.unshift(createdItem);

        // Tự động chuyển sang đúng Tab của file vừa tải nếu đang ở mục khác (trừ khi đang ở Tất Cả)
        if (state.activeCategory !== 'all' && state.activeCategory !== createdItem.category) {
          state.activeCategory = createdItem.category;
          document.querySelectorAll(".cat-pill").forEach(p => {
            const isMatch = p.dataset.cat === createdItem.category;
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
      } else {
        loadResources();
      }

      // 3. Hiện HUD Thông Báo Tải Lên Thành Công phong cách GTA 5 siêu xịn
      const itemTitle = createdItem ? createdItem.title : (finalTitle || "Tài nguyên mới");
      showSuccessHUD("TẢI LÊN THÀNH CÔNG! 🔥", `"${itemTitle}" đã hiển thị sẵn sàng tải về.`);
    } else {
      showToast("Lỗi khi tải file lên server. Hãy kiểm tra kết nối!", "warning");
    }
  };

  xhr.onerror = function() {
    uploadProgressContainer.classList.add("hidden");
    submitUploadBtn.disabled = false;
    showToast("Không kết nối được server backend. Hãy kiểm tra 'node server.js'!", "warning");
  };

  xhr.send(formData);
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

// Run
loadResources();
