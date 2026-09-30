export type ReadinessChecks = {
  database: 'ok' | 'error';
  pasalho_reporting: 'configured' | 'not_configured';
};

export async function evaluateReadiness(
  checkDatabase: () => Promise<unknown>,
  pasalhoReportingConfigured: boolean,
): Promise<{ ready: boolean; checks: ReadinessChecks }> {
  const checks: ReadinessChecks = {
    database: 'ok',
    pasalho_reporting: pasalhoReportingConfigured ? 'configured' : 'not_configured',
  };
  try {
    await checkDatabase();
  } catch {
    checks.database = 'error';
  }
  return { ready: checks.database === 'ok', checks };
}
