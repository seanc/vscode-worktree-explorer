export {
  DEFAULT_KEY_PATTERN,
  DEFAULT_NOTES_FILE,
  MAX_NOTES_BYTES,
  readTicketConfig,
  compileKeyPattern,
  findTicketKey,
  branchType,
  parseTicketNotes,
  validateTicketUrl,
  urlFromTemplate,
  isSafeNotesFileName,
  buildTicketMetadata,
  readTicketNotes
} from './ticketMetadata';
export type { TicketConfig, TicketNotes, TicketMetadata } from './ticketMetadata';
export { TicketService } from './ticketService';
export type { TicketInfo, TicketGitSource } from './ticketService';
export { describeTicketHeader, shortBaseName } from './ticketHeader';
export { detectCleanup, findMergeEvidence } from './cleanup';
export type { CleanupState } from './cleanup';
export type { TicketHeader } from './ticketHeader';
