// Public surface of the selection module.
export { SelectionCoordinator, isFollowScmSelectionEnabled } from './selectionCoordinator';
export type { ActiveSelectionSource, SelectionSnapshot, GitIntegrationSource } from './selectionCoordinator';
export { ContextKeyController, computeContextKeyValues, CONTEXT_KEYS } from './contextKeyController';
export type { ContextKeyValues } from './contextKeyController';
