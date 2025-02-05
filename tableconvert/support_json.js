// tableconvert.htmlにjson変換機能を統合する
(function(){
    document.addEventListener('DOMContentLoaded', function(){
    const navTabs = document.getElementById('conversionTabs');
    const tabContent = document.getElementById('conversionTabsContent');

    if (navTabs && tabContent) {
        const li = document.createElement('li'); // 新規タブボタン（li要素内にbutton）
        li.className = 'nav-item';
        li.setAttribute('role', 'presentation');
        const btn = document.createElement('button');
        btn.className = 'nav-link';
        btn.id = 'json-tab';
        btn.setAttribute('data-bs-toggle', 'tab');
        btn.setAttribute('data-bs-target', '#json');
        btn.setAttribute('type', 'button');
        btn.setAttribute('role', 'tab');
        btn.textContent = 'JSON/Markdown';
        li.appendChild(btn);
        navTabs.appendChild(li);

        const div = document.createElement('div');
        div.className = 'tab-pane fade p-3';
        div.id = 'json';
        div.setAttribute('role', 'tabpanel');
        div.innerHTML = `
        <h5>JSON/Markdown 入力</h5>
        <textarea id="jsonInput" rows="8" class="form-control mb-3" placeholder="JSON または Markdown を入力してください"></textarea>
        <div class="mb-3">
            <button id="jsonFormatBtn" class="btn btn-primary me-2">JSON整形</button>
            <button id="jsonToMdBtn" class="btn btn-primary me-2">JSON → Markdown</button>
            <button id="mdToJsonBtn" class="btn btn-primary me-2">Markdown → JSON</button>
            <button id="jsonPreviewBtn" class="btn btn-secondary">プレビュー (表形式)</button>
        </div>
        <h5>出力</h5>
        <div id="jsonOutput" class="output-area"></div>
        `;
        tabContent.appendChild(div);
    }
    const inputEl = document.getElementById('jsonInput');
    const outputEl = document.getElementById('jsonOutput');
    document.getElementById('jsonFormatBtn').addEventListener('click', function(){
        const input = inputEl.value.trim();
        if(input === ""){
            outputEl.textContent = "入力が空です";
            return;
        }
        try {
            const json = JSON.parse(input);
            outputEl.textContent = JSON.stringify(json, null, 4);
        } catch(e) {
            outputEl.textContent = "無効なJSONです: " + e.message;
        }
    });

    // JSON -> Markdown変換ボタン
    document.getElementById('jsonToMdBtn').addEventListener('click', function(){
        const input = inputEl.value.trim();
        if(input === ""){
            outputEl.textContent = "入力が空です";
            return;
        }
        try {
            const json = JSON.parse(input);
            let markdown = "";
            // JSONが配列の場合
            if(Array.isArray(json)) {
                if(json.length === 0){
                    outputEl.textContent = "空の配列です";
                    return;
                }
                let keys = new Set(); // 配列中のオブジェクトの場合、共通のキー集合を作成
                json.forEach(item => {
                    if(typeof item === "object" && item !== null) {
                        Object.keys(item).forEach(k => keys.add(k));
                    }
                });
                keys = Array.from(keys);
                markdown += "| " + keys.join(" | ") + " |\n";
                markdown += "| " + keys.map(() => "---").join(" | ") + " |\n";
                json.forEach(item => {
                const row = keys.map(key => (item && item[key] !== undefined ? item[key] : ""));
                markdown += "| " + row.join(" | ") + " |\n";
                });
            }
            // JSONがオブジェクトの場合はキーと値の2列テーブル
            else if(typeof json === "object" && json !== null) {
                markdown += "| Key | Value |\n";
                markdown += "| --- | --- |\n";
                Object.keys(json).forEach(key => {
                let value = json[key];
                if(typeof value === "object" && value !== null){
                    value = JSON.stringify(value);
                }
                markdown += `| ${key} | ${value} |\n`;
                });
            }
            else {
                outputEl.textContent = "JSONオブジェクトまたは配列を入力してください";
                return;
            }
            outputEl.textContent = markdown;
        } catch(e) {
            outputEl.textContent = "無効なJSONです: " + e.message;
        }
    });

    // Markdown -> JSON変換ボタン
    document.getElementById('mdToJsonBtn').addEventListener('click', function(){
        const input = inputEl.value.trim();
        if(input === ""){
            outputEl.textContent = "入力が空です";
        return;
        }
        const lines = input.split('\n').filter(line => line.trim() !== ""); // Markdownテーブルを行ごとに分割
        if(lines.length < 2){
            outputEl.textContent = "Markdownテーブル形式ではありません";
            return;
        }
        const header = splitMarkdownRow(lines[0]);
        const separator = splitMarkdownRow(lines[1]);
        if(!separator.every(cell => /^-+$/.test(cell))){
            outputEl.textContent = "Markdownテーブルの区切り行が正しくありません";
            return;
        }
        const jsonArr = [];
        for(let i = 2; i < lines.length; i++){
            const row = splitMarkdownRow(lines[i]);
            let obj = {};
            header.forEach((h, index) => {
                obj[h] = row[index] !== undefined ? row[index] : "";
            });
            jsonArr.push(obj);
        }
        if(jsonArr.length === 1){ // 出力行数が1ならオブジェクト、複数なら配列として出力
            outputEl.textContent = JSON.stringify(jsonArr[0], null, 4);
        } else {
            outputEl.textContent = JSON.stringify(jsonArr, null, 4);
        }
    });

    // プレビューボタン：入力がJSON,Markdownテーブルの場合にHTMLテーブルに変換して表示
    document.getElementById('jsonPreviewBtn').addEventListener('click', function(){
        const input = inputEl.value.trim();
        if(input === ""){
            outputEl.innerHTML = "入力が空です";
            return;
        }
        // まずJSONとしてパースを試みる
        try {
            const json = JSON.parse(input);
            outputEl.innerHTML = generateTableFromJSON(json);
            return;
        } catch(e){
            // JSONでなければMarkdownテーブルとして扱う
        }
        const mdData = parseMarkdownTable(input);
        if(mdData){
            outputEl.innerHTML = generateHTMLTable(mdData);
        } else {
            outputEl.textContent = "有効なJSONまたはMarkdownテーブル形式ではありません";
        }
    });
    function splitMarkdownRow(row) { // Markdownテーブルの1行をセルに分割（前後のパイプ除去）
        row = row.trim();
        if(row.startsWith('|')){
            row = row.substring(1);
        }
        if(row.endsWith('|')){
            row = row.substring(0, row.length - 1);
        }
        const cells = row.split(/(?<!\\)\|/); // エスケープされていない "|" で分割
        return cells.map(cell => cell.replace(/\\\|/g, '|').trim());
    }
    function parseMarkdownTable(text) { // Markdownテーブル全体を2次元配列に変換
        const lines = text.split('\n').filter(line => line.trim() !== "");
        if(lines.length < 2) return null;
        const header = splitMarkdownRow(lines[0]);
        const separator = splitMarkdownRow(lines[1]);
        if(!separator.every(cell => /^-+$/.test(cell))) return null;
        const rows = [header];
        for(let i = 2; i < lines.length; i++){
            const row = splitMarkdownRow(lines[i]);
            if(row.length > 0) rows.push(row);
        }
        return rows;
    }

    // 2次元配列をHTMLテーブルに変換
    function generateHTMLTable(rows) {
        if(!rows || rows.length === 0) return "";
        let html = "<table class='table table-bordered table-striped'><thead><tr>";
        rows[0].forEach(cell => { html += `<th>${cell}</th>`; });
        html += "</tr></thead><tbody>";
        for(let i = 1; i < rows.length; i++){
            html += "<tr>";
            rows[i].forEach(cell => { html += `<td>${cell}</td>`; });
            html += "</tr>";
        }
        html += "</tbody></table>";
        return html;
    }

    // JSONオブジェクトまたは配列をHTMLテーブルに変換
    function generateTableFromJSON(json) {
        let html = "";
        // 配列の場合
        if(Array.isArray(json)) {
        if(json.length === 0) return "<p>空の配列です</p>";
            let keys = new Set();
            json.forEach(item => {
                if(typeof item === "object" && item !== null) {
                    Object.keys(item).forEach(k => keys.add(k));
                }
            });
            keys = Array.from(keys);
            html += "<table class='table table-bordered table-striped'><thead><tr>";
            keys.forEach(key => { html += `<th>${key}</th>`; });
            html += "</tr></thead><tbody>";
            json.forEach(item => {
                html += "<tr>";
                keys.forEach(key => {
                let value = (item && item[key] !== undefined) ? item[key] : "";
                html += `<td>${value}</td>`;
                });
                html += "</tr>";
            });
            html += "</tbody></table>";
        }
        // オブジェクトの場合
        else if(typeof json === "object" && json !== null) {
            html += "<table class='table table-bordered table-striped'><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>";
            Object.keys(json).forEach(key => {
                let value = json[key];
                if(typeof value === "object" && value !== null){
                    value = JSON.stringify(value);
                }
                html += `<tr><td>${key}</td><td>${value}</td></tr>`;
            });
            html += "</tbody></table>";
        }
        else {
            html = "<p>JSON オブジェクトまたは配列を入力してください</p>";
        }
        return html;
    }

    }); // DOMContentLoaded
})();