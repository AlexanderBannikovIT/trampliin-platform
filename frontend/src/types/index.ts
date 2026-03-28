export type UserRole = "guest" | "seeker" | "employer" | "curator" | "admin";

export type OpportunityType = "vacancy" | "internship" | "mentorship" | "event";
export type OpportunityFormat = "office" | "hybrid" | "remote";
export type OpportunityStatus = "draft" | "moderation" | "active" | "closed";
export type SortMode = "date" | "salary" | "relevance";
export type ViewMode = "map" | "list";

export type PrivacyLevel = "private" | "contacts" | "public";
export type VerificationStatus = "pending" | "verified" | "rejected";
export type ApplicationStatus =
  | "submitted"
  | "reviewed"
  | "accepted"
  | "rejected"
  | "reserve";

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  category: "language" | "framework" | "level" | "employment" | "direction" | null;
  is_active: boolean;
}

export interface EmployerShort {
  id: string;
  company_name: string;
}

export interface Opportunity {
  id: string;
  employer_id: string;
  title: string;
  description: string | null;
  type: OpportunityType;
  format: OpportunityFormat;
  city: string | null;
  address: string | null;
  /** Returned directly as top-level fields by the backend */
  lat: number | null;
  lng: number | null;
  salary_min: number | null;
  salary_max: number | null;
  published_at: string;
  expires_at: string | null;
  status: OpportunityStatus;
  tags: Tag[];
  employer: EmployerShort | null;
}

export interface GeoJsonPoint {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
}

export interface GeoJsonFeature {
  type: "Feature";
  geometry: GeoJsonPoint;
  properties: {
    id: string;
    title: string;
    type: OpportunityType;
    format: OpportunityFormat;
    salary_min: number | null;
    salary_max: number | null;
    tags: string[];
  };
}

export interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

export interface OpportunityListResponse {
  items: Opportunity[];
  next_cursor: string | null;
  total_count: number;
  geo_json: GeoJsonFeatureCollection;
}

export interface SearchParams {
  q?: string;
  type?: OpportunityType;
  format?: OpportunityFormat;
  salary_min?: number;
  salary_max?: number;
  tags?: string[];
  lat?: number;
  lng?: number;
  radius_km?: number;
  city?: string;
  sort?: SortMode;
  cursor?: string;
}

export interface SeekerProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  university: string | null;
  graduation_year: number | null;
  bio: string | null;
  skills: string[];
  links: Record<string, string>;
  privacy: PrivacyLevel;
}

export interface EmployerProfile {
  id: string;
  user_id: string;
  company_name: string;
  inn: string | null;
  sphere: string | null;
  description: string | null;
  website: string | null;
  corporate_email: string | null;
  verification_status: VerificationStatus;
  verified_at: string | null;
}

export interface Application {
  id: string;
  seeker_id: string;
  opportunity_id: string;
  status: ApplicationStatus;
  applied_at: string;
  opportunity?: Opportunity;
}
