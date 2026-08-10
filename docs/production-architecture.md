# Production architecture — a reference design

> **This has never been applied.** Nothing described here runs anywhere. The
> Terraform under
> [`infra/terraform/environments/production-reference/`](../infra/terraform/environments/production-reference/)
> passes `fmt`, `validate`, `tflint` and `trivy` in CI, and has never been sent
> to an AWS account. Applying it would cost roughly **$1,000/month**, which is
> about 150× the budget this project actually runs on.

## Why this document exists

The deployed infrastructure — [`infra/README.md`](../infra/README.md) — is
shaped by a hard constraint: $200 of credit has to cover four months. Every
decision there optimises for cost, and several of them would be wrong in a
system that takes real orders from real customers.

A reader cannot tell the difference between *"chose the cheap option knowing
what it costs"* and *"only knows the cheap option"* by looking at the cheap
option. This document is the other half of that pair. It states what the same
application would look like without the budget ceiling, and — more usefully —
what each increment of money actually buys.

## What is deployed today

One `t4g.small` EC2 instance in a single public subnet in one availability
zone, running the stack under Docker Compose behind a Cloudflare Tunnel.
Postgres and Redis are containers on that instance. Kubernetes exists as an
ephemeral EKS cluster that is created for a demonstration and destroyed the
same evening. Total: about **$6.50/month**.

It works, it is reproducible from Terraform, and it would be an irresponsible
thing to put a business on.

## The delta

### Network

| Today | Production |
|---|---|
| One public subnet, one AZ | Private subnets across three AZs, public subnets only for load balancers |
| No NAT — instances are public, locked down by security group | NAT gateway per AZ |
| — | VPC endpoints for ECR, S3, Secrets Manager, CloudWatch |
| — | VPC flow logs to S3 |

The single-AZ choice is the cheapest thing in the current design and the most
serious limitation: an AZ failure is a total outage with no recovery path
short of a rebuild. Three AZs is not redundancy for its own sake — it is what
makes the RDS and node-group failover below mean anything.

A NAT gateway per AZ rather than one shared gateway is deliberate. A single
gateway is ~$35/month cheaper and reintroduces exactly the failure mode the
three-AZ layout was meant to remove.

### Data

This is the largest and most consequential difference.

| Today | Production |
|---|---|
| Postgres container, PVC on one EBS volume | RDS Multi-AZ, automated backups, PITR, one read replica |
| Redis container | ElastiCache replication group, automatic failover |
| Backup = whatever `pg_dump` cron exists | Backups tested by scheduled restore into a scratch instance |

[`infra/README.md`](../infra/README.md) argues for in-cluster Postgres and
lists the four conditions that justify it. Production inverts all four: the
data is not reproducible, the blast radius of losing it is the business rather
than one `seed` command, patching becomes someone's scheduled work, and $12
per month stops being a meaningful number.

The read replica is not for scale at this size. It is so that analytical
queries and the occasional careless `SELECT` cannot degrade checkout.

### Edge and ingress

| Today | Production |
|---|---|
| Cloudflare Tunnel to a single instance | AWS Load Balancer Controller → ALB across three AZs |
| Tunnel terminates TLS | ACM certificates, TLS terminated at the ALB |
| — | WAF: managed rule sets, rate limiting on auth and checkout |
| — | CloudFront in front of the storefront; media and static assets in S3 |

CloudFront is the one line here that arguably pays for itself: origin egress
and instance CPU both drop, and for a storefront the latency difference is
directly measurable in conversion.

### Secrets and identity

| Today | Production |
|---|---|
| Env files on the instance, SSM for access | External Secrets Operator sourcing from Secrets Manager |
| — | Customer-managed KMS keys, per-environment |
| One instance role | IRSA / EKS Pod Identity per workload, least privilege |
| — | Automatic rotation for database credentials |

Kubernetes `Secret` objects are base64, not encryption. Any design that keeps
them in Git — including with the manifests in this repository — is storing
plaintext credentials in version control. External Secrets is what makes the
GitOps model in [`infra/README.md`](../infra/README.md) safe to extend to real
credentials.

### Observability

| Today | Nothing beyond `docker logs` and CloudWatch defaults |
|---|---|
| Production | Prometheus and Grafana (self-hosted or AMP/AMG), Loki for logs, OpenTelemetry traces through the checkout path |

Alerts fire on symptoms users feel — checkout error rate, p99 latency, payment
webhook failures — not on CPU. An alert on CPU tells an operator that a number
moved; an alert on checkout error rate tells them customers cannot buy.

### Delivery

| Today | Production |
|---|---|
| Single account, two root modules | Separate AWS accounts per environment under Organizations, state per account |
| Argo CD syncs, pods are replaced | Argo Rollouts, canary with automated analysis and rollback |
| Images tagged by commit SHA | Images signed with cosign, SBOM published, admission policy rejects unsigned |
| `trivy config` on Terraform | Image scanning in the pipeline and continuously in the registry |
| — | Kyverno or Gatekeeper: no `latest`, no privileged, resources required |

The account boundary is the part that cannot be retrofitted cheaply. It is the
only mechanism that makes "staging cannot reach production data" a fact about
IAM rather than a promise about configuration.

### Resilience

- PodDisruptionBudgets and topology spread constraints, so a node rotation
  cannot take every replica of a service at once
- Karpenter for node provisioning, with a mix of on-demand and spot
- Velero for cluster-state backup
- A written RTO and RPO, and a restore rehearsal on a schedule — an untested
  backup is an assumption, not a recovery plan
- GuardDuty, Security Hub, an organisation-wide CloudTrail

## What it costs

Order-of-magnitude, on-demand list prices, `eu-north-1`, excluding data
transfer. Reserved instances or Savings Plans would take 30–40% off the
compute lines.

| | Monthly | Assumption |
|---|---|---|
| EKS control plane | $73 | one cluster |
| Worker nodes | ~$170 | 3 × `m6g.large`, on-demand |
| NAT gateways | ~$105 | one per AZ, plus processing |
| RDS Postgres | ~$315 | `db.m6g.large` Multi-AZ + 100 GB gp3 |
| ElastiCache Redis | ~$100 | 2 × `cache.t4g.medium` |
| ALB + WAF | ~$45 | one ALB, managed rule sets |
| CloudFront | ~$25 | traffic-dependent |
| Observability | ~$60 | managed Prometheus/Grafana |
| Secrets, KMS, GuardDuty, CloudTrail, backups | ~$80 | |
| **Total** | **~$970** | |

Against ~$6.50/month for what is actually deployed. The ratio is roughly 150×,
and it buys, in order of importance: surviving the loss of an availability
zone, surviving the loss of the database, and knowing when either has
happened.

## What would not change

Worth stating, because it is the part that transfers:

- The application images, and the multi-stage builds that produce them
- The Helm charts under `infra/k8s/helm/` — they take different values, not
  different templates
- The GitOps model: Git is the source of truth, Argo CD reconciles, humans do
  not run `kubectl apply`
- Terraform as the only way infrastructure changes, with remote state and
  locking
- The habit of destroying what is not in use

A design that needed to be rewritten to go to production would be evidence
against itself. This one needs different modules and the same shape.

## Reading this repository

| Path | Status |
|---|---|
| [`infra/terraform/environments/prod/`](../infra/terraform/environments/prod/) | Applied. This runs. |
| [`infra/terraform/environments/eks/`](../infra/terraform/environments/eks/) | Applied, on demand, for hours at a time |
| [`infra/terraform/environments/production-reference/`](../infra/terraform/environments/production-reference/) | **Never applied.** Validated in CI only |
| This document | Design, not deployment |
