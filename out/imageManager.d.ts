import * as vscode from 'vscode';
/**
 * Maps emotion labels to image file paths.
 * Scans an `images/` directory and provides fuzzy-matching lookup.
 */
export declare class ImageManager {
    private readonly imagesFolder;
    private emotionMap;
    constructor(context: vscode.ExtensionContext, customImagesFolder?: string);
    /**
     * Scan the images folder and build the emotion → absolute-path map.
     */
    scanImages(): Promise<void>;
    /**
     * Get the absolute image path for an emotion label.
     * Supports case-insensitive and fuzzy matching.
     */
    getImageForEmotion(emotion: string): string | undefined;
    /**
     * Return all available emotion labels (lowercase, as derived from filenames).
     */
    getAvailableEmotions(): string[];
    /**
     * Check whether an emotion image exists (uses the same fuzzy logic).
     */
    hasEmotion(emotion: string): boolean;
    /**
     * Normalize an emotion string: lowercase, replace underscores/hyphens with spaces.
     */
    private normalizeEmotion;
    /**
     * Apply well-known fuzzy alias mappings.
     * Returns the canonical label if a match is found, otherwise `undefined`.
     */
    private fuzzyResolve;
}
//# sourceMappingURL=imageManager.d.ts.map