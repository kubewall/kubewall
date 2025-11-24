import './index.css';

import { Fragment, useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { resetAllStates, useAppDispatch, useAppSelector } from '@/redux/hooks';

import { Button } from '@/components/ui/button';
import { Clusters } from '@/types';
import { DeleteConfiguration } from './DeleteConfiguration';
import { Input } from '@/components/ui/input';
import { ReloadIcon } from '@radix-ui/react-icons';
import { StatusCell } from '../Table/TableCells/statusCell';
import { fetchClusters } from '@/data/KwClusters/ClustersSlice';
import { getSystemTheme } from '@/utils';
import kwLogoDark from '../../../assets/kw-dark-theme.svg';
import kwLogoLight from '../../../assets/kw-light-theme.svg';
import { resetDeleteConfig } from '@/data/KwClusters/DeleteConfigSlice';
import { toast } from "sonner";
import { useNavigate } from '@tanstack/react-router';
import { FileBox } from "lucide-react";
import { Search } from "lucide-react";

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
  const onSearch = (searchText: string) => {
    setSearch(searchText);
    if (!searchText) {
      setFilteredClusters(clusters);
    } else {
      const res: Clusters = { kubeConfigs: {}, version: '' };
      Object.keys(clusters.kubeConfigs).map((key) => {
        Object.keys(clusters.kubeConfigs[key].clusters).map((skey) => {
          if (skey.toLowerCase().includes(searchText.toLowerCase())) {
            res.kubeConfigs[key] = {
              ...clusters.kubeConfigs[key],
              clusters: {
                [skey]: clusters.kubeConfigs[key].clusters[skey]
              }
            };
          }
        });
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
                    Object.keys(filteredClusters.kubeConfigs).map((config, index) => {
                      return (
                        <Fragment key={config + index}>
                          <TableRow className="border-t group/item">
                            <TableCell colSpan={3} className="bg-muted/50">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-1">
                                  <FileBox className="h-4 w-4 text-muted-foreground" />
                                  <span>{config}</span>
                                </div>
                                <DeleteConfiguration configId={config} />
                              </div>
                            </TableCell>

                          </TableRow>
                          {
                            Object.keys(filteredClusters.kubeConfigs[config].clusters).map((key) => {
                              const {
                                name,
                                namespace,
                                connected
                              } = filteredClusters.kubeConfigs[config].clusters[key];
                              return (
                                <TableRow
                                  className="group/item hover:cursor-pointer"
                                  onClick={() => navigateTo(config, name)}
                                  key={name}
                                >
                                  <TableCell className="flex items-center space-x-3">
                                    <div className="flex w-12 flex-shrink-0 items-center justify-center bg-primary rounded-md text-sm font-medium text-secondary">{name.substring(0, 2).toUpperCase()}</div>
                                    <span className="font-normal">{name}</span>
                                  </TableCell>
                                  <TableCell className="">
                                    <span>{namespace || 'N/A'}</span>
                                  </TableCell>
                                  <TableCell className="">
                                    {
                                      connected ? <StatusCell cellValue='Active' /> : <StatusCell cellValue='InActive' />
                                    }

                                  </TableCell>
                                </TableRow >

                              );
                            })
                          }
                        </Fragment>
                      );
                    }) :
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