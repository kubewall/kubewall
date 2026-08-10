import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DockerCredential, HelmRelease, JwtSummary, parseDockerConfig, parseHelmRelease, parseJwt } from "@/utils/SecretUtils";
import { EyeIcon, EyeOff } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CertificateSummary } from "@/utils/CertificateUtils";
import { CopyToClipboard } from "../Common/CopyToClipboard";
import { getDisplayTime } from "@/utils";
import { parseCertificates } from "@/utils/CertificateUtils";
import { useAppSelector } from "@/redux/hooks";
import { useNow } from "@/hooks/use-now";

type SecretData = {
  [k: string]: string | null;
} | null | undefined;

const MASKED = '••••••••';
const HELM_RELEASE_TYPE = 'helm.sh/release.v1';

const decodeSecretValue = (value: string | null) => {
  try {
    return atob(value ?? '');
  } catch {
    return '';
  }
};

const DetailRow = ({ label, children }: { label: string, children: React.ReactNode }) => (
  <div className="flex flex-row gap-2">
    <span className="shrink-0 text-muted-foreground">{label}:</span>
    <span className="break-all">{children}</span>
  </div>
);

const SecretCard = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div className="mt-2">
    <Card className="shadow-none rounded-lg">
      <CardHeader className="p-4">
        <CardTitle className="text-sm font-medium shadow-none">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <div className="grid items-start gap-2">{children}</div>
      </CardContent>
    </Card>
  </div>
);

const SecretBlock = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <Card className="shadow-none rounded-lg border-dashed overflow-x-auto">
    <CardContent className="p-3 font-mono text-[13px] leading-5">
      <div className="mb-1 font-sans text-sm font-medium">{title}</div>
      {children}
    </CardContent>
  </Card>
);

const RelativeTime = ({ date, now }: { date: Date, now: number }) => {
  const past = now >= date.getTime();

  return (
    <>
      {date.toUTCString()}
      <span className="ml-2 text-muted-foreground">
        {past ? `${getDisplayTime(now - date.getTime())} ago` : `in ${getDisplayTime(date.getTime() - now)}`}
      </span>
    </>
  );
};

const SecretCertificates = memo(function ({ data }: { data: SecretData }) {
  const now = useNow();
  const [certificates, setCertificates] = useState<{ key: string, certificate: CertificateSummary }[]>([]);

  useEffect(() => {
    let mounted = true;
    Promise.all(Object.entries(data ?? {}).map(async ([key, value]) => {
      const parsed = await parseCertificates(decodeSecretValue(value));
      return parsed.map((certificate) => ({ key, certificate }));
    })).then((parsed) => mounted && setCertificates(parsed.flat()));

    return () => {
      mounted = false;
    };
  }, [data]);

  if (!certificates.length) {
    return null;
  }

  return (
    <SecretCard title="Certificates">
      {
        certificates.map(({ key, certificate }, index) => {
          const expired = now > certificate.notAfter.getTime();
          const notYetValid = now < certificate.notBefore.getTime();

          return (
            <SecretBlock key={`${key}-${index}`} title={key}>
              <DetailRow label="Serial Number">{certificate.serialNumber}</DetailRow>
              <DetailRow label="Signature Algorithm">{certificate.signatureAlgorithm}</DetailRow>
              <DetailRow label="Issuer">{certificate.issuer}</DetailRow>
              <DetailRow label="Subject">{certificate.subject}</DetailRow>
              <DetailRow label="Validity">
                <span className={expired || notYetValid ? 'text-destructive' : 'text-green-600 dark:text-green-400'}>
                  {expired ? 'Expired' : notYetValid ? 'Not yet valid' : 'Valid'}
                </span>
              </DetailRow>
              <DetailRow label="Not Before"><RelativeTime date={certificate.notBefore} now={now} /></DetailRow>
              <DetailRow label="Not After"><RelativeTime date={certificate.notAfter} now={now} /></DetailRow>
              {
                !!certificate.subjectAltNames.length &&
                <DetailRow label="Subject Alternative Name">
                  <span className="flex flex-col">
                    {certificate.subjectAltNames.map((name) => <span key={name}>{name}</span>)}
                  </span>
                </DetailRow>
              }
            </SecretBlock>
          );
        })
      }
    </SecretCard>
  );
});

const SecretRegistryCredentials = memo(function ({ data, revealed }: { data: SecretData, revealed: boolean }) {
  const credentials = useMemo<DockerCredential[]>(() => Object.entries(data ?? {})
    .filter(([key]) => key === '.dockerconfigjson' || key === '.dockercfg')
    .flatMap(([, value]) => parseDockerConfig(decodeSecretValue(value))), [data]);

  if (!credentials.length) {
    return null;
  }

  return (
    <SecretCard title="Registry Credentials">
      {
        credentials.map(({ registry, username, password, email }) => (
          <SecretBlock key={registry} title={registry}>
            <DetailRow label="Username">{username || '—'}</DetailRow>
            <DetailRow label="Password">{revealed ? password || '—' : MASKED}</DetailRow>
            {!!email && <DetailRow label="Email">{email}</DetailRow>}
          </SecretBlock>
        ))
      }
    </SecretCard>
  );
});

const SecretTokens = memo(function ({ data }: { data: SecretData }) {
  const now = useNow();
  const tokens = useMemo<{ key: string, token: JwtSummary }[]>(() => Object.entries(data ?? {}).flatMap(([key, value]) => {
    const token = parseJwt(decodeSecretValue(value));
    return token ? [{ key, token }] : [];
  }), [data]);

  if (!tokens.length) {
    return null;
  }

  return (
    <SecretCard title="Tokens">
      {
        tokens.map(({ key, token }) => (
          <SecretBlock key={key} title={key}>
            <DetailRow label="Algorithm">{token.algorithm}</DetailRow>
            {!!token.issuer && <DetailRow label="Issuer">{token.issuer}</DetailRow>}
            {!!token.subject && <DetailRow label="Subject">{token.subject}</DetailRow>}
            {!!token.audience && <DetailRow label="Audience">{token.audience}</DetailRow>}
            {!!token.namespace && <DetailRow label="Namespace">{token.namespace}</DetailRow>}
            {!!token.serviceAccount && <DetailRow label="Service Account">{token.serviceAccount}</DetailRow>}
            {!!token.pod && <DetailRow label="Pod">{token.pod}</DetailRow>}
            {token.issuedAt && <DetailRow label="Issued"><RelativeTime date={token.issuedAt} now={now} /></DetailRow>}
            <DetailRow label="Expires">
              {
                token.expiresAt
                  ? <span className={now > token.expiresAt.getTime() ? 'text-destructive' : ''}>
                    <RelativeTime date={token.expiresAt} now={now} />
                  </span>
                  : 'never'
              }
            </DetailRow>
          </SecretBlock>
        ))
      }
    </SecretCard>
  );
});

const SecretHelmRelease = memo(function ({ data, type }: { data: SecretData, type?: string | null }) {
  const now = useNow();
  const [release, setRelease] = useState<HelmRelease | null>(null);

  useEffect(() => {
    if (type !== HELM_RELEASE_TYPE) {
      setRelease(null);
      return;
    }
    let mounted = true;
    parseHelmRelease(data?.release ?? '').then((parsed) => mounted && setRelease(parsed));

    return () => {
      mounted = false;
    };
  }, [data, type]);

  if (!release) {
    return null;
  }

  return (
    <SecretCard title="Helm Release">
      <SecretBlock title={release.name || 'release'}>
        {!!release.chart && <DetailRow label="Chart">{release.chart}</DetailRow>}
        {!!release.appVersion && <DetailRow label="App Version">{release.appVersion}</DetailRow>}
        {!!release.revision && <DetailRow label="Revision">{release.revision}</DetailRow>}
        {!!release.status && <DetailRow label="Status">{release.status}</DetailRow>}
        {!!release.namespace && <DetailRow label="Namespace">{release.namespace}</DetailRow>}
        {release.updated && <DetailRow label="Updated"><RelativeTime date={release.updated} now={now} /></DetailRow>}
        {!!release.description && <DetailRow label="Description">{release.description}</DetailRow>}
      </SecretBlock>
    </SecretCard>
  );
});

const SecretDetailsContainer = memo(function () {
  const {
    secretsDetails,
  } = useAppSelector((state) => state.secretsDetails);
  const [toggleSecretDecode, setToggleSecretDecode] = useState(false);
  const newData = secretsDetails.data;

  const getDecodeOrDefault = (secret: string) => {
    return secretsDetails.type === HELM_RELEASE_TYPE ? secret : atob(secret);
  };

  return (
    <>
      <div className={`mt-2`}>
        <Card className="shadow-none rounded-lg">
          <CardHeader className="p-4 ">
            <CardTitle className="text-sm font-medium flex items-center shadow-none">
              Data
              <Button
                className="ml-1 h-3.5 w-3.5 shadow-none border-none"
                variant="outline"
                size="icon"
                onClick={() => setToggleSecretDecode(!toggleSecretDecode)}
              >
                {toggleSecretDecode ? <EyeIcon className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <div className="items-start gap-6 rounded-lg grid">
              <Card className="shadow-none rounded-lg border-dashed overflow-x-auto">
                <CardContent className="boder p-0 ">
                  {
                    newData && Object.keys(newData).map((key: string) => {
                      return (
                        <div className={`py-1.5 border-b last:border-b-0 border-solid flex flex-row ${toggleSecretDecode ? '' : 'items-center'}`}>
                          <div className="pl-4 text-sm  basis-1/4">{key}</div>
                          <div className="flex flex-row text-sm font-normal basis-3/4 group/item">
                            <div className="break-all basis-[97%] ">
                              <Badge variant="secondary" className="text-sm font-normal">
                                <span className={toggleSecretDecode ? 'whitespace-pre-line' : 'line-clamp-1'}>
                                  {toggleSecretDecode ? getDecodeOrDefault(newData[key] || '') : newData[key]}
                                </span>
                              </Badge>
                            </div>
                            <div className="basis-[3%] group/edit invisible group-hover/item:visible flex items-center">
                              <CopyToClipboard
                                val={toggleSecretDecode ? getDecodeOrDefault(newData[key] || '') : newData[key] || ''}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  }
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
      <SecretCertificates data={newData} />
      <SecretRegistryCredentials data={newData} revealed={toggleSecretDecode} />
      <SecretTokens data={newData} />
      <SecretHelmRelease data={newData} type={secretsDetails.type} />
    </>
  );
});

export {
  SecretDetailsContainer
};
