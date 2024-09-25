import './index.css';

import { Fragment, useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { resetAllStates, useAppDispatch, useAppSelector } from '@/redux/hooks';

import { AddConfig } from './AddConfiguration';
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
    navigate({ to: `/${config}/${name}/list?resourcekind=pods` });
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
          <Input
            placeholder="Filter configs..."
            value={search}
            onChange={(event) =>
              onSearch(event.target.value)
            }
            type='search'
            className="h-8 shadow-none"
          />
          <div className="overflow-auto config-list mt-2">
            <Table className="border overflow-auto">
              {/* <table className="min-w-full border-collapse rounded-lg shadow-md border text-sm"> */}
              <TableHeader className="bg-muted/80">
                {/* <thead> */}
                <TableRow>
                  {/* <tr className="border-b"> */}
                  <TableHead>Name</TableHead>
                  <TableHead>Namespace</TableHead>
                  <TableHead>Status</TableHead>
                  {/* <th className="px-4 py-2 text-left text-gray-600 font-normal">Name</th>
                  <th className="px-4 py-2 text-left text-gray-600 font-normal">Namespace</th>
                  <th className="px-4 py-2 text-left text-gray-600 font-normal">Status</th> */}
                  {/* </tr> */}
                </TableRow>
                {/* </thead> */}
              </TableHeader>
              <TableBody>
                {/* <tbody> */}
                {
                  filteredClusters?.kubeConfigs && Object.keys(filteredClusters.kubeConfigs).length ?
                    Object.keys(filteredClusters.kubeConfigs).map((config, index) => {
                      return (
                        <Fragment key={config + index}>
                          <TableRow className="border-t group/item">
                            <TableCell colSpan={3} className="bg-muted/50">
                              <div className="flex items-center justify-between">
                                <span> {config} </span>
                                {/* <svg xmlns="http://www.w3.org/2000/svg"
                                  onClick={() => confirm('pakka')}
                                  cursor='pointer'
                                  width="30"
                                  height="30"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="hsl(var(--destructive))"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="lucide lucide-trash-2 p-2 group/edit invisible group-hover/item:visible">
                                  <path d="M3 6h18" />
                                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                  <line x1="10" x2="10" y1="11" y2="17" />
                                  <line x1="14" x2="14" y1="11" y2="17" />
                                </svg> */}
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
                                    {/* <input type="checkbox" className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" /> */}
                                    <div className="flex w-12 flex-shrink-0 items-center justify-center bg-primary rounded-md text-sm font-medium text-secondary">{name.substring(0, 2).toUpperCase()}</div>
                                    {/* <img src="https://via.placeholder.com/32" alt="Avatar" className="w-8 h-8 rounded-full" /> */}
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