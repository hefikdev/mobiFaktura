"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

interface ErrorDisplayProps {
  title?: string;
  message: string;
  error?: unknown;
  className?: string;
}

export function ErrorDisplay({ 
  title = "Wystąpił błąd", 
  message, 
  error,
  className = "" 
}: ErrorDisplayProps) {
  const [showDetails, setShowDetails] = useState(false);

  const errorDetails = error ? (() => {
    if (error instanceof Error) {
      return {
        message: error.message || message,
        stack: error.stack,
      };
    }
    if (typeof error === 'object' && error !== null) {
      const err = error as Record<string, unknown>;
      return {
        message: (typeof err.message === 'string' ? err.message : message),
        code: err.data && typeof err.data === 'object' ? (err.data as Record<string, unknown>).code : err.code,
        path: err.data && typeof err.data === 'object' ? (err.data as Record<string, unknown>).path : undefined,
        data: err.data,
      };
    }
    return { message };
  })() : null;

  return (
    <Card className={`border-red-200 dark:border-red-900 ${className}`}>
      <CardContent className="py-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
            <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {message}
            </p>
          </div>
          {errorDetails && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="gap-2"
              >
                {showDetails ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Ukryj szczegóły
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Pokaż szczegóły
                  </>
                )}
              </Button>
              {showDetails && (
                <div className="w-full mt-4 p-4 bg-red-50 dark:bg-red-950/50 rounded-lg border border-red-200 dark:border-red-800">
                  <pre className="text-xs text-left overflow-x-auto whitespace-pre-wrap break-words">
                    {JSON.stringify(errorDetails, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
