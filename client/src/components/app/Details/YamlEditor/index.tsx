import { createEventStreamQueryObject, getEventStreamUrl, getSystemTheme } from '@/utils';
import { memo, useCallback, useEffect, useState } from 'react';
import { resetUpdateYaml, updateYaml } from '@/data/Yaml/YamlUpdateSlice';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';

import { Button } from '@/components/ui/button';
import Editor from '@monaco-editor/react';
import { Loader } from '../../Loader';
import { SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { updateYamlDetails } from '@/data/Yaml/YamlSlice';
import { useEventSource } from '../../Common/Hooks/EventSource';

type EditorProps = {
  name: string;
  instanceType: string;
  namespace: string;
  configName: string;
  clusterName: string;
  extraQuery?: string;
}

const YamlEditor = memo(function ({ instanceType, name, namespace, clusterName, configName, extraQuery }: EditorProps) {
  const {
    error,
    yamlUpdateResponse,
    loading: yamlUpdateLoading
  } = useAppSelector((state) => state.updateYaml);

  const dispatch = useAppDispatch();
  const [yamlUpdated, setYamlUpdated] = useState<boolean>(false);
  const {
    loading,
    yamlData,
  } = useAppSelector((state) => state.yaml);

  const queryParams = new URLSearchParams({
    config: configName,
    cluster: clusterName
  }).toString();
  
  const [value, setValue] = useState('');
  const onChange = useCallback((val = '') => {
    setYamlUpdated(true);
    setValue(val);
  }, []);

  useEffect(() => {
    setValue(yamlData);
  }, [yamlData, loading]);

  const yamlUpdate = () => {
    dispatch(updateYaml({
      data: value,
      queryParams
    }));
  };

  useEffect(() => {
    if (yamlUpdateResponse.message) {
      toast.success("Success", {
        description: yamlUpdateResponse.message,
      });
      dispatch(resetUpdateYaml());
      setYamlUpdated(false);
    } else if (error) {
      toast.error("Failure", {
        description: error.message,
      });
      dispatch(resetUpdateYaml());
      setYamlUpdated(false);
    }
  }, [yamlUpdateResponse, error]);



  const sendMessage = (message: Event[]) => {
    dispatch(updateYamlDetails(message));
  };

  useEventSource({
    url: getEventStreamUrl(
      instanceType,
      createEventStreamQueryObject(
        configName,
        clusterName,
        namespace
      ),
      `/${name}/yaml`,
      extraQuery
    ),
    sendMessage
  });


  return (
    <>
      {
        loading ?
          <div className="flex items-center justify-center h-screen">
            <div role="status">
              <svg aria-hidden="true" className="w-8 h-8 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" /><path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill" /></svg>
              <span className="sr-only">Loading...</span>
            </div>
          </div>
          : <div className='relative'>
            {
              yamlUpdated &&
              <Button
                variant="default"
                size="icon"
                className='absolute bottom-32 right-0 mt-1 mr-5 rounded z-10 border w-16'
                onClick={yamlUpdate}
              > {
                  yamlUpdateLoading ?
                    <Loader className='w-5 h-5 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600' /> :
                    <SaveIcon className="h-4 w-4 mr-1" />
                }
                <span className='text-xs'>Save</span>
              </Button>
            }

            <Editor
              className='border rounded-lg h-screen'
              value={value}
              defaultLanguage='yaml'
              onChange={onChange}
              theme={getSystemTheme()}
              options={{
                minimap: {
                  enabled: false,
                },
              }}
            />
          </div>

      }
    </>
  );
});

export {
  YamlEditor
};