import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useSearch } from '@tanstack/react-router';
import { RootState } from '@/redux/store';
import { fetchHelmReleaseDetails, fetchHelmReleaseHistory } from '@/data/Helm';
import { kwDetailsSearch } from '@/types';
import { appRoute } from '@/routes';
import { useAppDispatch } from '@/redux/hooks';

const HelmReleaseDetailsContainer: React.FC = () => {
  const dispatch = useAppDispatch();
  const search = useSearch({ from: '/$config/details' }) as kwDetailsSearch;
  const { config } = appRoute.useParams();
  const { details, error } = useSelector((state: RootState) => state.helmReleaseDetails);

  useEffect(() => {
    if (config && search.cluster && search.resourcename) {
      dispatch(fetchHelmReleaseDetails({
        config: config,
        cluster: search.cluster,
        name: search.resourcename,
        namespace: search.namespace
      }));
      dispatch(fetchHelmReleaseHistory({
        config: config,
        cluster: search.cluster,
        name: search.resourcename,
        namespace: search.namespace
      }));
    }
  }, [dispatch, config, search.cluster, search.resourcename, search.namespace]);

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (!details) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {/* Helm release details will be rendered by the parent KwDetails component */}
    </div>
  );
};

export default HelmReleaseDetailsContainer; 