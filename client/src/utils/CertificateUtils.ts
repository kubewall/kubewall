type CertificateSummary = {
  serialNumber: string;
  signatureAlgorithm: string;
  issuer: string;
  subject: string;
  notBefore: Date;
  notAfter: Date;
  subjectAltNames: string[];
};

const CERTIFICATE_PATTERN = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;

const GENERAL_NAME_LABELS: Record<string, string> = {
  dns: 'DNSName',
  ip: 'IPAddress',
  email: 'Email',
  url: 'URI',
  dn: 'DirName'
};

// @peculiar/x509 brings its whole ASN.1 stack along, so it is fetched only once
// a secret actually turns out to hold certificates.
let pending: Promise<typeof import('@peculiar/x509')> | null = null;

const loadX509 = () => (pending ??= import('@peculiar/x509'));

const formatAlgorithm = ({ name, hash }: { name: string, hash?: { name: string } }) =>
  hash?.name ? `${name} with ${hash.name}` : name;

const parseCertificates = async (pem: string): Promise<CertificateSummary[]> => {
  const blocks = pem.match(CERTIFICATE_PATTERN);
  if (!blocks) {
    return [];
  }

  const { X509Certificate, SubjectAlternativeNameExtension } = await loadX509();

  return blocks.flatMap((block) => {
    try {
      const certificate = new X509Certificate(block);
      const names = certificate.getExtension(SubjectAlternativeNameExtension)?.names.items ?? [];

      return [{
        serialNumber: certificate.serialNumber.replace(/..\B/g, '$&:'),
        signatureAlgorithm: formatAlgorithm(certificate.signatureAlgorithm),
        issuer: certificate.issuer,
        subject: certificate.subject,
        notBefore: certificate.notBefore,
        notAfter: certificate.notAfter,
        subjectAltNames: names.map(({ type, value }) => `${GENERAL_NAME_LABELS[type] ?? type}(${value})`)
      }];
    } catch {
      return [];
    }
  });
};

export type { CertificateSummary };

export {
  parseCertificates
};
