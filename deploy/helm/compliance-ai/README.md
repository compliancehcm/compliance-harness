# compliance-ai Helm chart

The Compliance AI harness on Kubernetes: the image from
[`deploy/docker`](../../docker/README.md), one pod, its users volume, a
Service and an optional Ingress. Everything the image reads from its
environment is a value here; `values.yaml` documents each one.

## Get it

CI publishes the chart to GitHub Container Registry as an OCI artifact, pinned
to the image digest the same run built and booted:

| Source | Chart version | Image |
|---|---|---|
| tag `v1.2.3` | `1.2.3` | `v1.2.3`, by digest |
| push to `master` | `<Chart.yaml version>-master.<run>` (prerelease) | `sha-<commit>`, by digest |

```sh
helm show values oci://ghcr.io/compliancehcm/charts/compliance-ai --version 1.2.3
```

A `master` chart is a prerelease, so name its version explicitly (the run
summary of the Docker image workflow prints the exact command). If the ghcr
packages are private, `helm registry login ghcr.io` first, and give the cluster
an `imagePullSecrets` entry for the image.

## Install

```sh
kubectl create namespace compliance-ai
# bubblewrap needs SYS_ADMIN and unconfined AppArmor, which the baseline and
# restricted Pod Security levels refuse.
kubectl label namespace compliance-ai pod-security.kubernetes.io/enforce=privileged

kubectl -n compliance-ai create secret generic compliance-ai-secrets \
  --from-literal=OPENROUTER_API_KEY=... \
  --from-literal=DEEPSEEK_API_KEY=... \
  --from-literal=SSO_CLIENT_SECRET=...

helm upgrade --install compliance-ai \
  oci://ghcr.io/compliancehcm/charts/compliance-ai \
  --version 1.2.3 -n compliance-ai -f my-values.yaml
helm -n compliance-ai test compliance-ai
```

with a `my-values.yaml` like:

```yaml
sso:
  issuer: https://sso.compliancehcm.com.br/realms/ComplianceHCM
  clientId: compliance-ai-harness
secrets:
  existingSecret: compliance-ai-secrets
ingress:
  enabled: true
  className: nginx
  host: ai.example.com
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
```

`https://<host>/auth/callback` must be registered as a redirect URI on the OIDC
client. `helm install` refuses to render without `sso.issuer`, `sso.clientId`,
and either an ingress host or `sso.publicUrl`.

## What the chart decides, and why

- **One replica, `Recreate`.** The backend pool is process-local and the users
  volume is `ReadWriteOnce`; there is no `replicaCount`. Scale the node, not
  the Deployment.
- **Root with `SYS_ADMIN`, AppArmor unconfined.** Tenancy probes bubblewrap at
  boot and exits rather than serve users unconfined. Clusters that forbid the
  capability outright (GKE Autopilot, some managed policies) cannot run
  tenancy; `tenancy.enabled: false` runs one shared harness instead, without
  per-user isolation.
- **No service account token, no service links.** The harness never calls the
  Kubernetes API, and a token would sit beside users' agents. Service links
  would inject `<SERVICE>_PORT` variables into an environment the image reads
  `COMPLIANCE_*` and `SSO_*` names from.
- **The users volume survives `helm uninstall`** (`helm.sh/resource-policy:
  keep`). Delete the claim by hand when that is the intent.
- **Probes hit `/auth/status`**, which the gate answers without a session and
  only once every plugin has loaded — the image `HEALTHCHECK` check. The startup
  probe allows five minutes for the first boot.
- **Configuration changes restart the pod**: the entrypoint reads the
  environment once, so the ConfigMap's checksum is a pod annotation.

## Limitations

- The health probes see the gateway, not a user's backend.
- Secrets given through `secrets.values` land in the Helm release record in
  plain text; use `secrets.existingSecret` for anything real.

## Develop

```sh
helm lint --strict deploy/helm/compliance-ai -f deploy/helm/compliance-ai/ci/ingress-values.yaml
helm template t deploy/helm/compliance-ai -f deploy/helm/compliance-ai/ci/minimal-values.yaml
```

`.github/workflows/helm-chart.yml` runs both value sets through `helm lint` and
`kubeconform` on Kubernetes 1.29 and 1.31. Bump `version` in `Chart.yaml` when
the templates or values change.
