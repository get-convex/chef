import { useState } from 'react';
import { ModernLayout, ModernContainer, ModernCard } from './ui/ModernLayout';
import { ModernHeader } from './header/ModernHeader';
import { ModernHero } from './landing/ModernHero';
import { ModernChatInterface } from './chat/ModernChatInterface';
import { ModernWorkbench } from './workbench/ModernWorkbench';
import { cn } from '~/utils/classNames';

type ViewMode = 'landing' | 'chat' | 'workbench';

export function ModernHomepage() {
  const [viewMode, setViewMode] = useState<ViewMode>('landing');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleStartBuilding = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setViewMode('chat');
      setIsGenerating(false);
    }, 1500);
  };

  const handleOpenWorkbench = () => {
    setViewMode('workbench');
  };

  if (viewMode === 'workbench') {
    return (
      <ModernLayout>
        <ModernHeader />
        <div className="flex-1 flex flex-col h-[calc(100vh-4rem)]">
          {/* Workbench Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setViewMode('chat')}
                className="flex items-center space-x-2 px-3 py-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Back to Chat</span>
              </button>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white">My Chat App</h1>
            </div>
            <div className="flex items-center space-x-2">
              <button className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl">
                Deploy
              </button>
            </div>
          </div>
          <ModernWorkbench className="flex-1" />
        </div>
      </ModernLayout>
    );
  }

  if (viewMode === 'chat') {
    return (
      <ModernLayout>
        <ModernHeader />
        <div className="flex-1 flex">
          {/* Sidebar */}
          <div className="w-80 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setViewMode('landing')}
                className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors mb-4"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Back to Home</span>
              </button>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Chats</h2>
            </div>
            <div className="p-4 space-y-2">
              <ModernCard variant="glass" className="p-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <h3 className="font-medium text-slate-900 dark:text-white text-sm">Chat App with Real-time</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">2 hours ago</p>
              </ModernCard>
              <ModernCard variant="glass" className="p-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <h3 className="font-medium text-slate-900 dark:text-white text-sm">E-commerce Dashboard</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">1 day ago</p>
              </ModernCard>
              <ModernCard variant="glass" className="p-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <h3 className="font-medium text-slate-900 dark:text-white text-sm">Task Management App</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">3 days ago</p>
              </ModernCard>
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col">
            {/* Chat Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div>
                <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Building Your App</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Chat with Chef to create your full-stack application</p>
              </div>
              <button
                onClick={handleOpenWorkbench}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span>Open Workbench</span>
              </button>
            </div>

            <ModernChatInterface className="flex-1" />
          </div>
        </div>
      </ModernLayout>
    );
  }

  return (
    <ModernLayout>
      <ModernHeader />
      <ModernHero />
      
      {/* Features Section */}
      <section className="py-20 bg-white dark:bg-slate-900">
        <ModernContainer>
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Everything You Need to Build Modern Apps
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
              Chef combines the power of AI with a complete backend platform to help you build production-ready applications in minutes.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xl">🤖</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">AI-Powered Development</h3>
                  <p className="text-slate-600 dark:text-slate-400">Describe your app in natural language and watch Chef build it for you with intelligent code generation.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xl">⚡</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Real-time Everything</h3>
                  <p className="text-slate-600 dark:text-slate-400">Built on Convex for instant updates, reactive queries, and seamless real-time collaboration.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xl">🚀</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Deploy Instantly</h3>
                  <p className="text-slate-600 dark:text-slate-400">One-click deployment to production with automatic scaling and global CDN distribution.</p>
                </div>
              </div>
            </div>

            <ModernCard variant="elevated" className="p-0 overflow-hidden">
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <div className="font-mono text-sm space-y-2">
                  <div className="text-green-400">$ chef create my-app</div>
                  <div className="text-slate-300">🍳 Cooking up your app...</div>
                  <div className="text-slate-300">✅ Database schema generated</div>
                  <div className="text-slate-300">✅ Authentication configured</div>
                  <div className="text-slate-300">✅ Real-time features added</div>
                  <div className="text-slate-300">✅ Frontend components created</div>
                  <div className="text-green-400">🎉 Your app is ready!</div>
                </div>
              </div>
            </ModernCard>
          </div>
        </ModernContainer>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-orange-50 via-white to-red-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
        <ModernContainer>
          <div className="text-center">
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Ready to Cook Something Amazing?
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto">
              Join thousands of developers building the future with AI-powered full-stack development.
            </p>
            <button
              onClick={handleStartBuilding}
              disabled={isGenerating}
              className={cn(
                "px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:-translate-y-1",
                "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-xl",
                "flex items-center justify-center mx-auto min-w-[200px]"
              )}
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Starting Chef...
                </>
              ) : (
                <>
                  🍳 Start Building Now
                </>
              )}
            </button>
          </div>
        </ModernContainer>
      </section>
    </ModernLayout>
  );
}
