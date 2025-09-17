// Compatibility re-export: many files import '@/lib/logger' historically.
// New structured logger implementation lives at '@/lib/status_logging/logger'.
export { logger, default } from './status_logging/logger';
