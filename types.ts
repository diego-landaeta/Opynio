export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Sede {
  country_code: string;
  name?: string; // Nombre de la sede/ubicación (ej: "Oficina Madrid Centro")
  description?: string | null; // Descripción específica de esta sede
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  latitude?: number;
  longitude?: number;
  contact_phone?: string | null; // Teléfono específico de esta sede
  contact_email?: string | null; // Email específico de esta sede
  website_url?: string | null; // URL específica de esta sede
  google_maps_url?: string | null; // Google Maps URL de esta sede
  logo_url?: string | null; // Logo específico de esta sede (opcional)
  horarios?: BusinessHours | Json | null; // Horarios específicos de esta sede
  social_links?: Json | null; // Redes sociales específicas de esta sede
  code?: string; // Código interno de la sede
  flag?: string; // Bandera del país (para UI)
}

export interface SimpleBusiness {
  id: string;
  name: string;
  country: string | null;
  logo_url?: string | null;
  average_rating?: number | null;
  avg_rating?: number | null;
  review_count?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  sedes?: Sede[] | Json | null;
  // is_selected_for_monthly_scrape?: boolean; // DEPRECATED: Monthly scraping selection removed
  category?: string | null;
}

export type DayHours = { open: string; close: string } | 'cerrado';

export interface BusinessHours {
  lunes?: DayHours;
  martes?: DayHours;
  miercoles?: DayHours;
  jueves?: DayHours;
  viernes?: DayHours;
  sabado?: DayHours;
  domingo?: DayHours;
}

export interface Business extends SimpleBusiness {
  description?: string | null;
  website?: string | null;
  website_url?: string | null;
  logo_url?: string | null;
  phone?: string | null;
  email?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  horarios?: BusinessHours | Json | null;
  created_at?: string;
  updated_at?: string;
  owner_id?: string | null;
  google_maps_url?: string | null;
  social_links?: Json | null;
  meta_description_override?: string | null;
  plan?: string | null;
  offers_international_services?: boolean | null;
}

export interface BusinessListItem extends Business {
  // Additional fields specific to business lists if needed
}

export type Plan = 'free' | 'starter' | 'growth' | 'pro' | 'enterprise';
export type UserRole = 'admin' | 'business_owner' | 'authenticated';

export interface Profile {
  id: string;
  created_at: string | null;
  name: string;
  username: string | null;
  avatar_url: string | null;
  role: UserRole;
  helpful_review_count: number;
  reviews_count?: number;
  plan: Plan;
  billing_cycle?: 'monthly' | 'annual' | null;
  plan_expires_at?: string | null;
  ai_credits_used?: number;
  ai_credits_last_reset?: string | null;
  ai_credit_limit?: number | null;
  business_limit?: number | null;
  feature_permissions?: Json | null;
}

export interface ReviewResponse {
  id: string;
  review_id: string;
  response_text: string;
  created_at: string;
  updated_at?: string;
}

export interface Review {
  id: string;
  business_id: string;
  user_id: string;
  rating: number;
  title?: string | null;
  review_text: string | null;
  text?: string | null;
  images?: string[] | Json | null;
  image_urls?: string[] | null;
  audio_url?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  source?: string | null;
  original_response_text?: string | null;
  original_response_date?: string | null;
  original_author_name?: string | null;
  category?: string | null;
  tags?: string[] | null;
  helpful_count?: number;
  helpful_votes: number;
  not_helpful_votes: number;
  is_verified_customer?: boolean;
  is_verified_purchase?: boolean;
  rejection_reason?: string | null;
  created_at: string;
  updated_at?: string;
  businesses: SimpleBusiness | null;
  profiles?: Profile | null;
  review_responses?: ReviewResponse[] | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
  data?: Json | null;
}

export interface AiInsight {
  good_points: string[];
  improvement_points: string[];
  emotional_tone: string;
  recommendation_level: string;
}

export interface Claim {
  id: number;
  created_at: string;
  user_id: string;
  business_id: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected';
  opynio_url: string | null;
  user_provided_info: Json | null;
  admin_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  profiles: Profile | null;
  businesses: SimpleBusiness | null;
}

export interface BugReport {
  id: number;
  created_at: string;
  user_id: string;
  title?: string | null;
  description: string;
  steps_to_reproduce?: string | null;
  expected_behavior?: string | null;
  actual_behavior?: string | null;
  browser_info?: Json | null;
  screenshot_url?: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  admin_notes?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  profiles?: Profile | null;
}
