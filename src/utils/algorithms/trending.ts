/**
 * Trending Articles Algorithm using Time-Decay Hot Score
 * 
 * Similar to Reddit's "hot" ranking algorithm that balances
 * engagement metrics with recency using time decay.
 */

interface Article {
  id: string;
  likesCount: number;
  commentsCount: number;
  readCount: number;
  createdAt: Date;
  userId?: string;
  authorVerified?: boolean;
  qualityScore?: number;
}

interface TrendingArticle extends Article {
  hotScore: number;
  engagementScore: number;
  timeDecay: number;
}

/**
 * Calculate engagement score from various metrics
 */
function calculateEngagementScore(article: Article): number {
  // Weighted engagement: likes × 2 + comments × 3 + reads × 1 + bookmarks × 4
  // Note: bookmarks not available in current schema, using likes as proxy
  const engagement =
    article.likesCount * 2 +
    article.commentsCount * 3 +
    article.readCount * 1;
  
  // Apply logarithmic scaling to prevent extreme values
  return Math.log(1 + engagement);
}

/**
 * Calculate time decay factor using exponential decay
 * 
 * @param articleDate - Article creation date
 * @param decayConstant - Decay constant in days (default: 7 days for 50% decay)
 * @returns Decay factor between 0 and 1
 */
function calculateExponentialDecay(
  articleDate: Date,
  decayConstant = 7,
): number {
  const now = new Date();
  const hoursOld = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60);
  const daysOld = hoursOld / 24;
  
  // Exponential decay: exp(-time / decay_constant)
  return Math.exp(-daysOld / decayConstant);
}

/**
 * Calculate time decay factor using logarithmic decay (alternative)
 * 
 * @param articleDate - Article creation date
 * @param gravity - Controls decay rate (default: 1.8)
 * @returns Decay factor between 0 and 1
 */
function calculateLogarithmicDecay(
  articleDate: Date,
  gravity = 1.8,
): number {
  const now = new Date();
  const hoursOld = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60);
  
  // Logarithmic decay: 1 / (1 + hours_old / 12)^gravity
  return 1 / Math.pow(1 + hoursOld / 12, gravity);
}

/**
 * Calculate hot score for trending articles
 * 
 * @param article - Article to calculate score for
 * @param useLogarithmic - Use logarithmic decay instead of exponential (default: false)
 * @returns Article with hot score and component scores
 */
export function calculateHotScore(
  article: Article,
  useLogarithmic = false,
): TrendingArticle {
  // Calculate engagement score
  const engagementScore = calculateEngagementScore(article);
  
  // Calculate time decay
  const timeDecay = useLogarithmic
    ? calculateLogarithmicDecay(article.createdAt)
    : calculateExponentialDecay(article.createdAt);
  
  // Base hot score = engagement × time decay
  let hotScore = engagementScore * timeDecay;
  
  // Apply additional boost factors
  // Author reputation boost: +10% for verified authors
  if (article.authorVerified) {
    hotScore *= 1.1;
  }
  
  // Quality score boost: +5% per 10 quality points above 70
  if (article.qualityScore && article.qualityScore > 70) {
    const qualityBoost = 1 + ((article.qualityScore - 70) / 10) * 0.05;
    hotScore *= qualityBoost;
  }
  
  return {
    ...article,
    hotScore,
    engagementScore,
    timeDecay,
  };
}

/**
 * Rank articles by hot score
 * 
 * @param articles - Articles to rank
 * @param filters - Optional filters
 * @param limit - Maximum number of results
 * @returns Ranked articles sorted by hot score
 */
export function rankTrendingArticles(
  articles: Article[],
  filters: {
    minLikes?: number;
    minComments?: number;
    maxAgeDays?: number;
    useLogarithmicDecay?: boolean;
  } = {},
  limit = 20,
): TrendingArticle[] {
  const {
    minLikes = 1,
    minComments = 0,
    maxAgeDays = 90,
    useLogarithmicDecay = false,
  } = filters;
  
  const now = new Date();
  
  // Filter articles based on criteria
  const filteredArticles = articles.filter((article) => {
    // Minimum engagement thresholds
    if (article.likesCount < minLikes && article.commentsCount < minComments) {
      return false;
    }
    
    // Maximum age filter
    if (maxAgeDays > 0) {
      const daysOld =
        (now.getTime() - article.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysOld > maxAgeDays) {
        return false;
      }
    }
    
    return true;
  });
  
  // Calculate hot scores
  const trendingArticles = filteredArticles.map((article) =>
    calculateHotScore(article, useLogarithmicDecay),
  );
  
  // Sort by hot score (descending)
  const ranked = trendingArticles.sort((a, b) => b.hotScore - a.hotScore);
  
  return ranked.slice(0, limit);
}

/**
 * Get trending articles for a specific time period
 * 
 * @param articles - All articles
 * @param timeVariant - Time period filter
 * @param limit - Maximum results
 * @returns Trending articles for the period
 */
export function getTrendingArticlesByPeriod(
  articles: Article[],
  timeVariant: "ANY" | "WEEK" | "MONTH" | "YEAR" = "ANY",
  limit = 20,
): TrendingArticle[] {
  let maxAgeDays = 0;
  
  switch (timeVariant) {
    case "WEEK":
      maxAgeDays = 7;
      break;
    case "MONTH":
      maxAgeDays = 30;
      break;
    case "YEAR":
      maxAgeDays = 365;
      break;
    case "ANY":
    default:
      maxAgeDays = 90; // Default to 90 days for "ANY"
      break;
  }
  
  return rankTrendingArticles(
    articles,
    {
      minLikes: 1,
      minComments: 0,
      maxAgeDays,
      useLogarithmicDecay: false,
    },
    limit,
  );
}

