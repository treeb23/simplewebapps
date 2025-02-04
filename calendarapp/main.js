/***********************
グローバル変数とデータ
***********************/
let events = []; // 予定オブジェクト： { id, title, date, startTime, endTime, description, priority, related, color, tags, location }
let globalMemos = []; // メモ
let globalTags = ["授業", "研究", "就活", "個人", "その他"]; // タグ(デフォルト)
let calendarDisplaySettings = {
    High: { fontSize: "1.2em", color: "#ff0000" },
    Medium: { fontSize: "1em", color: "#4CAF50" },
    Low: { fontSize: "0.8em", color: "#0000ff" }
}; // カレンダー表示設定
let settingsHistory = []; // 履歴
let dataHistory = [];
let currentYear, currentMonth;
let currentSort = ""; // ソート・検索。"date" または "priority"
let currentSearchKeyword = "";
let hideCompleted = false; // 終了済み予定非表示フラグ
let tempLocation = null; // Location 選択用
let locationMap = null; // Leaflet マップインスタンス（Location モーダル用）
let locationMarker = null;

// ユニークID生成
function generateId() {
    return Date.now();
}

/***********************
ナビゲーションクリック処理
***********************/
document.getElementById("tab-calendar").addEventListener("click", () => {
    showView("view-calendar");
    setActiveTab("tab-calendar");
    renderCalendar();
});
document.getElementById("tab-event-list").addEventListener("click", () => {
    showView("view-event-list");
    setActiveTab("tab-event-list");
    renderEventList();
    populateTagSelect();
});
document.getElementById("tab-memo").addEventListener("click", () => {
    showView("view-memo");
    setActiveTab("tab-memo");
    renderMemos();
});
document.getElementById("tab-settings").addEventListener("click", () => {
    showView("view-settings");
    setActiveTab("tab-settings");
});
document.getElementById("tab-usage").addEventListener("click", () => {
    showView("view-usage");
    setActiveTab("tab-usage");
});
function setActiveTab(tabId) {
    document.querySelectorAll("#nav-bar button").forEach(btn => btn.classList.remove("active"));
    document.getElementById(tabId).classList.add("active");
}
function showView(viewId) {
    ["view-calendar", "view-event-list", "view-memo", "view-settings", "view-usage"].forEach(id => {
            document.getElementById(id).classList.add("hidden");
        });
    document.getElementById(viewId).classList.remove("hidden");
}

/***********************
通知モーダル
***********************/
document.getElementById("notify-btn").addEventListener("click", openNotifyModal);
document.getElementById("close-notify-btn").addEventListener("click", () => {
    document.getElementById("notify-modal").style.display = "none";
});
function openNotifyModal() {
    const today = new Date();
    const todayStr = today.getFullYear() + "-" + String(today.getMonth()+1).padStart(2,"0") + "-" + String(today.getDate()).padStart(2,"0");
    let todaysEvents = events.filter(e => e.date === todayStr);
    const order = { "High": 1, "Medium": 2, "Low": 3 };
    todaysEvents.sort((a,b) => order[a.priority] - order[b.priority]);
    const ulToday = document.getElementById("today-events");
    ulToday.innerHTML = "";
    if(todaysEvents.length === 0){
        ulToday.innerHTML = "<li>本日の予定はありません。</li>";
    } else {
        todaysEvents.forEach(e => {
            const li = document.createElement("li");
            li.textContent = e.title + " (" + e.startTime + (e.endTime ? " - " + e.endTime : "") + ")";
            ulToday.appendChild(li);
        });
    }
    const ulSettings = document.getElementById("settings-history");
    ulSettings.innerHTML = "";
    if(settingsHistory.length === 0){
        ulSettings.innerHTML = "<li>設定変更履歴はありません。</li>";
    } else {
        settingsHistory.forEach(item => {
            const li = document.createElement("li");
            li.textContent = new Date(item.timestamp).toLocaleString() + "：" + item.details;
            ulSettings.appendChild(li);
        });
    }
    const ulData = document.getElementById("data-history");
    ulData.innerHTML = "";
    if(dataHistory.length === 0){
        ulData.innerHTML = "<li>インポート/エクスポート履歴はありません。</li>";
    } else {
        dataHistory.forEach(item => {
            const li = document.createElement("li");
            li.textContent = new Date(item.timestamp).toLocaleString() + "：" + item.type;
            ulData.appendChild(li);
        });
    }
    document.getElementById("notify-modal").style.display = "block";
}

/***********************
カレンダー表示
***********************/
function renderCalendar() {
const calendarGrid = document.getElementById("calendar-grid");
calendarGrid.innerHTML = "";
const title = document.getElementById("calendar-title");
const firstDay = new Date(currentYear, currentMonth, 1);
const lastDay = new Date(currentYear, currentMonth + 1, 0);
title.textContent = currentYear + "年" + (currentMonth+1) + "月";
// 曜日ヘッダー
const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
dayNames.forEach(dayName => {
    const cell = document.createElement("div");
    cell.classList.add("calendar-cell", "header-cell");
    cell.textContent = dayName;
    calendarGrid.appendChild(cell);
});
// 前月分の空セル
const startDayIndex = firstDay.getDay();
for(let i = 0; i < startDayIndex; i++){
    const cell = document.createElement("div");
    cell.classList.add("calendar-cell", "date-cell");
    cell.style.backgroundColor = "#eedeff";
    calendarGrid.appendChild(cell);
}
// 当月セル
for(let day = 1; day <= lastDay.getDate(); day++){
    const cell = document.createElement("div");
    cell.classList.add("calendar-cell", "date-cell");
    const dateStr = currentYear + "-" + String(currentMonth+1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
    const dateNumber = document.createElement("div");
    dateNumber.classList.add("date-number");
    dateNumber.textContent = day;
    cell.appendChild(dateNumber);
    const container = document.createElement("div");
    container.classList.add("event-container");
    const dayEvents = events.filter(e => e.date === dateStr);
    dayEvents.forEach(e => {
    const badge = document.createElement("div");
    badge.classList.add("event-badge");
    badge.textContent = e.title;
    badge.title = "優先度：" + e.priority;
    if(e.priority === "High"){
        badge.style.fontSize = calendarDisplaySettings.High.fontSize;
        badge.style.backgroundColor = e.color || calendarDisplaySettings.High.color;
    } else if(e.priority === "Low"){
        badge.style.fontSize = calendarDisplaySettings.Low.fontSize;
        badge.style.backgroundColor = e.color || calendarDisplaySettings.Low.color;
    } else {
        badge.style.fontSize = calendarDisplaySettings.Medium.fontSize;
        badge.style.backgroundColor = e.color || calendarDisplaySettings.Medium.color;
    }
    badge.addEventListener("click", (ev) => {
        ev.stopPropagation();
        openEventModal(e);
    });
    container.appendChild(badge);
    });
    cell.appendChild(container);
    cell.addEventListener("dblclick", () => {
    openEventModal({ date: dateStr });
    });
    calendarGrid.appendChild(cell);
}
}
document.getElementById("prev-month").addEventListener("click", () => {
currentMonth--;
if(currentMonth < 0){ currentMonth = 11; currentYear--; }
renderCalendar();
});
document.getElementById("next-month").addEventListener("click", () => {
currentMonth++;
if(currentMonth > 11){ currentMonth = 0; currentYear++; }
renderCalendar();
});

/***********************
予定追加／編集モーダル
***********************/
const eventModal = document.getElementById("event-modal");
document.getElementById("cancel-event-btn").addEventListener("click", closeEventModal);
document.getElementById("save-event-btn").addEventListener("click", saveEvent);
document.getElementById("search-related-btn").addEventListener("click", openRelatedSearchModal);
document.getElementById("set-location-btn").addEventListener("click", openLocationModal);
function openEventModal(eventData) {
document.getElementById("event-id").value = eventData.id || "";
document.getElementById("event-title").value = eventData.title || "";
document.getElementById("event-date").value = eventData.date || "";
document.getElementById("event-start-time").value = eventData.startTime || "";
document.getElementById("event-end-time").value = eventData.endTime || "";
document.getElementById("event-description").value = eventData.description || "";
document.getElementById("event-priority").value = eventData.priority || "Medium";
document.getElementById("event-related").value = eventData.related ? eventData.related.join(",") : "";
document.getElementById("event-color").value = eventData.color || "#4CAF50";
if(eventData.location){
    document.getElementById("location-display").textContent = eventData.location;
} else {
    document.getElementById("location-display").textContent = "未設定";
}
populateTagSelect(eventData.tags);
document.getElementById("modal-title").textContent = eventData.id ? "予定の編集" : "予定の追加";
eventModal.style.display = "block";
}
function closeEventModal() {
eventModal.style.display = "none";
}
window.addEventListener("click", (e) => {
if(e.target == eventModal) closeEventModal();
if(e.target == relatedSearchModal) closeRelatedSearchModal();
if(e.target == mapModal) closeMapModal();
if(e.target == relatedDetailModal) closeRelatedDetailModal();
if(e.target == tagModal) closeTagModal();
if(e.target == document.getElementById("notify-modal")) document.getElementById("notify-modal").style.display = "none";
});
function saveEvent() {
const idField = document.getElementById("event-id").value;
const title = document.getElementById("event-title").value;
const date = document.getElementById("event-date").value;
const startTime = document.getElementById("event-start-time").value;
const endTime = document.getElementById("event-end-time").value;
const description = document.getElementById("event-description").value;
const priority = document.getElementById("event-priority").value;
const relatedStr = document.getElementById("event-related").value;
const related = relatedStr.split(",").map(s => s.trim()).filter(s => s !== "");
const color = document.getElementById("event-color").value;
const tagSelect = document.getElementById("event-tags");
const tags = Array.from(tagSelect.selectedOptions).map(opt => opt.value);
const location = document.getElementById("location-display").textContent.trim() !== "未設定" ? document.getElementById("location-display").textContent.trim() : "";
if(!title || !date){
    alert("タイトルと日付は必須です。");
    return;
}
if(idField){
    const index = events.findIndex(e => e.id == idField);
    if(index !== -1){
    events[index] = { ...events[index],
        title, date, startTime, endTime, description, priority, related, color, tags, location
    };
    }
} else {
    const newEvent = {
    id: generateId(),
    title, date, startTime, endTime, description, priority, related, color, tags, location
    };
    events.push(newEvent);
}
closeEventModal();
renderCalendar();
renderEventList();
}

/***********************
予定一覧表示／操作
***********************/
function renderEventList() {
const tbody = document.getElementById("event-table").querySelector("tbody");
tbody.innerHTML = "";
let filteredEvents = events.filter(e => {
    if(currentSearchKeyword.trim() === "") return true;
    const keyword = currentSearchKeyword.toLowerCase();
    return e.title.toLowerCase().includes(keyword) ||
        e.description.toLowerCase().includes(keyword) ||
        (e.tags && e.tags.some(t => t.toLowerCase().includes(keyword)));
});
// 終了済み非表示の処理
if(hideCompleted){
    const todayDate = new Date();
    todayDate.setHours(0,0,0,0);
    filteredEvents = filteredEvents.filter(e => {
    const eventDate = new Date(e.date);
    if(eventDate < todayDate) return false;
    if(eventDate.getTime() === todayDate.getTime() && e.endTime){
        const [endHour, endMin] = e.endTime.split(":").map(Number);
        const eventEnd = new Date(e.date);
        eventEnd.setHours(endHour, endMin, 0, 0);
        return eventEnd >= new Date();
    }
    return true;
    });
}
if(currentSort === "date"){
    filteredEvents.sort((a,b) => new Date(a.date) - new Date(b.date));
} else if(currentSort === "priority"){
    const order = { "High": 1, "Medium": 2, "Low": 3 };
    filteredEvents.sort((a,b) => order[a.priority] - order[b.priority]);
} else {
    filteredEvents.sort((a,b) => a.id - b.id);
}
filteredEvents.forEach(e => {
    const tr = document.createElement("tr");
    // ID セル
    const tdId = document.createElement("td");
    tdId.textContent = e.id;
    tdId.style.backgroundColor = e.color;
    tdId.style.color = "#fff";
    tr.appendChild(tdId);
    const tdDate = document.createElement("td");
    tdDate.textContent = e.date;
    tr.appendChild(tdDate);
    const tdTime = document.createElement("td");
    tdTime.textContent = (e.startTime || "") + (e.endTime ? (" - " + e.endTime) : "");
    tr.appendChild(tdTime);
    const tdTitle = document.createElement("td");
    tdTitle.textContent = e.title;
    tr.appendChild(tdTitle);
    const tdPriority = document.createElement("td");
    tdPriority.textContent = e.priority;
    tr.appendChild(tdPriority);
    const tdDescription = document.createElement("td");
    tdDescription.textContent = e.description;
    tr.appendChild(tdDescription);
    const tdRelated = document.createElement("td");
    if(e.related && e.related.length > 0){
    e.related.forEach(relId => {
        const link = document.createElement("a");
        link.href = "#";
        const relatedEvent = events.find(ev => ev.id == relId);
        link.textContent = relatedEvent ? relatedEvent.title : relId;
        link.addEventListener("click", (ev) => {
        ev.preventDefault();
        showRelatedDetail(relId);
        });
        tdRelated.appendChild(link);
        tdRelated.appendChild(document.createTextNode(" "));
    });
    }
    tr.appendChild(tdRelated);
    const tdColor = document.createElement("td");
    tdColor.textContent = e.color;
    tdColor.style.backgroundColor = e.color;
    tdColor.style.color = "#fff";
    tr.appendChild(tdColor);
    const tdTags = document.createElement("td");
    tdTags.textContent = e.tags ? e.tags.join(", ") : "";
    tr.appendChild(tdTags);
    const tdLocation = document.createElement("td");
    tdLocation.textContent = e.location || "";
    if(e.location && e.location.trim() !== ""){
    tdLocation.style.cursor = "pointer";
    tdLocation.addEventListener("click", () => {
        showMapModal();
    });
    }
    tr.appendChild(tdLocation);
    const tdActions = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.textContent = "編集";
    editBtn.addEventListener("click", () => { openEventModal(e); });
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "削除";
    deleteBtn.classList.add("delete-btn");
    deleteBtn.addEventListener("click", () => {
    if(confirm("この予定を削除してもよろしいですか？")){
        events = events.filter(ev => ev.id != e.id);
        renderCalendar();
        renderEventList();
    }
    });
    tdActions.appendChild(editBtn);
    tdActions.appendChild(deleteBtn);
    tr.appendChild(tdActions);
    tbody.appendChild(tr);
});
}
document.getElementById("new-event-btn").addEventListener("click", () => {
openEventModal({});
});
document.getElementById("sort-date-btn").addEventListener("click", () => {
currentSort = "date";
renderEventList();
});
document.getElementById("sort-priority-btn").addEventListener("click", () => {
currentSort = "priority";
renderEventList();
});
document.getElementById("search-btn").addEventListener("click", () => {
currentSearchKeyword = document.getElementById("search-keyword").value;
renderEventList();
});
document.getElementById("clear-search-btn").addEventListener("click", () => {
document.getElementById("search-keyword").value = "";
currentSearchKeyword = "";
renderEventList();
});
// 終了済み予定非表示ボタン
hideCompleted = false;
document.getElementById("toggle-hide-completed").addEventListener("click", () => {
hideCompleted = !hideCompleted;
document.getElementById("toggle-hide-completed").textContent = hideCompleted ? "終了済み表示" : "終了済み非表示";
renderEventList();
});

/***********************
関連予定検索モーダル
***********************/
const relatedSearchModal = document.getElementById("related-search-modal");
document.getElementById("close-related-search-btn").addEventListener("click", closeRelatedSearchModal);
document.getElementById("do-related-search-btn").addEventListener("click", doRelatedSearch);
function openRelatedSearchModal() {
document.getElementById("related-search-keyword").value = "";
document.getElementById("related-search-results").innerHTML = "";
relatedSearchModal.style.display = "block";
}
function closeRelatedSearchModal() {
relatedSearchModal.style.display = "none";
}
function doRelatedSearch() {
const keyword = document.getElementById("related-search-keyword").value.toLowerCase();
const results = events.filter(e =>
    e.title.toLowerCase().includes(keyword) ||
    e.description.toLowerCase().includes(keyword)
);
const ul = document.getElementById("related-search-results");
ul.innerHTML = "";
results.forEach(e => {
    const li = document.createElement("li");
    li.style.cursor = "pointer";
    li.style.padding = "4px";
    li.textContent = e.title + " (" + e.date + ")";
    li.addEventListener("click", () => {
    const relField = document.getElementById("event-related");
    let currentRel = relField.value.split(",").map(s => s.trim()).filter(s => s !== "");
    if(!currentRel.includes(e.id.toString())){
        currentRel.push(e.id);
    }
    relField.value = currentRel.join(",");
    closeRelatedSearchModal();
    });
    ul.appendChild(li);
});
}

/***********************
Location 選択モーダル（修正済み）
***********************/
const locationModal = document.getElementById("location-modal");
document.getElementById("close-location-btn").addEventListener("click", closeLocationModal);
document.getElementById("confirm-location-btn").addEventListener("click", confirmLocation);
// リロードボタンは "reload-location-btn"（重複を避ける）
document.getElementById("reload-location-btn").addEventListener("click", updateLocationMap);
function openLocationModal() {
    locationModal.style.display = "block";
    setTimeout(updateLocationMap, 100);
}
function updateLocationMap() {
    const mapDiv = document.getElementById("location-map");
    mapDiv.innerHTML = "";
    if(locationMap){
        locationMap.remove();
        locationMap = null;
    }
    let center = [35.6895, 139.6917];
    const locDisplay = document.getElementById("location-display").textContent.trim();
    if(locDisplay !== "未設定"){
        const parts = locDisplay.split(",");
        if(parts.length === 2){
        center = [parseFloat(parts[0]), parseFloat(parts[1])];
        }
    }
    locationMap = L.map(mapDiv).setView(center, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(locationMap);
    if(locDisplay !== "未設定"){
        locationMarker = L.marker(center, { draggable: true }).addTo(locationMap);
    } else {
        locationMarker = null;
    }
    locationMap.on("click", function(e) {
        if(locationMarker) {
        locationMarker.setLatLng(e.latlng);
        } else {
        locationMarker = L.marker(e.latlng, { draggable: true }).addTo(locationMap);
        }
        tempLocation = e.latlng;
    });
    if(locationMarker){
        locationMarker.on("dragend", function(e){
        tempLocation = e.target.getLatLng();
        });
    }
}
function closeLocationModal() {
    locationModal.style.display = "none";
}
function confirmLocation() {
    if(tempLocation) {
        const locStr = tempLocation.lat.toFixed(5) + "," + tempLocation.lng.toFixed(5);
        document.getElementById("location-display").textContent = locStr;
    }
    closeLocationModal();
}

/***********************
Map表示モーダル（Locationセルクリック用）
***********************/
const mapModal = document.getElementById("map-modal");
document.getElementById("close-map-btn").addEventListener("click", closeMapModal);
function updateMapModal() {
    const loc = document.getElementById("location-display").textContent.trim();
    if(!loc || loc === "未設定"){
        alert("場所情報がありません。");
        return;
    }
    const parts = loc.split(",");
    if(parts.length !== 2){
        alert("場所情報の形式が正しくありません。");
        return;
    }
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if(isNaN(lat) || isNaN(lng)){
        alert("数値として正しくありません。");
        return;
    }
    const mapContainer = document.getElementById("map-container");
    mapContainer.innerHTML = "";
    const map = L.map(mapContainer).setView([lat, lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    L.marker([lat, lng]).addTo(map);
}
function showMapModal() {
    const loc = document.getElementById("location-display").textContent.trim();
    if(!loc || loc === "未設定"){
        alert("場所情報がありません。");
        return;
    }
    mapModal.style.display = "block";
    setTimeout(updateMapModal, 100);
}
function closeMapModal() {
    mapModal.style.display = "none";
}

/***********************
関連予定詳細モーダル
***********************/
const relatedDetailModal = document.getElementById("related-detail-modal");
document.getElementById("close-related-detail-btn").addEventListener("click", closeRelatedDetailModal);
function showRelatedDetail(relId) {
    const eventData = events.find(e => e.id == relId);
    if(!eventData){
        alert("予定が見つかりません。");
        return;
    }
    const body = document.getElementById("related-detail-body");
    body.innerHTML = `
        <strong>タイトル:</strong> ${eventData.title}<br>
        <strong>日付:</strong> ${eventData.date} ${eventData.startTime || ""} ${eventData.endTime ? ("- " + eventData.endTime) : ""}<br>
        <strong>優先度:</strong> ${eventData.priority}<br>
        <strong>詳細:</strong> ${eventData.description}<br>
        <strong>タグ:</strong> ${(eventData.tags || []).join(", ")}<br>
        <strong>場所:</strong> ${eventData.location || ""}
    `;
    relatedDetailModal.style.display = "block";
}
function closeRelatedDetailModal() {
    relatedDetailModal.style.display = "none";
}

/***********************
タグ管理モーダル
***********************/
const tagModal = document.getElementById("tag-modal");
document.getElementById("manage-tags-btn").addEventListener("click", openTagModal);
document.getElementById("close-tag-btn").addEventListener("click", closeTagModal);
document.getElementById("add-tag-btn").addEventListener("click", addTag);
function openTagModal() {
    renderTagList();
    tagModal.style.display = "block";
}
function closeTagModal() {
    tagModal.style.display = "none";
    populateTagSelect();
}
function renderTagList() {
    const ul = document.getElementById("tag-list");
    ul.innerHTML = "";
    globalTags.forEach((tag, idx) => {
        const li = document.createElement("li");
        li.textContent = tag + " ";
        const delBtn = document.createElement("button");
        delBtn.textContent = "削除";
        delBtn.style.fontSize = "0.8em";
        delBtn.classList.add("delete-btn");
        delBtn.addEventListener("click", () => {
        globalTags.splice(idx, 1);
        renderTagList();
        populateTagSelect();
        });
        li.appendChild(delBtn);
        ul.appendChild(li);
    });
}
function addTag() {
    const newTag = document.getElementById("new-tag-input").value.trim();
    if(newTag && !globalTags.includes(newTag)){
        globalTags.push(newTag);
        document.getElementById("new-tag-input").value = "";
        renderTagList();
        populateTagSelect();
    }
}
function populateTagSelect(selectedTags=[]) {
    const select = document.getElementById("event-tags");
    select.innerHTML = "";
    globalTags.forEach(tag => {
        const option = document.createElement("option");
        option.value = tag;
        option.textContent = tag;
        if(selectedTags && selectedTags.includes(tag)){
        option.selected = true;
        }
        select.appendChild(option);
    });
}

/***********************
グローバルメモ管理
***********************/
function renderMemos() {
    const list = document.getElementById("memo-list");
    list.innerHTML = "";
    globalMemos.forEach(memo => {
        const div = document.createElement("div");
        div.classList.add("memo-item");
        const memoContainer = document.createElement("div");
        memoContainer.classList.add("memo-container");
        memoContainer.innerHTML = `<div style="flex:1;"><strong>${new Date(memo.timestamp).toLocaleString()}</strong><br>${memo.content}</div>`;
        const btnContainer = document.createElement("div");
        btnContainer.classList.add("memo-buttons");
        const editBtn = document.createElement("button");
        editBtn.textContent = "編集";
        editBtn.addEventListener("click", () => {
        const newContent = prompt("メモを編集：", memo.content);
        if(newContent != null){
            memo.content = newContent;
            renderMemos();
        }
        });
        const delBtn = document.createElement("button");
        delBtn.textContent = "削除";
        delBtn.classList.add("delete-btn");
        delBtn.addEventListener("click", () => {
        globalMemos = globalMemos.filter(m => m.id != memo.id);
        renderMemos();
        });
        btnContainer.appendChild(editBtn);
        btnContainer.appendChild(delBtn);
        memoContainer.appendChild(btnContainer);
        div.appendChild(memoContainer);
        list.appendChild(div);
    });
}
document.getElementById("add-memo-btn").addEventListener("click", () => {
    const content = document.getElementById("new-memo-text").value.trim();
    if(content){
        globalMemos.push({ id: generateId(), content, timestamp: Date.now() });
        document.getElementById("new-memo-text").value = "";
        renderMemos();
    }
});

/***********************
使い方画面の検索機能
***********************/
document.getElementById("usage-search-btn").addEventListener("click", () => {
    const query = document.getElementById("usage-search-input").value.toLowerCase();
    const paras = document.querySelectorAll("#usage-content p");
    paras.forEach(p => {
        if(p.textContent.toLowerCase().includes(query)){
        p.style.display = "";
        } else {
        p.style.display = "none";
        }
    });
});

/***********************
Settingsタブ：CSVインポート/エクスポートと表示設定
***********************/
function exportToCSV() {
    const rows = [];
    rows.push(["dataType","id","title","date","startTime","endTime","description","priority","related","color","tags","location"]);
    events.forEach(e => {
        rows.push([
        "event",
        e.id,
        e.title,
        e.date,
        e.startTime || "",
        e.endTime || "",
        e.description,
        e.priority,
        e.related.join(";"),
        e.color,
        e.tags ? e.tags.join(";") : "",
        e.location || ""
        ]);
    });
    globalMemos.forEach(memo => {
        rows.push(["memo", memo.id, "", "", "", "", memo.content, "", "", "", "", ""]);
    });
    rows.push([
        "settings",
        calendarDisplaySettings.High.fontSize,
        calendarDisplaySettings.High.color,
        calendarDisplaySettings.Medium.fontSize,
        calendarDisplaySettings.Medium.color,
        calendarDisplaySettings.Low.fontSize,
        calendarDisplaySettings.Low.color
    ]);
    const csvContent = rows.map(row => row.map(field => {
        if(field == null) field = "";
        field = field.toString();
        if(field.search(/("|,|\n)/g) >= 0){
        field = '"' + field.replace(/"/g, '""') + '"';
        }
        return field;
    }).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "calendar_data.csv";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    dataHistory.push({ timestamp: Date.now(), type: "エクスポート" });
}
document.getElementById("export-csv-btn").addEventListener("click", exportToCSV);
function importFromCSV(csvText) {
    const rows = parseCSV(csvText);
    if(rows.length < 1) return;
    const dataRows = rows.slice(1);
    events = [];
    globalMemos = [];
    dataRows.forEach(row => {
        if(row.length < 6) return;
        if(row[0] === "event"){
            const ev = {
                id: row[1],
                title: row[2],
                date: row[3],
                startTime: row[4],
                endTime: row[5],
                description: row[6],
                priority: row[7],
                related: row[8] ? row[8].split(";").map(s => s.trim()).filter(s => s !== "") : [],
                color: row[9] || "#4CAF50",
                tags: row[10] ? row[10].split(";").map(s => s.trim()).filter(s => s !== "") : [],
                location: row[11] || ""
            };
            events.push(ev);
        } else if(row[0] === "memo"){
            globalMemos.push({ id: row[1], content: row[6], timestamp: Date.now() });
        } else if(row[0] === "settings"){
            calendarDisplaySettings.High.fontSize = row[1];
            calendarDisplaySettings.High.color = row[2];
            calendarDisplaySettings.Medium.fontSize = row[3];
            calendarDisplaySettings.Medium.color = row[4];
            calendarDisplaySettings.Low.fontSize = row[5];
            calendarDisplaySettings.Low.color = row[6];
            settingsHistory.push({ timestamp: Date.now(), details: "設定をインポートしました" });
        }
    });
    renderCalendar();
    renderEventList();
    renderMemos();
    alert("データが正常にインポートされました。");
    dataHistory.push({ timestamp: Date.now(), type: "インポート" });
}
function parseCSV(text) {
    const rows = [];
    const lines = text.split(/\r?\n/);
    for(let line of lines){
        if(line.trim() === "") continue;
        const row = [];
        let current = "";
        let inQuotes = false;
        for(let i=0; i<line.length; i++){
        const char = line[i];
        if(inQuotes){
            if(char === '"'){
            if(i+1 < line.length && line[i+1] === '"'){
                current += '"';
                i++;
            } else {
                inQuotes = false;
            }
            } else {
            current += char;
            }
        } else {
            if(char === '"'){
            inQuotes = true;
            } else if(char === ","){
            row.push(current);
            current = "";
            } else {
            current += char;
            }
        }
        }
        row.push(current);
        rows.push(row);
    }
    return rows;
}
document.getElementById("import-csv-btn").addEventListener("click", () => {
    document.getElementById("import-csv-input").click();
});
document.getElementById("import-csv-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        importFromCSV(e.target.result);
    };
    reader.readAsText(file);
});
document.getElementById("save-display-settings-btn").addEventListener("click", () => {
    calendarDisplaySettings.High.fontSize = document.getElementById("setting-high-font").value;
    calendarDisplaySettings.High.color = document.getElementById("setting-high-color").value;
    calendarDisplaySettings.Medium.fontSize = document.getElementById("setting-medium-font").value;
    calendarDisplaySettings.Medium.color = document.getElementById("setting-medium-color").value;
    calendarDisplaySettings.Low.fontSize = document.getElementById("setting-low-font").value;
    calendarDisplaySettings.Low.color = document.getElementById("setting-low-color").value;
    alert("表示設定を保存しました。");
    settingsHistory.push({ timestamp: Date.now(), details: "表示設定を変更しました" });
    renderCalendar();
});

/***********************
使い方画面の検索機能
***********************/
document.getElementById("usage-search-btn").addEventListener("click", () => {
    const query = document.getElementById("usage-search-input").value.toLowerCase();
    const paras = document.querySelectorAll("#usage-content p");
    paras.forEach(p => {
        if(p.textContent.toLowerCase().includes(query)){
            p.style.display = "";
        } else {
            p.style.display = "none";
        }
    });
});

/***********************
初期化
***********************/
const today = new Date();
currentYear = today.getFullYear();
currentMonth = today.getMonth();
renderCalendar();