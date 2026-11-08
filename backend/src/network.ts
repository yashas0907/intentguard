import { setDefaultResultOrder } from "node:dns";
import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";
import { Agent, setGlobalDispatcher } from "undici";

// Node's defaults assume a fast connection: 250 ms per server address and 10 s overall.
// On a slow network or after idle time, connecting can take longer than that, and
// requests fail with ETIMEDOUT or a connect timeout. Import this first in every entry point.
setDefaultResultOrder("ipv4first");
setDefaultAutoSelectFamilyAttemptTimeout(3_000);
setGlobalDispatcher(new Agent({ connect: { timeout: 30_000 } }));
