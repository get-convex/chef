import { setChefDebugProperty } from './chefDebug.js';

const levelOrder = ['trace', 'debug', 'info', 'warn', 'error'] as const;
type DebugLevel = (typeof levelOrder)[number];

type LoggerFunction = (...messages: any[]) => void;

interface Logger {
  trace: LoggerFunction;
  debug: LoggerFunction;
  info: LoggerFunction;
  warn: LoggerFunction;
  error: LoggerFunction;
}

let currentLevel: DebugLevel = 'warn';

export const logger: Logger = {
  trace: (...messages: any[]) => log('trace', undefined, messages),
  debug: (...messages: any[]) => log('debug', undefined, messages),
  info: (...messages: any[]) => log('info', undefined, messages),
  warn: (...messages: any[]) => log('warn', undefined, messages),
  error: (...messages: any[]) => log('error', undefined, messages),
};

export function createScopedLogger(scope: string): Logger {
  return {
    trace: (...messages: any[]) => log('trace', scope, messages),
    debug: (...messages: any[]) => log('debug', scope, messages),
    info: (...messages: any[]) => log('info', scope, messages),
    warn: (...messages: any[]) => log('warn', scope, messages),
    error: (...messages: any[]) => log('error', scope, messages),
  };
}

export function chefSetLogLevel(level: DebugLevel) {
  if (!levelOrder.includes(level)) {
    throw new Error('bad log level');
  }

  currentLevel = level;
}

if (typeof window !== 'undefined') {
  // Global debugging interface, allowed in production.
  setChefDebugProperty('setLogLevel', chefSetLogLevel);
}

function log(level: DebugLevel, scope: string | undefined, messages: any[]) {
  if (levelOrder.indexOf(level) < levelOrder.indexOf(currentLevel)) {
    return;
  }

  let labelText = `[${level.toUpperCase()}] `;
  if (scope) {
    labelText = `${labelText}[${scope}] `;
  }

  if (typeof window !== 'undefined') {
    console.log(labelText, ...messages);
  } else {
    console.log(labelText, ...messages);
  }
}

export const renderLogger = createScopedLogger('Render');
