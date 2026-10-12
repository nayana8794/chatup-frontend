// chatup/frontend/src/context/useRealtime.ts
import { useContext } from "react";
import { RealtimeContext, type RealtimeContextType } from "./RealtimeContext";

// Standalone hook export complying with verbatimModuleSyntax
export const useRealtime = (): RealtimeContextType => useContext(RealtimeContext);