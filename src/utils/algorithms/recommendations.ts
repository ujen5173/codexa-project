/**
 * Content-Based Recommendation Algorithm using Weighted Jaccard Similarity
 *
 * Recommends articles based on tag similarity with engagement weighting
 */

interface Article {
  id: string;
  tags: Array<{ id: string; name: string; slug: string }>;
  likesCount: number;
  commentsCount: number;
  readCount: number;
  createdAt: Date;
}

interface RecommendedArticle extends Article {
  similarityScore: number;
  sharedTags: string[];
}

/**
 * Calculate tag weight using TF-IDF and engagement metrics
 */
function calculateTagWeight(
  tagId: string,
  tagName: string,
  article: Article,
  allArticles: Article[],
): number {
  // Term Frequency: How many times this tag appears in article context
  // For simplicity, we use 1 if tag exists, but could be enhanced
  const tf = article.tags.some((t) => t.id === tagId) ? 1 : 0;

  // Inverse Document Frequency: Rarity of tag across all articles
  const articlesWithTag = allArticles.filter((a) =>
    a.tags.some((t) => t.id === tagId),
  ).length;
  const idf = Math.log((allArticles.length + 1) / (articlesWithTag + 1));

  // Engagement boost based on article's engagement metrics
  const engagementBoost =
    1 +
    Math.log(
      1 +
        (article.likesCount * 0.3 +
          article.commentsCount * 0.5 +
          article.readCount * 0.2),
    );

  // Tag weight = TF × IDF × Engagement Boost
  return tf * idf * engagementBoost;
}

/**
 * Calculate weighted Jaccard similarity between two articles
 */
function calculateWeightedJaccard(
  articleA: Article,
  articleB: Article,
  allArticles: Article[],
): { similarity: number; sharedTags: string[] } {
  // Calculate tag weights for both articles
  const weightsA = new Map<string, number>();
  const weightsB = new Map<string, number>();
  const allTagIds = new Set<string>();

  // Get all unique tag IDs
  articleA.tags.forEach((tag) => allTagIds.add(tag.id));
  articleB.tags.forEach((tag) => allTagIds.add(tag.id));

  // Calculate weights for article A
  articleA.tags.forEach((tag) => {
    const weight = calculateTagWeight(tag.id, tag.name, articleA, allArticles);
    weightsA.set(tag.id, weight);
  });

  // Calculate weights for article B
  articleB.tags.forEach((tag) => {
    const weight = calculateTagWeight(tag.id, tag.name, articleB, allArticles);
    weightsB.set(tag.id, weight);
  });

  // Calculate weighted Jaccard similarity
  let minSum = 0;
  let maxSum = 0;
  const sharedTags: string[] = [];

  for (const tagId of allTagIds) {
    const weightA = weightsA.get(tagId) ?? 0;
    const weightB = weightsB.get(tagId) ?? 0;

    minSum += Math.min(weightA, weightB);
    maxSum += Math.max(weightA, weightB);

    if (weightA > 0 && weightB > 0) {
      const tagName =
        articleA.tags.find((t) => t.id === tagId)?.name ??
        articleB.tags.find((t) => t.id === tagId)?.name ??
        "";
      if (tagName) sharedTags.push(tagName);
    }
  }

  const similarity = maxSum > 0 ? minSum / maxSum : 0;

  return { similarity, sharedTags };
}

/**
 * Apply recency decay to similarity score
 */
function applyRecencyDecay(similarity: number, articleDate: Date): number {
  const now = new Date();
  const daysOld =
    (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60 * 24);

  // Age factor: min(1, days_old / 365) × 0.2
  const ageFactor = Math.min(1, daysOld / 365) * 0.2;

  // Apply decay: similarity × (1 - age_factor)
  return similarity * (1 - ageFactor);
}

/**
 * Get content-based recommendations for an article
 *
 * @param currentArticle - The article to find recommendations for
 * @param candidateArticles - All candidate articles to consider
 * @param excludeArticleIds - Article IDs to exclude (e.g., already read)
 * @param limit - Maximum number of recommendations (default: 10)
 * @returns Array of recommended articles sorted by similarity
 */
export function getContentBasedRecommendations(
  currentArticle: Article,
  candidateArticles: Article[],
  excludeArticleIds: string[] = [],
  limit = 10,
): RecommendedArticle[] {
  // Filter out current article and excluded articles
  const candidates = candidateArticles.filter(
    (article) =>
      article.id !== currentArticle.id &&
      !excludeArticleIds.includes(article.id),
  );

  // Calculate similarity for each candidate
  const recommendations: RecommendedArticle[] = candidates.map((article) => {
    const { similarity, sharedTags } = calculateWeightedJaccard(
      currentArticle,
      article,
      candidateArticles,
    );

    // Apply recency decay
    const finalSimilarity = applyRecencyDecay(similarity, article.createdAt);

    return {
      ...article,
      similarityScore: finalSimilarity,
      sharedTags,
    };
  });

  // Filter articles with at least one shared tag and similarity > 0
  const validRecommendations = recommendations.filter(
    (rec) => rec.similarityScore > 0 && rec.sharedTags.length > 0,
  );

  // Sort by similarity (descending) and apply diversity filter
  const sorted = validRecommendations.sort(
    (a, b) => b.similarityScore - a.similarityScore,
  );

  // Apply diversity: ensure tag variety in top results
  const diverseResults: RecommendedArticle[] = [];
  const usedTagCombinations = new Set<string>();

  for (const rec of sorted) {
    if (diverseResults.length >= limit) break;

    // Create a tag combination key
    const tagKey = rec.sharedTags.sort().join(",");

    // Allow if we haven't seen this exact tag combination or if we need more results
    if (!usedTagCombinations.has(tagKey) || diverseResults.length < limit / 2) {
      diverseResults.push(rec);
      usedTagCombinations.add(tagKey);
    }
  }

  return diverseResults.slice(0, limit);
}

/**
 * Get recommendations for a user based on their reading history
 *
 * @param userReadArticles - Articles the user has read
 * @param allArticles - All available articles
 * @param limit - Maximum recommendations per article (default: 3)
 * @returns Array of recommended articles
 */
export function getUserRecommendations(
  userReadArticles: Article[],
  allArticles: Article[],
  limit = 10,
): RecommendedArticle[] {
  if (userReadArticles.length === 0) {
    return [];
  }

  // Get recommendations for each read article
  const allRecommendations = new Map<string, RecommendedArticle>();

  for (const readArticle of userReadArticles.slice(0, 5)) {
    // Limit to recent articles for better recommendations
    const recentArticles = allArticles.filter((article) => {
      const daysSinceCreation =
        (new Date().getTime() - article.createdAt.getTime()) /
        (1000 * 60 * 60 * 24);
      return daysSinceCreation <= 365; // Within 1 year
    });

    const recommendations = getContentBasedRecommendations(
      readArticle,
      recentArticles,
      userReadArticles.map((a) => a.id),
      limit,
    );

    // Aggregate recommendations with highest similarity
    for (const rec of recommendations) {
      const existing = allRecommendations.get(rec.id);
      if (!existing || rec.similarityScore > existing.similarityScore) {
        allRecommendations.set(rec.id, rec);
      }
    }
  }

  // Sort by similarity and return top N
  return Array.from(allRecommendations.values())
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);
}
