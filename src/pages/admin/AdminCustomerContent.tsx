import { useState } from 'react';
import { EnhancedTabs, EnhancedTabsContent, EnhancedTabsList, EnhancedTabsTrigger } from '@/components/ui/enhanced-tabs';
import { MessageSquare, Video, BarChart3 } from '@/lib/icons';
import { FeedbackTab } from './customer-content/FeedbackTab';
import { VideoTab } from './customer-content/VideoTab';
import { StatsTab } from './customer-content/StatsTab';

export default function AdminCustomerContent() {
  const [activeTab, setActiveTab] = useState('feedbacks');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-brown-dark-400 text-serif-primary">
            Feedbacks e Vídeos
          </h1>
          <p className="text-muted-foreground">Gerencie feedbacks dos clientes e vídeos de reação</p>
        </div>
      </div>

      <EnhancedTabs value={activeTab} onValueChange={setActiveTab} variant="modern" className="space-y-6">
        <EnhancedTabsList className="admin-tabs-marrom grid w-full grid-cols-2 md:grid-cols-3 h-auto p-1">
          <EnhancedTabsTrigger 
            value="feedbacks" 
            icon={<MessageSquare className="h-4 w-4 mr-2" />} 
            className="gap-2 py-3"
          >
            Feedbacks
          </EnhancedTabsTrigger>
          <EnhancedTabsTrigger 
            value="videos" 
            icon={<Video className="h-4 w-4 mr-2" />} 
            className="gap-2 py-3"
          >
            Vídeos
          </EnhancedTabsTrigger>
          <EnhancedTabsTrigger 
            value="stats" 
            icon={<BarChart3 className="h-4 w-4 mr-2" />} 
            className="gap-2 py-3"
          >
            Estatísticas
          </EnhancedTabsTrigger>
        </EnhancedTabsList>

        <EnhancedTabsContent value="feedbacks">
          <FeedbackTab />
        </EnhancedTabsContent>

        <EnhancedTabsContent value="videos">
          <VideoTab />
        </EnhancedTabsContent>

        <EnhancedTabsContent value="stats">
          <StatsTab />
        </EnhancedTabsContent>
      </EnhancedTabs>
    </div>
  );
}









