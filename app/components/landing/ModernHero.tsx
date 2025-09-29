import { useState } from 'react';
import { ModernContainer, ModernCard } from '../ui/ModernLayout';
import { cn } from '~/utils/classNames';

export function ModernHero() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    // TODO: Integrate with actual chat functionality
    setTimeout(() => setIsGenerating(false), 2000);
  };

  return (
    <section className="relative py-20 lg:py-32 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-white to-red-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800"></div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-gradient-to-r from-orange-200/30 to-red-200/30 dark:from-orange-900/20 dark:to-red-900/20 blur-3xl"></div>
      
      <ModernContainer className="relative">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 border border-orange-200 dark:border-orange-800 mb-8">
            <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
              ✨ AI-Powered Full-Stack Development
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl lg:text-7xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-white dark:via-slate-100 dark:to-white bg-clip-text text-transparent">
              Build Apps with
            </span>
            <br />
            <span className="bg-gradient-to-r from-orange-500 via-red-500 to-orange-600 bg-clip-text text-transparent">
              AI Chef
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl lg:text-2xl text-slate-600 dark:text-slate-300 mb-12 max-w-3xl mx-auto leading-relaxed">
            The only AI app builder that knows backend. Create full-stack web apps with built-in database, 
            auth, file uploads, and real-time features.
          </p>

          {/* Prompt Input */}
          <ModernCard variant="glass" className="max-w-3xl mx-auto mb-12">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe your app idea... e.g., 'Build a real-time chat app with user authentication and file sharing'"
                  className="w-full h-24 lg:h-16 px-4 py-3 bg-transparent border-0 resize-none focus:outline-none text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
                  rows={3}
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                className={cn(
                  "px-8 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5",
                  "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-lg",
                  "flex items-center justify-center min-w-[140px]"
                )}
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Cooking...
                  </>
                ) : (
                  <>
                    <span>🍳 Cook It Up</span>
                  </>
                )}
              </button>
            </div>
          </ModernCard>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <ModernCard variant="glass" className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-xl">⚡</span>
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Real-time by Default</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">Built on Convex for instant updates and reactive UIs</p>
            </ModernCard>

            <ModernCard variant="glass" className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-xl">🔐</span>
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Zero Config Auth</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">Authentication and user management out of the box</p>
            </ModernCard>

            <ModernCard variant="glass" className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-xl">🗄️</span>
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Built-in Database</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">No setup required - database and backend included</p>
            </ModernCard>
          </div>
        </div>
      </ModernContainer>
    </section>
  );
}
