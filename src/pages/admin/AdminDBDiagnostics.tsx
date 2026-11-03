/**
 * Database Diagnostics Admin Page
 * 
 * Public diagnostic page for database status and recovery
 * Located at /baki/stage/admin/db
 */

import { useState, useEffect, useCallback } from "react";
import { 
  getDatabaseStatus, 
  getSqlFiles, 
  testAuthTrigger,
  type DatabaseStatus 
} from "@/lib/db/diagnostic-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Database, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  FileCode,
  Play,
  Loader2,
  Copy,
  ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export default function AdminDBDiagnostics() {
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [triggerStatus, setTriggerStatus] = useState<{ working: boolean; error?: string } | null>(null);
  const { toast } = useToast();

  const addLog = useCallback((level: LogEntry['level'], message: string) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };
    setLogs(prev => [...prev, entry]);
    console.log(`[DB DIAG] ${level.toUpperCase()}: ${message}`);
  }, []);

  const runDiagnostics = useCallback(async () => {
    setLoading(true);
    setLogs([]);
    addLog('info', 'Starting database diagnostics...');

    try {
      // Check database status
      addLog('info', 'Checking database connection...');
      const dbStatus = await getDatabaseStatus();
      setStatus(dbStatus);

      if (!dbStatus.connected) {
        addLog('error', `Connection failed: ${dbStatus.connectionError}`);
        return;
      }

      addLog('success', 'Connected to database');

      // Log table status
      const missingTables = dbStatus.tables.filter(t => !t.exists);
      const existingTables = dbStatus.tables.filter(t => t.exists);

      addLog('info', `Tables: ${existingTables.length}/${dbStatus.summary.tablesTotal} exist`);
      
      if (missingTables.length > 0) {
        addLog('warn', `Missing tables: ${missingTables.map(t => t.name).join(', ')}`);
      }

      // Test auth trigger
      addLog('info', 'Testing auth trigger...');
      const triggerTest = await testAuthTrigger();
      setTriggerStatus(triggerTest);

      if (triggerTest.working) {
        addLog('success', 'Auth trigger is working');
      } else {
        addLog('error', `Auth trigger issue: ${triggerTest.error}`);
      }

      addLog('success', 'Diagnostics complete');

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', `Diagnostics failed: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [addLog]);

  useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "SQL file path copied to clipboard",
    });
  };

  const sqlFiles = getSqlFiles();

  const getStatusIcon = (exists: boolean) => {
    return exists ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getLogIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'success':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'error':
        return <XCircle className="h-3 w-3 text-red-500" />;
      case 'warn':
        return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
      default:
        return <Database className="h-3 w-3 text-blue-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Database className="h-8 w-8" />
              Database Diagnostics
            </h1>
            <p className="text-muted-foreground mt-1">
              Database status, health checks, and recovery tools
            </p>
          </div>
          <Button 
            onClick={runDiagnostics} 
            disabled={loading}
            size="lg"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Run Diagnostics
          </Button>
        </div>

        {/* Connection Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Connection Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {status?.connected ? (
                <>
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Last checked: {status?.timestamp ? new Date(status.timestamp).toLocaleTimeString() : 'N/A'}
                  </span>
                </>
              ) : (
                <>
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    Disconnected
                  </Badge>
                  {status?.connectionError && (
                    <span className="text-sm text-red-500">
                      {status.connectionError}
                    </span>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Tables Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                Tables
                {status && (
                  <Badge variant={status.summary.tablesExisting === status.summary.tablesTotal ? "default" : "destructive"}>
                    {status.summary.tablesExisting}/{status.summary.tablesTotal}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Required database tables</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {status?.tables.map((table) => (
                    <div 
                      key={table.name} 
                      className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        {getStatusIcon(table.exists)}
                        <span className="font-mono text-sm">{table.name}</span>
                      </div>
                      {table.exists && table.rowCount !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          {table.rowCount} rows
                        </span>
                      )}
                      {!table.exists && table.error && (
                        <span className="text-xs text-red-500">
                          Missing
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Logs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Diagnostic Logs</CardTitle>
              <CardDescription>Real-time diagnostic output</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-1 font-mono text-xs">
                  {logs.map((log, i) => (
                    <div 
                      key={i} 
                      className={`flex items-start gap-2 py-1 px-2 rounded ${
                        log.level === 'error' ? 'bg-red-500/10' :
                        log.level === 'warn' ? 'bg-yellow-500/10' :
                        log.level === 'success' ? 'bg-green-500/10' :
                        ''
                      }`}
                    >
                      {getLogIcon(log.level)}
                      <span className="text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <div className="text-muted-foreground text-center py-8">
                      No logs yet. Run diagnostics to see output.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Auth Trigger Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Auth Trigger Status</CardTitle>
            <CardDescription>
              The auth trigger (on_auth_user_created) is critical for user signup
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {triggerStatus === null ? (
                <Badge variant="secondary">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Checking...
                </Badge>
              ) : triggerStatus.working ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Working
                </Badge>
              ) : (
                <>
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    Issue Detected
                  </Badge>
                  <span className="text-sm text-red-500">
                    {triggerStatus.error}
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* SQL Files for Manual Execution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              SQL Files for Manual Execution
            </CardTitle>
            <CardDescription>
              If auto-setup fails, run these files in order in the SQL Editor
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sqlFiles.map((file) => (
                <div 
                  key={file.name}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                      {file.order}
                    </div>
                    <div>
                      <p className="font-mono font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{file.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => copyToClipboard(`supabase/database/${file.name}`)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            <Separator className="my-4" />
            
            <div className="bg-muted/30 p-4 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Play className="h-4 w-4" />
                Execution Order
              </h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Run <code className="bg-muted px-1 rounded">01-tables.sql</code> first - creates all tables</li>
                <li>Run <code className="bg-muted px-1 rounded">02-functions.sql</code> - creates helper functions</li>
                <li>Run <code className="bg-muted px-1 rounded">03-triggers.sql</code> - sets up auth trigger</li>
                <li>Run <code className="bg-muted px-1 rounded">04-rls.sql</code> - enables security policies</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Environment Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Environment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">SUPABASE_URL</p>
                <p className="font-mono truncate">
                  {import.meta.env.VITE_SUPABASE_URL ? '✓ Set' : '✗ Missing'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">ANON_KEY</p>
                <p className="font-mono truncate">
                  {import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? '✓ Set' : '✗ Missing'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">PROJECT_ID</p>
                <p className="font-mono truncate">
                  {import.meta.env.VITE_SUPABASE_PROJECT_ID || 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Mode</p>
                <p className="font-mono">
                  {import.meta.env.DEV ? 'Development' : 'Production'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
