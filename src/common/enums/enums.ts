export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
}

export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
}

export enum Role {
  USER = 'user',
  ADMIN = 'admin',
}

export enum Permission {
  READ = 'read',
  EDIT = 'edit',
  ADMIN = 'admin',
}

export enum AiTool {
  GRAMMAR_CHECK = 'grammar-check',
  TONE_ANALYSIS = 'tone-analysis',
  SUMMARIZATION = 'summarization',
  REPHRASE = 'rephrase',
  TRANSLATION = 'translation',
  KEYWORD_EXTRACTION = 'keyword-extraction',
  TEXT_GENERATION = 'text-generation',
  READABILITY = 'readability-analysis',
  TITLE_GENERATION = 'title-generation',
  USAGE = 'get-usage',
}
