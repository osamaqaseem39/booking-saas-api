import type { SaasFeature, SaasPlanId } from './saas-subscription.types';

type PlanEntitlements = {
  features: Record<SaasFeature, boolean>;
  maxBusinessLocations: number | null;
};

const enterpriseAll: Record<SaasFeature, boolean> = {
  padel_module: true,
  turf_module: true,
  table_tennis_module: true,
  gaming_module: true,
  analytics_dashboard: true,
  public_api_access: true,
};

/**
 * Default entitlements per commercial plan. Stored `business.subscription` selects the plan;
 * `status !== 'active'` turns off module access regardless of plan.
 */
export const PLAN_ENTITLEMENTS: Record<SaasPlanId, PlanEntitlements> = {
  basic: {
    features: {
      padel_module: true,
      turf_module: false,
      table_tennis_module: true,
      gaming_module: false,
      analytics_dashboard: false,
      public_api_access: false,
    },
    maxBusinessLocations: 1,
  },
  standard: {
    features: {
      padel_module: true,
      turf_module: true,
      table_tennis_module: true,
      gaming_module: false,
      analytics_dashboard: true,
      public_api_access: false,
    },
    maxBusinessLocations: 3,
  },
  premium: {
    features: {
      padel_module: true,
      turf_module: true,
      table_tennis_module: true,
      gaming_module: true,
      analytics_dashboard: true,
      public_api_access: true,
    },
    maxBusinessLocations: 10,
  },
  enterprise: {
    features: { ...enterpriseAll },
    maxBusinessLocations: null,
  },
};

export function normalizePlanId(raw: string | undefined | null): SaasPlanId {
  const key = (raw ?? 'basic').trim().toLowerCase();
  if (key === 'standard' || key === 'premium' || key === 'enterprise') {
    return key;
  }
  return 'basic';
}
