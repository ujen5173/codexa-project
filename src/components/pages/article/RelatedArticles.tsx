import { type FC } from "react";
import StackedArticleCard from "~/components/card/StackedArticle";
import StackedArticleLoading from "~/components/loading/StackedArticle";
import { api } from "~/utils/api";

const RelatedArticles: FC<{ articleId: string }> = ({ articleId }) => {
  const { data: relatedArticles, isLoading } =
    api.posts.getRelatedArticles.useQuery(
      {
        articleId,
        limit: 5,
      },
      {
        enabled: !!articleId,
        refetchOnWindowFocus: false,
        retry: 0,
      },
    );

  if (isLoading) {
    return (
      <div className="mx-auto my-10 w-11/12 lg:w-8/12">
        <h2 className="mb-4 text-2xl font-bold text-gray-800 dark:text-text-secondary">
          Related Articles
        </h2>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <StackedArticleLoading key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!relatedArticles || relatedArticles.articles.length === 0) {
    return null;
  }

  return (
    <div className="mx-auto my-10 w-11/12 lg:w-8/12">
      <h2 className="mb-4 text-2xl font-bold text-gray-800 dark:text-text-secondary">
        Related Articles
      </h2>
      <div className="space-y-4">
        {relatedArticles.articles.map((article) => (
          <StackedArticleCard key={article.id} article={article} />
        ))}
      </div>
    </div>
  );
};

export default RelatedArticles;
