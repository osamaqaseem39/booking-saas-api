export const SAAS_FEATURES = [
  'padel_module',
  'turf_module',
  'table_tennis_module',
  'gaming_module',
  'analytics_dashboard',
  'public_api_access',
] as const;

export type SaasFeature = (typeof SAAS_FEATURES)[number];

export const SAAS_PLAN_IDS = ['basic', 'standard', 'premium', 'enterprise'] as const;

export type SaasPlanId = (typeof SAAS_PLAN_IDS)[number];

export interface EntitlementsSnapshot {
  tenantId: string;
  planId: SaasPlanId;
  subscriptionStatus: string;
  billingCycle: string | null;
  /** When false, treat the tenant as not licensed for paid modules (read APIs may still differ per route). */
  isPayingActive: boolean;
  features: Record<SaasFeature, boolean>;
  limits: {
    /** null means unlimited */
    maxBusinessLocations: number | null;
  };
}
