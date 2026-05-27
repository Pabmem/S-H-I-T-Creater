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
export class BackgroundRenderer {
    private currentImage: string = '';
    private currentEmotion: string = '';
    private isTransitioning: boolean = false;
    private transitionDuration: number = 1500; // 默认 1.5s，单位 ms
    private transitionTimer: ReturnType<typeof setTimeout> | undefined;

    constructor(private readonly cssInjector: CssInjector) {}

    /* ------------------------------------------------------------------ */
    /*  Public API                                                         */
    /* ------------------------------------------------------------------ */

    /**
     * 首次显示图片（无动画）。
     */
    public setInitial(imagePath: string, emotion: string): void {
        this.cssInjector.setInitialImage(imagePath);
        this.currentImage = imagePath;
        this.currentEmotion = emotion;
    }

    /**
     * 触发一次 crossfade 切换到新图片。
     * 如果目标图片与当前相同，或正在进行过渡，则忽略。
     */
    public switchTo(imagePath: string, emotion: string): void {
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
    public getCurrentEmotion(): string {
        return this.currentEmotion;
    }

    /**
     * 设置过渡动画时长（毫秒）。
     * 应与 CSS 中的 transition-duration 保持一致。
     */
    public setTransitionDuration(ms: number): void {
        this.transitionDuration = Math.max(0, ms);
    }

    /**
     * 释放资源，取消正在进行的过渡定时器。
     */
    public dispose(): void {
        if (this.transitionTimer !== undefined) {
            clearTimeout(this.transitionTimer);
            this.transitionTimer = undefined;
        }
        this.isTransitioning = false;
    }
}
