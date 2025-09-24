import { useState } from 'react';
import { ModernCard } from '../ui/ModernLayout';
import { cn } from '~/utils/classNames';

interface FileNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
}

const sampleFiles: FileNode[] = [
  {
    name: 'src',
    type: 'folder',
    children: [
      {
        name: 'components',
        type: 'folder',
        children: [
          { name: 'App.tsx', type: 'file', content: 'import React from "react";\n\nfunction App() {\n  return (\n    <div className="App">\n      <h1>Hello World</h1>\n    </div>\n  );\n}\n\nexport default App;' },
          { name: 'Header.tsx', type: 'file', content: 'import React from "react";\n\nexport function Header() {\n  return <header>My App</header>;\n}' }
        ]
      },
      { name: 'index.tsx', type: 'file', content: 'import React from "react";\nimport ReactDOM from "react-dom";\nimport App from "./components/App";\n\nReactDOM.render(<App />, document.getElementById("root"));' }
    ]
  },
  { name: 'package.json', type: 'file', content: '{\n  "name": "my-app",\n  "version": "1.0.0",\n  "dependencies": {\n    "react": "^18.0.0",\n    "react-dom": "^18.0.0"\n  }\n}' },
  { name: 'README.md', type: 'file', content: '# My App\n\nA modern React application built with Chef AI.' }
];

interface ModernWorkbenchProps {
  className?: string;
}

export function ModernWorkbench({ className }: ModernWorkbenchProps) {
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(sampleFiles[0].children?.[0].children?.[0] || null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src', 'components']));

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const renderFileTree = (nodes: FileNode[], path = '') => {
    return nodes.map((node) => {
      const currentPath = path ? `${path}/${node.name}` : node.name;
      const isExpanded = expandedFolders.has(currentPath);

      return (
        <div key={currentPath} className="select-none">
          <div
            className={cn(
              "flex items-center space-x-2 px-2 py-1 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors",
              selectedFile === node && "bg-orange-100 dark:bg-orange-900/30"
            )}
            onClick={() => {
              if (node.type === 'folder') {
                toggleFolder(currentPath);
              } else {
                setSelectedFile(node);
              }
            }}
          >
            <span className="text-slate-500 dark:text-slate-400 text-sm">
              {node.type === 'folder' ? (isExpanded ? '📂' : '📁') : '📄'}
            </span>
            <span className="text-sm text-slate-700 dark:text-slate-300">{node.name}</span>
          </div>
          {node.type === 'folder' && isExpanded && node.children && (
            <div className="ml-4 border-l border-slate-200 dark:border-slate-700 pl-2">
              {renderFileTree(node.children, currentPath)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className={cn("flex h-full", className)}>
      {/* File Explorer */}
      <div className="w-64 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Files</h3>
        </div>
        <div className="p-2 overflow-y-auto">
          {renderFileTree(sampleFiles)}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        {/* Editor Header */}
        {selectedFile && (
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <div className="flex items-center space-x-2">
              <span className="text-sm">📄</span>
              <span className="font-medium text-slate-900 dark:text-white">{selectedFile.name}</span>
            </div>
            <div className="flex items-center space-x-2">
              <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Code Editor */}
        <div className="flex-1 bg-slate-900 text-slate-100 font-mono text-sm overflow-auto">
          {selectedFile ? (
            <pre className="p-4 leading-relaxed">
              <code>{selectedFile.content}</code>
            </pre>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>Select a file to view its contents</p>
              </div>
            </div>
          )}
        </div>

        {/* Terminal */}
        <div className="h-48 border-t border-slate-200 dark:border-slate-700 bg-slate-900 text-slate-100 font-mono text-sm">
          <div className="flex items-center justify-between p-2 bg-slate-800 border-b border-slate-700">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">Terminal</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
          </div>
          <div className="p-4">
            <div className="text-green-400">$ npm start</div>
            <div className="text-slate-300 mt-1">Starting development server...</div>
            <div className="text-slate-300">Local: http://localhost:3000</div>
            <div className="text-slate-300">Ready in 1.2s</div>
            <div className="flex items-center mt-2">
              <span className="text-green-400">$ </span>
              <div className="w-2 h-4 bg-slate-100 ml-1 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Panel */}
      <div className="w-96 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Preview</h3>
        </div>
        <div className="p-4">
          <ModernCard variant="glass" className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-2xl">🍳</span>
              </div>
              <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Live Preview</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">Your app will appear here</p>
            </div>
          </ModernCard>
        </div>
      </div>
    </div>
  );
}
