import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

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
export class CssInjector {
    private opacity: number;
    private transitionDuration: number;
    private cssPath: string | null = null;
    private layerAImage: string | null = null;
    private layerBImage: string | null = null;
    private activeLayer: 'A' | 'B' = 'A';
    private _isInjected: boolean = false;

    private static readonly MARKER_START = '/* ── mood-background-start ── */';
    private static readonly MARKER_END = '/* ── mood-background-end ── */';

    constructor(opacity: number = 0.15, transitionDuration: number = 1.5) {
        this.opacity = opacity;
        this.transitionDuration = transitionDuration;
    }

    // ── Public API ──────────────────────────────────────────────────────

    inject(): void {
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
        } catch (err) {
            console.error('[mood-background] inject failed:', err);
        }
    }

    restore(): void {
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
        } catch (err) {
            console.error('[mood-background] restore failed:', err);
        }
    }

    isInjected(): boolean {
        return this._isInjected;
    }

    updateOpacity(opacity: number): void {
        this.opacity = opacity;
        if (this._isInjected) {
            this.reinject();
        }
    }

    updateTransitionDuration(duration: number): void {
        this.transitionDuration = duration;
        if (this._isInjected) {
            this.reinject();
        }
    }

    setInitialImage(imagePath: string): void {
        this.layerAImage = imagePath;
        this.layerBImage = null;
        this.activeLayer = 'A';
        if (this._isInjected) {
            this.reinject();
        }
    }

    setCrossfadeImage(imagePath: string): void {
        if (this.activeLayer === 'A') {
            this.layerBImage = imagePath;
        } else {
            this.layerAImage = imagePath;
        }
        if (this._isInjected) {
            this.reinject();
        }
    }

    swapActiveLayer(): void {
        this.activeLayer = this.activeLayer === 'A' ? 'B' : 'A';
        if (this._isInjected) {
            this.reinject();
        }
    }

    dispose(): void {
        this.restore();
    }

    // ── Private helpers ─────────────────────────────────────────────────

    private reinject(): void {
        if (!this.cssPath || !fs.existsSync(this.cssPath)) {
            return;
        }
        try {
            const css = fs.readFileSync(this.cssPath, 'utf-8');
            const stripped = this.stripMarkerBlock(css);
            const block = this.buildCssBlock();
            fs.writeFileSync(this.cssPath, stripped + '\n' + block, 'utf-8');
        } catch (err) {
            console.error('[mood-background] reinject failed:', err);
        }
    }

    private stripInjection(): void {
        if (!this.cssPath || !fs.existsSync(this.cssPath)) {
            return;
        }
        try {
            const css = fs.readFileSync(this.cssPath, 'utf-8');
            const stripped = this.stripMarkerBlock(css);
            fs.writeFileSync(this.cssPath, stripped, 'utf-8');
            this._isInjected = false;
        } catch (err) {
            console.error('[mood-background] stripInjection failed:', err);
        }
    }

    private stripMarkerBlock(css: string): string {
        const { MARKER_START, MARKER_END } = CssInjector;
        const startIdx = css.indexOf(MARKER_START);
        const endIdx = css.indexOf(MARKER_END);
        if (startIdx !== -1 && endIdx !== -1) {
            return css.slice(0, startIdx) + css.slice(endIdx + MARKER_END.length);
        }
        return css;
    }

    private resolveCssPath(): string | null {
        const candidates: string[] = [];

        // Strategy 1: vscode.env.appRoot (most reliable)
        try {
            const appRoot = vscode.env.appRoot;
            if (appRoot) {
                candidates.push(
                    path.join(appRoot, 'out', 'vs', 'workbench', 'workbench.desktop.main.css'),
                    path.join(appRoot, 'vs', 'workbench', 'workbench.desktop.main.css'),
                );
            }
        } catch { /* ignore */ }

        // Strategy 2: require.resolve walk-up
        try {
            const vscodeMain = require.resolve('vscode');
            let base = path.dirname(vscodeMain);
            for (let i = 0; i < 6; i++) {
                candidates.push(
                    path.join(base, 'out', 'vs', 'workbench', 'workbench.desktop.main.css'),
                    path.join(base, 'vs', 'workbench', 'workbench.desktop.main.css'),
                );
                const parent = path.dirname(base);
                if (parent === base) break;
                base = parent;
            }
        } catch { /* ignore */ }

        for (const c of candidates) {
            if (fs.existsSync(c)) {
                return c;
            }
        }
        return null;
    }

    private backupIfNeeded(): void {
        if (!this.cssPath) return;
        const backupPath = this.cssPath + '.mood-backup';
        if (!fs.existsSync(backupPath)) {
            fs.copyFileSync(this.cssPath, backupPath);
            console.log('[mood-background] Backup created:', backupPath);
        }
    }

    private toFileUri(filePath: string): string {
        // Normalize Windows backslashes to forward slashes
        let normalized = filePath.replace(/\\/g, '/');
        // Ensure drive letter starts with slash (e.g., /d:/path)
        if (/^[A-Z]:/i.test(normalized) && !normalized.startsWith('/')) {
            normalized = '/' + normalized;
        }
        // Ensure exactly one "file:///" prefix
        return 'file://' + normalized;
    }

    private buildCssBlock(): string {
        const { MARKER_START, MARKER_END } = CssInjector;
        const dur = this.transitionDuration + 's';

        let bgImage: string | null;
        let bgOpacity: number;

        if (this.activeLayer === 'A') {
            bgImage = this.layerAImage;
            bgOpacity = this.opacity;
        } else {
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
