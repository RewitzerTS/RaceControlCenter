# Local Cloudflare test runtime

Wrangler is pinned to **4.129.1** in `package.json` and the lockfile. This is the first release containing Cloudflare's [ProxyWorker connection-recovery fix](https://github.com/cloudflare/workers-sdk/pull/15252), listed in the [upstream changelog](https://github.com/cloudflare/workers-sdk/blob/main/packages/wrangler/CHANGELOG.md#41291).

The previous 4.124.0 runtime could terminate the entire local server when an internal idle keep-alive connection closed during a GET request. Playwright then reported connection failures for all subsequent tests. Restarting the unchanged runtime did not fix the cause.

The upstream fix retries only safe GET/HEAD requests and keeps the development server alive after an individual proxy error. This is not a Playwright retry or a waiver of any application assertion. The existing 104 browser tests, zero test retries, single browser worker, release checks and production approval checks remain unchanged. Worker source, routes, bindings and compatibility date are also unchanged.

For investigation, run the normal local Wrangler server and issue read-only bursts across application routes with idle intervals around five seconds. The release still requires `npm run deploy:production` to complete its entire mandatory verification sequence; a standalone stability probe is not a substitute.

Dependency audit during this repair reported no production-dependency findings. Development-only findings remain in the pre-existing `sharp` and `undici` dependency versions; they were not modified or automatically force-fixed as part of this narrowly scoped runtime repair.
