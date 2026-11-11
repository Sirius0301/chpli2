// Async boundary for Module Federation: the standalone entry must not call
// shared modules (e.g. react/jsx-dev-runtime) synchronously, or the dev
// server throws RUNTIME-006 (loadShareSync before share scope is ready).
import('./bootstrap');
