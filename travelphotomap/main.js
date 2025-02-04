/****************************************************************
定数・データ・初期設定
****************************************************************/
const storageKey = 'travelPhotos';
const MERGE_THRESHOLD = 0.1; // MERGE_THRESHOLD：写真の座標差（度）がこの値以内なら同じグループとする
let clusterData = JSON.parse(localStorage.getItem(storageKey)) || [];
let selectedFiles = [];
let groupCount = 0; // 逆ジオコーディングで取得できなかった場合のグループ名用カウンタ
let currentGroupPhotos = []; // グループ内の写真表示用グローバル変数
let currentPhotoIndex = 0;
let currentGroupName = '';

// ダークモードボタン
const darkModeBtn = document.getElementById('darkModeBtn');
darkModeBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark');
});

// モーダル処理
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');
modalClose.addEventListener('click', () => {
  modal.style.display = 'none';
  modalBody.innerHTML = '';
});
function openModal(imgUrl) {
  modalBody.innerHTML = `<img src="${imgUrl}" />`;
  modal.style.display = 'flex';
}

const progressEl = document.getElementById('progress');

/********************
Leaflet初期化
********************/
const map = L.map('map').setView([39.6800, 139.6800], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
// マーカーとクラスタ範囲（円）をまとめるレイヤーグループ
const markersLayer = L.layerGroup().addTo(map);

/********************
ユーティリティ関数
********************/
// クラスターデータの保存
function saveClusters() {
  localStorage.setItem(storageKey, JSON.stringify(clusterData));
}
// 指定した閾値以内で既存クラスタを検索
function findNearbyCluster(lat, lng, threshold = MERGE_THRESHOLD) {
  return clusterData.find(cluster => {
    return Math.abs(cluster.lat - lat) < threshold && Math.abs(cluster.lng - lng) < threshold;
  });
}
// クラスタ内の全写真の座標から中心を再計算する
function updateClusterCenter(cluster) {
  let sumLat = 0, sumLng = 0;
  cluster.photos.forEach(photo => {
    sumLat += photo.lat;
    sumLng += photo.lng;
  });
  cluster.lat = sumLat / cluster.photos.length;
  cluster.lng = sumLng / cluster.photos.length;
}
// 逆ジオコーディング
async function getCityName(lat, lng) {
  let city = await getCityNameNominatim(lat, lng);
  if (city === '不明な地域') {
    city = await getCityNameBigDataCloud(lat, lng);
  }
  if (city === '不明な地域') {
    groupCount++;
    city = `グループ${groupCount}`;
  }
  return city;
}
async function getCityNameNominatim(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`;
  try {
    const res = await axios.get(url);
    const addr = res.data.address;
    if (!addr) return '不明な地域';
    return addr.city || addr.town || addr.village || '不明な地域';
  } catch (err) {
    console.error('Nominatim:失敗:', err);
    return '不明な地域';
  }
}
async function getCityNameBigDataCloud(lat, lng) {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=ja`;
  try {
    const res = await axios.get(url);
    if (res.data) {
      if (res.data.city) return res.data.city;
      else if (res.data.locality) return res.data.locality;
    }
    return '不明な地域';
  } catch(err) {
    console.error('BigDataCloud:失敗:', err);
    return '不明な地域';
  }
}
/*
写真登録時は、まず新規写真の座標と既存クラスタ中心との差をチェックし、近ければそのグループに追加（中心は再計算）
近いグループがなければ、逆ジオコーディングで取得した都市名（またはグループX）を付与して新規クラスタを作成。
*/
async function addPhotoToCluster(lat, lng, imageUrl, filePath, date) {
  let cluster = findNearbyCluster(lat, lng, MERGE_THRESHOLD);
  if (cluster) {
    cluster.photos.push({ imageUrl, filePath, lat, lng, date });
    updateClusterCenter(cluster);
  } else {
    const cityName = await getCityName(lat, lng);
    cluster = {
      lat,
      lng,
      cityName,
      comment: '',
      photos: [{ imageUrl, filePath, lat, lng, date }]
    };
    clusterData.push(cluster);
  }
  saveClusters();
}

/********************
表示系
********************/
// 地図上に、各写真ごとにマーカーを追加し、クラスタ全体の範囲（円）も描画
function renderMarkers() {
  markersLayer.clearLayers();
  clusterData.forEach(cluster => {
    // 各写真ごとに個別マーカー
    cluster.photos.forEach(photo => {
      const marker = L.marker([photo.lat, photo.lng]);
      marker.bindPopup(
        `<img src="${photo.imageUrl}" style="max-width:100px;cursor:pointer;" onclick="openModal('${photo.imageUrl}')"><br>` +
        `<small>${photo.date}</small><br><small>${photo.filePath}</small>`
      );
      markersLayer.addLayer(marker);
    });
    // クラスタ全体の範囲を示す円（各写真との最大距離、50m~）
    let maxDistance = 50;
    cluster.photos.forEach(photo => {
      const d = L.latLng(cluster.lat, cluster.lng).distanceTo(L.latLng(photo.lat, photo.lng));
      if (d > maxDistance) maxDistance = d;
    });
    const circle = L.circle([cluster.lat, cluster.lng], {
      radius: maxDistance,
      color: 'blue',
      fillColor: '#aaddff',
      fillOpacity: 0.3,
      weight: 1,
    });
    markersLayer.addLayer(circle);
  });
}

// サイドパネルのグループ一覧
function renderList() {
  const list = document.getElementById('locationList');
  list.innerHTML = '<h3>地点一覧</h3>';
  const groups = {};
  clusterData.forEach(cluster => {
    if (!groups[cluster.cityName]) {
      groups[cluster.cityName] = { clusters: [], totalPhotos: 0 };
    }
    groups[cluster.cityName].clusters.push(cluster);
    groups[cluster.cityName].totalPhotos += cluster.photos.length;
  });
  for (let cityName in groups) {
    const group = groups[cityName];
    const groupDiv = document.createElement('div');
    groupDiv.className = 'group-item';
    groupDiv.innerText = `${cityName} (${group.totalPhotos}枚)`;
    const btnContainer = document.createElement('span');
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-comment-btn';
    editBtn.innerText = 'コメント編集';
    editBtn.onclick = (e) => { e.stopPropagation(); editCityComment(cityName); };
    btnContainer.appendChild(editBtn);
    if (/^グループ\d+$/.test(cityName)) {
      const renameBtn = document.createElement('button');
      renameBtn.className = 'edit-comment-btn';
      renameBtn.innerText = 'グループ名変更';
      renameBtn.onclick = (e) => { e.stopPropagation(); renameGroup(cityName); };
      btnContainer.appendChild(renameBtn);
    }
    groupDiv.appendChild(btnContainer);
    // クリック時、グループに属するクラスタの平均座標に地図を移動し、詳細表示を行う
    groupDiv.onclick = () => {
      let sumLat = 0, sumLng = 0;
      group.clusters.forEach(cluster => {
        sumLat += cluster.lat;
        sumLng += cluster.lng;
      });
      const avgLat = sumLat / group.clusters.length;
      const avgLng = sumLng / group.clusters.length;
      map.setView([avgLat, avgLng], 14);
      showGroupDetail(cityName);
    };
    list.appendChild(groupDiv);
  }
}

// コメント編集（グループ全体）
function editCityComment(cityName) {
  const newComment = prompt('コメントを入力してください');
  if (newComment !== null) {
    clusterData.forEach(c => { if (c.cityName === cityName) c.comment = newComment; });
    saveClusters();
    renderMarkers();
    renderList();
  }
}
// グループ名変更（自動生成グループの場合のみ）
function renameGroup(oldName) {
  const newName = prompt("新しいグループ名を入力してください", oldName);
  if (newName && newName !== oldName) {
    clusterData.forEach(cluster => { if (cluster.cityName === oldName) cluster.cityName = newName; });
    saveClusters();
    renderMarkers();
    renderList();
  }
}

// グループに属する全クラスタの写真を1つの配列にまとめ、前後移動ボタンとキーボード矢印キーで切り替え
function showGroupDetail(cityName) {
  let photos = [];
  clusterData.forEach(cluster => {
    if (cluster.cityName === cityName) {
      photos = photos.concat(cluster.photos);
    }
  });
  if (photos.length === 0) {
    document.getElementById('photoDetail').innerHTML = '<p>写真がありません</p>';
    return;
  }
  currentGroupPhotos = photos;
  currentPhotoIndex = 0;
  currentGroupName = cityName;
  updatePhotoDisplay();
}
// 写真表示エリアを更新する関数（ボタンの位置は固定）
function updatePhotoDisplay() {
  const photo = currentGroupPhotos[currentPhotoIndex];
  const detail = document.getElementById('photoDetail');
  detail.innerHTML = `
    <div class="photo-display-container" style="width: 100%; background: #fff; text-align: center; display: flex; flex-direction: column; align-items: center;">
      <!-- 写真表示エリア（最大幅600px） -->
      <div style="position: relative; width: 100%; max-width: 600px;">
        <img id="displayed-photo" src="${photo.imageUrl}" style="width: 100%; height: auto; cursor:pointer;" onclick="openModal('${photo.imageUrl}')" />
        <!-- ナビゲーションボタン（固定位置） -->
        <div class="nav-button nav-prev" style="position: absolute; top: 50%; left: 10px; transform: translateY(-50%);">
          <button id="prevBtn" style="font-size: 18px; padding: 8px;">&lt;</button>
        </div>
        <div class="nav-button nav-next" style="position: absolute; top: 50%; right: 10px; transform: translateY(-50%);">
          <button id="nextBtn" style="font-size: 18px; padding: 8px;">&gt;</button>
        </div>
      </div>
      <!-- EXIF情報表示（写真の直下に配置） -->
      <div style="width: 100%; max-width: 600px; text-align: left; margin-top: 5px;">
        <h4>${currentGroupName} (${currentPhotoIndex+1}/${currentGroupPhotos.length})</h4>
        <p style="margin: 0; line-height: 1.4;">
          <strong>座標:</strong> (${photo.lat.toFixed(4)}, ${photo.lng.toFixed(4)})<br>
          <strong>撮影日時:</strong> ${photo.date}<br>
          <strong>ファイルパス:</strong> ${photo.filePath}
        </p>
      </div>
    </div>
  `;
  document.getElementById('prevBtn').onclick = () => {
    if (currentPhotoIndex > 0) { currentPhotoIndex--; updatePhotoDisplay(); }
  };
  document.getElementById('nextBtn').onclick = () => {
    if (currentPhotoIndex < currentGroupPhotos.length - 1) { currentPhotoIndex++; updatePhotoDisplay(); }
  };
}
// キーボード操作（左右矢印キー）で写真切替
document.addEventListener('keydown', function(e) {
  if (currentGroupPhotos.length > 0) {
    if (e.key === 'ArrowLeft') {
      if (currentPhotoIndex > 0) { currentPhotoIndex--; updatePhotoDisplay(); }
    } else if (e.key === 'ArrowRight') {
      if (currentPhotoIndex < currentGroupPhotos.length - 1) { currentPhotoIndex++; updatePhotoDisplay(); }
    }
  }
});

/********************
イベント
********************/
const addMarkerBtn = document.getElementById('addMarkerBtn');
const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
const registerBtn = document.getElementById('registerBtn');
const resetBtn = document.getElementById('resetBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const importBtn = document.getElementById('importBtn');
const importFileBtn = document.getElementById('importFileBtn');

// ファイル選択時、登録ボタンを有効化
uploadPhotoBtn.addEventListener('change', (ev) => {
  selectedFiles = Array.from(ev.target.files);
  registerBtn.disabled = (selectedFiles.length === 0);
  progressEl.textContent = selectedFiles.length ? `${selectedFiles.length} 枚を登録します` : '';
});

// 登録ボタン：各ファイルのEXIFから座標を取得しグループに追加
registerBtn.addEventListener('click', async () => {
  registerBtn.disabled = true;
  let processedCount = 0;
  for (const file of selectedFiles) {
    await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          EXIF.getData(img, async function() {
            const latArr = EXIF.getTag(this, 'GPSLatitude');
            const lonArr = EXIF.getTag(this, 'GPSLongitude');
            const latRef = EXIF.getTag(this, 'GPSLatitudeRef') || 'N';
            const lonRef = EXIF.getTag(this, 'GPSLongitudeRef') || 'E';
            const dateTime = EXIF.getTag(this, 'DateTimeOriginal') || '不明';
            const filePath = file.webkitRelativePath || file.name;
            if (latArr && lonArr) {
              const latDec = (latArr[0] + latArr[1] / 60 + latArr[2] / 3600) * (latRef === 'N' ? 1 : -1);
              const lonDec = (lonArr[0] + lonArr[1] / 60 + lonArr[2] / 3600) * (lonRef === 'E' ? 1 : -1);
              const imageUrl = URL.createObjectURL(file);
              await addPhotoToCluster(latDec, lonDec, imageUrl, filePath, dateTime);
              renderMarkers();
              renderList();
            } else {
              console.log('Exifに位置情報がありません:', file.name);
            }
            processedCount++;
            progressEl.textContent = `${processedCount}/${selectedFiles.length} 登録中...`;
            resolve();
          });
        };
      };
      reader.readAsDataURL(file);
    });
  }
  alert('全ての写真を登録しました');
  progressEl.textContent = '';
  selectedFiles = [];
  uploadPhotoBtn.value = '';
});

// 手動マーカー追加(クリック位置の座標から既存グループがあれば統合、なければ新規作成)
addMarkerBtn.addEventListener('click', async () => {
  map.once('click', async (e) => {
    const latDec = e.latlng.lat;
    const lonDec = e.latlng.lng;
    const userComment = prompt('コメントを入力してください') || '';
    let cluster = findNearbyCluster(latDec, lonDec, MERGE_THRESHOLD);
    if (cluster) {
      if (userComment) { cluster.comment = userComment; }
    } else {
      const cityName = await getCityName(latDec, lonDec);
      cluster = {
        lat: latDec,
        lng: lonDec,
        cityName,
        comment: userComment,
        photos: []
      };
      clusterData.push(cluster);
    }
    saveClusters();
    renderMarkers();
    renderList();
  });
  alert('地図をクリックしてマーカーを追加してください');
});

// リセット
resetBtn.addEventListener('click', () => {
  if (confirm('すべての記録を削除しますか？')) {
    localStorage.removeItem(storageKey);
    clusterData = [];
    renderMarkers();
    renderList();
    document.getElementById('photoDetail').innerHTML = '写真を選択するとここに表示されます';
    progressEl.textContent = '';
  }
});

// JSONエクスポート
exportJsonBtn.addEventListener('click', () => {
  const dataStr = JSON.stringify(clusterData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'travel_data.json';
  a.click();
  URL.revokeObjectURL(url);
});

// CSVエクスポート
exportCsvBtn.addEventListener('click', () => {
  let csv = 'clusterLat,clusterLng,cityName,comment,photoLat,photoLng,photoDate,photoPath\n';
  clusterData.forEach(cluster => {
    cluster.photos.forEach(photo => {
      csv += `${cluster.lat},${cluster.lng},"${cluster.cityName}","${cluster.comment || ''}",${photo.lat},${photo.lng},"${photo.date}","${photo.filePath}"\n`;
    });
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'travel_data.csv';
  a.click();
  URL.revokeObjectURL(url);
});

// インポート
importBtn.addEventListener('click', () => { importFileBtn.click(); });
importFileBtn.addEventListener('change', (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    if (file.name.endsWith('.json')) {
      try {
        const json = JSON.parse(text);
        if (Array.isArray(json)) {
          clusterData = json;
          saveClusters();
          renderMarkers();
          renderList();
          document.getElementById('photoDetail').innerHTML = 'インポートしたデータを読み込みました';
          alert('全ての写真をインポートしました');
        } else {
          alert('JSONの形式が正しくありません');
        }
      } catch(err) {
        alert('JSONのパースに失敗しました');
      }
    } else if (file.name.endsWith('.csv')) {
      const lines = text.split('\n');
      clusterData = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = parseCsvLine(line);
        // lat,lng,cityName,comment,photoLat,photoLng,photoDate,photoPath
        const cLat = parseFloat(parts[0]);
        const cLng = parseFloat(parts[1]);
        const cCity = parts[2];
        const cComment = parts[3];
        const pLat = parseFloat(parts[4]);
        const pLng = parseFloat(parts[5]);
        const pDate = parts[6];
        const pPath = parts[7];
        let cluster = clusterData.find(c => c.lat === cLat && c.lng === cLng);
        if (!cluster) {
          cluster = {
            lat: cLat,
            lng: cLng,
            cityName: cCity,
            comment: cComment,
            photos: []
          };
          clusterData.push(cluster);
        }
        cluster.photos.push({
          imageUrl: '',
          filePath: pPath,
          lat: pLat,
          lng: pLng,
          date: pDate
        });
      }
      saveClusters();
      renderMarkers();
      renderList();
      document.getElementById('photoDetail').innerHTML = 'CSVファイルをインポートしました';
      alert('全ての写真をインポートしました');
    } else {
      alert('拡張子が .json か .csv のファイルを選んでください');
    }
  };
  reader.readAsText(file);
  ev.target.value = '';
});

function parseCsvLine(line) {
  const parts = [];
  let current = '';
  for (let i = 0; i < line.length; i++) {
    if (line[i] === ',') {
      parts.push(current);
      current = '';
    } else {
      current += line[i];
    }
  }
  parts.push(current);
  return parts.map(p => p.replace(/^\"|\"$/g, ''));
}

// ページ初期表示
renderMarkers();
renderList();