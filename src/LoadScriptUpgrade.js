/**
 * Universal Script & Module Loader with ESM Support
 * ================================================
 * Loads scripts (classic or ESM modules) from URLs or local vault paths with caching.
 * 
 * Features:
 * - Classic script loading via <script> tags
 * - ESM module loading via dynamic import()
 * - URL caching in vault for offline access
 * - Local vault path support
 * - Global deduplication (prevents duplicate loads)
 * - Idempotent with global checks
 * 
 * Usage:
 * 