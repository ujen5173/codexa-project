/**
 * BM25 (Best Matching 25) Search Ranking Algorithm
 *
 * BM25 is a probabilistic ranking function that improves upon TF-IDF
 * by considering term frequency saturation and document length normalization.
 */

interface BM25Config {
  k1?: number; // Term frequency saturation parameter (default: 1.5)
  b?: number; // Length normalization parameter (default: 0.75)
}

interface Document {
  id: string;
  text: string;
  title?: string;
  subtitle?: string;
  tags?: string[];
}

interface ScoredDocument extends Document {
  score: number;
}

/**
 * Simple tokenizer - splits text into words and normalizes
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2); // Filter out very short words
}

/**
 * Stop words list (common English words to ignore)
 */
const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "as",
  "is",
  "was",
  "are",
  "were",
  "been",
  "be",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "should",
  "could",
  "may",
  "might",
  "must",
  "can",
  "this",
  "that",
  "these",
  "those",
  "i",
  "you",
  "he",
  "she",
  "it",
  "we",
  "they",
  "what",
  "which",
  "who",
  "when",
  "where",
  "why",
  "how",
]);

/**
 * Calculate term frequency for a term in a document
 */
function calculateTF(term: string, tokens: string[]): number {
  return tokens.filter((token) => token === term).length;
}

/**
 * Calculate Inverse Document Frequency (IDF)
 */
function calculateIDF(
  term: string,
  documents: Document[],
  allTokens: Map<string, Set<string>>,
): number {
  const N = documents.length;
  const n = allTokens.get(term)?.size ?? 0;

  if (n === 0) return 0;

  // IDF formula: log((N - n + 0.5) / (n + 0.5))
  return Math.log((N - n + 0.5) / (n + 0.5));
}

/**
 * Calculate average document length
 */
function calculateAvgDocLength(documents: Document[]): number {
  const totalLength = documents.reduce((sum, doc) => {
    const tokens = tokenize(doc.text);
    return sum + tokens.length;
  }, 0);

  return documents.length > 0 ? totalLength / documents.length : 0;
}

/**
 * Build inverted index: term -> set of document IDs containing the term
 */
function buildInvertedIndex(documents: Document[]): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();

  for (const doc of documents) {
    const tokens = tokenize(doc.text);
    const uniqueTokens = new Set(tokens);

    for (const token of uniqueTokens) {
      if (!STOP_WORDS.has(token)) {
        if (!index.has(token)) {
          index.set(token, new Set());
        }
        index.get(token)!.add(doc.id);
      }
    }
  }

  return index;
}

/**
 * Calculate BM25 score for a query against a document
 */
function calculateBM25Score(
  query: string,
  document: Document,
  allDocuments: Document[],
  invertedIndex: Map<string, Set<string>>,
  avgDocLength: number,
  config: BM25Config = {},
): number {
  const { k1 = 1.5, b = 0.75 } = config;

  const queryTokens = tokenize(query);
  const docTokens = tokenize(document.text);
  const docLength = docTokens.length;

  let score = 0;

  for (const term of queryTokens) {
    if (STOP_WORDS.has(term)) continue;

    // Calculate IDF
    const idf = calculateIDF(term, allDocuments, invertedIndex);
    if (idf <= 0) continue;

    // Calculate TF
    const tf = calculateTF(term, docTokens);

    // Apply boost factors for title, subtitle, and tags
    let boost = 1.0;
    const termLower = term.toLowerCase();

    if (document.title?.toLowerCase().includes(termLower)) {
      boost = 2.0; // Title match boost
    } else if (document.subtitle?.toLowerCase().includes(termLower)) {
      boost = 1.5; // Subtitle match boost
    } else if (
      document.tags?.some((tag) => tag.toLowerCase().includes(termLower))
    ) {
      boost = 1.3; // Tag match boost
    }

    // BM25 formula: IDF × (TF × (k1 + 1)) / (TF + k1 × (1 - b + b × |d| / avgdl))
    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength));
    const termScore = (idf * numerator) / denominator;

    score += termScore * boost;
  }

  return score;
}

/**
 * Rank documents using BM25 algorithm
 *
 * @param query - Search query string
 * @param documents - Array of documents to search
 * @param config - BM25 configuration parameters
 * @returns Array of documents sorted by relevance score (descending)
 */
export function rankDocumentsWithBM25(
  query: string,
  documents: Document[],
  config: BM25Config = {},
): ScoredDocument[] {
  if (!query.trim() || documents.length === 0) {
    return documents.map((doc) => ({ ...doc, score: 0 }));
  }

  // Build inverted index
  const invertedIndex = buildInvertedIndex(documents);

  // Calculate average document length
  const avgDocLength = calculateAvgDocLength(documents);

  // Calculate BM25 scores for all documents
  const scoredDocs: ScoredDocument[] = documents.map((doc) => {
    const score = calculateBM25Score(
      query,
      doc,
      documents,
      invertedIndex,
      avgDocLength,
      config,
    );

    return {
      ...doc,
      score,
    };
  });

  // Sort by score (descending) and filter out zero scores
  return scoredDocs
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Search and rank articles with BM25
 *
 * @param query - Search query
 * @param articles - Articles to search through
 * @returns Ranked articles with relevance scores
 */
export function searchArticlesWithBM25(
  query: string,
  articles: Array<{
    id: string;
    title: string;
    subtitle: string | null;
    content: string;
    subContent: string | null;
    tags?: Array<{ name: string }>;
  }>,
): Array<{
  article: (typeof articles)[0];
  score: number;
}> {
  const documents: Document[] = articles.map((article) => ({
    id: article.id,
    text: `${article.title} ${article.subtitle ?? ""} ${article.subContent ?? ""} ${article.content ?? ""}`,
    title: article.title,
    subtitle: article.subtitle ?? undefined,
    tags: article.tags?.map((tag) => tag.name),
  }));

  const ranked = rankDocumentsWithBM25(query, documents);

  return ranked.map((doc) => ({
    article: articles.find((a) => a.id === doc.id)!,
    score: doc.score,
  }));
}
