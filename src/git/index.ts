// Public surface of the git module. Only GitIntegrationService and the plain WorktreeDescriptor
// shape it produces may be imported by other modules — never the Git API types in
// gitExtensionApi.ts (PRD §16.2).
export { GitIntegrationService } from './gitIntegrationService';
