import './index.css';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { resetUpdateYaml, updateYaml } from '@/data/Yaml/YamlUpdateSlice';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Editor } from "@monaco-editor/react";
import { FilePlusIcon } from "@radix-ui/react-icons";
import { Loader } from '../../Loader';
import { SaveIcon } from "lucide-react";
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
              <Button className="ml-1 h-8 w-8" variant="outline" size="icon">
                <FilePlusIcon
                  className={
                    `h-[1.2rem]
                    w-[1.2rem]
                    rotate-0
                    scale-100
                    transition-all
                    dark:-rotate-${getSystemTheme() === 'light' ? '90' : '0'}
                    dark:scale-${getSystemTheme() === 'light' ? '0' : '100'}`
                  }
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
            Add the yaml/manifest file of the new resource you want to create and click Apply.
          </DialogDescription>
        </DialogHeader>
        <div ref={editorContainerRef} className="flex-grow border-b rounded-b-sm" style={{ overflow: "hidden" }}>
          {editorDimensions.width && editorDimensions.height && (
            <>
              {
                yamlUpdated &&
                <Button
                  variant="default"
                  size="icon"
                  className='absolute bottom-12 right-12 rounded z-10 border w-16'
                  onClick={yamlUpdate}
                > {
                    yamlUpdateLoading ?
                      <Loader className='w-5 h-5 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600' /> :
                      <SaveIcon className="h-4 w-4 mr-1" />
                  }
                  <span className='text-xs'>Apply</span>
                </Button>
              }
              <Editor
                className='border rounded-lg'
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
    </Dialog>
  );
};

export {
  AddResource
};