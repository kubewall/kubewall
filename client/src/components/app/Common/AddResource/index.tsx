import './index.css';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { resetUpdateYaml, updateYaml } from '@/data/Yaml/YamlUpdateSlice';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import Editor from '../../Details/YamlEditor/MonacoWrapper';
import { FilePlusIcon } from "@radix-ui/react-icons";
import { Loader } from '../../Loader';
import { getSystemTheme } from "@/utils";
import { kwList } from '@/routes';
import { toast } from 'sonner';

const AddResource = () => {
  const dispatch = useAppDispatch();
  const [value, setValue] = useState('');
  const { config } = kwList.useParams();
  const { cluster } = kwList.useSearch();

  const queryParams = new URLSearchParams({
    config,
    cluster
  }).toString();

  const [yamlUpdated, setYamlUpdated] = useState<boolean>(false);
  const {
    error,
    yamlUpdateResponse,
    loading: yamlUpdateLoading
  } = useAppSelector((state) => state.updateYaml);


  const onChange = useCallback((val = '') => {
    setYamlUpdated(true);
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
    setYamlUpdated(false);
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


      <DialogContent onInteractOutside={(event) => event.preventDefault()} className="w-full max-w-screen-lg flex flex-col" style={{ height: '80vh' }}>
        <DialogHeader>
          <DialogTitle>YAML/Manifest</DialogTitle>
          <DialogDescription>
            Add your resource’s YAML or manifest, then hit Apply to create it.
          </DialogDescription>
        </DialogHeader>
        <div ref={editorContainerRef} className="flex-grow border-b rounded-b-sm" style={{ overflow: "hidden" }}>
          {editorDimensions.width && editorDimensions.height && (
            <>
              {
                yamlUpdated &&
                <Button
                  variant="default"
                  className="absolute bottom-10 right-12 z-10 shadow-none"
                  onClick={yamlUpdate}
                  disabled={yamlUpdateLoading}
                >
                  {yamlUpdateLoading ? (
                    <Loader className="w-4 h-4 text-white animate-spin fill-white" />
                  ) : (
                    <Check className="w-[14px] h-[14px]" />
                  )}
                  Apply
                </Button>
              }
              <Editor
                className='border rounded-md h-screen'
                value={value}
                defaultLanguage='yaml'
                onChange={onChange}
                theme={getSystemTheme()}
                options={{
                  minimap: { enabled: false },
                  automaticLayout: true,
                }}
                width={editorDimensions.width}
                height={editorDimensions.height}
              />
            </>
          )}

        </div>
      </DialogContent>
    </Dialog >
  );
};

export {
  AddResource
};