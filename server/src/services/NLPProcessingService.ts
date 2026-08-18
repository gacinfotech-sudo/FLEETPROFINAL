// ============================================================================
// NLP PROCESSING SERVICE - Natural language processing
// Phase 5: Milestone 1 - AI & ML Enhancements
// ============================================================================

import {
  TextClassification,
  TextClassificationCategory,
  NERResult,
  Entity,
  SentimentAnalysisResult,
  TextSummary,
  NLPProcessingResult,
  SentimentType,
} from '../types/ai-ml.types';

/**
 * NLPProcessingService: Natural language processing engine
 * - Text classification
 * - Named entity recognition
 * - Sentiment analysis
 * - Keyword extraction
 * - Text summarization
 * - Language detection
 * - Spam/abuse detection
 * - Bias detection
 */
export class NLPProcessingService {
  private processingResults: Map<string, NLPProcessingResult> = new Map();
  private spamPatterns: string[] = [
    'click here',
    'free money',
    'win now',
    'limited offer',
    'act now',
    'urgent',
  ];
  private biasPatterns: string[] = [
    'always', 'never', 'everyone', 'no one', 'obviously', 'clearly',
  ];

  constructor() {
    this.initializeService();
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  private initializeService(): void {
    console.log('[NLPProcessingService] Service initialized');
  }

  // ========================================================================
  // TEXT CLASSIFICATION
  // ========================================================================

  /**
   * Classify text into categories
   */
  async classifyText(text: string): Promise<TextClassification> {
    const lowerText = text.toLowerCase();

    // Support category
    if (this.containsKeywords(lowerText, ['support', 'help', 'issue', 'problem', 'error'])) {
      return {
        text,
        category: TextClassificationCategory.SUPPORT,
        confidence: 0.85,
      };
    }

    // Sales category
    if (this.containsKeywords(lowerText, ['buy', 'price', 'upgrade', 'subscribe', 'plan', 'cost'])) {
      return {
        text,
        category: TextClassificationCategory.SALES,
        confidence: 0.88,
      };
    }

    // Product feedback
    if (this.containsKeywords(lowerText, ['feedback', 'review', 'opinion', 'think', 'experience'])) {
      return {
        text,
        category: TextClassificationCategory.PRODUCT_FEEDBACK,
        confidence: 0.82,
      };
    }

    // Bug report
    if (this.containsKeywords(lowerText, ['bug', 'broken', 'crash', 'fail', 'error', 'not working'])) {
      return {
        text,
        category: TextClassificationCategory.BUG_REPORT,
        confidence: 0.9,
      };
    }

    // Feature request
    if (this.containsKeywords(lowerText, ['feature', 'can we', 'would be', 'could you', 'add', 'implement'])) {
      return {
        text,
        category: TextClassificationCategory.FEATURE_REQUEST,
        confidence: 0.87,
      };
    }

    // Spam
    if (this.isLikelySpam(text)) {
      return {
        text,
        category: TextClassificationCategory.SPAM,
        confidence: 0.92,
      };
    }

    // Default
    return {
      text,
      category: TextClassificationCategory.SUPPORT,
      confidence: 0.4,
    };
  }

  /**
   * Check if text contains keywords
   */
  private containsKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  /**
   * Check if text is likely spam
   */
  private isLikelySpam(text: string): boolean {
    const lowerText = text.toLowerCase();
    const spamIndicators = this.spamPatterns.filter(pattern =>
      lowerText.includes(pattern)
    ).length;

    // Also check for unusual character patterns
    const specialCharCount = (text.match(/[!*$%^&@#]/g) || []).length;
    const wordCount = text.split(/\s+/).length;

    return spamIndicators >= 2 || (specialCharCount > wordCount * 0.2);
  }

  // ========================================================================
  // NAMED ENTITY RECOGNITION (NER)
  // ========================================================================

  /**
   * Extract named entities from text
   */
  async extractEntities(text: string): Promise<NERResult> {
    const entities: Entity[] = [];

    // Extract customer names (capitalized words)
    const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
    let match;
    while ((match = namePattern.exec(text)) !== null) {
      entities.push({
        type: 'PERSON',
        value: match[0],
        confidence: 0.7,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    // Extract dates
    const datePattern = /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b)/gi;
    while ((match = datePattern.exec(text)) !== null) {
      entities.push({
        type: 'DATE',
        value: match[0],
        confidence: 0.95,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    // Extract email addresses
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    while ((match = emailPattern.exec(text)) !== null) {
      entities.push({
        type: 'EMAIL',
        value: match[0],
        confidence: 0.99,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    // Extract phone numbers
    const phonePattern = /(\+?1?\s?)?(\([0-9]{3}\)|[0-9]{3})[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;
    while ((match = phonePattern.exec(text)) !== null) {
      entities.push({
        type: 'PHONE',
        value: match[0],
        confidence: 0.9,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    // Extract amounts
    const amountPattern = /\$\s?[\d,]+(?:\.\d{2})?|\d+\s?(?:dollars?|cents?)/gi;
    while ((match = amountPattern.exec(text)) !== null) {
      entities.push({
        type: 'MONEY',
        value: match[0],
        confidence: 0.85,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    return { text, entities };
  }

  // ========================================================================
  // SENTIMENT ANALYSIS
  // ========================================================================

  /**
   * Analyze sentiment of text
   */
  async analyzeSentiment(text: string): Promise<SentimentAnalysisResult> {
    const sentiment = this.calculateSentiment(text);
    const score = this.calculateSentimentScore(text);
    const confidence = this.calculateSentimentConfidence(text);

    return {
      text,
      sentiment,
      score,
      confidence,
    };
  }

  /**
   * Calculate sentiment type
   */
  private calculateSentiment(text: string): SentimentType {
    const lowerText = text.toLowerCase();

    // Positive indicators
    const positiveWords = [
      'great',
      'excellent',
      'amazing',
      'love',
      'perfect',
      'wonderful',
      'fantastic',
      'awesome',
      'thank',
    ];
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;

    // Negative indicators
    const negativeWords = [
      'terrible', 'awful', 'bad', 'hate', 'poor', 'worst', 'horrible', 'useless', 'broken',
    ];
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;

    if (positiveCount > negativeCount && positiveCount >= 2) {
      return SentimentType.POSITIVE;
    }
    if (negativeCount > positiveCount && negativeCount >= 2) {
      return SentimentType.NEGATIVE;
    }

    return SentimentType.NEUTRAL;
  }

  /**
   * Calculate sentiment score (-1 to 1)
   */
  private calculateSentimentScore(text: string): number {
    const lowerText = text.toLowerCase();

    const positiveWeight: Record<string, number> = {
      'great': 0.8,
      'excellent': 0.9,
      'amazing': 0.85,
      'love': 0.7,
      'perfect': 0.9,
      'thank': 0.6,
    };

    const negativeWeight: Record<string, number> = {
      'terrible': -0.9,
      'awful': -0.85,
      'bad': -0.6,
      'hate': -0.8,
      'poor': -0.7,
      'worst': -0.95,
    };

    let score = 0;
    for (const [word, weight] of Object.entries(positiveWeight)) {
      if (lowerText.includes(word)) score += weight;
    }
    for (const [word, weight] of Object.entries(negativeWeight)) {
      if (lowerText.includes(word)) score += weight;
    }

    return Math.max(-1, Math.min(1, score));
  }

  /**
   * Calculate sentiment confidence
   */
  private calculateSentimentConfidence(text: string): number {
    const words = text.split(/\s+/).length;
    const sentenceCount = text.split(/[.!?]+/).length;

    // More words and sentences = higher confidence
    let confidence = 0.5;
    if (words > 5) confidence += 0.2;
    if (words > 20) confidence += 0.15;
    if (sentenceCount > 1) confidence += 0.15;

    return Math.min(1, confidence);
  }

  // ========================================================================
  // KEYWORD EXTRACTION
  // ========================================================================

  /**
   * Extract keywords from text
   */
  async extractKeywords(text: string): Promise<string[]> {
    const words = text.toLowerCase()
      .split(/\s+/)
      .map(w => w.replace(/[^\w]/g, ''))
      .filter(w => w.length > 3);

    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'a', 'an', 'as', 'are', 'was', 'were',
      'and', 'or', 'but', 'in', 'to', 'for', 'of', 'with', 'by', 'from',
    ]);

    const keywords = [...new Set(words)].filter(w => !stopWords.has(w));
    return keywords.slice(0, 10); // Top 10 keywords
  }

  // ========================================================================
  // TEXT SUMMARIZATION
  // ========================================================================

  /**
   * Summarize text
   */
  async summarizeText(text: string, summaryLength: number = 50): Promise<TextSummary> {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Simple extractive summarization
    const scored = sentences.map((sentence, index) => ({
      sentence: sentence.trim(),
      score: this.calculateSentenceScore(sentence),
      originalIndex: index,
    }));

    const topSentences = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.ceil(sentences.length * 0.3))
      .sort((a, b) => a.originalIndex - b.originalIndex);

    const summary = topSentences.map(s => s.sentence).join('. ') + '.';

    // Extract key points
    const keyPoints = topSentences.slice(0, 3).map(s => s.sentence);

    return {
      originalText: text,
      summary,
      keyPoints,
      length: summary.length,
    };
  }

  /**
   * Calculate sentence importance score
   */
  private calculateSentenceScore(sentence: string): number {
    let score = 0;

    // Longer sentences tend to be more informative
    score += Math.min(sentence.split(/\s+/).length / 20, 1);

    // Keywords presence
    const importantWords = ['important', 'critical', 'urgent', 'key', 'significant'];
    score += importantWords.filter(w => sentence.toLowerCase().includes(w)).length * 0.2;

    // Capital letters (proper nouns)
    const capitals = (sentence.match(/[A-Z]/g) || []).length;
    score += Math.min(capitals / 5, 0.5);

    return score;
  }

  // ========================================================================
  // LANGUAGE DETECTION
  // ========================================================================

  /**
   * Detect language of text
   */
  async detectLanguage(text: string): Promise<string> {
    // Simplified language detection based on character patterns
    if (/[؀-ۿ]/.test(text)) return 'ar'; // Arabic
    if (/[А-я]/.test(text)) return 'ru'; // Russian
    if (/[一-鿿]/.test(text)) return 'zh'; // Chinese
    if (/[ऀ-ॿ]/.test(text)) return 'hi'; // Hindi
    if (/[฀-๿]/.test(text)) return 'th'; // Thai

    // For Latin-based languages, check for common patterns
    const lowerText = text.toLowerCase();

    // French indicators
    if (this.containsKeywords(lowerText, ['de', 'la', 'le', 'et', 'un', 'une', 'le'])) {
      return 'fr';
    }

    // Spanish indicators
    if (this.containsKeywords(lowerText, ['el', 'la', 'de', 'que', 'un', 'una'])) {
      return 'es';
    }

    // German indicators
    if (this.containsKeywords(lowerText, ['der', 'die', 'das', 'und', 'ein', 'eine'])) {
      return 'de';
    }

    // Default to English
    return 'en';
  }

  // ========================================================================
  // ABUSE & BIAS DETECTION
  // ========================================================================

  /**
   * Detect if text is spam/abuse
   */
  async detectSpam(text: string): Promise<boolean> {
    return this.isLikelySpam(text);
  }

  /**
   * Detect bias in text
   */
  async detectBias(text: string): Promise<boolean> {
    const biasCount = this.biasPatterns.filter(pattern =>
      text.toLowerCase().includes(pattern)
    ).length;

    // Additional bias indicators
    const absoluteLanguage = /^(always|never|everyone|no one|obviously|clearly)/gi;
    const hasAbsoluteLanguage = absoluteLanguage.test(text);

    return biasCount >= 2 || hasAbsoluteLanguage;
  }

  // ========================================================================
  // COMPLETE PROCESSING
  // ========================================================================

  /**
   * Process text completely
   */
  async processText(tenantId: string, text: string): Promise<NLPProcessingResult> {
    const processingId = this.generateProcessingId();
    const startTime = Date.now();

    const [classification, entities, sentiment, keywords, language, isSpam, hasBias] = await Promise.all([
      this.classifyText(text),
      this.extractEntities(text),
      this.analyzeSentiment(text),
      this.extractKeywords(text),
      this.detectLanguage(text),
      this.detectSpam(text),
      this.detectBias(text),
    ]);

    const processingTime = Date.now() - startTime;

    const result: NLPProcessingResult = {
      id: processingId,
      tenantId,
      text,
      classification,
      entities: entities.entities,
      sentiment,
      keywords,
      language,
      isSpam,
      hasBias,
      processingTime,
      timestamp: new Date(),
    };

    this.processingResults.set(processingId, result);
    return result;
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  /**
   * Get processing result
   */
  async getProcessingResult(id: string): Promise<NLPProcessingResult | null> {
    return this.processingResults.get(id) || null;
  }

  private generateProcessingId(): string {
    return `nlp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const nlpProcessingService = new NLPProcessingService();
