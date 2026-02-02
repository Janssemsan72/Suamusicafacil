import { useFeedbackStats } from '@/hooks/useCustomerFeedbacks';
import { useVideoStats } from '@/hooks/useReactionVideos';
import { Loader2, MessageSquare, Video, Star, Eye } from "@/lib/icons";
import { ADMIN_CARD_COLORS, SolidStatCard } from '@/components/admin/SolidStatCard';

export function StatsTab() {
  const { data: feedbackStats, isLoading: loadingFeedback } = useFeedbackStats();
  const { data: videoStats, isLoading: loadingVideo } = useVideoStats();

  const isLoading = loadingFeedback || loadingVideo;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-brown-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* KPIs de Feedbacks */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-brown-dark-400 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-brown-600" />
          Feedbacks
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <SolidStatCard
            title="Total"
            value={feedbackStats?.total.toString() || "0"}
            icon={MessageSquare}
            color={ADMIN_CARD_COLORS.primary}
            className="admin-hover-lift"
          />
          <SolidStatCard
            title="Pendentes"
            value={feedbackStats?.pending.toString() || "0"}
            icon={Loader2}
            color={ADMIN_CARD_COLORS.yellow}
            className="admin-hover-lift"
          />
          <SolidStatCard
            title="Aprovados"
            value={feedbackStats?.approved.toString() || "0"}
            icon={MessageSquare}
            color={ADMIN_CARD_COLORS.green}
            className="admin-hover-lift"
          />
          <SolidStatCard
            title="Rejeitados"
            value={feedbackStats?.rejected.toString() || "0"}
            icon={MessageSquare}
            color={ADMIN_CARD_COLORS.red}
            className="admin-hover-lift"
          />
          <SolidStatCard
            title="Destaques"
            value={feedbackStats?.featured.toString() || "0"}
            icon={Star}
            color={ADMIN_CARD_COLORS.purple}
            className="admin-hover-lift"
          />
        </div>
        {feedbackStats && feedbackStats.averageRating > 0 && (
          <div className="mt-4 max-w-xs">
            <SolidStatCard
              title="Rating Médio"
              value={`${feedbackStats.averageRating.toFixed(1)}/5`}
              icon={Star}
              color={ADMIN_CARD_COLORS.blue}
              className="admin-hover-lift"
            />
          </div>
        )}
      </div>

      {/* KPIs de Vídeos */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-brown-dark-400 flex items-center gap-2">
          <Video className="h-5 w-5 text-brown-600" />
          Vídeos
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SolidStatCard
            title="Total"
            value={videoStats?.total.toString() || "0"}
            icon={Video}
            color={ADMIN_CARD_COLORS.primary}
            className="admin-hover-lift"
          />
          <SolidStatCard
            title="Pendentes"
            value={videoStats?.pending.toString() || "0"}
            icon={Loader2}
            color={ADMIN_CARD_COLORS.yellow}
            className="admin-hover-lift"
          />
          <SolidStatCard
            title="Aprovados"
            value={videoStats?.approved.toString() || "0"}
            icon={Video}
            color={ADMIN_CARD_COLORS.green}
            className="admin-hover-lift"
          />
          <SolidStatCard
            title="Visualizações"
            value={videoStats?.totalViews.toString() || "0"}
            icon={Eye}
            color={ADMIN_CARD_COLORS.blue}
            className="admin-hover-lift"
          />
        </div>
      </div>
    </div>
  );
}

