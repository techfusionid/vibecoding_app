import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { Fragment } from "@/generated/prisma";
import { ExternalLinkIcon, RefreshCcwIcon, AlertTriangleIcon } from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface Props {
  data: Fragment;
}

export function FragmentWeb({ data }: Props) {
  const [fragmentKey, setFragmentKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [serverReady, setServerReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Poll sandbox URL until it responds with 200
  useEffect(() => {
    if (!data.sandboxUrl) return;

    setServerReady(false);
    setIsLoading(true);

    const checkServer = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(data.sandboxUrl, {
          mode: "no-cors",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        // no-cors returns opaque response, so we treat any network success as ready
        setServerReady(true);
      } catch {
        // still starting up
      }
    };

    // Check immediately, then poll every 2s
    checkServer();
    const interval = setInterval(checkServer, 2000);
    return () => clearInterval(interval);
  }, [data.sandboxUrl]);

  const onRefresh = () => {
    setFragmentKey((prev) => prev + 1);
    setIsLoading(true);
    setHasError(false);
    setServerReady(false);
  };

  const handleCopy = () => {
    // Use a fallback approach since clipboard API may be blocked in iframe context
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(data.sandboxUrl).catch(() => {
          // Fallback: create a temporary input element
          const input = document.createElement("input");
          input.value = data.sandboxUrl;
          document.body.appendChild(input);
          input.select();
          document.execCommand("copy");
          document.body.removeChild(input);
        });
      } else {
        // Fallback for older browsers
        const input = document.createElement("input");
        input.value = data.sandboxUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn("Copy failed:", e);
    }
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  useEffect(() => {
    // Reset state when sandboxUrl changes
    setIsLoading(true);
    setHasError(false);
    setServerReady(false);
  }, [data.sandboxUrl]);

  return (
    <div className="flex flex-col w-full h-full">
      <div className="p-2 border-b bg-sidebar flex items-center gap-x-2">
        <Hint text="Refresh" side="bottom">
          <Button size="sm" variant={"outline"} onClick={onRefresh}>
            <RefreshCcwIcon />
          </Button>
        </Hint>
        <Hint text="Click to copy" side="bottom">
          <Button
            size="sm"
            variant={"outline"}
            onClick={handleCopy}
            disabled={!data.sandboxUrl || copied}
            className="flex-1 justify-start text-start font-normal"
          >
            <span className="truncate">{data.sandboxUrl}</span>
          </Button>
        </Hint>
        <Hint text="Open in a new tab" side="bottom" align="start">
          <Button
            size="sm"
            disabled={!data.sandboxUrl}
            variant={"outline"}
            onClick={() => {
              if (!data.sandboxUrl) return;
              window.open(data.sandboxUrl, "_blank");
            }}
          >
            <ExternalLinkIcon />
          </Button>
        </Hint>
      </div>

      {/* Loading state — wait for server to be ready */}
      {(!serverReady || isLoading) && !hasError && (
        <div className="h-full w-full flex items-center justify-center bg-muted/30">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading preview...</p>
          </div>
        </div>
      )}

      {/* Error state - sandbox not found/expired */}
      {hasError && (
        <div className="h-full w-full flex items-center justify-center bg-muted/30">
          <div className="flex flex-col items-center gap-4 max-w-sm text-center p-6">
            <div className="p-4 rounded-full bg-destructive/10">
              <AlertTriangleIcon className="w-10 h-10 text-destructive" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-1">Preview Unavailable</h3>
              <p className="text-sm text-muted-foreground mb-4">
                The sandbox preview has expired or is no longer available. This happens when the preview
                environment shuts down after some time.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={onRefresh} variant="default">
                <RefreshCcwIcon className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button
                onClick={() => {
                  if (!data.sandboxUrl) return;
                  window.open(data.sandboxUrl, "_blank");
                }}
                variant="outline"
              >
                <ExternalLinkIcon className="w-4 h-4 mr-2" />
                Open Anyway
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* iframe - only show when server is ready and not error */}
      {serverReady && !hasError && (
        <iframe
          key={fragmentKey}
          ref={iframeRef}
          className="h-full w-full"
          sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
          loading="lazy"
          src={data.sandboxUrl}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      )}
    </div>
  );
}
