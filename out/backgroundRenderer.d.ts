import { CssInjector } from './cssInjector';
/**
 * 背景渲染器 —— 管理情绪背景图片的 crossfade 平滑切换。
 *
 * 工作原理：
 *   1. CssInjector 维持两张图片在 ::before / ::after 上（图片地址不变）
 *   2. setCrossfadeImage() 将新图片写入非活跃层
 *   3. swapActiveLayer() 交换两层的 opacity → CSS transition 自动播放渐变
 *   4. setTimeout 等待动画完成后更新内部状态
 */
export declare class BackgroundRenderer {
    private readonly cssInjector;
    private currentImage;
    private currentEmotion;
    private isTransitioning;
    private transitionDuration;
    private transitionTimer;
    constructor(cssInjector: CssInjector);
    /**
     * 首次显示图片（无动画）。
     */
    setInitial(imagePath: string, emotion: string): void;
    /**
     * 触发一次 crossfade 切换到新图片。
     * 如果目标图片与当前相同，或正在进行过渡，则忽略。
     */
    switchTo(imagePath: string, emotion: string): void;
    /**
     * 返回当前正在显示的情绪标签。
     */
    getCurrentEmotion(): string;
    /**
     * 设置过渡动画时长（毫秒）。
     * 应与 CSS 中的 transition-duration 保持一致。
     */
    setTransitionDuration(ms: number): void;
    /**
     * 释放资源，取消正在进行的过渡定时器。
     */
    dispose(): void;
}
//# sourceMappingURL=backgroundRenderer.d.ts.map