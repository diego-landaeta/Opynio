export type SuggestionPriority = 'high' | 'medium' | 'low';

export type SuggestionCategory =
  | 'navigation'
  | 'ux'
  | 'mobile'
  | 'accessibility'
  | 'performance';

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  priority: SuggestionPriority;
  category: SuggestionCategory;
  icon: string; // FontAwesome class name
}
