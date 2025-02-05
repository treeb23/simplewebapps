function arrayToMarkdown(data) {
    function sanitizeCell(cell) { // ”|”（パイプ）をプレースホルダ "__PIPE__" に置換するための関数
        return cell.toString().replace(/\|/g, '__PIPE__');
    }
    function unsanitizeCell(cell) { // プレースホルダ "__PIPE__" を元の "\\|"（エスケープされたパイプ）に戻す
        return cell.replace(/__PIPE__/g, '\\\\|');
    }
    let sanitizedData = data.map(row => row.map(cell => sanitizeCell(cell))); // 入力されたdata（2次元配列）に対して、各行・各セルごとに sanitizeCellを適用し、各セル内のパイプ記号をプレースホルダに置換
    let maxCols = 0; // 最大列数を保持するための変数
    sanitizedData.forEach(row => {
        if (row.length > maxCols) maxCols = row.length; // テーブル全体の最大列数を決定
    });
    sanitizedData = sanitizedData.map(row => { // 各行のセル数が最大列数 maxCols に満たない場合、空文字列 "" を追加して行のセル数を補完
        let newRow = row.slice();
        while (newRow.length < maxCols) {
            newRow.push("");
        }
        return newRow;
    });
    let lines = sanitizedData.map(row => '| ' + row.join(' | ') + ' |'); // 各行のセルを " | " で連結し、先頭と末尾に "|" を付けた文字列（Markdown のテーブル行の形式）に変換
    let separatorRow = new Array(maxCols).fill('---'); // 最大列数 maxCols の要素数を持つ配列を生成し、すべての要素を '---' で埋める
    let separatorLine = '| ' + separatorRow.join(' | ') + ' |'; // セパレータ行の各セルを " | " で連結し、先頭と末尾に "|" を付けた文字列 separatorLine を生成
    if (lines.length > 0) {
        lines.splice(1, 0, separatorLine); // lines配列に行が存在する場合は、ヘッダー行の直後（インデックス1の位置）にセパレータ行を挿入
    } else {
        lines.push(separatorLine);
    }
    let markdown = lines.join('\n'); // 配列内の各行を改行文字 \n で連結
    markdown = unsanitizeCell(markdown); // Markdown テーブル内のすべての "__PIPE__" を、元の "\\|"（エスケープされたパイプ）に置換
    return markdown;
}

// 2次元配列をHTMLテーブルに変換する関数
function arrayToHTML(data) {
    if (!data || data.length === 0) return "";
    let html = '<table class="table table-bordered table-striped">\n<thead>\n<tr>';
    data[0].forEach(cell => { html += `<th>${cell}</th>`; });
    html += '</tr>\n</thead>\n<tbody>\n';
    data.slice(1).forEach(row => {
        html += '<tr>';
        row.forEach(cell => { html += `<td>${cell}</td>`; });
        html += '</tr>\n';
    });
    html += '</tbody>\n</table>';
    return html;
}

// 2次元配列をCSV文字列に変換する関数
// ※ セル内のパイプ "|" はそのまま出力し、カンマ、改行、ダブルクォートのみに特殊処理を実施
function arrayToCSV(data) {
    if (!data || data.length === 0) return "";
    return data.map(row => {
        return row.map(cell => {
            let text = cell.toString();
            // セル内にカンマ、改行、またはダブルクォートがある場合は、セル全体をダブルクォートで囲む
            if (/[,"\n]/.test(text)) {
                text = '"' + text.replace(/"/g, '""') + '"';
            }
            return text;
        }).join(',');
    }).join('\n');
}

// 入力文字列を指定の出力文字コードに変換して Blob を生成する関数
function createBlobFromText(text, encoding) {
    if (encoding === 'utf8') {
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        return new Blob([bom, text], { type: 'text/plain;charset=utf-8' });
    } else {
        const codeArray = Encoding.stringToCode(text);
        let toEncoding = encoding.toUpperCase();
        const byteArray = Encoding.convert(codeArray, { to: toEncoding, type: 'array' });
        return new Blob([new Uint8Array(byteArray)], { type: 'text/plain;charset=' + toEncoding });
    }
}

// コピー処理：指定要素のテキスト内容をクリップボードへコピーし、ボタン横にフィードバックを表示
function copyToClipboard(elementId, btn) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const text = el.innerText || el.textContent;
    navigator.clipboard.writeText(text).then(() => {
        let feedback = btn.parentNode.querySelector('.copy-feedback');
        if (!feedback) {
            feedback = document.createElement('span');
            feedback.className = 'copy-feedback';
            btn.parentNode.appendChild(feedback);
        }
        feedback.textContent = 'Copied!';
        feedback.classList.add('show');
        setTimeout(() => {
            feedback.classList.remove('show');
        }, 3000);
    }).catch(err => {
        console.error('コピーに失敗:', err);
    });
}

// Markdown入力行を正しく分割する関数
// 先頭・末尾の "|" を除去し、エスケープされていない "|" で分割。分割後、各セル内の "\|" を元に戻す
function splitMarkdownRow(row) {
    row = row.trim();
    if (row.startsWith('|')) {
        row = row.substring(1);
    }
    if (row.endsWith('|')) {
        row = row.substring(0, row.length - 1);
    }
    const cells = row.split(/(?<!\\)\|/); // 負の先読み (?<!\\) を用いて分割（ES2018以降対応）
    return cells.map(cell => cell.replace(/\\\|/g, '|').trim());
}

// Excelタブの変換処理
let lastConvertedMarkdown = ""; // ダウンロード用に保持

document.getElementById('convertExcel').addEventListener('click', function() {
    const fileInput = document.getElementById('excelFile');
    if (!fileInput.files || fileInput.files.length === 0) {
        alert('Excelファイルを選択してください。');
        return;
    }
    const file = fileInput.files[0];
    const fileName = file.name.toLowerCase();
    const reader = new FileReader();

    reader.onload = function(e) {
        if (fileName.endsWith('.csv')) {
            const arrayBuffer = e.target.result;
            const uint8Array = new Uint8Array(arrayBuffer);
            const userInputEnc = document.getElementById('inputEncodingExcel').value;
            let inputEncoding = "";
            if(userInputEnc === 'auto') {
                const detected = Encoding.detect(uint8Array);
                inputEncoding = Array.isArray(detected) ? detected[0] : detected;
                console.log("自動検出された文字コード:", inputEncoding);
            } else {
                inputEncoding = userInputEnc;
                console.log("ユーザ指定の文字コード:", inputEncoding);
            }
            try {
                const decoder = new TextDecoder(inputEncoding);
                const decodedText = decoder.decode(uint8Array);
                const workbook = XLSX.read(decodedText, { type: 'string' });
                processWorkbook(workbook);
            } catch (error) {
                console.error('TextDecoderでの変換に失敗:', error);
                alert('指定の文字コードでの変換に失敗しました。別の文字コードを試してください。');
            }
        } else {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            processWorkbook(workbook);
        }
    };
    reader.readAsArrayBuffer(file);
});

// Excelタブ用
function processWorkbook(workbook) {
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    lastConvertedMarkdown = arrayToMarkdown(jsonData);
    document.getElementById('excelOutput').innerHTML =
    '<div class="output-area">' +
        '<div><strong>Markdown形式:</strong> ' +
        '<button class="btn btn-sm btn-outline-secondary copy-btn" onclick="copyToClipboard(\'excelMarkdown\', this)"><i class="bi bi-clipboard"></i></button>' +
        '</div>' +
        '<pre id="excelMarkdown">' + lastConvertedMarkdown + '</pre>' +
    '</div>' +
    '<div class="output-area">' +
        '<div><strong>HTML形式 (コード):</strong> ' +
        '<button class="btn btn-sm btn-outline-secondary copy-btn" onclick="copyToClipboard(\'excelHTML\', this)"><i class="bi bi-clipboard"></i></button>' +
        '</div>' +
        '<pre id="excelHTML">' + arrayToHTML(jsonData).replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>' +
    '</div>' +
    // レンダリングされたテーブルを表示
    '<div class="preview-frame">' +
        '<strong>HTML形式 (プレビュー):</strong>' +
        arrayToHTML(jsonData) +
    '</div>';
}

// Excelタブのダウンロード処理（出力文字コード指定）
document.getElementById('downloadMarkdown').addEventListener('click', function() {
    if (!lastConvertedMarkdown) {
        alert('まず変換を実行してください。');
        return;
    }
    const encoding = document.getElementById('encodingSelectExcel').value;
    const blob = createBlobFromText(lastConvertedMarkdown, encoding);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'converted.md';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);
});

// Markdownタブの変換処理（Markdownテーブル -> HTML, CSV）
document.getElementById('convertMarkdown').addEventListener('click', function() {
    const input = document.getElementById('markdownInput').value.trim();
    if (!input) {
        alert('Markdownテーブルを入力してください。');
        return;
    }
    // Markdownテーブルを行ごとに分割し、splitMarkdownRowでセル分割
    const lines = input.split('\n').filter(line => line.trim() !== '');
    const data = [];
    lines.forEach((line, idx) => {
        const cells = splitMarkdownRow(line);
        if (idx === 1 && cells.every(cell => cell.replace(/-/g, '').trim() === '')) return; // セパレータ行（例:---）は除外
        data.push(cells);
    });
    document.getElementById('markdownOutput').innerHTML =
    '<div class="output-area">' +
        '<div><strong>HTML形式 (コード):</strong> ' +
        '<button class="btn btn-sm btn-outline-secondary copy-btn" onclick="copyToClipboard(\'markdownHTML\', this)"><i class="bi bi-clipboard"></i></button>' +
        '</div>' +
        '<pre id="markdownHTML">' + arrayToHTML(data).replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>' +
    '</div>' +
    '<div class="output-area">' +
        '<div><strong>CSV形式:</strong> ' +
        '<button class="btn btn-sm btn-outline-secondary copy-btn" onclick="copyToClipboard(\'markdownCSV\', this)"><i class="bi bi-clipboard"></i></button>' +
        '</div>' +
        '<pre id="markdownCSV">' + arrayToCSV(data) + '</pre>' +
    '</div>' +
    // レンダリングされたテーブルを表示
    '<div class="preview-frame">' +
        '<strong>HTML形式 (プレビュー):</strong>' +
        arrayToHTML(data) +
    '</div>';
});

// HTMLタブの変換処理（HTMLテーブル -> Markdown, CSV）
document.getElementById('convertHTML').addEventListener('click', function() {
    const input = document.getElementById('htmlInput').value.trim();
    if (!input) {
        alert('HTMLテーブルを入力してください。');
        return;
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(input, 'text/html');
    const table = doc.querySelector('table');
    if (!table) {
        alert('有効なHTMLテーブルが見つかりません。');
        return;
    }
    const data = [];
    table.querySelectorAll('tr').forEach(row => {
        const rowData = [];
        row.querySelectorAll('th, td').forEach(cell => {
            rowData.push(cell.textContent.trim());
        });
        if (rowData.length > 0) data.push(rowData);
    });
    document.getElementById('htmlOutput').innerHTML =
    '<div class="output-area">' +
        '<div><strong>Markdown形式:</strong> ' +
        '<button class="btn btn-sm btn-outline-secondary copy-btn" onclick="copyToClipboard(\'htmlMarkdown\', this)"><i class="bi bi-clipboard"></i></button>' +
        '</div>' +
        '<pre id="htmlMarkdown">' + arrayToMarkdown(data) + '</pre>' +
    '</div>' +
    '<div class="output-area">' +
        '<div><strong>CSV形式:</strong> ' +
        '<button class="btn btn-sm btn-outline-secondary copy-btn" onclick="copyToClipboard(\'htmlCSV\', this)"><i class="bi bi-clipboard"></i></button>' +
        '</div>' +
        '<pre id="htmlCSV">' + arrayToCSV(data) + '</pre>' +
    '</div>' +
    // レンダリングされたテーブルを表示
    '<div class="preview-frame">' +
        '<strong>HTML形式 (プレビュー):</strong>' +
        arrayToHTML(data) +
    '</div>';
});

// 表エディタタブ用の実装
// 表エディタ内のテーブル要素から2次元配列を生成
function getTableEditorData() {
    const table = document.querySelector('#tableEditorPreview table');
    const data = [];
    // ヘッダー部
    const thead = table.querySelector('thead');
    if (thead) {
        const headerRow = [];
        thead.querySelectorAll('th').forEach(cell => {
            headerRow.push(cell.innerText.trim());
        });
        data.push(headerRow);
    }
    // ボディ部
    const tbody = table.querySelector('tbody');
    if (tbody) {
        tbody.querySelectorAll('tr').forEach(row => {
            const rowData = [];
            row.querySelectorAll('td').forEach(cell => {
                rowData.push(cell.innerText.trim());
            });
            data.push(rowData);
        });
    }
    return data;
}

function updateTableEditorConversions() { // 表エディタの変換結果を更新する関数
    const data = getTableEditorData(); // getTableEditorData()関数を呼び出して、表エディタ内のテーブルから2次元配列形式のデータを取得
    document.getElementById('tableEditorMarkdown').textContent = arrayToMarkdown(data); // Markdown変換
    document.getElementById('tableEditorCSV').textContent = arrayToCSV(data); // CSV変換
    document.getElementById('tableEditorHTML').textContent = arrayToHTML(data); // HTML変換
    document.getElementById('tableEditorHTMLPreview').innerHTML = arrayToHTML(data); // HTMLプレビュー
}

updateTableEditorConversions(); // 初回更新: 関数 updateTableEditorConversions() を呼び出して、ページ読み込み時や初回表示時に表エディタの変換結果を更新
document.querySelector('#tableEditorPreview').addEventListener('input', updateTableEditorConversions); // 表エディタ内のセルが変更されたときに更新 : #tableEditorPreview 内のセルなどでinputイベントが発生した際に、updateTableEditorConversions関数を呼び出すイベントリスナーを登録

// 行・列追加・削除のボタン処理
document.getElementById('addRow').addEventListener('click', function() { // 「行追加」ボタンをクリックしたときの処理
    const table = document.querySelector('#tableEditorPreview table'); // 表エディタ内の <table> 要素を取得
    const tbody = table.querySelector('tbody'); // テーブル内の <tbody> 要素を取得
    const colCount = table.querySelector('thead tr').children.length; // <thead> 内の最初の <tr> 行から列数を取得
    const newRow = document.createElement('tr'); // 新しい <tr> 要素を作成
    for (let i = 0; i < colCount; i++) { // 各列分のセルを新しい行に追加するためのループ
        const newCell = document.createElement('td'); // 各ループ内で新しい <td> 要素を作成
        newCell.contentEditable = "true"; // 新しいセルを編集可能にするためにcontentEditable属性を true に設定
        newCell.innerText = ""; // セルの初期テキストを空文字に設定
        newRow.appendChild(newCell); // 作成した新しいセルを新しい行（newRow）に追加
    }
    tbody.appendChild(newRow); // 作成した新しい行全体を <tbody> に追加
    updateTableEditorConversions(); // 変換結果を更新する
});

document.getElementById('delRow').addEventListener('click', function() { // 「行削除」ボタンをクリックしたときの処理
    const table = document.querySelector('#tableEditorPreview table'); // 表エディタ内の <table> 要素を取得
    const tbody = table.querySelector('tbody'); // テーブルの <tbody> 要素を取得
    if (tbody.rows.length > 0) { // <tbody> に1行以上の行が存在するか確認
        tbody.deleteRow(tbody.rows.length - 1); // <tbody> の最後の行を削除
        updateTableEditorConversions(); // 変換結果を更新する
    }
});

document.getElementById('addCol').addEventListener('click', function() { // 「列追加」ボタンをクリックしたときの処理
    const table = document.querySelector('#tableEditorPreview table'); // 表エディタ内の <table> 要素を取得
    const headerRow = table.querySelector('thead tr'); // テーブルのヘッダー部分（<thead> 内の <tr>）を取得
    const newTh = document.createElement('th'); // 新しいヘッダーセル <th> 要素を作成
    newTh.contentEditable = "true"; // 新しいヘッダーセルを編集可能に設定
    newTh.innerText = "Header" + (headerRow.children.length + 1); // 新しいヘッダーセルの表示テキストを設定
    headerRow.appendChild(newTh); // 新しいヘッダーセル <th> をヘッダー行に追加
    table.querySelectorAll('tbody tr').forEach(row => { // <tbody> 内のすべての <tr> 行に対して処理を実行
        const newTd = document.createElement('td'); // 各行ごとに新しい <td> セルを作成
        newTd.contentEditable = "true"; // 新しいセルを編集可能に設定
        newTd.innerText = ""; // セルの初期テキストを空文字に設定
        row.appendChild(newTd); // 作成した新しいセルを現在の行に追加
    });
    updateTableEditorConversions(); // 変換結果を更新する
});

document.getElementById('delCol').addEventListener('click', function() { // 「列削除」ボタンをクリックしたときの処理
    const table = document.querySelector('#tableEditorPreview table'); // 表エディタ内の <table> 要素を取得
    const headerRow = table.querySelector('thead tr'); // テーブルのヘッダー行を取得
    if (headerRow.children.length > 1) {
        headerRow.removeChild(headerRow.lastElementChild); // ヘッダー行の最後の <th> セルを削除
        table.querySelectorAll('tbody tr').forEach(row => {
            if (row.children.length > 0) { // 常に真
                row.removeChild(row.lastElementChild); // 各行の最後の <td> セルを削除
            }
        });
        updateTableEditorConversions(); // 変換結果を更新する
    }
});