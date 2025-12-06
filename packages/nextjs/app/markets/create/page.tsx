"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export default function CreateMarketPage() {
  const router = useRouter();
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [bettingDuration, setBettingDuration] = useState("0.0167"); // in hours (1 minute default for testing)
  const [monitoringDuration, setMonitoringDuration] = useState("0.167"); // in hours (10 minutes default for testing)
  const { writeContractAsync, isPending } = useScaffoldWriteContract("UptimeMarket");

  const handleCreateMarket = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!websiteUrl) {
      alert("Please enter a website URL");
      return;
    }

    // Validate URL
    try {
      new URL(websiteUrl);
    } catch {
      alert("Please enter a valid URL (e.g., https://example.com)");
      return;
    }

    const bettingHours = parseFloat(bettingDuration);
    const monitoringHours = parseFloat(monitoringDuration);

    if (bettingHours < 0.0167 || bettingHours > 168) {
      alert("Betting duration must be between 1 minute and 7 days");
      return;
    }

    if (monitoringHours < 0.0167 || monitoringHours > 720) {
      alert("Monitoring duration must be between 1 minute and 30 days");
      return;
    }

    try {
      const bettingSeconds = BigInt(Math.floor(bettingHours * 60 * 60));
      const monitoringSeconds = BigInt(Math.floor(monitoringHours * 60 * 60));
      await writeContractAsync({
        functionName: "createMarket",
        args: [websiteUrl, bettingSeconds, monitoringSeconds],
      });

      alert("Market created successfully!");
      router.push("/markets");
    } catch (error) {
      console.error("Error creating market:", error);
      alert("Failed to create market. Check console for details.");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Create Uptime Market</h1>
        <p className="text-base-content/60">Create a prediction market for any website's uptime</p>
      </div>

      <form onSubmit={handleCreateMarket} className="card bg-base-200">
        <div className="card-body">
          {/* Website URL */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Website URL</span>
            </label>
            <input
              type="url"
              placeholder="https://example.com"
              className="input input-bordered"
              value={websiteUrl}
              onChange={e => setWebsiteUrl(e.target.value)}
              required
            />
            <label className="label">
              <span className="label-text-alt">The website to monitor for uptime</span>
            </label>
          </div>

          {/* Betting Duration */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Betting Duration</span>
            </label>
            <select
              className="select select-bordered"
              value={bettingDuration}
              onChange={e => setBettingDuration(e.target.value)}
            >
              <option value="0.0167">1 minute (for testing)</option>
              <option value="0.167">10 minutes</option>
              <option value="0.5">30 minutes</option>
              <option value="1">1 hour</option>
              <option value="6">6 hours</option>
              <option value="12">12 hours</option>
              <option value="24">24 hours (1 day)</option>
              <option value="48">48 hours (2 days)</option>
              <option value="72">72 hours (3 days)</option>
              <option value="168">1 week</option>
            </select>
            <label className="label">
              <span className="label-text-alt">How long users can place bets</span>
            </label>
          </div>

          {/* Monitoring Duration */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Monitoring Duration</span>
            </label>
            <select
              className="select select-bordered"
              value={monitoringDuration}
              onChange={e => setMonitoringDuration(e.target.value)}
            >
              <option value="0.0167">1 minute (for testing)</option>
              <option value="0.167">10 minutes</option>
              <option value="0.5">30 minutes</option>
              <option value="1">1 hour</option>
              <option value="6">6 hours</option>
              <option value="12">12 hours</option>
              <option value="24">24 hours (1 day)</option>
              <option value="48">48 hours (2 days)</option>
              <option value="72">72 hours (3 days)</option>
              <option value="168">1 week</option>
              <option value="336">2 weeks</option>
              <option value="720">30 days</option>
            </select>
            <label className="label">
              <span className="label-text-alt">How long to monitor the website's uptime</span>
            </label>
          </div>

          {/* Info Box */}
          <div className="alert alert-info mt-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="stroke-current shrink-0 w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <div className="text-sm">
              <p className="font-bold">Market Timeline:</p>
              <ul className="list-disc list-inside mt-2">
                <li>Betting Period: {bettingDuration} hours (users place bets)</li>
                <li>Monitoring Period: {monitoringDuration} hours (oracle tracks uptime)</li>
                <li>Resolution: 1 hour after monitoring ends</li>
                <li>Total Duration: {parseInt(bettingDuration) + parseInt(monitoringDuration) + 1} hours</li>
              </ul>
              <p className="font-bold mt-3">Rules:</p>
              <ul className="list-disc list-inside mt-1">
                <li>YES wins if uptime ≥ 99%, NO wins if uptime &lt; 99%</li>
                <li>Winners split the pool minus 2% platform fee</li>
                <li>Minimum bet: 0.001 ETH</li>
              </ul>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-base-300 p-4 rounded-lg mt-4">
            <h3 className="font-bold mb-2">Preview:</h3>
            <div className="text-sm space-y-1">
              <p>
                <span className="text-base-content/60">Website:</span>{" "}
                <span className="font-semibold">{websiteUrl || "Not set"}</span>
              </p>
              <p>
                <span className="text-base-content/60">Betting Period:</span>{" "}
                <span className="font-semibold">
                  {parseFloat(bettingDuration) < 1
                    ? `${Math.round(parseFloat(bettingDuration) * 60)} minutes`
                    : `${bettingDuration} hours`}
                </span>
              </p>
              <p>
                <span className="text-base-content/60">Monitoring Period:</span>{" "}
                <span className="font-semibold">
                  {parseFloat(monitoringDuration) < 1
                    ? `${Math.round(parseFloat(monitoringDuration) * 60)} minutes`
                    : `${monitoringDuration} hours`}
                </span>
              </p>
              <p>
                <span className="text-base-content/60">Betting Closes:</span>{" "}
                <span className="font-semibold">
                  {new Date(Date.now() + parseFloat(bettingDuration) * 60 * 60 * 1000).toLocaleString()}
                </span>
              </p>
              <p>
                <span className="text-base-content/60">Monitoring Ends:</span>{" "}
                <span className="font-semibold">
                  {new Date(
                    Date.now() + (parseFloat(bettingDuration) + parseFloat(monitoringDuration)) * 60 * 60 * 1000,
                  ).toLocaleString()}
                </span>
              </p>
              <p>
                <span className="text-base-content/60">Uptime Threshold:</span>{" "}
                <span className="font-semibold">99%</span>
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="card-actions justify-end mt-6">
            <button type="button" className="btn btn-ghost" onClick={() => router.push("/markets")}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isPending || !websiteUrl}>
              {isPending ? (
                <>
                  <span className="loading loading-spinner"></span>
                  Creating...
                </>
              ) : (
                "Create Market"
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Help Section */}
      <div className="mt-8 card bg-base-100">
        <div className="card-body">
          <h2 className="card-title">Need Help?</h2>
          <div className="space-y-2 text-sm">
            <details className="collapse collapse-arrow bg-base-200">
              <summary className="collapse-title font-medium">What happens after I create a market?</summary>
              <div className="collapse-content">
                <p>
                  Once created, the market enters the betting period where users can place bets. After the betting
                  period ends, the monitoring period begins where the oracle tracks the website's uptime by performing
                  regular checks. Finally, the oracle resolves the market based on the uptime percentage.
                </p>
              </div>
            </details>
            <details className="collapse collapse-arrow bg-base-200">
              <summary className="collapse-title font-medium">How is uptime measured?</summary>
              <div className="collapse-content">
                <p>
                  The oracle performs regular HTTP checks throughout the monitoring period. Uptime percentage is
                  calculated as (successful checks / total checks) × 100. Sites with ≥99% uptime result in YES winning.
                </p>
              </div>
            </details>
            <details className="collapse collapse-arrow bg-base-200">
              <summary className="collapse-title font-medium">Can I cancel a market?</summary>
              <div className="collapse-content">
                <p>
                  Only the contract owner can cancel markets in emergencies. Regular users cannot cancel markets after
                  creation to ensure fairness.
                </p>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
