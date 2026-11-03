/**
 * Database Initialization Hook
 * 
 * Runs database validation on app startup and provides status to components.
 */

import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { 
  initializeDatabase, 
  getSchemaStatusSummary,
  type SchemaValidationResult 
} from "@/lib/db";

interface DBInitState {
  isInitializing: boolean;
  isConnected: boolean;
  isSchemaValid: boolean;
  isTriggerWorking: boolean;
  schemaResult: SchemaValidationResult | null;
  error: string | null;
  warnings: string[];
  retryInit: () => void;
}

const DBInitContext = createContext<DBInitState | undefined>(undefined);

export function DBInitProvider({ children }: { children: ReactNode }) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isSchemaValid, setIsSchemaValid] = useState(false);
  const [isTriggerWorking, setIsTriggerWorking] = useState(false);
  const [schemaResult, setSchemaResult] = useState<SchemaValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const runInit = async () => {
    setIsInitializing(true);
    setError(null);
    setWarnings([]);
    
    try {
      console.log('\n');
      const result = await initializeDatabase();
      
      setIsConnected(result.connected);
      setIsSchemaValid(result.schemaValid);
      setIsTriggerWorking(result.authTriggerValid);
      setSchemaResult(result.schemaResult);
      setError(result.error);
      
      // Collect warnings
      if (result.schemaResult?.warnings) {
        setWarnings(result.schemaResult.warnings);
      }
      
      // Log detailed status in development
      if (import.meta.env.DEV && result.schemaResult) {
        console.log('\n' + getSchemaStatusSummary(result.schemaResult));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('[DB INIT] Hook error:', err);
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    // Run initialization on mount
    runInit();
  }, []);

  const retryInit = () => {
    runInit();
  };

  return (
    <DBInitContext.Provider
      value={{
        isInitializing,
        isConnected,
        isSchemaValid,
        isTriggerWorking,
        schemaResult,
        error,
        warnings,
        retryInit,
      }}
    >
      {children}
    </DBInitContext.Provider>
  );
}

export function useDBInit() {
  const context = useContext(DBInitContext);
  if (context === undefined) {
    throw new Error("useDBInit must be used within a DBInitProvider");
  }
  return context;
}

/**
 * Simple hook for components that just need to know if DB is ready
 */
export function useDBReady(): boolean {
  const { isInitializing, isConnected, isSchemaValid, isTriggerWorking } = useDBInit();
  return !isInitializing && isConnected && isSchemaValid && isTriggerWorking;
}
