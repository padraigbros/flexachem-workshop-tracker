import java.io.*;
import java.security.KeyStore;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.util.Collection;

// Reads a PEM bundle (many certs) and writes a PKCS12 truststore with each as a
// trusted-cert entry. Usage: java BuildTruststore roots.pem out.p12
// See tools/regen-truststore.ps1 for the full regeneration flow.
public class BuildTruststore {
  public static void main(String[] a) throws Exception {
    CertificateFactory cf = CertificateFactory.getInstance("X.509");
    Collection<? extends Certificate> certs;
    try (InputStream in = new FileInputStream(a[0])) {
      certs = cf.generateCertificates(in);
    }
    KeyStore ks = KeyStore.getInstance("PKCS12");
    ks.load(null, null);
    int i = 0;
    for (Certificate c : certs) {
      try { ks.setCertificateEntry("root-" + i, c); i++; } catch (Exception e) { /* skip dup */ }
    }
    try (OutputStream out = new FileOutputStream(a[1])) {
      ks.store(out, "changeit".toCharArray());
    }
    System.out.println("Wrote " + i + " trusted certs to " + a[1]);
  }
}
