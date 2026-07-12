/* ============================================
   あつまれみんなの正直レビュー — review.js
   v5: 南国の売店ドリンクレビュー（あつ森風パステルデザイン）
   ============================================ */

// ============================================
// ★ GAS (Google Apps Script) ウェブアプリURL ★
// ============================================
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbzFu62TvzIMpsL-NZm8Fw5Mz7P0yxyxh7R57xLQnbMTPolqFXhakqoS6UPk8IuHWv9Zrw/exec";

// ============================================
// ★ 商品データ ★
// ============================================
const PRODUCTS = [
  {
    id:    'product-a',
    label: '商品A',
    name:  'クラフトボス フルーツティーエード ピーチ&マンゴー',
    sub:   'もも・りんご・マンゴーの果汁入り、爽やかな甘さのフルーツティー',
    emoji: '🍑',
    image: 'product_peachmango.png',
    color: '#FF7B8A',    // アクセント（花）
    theme: 'pink',
    tag:   '🛍️ 売店の定番',
  },
  {
    id:    'product-b',
    label: '商品B',
    name:  '好烏龍 パイン&ライチティーエード',
    sub:   'ウーロン茶ベース、パイナップル&ライチの香る果汁12%',
    emoji: '🍍',
    image: 'product_pinelychee.jpg',
    color: '#F2A649',    // アクセント（南国オレンジ）
    theme: 'orange',
    tag:   '🛍️ 南国気分',
  },
];

// ============================================
// 画面切り替え
// ============================================
const selectScreen = document.getElementById('product-select-screen');
const reviewScreen = document.getElementById('review-screen');
const headerNav    = document.getElementById('header-nav');

let activeProduct = null; // 現在選択中の商品オブジェクト

function showSelectScreen() {
  selectScreen.style.display = 'block';
  reviewScreen.style.display = 'none';
  headerNav.style.display    = 'none';
  activeProduct = null;
  
  // 選択画面に戻ったときに件数を最新にするため、グリッドを再描画
  renderProductGrid();
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function showReviewScreen(product) {
  activeProduct = product;
  selectScreen.style.display = 'none';
  reviewScreen.style.display = 'block';
  headerNav.style.display    = 'flex';

  // 商品情報をバナーとヘッダーに反映
  const bannerBadge = document.getElementById('active-product-badge');
  if (bannerBadge) {
    bannerBadge.textContent = product.label;
    bannerBadge.className = `product-label label-${product.theme}`;
  }
  
  document.getElementById('product-name-display').textContent = product.name;
  
  // ヘッダータイトルの更新
  document.getElementById('review-hero-title').innerHTML =
    `あつまれ<span class="title-colorful"><span class="c-mi">み</span><span class="c-n">ん</span><span class="c-na">な</span><span class="c-no">の</span></span>正直レビュー<br><small style="font-size:0.5em;color:var(--text-sub)">${product.label}: ${escapeHtml(product.name)}</small>`;
  
  document.getElementById('reviews-section-title').textContent =
    `「${product.name}」のレビュー`;

  // フォームをリセット
  resetForm();

  // レビューを読み込んで表示
  await renderReviews('all');
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-filter="all"]').classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================
// 商品選択グリッドを生成 (レイアウト：写真 ➔ 商品名 ➔ 人気度(件数)の順)
// ============================================
function renderProductGrid() {
  const grid = document.getElementById('product-grid');
  if (!grid) return;
  grid.innerHTML = ''; // 初期化

  PRODUCTS.forEach((product, i) => {
    const card = document.createElement('button');
    card.className = `product-card card-${product.theme}`;
    card.style.animationDelay = `${i * 0.08}s`;
    card.setAttribute('aria-label', `${product.name}のレビューページへ`);
    card.id = `product-card-${product.id}`;

    // キャッシュまたはローカルストレージから件数を取得
    const count = getReviewCountFor(product.id);

    // 画像デザイン再現（写真 ➔ 商品名 ➔ 人気度/件数）
    card.innerHTML = `
      <div class="product-card-image-wrap">
        <img src="${product.image}" alt="${escapeHtml(product.name)}" class="product-card-img" />
        <div class="product-ribbon ribbon-${product.theme}">${product.label}</div>
      </div>
      <div class="product-card-body">
        <div class="product-card-tag tag-${product.theme}">${product.tag}</div>
        <div class="product-card-name">${escapeHtml(product.name)}</div>
        <div class="product-card-sub">${escapeHtml(product.sub)}</div>
        <div class="product-card-count">
          <span class="count-icon">💬</span>
          <span>${count > 0 ? `${count}件のレビュー` : 'まだレビューなし・一番乗りしよう！'}</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => showReviewScreen(product));
    grid.appendChild(card);
  });
}

// ============================================
// ヘッダーロゴ・「商品を選び直す」ボタン
// ============================================
document.getElementById('header-logo-btn')?.addEventListener('click', showSelectScreen);
document.getElementById('back-to-select-btn')?.addEventListener('click', showSelectScreen);
document.getElementById('product-change-btn')?.addEventListener('click', showSelectScreen);


// ============================================
// API連携 & データ管理ロジック
// ============================================

// グローバルキャッシュ
let cachedReviews = null;

/**
 * 全口コミデータをロードする
 */
async function fetchAllReviews() {
  if (cachedReviews !== null) {
    return cachedReviews;
  }

  if (!GAS_API_URL) {
    cachedReviews = loadAllFromLocalStorage();
    return cachedReviews;
  }

  try {
    const res = await fetch(GAS_API_URL + "?t=" + Date.now(), { 
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error("ネットワークエラー");
    
    const data = await res.json();
    if (Array.isArray(data)) {
      cachedReviews = data;
      localStorage.setItem('gas_reviews_backup', JSON.stringify(data));
      return data;
    } else {
      throw new Error("データ形式エラー");
    }
  } catch (error) {
    console.warn("GASからのデータ読み込みに失敗しました。ローカルバックアップを使用します:", error);
    const backup = localStorage.getItem('gas_reviews_backup');
    if (backup) {
      try {
        cachedReviews = JSON.parse(backup);
        return cachedReviews;
      } catch(e) {}
    }
    cachedReviews = loadAllFromLocalStorage();
    return cachedReviews;
  }
}

/**
 * 特定の商品の口コミを取得する
 */
async function loadReviewsFor(productId) {
  const all = await fetchAllReviews();
  return all.filter(r => r.productId === productId);
}

/**
 * レビュー件数を取得
 */
function getReviewCountFor(productId) {
  if (cachedReviews === null) {
    const raw = localStorage.getItem(`reviews_${productId}`);
    return raw ? JSON.parse(raw).length : 0;
  }
  return cachedReviews.filter(r => r.productId === productId).length;
}

/**
 * 新しい口コミを追加する
 */
async function addReview(reviewData) {
  if (cachedReviews === null) {
    cachedReviews = [];
  }
  cachedReviews.unshift(reviewData);

  const localKey = `reviews_${reviewData.productId}`;
  const localReviews = loadLocalReviewsFor(reviewData.productId);
  localReviews.unshift(reviewData);
  localStorage.setItem(localKey, JSON.stringify(localReviews));

  if (!GAS_API_URL) {
    return true;
  }

  try {
    await fetch(GAS_API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reviewData)
    });
    return true;
  } catch (error) {
    console.error("GASへの送信に失敗しました（ローカルのみ保存）:", error);
    return false;
  }
}

/**
 * ローカルストレージから特定の商品のレビューを読み込む
 */
function loadLocalReviewsFor(productId) {
  try {
    const raw = localStorage.getItem(`reviews_${productId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * ローカルストレージからすべてのレビューを読み込む
 */
function loadAllFromLocalStorage() {
  let all = [];
  PRODUCTS.forEach(p => {
    const key = `reviews_${p.id}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        all = all.concat(JSON.parse(raw));
      } catch(e){}
    }
  });

  if (all.length === 0) {
    all = getDummyReviews();
    PRODUCTS.forEach(p => {
      const filtered = all.filter(d => d.productId === p.id);
      if (filtered.length > 0) {
        localStorage.setItem(`reviews_${p.id}`, JSON.stringify(filtered));
      }
    });
  }
  return all;
}

/**
 * 初期デモデータ (南国モチーフに変更)
 */
function getDummyReviews() {
  return [
    {
      id: 'dummy-1',
      productId: 'product-a',
      feeling: 'like',
      text: '思ったより甘さ控えめで飲みやすかったです！マンゴーの香りがしっかりして、休み時間にゴクゴク飲むのにぴったりでした🍑',
      nickname: 'お茶大2年生🌸',
      date: '2026-07-01'
    },
    {
      id: 'dummy-2',
      productId: 'product-a',
      feeling: 'neutral',
      text: '味は美味しいけど、甘さがちょっと強めかも。がっつり甘いのが好きな人には最高だと思う！',
      nickname: '甘党な1年生',
      date: '2026-06-30'
    },
    {
      id: 'dummy-3',
      productId: 'product-b',
      feeling: 'like',
      text: 'ウーロン茶のさっぱり感とライチの甘さのバランスが絶妙！南国気分になれる夏にぴったりの一本だと思います。',
      nickname: 'お茶好き',
      date: '2026-06-29'
    },
    {
      id: 'dummy-4',
      productId: 'product-b',
      feeling: 'dislike',
      text: '私にはパインの香りがちょっと強く感じました。フルーティーな香りが好きな人や、気分転換したいときにぴったり！',
      nickname: 'さっぱり党',
      date: '2026-06-28'
    }
  ];
}

// ============================================
// レビューカード生成 (🍍 好き、🥥 普通、🌿 苦手)
// ============================================
function getFeelingInfo(feeling) {
  const map = {
    like:    { emoji: '🍍', label: '🍍 好き！',   cls: 'like' },
    neutral: { emoji: '🥥', label: '🥥 普通',     cls: 'neutral' },
    dislike: { emoji: '🌿', label: '🌿 苦手かも', cls: 'dislike' },
  };
  return map[feeling] || map.neutral;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function createReviewCard(review, index) {
  const info = getFeelingInfo(review.feeling);
  const card = document.createElement('div');
  card.className = `review-card ${info.cls}`;
  card.style.animationDelay = `${index * 0.06}s`;
  card.dataset.feeling = review.feeling;

  card.innerHTML = `
    <div class="review-card-header">
      <div class="review-avatar">${info.emoji}</div>
      <div class="review-meta">
        <div class="review-name">${escapeHtml(review.nickname || '匿名さん')}</div>
        <div class="review-date">${formatDate(review.date)}</div>
      </div>
      <span class="review-badge">${info.label}</span>
    </div>
    <p class="review-text">${escapeHtml(review.text)}</p>
  `;
  return card;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================
// レビュー一覧表示
// ============================================
let currentFilter = 'all';

async function renderReviews(filter = 'all') {
  if (!activeProduct) return;
  currentFilter = filter;

  const grid       = document.getElementById('reviews-grid');
  const emptyState = document.getElementById('empty-state');
  const loading    = document.getElementById('reviews-loading');

  if (loading) loading.style.display = 'block';
  grid.style.display = 'none';
  emptyState.style.display = 'none';

  const reviews  = await loadReviewsFor(activeProduct.id);
  const filtered = filter === 'all' ? reviews : reviews.filter(r => r.feeling === filter);

  if (loading) loading.style.display = 'none';

  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.style.display   = 'none';
    emptyState.style.display = 'block';
  } else {
    grid.style.display       = 'grid';
    emptyState.style.display = 'none';
    filtered.forEach((r, i) => grid.appendChild(createReviewCard(r, i)));
  }

  updateStats(reviews);
}

function updateStats(reviews) {
  const total   = reviews.length;
  const likes   = reviews.filter(r => r.feeling === 'like').length;
  const neutral = reviews.filter(r => r.feeling === 'neutral').length;
  const dislike = reviews.filter(r => r.feeling === 'dislike').length;
  const pct     = n => total ? Math.round(n / total * 100) + '%' : '—';

  document.getElementById('stat-total').textContent   = total;
  document.getElementById('stat-like').textContent    = pct(likes);
  document.getElementById('stat-neutral').textContent = pct(neutral);
  document.getElementById('stat-dislike').textContent = pct(dislike);
}

// ============================================
// フィルターボタン
// ============================================
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderReviews(btn.dataset.filter);
  });
});

// ============================================
// フォーム処理
// ============================================
const form          = document.getElementById('review-form');
const successMsg    = document.getElementById('success-msg');
const textarea      = document.getElementById('review-text');
const charCount     = document.getElementById('char-count');
const submitBtn     = document.getElementById('submit-btn');
const submitBtnText = document.getElementById('submit-btn-text');

textarea?.addEventListener('input', () => {
  charCount.textContent = textarea.value.length;
  document.getElementById('text-error').style.display = 'none';
});

document.querySelectorAll('input[name="feeling"]').forEach(r => {
  r.addEventListener('change', () => {
    document.getElementById('feeling-error').style.display = 'none';
  });
});

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  let valid = true;

  const feeling = document.querySelector('input[name="feeling"]:checked')?.value;
  if (!feeling) {
    document.getElementById('feeling-error').style.display = 'flex';
    valid = false;
  }

  const text = textarea.value.trim();
  if (text.length < 10) {
    document.getElementById('text-error').style.display = 'flex';
    valid = false;
  }

  if (!valid) {
    form.querySelector('.field-error[style*="flex"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (submitBtn) submitBtn.disabled = true;
  if (submitBtnText) submitBtnText.textContent = "送信中...🌸";

  const nickname = document.getElementById('nickname').value.trim();
  const today    = new Date().toISOString().split('T')[0];

  const success = await addReview({
    id:        `review-${Date.now()}`,
    productId: activeProduct.id,
    feeling,
    text,
    nickname:  nickname || '匿名さん',
    date:      today
  });

  if (submitBtn) submitBtn.disabled = false;
  if (submitBtnText) submitBtnText.textContent = "投稿する！";

  form.style.display        = 'none';
  successMsg.style.display  = 'block';
  successMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // 口コミ投稿完了の2秒後にフィードバックエリアを表示
  const feedbackArea = document.getElementById('feedback-area');
  const feedbackSuccess = document.getElementById('feedback-success-msg');
  if (feedbackArea) {
    feedbackArea.style.display = 'none';
    feedbackArea.style.opacity = '0';
  }
  if (feedbackSuccess) {
    feedbackSuccess.style.display = 'none';
  }

  setTimeout(() => {
    if (feedbackArea && successMsg.style.display !== 'none') {
      feedbackArea.style.display = 'block';
      setTimeout(() => {
        feedbackArea.style.opacity = '1';
      }, 50);
    }
  }, 2000);

  await renderReviews('all');
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-filter="all"]').classList.add('active');
});

// フィードバックの送信処理
document.getElementById('submit-feedback-btn')?.addEventListener('click', async () => {
  const fTextarea = document.getElementById('feedback-text');
  const fText = fTextarea ? fTextarea.value.trim() : '';
  if (!fText) return;

  const fSubmitBtn = document.getElementById('submit-feedback-btn');
  if (fSubmitBtn) {
    fSubmitBtn.disabled = true;
    fSubmitBtn.innerHTML = '<span>送信中...</span>';
  }

  // GASやLocalStorageへ送信 (productId: 'feedback')
  await addReview({
    id:        `feedback-${Date.now()}`,
    productId: 'feedback',
    feeling:   'neutral',
    text:      fText,
    nickname:  'フィードバック送信者',
    date:      new Date().toISOString().split('T')[0]
  });

  const feedbackArea = document.getElementById('feedback-area');
  const feedbackSuccess = document.getElementById('feedback-success-msg');

  if (feedbackArea) {
    feedbackArea.style.display = 'none';
  }
  if (feedbackSuccess) {
    feedbackSuccess.style.display = 'block';
  }

  if (fTextarea) fTextarea.value = '';
  if (fSubmitBtn) {
    fSubmitBtn.disabled = false;
    fSubmitBtn.innerHTML = '<span>✉️ 感想を送信する</span>';
  }
});

function resetForm() {
  form?.reset();
  if (charCount) charCount.textContent = '0';
  if (form) form.style.display = 'flex';
  if (successMsg) successMsg.style.display = 'none';
  document.getElementById('feeling-error').style.display = 'none';
  document.getElementById('text-error').style.display    = 'none';
  if (submitBtnText) submitBtnText.textContent = "投稿する！";
  if (submitBtn) submitBtn.disabled = false;

  // フィードバック表示の初期化
  const feedbackArea = document.getElementById('feedback-area');
  const feedbackSuccess = document.getElementById('feedback-success-msg');
  if (feedbackArea) {
    feedbackArea.style.display = 'none';
    feedbackArea.style.opacity = '0';
  }
  if (feedbackSuccess) {
    feedbackSuccess.style.display = 'none';
  }
  const fTextarea = document.getElementById('feedback-text');
  if (fTextarea) fTextarea.value = '';
}

document.getElementById('view-reviews-btn')?.addEventListener('click', () => {
  document.getElementById('reviews-section').scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('write-another-btn')?.addEventListener('click', () => {
  resetForm();
  form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ============================================
// ヘッダースクロール
// ============================================
window.addEventListener('scroll', () => {
  const header = document.getElementById('site-header');
  header?.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

// ============================================
// 初期化処理
// ============================================
async function init() {
  await fetchAllReviews();

  const urlParams  = new URLSearchParams(window.location.search);
  const paramId    = urlParams.get('product');

  if (paramId) {
    const found = PRODUCTS.find(p => p.id === paramId);
    if (found) {
      await showReviewScreen(found);
    } else {
      showSelectScreen();
    }
  } else {
    showSelectScreen();
  }

  renderProductGrid();
}

init();
