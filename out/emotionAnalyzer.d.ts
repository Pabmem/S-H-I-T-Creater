import * as vscode from 'vscode';
export declare class EmotionAnalyzer implements vscode.Disposable {
    private readonly linesToAnalyze;
    constructor(linesToAnalyze?: number);
    analyze(): Promise<string>;
    private parseEmotion;
    private fallbackAnalyze;
    dispose(): void;
}
//# sourceMappingURL=emotionAnalyzer.d.ts.map