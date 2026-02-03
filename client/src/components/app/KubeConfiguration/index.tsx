import './index.css';

import { Clusters, ClustersDetails } from '@/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { resetAllStates, useAppDispatch, useAppSelector } from '@/redux/hooks';
import { useEffect, useMemo, useState } from 'react';

import { AddConfig } from './AddConfiguration';
import { Button } from '@/components/ui/button';
import { ConfigSection } from './ConfigSection';
import { Input } from '@/components/ui/input';
import { ReloadIcon } from '@radix-ui/react-icons';
import { Search } from "lucide-react";
import { fetchClusters } from '@/data/KwClusters/ClustersSlice';
import { getSystemTheme } from '@/utils';
import kwLogoDark from '../../../assets/kw-dark-theme.svg';
import kwLogoLight from '../../../assets/kw-light-theme.svg';
import { resetDeleteConfig } from '@/data/KwClusters/DeleteConfigSlice';
import { toast } from "sonner";
import { useNavigate } from '@tanstack/react-router';

export function KubeConfiguration() {
  const {
    clusters,
  } = useAppSelector((state) => state.clusters);
  const {
    deleteConfigResponse,
    error
  } = useAppSelector((state) => state.deleteConfig);

  const [search, setSearch] = useState('');
  const [filteredClusters, setFilteredClusters] = useState(clusters);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    dispatch(fetchClusters());
    dispatch(resetAllStates());
  }, [dispatch]);

  useEffect(() => {
    setFilteredClusters(clusters);
  }, [clusters]);

  const isSystemConfig = (absolutePath: string): boolean => {
    return absolutePath.includes('/.kube/') && !absolutePath.includes('/.kubewall/');
  };

  const { addedConfigs, systemConfigs } = useMemo(() => {
    const added: { [key: string]: ClustersDetails } = {};
    const system: { [key: string]: ClustersDetails } = {};


    Object.entries(filteredClusters.kubeConfigs || {}).forEach(([key, config]) => {
      if (isSystemConfig(config.absolutePath)) {
        system[key] = config;
      } else {
        added[key] = config;
      }
    });

    return { addedConfigs: added, systemConfigs: system };
  }, [filteredClusters]);

  const onSearch = (searchText: string) => {
    setSearch(searchText);
    if (!searchText) {
      setFilteredClusters(clusters);
    } else {
      const res: Clusters = { kubeConfigs: {}, version: '' };
      const searchLower = searchText.toLowerCase();

      Object.keys(clusters.kubeConfigs).forEach((key) => {
        const configNameMatches = key.toLowerCase().includes(searchLower);

        if (configNameMatches) {
          // If kubeconfig name matches, include entire config with all clusters
          res.kubeConfigs[key] = clusters.kubeConfigs[key];
        } else {
          // Otherwise, check individual context names
          const matchingClusters: typeof clusters.kubeConfigs[typeof key]['clusters'] = {};

          Object.keys(clusters.kubeConfigs[key].clusters).forEach((skey) => {
            if (skey.toLowerCase().includes(searchLower)) {
              matchingClusters[skey] = clusters.kubeConfigs[key].clusters[skey];
            }
          });

          if (Object.keys(matchingClusters).length > 0) {
            res.kubeConfigs[key] = {
              ...clusters.kubeConfigs[key],
              clusters: matchingClusters
            };
          }
        }
      });

      setFilteredClusters(res);
    }
  };

  useEffect(() => {
    if (error) {
      toast.error("Failure", {
        description: error.message,
      });
      dispatch(fetchClusters());
      dispatch(resetDeleteConfig());
    } else if (deleteConfigResponse.message) {
      toast.success("Success", {
        description: deleteConfigResponse.message,
      });
      dispatch(resetDeleteConfig());
      dispatch(fetchClusters());
    }
  }, [deleteConfigResponse, error, dispatch]);

  const navigateTo = (config: string, name: string) => {
    navigate({ to: `/${config}/list?cluster=${encodeURIComponent(name)}&resourcekind=pods` });
  };

  const hasConfigs = filteredClusters?.kubeConfigs && Object.keys(filteredClusters.kubeConfigs).length > 0;

  return (
    <>
      <div className='h-screen px-[1%] py-[1%]'>
        <div className="flex flex-col space-y-8 md:flex p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-end">
              <img className="w-40" src={getSystemTheme() === 'light' ? kwLogoLight : kwLogoDark} alt="kubewall" />
              <span className="ml-2 text-xs">({clusters.version})</span>
            </div>
            <div className="flex space-x-2">
              <AddConfig />
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => window.location.href = '/api/v1/app/config/reload'}
                    >
                      <ReloadIcon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="mr-2.5">
                    Refresh Clusters
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="relative w-full md:max-w-full">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Filter configs..."
              className="h-8 pl-8 pr-2 shadow-none"
            />
          </div>

          <div className="overflow-auto config-list space-y-6">
            {hasConfigs ? (
              <>
                <ConfigSection
                  title="Added Configs"
                  configs={addedConfigs}
                  isSystem={false}
                  onNavigate={navigateTo}
                />
                <ConfigSection
                  title="System Configs"
                  subtitle="~/.kube/"
                  configs={systemConfigs}
                  isSystem={true}
                  onNavigate={navigateTo}
                />
              </>
            ) : (
              <div className="rounded-md border">
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  No results.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
