import { SetMetadata } from '@nestjs/common';
import type { SaasFeature } from './saas-subscription.types';

export const SAAS_FEATURES_KEY = 'saas_features_required';

/** Gate a route by one or more SaaS features; all must be enabled for the tenant. */
export const RequireSaasFeatures = (...features: SaasFeature[]) =>
  SetMetadata(SAAS_FEATURES_KEY, features);
