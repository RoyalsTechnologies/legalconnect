export type Role = 'USER' | 'LAWYER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';
export type Urgency = 'NORMAL' | 'IMPORTANT' | 'URGENT';
export type AiStatus = 'PENDING' | 'COMPLETED' | 'FAILED_FALLBACK';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ConsultationStatus =
  | 'AWAITING_PAYMENT'
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  status: UserStatus;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export interface AuthResult {
  user: PublicUser;
  token: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  accountType?: 'citizen' | 'lawyer';
  displayName?: string;
  firmName?: string;
  bio?: string;
  licenseNumber?: string;
  city?: string;
  region?: string;
  yearsExperience?: number;
  consultationFeeGhs?: number;
  practiceAreaIds?: string[];
}

export interface RegisterResult {
  message: string;
  email: string;
}

export interface IntakeView {
  id: string;
  originalDescription: string;
  city: string | null;
  region: string | null;
  aiSummary: string | null;
  urgency: Urgency | null;
  keywords: string[];
  confidence: number | null;
  needsHumanReview: boolean;
  aiStatus: AiStatus;
  aiError: string | null;
  createdAt: string;
  category: { id: string; name: string; slug: string } | null;
}

export interface LegalCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
}

export interface LawyerView {
  id: string;
  displayName: string;
  firmName: string | null;
  bio: string;
  licenseNumber: string | null;
  city: string;
  region: string;
  isAvailable: boolean;
  approvalStatus: ApprovalStatus;
  yearsExperience: number | null;
  consultationFeePesewas: number;
  createdAt: string;
  practiceAreas: Array<{ legalCategory: { id: string; name: string; slug: string } }>;
  subscription: {
    active: boolean;
    periodEnd: string | null;
    package: SubscriptionPackage | null;
  };
}

export interface SubscriptionPackage {
  id: string;
  name: string;
  slug: string;
  description: string;
  monthlyFeePesewas: number;
  maxPracticeAreas: number;
  isActive: boolean;
  createdAt?: string;
}

export interface SubscriptionView {
  active: boolean;
  periodEnd: string | null;
  package: SubscriptionPackage | null;
}

export interface LawyerPage {
  results: LawyerView[];
  total: number;
  limit: number;
  offset: number;
}

/** The lawyer shape returned by matching — a trimmed profile plus flattened areas. */
export interface RecommendedLawyer {
  id: string;
  displayName: string;
  firmName: string | null;
  bio: string;
  city: string;
  region: string;
  isAvailable: boolean;
  yearsExperience: number | null;
  consultationFeePesewas: number;
  practiceAreas: string[];
}

export interface Recommendation {
  lawyer: RecommendedLawyer;
  score: number;
  reason: string;
}

export interface MatchResult {
  intakeId: string;
  category: { id: string; name: string } | null;
  recommendations: Recommendation[];
  note: string | null;
}

export interface ConsultationView {
  id: string;
  status: ConsultationStatus;
  clientMessage: string | null;
  matchReason: string;
  feePesewas: number;
  paymentReference: string | null;
  scheduledAt: string;
  meetUrl: string | null;
  durationMinutes: number;
  googleCalendarUrl: string;
  createdAt: string;
  updatedAt: string;
  intake: {
    id: string;
    originalDescription: string;
    aiSummary: string | null;
    urgency: Urgency | null;
    keywords: string[];
    needsHumanReview: boolean;
    aiStatus: AiStatus;
    city: string | null;
    region: string | null;
    category: { id: string; name: string } | null;
  };
  client: { id: string; fullName: string; phone: string | null };
  lawyerProfile: {
    id: string;
    displayName: string;
    firmName: string | null;
    city: string;
    region: string;
  };
}

export interface AdminUserView {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  status: UserStatus;
  createdAt: string;
  lawyerProfile: { id: string; displayName: string; approvalStatus: ApprovalStatus } | null;
}

export interface PlatformStats {
  users: { total: number; suspended: number };
  lawyers: { total: number; approved: number; pending: number; subscribed: number };
  categories: { active: number };
  intakes: { total: number; needsReview: number; aiFallback: number };
  consultations: { total: number; pending: number };
}
