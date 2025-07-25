import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Shield, 
  FileText, 
  Users, 
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  Database,
  Network,
  Zap,
  Eye,
  Download,
  Loader,
  RefreshCw
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart as RechartsPieChart, 
  Cell, 
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
  Pie
} from 'recharts';
import { apiClient, APIClient, webSocketService } from '../services/apiClient';
import { 
  EvidenceRecord,
  BlockchainTransaction,
  NetworkInfo,
  VerificationUpdate
} from '../types/index';
import { cn } from '../utils/index';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

interface DashboardStats {
  totalDocuments: number;
  confirmedDocuments: number;
  pendingDocuments: number;
  failedDocuments: number;
  totalVerifications: number;
  recentDocuments: EvidenceRecord[];
  statusDistribution: Array<{ name: string; value: number; color: string }>;
  dailyActivity: Array<{ date: string; registrations: number; verifications: number }>;
  networkMetrics: {
    blockHeight: number;
    nodeCount: number;
    avgBlockTime: number;
    networkStatus: string;
  };
}

interface RealTimeUpdate {
  type: 'new_document' | 'verification_update' | 'network_update';
  data: any;
  timestamp: string;
}

export function DashboardPage() {
  const [realTimeUpdates, setRealTimeUpdates] = useState<RealTimeUpdate[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch dashboard statistics
  const { 
    data: documentStats, 
    isLoading: isLoadingDocs, 
    refetch: refetchDocs 
  } = useQuery({
    queryKey: ['document-stats'],
    queryFn: () => apiClient.getDocumentStats(),
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch system statistics
  const { 
    data: systemStats, 
    isLoading: isLoadingSystem 
  } = useQuery({
    queryKey: ['system-stats'],
    queryFn: () => apiClient.getSystemStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch network information
  const { 
    data: networkInfo, 
    isLoading: isLoadingNetwork 
  } = useQuery({
    queryKey: ['network-info'],
    queryFn: () => apiClient.getNetworkInfo(),
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Fetch recent documents
  const { 
    data: recentDocuments, 
    isLoading: isLoadingRecent 
  } = useQuery({
    queryKey: ['recent-documents'],
    queryFn: () => apiClient.browseDocuments({}, { page: 1, limit: 10, sortBy: 'created_at', sortOrder: 'desc' }),
    refetchInterval: 30000,
  });

  // WebSocket subscription for real-time updates
  useEffect(() => {
    const subscriptions = [
      webSocketService.subscribe('verification_update', (update: VerificationUpdate) => {
        setRealTimeUpdates(prev => [{
          type: 'verification_update',
          data: update,
          timestamp: new Date().toISOString()
        }, ...prev.slice(0, 9)]); // Keep last 10 updates
      }),

      webSocketService.subscribe('new_document', (document: EvidenceRecord) => {
        setRealTimeUpdates(prev => [{
          type: 'new_document',
          data: document,
          timestamp: new Date().toISOString()
        }, ...prev.slice(0, 9)]);
        
        // Refresh documents data
        refetchDocs();
      }),

      webSocketService.subscribe('network_status', (status: any) => {
        setRealTimeUpdates(prev => [{
          type: 'network_update',
          data: status,
          timestamp: new Date().toISOString()
        }, ...prev.slice(0, 9)]);
      }),
    ];

    return () => {
      subscriptions.forEach(unsubscribe => unsubscribe());
    };
  }, [refetchDocs]);

  // Manual refresh function
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchDocs(),
    ]);
    setIsRefreshing(false);
  };

  // Prepare dashboard data
  const dashboardData: DashboardStats = {
    totalDocuments: documentStats?.total || 0,
    confirmedDocuments: documentStats?.statusBreakdown?.confirmed || 0,
    pendingDocuments: documentStats?.statusBreakdown?.pending || 0,
    failedDocuments: documentStats?.statusBreakdown?.failed || 0,
    totalVerifications: systemStats?.totalVerifications || 0,
    recentDocuments: recentDocuments?.records || [],
    statusDistribution: documentStats?.statusBreakdown ? [
      { name: 'Confirmed', value: documentStats.statusBreakdown.confirmed || 0, color: '#10b981' },
      { name: 'Pending', value: documentStats.statusBreakdown.pending || 0, color: '#f59e0b' },
      { name: 'Processing', value: documentStats.statusBreakdown.processing || 0, color: '#3b82f6' },
      { name: 'Failed', value: documentStats.statusBreakdown.failed || 0, color: '#ef4444' },
      { name: 'Rejected', value: documentStats.statusBreakdown.rejected || 0, color: '#6b7280' },
    ].filter(item => item.value > 0) : [],
    dailyActivity: generateDailyActivity(), // Mock data for now
    networkMetrics: {
      blockHeight: networkInfo?.blockHeight || 0,
      nodeCount: systemStats?.nodeCount || 0,
      avgBlockTime: systemStats?.avgBlockTime || 0,
      networkStatus: networkInfo?.status || 'unknown',
    },
  };

  const statCards = [
    {
      title: 'Total Documents',
      value: dashboardData.totalDocuments.toLocaleString(),
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      trend: calculateTrend(dashboardData.totalDocuments, systemStats?.previousTotal || 0),
    },
    {
      title: 'Confirmed Documents',
      value: dashboardData.confirmedDocuments.toLocaleString(),
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      trend: calculateTrend(dashboardData.confirmedDocuments, systemStats?.previousConfirmed || 0),
    },
    {
      title: 'Total Verifications',
      value: dashboardData.totalVerifications.toLocaleString(),
      icon: Shield,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      trend: calculateTrend(dashboardData.totalVerifications, systemStats?.previousVerifications || 0),
    },
    {
      title: 'Network Block Height',
      value: dashboardData.networkMetrics.blockHeight.toLocaleString(),
      icon: Database,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
      trend: { change: 'Live', type: 'neutral' as const },
    },
  ];

  const isLoading = isLoadingDocs || isLoadingSystem || isLoadingNetwork;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <BarChart3 className="w-8 h-8 mr-3 text-blue-600" />
                Analytics Dashboard
              </h1>
              <p className="text-gray-600 mt-2">
                Monitor document verification activity and blockchain metrics in real-time
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Network Status Indicator */}
              {networkInfo && (
                <div className={cn(
                  'flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium',
                  networkInfo.status === 'healthy' ? 'bg-green-100 text-green-800' :
                  networkInfo.status === 'degraded' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                )}>
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    networkInfo.status === 'healthy' ? 'bg-green-500 animate-pulse' :
                    networkInfo.status === 'degraded' ? 'bg-yellow-500' :
                    'bg-red-500'
                  )}></div>
                  <span>Network {networkInfo.status}</span>
                </div>
              )}
              
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
                <span>Refresh</span>
              </button>
            </div>
          </motion.div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                'bg-white rounded-xl shadow-sm border p-6',
                card.borderColor
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{card.value}</p>
                  <div className="flex items-center mt-2">
                    <span className={cn(
                      'text-sm font-medium',
                      card.trend.type === 'positive' ? 'text-green-600' :
                      card.trend.type === 'negative' ? 'text-red-600' :
                      'text-gray-600'
                    )}>
                      {card.trend.change}
                    </span>
                    {card.trend.type !== 'neutral' && (
                      <span className="text-sm text-gray-500 ml-1">vs yesterday</span>
                    )}
                  </div>
                </div>
                <div className={cn('p-3 rounded-lg', card.bgColor)}>
                  <card.icon className={cn('w-6 h-6', card.color)} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Daily Activity Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
              Activity Trends (Last 7 Days)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dashboardData.dailyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  formatter={(value, name) => [value, name === 'registrations' ? 'Registrations' : 'Verifications']}
                />
                <Area 
                  type="monotone" 
                  dataKey="registrations" 
                  stackId="1"
                  stroke="#3b82f6" 
                  fill="#3b82f6" 
                  fillOpacity={0.6}
                />
                <Area 
                  type="monotone" 
                  dataKey="verifications" 
                  stackId="1"
                  stroke="#10b981" 
                  fill="#10b981" 
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Status Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <PieChart className="w-5 h-5 mr-2 text-blue-600" />
              Status Distribution
            </h3>
            {dashboardData.statusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <RechartsPieChart>
                  <Pie
                    dataKey="value"
                    data={dashboardData.statusDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {dashboardData.statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => value.toLocaleString()} />
                </RechartsPieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-250 text-gray-500">
                No data available
              </div>
            )}
          </motion.div>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Documents */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200"
          >
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                Recent Documents
              </h3>
            </div>
            
            <div className="p-6">
              <RecentDocumentsList documents={dashboardData.recentDocuments} />
            </div>
          </motion.div>

          {/* Real-time Updates */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200"
          >
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Activity className="w-5 h-5 mr-2 text-blue-600" />
                Live Updates
              </h3>
            </div>
            
            <div className="p-6">
              <RealTimeUpdatesList updates={realTimeUpdates} />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// Recent Documents List Component
function RecentDocumentsList({ documents }: { documents: EvidenceRecord[] }) {
  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>No recent documents</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {documents.slice(0, 5).map((document) => (
        <div key={document.id} className="flex items-center space-x-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
          <div className="flex-shrink-0">
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              APIClient.getStatusColor(document.status)
            )}>
              <FileText className="w-5 h-5" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {document.documentTitle || 'Untitled Document'}
            </p>
            <div className="flex items-center space-x-2 mt-1">
              <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                {APIClient.truncateHash(document.hash, 6)}
              </code>
              <span className="text-xs text-gray-500">
                {APIClient.getRelativeTime(document.createdAt)}
              </span>
            </div>
          </div>
          
          <div className="flex-shrink-0">
            <span className={cn(
              'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
              APIClient.getStatusColor(document.status)
            )}>
              {document.status}
            </span>
          </div>
        </div>
      ))}
      
      <div className="pt-4 border-t border-gray-200 text-center">
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          View all documents →
        </button>
      </div>
    </div>
  );
}

// Real-time Updates List Component
function RealTimeUpdatesList({ updates }: { updates: RealTimeUpdate[] }) {
  const getUpdateIcon = (type: string) => {
    switch (type) {
      case 'new_document': return FileText;
      case 'verification_update': return Shield;
      case 'network_update': return Network;
      default: return Activity;
    }
  };

  const getUpdateColor = (type: string, data: any) => {
    switch (type) {
      case 'new_document': return 'text-blue-600';
      case 'verification_update': 
        return data.status === 'confirmed' ? 'text-green-600' : 
               data.status === 'failed' ? 'text-red-600' : 'text-yellow-600';
      case 'network_update': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  const getUpdateMessage = (update: RealTimeUpdate) => {
    switch (update.type) {
      case 'new_document':
        return `New document registered: ${update.data.documentTitle || 'Untitled'}`;
      case 'verification_update':
        return `Document ${update.data.status}: ${APIClient.truncateHash(update.data.evidenceRecordId, 6)}`;
      case 'network_update':
        return `Network status: ${update.data.status}`;
      default:
        return 'Unknown update';
    }
  };

  if (updates.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>No recent updates</p>
        <p className="text-xs mt-1">Live updates will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {updates.slice(0, 8).map((update, index) => {
          const Icon = getUpdateIcon(update.type);
          const colorClass = getUpdateColor(update.type, update.data);
          
          return (
            <motion.div
              key={`${update.type}-${update.timestamp}-${index}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex items-start space-x-3"
            >
              <div className="flex-shrink-0 p-2 rounded-full bg-gray-50">
                <Icon className={cn('w-4 h-4', colorClass)} />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  {getUpdateMessage(update)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {APIClient.getRelativeTime(update.timestamp)}
                </p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// Helper functions
function calculateTrend(current: number, previous: number): { change: string; type: 'positive' | 'negative' | 'neutral' } {
  if (previous === 0) return { change: 'New', type: 'neutral' };
  
  const percentChange = ((current - previous) / previous) * 100;
  const sign = percentChange >= 0 ? '+' : '';
  
  return {
    change: `${sign}${percentChange.toFixed(1)}%`,
    type: percentChange > 0 ? 'positive' : percentChange < 0 ? 'negative' : 'neutral'
  };
}

function generateDailyActivity() {
  // Generate mock daily activity data for the last 7 days
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    days.push({
      date: date.toISOString().split('T')[0],
      registrations: Math.floor(Math.random() * 20) + 5,
      verifications: Math.floor(Math.random() * 50) + 15,
    });
  }
  return days;
}