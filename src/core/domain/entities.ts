import type {
  InteractionMode,
  MatchStatus,
  OfferStatus,
  ParticipantService,
  RequestStatus,
  ResolvedMode,
  ServiceType,
  TimeWindow,
  UserRole,
} from './types.js';
export interface Timestamps {
  created_at: string;
  updated_at: string;
}
export interface User extends Timestamps {
  id: string;
  role: UserRole;
  display_name: string;
  email: string | null;
  account_type: 'individual_18_plus' | 'partner_managed';
}
export interface ParticipantProfile {
  user_id: string;
  languages: string[];
  topic_interests: string[];
  industry_interests: string[];
  preferred_modes: InteractionMode[];
  access_preferences: string[];
  time_constraints: string | null;
}
export interface VolunteerProfile {
  user_id: string;
  headline: string;
  organisation: string;
  industry_tags: string[];
  expertise_tags: string[];
  languages: string[];
  supported_services: ServiceType[];
  supported_access_preferences: string[];
  lived_experience_tags: string[];
  max_weekly_minutes: number;
  verification_status: 'pending' | 'verified' | 'rejected';
  available_windows: TimeWindow[];
  supported_modes: ResolvedMode[];
}
export interface ServiceRequest extends Timestamps {
  id: string;
  participant_id: string;
  service_type: ParticipantService;
  title: string;
  details: string;
  topic_tags: string[];
  industry_tags: string[];
  preferred_mode: InteractionMode;
  duration_minutes: number;
  availability_windows: TimeWindow[];
  access_preferences: string[];
  artifact_text: string | null;
  artifact_url: string | null;
  deadline: string | null;
  prior_knowledge: string | null;
  desired_outcome: string | null;
  review_goal: string | null;
  status: RequestStatus;
}
export interface VolunteerOffer extends Timestamps {
  id: string;
  volunteer_id: string;
  service_type: 'career_story';
  title: string;
  description: string;
  industry_tags: string[];
  topic_tags: string[];
  mode: 'live_online' | 'in_person';
  starts_at: string;
  ends_at: string;
  capacity: number;
  total_capacity: number;
  access_features: string[];
  status: OfferStatus;
}
export interface Match {
  id: string;
  request_id: string;
  volunteer_id: string;
  score: number;
  reasons: string[];
  suggested_windows: TimeWindow[];
  status: MatchStatus;
  created_at: string;
}
export interface Engagement extends Timestamps {
  id: string;
  participant_id: string;
  volunteer_id: string;
  service_type: ServiceType;
  request_id: string | null;
  offer_id: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  mode: ResolvedMode;
  duration_minutes: number;
  status: 'confirmed' | 'completed' | 'cancelled';
}
export interface Feedback {
  id: string;
  engagement_id: string;
  submitted_by: string;
  helpful: boolean;
  rating: number | null;
  comment: string | null;
  follow_up_requested: boolean;
  created_at: string;
}
export interface Tables {
  users: User;
  participant_profiles: ParticipantProfile;
  volunteer_profiles: VolunteerProfile;
  service_requests: ServiceRequest;
  volunteer_offers: VolunteerOffer;
  matches: Match;
  engagements: Engagement;
  feedback: Feedback;
}
