/**
 * CssInjector — uses VS Code editor decorations as a safe wallpaper layer.
 * It deliberately avoids modifying VS Code installation files, so enabling or
 * disabling the extension cannot corrupt the user's production editor install.
 */
export declare class CssInjector {
    private opacity;
    private transitionDuration;
    private layerAImage;
    private layerBImage;
    private activeLayer;
    private _isInjected;
    private layerADecoration;
    private layerBDecoration;
    private animationTimer;
    private readonly framesPerSecond;
    constructor(opacity?: number, transitionDuration?: number);
    inject(): void;
    restore(): void;
    isInjected(): boolean;
    updateOpacity(opacity: number): void;
    updateTransitionDuration(duration: number): void;
    setInitialImage(imagePath: string): void;
    setCrossfadeImage(imagePath: string): void;
    swapActiveLayer(): void;
    applyToVisibleEditors(): void;
    dispose(): void;
    private render;
    private applyToEditor;
    private animateCrossfade;
    private createLayerDecoration;
    private disposeDecorations;
    private stopAnimation;
    private clampOpacity;
    private easeInOut;
}
//# sourceMappingURL=cssInjector.d.ts.map