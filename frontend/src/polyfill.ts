// Solana's browser libraries expect Node's Buffer. This must load before they do.
import { Buffer } from "buffer";

(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
