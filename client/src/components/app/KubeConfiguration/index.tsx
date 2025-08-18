import './index.css';

import { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { resetAllStates, useAppDispatch, useAppSelector } from '@/redux/hooks';
import { cn, deepClone } from '@/lib/utils';

import { AddConfig } from './AddConfiguration';
import { Button } from '@/components/ui/button';
import { Clusters } from '@/types';
import { DeleteConfiguration } from './DeleteConfiguration';
import { Input } from '@/components/ui/input';
import { ReloadIcon } from '@radix-ui/react-icons';
import { ClusterStatusCell } from './ClusterStatusCell';
import { ThemeModeSelector } from '../Common/ThemeModeSelector';
import { fetchClusters } from '@/data/KwClusters/ClustersSlice';
import { validateAllConfigs, resetValidateAllConfigs } from '@/data/KwClusters/ValidateAllConfigsSlice';
import { getSystemTheme } from '@/utils';
import kwLogoDark from '../../../assets/facets-dark-theme.svg';
import kwLogoLight from '../../../assets/facets-light-theme.svg';
import { resetDeleteConfig } from '@/data/KwClusters/DeleteConfigSlice';
import { toast } from "sonner";
import { useNavigate } from '@tanstack/react-router';
import { useRouterState } from '@tanstack/react-router';
import { useRef } from 'react';

export function KubeConfiguration() {
  const {
    clusters,
    loading: clustersLoading,
  } = useAppSelector((state) => state.clusters);
  const {
    deleteConfigResponse,
    error
  } = useAppSelector((state) => state.deleteConfig);
  const {
    validationResponse,
    error: validationError,
    loading: validationLoading
  } = useAppSelector((state) => state.validateAllConfigs);

  const [search, setSearch] = useState('');
  const [filteredClusters, setFilteredClusters] = useState(clusters);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const router = useRouterState();
  const hasShownConfigNotFoundToast = useRef(false);

  // Check if current route's config exists and redirect if it doesn't
  useEffect(() => {
    const currentPath = router.location.pathname;
    const pathSegments = currentPath.split('/');
    
    // Check if we're on a config-specific route (not /config or /)
    if (pathSegments.length > 1 && pathSegments[1] !== 'config' && pathSegments[1] !== '') {
      const configId = pathSegments[1];
      
      // Only check if clusters are loaded and not empty, and not currently loading
      if (!clustersLoading && clusters?.kubeConfigs && Object.keys(clusters.kubeConfigs).length > 0) {
        if (!clusters.kubeConfigs[configId]) {
          // Config doesn't exist, redirect to config page
          if (!hasShownConfigNotFoundToast.current) {
            toast.info("Configuration not found", {
              description: "The configuration you were viewing has been deleted. Redirecting to configuration page.",
            });
            hasShownConfigNotFoundToast.current = true;
          }
          navigate({ to: '/config' });
        }
      }
    } else {
      // Reset the flag when we're not on a config-specific route
      hasShownConfigNotFoundToast.current = false;
    }
  }, [clusters, navigate, router.location.pathname]);

  // Merge validation results with cluster data
  const getMergedClusters = () => {
    try {
      if (!validationResponse || !clusters || !clusters.kubeConfigs) {
        return clusters || { kubeConfigs: {}, version: '' };
      }

      // Use deep clone to avoid mutating the original state
      const mergedClusters = deepClone(clusters);
      
      if (mergedClusters?.kubeConfigs) {
        Object.keys(mergedClusters.kubeConfigs).forEach(configId => {
          const configValidation = validationResponse.validationResults?.[configId];
          if (configValidation && mergedClusters.kubeConfigs[configId]?.clusters) {
            Object.keys(mergedClusters.kubeConfigs[configId].clusters).forEach(contextName => {
              const clusterValidation = configValidation.clusterStatus?.[contextName];
              if (clusterValidation) {
                mergedClusters.kubeConfigs[configId].clusters[contextName] = {
                  ...mergedClusters.kubeConfigs[configId].clusters[contextName],
                  reachable: clusterValidation.reachable,
                  error: clusterValidation.error
                };
              }
            });
          }
        });
      }

      return mergedClusters;
    } catch (error) {
      console.error('Error in getMergedClusters:', error);
      // Return original clusters if there's an error
      return clusters || { kubeConfigs: {}, version: '' };
    }
  };

  const mergedClusters = getMergedClusters();

  useEffect(() => {
    dispatch(fetchClusters());
    dispatch(resetAllStates());
  }, [dispatch]);

  useEffect(() => {
    try {
      setFilteredClusters(mergedClusters);
    } catch (error) {
      console.error('Error setting filtered clusters:', error);
      setFilteredClusters(clusters || { kubeConfigs: {}, version: '' });
    }
  }, [mergedClusters, clusters]);

  // Validate all configs when clusters are loaded
  useEffect(() => {
    if (clusters?.kubeConfigs && Object.keys(clusters.kubeConfigs).length > 0) {
      dispatch(validateAllConfigs());
    }
  }, [clusters, dispatch]);

  // Handle validation errors
  useEffect(() => {
    if (validationError) {
      toast.error("Validation Failed", {
        description: validationError.error,
      });
      dispatch(resetValidateAllConfigs());
    }
  }, [validationError, dispatch]);
  const onSearch = (searchText: string) => {
    try {
      setSearch(searchText);
      if (!searchText) {
        setFilteredClusters(mergedClusters);
      } else {
        const res: Clusters = { kubeConfigs: {}, version: '' };
        if (mergedClusters?.kubeConfigs) {
          Object.keys(mergedClusters.kubeConfigs).map((key) => {
            if (mergedClusters.kubeConfigs[key]?.clusters) {
              Object.keys(mergedClusters.kubeConfigs[key].clusters).map((skey) => {
                if (skey.toLowerCase().includes(searchText.toLowerCase())) {
                  res.kubeConfigs[key] = {
                    ...mergedClusters.kubeConfigs[key],
                    clusters: {
                      [skey]: mergedClusters.kubeConfigs[key].clusters[skey]
                    }
                  };
                }
              });
            }
          });
        }
        setFilteredClusters(res);
      }
    } catch (error) {
      console.error('Error in onSearch:', error);
      setFilteredClusters(clusters || { kubeConfigs: {}, version: '' });
    }
  };

  const handleRefreshValidation = () => {
    dispatch(fetchClusters());
    dispatch(validateAllConfigs());
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

  const navigateTo = (config: string, name: string, reachable?: boolean) => {
    if (reachable === false) {
      toast.error("Cannot navigate to unreachable cluster");
      return;
    }
    navigate({ to: `/${config}/overview?cluster=${encodeURIComponent(name)}` });
  };

  return (
    <>
      {/* Floating Theme Switcher */}
      <div className="fixed bottom-6 right-6 z-50">
        <ThemeModeSelector />
      </div>
      
      <div className='h-screen px-[1%] py-[1%]'>
        <div className="flex flex-col space-y-8 md:flex p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-end">
              <img className="w-12" src={getSystemTheme() === 'light' ? kwLogoLight : kwLogoDark} alt="Facets KubeDash" />
            </div>
            <div className="flex space-x-2">
              <AddConfig />
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleRefreshValidation}
                      disabled={validationLoading}
                    >
                      <ReloadIcon className={cn("h-4 w-4", validationLoading && "animate-spin")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="mr-2.5">
                    {validationLoading ? "Refreshing..." : "Refresh & Validate"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <Input
            placeholder="Filter configs..."
            value={search}
            onChange={(event) =>
              onSearch(event.target.value)
            }
            type='search'
            className="h-8 shadow-none"
          />
          <div className="overflow-auto config-list mt-2 rounded-md border">
            <Table className="overflow-auto">
              <TableHeader className="bg-muted/80">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Namespace</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {
                  filteredClusters?.kubeConfigs && Object.keys(filteredClusters.kubeConfigs).length ?
                    Object.keys(filteredClusters.kubeConfigs).map((config) => {
                      return Object.keys(filteredClusters.kubeConfigs[config].clusters).map((key) => {
                        const {
                          name,
                          namespace,
                          connected,
                          reachable
                        } = filteredClusters.kubeConfigs[config].clusters[key];
                        
                        const isReachable = reachable !== undefined ? reachable : connected;
                        
                        return (
                          <TableRow
                            className={cn(
                              "group/item",
                              isReachable ? "hover:cursor-pointer" : "hover:cursor-not-allowed opacity-60"
                            )}
                            onClick={() => navigateTo(config, name, reachable)}
                            key={`${config}-${name}`}
                          >
                            <TableCell className="flex items-center space-x-3">
                              <div className="flex w-12 flex-shrink-0 items-center justify-center bg-primary rounded-md text-sm font-medium text-secondary">{name.substring(0, 2).toUpperCase()}</div>
                              <span className="font-normal">{name}</span>
                            </TableCell>
                            <TableCell className="">
                              <span>{namespace || 'N/A'}</span>
                            </TableCell>
                            <TableCell className="flex items-center justify-between">
                              <span>
                                <ClusterStatusCell 
                                  connected={connected} 
                                  reachable={reachable}
                                />
                              </span>
                              <DeleteConfiguration configId={config} clusterName={name} />
                            </TableCell>
                          </TableRow>
                        );
                      });
                    }).flat() :
                    <TableRow className="cluster-empty-table">
                      <TableCell
                        colSpan={3}
                        className="text-center"
                      >
                        No results.
                      </TableCell>
                    </TableRow>
                }
                {/* </tbody> */}
              </TableBody>
              {/* </table> */}
            </Table>
          </div>
        </div>
      </div >
    </>
  );
}