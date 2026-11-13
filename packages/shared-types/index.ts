export type ManufacturingType = 'Woven' | 'Knit';
export type DeploymentMode = 'single-business' | 'saas';
export interface TenantOwned {
  tenantId: string;
}
