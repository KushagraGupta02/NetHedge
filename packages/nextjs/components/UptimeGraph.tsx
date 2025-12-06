"use client";

import { UptimeCheck } from "~~/hooks/uptime";

interface UptimeGraphProps {
  checks: UptimeCheck[];
  websiteUrl: string;
  isMonitoringEnded?: boolean;
  status?: number;
}

export const UptimeGraph = ({ checks, websiteUrl, isMonitoringEnded, status }: UptimeGraphProps) => {
  const hasData = checks && checks.length > 0;

  // Calculate uptime percentage
  const totalChecks = hasData ? checks.length : 0;
  const successfulChecks = hasData ? checks.filter(c => c.isUp).length : 0;
  const uptimePercentage = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0;

  // Calculate average response time for successful checks
  const successfulResponseTimes = hasData ? checks.filter(c => c.isUp).map(c => Number(c.responseTime)) : [];
  const avgResponseTime =
    successfulResponseTimes.length > 0
      ? successfulResponseTimes.reduce((a, b) => a + b, 0) / successfulResponseTimes.length
      : 0;

  return (
    <div className="card bg-base-200">
      <div className="card-body">
        <h2 className="card-title">Uptime Monitoring - {websiteUrl}</h2>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="stats shadow">
            <div className="stat p-4">
              <div className="stat-title text-xs">Uptime</div>
              <div className={`stat-value text-xl ${hasData ? (uptimePercentage >= 99 ? "text-success" : "text-error") : "text-base-content/40"}`}>
                {hasData ? uptimePercentage.toFixed(2) : "--"}%
              </div>
              <div className="stat-desc">{successfulChecks} / {totalChecks} checks</div>
            </div>
          </div>
          <div className="stats shadow">
            <div className="stat p-4">
              <div className="stat-title text-xs">Total Checks</div>
              <div className={`stat-value text-xl ${hasData ? "" : "text-base-content/40"}`}>
                {hasData ? totalChecks : "--"}
              </div>
              <div className="stat-desc">{hasData ? "Monitoring points" : "Waiting for data"}</div>
            </div>
          </div>
          <div className="stats shadow">
            <div className="stat p-4">
              <div className="stat-title text-xs">Avg Response</div>
              <div className={`stat-value text-xl ${hasData ? "" : "text-base-content/40"}`}>
                {hasData ? avgResponseTime.toFixed(0) : "--"}
              </div>
              <div className="stat-desc">ms</div>
            </div>
          </div>
        </div>

        {/* Timeline Graph */}
        <div className="bg-base-100 p-4 rounded-lg">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-semibold">Status Timeline</span>
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-success rounded"></div>
                UP
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-error rounded"></div>
                DOWN
              </span>
            </div>
          </div>

          {/* Simple visual timeline */}
          <div className="flex gap-0.5 h-16 items-end">
            {!hasData && (
              <div className="flex-1 flex items-center justify-center text-base-content/40 text-sm">
                {status === 0 ? "Waiting for monitoring to start..." :
                  isMonitoringEnded ? "No data collected during monitoring period" :
                    "Waiting for monitoring data..."}
              </div>
            )}
            {hasData && checks.map((check, idx) => {
              const timestamp = new Date(Number(check.timestamp) * 1000);
              const height = check.isUp ? "100%" : "20%";
              const color = check.isUp ? "bg-success" : "bg-error";

              return (
                <div
                  key={idx}
                  className={`flex-1 ${color} rounded-t transition-all hover:opacity-80 cursor-pointer relative group`}
                  style={{ height }}
                  title={`${timestamp.toLocaleString()}\nStatus: ${check.isUp ? "UP" : "DOWN"}\nResponse: ${check.responseTime}ms`}
                >
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                    <div className="bg-base-300 text-xs p-2 rounded shadow-lg whitespace-nowrap">
                      <div>{timestamp.toLocaleString()}</div>
                      <div className="font-semibold">{check.isUp ? "UP" : "DOWN"}</div>
                      <div>{check.responseTime.toString()}ms</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time labels */}
          {hasData && (
            <div className="flex justify-between mt-2 text-xs text-base-content/60">
              <span>{new Date(Number(checks[0].timestamp) * 1000).toLocaleString()}</span>
              <span>{new Date(Number(checks[checks.length - 1].timestamp) * 1000).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Detailed List */}
        <div className="mt-4">
          <details className="collapse collapse-arrow bg-base-100">
            <summary className="collapse-title font-medium text-sm">View Detailed Check History</summary>
            <div className="collapse-content">
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="table table-xs">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Timestamp</th>
                      <th>Status</th>
                      <th>Response Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checks.map((check, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td className="text-xs">{new Date(Number(check.timestamp) * 1000).toLocaleString()}</td>
                        <td>
                          <span className={`badge badge-xs ${check.isUp ? "badge-success" : "badge-error"}`}>
                            {check.isUp ? "UP" : "DOWN"}
                          </span>
                        </td>
                        <td>{check.responseTime.toString()}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};
