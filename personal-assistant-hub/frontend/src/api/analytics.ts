import client from './client';

export interface ProductivityReport {
  id: number;
  user_id: number;
  report_date: string;
  tasks_completed: number;
  total_expenses: number;
  entertainment_expenses: number;
  correlation_score: number;
  insight: string;
  created_at: string;
}

export interface BudgetForecast {
  id: number;
  user_id: number;
  forecast_date: string;
  predicted_expenses: number;
  budget_limit: number;
  risk_level: string;
  recommendation: string;
  created_at: string;
}

export interface CorrelationData {
  dates: string[];
  tasks_completed: number[];
  expenses: number[];
  correlation_score: number;
}

export interface InsightResponse {
  insight: string;
}

export const analyticsApi = {
  getProductivityReports: () =>
    client.get<ProductivityReport[]>('/integration/api/analytics/productivity-reports'),

  getBudgetForecasts: () =>
    client.get<BudgetForecast[]>('/integration/api/analytics/budget-forecasts'),

  getInsights: () =>
    client.get<InsightResponse>('/integration/api/analytics/insights'),

  getCorrelation: () =>
    client.get<CorrelationData>('/integration/api/analytics/correlation'),
};
