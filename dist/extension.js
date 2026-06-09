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
let editRefreshTimer;
let cssInjectorInstance;
async function activate(context) {
    try {
        const config = vscode.workspace.getConfiguration('moodBackground');
        let enabled = config.get('enabled', true);
        const imageManager = new imageManager_1.ImageManager(context, config.get('imagesFolder', ''));
        await imageManager.scanImages();
        const cssInjector = new cssInjector_1.CssInjector(config.get('opacity', 0.15), config.get('transitionDuration', 1.5));
        cssInjectorInstance = cssInjector;
        let analyzer = new emotionAnalyzer_1.EmotionAnalyzer(config.get('linesToAnalyze', 20));
        const renderer = new backgroundRenderer_1.BackgroundRenderer(cssInjector);
        renderer.setTransitionDuration(config.get('transitionDuration', 1.5) * 1000);
        context.subscriptions.push(cssInjector, renderer, analyzer);
        if (enabled) {
            cssInjector.inject();
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
                return;
            }
            try {
                const emotion = await analyzer.analyze();
                const imagePath = imageManager.getImageForEmotion(emotion);
                if (imagePath) {
                    renderer.switchTo(imagePath, emotion);
                }
                else {
                    const fallbackImage = imageManager.getImageForEmotion('happy');
                    if (fallbackImage) {
                        renderer.switchTo(fallbackImage, 'happy');
                    }
                }
                statusBar.text = `$(paintcan) Mood: ${emotion}`;
            }
            catch (err) {
                console.error('[MoodBackground] refreshEmotion error:', err);
            }
        }
        function scheduleEditRefresh() {
            if (!enabled) {
                return;
            }
            if (editRefreshTimer !== undefined) {
                clearTimeout(editRefreshTimer);
            }
            editRefreshTimer = setTimeout(() => {
                editRefreshTimer = undefined;
                refreshEmotion();
            }, 3000);
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
            if (editRefreshTimer !== undefined) {
                clearTimeout(editRefreshTimer);
                editRefreshTimer = undefined;
            }
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
        context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event) => {
            if (event.document === vscode.window.activeTextEditor?.document) {
                scheduleEditRefresh();
            }
        }));
        context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => {
            cssInjector.applyToVisibleEditors();
            scheduleEditRefresh();
        }));
        context.subscriptions.push(vscode.window.onDidChangeVisibleTextEditors(() => {
            cssInjector.applyToVisibleEditors();
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
                const duration = cfg.get('transitionDuration', 1.5);
                renderer.setTransitionDuration(duration * 1000);
                cssInjector.updateTransitionDuration(duration);
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
                analyzer.dispose();
                analyzer = new emotionAnalyzer_1.EmotionAnalyzer(cfg.get('linesToAnalyze', 20));
                await refreshEmotion();
            }
            if (e.affectsConfiguration('moodBackground.imagesFolder')) {
                await imageManager.setImagesFolder(cfg.get('imagesFolder', ''));
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
    defaultImagesFolder;
    constructor(context, customImagesFolder) {
        this.defaultImagesFolder = context.asAbsolutePath('images');
        this.imagesFolder = this.resolveImagesFolder(customImagesFolder);
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
    async setImagesFolder(customImagesFolder) {
        this.imagesFolder = this.resolveImagesFolder(customImagesFolder);
        await this.scanImages();
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
    resolveImagesFolder(customImagesFolder) {
        return (customImagesFolder && customImagesFolder.trim())
            ? customImagesFolder.trim()
            : this.defaultImagesFolder;
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
/**
 * CssInjector — uses VS Code editor decorations as a safe wallpaper layer.
 * It deliberately avoids modifying VS Code installation files, so enabling or
 * disabling the extension cannot corrupt the user's production editor install.
 */
class CssInjector {
    opacity;
    transitionDuration;
    layerAImage = null;
    layerBImage = null;
    activeLayer = 'A';
    _isInjected = false;
    layerADecoration;
    layerBDecoration;
    animationTimer;
    framesPerSecond = 24;
    constructor(opacity = 0.15, transitionDuration = 1.5) {
        this.opacity = opacity;
        this.transitionDuration = transitionDuration;
    }
    // ── Public API ──────────────────────────────────────────────────────
    inject() {
        this._isInjected = true;
        this.render();
    }
    restore() {
        this.stopAnimation();
        this.disposeDecorations();
        this._isInjected = false;
    }
    isInjected() {
        return this._isInjected;
    }
    updateOpacity(opacity) {
        this.opacity = opacity;
        if (this._isInjected) {
            this.render();
        }
    }
    updateTransitionDuration(duration) {
        this.transitionDuration = duration;
    }
    setInitialImage(imagePath) {
        this.layerAImage = imagePath;
        this.layerBImage = null;
        this.activeLayer = 'A';
        if (this._isInjected) {
            this.render();
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
            this.render(this.activeLayer === 'A' ? this.opacity : 0, this.activeLayer === 'B' ? this.opacity : 0);
        }
    }
    swapActiveLayer() {
        const fromLayer = this.activeLayer;
        this.activeLayer = this.activeLayer === 'A' ? 'B' : 'A';
        if (!this._isInjected) {
            return;
        }
        this.animateCrossfade(fromLayer, this.activeLayer);
    }
    applyToVisibleEditors() {
        if (this._isInjected) {
            this.render();
        }
    }
    dispose() {
        this.restore();
    }
    // ── Private helpers ─────────────────────────────────────────────────
    render(layerAOpacity, layerBOpacity) {
        if (!this._isInjected) {
            return;
        }
        const opacityA = layerAOpacity ?? (this.activeLayer === 'A' ? this.opacity : 0);
        const opacityB = layerBOpacity ?? (this.activeLayer === 'B' ? this.opacity : 0);
        this.disposeDecorations();
        if (this.layerAImage) {
            this.layerADecoration = this.createLayerDecoration(this.layerAImage, opacityA);
        }
        if (this.layerBImage) {
            this.layerBDecoration = this.createLayerDecoration(this.layerBImage, opacityB);
        }
        for (const editor of vscode.window.visibleTextEditors) {
            this.applyToEditor(editor);
        }
    }
    applyToEditor(editor) {
        const range = new vscode.Range(0, 0, 0, 0);
        if (this.layerADecoration) {
            editor.setDecorations(this.layerADecoration, [range]);
        }
        if (this.layerBDecoration) {
            editor.setDecorations(this.layerBDecoration, [range]);
        }
    }
    animateCrossfade(fromLayer, toLayer) {
        this.stopAnimation();
        const durationMs = Math.max(0, this.transitionDuration * 1000);
        if (durationMs === 0) {
            this.render();
            return;
        }
        const frameMs = Math.max(16, Math.floor(1000 / this.framesPerSecond));
        const startedAt = Date.now();
        const tick = () => {
            const progress = Math.min(1, (Date.now() - startedAt) / durationMs);
            const eased = this.easeInOut(progress);
            const fromOpacity = this.opacity * (1 - eased);
            const toOpacity = this.opacity * eased;
            const layerAOpacity = fromLayer === 'A' ? fromOpacity : (toLayer === 'A' ? toOpacity : 0);
            const layerBOpacity = fromLayer === 'B' ? fromOpacity : (toLayer === 'B' ? toOpacity : 0);
            this.render(layerAOpacity, layerBOpacity);
            if (progress >= 1) {
                this.stopAnimation();
                this.render();
                return;
            }
            this.animationTimer = setTimeout(tick, frameMs);
        };
        this.animationTimer = setTimeout(tick, frameMs);
    }
    createLayerDecoration(imagePath, layerOpacity) {
        return vscode.window.createTextEditorDecorationType({
            isWholeLine: true,
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
            before: {
                contentIconPath: vscode.Uri.file(imagePath),
                width: '100vw',
                height: '100vh',
                margin: '0 0 0 0',
                textDecoration: [
                    'none',
                    'position: fixed',
                    'inset: 0',
                    'z-index: 0',
                    'pointer-events: none',
                    `opacity: ${this.clampOpacity(layerOpacity)}`,
                    'background-size: cover !important',
                    'background-position: center center !important',
                    'background-repeat: no-repeat !important',
                    'mix-blend-mode: normal',
                ].join('; '),
            },
        });
    }
    disposeDecorations() {
        this.layerADecoration?.dispose();
        this.layerBDecoration?.dispose();
        this.layerADecoration = undefined;
        this.layerBDecoration = undefined;
    }
    stopAnimation() {
        if (this.animationTimer !== undefined) {
            clearTimeout(this.animationTimer);
            this.animationTimer = undefined;
        }
    }
    clampOpacity(value) {
        return Math.min(1, Math.max(0, value));
    }
    easeInOut(progress) {
        return progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
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
        const cursorLine = editor.selection.active.line;
        const endLine = Math.min(document.lineCount - 1, cursorLine);
        const startLine = Math.max(0, endLine - this.linesToAnalyze + 1);
        const recentCode = document.getText(new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length));
        if (!recentCode.trim()) {
            return DEFAULT_EMOTION;
        }
        try {
            const [model] = await vscode.lm.selectChatModels({
                vendor: 'copilot',
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
            return 'sad';
        }
        if (errorCount > 2) {
            return 'angry';
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