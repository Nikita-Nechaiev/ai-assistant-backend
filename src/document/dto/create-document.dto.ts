export class CreateDocumentDto {
  title: string;
  content?: string; // Optional plain text content
  richContent?: object; // Optional rich content (e.g., Delta JSON)
  toneAnalysis?: object; // Optional tone analysis data
}
