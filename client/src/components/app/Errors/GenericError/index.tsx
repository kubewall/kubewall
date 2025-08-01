import { Home, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function GenericError() {
  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-3xl font-bold text-red-600">Oops! Something Went Wrong</h1>
        <p className="mt-4 text-center">
          Please try again, and if the issue persists, log the error on GitHub.
        </p>
        <div className="mt-6 flex space-x-4">
          <Button variant="outline"
            className="flex items-center hover:bg-muted-foreground/20"
            onClick={() => window.location.href = '/'}
          >
            <Home className="w-5 h-5 mr-2" />
            Go Back Home
          </Button>

          <Button variant="outline" className="flex items-center hover:bg-muted-foreground/20" onClick={() => window.location.reload()}>
            <RefreshCcw className="w-5 h-5 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    </>
  );
}
