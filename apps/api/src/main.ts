import { bootstrapHttpApp } from './bootstrap-http';
import { bootstrapEnterpriseApp } from './bootstrap-enterprise';

const mode = process.env.API_MODE ?? 'legacy';

if (mode === 'enterprise') {
  void bootstrapEnterpriseApp();
} else {
  void bootstrapHttpApp();
}
