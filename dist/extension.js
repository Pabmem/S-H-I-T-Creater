/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(__webpack_require__(1));
const imageManager_1 = __webpack_require__(2);
const cssInjector_1 = __webpack_require__(5);
const emotionAnalyzer_1 = __webpack_require__(6);
const backgroundRenderer_1 = __webpack_require__(7);
let refreshTimer;
let cssInjectorInstance;
async function activate(context) {
    try {
        const config = vscode.workspace.getConfiguration('moodBackground');
        let enabled = config.get('enabled', true);
        // Create core instances
        const imageManager = new imageManager_1.ImageManager(context, config.get('imagesFolder', ''));
        await imageManager.scanImages();
        const cssInjector = new cssInjector_1.CssInjector(config.get('opacity', 0.15), config.get('transitionDuration', 1.5));
        cssInjectorInstance = cssInjector;
        let analyzer = new emotionAnalyzer_1.EmotionAnalyzer(config.get('linesToAnalyze', 20));
        const renderer = new backgroundRenderer_1.BackgroundRenderer(cssInjector);
        renderer.setTransitionDuration(config.get('transitionDuration', 1.5) * 1000);
        // Inject CSS on startup if enabled
        if (enabled) {
            console.log('[MoodBackground] Applying background...');
            cssInjector.inject();
            console.log('[MoodBackground] Background applied. isInjected:', cssInjector.isInjected());
            // CSS 修改后需要重新加载窗口才能生效
            vscode.window.showInformationMessage('Mood Background 已安装！需要重新加载窗口才能看到背景图片。', '重新加载').then(choice => {
                if (choice === '重新加载') {
                    vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
            });
        }
        // ── Status bar ──────────────────────────────────────────
        const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        statusBar.text = '$(paintcan) Mood: --';
        statusBar.command = 'moodBackground.refresh';
        statusBar.tooltip = 'Mood Background: Click to refresh';
        if (enabled) {
            statusBar.show();
        }
        context.subscriptions.push(statusBar);
        // ── Refresh logic ───────────────────────────────────────
        async function refreshEmotion() {
            if (!enabled) {
                console.log('[MoodBackground] refreshEmotion: disabled, skipping');
                return;
            }
            try {
                console.log('[MoodBackground] Analyzing emotion...');
                const emotion = await analyzer.analyze();
                console.log('[MoodBackground] Emotion result:', emotion);
                const imagePath = imageManager.getImageForEmotion(emotion);
                console.log('[MoodBackground] Image path for', emotion, ':', imagePath);
                console.log('[MoodBackground] Available emotions:', imageManager.getAvailableEmotions());
                if (imagePath) {
                    renderer.switchTo(imagePath, emotion);
                    console.log('[MoodBackground] Renderer.switchTo called');
                    // CSS 文件修改后需要重新加载窗口才能生效
                    vscode.window.showInformationMessage(`情绪已切换为: ${emotion}`, '重新加载以查看').then(choice => {
                        if (choice === '重新加载以查看') {
                            vscode.commands.executeCommand('workbench.action.reloadWindow');
                        }
                    });
                }
                statusBar.text = `$(paintcan) Mood: ${emotion}`;
            }
            catch (err) {
                console.error('[MoodBackground] refreshEmotion error:', err);
            }
        }
        // ── Timer helpers ───────────────────────────────────────
        function startTimer() {
            stopTimer();
            const interval = config.get('updateInterval', 30) * 1000;
            refreshTimer = setInterval(() => { refreshEmotion(); }, interval);
        }
        function stopTimer() {
            if (refreshTimer !== undefined) {
                clearInterval(refreshTimer);
                refreshTimer = undefined;
            }
        }
        // ── Commands ────────────────────────────────────────────
        context.subscriptions.push(vscode.commands.registerCommand('moodBackground.enable', async () => {
            enabled = true;
            await config.update('enabled', true, vscode.ConfigurationTarget.Global);
            cssInjector.inject();
            statusBar.show();
            startTimer();
            await refreshEmotion();
        }));
        context.subscriptions.push(vscode.commands.registerCommand('moodBackground.disable', async () => {
            enabled = false;
            await config.update('enabled', false, vscode.ConfigurationTarget.Global);
            cssInjector.restore();
            statusBar.hide();
            stopTimer();
        }));
        context.subscriptions.push(vscode.commands.registerCommand('moodBackground.toggle', async () => {
            if (enabled) {
                await vscode.commands.executeCommand('moodBackground.disable');
            }
            else {
                await vscode.commands.executeCommand('moodBackground.enable');
            }
        }));
        context.subscriptions.push(vscode.commands.registerCommand('moodBackground.refresh', async () => {
            await refreshEmotion();
        }));
        // ── Event listeners ─────────────────────────────────────
        // Refresh on file save
        context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(() => {
            refreshEmotion();
        }));
        // React to configuration changes
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async (e) => {
            const cfg = vscode.workspace.getConfiguration('moodBackground');
            if (e.affectsConfiguration('moodBackground.opacity')) {
                cssInjector.updateOpacity(cfg.get('opacity', 0.15));
                if (enabled) {
                    cssInjector.inject();
                }
            }
            if (e.affectsConfiguration('moodBackground.transitionDuration')) {
                renderer.setTransitionDuration(cfg.get('transitionDuration', 1.5) * 1000);
            }
            if (e.affectsConfiguration('moodBackground.updateInterval')) {
                if (enabled) {
                    startTimer();
                }
            }
            if (e.affectsConfiguration('moodBackground.enabled')) {
                const newEnabled = cfg.get('enabled', true);
                if (newEnabled && !enabled) {
                    await vscode.commands.executeCommand('moodBackground.enable');
                }
                else if (!newEnabled && enabled) {
                    await vscode.commands.executeCommand('moodBackground.disable');
                }
            }
            if (e.affectsConfiguration('moodBackground.linesToAnalyze')) {
                analyzer = new emotionAnalyzer_1.EmotionAnalyzer(cfg.get('linesToAnalyze', 20));
                await refreshEmotion();
            }
        }));
        // ── Kick off ────────────────────────────────────────────
        startTimer();
        setTimeout(() => { refreshEmotion(); }, 2000);
    }
    catch (err) {
        vscode.window.showErrorMessage(`Mood Background activation failed: ${err}`);
        console.error('[MoodBackground] activate error:', err);
    }
}
function deactivate() {
    if (refreshTimer !== undefined) {
        clearInterval(refreshTimer);
        refreshTimer = undefined;
    }
    if (cssInjectorInstance) {
        cssInjectorInstance.restore();
    }
}


/***/ }),
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ImageManager = void 0;
const path = __importStar(__webpack_require__(3));
const fs = __importStar(__webpack_require__(4));
/**
 * Maps emotion labels to image file paths.
 * Scans an `images/` directory and provides fuzzy-matching lookup.
 */
class ImageManager {
    imagesFolder;
    emotionMap = new Map();
    constructor(context, customImagesFolder) {
        this.imagesFolder = (customImagesFolder && customImagesFolder.trim())
            ? customImagesFolder
            : context.asAbsolutePath('images');
    }
    /**
     * Scan the images folder and build the emotion → absolute-path map.
     */
    async scanImages() {
        this.emotionMap.clear();
        console.log('[ImageManager] Scanning images folder:', this.imagesFolder);
        let entries;
        try {
            // Try native fs first (more reliable for extension installation paths)
            if (!fs.existsSync(this.imagesFolder)) {
                console.warn('[ImageManager] Images folder does not exist:', this.imagesFolder);
                return;
            }
            const raw = fs.readdirSync(this.imagesFolder, { withFileTypes: true });
            entries = raw.map((d) => ({ name: d.name, isFile: d.isFile() }));
        }
        catch (err) {
            console.error('[ImageManager] Failed to read images folder:', err);
            return;
        }
        const imageExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']);
        for (const entry of entries) {
            if (!entry.isFile) {
                continue;
            }
            const ext = path.extname(entry.name).toLowerCase();
            if (!imageExts.has(ext)) {
                continue;
            }
            const label = path.basename(entry.name, ext).toLowerCase();
            const absPath = path.join(this.imagesFolder, entry.name);
            // First file wins if duplicate labels exist
            if (!this.emotionMap.has(label)) {
                this.emotionMap.set(label, absPath);
            }
        }
        console.log('[ImageManager] Scan complete. Found', this.emotionMap.size, 'images:', Array.from(this.emotionMap.entries()));
    }
    /**
     * Get the absolute image path for an emotion label.
     * Supports case-insensitive and fuzzy matching.
     */
    getImageForEmotion(emotion) {
        const normalized = this.normalizeEmotion(emotion);
        // Direct match
        if (this.emotionMap.has(normalized)) {
            return this.emotionMap.get(normalized);
        }
        // Try fuzzy aliases
        const aliased = this.fuzzyResolve(normalized);
        if (aliased && this.emotionMap.has(aliased)) {
            return this.emotionMap.get(aliased);
        }
        // Substring fallback — try to find a key that contains the query or vice-versa
        for (const [key, val] of this.emotionMap) {
            if (key.includes(normalized) || normalized.includes(key)) {
                return val;
            }
        }
        return undefined;
    }
    /**
     * Return all available emotion labels (lowercase, as derived from filenames).
     */
    getAvailableEmotions() {
        return Array.from(this.emotionMap.keys());
    }
    /**
     * Check whether an emotion image exists (uses the same fuzzy logic).
     */
    hasEmotion(emotion) {
        return this.getImageForEmotion(emotion) !== undefined;
    }
    // ── internal helpers ──────────────────────────────────────────────
    /**
     * Normalize an emotion string: lowercase, replace underscores/hyphens with spaces.
     */
    normalizeEmotion(emotion) {
        return emotion
            .toLowerCase()
            .replace(/[_-]+/g, ' ')
            .trim();
    }
    /**
     * Apply well-known fuzzy alias mappings.
     * Returns the canonical label if a match is found, otherwise `undefined`.
     */
    fuzzyResolve(normalized) {
        // "wtf" / "what" → "wdf is that"
        if (normalized === 'wtf' || normalized === 'what' || normalized === 'what is that') {
            return 'wdf is that';
        }
        // "veryhappy" (no space) → "very happy"
        if (normalized === 'veryhappy' || normalized === 'very happy') {
            return 'very happy';
        }
        // "angrycool" / "angry cool" / "angry_and_cool" → "angry and cool"
        if (normalized === 'angrycool' ||
            normalized === 'angry cool' ||
            normalized === 'angry and cool') {
            return 'angry and cool';
        }
        return undefined;
    }
}
exports.ImageManager = ImageManager;


/***/ }),
/* 3 */
/***/ ((module) => {

module.exports = require("path");

/***/ }),
/* 4 */
/***/ ((module) => {

module.exports = require("fs");

/***/ }),
/* 5 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CssInjector = void 0;
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(3));
const fs = __importStar(__webpack_require__(4));
/**
 * CssInjector — 通过修改 VS Code 的 workbench CSS 文件注入背景图片
 *
 * 这是业界标准方案（vscode-background 等插件均使用此方式）。
 * 安全保障：
 *   1. 注入前自动备份原始 CSS 文件（.backup）
 *   2. 通过唯一标记注释识别注入块，避免重复注入
 *   3. 禁用/卸载时自动从备份恢复
 *   4. dispose() 时自动清理
 */
class CssInjector {
    opacity;
    transitionDuration;
    cssPath = null;
    layerAImage = null;
    layerBImage = null;
    activeLayer = 'A';
    _isInjected = false;
    static MARKER_START = '/* ── mood-background-start ── */';
    static MARKER_END = '/* ── mood-background-end ── */';
    constructor(opacity = 0.15, transitionDuration = 1.5) {
        this.opacity = opacity;
        this.transitionDuration = transitionDuration;
    }
    // ── Public API ──────────────────────────────────────────────────────
    inject() {
        try {
            this.cssPath = this.resolveCssPath();
            if (!this.cssPath) {
                console.error('[mood-background] Could not locate workbench CSS file');
                vscode.window.showWarningMessage('Mood Background: Cannot locate VS Code CSS file');
                return;
            }
            if (!fs.existsSync(this.cssPath)) {
                console.error('[mood-background] CSS file not found:', this.cssPath);
                return;
            }
            this.backupIfNeeded();
            this._isInjected = true;
            this.reinject();
            console.log('[mood-background] CSS injected successfully');
        }
        catch (err) {
            console.error('[mood-background] inject failed:', err);
        }
    }
    restore() {
        try {
            if (!this.cssPath) {
                this.cssPath = this.resolveCssPath();
            }
            if (!this.cssPath) {
                return;
            }
            const backupPath = this.cssPath + '.mood-backup';
            if (!fs.existsSync(backupPath)) {
                // No backup — just strip our injected block
                this.stripInjection();
                return;
            }
            const backup = fs.readFileSync(backupPath, 'utf-8');
            fs.writeFileSync(this.cssPath, backup, 'utf-8');
            this._isInjected = false;
            console.log('[mood-background] CSS restored from backup');
        }
        catch (err) {
            console.error('[mood-background] restore failed:', err);
        }
    }
    isInjected() {
        return this._isInjected;
    }
    updateOpacity(opacity) {
        this.opacity = opacity;
        if (this._isInjected) {
            this.reinject();
        }
    }
    updateTransitionDuration(duration) {
        this.transitionDuration = duration;
        if (this._isInjected) {
            this.reinject();
        }
    }
    setInitialImage(imagePath) {
        this.layerAImage = imagePath;
        this.layerBImage = null;
        this.activeLayer = 'A';
        if (this._isInjected) {
            this.reinject();
        }
    }
    setCrossfadeImage(imagePath) {
        if (this.activeLayer === 'A') {
            this.layerBImage = imagePath;
        }
        else {
            this.layerAImage = imagePath;
        }
        if (this._isInjected) {
            this.reinject();
        }
    }
    swapActiveLayer() {
        this.activeLayer = this.activeLayer === 'A' ? 'B' : 'A';
        if (this._isInjected) {
            this.reinject();
        }
    }
    dispose() {
        this.restore();
    }
    // ── Private helpers ─────────────────────────────────────────────────
    reinject() {
        if (!this.cssPath || !fs.existsSync(this.cssPath)) {
            return;
        }
        try {
            const css = fs.readFileSync(this.cssPath, 'utf-8');
            const stripped = this.stripMarkerBlock(css);
            const block = this.buildCssBlock();
            fs.writeFileSync(this.cssPath, stripped + '\n' + block, 'utf-8');
        }
        catch (err) {
            console.error('[mood-background] reinject failed:', err);
        }
    }
    stripInjection() {
        if (!this.cssPath || !fs.existsSync(this.cssPath)) {
            return;
        }
        try {
            const css = fs.readFileSync(this.cssPath, 'utf-8');
            const stripped = this.stripMarkerBlock(css);
            fs.writeFileSync(this.cssPath, stripped, 'utf-8');
            this._isInjected = false;
        }
        catch (err) {
            console.error('[mood-background] stripInjection failed:', err);
        }
    }
    stripMarkerBlock(css) {
        const { MARKER_START, MARKER_END } = CssInjector;
        const startIdx = css.indexOf(MARKER_START);
        const endIdx = css.indexOf(MARKER_END);
        if (startIdx !== -1 && endIdx !== -1) {
            return css.slice(0, startIdx) + css.slice(endIdx + MARKER_END.length);
        }
        return css;
    }
    resolveCssPath() {
        const candidates = [];
        // Strategy 1: vscode.env.appRoot (most reliable)
        try {
            const appRoot = vscode.env.appRoot;
            if (appRoot) {
                candidates.push(path.join(appRoot, 'out', 'vs', 'workbench', 'workbench.desktop.main.css'), path.join(appRoot, 'vs', 'workbench', 'workbench.desktop.main.css'));
            }
        }
        catch { /* ignore */ }
        // Strategy 2: require.resolve walk-up
        try {
            const vscodeMain = /*require.resolve*/(1);
            let base = path.dirname(vscodeMain);
            for (let i = 0; i < 6; i++) {
                candidates.push(path.join(base, 'out', 'vs', 'workbench', 'workbench.desktop.main.css'), path.join(base, 'vs', 'workbench', 'workbench.desktop.main.css'));
                const parent = path.dirname(base);
                if (parent === base)
                    break;
                base = parent;
            }
        }
        catch { /* ignore */ }
        for (const c of candidates) {
            if (fs.existsSync(c)) {
                return c;
            }
        }
        return null;
    }
    backupIfNeeded() {
        if (!this.cssPath)
            return;
        const backupPath = this.cssPath + '.mood-backup';
        if (!fs.existsSync(backupPath)) {
            fs.copyFileSync(this.cssPath, backupPath);
            console.log('[mood-background] Backup created:', backupPath);
        }
    }
    toFileUri(filePath) {
        // Normalize Windows backslashes to forward slashes
        let normalized = filePath.replace(/\\/g, '/');
        // Ensure drive letter starts with slash (e.g., /d:/path)
        if (/^[A-Z]:/i.test(normalized) && !normalized.startsWith('/')) {
            normalized = '/' + normalized;
        }
        // Ensure exactly one "file:///" prefix
        return 'file://' + normalized;
    }
    buildCssBlock() {
        const { MARKER_START, MARKER_END } = CssInjector;
        const dur = this.transitionDuration + 's';
        let bgImage;
        let bgOpacity;
        if (this.activeLayer === 'A') {
            bgImage = this.layerAImage;
            bgOpacity = this.opacity;
        }
        else {
            bgImage = this.layerBImage ?? this.layerAImage;
            bgOpacity = this.opacity;
        }
        const bgUrl = bgImage ? `url('${this.toFileUri(bgImage)}')` : 'none';
        // 使用与 vscode-background 完全相同的选择器和策略
        // 核心路径: .editor-instance > .monaco-editor > .overflow-guard > .monaco-scrollable-element::before
        return `
${MARKER_START}
/* 移除编辑器默认背景色 */
[id='workbench.parts.editor'] .editor-container .overflow-guard > .monaco-scrollable-element > .monaco-editor-background {
  background: none !important;
}

/* 在 .monaco-scrollable-element 上用 ::before 伪元素显示背景图 */
[id='workbench.parts.editor'] .editor-instance > .monaco-editor > .overflow-guard > .monaco-scrollable-element::before {
  content: '';
  width: 100%;
  height: 100%;
  position: absolute;
  z-index: initial;
  pointer-events: none;
  transition: opacity ${dur} ease-in-out;
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;
  opacity: ${bgOpacity};
  background-image: ${bgUrl};
  mix-blend-mode: normal;
}

/* minimap 稍微透明 */
.minimap {
  opacity: 0.8;
}
${MARKER_END}
`;
    }
}
exports.CssInjector = CssInjector;


/***/ }),
/* 6 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.EmotionAnalyzer = void 0;
const vscode = __importStar(__webpack_require__(1));
const VALID_EMOTIONS = [
    'very happy',
    'angry and cool',
    'happy',
    'cool',
    'angry',
    'sad',
    'wdf',
];
const DEFAULT_EMOTION = 'happy';
class EmotionAnalyzer {
    linesToAnalyze;
    constructor(linesToAnalyze = 20) {
        this.linesToAnalyze = linesToAnalyze;
    }
    async analyze() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return DEFAULT_EMOTION;
        }
        const document = editor.document;
        if (document.lineCount === 0) {
            return DEFAULT_EMOTION;
        }
        const startLine = Math.max(0, document.lineCount - this.linesToAnalyze);
        const recentCode = document.getText(new vscode.Range(startLine, 0, document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length));
        if (!recentCode.trim()) {
            return DEFAULT_EMOTION;
        }
        try {
            const [model] = await vscode.lm.selectChatModels({
                vendor: 'copilot',
                family: 'gpt-4o',
            });
            if (!model) {
                return this.fallbackAnalyze(document);
            }
            const messages = [
                vscode.LanguageModelChatMessage.User(`你是一个代码质量情绪分析师。根据以下代码片段，选择一个最匹配的情绪标签。\n\n` +
                    `可选标签（必须从以下列表中选择一个）:\n` +
                    `- happy: 代码质量不错，结构清晰\n` +
                    `- cool: 代码写得出乎意料的好，有创意\n` +
                    `- angry: 代码质量很差，有明显问题\n` +
                    `- sad: 代码非常糟糕，让人沮丧\n` +
                    `- very happy: 代码非常优秀，令人赞叹\n` +
                    `- angry and cool: 代码有问题但也有亮点\n` +
                    `- wdf: 代码让人困惑，看不懂在写什么\n\n` +
                    `只输出一个标签，不要任何解释或额外文字。`),
                vscode.LanguageModelChatMessage.User(recentCode),
            ];
            const response = await model.sendRequest(messages, {});
            let result = '';
            for await (const fragment of response.text) {
                result += fragment;
            }
            return this.parseEmotion(result);
        }
        catch (error) {
            if (error instanceof vscode.LanguageModelError) {
                if (error.code === 'NotFound') {
                    console.warn('[EmotionAnalyzer] Language model not found, using fallback analysis.');
                    return this.fallbackAnalyze(document);
                }
                if (error.code === 'NoPermissions') {
                    console.warn('[EmotionAnalyzer] No permissions to access language model, using fallback analysis.');
                    return this.fallbackAnalyze(document);
                }
            }
            console.error('[EmotionAnalyzer] Unexpected error during emotion analysis:', error);
            return DEFAULT_EMOTION;
        }
    }
    parseEmotion(text) {
        const normalized = text.trim().toLowerCase();
        for (const label of VALID_EMOTIONS) {
            if (normalized.includes(label)) {
                return label;
            }
        }
        return DEFAULT_EMOTION;
    }
    fallbackAnalyze(document) {
        const diagnostics = vscode.languages.getDiagnostics(document.uri);
        const errorCount = diagnostics.filter((d) => d.severity === vscode.DiagnosticSeverity.Error).length;
        if (errorCount > 5) {
            return 'angry';
        }
        if (errorCount > 2) {
            return 'sad';
        }
        if (errorCount > 0) {
            return 'angry and cool';
        }
        return DEFAULT_EMOTION;
    }
    dispose() {
        // No resources to dispose
    }
}
exports.EmotionAnalyzer = EmotionAnalyzer;


/***/ }),
/* 7 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BackgroundRenderer = void 0;
/**
 * 背景渲染器 —— 管理情绪背景图片的 crossfade 平滑切换。
 *
 * 工作原理：
 *   1. CssInjector 维持两张图片在 ::before / ::after 上（图片地址不变）
 *   2. setCrossfadeImage() 将新图片写入非活跃层
 *   3. swapActiveLayer() 交换两层的 opacity → CSS transition 自动播放渐变
 *   4. setTimeout 等待动画完成后更新内部状态
 */
class BackgroundRenderer {
    cssInjector;
    currentImage = '';
    currentEmotion = '';
    isTransitioning = false;
    transitionDuration = 1500; // 默认 1.5s，单位 ms
    transitionTimer;
    constructor(cssInjector) {
        this.cssInjector = cssInjector;
    }
    /* ------------------------------------------------------------------ */
    /*  Public API                                                         */
    /* ------------------------------------------------------------------ */
    /**
     * 首次显示图片（无动画）。
     */
    setInitial(imagePath, emotion) {
        this.cssInjector.setInitialImage(imagePath);
        this.currentImage = imagePath;
        this.currentEmotion = emotion;
    }
    /**
     * 触发一次 crossfade 切换到新图片。
     * 如果目标图片与当前相同，或正在进行过渡，则忽略。
     */
    switchTo(imagePath, emotion) {
        // 首次显示，直接设置
        if (!this.currentImage) {
            this.setInitial(imagePath, emotion);
            return;
        }
        // 相同图片，无需切换
        if (imagePath === this.currentImage) {
            return;
        }
        // 正在过渡中，跳过（防抖）
        if (this.isTransitioning) {
            return;
        }
        this.isTransitioning = true;
        // Step 1: 将新图片设置到非活跃层（此时该层 opacity=0，不可见）
        this.cssInjector.setCrossfadeImage(imagePath);
        // Step 2: 切换活跃层 → 旧层 opacity→0，新层 opacity→目标值，CSS transition 自动播放
        this.cssInjector.swapActiveLayer();
        // Step 3: 等待 CSS transition 完成后更新内部状态
        this.transitionTimer = setTimeout(() => {
            this.currentImage = imagePath;
            this.currentEmotion = emotion;
            this.isTransitioning = false;
        }, this.transitionDuration);
    }
    /**
     * 返回当前正在显示的情绪标签。
     */
    getCurrentEmotion() {
        return this.currentEmotion;
    }
    /**
     * 设置过渡动画时长（毫秒）。
     * 应与 CSS 中的 transition-duration 保持一致。
     */
    setTransitionDuration(ms) {
        this.transitionDuration = Math.max(0, ms);
    }
    /**
     * 释放资源，取消正在进行的过渡定时器。
     */
    dispose() {
        if (this.transitionTimer !== undefined) {
            clearTimeout(this.transitionTimer);
            this.transitionTimer = undefined;
        }
        this.isTransitioning = false;
    }
}
exports.BackgroundRenderer = BackgroundRenderer;


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(0);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=extension.js.map