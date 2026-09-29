# CEO Reporting Sources

The CEO dashboard is a reporting consumer. It does not connect to or query the Pasalho PostgreSQL database.

## First reporting layer

| Metric | Source system | API/read model | Calculation |
| --- | --- | --- | --- |
| Store sales | CEO Dashboard | Local store sales read model | Sum completed store sales in the selected period |
| B2B sales | Pasalho | `GET /api/reporting/daily-summary` | Pasalho-provided B2B total |
| Online sales | Pasalho | `GET /api/reporting/daily-summary` | Pasalho-provided online total |
| Total sales | Pasalho + CEO Dashboard | Pasalho reporting API plus local store read model | Store sales + Pasalho B2B sales + Pasalho online sales |
| Orders | Pasalho + CEO Dashboard | Pasalho reporting API plus local store read model | Store completed orders + Pasalho order count |
| Cancelled orders | Pasalho + CEO Dashboard | Pasalho reporting API plus local store read model | Store cancelled/voided orders + Pasalho cancelled orders |
| Sales by store | CEO Dashboard | Local store sales read model | Group completed store sales by branch |
| Warehouse inventory | Pasalho | `GET /api/reporting/daily-summary` | Pasalho-provided warehouse snapshot |
| Store inventory | CEO Dashboard | Local `stock_balances` store read model | Sum store stock balances by tracked product |
| Low-stock products | Pasalho + CEO Dashboard | Pasalho reporting API plus local store read model | Store low-stock count + Pasalho warehouse low-stock count |

Pasalho metrics are `null` when `PASALHO_REPORTING_API_URL` is not configured or the API is unavailable. The dashboard never converts that absence into zero.

## Configuration

Set `PASALHO_REPORTING_API_URL` to the Pasalho reporting service base URL and optionally set `PASALHO_REPORTING_API_TOKEN`. The expected endpoint is `GET /api/reporting/daily-summary` with `startDate` and `endDate` query parameters.
