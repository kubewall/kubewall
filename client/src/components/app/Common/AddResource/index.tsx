import './index.css';

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { resetUpdateYaml, updateYaml } from '@/data/Yaml/YamlUpdateSlice';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';

import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { FilePlusIcon } from "@radix-ui/react-icons";
import { Loader } from '../../Loader';
import { kwList } from '@/routes';
import { toast } from 'sonner';
import { useTheme } from '@/components/app/ThemeProvider';

// Monaco is a multi-MB dependency; load it only once the Add Resource dialog
// actually needs to render an editor instead of paying for it in the main bundle.
const Editor = lazy(() => import('../../Details/YamlEditor/MonacoWrapper'));

const AddResource = () => {
  const dispatch = useAppDispatch();
  const [value, setValue] = useState('');
  const { config } = kwList.useParams();
  const { cluster } = kwList.useSearch();
  const { monacoTheme } = useTheme();

  const queryParams = new URLSearchParams({
    config,
    cluster
  }).toString();

  const {
    error,
    yamlUpdateResponse,
    loading: yamlUpdateLoading
  } = useAppSelector((state) => state.updateYaml);


  const onChange = useCallback((val = '') => {
    setValue(val);
  }, []);

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [editorDimensions, setEditorDimensions] = useState({ width: "100%", height: "100%" });
  const [isDialogOpen, setIsDialogOpen] = useState(false); // Track dialog open state

  const yamlUpdate = () => {
    dispatch(updateYaml({
      data: value,
      queryParams
    }));
  };

  const onDialogOpenChange = (status: boolean) => {
    setIsDialogOpen(status);
    setValue('');
  };
  useEffect(() => {
    if (yamlUpdateResponse.message) {
      toast.success("Success", {
        description: yamlUpdateResponse.message,
      });
      setIsDialogOpen(false);
      dispatch(resetUpdateYaml());
    } else if (error) {
      toast.error("Failure", {
        description: error.message,
      });
      setIsDialogOpen(false);
      dispatch(resetUpdateYaml());
    }
  }, [yamlUpdateResponse, error]);

  useEffect(() => {
    const resizeEditor = () => {
      if (editorContainerRef.current) {
        const { clientWidth, clientHeight } = editorContainerRef.current;
        setEditorDimensions({ width: clientWidth.toString() || "100%", height: clientHeight.toString() || "80vh" });
      }
    };

    if (isDialogOpen) {
      // Resize editor when dialog is opened
      resizeEditor();
      window.addEventListener("resize", resizeEditor);
    }

    return () => {
      window.removeEventListener("resize", resizeEditor);
    };
  }, [isDialogOpen]);

  return (
    <Dialog open={isDialogOpen} onOpenChange={onDialogOpenChange}>
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button className="ml-1 h-8 w-8 shadow-none" variant="outline" size="icon">
                <FilePlusIcon
                  className="h-[1.2rem] w-[1.2rem]"
                />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Add Resource
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>


      <DialogContent
        onInteractOutside={(event) => event.preventDefault()}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-4xl"
        style={{ height: 'min(80vh, 44rem)' }}
      >
        <DialogHeader className="shrink-0 px-6 pb-4 pt-6">
          <DialogTitle>YAML / Manifest</DialogTitle>
          <DialogDescription>
            Paste a resource manifest below, then hit Apply to create it.
          </DialogDescription>
        </DialogHeader>

        <div ref={editorContainerRef} className="mx-6 min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/20">
          {editorDimensions.width && editorDimensions.height && (
            <Suspense fallback={<Loader />}>
              <Editor
                className="h-full"
                value={value}
                defaultLanguage='yaml'
                onChange={onChange}
                theme={monacoTheme}
                options={{
                  minimap: { enabled: false },
                  automaticLayout: true,
                  fontSize: 13,
                  lineNumbersMinChars: 3,
                  scrollBeyondLastLine: false,
                  padding: { top: 12, bottom: 12 },
                  overviewRulerLanes: 0,
                  renderLineHighlight: 'none',
                  scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
                }}
                width={editorDimensions.width}
                height={editorDimensions.height}
              />
            </Suspense>
          )}
        </div>

        <DialogFooter className="shrink-0 items-center px-6 pb-6 pt-4 sm:justify-between">
          <span className="hidden text-xs text-muted-foreground sm:block">
            Separate multiple resources with <code className="rounded bg-muted px-1 py-0.5 font-mono">---</code>
          </span>
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={yamlUpdate} disabled={!value.trim() || yamlUpdateLoading}>
              {yamlUpdateLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-[14px] h-[14px]" />
              )}
              Apply
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog >
  );
};

export {
  AddResource
};