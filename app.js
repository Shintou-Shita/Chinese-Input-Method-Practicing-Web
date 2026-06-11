const App = {
    currentSection: 'intro',
    currentMode: 'single',
    currentTheme: 'default',
    isPracticing: false,
    isPaused: false,
    isComposing: false,
    isTimedMode: false,
    timerInterval: null,
    statsInterval: null,
    timeRemaining: 0,
    startTime: null,
    totalKeystrokes: 0,
    correctChars: 0,
    totalChars: 0,
    currentCharIndex: 0,
    practiceData: [],
    _charScanCursor: 0,
    _dictKeyCursor: 0,
    _dictKeysCache: null,
    _articleText: '',
    _articleCursor: 0,
    _visibleStart: 0,
    charList: [],
    charmapData: {},
    user: null,
    users: {},
    leaderboard: [],

    traditionalToSimplifiedMap: {
        '為': '为', '與': '与', '這': '这', '裡': '里',
        '說': '说', '時': '时', '們': '们', '個': '个', '來': '来',
        '學': '学', '會': '会', '對': '对', '機': '机',
        '發': '发', '電': '电', '語': '语', '長': '长',
        '師': '师', '資': '资', '開': '开', '關': '关', '門': '门',
        '間': '间', '題': '题', '國': '国',
        '麼': '么',
        '聽': '听', '讀': '读',
        '寫': '写', '見': '见', '愛': '爱', '歡': '欢',
        '經': '经', '萬': '万',
        '聖': '圣', '芻': '刍',
        '爭': '争'
    },

    halfWidthPunctuation: '.,!?;:\'"()[]{}<>/\\|-+=*&^%$#@~`',
    fullWidthPunctuation: '，。！？；：\'"（）【】{}《》/\\|·—……',

    isPunctuation(char) {
        return this.halfWidthPunctuation.includes(char) || this.fullWidthPunctuation.includes(char);
    },

    toSimplified(char) {
        // 优先使用完整映射表 (charamap.txt)，fallback 到内置映射
        if (this.charmapData[char]) return this.charmapData[char];
        return this.traditionalToSimplifiedMap[char] || char;
    },

    toTraditional(char) {
        // 反向查找完整映射表
        for (const [trad, simp] of Object.entries(this.charmapData)) {
            if (simp === char) return trad;
        }
        // fallback 到内置映射
        for (const [trad, simp] of Object.entries(this.traditionalToSimplifiedMap)) {
            if (simp === char) return trad;
        }
        return char;
    },

    async init() {
        this.loadUsers();
        this.loadLeaderboard();
        this.loadTheme();
        this.bindEvents();
        await this.loadCharmap();
        await this.loadCharList();
        this.renderLeaderboard();
        this.loadDefaultContent();
    },

    async loadCharList() {
        try {
            const text = await this._loadTextFile('regular_cf.txt');
            this.charList = [...text.trim()];
            console.log(`从 regular_cf.txt 加载了 ${this.charList.length} 个汉字`);
        } catch (e) {
            console.error('加载 regular_cf.txt 失败:', e);
            this.showFeedback('加载 regular_cf.txt 失败——请用 HTTP 服务器打开本页面（如 python3 -m http.server）', 'error');
        }
    },

    async loadCharmap() {
        try {
            const text = await this._loadTextFile('charamap.txt');
            const lines = text.trim().split('\n');
            for (const line of lines) {
                const parts = line.split('\t');
                if (parts.length >= 2) {
                    const trad = parts[0].trim();
                    const simp = parts[1].trim();
                    if (trad && simp) {
                        this.charmapData[trad] = simp;
                    }
                }
            }
            console.log(`从 charamap.txt 加载了 ${Object.keys(this.charmapData).length} 对繁简映射`);
        } catch (e) {
            console.warn('加载 charamap.txt 失败，将使用内置映射:', e);
        }
    },

    _loadTextFile(url) {
        // XHR 在 file:// 协议下比 fetch 更宽松，优先使用
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.onload = () => {
                if (xhr.status === 200 || xhr.status === 0) {
                    resolve(xhr.responseText);
                } else {
                    this._fetchFallback(url).then(resolve).catch(reject);
                }
            };
            xhr.onerror = () => {
                this._fetchFallback(url).then(resolve).catch(reject);
            };
            xhr.send();
        });
    },

    _fetchFallback(url) {
        return fetch(url).then(resp => {
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return resp.text();
        });
    },

    bindEvents() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchSection(e.target.dataset.section));
        });

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectMode(e.target.dataset.mode));
        });

        document.getElementById('startBtn').addEventListener('click', () => this.startPractice());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetPractice());

        document.getElementById('loadYamlBtn').addEventListener('click', () => {
            document.getElementById('yamlFile').click();
        });

        document.getElementById('yamlFile').addEventListener('change', (e) => this.loadYamlFile(e));

        document.getElementById('loadArticleBtn').addEventListener('click', () => {
            document.getElementById('articleFile').click();
        });
        document.getElementById('articleFile').addEventListener('change', (e) => this.loadArticleFile(e));

        const userInput = document.getElementById('userInput');
        userInput.addEventListener('compositionstart', () => { this.isComposing = true; });
        userInput.addEventListener('compositionend', (e) => {
            this.isComposing = false;
            this.handleInput(e);
        });
        userInput.addEventListener('input', (e) => {
            if (!this.isComposing) this.handleInput(e);
        });
        userInput.addEventListener('keydown', (e) => {
            if (this.isPracticing && !this.isPaused) this.totalKeystrokes++;
        });

        document.getElementById('timedModeBtn').addEventListener('click', () => this.toggleTimedMode());

        document.getElementById('timerDuration').addEventListener('change', (e) => {
            this.timeRemaining = parseInt(e.target.value);
        });

        document.getElementById('themeSelect').addEventListener('change', (e) => this.changeTheme(e.target.value));

        document.getElementById('loginBtn').addEventListener('click', () => {
            if (this.user) {
                this.handleLogout();
            } else {
                this.showLoginModal();
            }
        });
        document.getElementById('closeModalBtn').addEventListener('click', () => this.hideLoginModal());
        document.getElementById('confirmLoginBtn').addEventListener('click', () => this.handleLogin());
        document.getElementById('registerBtn').addEventListener('click', () => this.handleRegister());
    },

    switchSection(section) {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));

        document.querySelector(`[data-section="${section}"]`).classList.add('active');
        document.getElementById(section).classList.add('active');
        this.currentSection = section;
    },

    selectMode(mode) {
        // 限时模式下先确认再切 UI，避免用户取消后按钮状态已变
        if (this.isTimedMode) {
            const confirmed = confirm('切换练习模式将重新开始计时练习，确定吗？');
            if (!confirmed) return;
        }

        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
        this.currentMode = mode;
        document.getElementById('articleSelector').style.display = (mode === 'custom') ? '' : 'none';

        if (this.isTimedMode) {
            this.startPractice();
        } else {
            this.resetPractice();
        }
    },

    loadDefaultContent() {
        const defaultArticles = [
            '道可道，非常道；名可名，非常名。',
            '天地不仁，以万物为刍狗；圣人不仁，以百姓为刍狗。',
            '上善若水，水善利万物而不争。'
        ];

        this.defaultArticles = defaultArticles;
    },

    loadYamlFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.parseYamlDict(e.target.result);
                document.getElementById('yamlFileName').textContent = file.name;
                this.showFeedback('词典加载成功！', 'success');
            } catch (error) {
                this.showFeedback('词典解析失败：' + error.message, 'error');
            }
        };
        reader.readAsText(file);
    },

    loadArticleFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            // 筛去空格、换行、Tab 等格式符号，保留标点
            this._articleText = e.target.result.replace(/[\t\n\r ]+/g, '');
            this._articleCursor = 0;
            document.getElementById('articleFileName').textContent = file.name;
            this.showFeedback(`文章加载成功！共 ${this._articleText.length} 个字符`, 'success');
        };
        reader.readAsText(file);
    },

    _loadArticleBatch(count) {
        const end = Math.min(this._articleCursor + count, this._articleText.length);
        const slice = this._articleText.slice(this._articleCursor, end);
        this._articleCursor = end;
        return this.getCustomPractice(slice);
    },

    parseYamlDict(content) {
        const lines = content.split('\n');
        const charMap = {};

        let inDictSection = false;

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed === '...' || trimmed === '---') {
                inDictSection = true;
                continue;
            }

            if (trimmed.startsWith('#') || trimmed === '') {
                continue;
            }

            if (trimmed.includes(':')) {
                const parts = trimmed.split(':');
                const key = parts[0].trim();
                const value = parts.slice(1).join(':').trim();
                if (key === 'dictionary' || key === 'dict') {
                    inDictSection = true;
                }
                continue;
            }

            if (inDictSection && line.includes('\t')) {
                const parts = line.split('\t');
                if (parts.length >= 2) {
                    const chars = parts[0].trim();
                    // 单字练习：只收集单字条目，多字词条（如"我們"）不纳入
                    if (chars.length !== 1) continue;
                    const codes = parts[1].trim().split(/\s+/).filter(c => c.length > 0);

                    const simpChar = this.toSimplified(chars);
                    if (!charMap[simpChar]) {
                        charMap[simpChar] = [];
                    }
                    for (const code of codes) {
                        if (!charMap[simpChar].includes(code)) {
                            charMap[simpChar].push(code);
                        }
                    }
                }
            } else if (inDictSection && line.includes(' ')) {
                const parts = line.split(/\s+/);
                if (parts.length >= 2) {
                    const chars = parts[0].trim();
                    // 单字练习：只收集单字条目
                    if (chars.length !== 1) continue;
                    const codes = parts.slice(1).filter(c => c.length > 0);

                    const simpChar = this.toSimplified(chars);
                    if (!charMap[simpChar]) {
                        charMap[simpChar] = [];
                    }
                    for (const code of codes) {
                        if (!charMap[simpChar].includes(code)) {
                            charMap[simpChar].push(code);
                        }
                    }
                }
            }
        }

        this.customCharMap = charMap;
        console.log('Parsed charMap:', charMap);
    },

    startPractice() {
        this.isPracticing = true;
        this.isPaused = false;
        this.totalKeystrokes = 0;
        this.correctChars = 0;
        this.totalChars = 0;
        this.currentCharIndex = 0;
        this._visibleStart = 0;
        this.startTime = Date.now();

        // 限时模式：重启计时器
        if (this.isTimedMode) {
            const duration = parseInt(document.getElementById('timerDuration').value) || 60;
            this.timeRemaining = duration;
            if (this.timerInterval) clearInterval(this.timerInterval);
            this.startTimer();
        }

        document.getElementById('pauseBtn').textContent = '暂停';
        document.getElementById('pauseBtn').disabled = false;
        document.getElementById('userInput').disabled = false;

        // 启动每秒刷新统计的定时器
        if (this.statsInterval) clearInterval(this.statsInterval);
        this.statsInterval = setInterval(() => this.updateStatistics(), 1000);
        this.updateStatistics();

        switch (this.currentMode) {
            case 'single':
                this.practiceData = this.getSingleCharPractice();
                break;
            case 'article':
                this.practiceData = this.getArticlePractice();
                break;
            case 'custom':
                if (this._articleText) {
                    // 从上传的文章文件分批加载
                    this._articleCursor = 0;
                    this.practiceData = this._loadArticleBatch(20);
                } else {
                    const customText = prompt('请输入自定义练习文章：');
                    if (customText) {
                        // 统一走分批加载，避免超长文本一次性创建大量对象
                        this._articleText = customText.replace(/[\t\n\r ]+/g, '');
                        this._articleCursor = 0;
                        this.practiceData = this._loadArticleBatch(20);
                    } else {
                        // 用户取消，回退 practice 状态到空闲
                        this.isPracticing = false;
                        this.startTime = null;
                        if (this.statsInterval) { clearInterval(this.statsInterval); this.statsInterval = null; }
                        if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
                        document.getElementById('pauseBtn').textContent = '暂停';
                        document.getElementById('pauseBtn').disabled = true;
                        document.getElementById('userInput').disabled = true;
                        this.showFeedback('请输入自定义文章', 'error');
                        return;
                    }
                }
                break;
        }

        this.renderTargetText();
        document.getElementById('userInput').value = '';
        document.getElementById('userInput').focus();
    },

    getSingleCharPractice() {
        // 按 regular_cf.txt 顺序，每次只取 BATCH_SIZE 个匹配的字
        this._charScanCursor = 0;
        this._dictKeyCursor = 0;
        this._dictKeysCache = null;
        return this._loadCharBatch(10);
    },

    _loadCharBatch(count) {
        const batch = [];
        let collected = 0;

        console.log(`_loadCharBatch: charList长度=${this.charList.length}, charScanCursor=${this._charScanCursor}, customCharMap=${!!this.customCharMap}`);

        // 第一轮：从 charList（字频顺序）中扫描匹配的字
        while (this._charScanCursor < this.charList.length && collected < count) {
            const char = this.charList[this._charScanCursor];
            this._charScanCursor++;

            if (this.customCharMap) {
                const simpChar = this.toSimplified(char);
                if (this.customCharMap[simpChar]) {
                    batch.push({
                        char: simpChar,
                        originalChar: char,
                        pinyin: this.customCharMap[simpChar][0]
                    });
                    collected++;
                }
            } else {
                batch.push({ char, originalChar: char, pinyin: '' });
                collected++;
            }
        }

        // 第二轮：charList 扫完后还不够，回退到词典自身的键顺序补齐
        if (this.customCharMap && collected < count) {
            if (!this._dictKeysCache) {
                this._dictKeysCache = Object.keys(this.customCharMap);
            }
            while (this._dictKeyCursor < this._dictKeysCache.length && collected < count) {
                const key = this._dictKeysCache[this._dictKeyCursor];
                this._dictKeyCursor++;
                // 只取那些尚未在 charList 中被收录的字（即没被第一轮扫到的）
                // 由于第一轮是按字频扫的且该匹配的都已经进了 batch，
                // 这里取的必然是字频表中没有或未被匹配的字符
                if (!batch.some(item => item.char === key)) {
                    batch.push({
                        char: key,
                        originalChar: key,
                        pinyin: this.customCharMap[key][0]
                    });
                    collected++;
                }
            }
        }

        console.log(`_loadCharBatch: 返回 ${batch.length} 个字, charScanCursor=${this._charScanCursor}, dictKeyCursor=${this._dictKeyCursor}`);
        return batch;
    },

    _appendTargetText(batch) {
        const targetEl = document.getElementById('targetText');
        const startIndex = this.practiceData.length - batch.length;
        const html = batch.map((item, i) => {
            const idx = startIndex + i;
            let hint = item.pinyin || item.char;
            if (this.isPunctuation(item.char)) hint = item.char;
            return `<span class="target-char" data-index="${idx}">
                <span class="char">${item.char}</span>
                <span class="pinyin">${hint}</span>
            </span>`;
        }).join('');
        targetEl.insertAdjacentHTML('beforeend', html);
    },

    getArticlePractice() {
        const article = this.defaultArticles[Math.floor(Math.random() * this.defaultArticles.length)];
        return article.split('').map(char => {
            const simpChar = this.toSimplified(char);
            const pinyin = this.customCharMap && this.customCharMap[simpChar]
                ? this.customCharMap[simpChar][0]
                : '';
            return { char: simpChar, originalChar: char, pinyin };
        });
    },

    getCustomPractice(text) {
        return text.split('').map(char => {
            const simpChar = this.toSimplified(char);
            const pinyin = this.customCharMap && this.customCharMap[simpChar]
                ? this.customCharMap[simpChar][0]
                : '';
            return { char: simpChar, originalChar: char, pinyin };
        });
    },

    renderTargetText() {
        const targetEl = document.getElementById('targetText');
        targetEl.innerHTML = this.practiceData.map((item, index) => {
            let displayHint = item.pinyin || item.char;
            if (this.isPunctuation(item.char)) {
                displayHint = item.char;
            }
            return `<span class="target-char${index === 0 ? ' current' : ''}" data-index="${index}">
                <span class="char">${item.char}</span>
                <span class="pinyin">${displayHint}</span>
            </span>`;
        }).join('');
    },

    handleInput(event) {
        if (!this.isPracticing || this.isPaused) return;

        const rawInput = event.target.value;
        if (!rawInput) return;

        let matchCount = 0;
        let remaining = '';
        let broken = false;

        for (let i = 0; i < rawInput.length; i++) {
            const inputChar = rawInput[i];
            if (!inputChar.trim() || inputChar === '\u3000') {
                // 跳过半角空白和全角空格，但保留在 remaining 中如果 broken
                if (broken) remaining += inputChar;
                continue;
            }

            // 每个非空白字符都计入总字数
            this.totalChars++;

            if (broken) {
                remaining += inputChar;
                continue;
            }

            const targetIndex = this.currentCharIndex + matchCount;
            if (targetIndex >= this.practiceData.length) {
                remaining += inputChar;
                continue;
            }

            const targetItem = this.practiceData[targetIndex];
            const simpInput = this.toSimplified(inputChar);
            const simpTarget = this.toSimplified(targetItem.char);

            if (simpInput === simpTarget || inputChar === targetItem.char) {
                matchCount++;
                this.correctChars++;
                this.markCharCorrect(targetIndex);
            } else {
                broken = true;
                remaining += inputChar;
            }
        }

        this.currentCharIndex += matchCount;

        // 单字模式：判断是否还有更多字可加载
        const charListDone = this._charScanCursor >= this.charList.length;
        const dictDone = !this.customCharMap ||
            (this._dictKeysCache && this._dictKeyCursor >= this._dictKeysCache.length);
        const allExhausted = charListDone && dictDone;

        // 距末尾不足 5 个字时预加载下一批
        if (this.currentMode === 'single' &&
            this.currentCharIndex >= this.practiceData.length - 5 &&
            !allExhausted) {
            const next = this._loadCharBatch(10);
            if (next.length > 0) {
                this.practiceData = this.practiceData.concat(next);
                this._appendTargetText(next);
            }
        }

        // 自定义文章模式：距末尾不足 20 个字时预加载下一批
        if (this.currentMode === 'custom' &&
            this._articleText &&
            this.currentCharIndex >= this.practiceData.length - 20 &&
            this._articleCursor < this._articleText.length) {
            const next = this._loadArticleBatch(20);
            if (next.length > 0) {
                this.practiceData = this.practiceData.concat(next);
                this._appendTargetText(next);
            }
        }

        const articleExhausted = !this._articleText || this._articleCursor >= this._articleText.length;

        if (this.currentCharIndex >= this.practiceData.length &&
            (this.currentMode !== 'single' || allExhausted) &&
            (this.currentMode !== 'custom' || articleExhausted)) {
            event.target.value = '';
            this.finishPractice();
        } else if (matchCount > 0) {
            event.target.value = remaining;
            // 保持当前字在前5个位置：前面正确字数超过4个则清除最早的
            if (this.currentCharIndex - this._visibleStart > 4) {
                const removeUpTo = this.currentCharIndex - 4;
                const targetEl = document.getElementById('targetText');
                for (let i = this._visibleStart; i < removeUpTo; i++) {
                    const el = targetEl.querySelector(`.target-char[data-index="${i}"]`);
                    if (el) el.remove();
                }
                this._visibleStart = removeUpTo;
            }
            this.updateCurrentChar();
        }
        // matchCount === 0 时输入框保持原样，让用户看到哪个字不对

        this.updateStatistics();
    },

    markCharCorrect(index) {
        const targetEl = document.getElementById('targetText');
        const charEl = targetEl.querySelector(`.target-char[data-index="${index}"]`);
        if (charEl) {
            charEl.classList.remove('current');
            charEl.classList.add('correct');
        }
    },

    updateCurrentChar() {
        const targetEl = document.getElementById('targetText');
        targetEl.querySelectorAll('.target-char').forEach(el => {
            el.classList.remove('current');
        });
        const currentEl = targetEl.querySelector(`.target-char[data-index="${this.currentCharIndex}"]`);
        if (currentEl) {
            currentEl.classList.add('current');
        }
    },

    updateStatistics() {
        // 开始前：显示 --
        if (!this.startTime) {
            document.getElementById('accuracy').textContent = '--%';
            document.getElementById('speed').textContent = '-- 字/分';
            document.getElementById('keystrokes').textContent = '-- 次/分';
            return;
        }

        const elapsedSec = (Date.now() - this.startTime) / 1000;
        const elapsedMin = elapsedSec / 60;

        // 开始后零秒：显示 Beginning
        if (elapsedSec < 1) {
            document.getElementById('accuracy').textContent = 'Beginning';
            document.getElementById('speed').textContent = 'Beginning';
            document.getElementById('keystrokes').textContent = 'Beginning';
            return;
        }

        // 正常计算
        const accuracy = this.totalChars > 0
            ? ((this.correctChars / this.totalChars) * 100).toFixed(2)
            : '0.00';
        const speed = elapsedMin > 0 ? (this.totalChars / elapsedMin).toFixed(2) : '0.00';
        const keystrokesPerMin = elapsedMin > 0 ? (this.totalKeystrokes / elapsedMin).toFixed(2) : '0.00';

        document.getElementById('accuracy').textContent = accuracy + '%';
        document.getElementById('speed').textContent = speed + ' 字/分';
        document.getElementById('keystrokes').textContent = keystrokesPerMin + ' 次/分';
    },

    finishPractice() {
        // 完成练习：已登录且有成绩则上榜
        if (this.user && this.startTime && this.totalChars > 0) {
            this.saveToLeaderboard();
        }

        this.isPracticing = false;
        this.isPaused = false;

        document.getElementById('pauseBtn').textContent = '暂停';
        document.getElementById('pauseBtn').disabled = true;

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }

        const elapsed = (Date.now() - this.startTime) / 1000;
        this.showFeedback(`练习完成！用时 ${elapsed.toFixed(1)} 秒`, 'success');
    },

    resetPractice() {
        // 限时模式下重置 = 重新开始计时练习
        if (this.isTimedMode) {
            this.startPractice();
            return;
        }

        this.isPracticing = false;
        this.isPaused = false;
        this.currentCharIndex = 0;
        this.totalKeystrokes = 0;
        this.correctChars = 0;
        this.totalChars = 0;
        this._visibleStart = 0;
        this.startTime = null;

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }

        document.getElementById('pauseBtn').textContent = '暂停';
        document.getElementById('pauseBtn').disabled = true;
        document.getElementById('targetText').innerHTML = '';
        document.getElementById('userInput').value = '';
        document.getElementById('timerDisplay').textContent = '00:00';
        document.getElementById('accuracy').textContent = '--%';
        document.getElementById('speed').textContent = '-- 字/分';
        document.getElementById('keystrokes').textContent = '-- 次/分';
    },

    togglePause() {
        if (!this.isPracticing) return;

        this.isPaused = !this.isPaused;
        const btn = document.getElementById('pauseBtn');

        if (this.isPaused) {
            btn.textContent = '继续';
            if (this.statsInterval) {
                clearInterval(this.statsInterval);
                this.statsInterval = null;
            }
            // 限时模式：暂停时也停掉倒计时，否则时间继续跑
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
            document.getElementById('userInput').disabled = true;
        } else {
            btn.textContent = '暂停';
            this.statsInterval = setInterval(() => this.updateStatistics(), 1000);
            this.updateStatistics();
            // 限时模式：继续时若还有剩余时间则重启倒计时
            if (this.isTimedMode && this.timeRemaining > 0) {
                this.startTimer();
            }
            document.getElementById('userInput').disabled = false;
            document.getElementById('userInput').focus();
        }
    },

    toggleTimedMode() {
        const btn = document.getElementById('timedModeBtn');
        const duration = parseInt(document.getElementById('timerDuration').value) || 60;

        if (this.isTimedMode) {
            this.isTimedMode = false;
            btn.textContent = '开启限时';
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
            document.getElementById('timerDisplay').textContent = '00:00';
        } else {
            this.isTimedMode = true;
            this.timeRemaining = duration;
            btn.textContent = '关闭限时';
            this.startTimer();
            // 如果当前已选模式且未在练习中，自动开始
            if (!this.isPracticing) {
                this.startPractice();
            }
        }
    },

    startTimer() {
        this.updateTimerDisplay();

        this.timerInterval = setInterval(() => {
            this.timeRemaining--;

            if (this.timeRemaining <= 0) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
                document.getElementById('timerDisplay').textContent = '00:00';
                // 时限到：暂停练习（不结束）
                if (this.isPracticing && !this.isPaused) {
                    this.isPaused = true;
                    if (this.statsInterval) {
                        clearInterval(this.statsInterval);
                        this.statsInterval = null;
                    }
                    document.getElementById('pauseBtn').textContent = '继续';
                    document.getElementById('pauseBtn').disabled = false;
                    document.getElementById('userInput').disabled = true;
                    this.showFeedback('时间到！', 'error');
                }
            } else {
                this.updateTimerDisplay();
            }
        }, 1000);
    },

    updateTimerDisplay() {
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;
        document.getElementById('timerDisplay').textContent =
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    },

    changeTheme(theme) {
        this.currentTheme = theme;
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    },

    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.changeTheme(savedTheme);
        document.getElementById('themeSelect').value = savedTheme;
    },

    showLoginModal() {
        document.getElementById('loginModal').classList.add('active');
    },

    hideLoginModal() {
        document.getElementById('loginModal').classList.remove('active');
        document.getElementById('usernameInput').value = '';
        document.getElementById('passwordInput').value = '';
        document.getElementById('modalFeedback').textContent = '';
    },

    handleLogin() {
        const username = document.getElementById('usernameInput').value.trim();
        const password = document.getElementById('passwordInput').value;

        if (!username || !password) {
            document.getElementById('modalFeedback').textContent = '请输入用户名和密码';
            return;
        }

        if (this.users[username] && this.users[username] === password) {
            this.user = username;
            document.getElementById('userDisplay').textContent = username;
            document.getElementById('loginBtn').textContent = '退出';
            this.hideLoginModal();
            this.showFeedback('登录成功！', 'success');
        } else {
            document.getElementById('modalFeedback').textContent = '用户名或密码错误';
        }
    },

    handleLogout() {
        this.user = null;
        document.getElementById('userDisplay').textContent = '未登录';
        document.getElementById('loginBtn').textContent = '登录';
        this.showFeedback('已退出登录', 'success');
    },

    handleRegister() {
        const username = document.getElementById('usernameInput').value.trim();
        const password = document.getElementById('passwordInput').value;

        if (!username || !password) {
            document.getElementById('modalFeedback').textContent = '请输入用户名和密码';
            return;
        }

        if (this.users[username]) {
            document.getElementById('modalFeedback').textContent = '用户名已存在';
            return;
        }

        if (username === '未登录') {
            document.getElementById('modalFeedback').textContent = '该用户名不可使用';
            return;
        }

        this.users[username] = password;
        this.saveUsers();
        this.user = username;
        document.getElementById('userDisplay').textContent = username;
        document.getElementById('loginBtn').textContent = '退出';
        this.hideLoginModal();
        this.showFeedback('注册成功！', 'success');
    },

    loadUsers() {
        const saved = localStorage.getItem('users');
        if (saved) {
            this.users = JSON.parse(saved);
        }
    },

    saveUsers() {
        localStorage.setItem('users', JSON.stringify(this.users));
    },

    saveToLeaderboard() {
        const elapsedMin = (Date.now() - this.startTime) / 1000 / 60;
        const entry = {
            username: this.user,
            accuracy: this.totalChars > 0
                ? parseFloat(((this.correctChars / this.totalChars) * 100).toFixed(2))
                : 0,
            speed: elapsedMin > 0
                ? parseFloat((this.totalChars / elapsedMin).toFixed(2))
                : 0,
            keystrokes: elapsedMin > 0
                ? parseFloat((this.totalKeystrokes / elapsedMin).toFixed(2))
                : 0,
            date: new Date().toISOString()
        };

        this.leaderboard.push(entry);
        // 按正确率降序，再按速度降序
        this.leaderboard.sort((a, b) => b.accuracy - a.accuracy || b.speed - a.speed);
        this.leaderboard = this.leaderboard.slice(0, 10);
        this.saveLeaderboard();
        this.renderLeaderboard();
    },

    loadLeaderboard() {
        const saved = localStorage.getItem('leaderboard');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (Array.isArray(data)) {
                    this.leaderboard = data.filter(e => e.username && e.accuracy != null);
                }
            } catch (e) {
                this.leaderboard = [];
            }
        }
    },

    saveLeaderboard() {
        localStorage.setItem('leaderboard', JSON.stringify(this.leaderboard));
    },

    renderLeaderboard() {
        const container = document.getElementById('leaderboard-list');
        if (!container) return;

        if (this.leaderboard.length === 0) {
            container.innerHTML = '<p>暂无记录</p>';
            return;
        }

        const headers = `
            <div class="leaderboard-item leaderboard-header">
                <span class="rank">#</span>
                <span class="username">用户</span>
                <span class="accuracy-col">正确率</span>
                <span class="speed-col">速度</span>
                <span class="keystrokes-col">击键</span>
            </div>`;

        container.innerHTML = headers + this.leaderboard.map((entry, index) => `
            <div class="leaderboard-item">
                <span class="rank">#${index + 1}</span>
                <span class="username">${entry.username}</span>
                <span class="accuracy-col">${entry.accuracy}%</span>
                <span class="speed-col">${entry.speed} 字/分</span>
                <span class="keystrokes-col">${entry.keystrokes} 次/分</span>
            </div>`).join('');
    },

    showFeedback(message, type) {
        const feedback = document.getElementById('feedback');
        feedback.textContent = message;
        feedback.className = 'feedback ' + type;

        setTimeout(() => {
            feedback.textContent = '';
            feedback.className = 'feedback';
        }, 3000);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});