import * as vscode from 'vscode';

/**
 * CssInjector — uses VS Code editor decorations as a safe wallpaper layer.
 * It deliberately avoids modifying VS Code installation files, so enabling or
 * disabling the extension cannot corrupt the user's production editor install.
 */
export class CssInjector {
    private opacity: number;
    private transitionDuration: number;
    private layerAImage: string | null = null;
    private layerBImage: string | null = null;
    private activeLayer: 'A' | 'B' = 'A';
    private _isInjected: boolean = false;
    private layerADecoration: vscode.TextEditorDecorationType | undefined;
    private layerBDecoration: vscode.TextEditorDecorationType | undefined;
    private animationTimer: ReturnType<typeof setTimeout> | undefined;
    private readonly framesPerSecond = 24;

    constructor(opacity: number = 0.15, transitionDuration: number = 1.5) {
        this.opacity = opacity;
        this.transitionDuration = transitionDuration;
    }

    // ── Public API ──────────────────────────────────────────────────────

    inject(): void {
        this._isInjected = true;
        this.render();
    }

    restore(): void {
        this.stopAnimation();
        this.disposeDecorations();
        this._isInjected = false;
    }

    isInjected(): boolean {
        return this._isInjected;
    }

    updateOpacity(opacity: number): void {
        this.opacity = opacity;
        if (this._isInjected) {
            this.render();
        }
    }

    updateTransitionDuration(duration: number): void {
        this.transitionDuration = duration;
    }

    setInitialImage(imagePath: string): void {
        this.layerAImage = imagePath;
        this.layerBImage = null;
        this.activeLayer = 'A';
        if (this._isInjected) {
            this.render();
        }
    }

    setCrossfadeImage(imagePath: string): void {
        if (this.activeLayer === 'A') {
            this.layerBImage = imagePath;
        } else {
            this.layerAImage = imagePath;
        }
        if (this._isInjected) {
            this.render(this.activeLayer === 'A' ? this.opacity : 0, this.activeLayer === 'B' ? this.opacity : 0);
        }
    }

    swapActiveLayer(): void {
        const fromLayer = this.activeLayer;
        this.activeLayer = this.activeLayer === 'A' ? 'B' : 'A';
        if (!this._isInjected) {
            return;
        }

        this.animateCrossfade(fromLayer, this.activeLayer);
    }

    applyToVisibleEditors(): void {
        if (this._isInjected) {
            this.render();
        }
    }

    dispose(): void {
        this.restore();
    }

    // ── Private helpers ─────────────────────────────────────────────────

    private render(layerAOpacity?: number, layerBOpacity?: number): void {
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

    private applyToEditor(editor: vscode.TextEditor): void {
        const range = new vscode.Range(0, 0, 0, 0);
        if (this.layerADecoration) {
            editor.setDecorations(this.layerADecoration, [range]);
        }
        if (this.layerBDecoration) {
            editor.setDecorations(this.layerBDecoration, [range]);
        }
    }

    private animateCrossfade(fromLayer: 'A' | 'B', toLayer: 'A' | 'B'): void {
        this.stopAnimation();

        const durationMs = Math.max(0, this.transitionDuration * 1000);
        if (durationMs === 0) {
            this.render();
            return;
        }

        const frameMs = Math.max(16, Math.floor(1000 / this.framesPerSecond));
        const startedAt = Date.now();

        const tick = (): void => {
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

    private createLayerDecoration(imagePath: string, layerOpacity: number): vscode.TextEditorDecorationType {
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

    private disposeDecorations(): void {
        this.layerADecoration?.dispose();
        this.layerBDecoration?.dispose();
        this.layerADecoration = undefined;
        this.layerBDecoration = undefined;
    }

    private stopAnimation(): void {
        if (this.animationTimer !== undefined) {
            clearTimeout(this.animationTimer);
            this.animationTimer = undefined;
        }
    }

    private clampOpacity(value: number): number {
        return Math.min(1, Math.max(0, value));
    }

    private easeInOut(progress: number): number {
        return progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    }
}
