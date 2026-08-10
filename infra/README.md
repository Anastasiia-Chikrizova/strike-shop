# Infrastructure

Terraform for the AWS side of strike-shop. Nothing here has been applied yet.

Everything in this directory can be written, validated, linted and
security-scanned without touching AWS. See "Working without AWS" below.

## Budget

Account opened 2026-08-03. Credits expire 2027-08-03; the free plan itself ends
~2027-02-03 (6 months from signup), after which an upgrade to pay-as-you-go
keeps the remaining credit alive. Planning horizon is 3–4 months, so neither
deadline binds.

| | |
|---|---|
| Credit available | **$200** — $100 Free Tier + 5 × $20 onboarding, all claimed |
| Horizon | 4 months (through ~December 2026) |
| t4g.small free trial | 750 h/month through 2026-12-31 — covers the whole window |

At $200, after the always-on app takes ~$25 over four months, roughly **$175 is
left for EKS — about 970 hours at $0.18/h.** That is 8 hours a day, every day,
for four months.

The conclusion that matters: there is no need to be stingy with the cluster.
Destroy it when it is idle because that is the discipline being demonstrated,
not because the credit is tight.

## Layout

```
infra/
├── terraform/
│   ├── modules/
│   │   ├── network/        VPC, subnet, IGW, routes, security group
│   │   ├── app-instance/   EC2 running docker compose (always-on, cheap)
│   │   └── eks-demo/       EKS cluster (ephemeral — apply, demo, destroy)
│   └── environments/
│       ├── prod/           root module: network + app-instance
│       └── eks/            root module: network + eks-demo
└── k8s/
    └── helm/
        ├── backend/        Medusa chart
        └── storefront/     Next.js chart
```

Two root modules, not one, and that split is the whole point: `prod` stays up
for months at ~$6/month, `eks` exists for hours at a time. One combined state
would make it impossible to destroy the expensive half on its own.

There is no `staging`. A second always-on environment doubles the only bill
that actually runs continuously, and buys nothing a local kind cluster does not
already give for free. `environments/` splits by lifetime and cost here, not by
promotion stage — `eks` is a demo stack, not a tier above `prod`.

The charts under `k8s/helm/` are deliberately outside Terraform. They are
applied by Argo CD against whichever cluster is in front of them — kind while
iterating, `environments/eks` when demonstrating — and nothing in them should
need to know which.

## The cost model this encodes

| | `environments/prod` | `environments/eks` |
|---|---|---|
| Lifetime | months | hours |
| Compute | t4g.small — **$0**, free trial to 2026-12-31 | EKS control plane $0.10/h + 2×t4g.medium $0.069/h |
| Cost | ~$6.29/month | ~$0.18/hour |
| 4 months if left running | $25 | **$525** ← never do this |

The `eks` numbers are why it is a separate root module: one combined state
would make it impossible to tear down the expensive half on its own.

Note also that EKS has no stop/start — a cluster can only be created or
destroyed. Scaling the node group to zero on a schedule still leaves the
control plane billing $0.10/h, which is $73/month for an idle cluster. The
schedule that saves money is `terraform destroy`, not a scale-down.

Iterate on the charts against a local kind cluster — seconds per cycle instead
of minutes — and come to EKS once they already work. Then screenshots, then
`terraform destroy`.

## Postgres

Postgres runs **in-cluster on a PVC — $0**. The managed alternative,
`db.t4g.micro` on RDS, is ~$12/month: roughly half the entire four-month
compute budget for a database holding a demo catalogue.

In a real production system the choice inverts, and it is worth being explicit
about why, because the reasoning is the point rather than the price:

- **Backups and PITR.** RDS gives automated snapshots and point-in-time
  recovery as configuration. In-cluster, that is a CronJob running `pg_dump` to
  S3 — which is a backup, not a recovery *plan*, until someone has restored
  from it at least once.
- **Failure domain.** A PVC lives on one EBS volume attached to one node. Lose
  the node and the database goes with it. Multi-AZ RDS survives that; here it
  is a rebuild from the last dump.
- **Upgrades and patching.** Minor-version patching is a checkbox on RDS and a
  maintenance window someone has to plan in-cluster.
- **Operational surface.** Tuning, connection limits and vacuum behaviour
  become the cluster owner's job, and none of it is what a storefront project
  is meant to demonstrate.

What justifies in-cluster here: the data is seeded and reproducible, the
blast radius of losing it is one `seed` command, and the cost difference is
real money against a fixed credit budget. Those three conditions are exactly
what stops being true in production.

This is why there is no `modules/db`: the database is a Helm release under
`k8s/helm/`, not a Terraform resource. If that ever changes, the budget table
above changes with it.

## What goes in each module

### `modules/network`
VPC with one **public** subnet in a single AZ. Public, deliberately: outbound
traffic from a private subnet needs a NAT gateway at ~$33/month, which is five
times the entire app budget. A public subnet plus a locked-down security group
is cheaper and, with no inbound rules, not less safe.

- `aws_vpc`, `aws_subnet` (public, single AZ — cross-AZ traffic is billable)
- `aws_internet_gateway`, `aws_route_table`, `aws_route_table_association`
- `aws_security_group` — **zero ingress rules**. Cloudflare Tunnel and the SSM
  agent both dial *out*; nothing needs to reach in. Egress open.

### `modules/app-instance`
- `aws_instance` — `t4g.small`, arm64 (the images are arm64-only now)
  - `credit_specification { cpu_credits = "standard" }` — **required.** T4g
    defaults to `unlimited`, which silently bills surplus CPU credits even
    though the instance hours themselves are covered by the free trial.
  - `root_block_device` — `gp3`, 30 GB. Not gp2 (25% more for the same thing).
    3000 IOPS and 125 MB/s are included free; do not provision extra.
  - `user_data` — install Docker, create a 4 GB swapfile, pull and start the
    compose stack. Swap is not optional on 2 GB: it absorbs the Medusa startup
    spike that would otherwise get Postgres OOM-killed.
- `aws_iam_role` + `aws_iam_instance_profile` with
  `AmazonSSMManagedInstanceCore` — access via Session Manager, so there is no
  key pair, no port 22 and no bastion.
- `aws_eip` only if a stable address is actually needed; the auto-assigned
  public IPv4 costs the same $3.65/month either way.

### `modules/eks-demo`
- `aws_eks_cluster` + `aws_eks_node_group` (2 × `t4g.medium`, arm64 AMI type)
- IAM roles for cluster and nodes, OIDC provider for IRSA
- Keep it minimal. Every add-on is another thing to debug at $0.18/hour.

## Working without AWS

None of this needs credentials:

```bash
terraform fmt -recursive
terraform init -backend=false && terraform validate
tflint --recursive
trivy config infra/
```

CI runs exactly these on every PR — see
[`.github/workflows/terraform.yml`](../.github/workflows/terraform.yml). There
are no AWS secrets in the repository and the workflow requests none, so it
cannot spend money by accident.

`terraform plan` is the first command that needs an account, because data
sources make real API calls. That is the boundary: everything up to `validate`
is free, `plan` is not.

One local setup step worth doing once — without it, `terraform init` downloads
its own copy of the AWS provider into every directory, which across five
directories here is about 3.8 GB:

```bash
mkdir -p ~/.terraform.d/plugin-cache
printf 'plugin_cache_dir = "$HOME/.terraform.d/plugin-cache"\n' >> ~/.terraformrc
```

## State

`backend.tf` in each root module is committed **commented out**, because the S3
bucket does not exist yet. Chicken-and-egg: the backend needs a bucket, the
bucket needs an apply.

Order when the time comes: apply once with local state to create the bucket,
then uncomment the backend and `terraform init -migrate-state`.

Note there is no DynamoDB table. Terraform 1.11+ locks state natively through
S3 conditional writes (`use_lockfile = true`); the `dynamodb_table` argument is
deprecated. One less resource to pay for and manage.

`.terraform.lock.hcl` **is** committed — it pins provider hashes, same role as
`package-lock.json`. `*.tfvars` is not: it may hold real values.

## Before the first apply

1. **Verify the Budget thresholds** — the budget task is done, so an alert
   exists; make sure it fires at something useful ($20 / $50 / $100) and goes
   to an address that gets read.
2. Region: `eu-north-1` (Stockholm) — cheapest EU region and covered by the
   t4g free trial. Note the onboarding tasks were done in `us-east-1` and
   `eu-west-1`; nothing from them should still exist, but the sweep is
   per-region, so check there rather than only in `eu-north-1`.
