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
export declare class CssInjector {
    private opacity;
    private transitionDuration;
    private cssPath;
    private layerAImage;
    private layerBImage;
    private activeLayer;
    private _isInjected;
    private static readonly MARKER_START;
    private static readonly MARKER_END;
    constructor(opacity?: number, transitionDuration?: number);
    inject(): void;
    restore(): void;
    isInjected(): boolean;
    updateOpacity(opacity: number): void;
    updateTransitionDuration(duration: number): void;
    setInitialImage(imagePath: string): void;
    setCrossfadeImage(imagePath: string): void;
    swapActiveLayer(): void;
    dispose(): void;
    private reinject;
    private stripInjection;
    private stripMarkerBlock;
    private resolveCssPath;
    private backupIfNeeded;
    private toFileUri;
    private buildCssBlock;
}
//# sourceMappingURL=cssInjector.d.ts.map