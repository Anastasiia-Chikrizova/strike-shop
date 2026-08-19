# Infrastructure

Terraform for the AWS side of strike-shop.

`environments/prod` is applied and serving traffic: one `t4g.small` behind a
Cloudflare Tunnel at [strike-shop.win](https://strike-shop.win), admin at
[api.strike-shop.win/app](https://api.strike-shop.win/app).

Everything in this directory can still be written, validated, linted and
security-scanned without touching AWS. See "Working without AWS" below.

## Budget

Account opened 2026-08-03. Credits expire 2027-08-03; the free plan itself ends
~2027-02-03 (6 months from signup), after which an upgrade to pay-as-you-go
keeps the remaining credit alive.

| | |
|---|---|
| Credit available | **$200** — $100 Free Tier + 5 × $20 onboarding, all claimed |
| t4g.small free trial | 750 h/month through 2026-12-31 |

The always-on app costs ~$6.99/month (see Cost below) — comfortably inside
both the credit and the free trial.

## Layout

```
infra/
└── terraform/
    ├── bootstrap/          S3 bucket for state — applied once, state stays local
    ├── modules/
    │   ├── network/        VPC, subnet, IGW, routes, security group
    │   └── app-instance/   EC2 running docker compose (always-on, cheap)
    └── environments/
        └── prod/           root module: network + app-instance
```

There is no `staging`. A second always-on environment doubles the only bill
that actually runs continuously and buys nothing this project needs.

## Cost

**$6.99/month** ($0.23/day), checked on 2026-08-14 against Cost Explorer at
usage-type granularity. Compute is genuinely zero — `EUN1-BoxUsage:t4g.small`
records real instance hours at $0.00 — so the monthly cost is the public IPv4
address ($3.65) plus 40 GB of gp3 ($3.34). The trial covers `t4g.small`
**only**; any other size is billed in full, which turns $6.99/month into
$32.10. When the trial ends, this becomes $19.55/month.

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

## Working without AWS

None of this needs credentials:

```bash
terraform fmt -recursive
terraform init -backend=false && terraform validate
tflint --recursive
trivy config infra/
```

CI runs exactly these on every PR touching `infra/**` — see
[`.github/workflows/terraform.yml`](../.github/workflows/terraform.yml). It
requests no AWS credentials and there are none in the repository, so a pull
request cannot spend money by accident.

Two knobs there worth knowing about:

- lint config lives in [`terraform/.tflint.hcl`](terraform/.tflint.hcl) and
  turns half of the code-review checklist (typed and documented variables,
  documented outputs, naming, unused declarations) into something executable;
- the trivy step **fails the build** on anything HIGH or CRITICAL. Three
  findings are accepted on purpose and listed in
  [`.trivyignore`](.trivyignore) with the reasoning: SSE-S3 instead of a KMS
  customer managed key on the state bucket (`AVD-AWS-0132`), unrestricted
  egress (`AVD-AWS-0104`) and public IPs on the subnet (`AVD-AWS-0164`). Two
  of the three are cost trades that stop being defensible outside a demo, so
  the list is worth re-reading whenever the topology changes.

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

State lives in `s3://strike-shop-tfstate-814454905474`, one key per root
module. The bucket has versioning (the undo button for a corrupted state) and
`prevent_destroy`.

The bucket itself is created by `terraform/bootstrap`, a root module whose own
state stays **local and is never migrated**. That asymmetry is deliberate:
a bucket cannot be the backend for the configuration that creates it, and
keeping it in `prod` would mean `terraform destroy` there trying to delete the
bucket holding its own state. Four resources, recreatable by hand if the local
state is ever lost.

Note there is no DynamoDB table. Terraform 1.11+ locks state natively through
S3 conditional writes (`use_lockfile = true`); the `dynamodb_table` argument is
deprecated. One less resource to pay for and manage.

`.terraform.lock.hcl` **is** committed — it pins provider hashes, same role as
`package-lock.json`. `*.tfvars` is not: it may hold real values.

## Cost guardrails (done before the first apply)

Two budgets, which is also the free tier — a third costs $0.02/day:

- **`month`** — $15/month, the one that actually watches spend. Alerts at
  actual 50% and 80%, and **forecasted 100%**, which is the one that catches a
  cluster left running overnight: it fires on day two instead of day five.
- **`My Zero-Spend Budget`** — the account default, $1/month. Useless as a
  spend alarm while credits last, but it is a decent "the credits ran out"
  tripwire, so it stays.

The non-obvious part: a budget counts credits as negative charges by default,
so it reads $0 for as long as the $200 covers the bill. `month` filters the
charge types down to `Usage`, `Tax`, `Support`, the two reservation fees and
out-of-cycle charges — `Credit` and `Refund` are excluded, which is what makes
it show gross spend. Verify with `--show-filter-expression`; without that flag
`describe-budget` reports no filters at all and looks misconfigured.

Region: `eu-north-1` (Stockholm) — cheapest EU region and covered by the t4g
free trial. The onboarding tasks ran in `us-east-1` and `eu-west-1`, and they
did leave something behind: two manual RDS snapshots (~$0.11/month), found
only because the fixed budget started showing a non-zero number. Manual
snapshots outlive the database they came from. Sweep per-region, not just
`eu-north-1`.
