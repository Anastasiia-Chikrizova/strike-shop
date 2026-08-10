# `production-reference` — never applied

**Nothing in this directory has been sent to an AWS account, and nothing in it
is meant to be.** It is a reference design: the infrastructure this project
would run on without a $200 credit ceiling. Applying it would cost roughly
$1,000/month — see [`docs/production-architecture.md`](../../../../docs/production-architecture.md)
for the breakdown and the reasoning.

Read that document first. This directory is the part of it that is expressed
as code rather than prose.

## Why it exists as code and not only as a diagram

A diagram can describe a Multi-AZ RDS instance without ever confronting the
parameters that make one work — the subnet group, the parameter group, the
backup window, what `apply_immediately` does to an in-flight release. Writing
it as Terraform forces those decisions to be made and makes them reviewable.

## What it is not

- **Not applied**, so not proven. Terraform that has never run has never had
  its assumptions tested against the API. Treat every resource here as a
  considered proposal, not a working artefact.
- **Not complete.** It covers the parts where the choices are interesting —
  three-AZ networking, RDS Multi-AZ, EKS with Karpenter, IRSA. It does not
  reimplement the whole stack, because thirty modules copied from the registry
  demonstrate less than three written deliberately.
- **Not a target for `terraform apply`.** There is no `backend.tf` and no
  credentials path. That is intentional.

## What is checked

The same checks that run against the deployed configuration run against this
one, on every pull request:

```bash
terraform fmt -recursive
terraform init -backend=false && terraform validate
tflint --recursive
trivy config infra/
```

The distinction that matters: `validate` proves the configuration is
internally consistent and type-correct. It does not prove the resources can be
created, that quotas allow them, or that the IAM policies are sufficient. Only
`apply` proves that, and `apply` is exactly what is not happening here.

## Layout

```
production-reference/
├── network/     three AZs, private subnets, NAT per AZ, VPC endpoints
├── data/        RDS Multi-AZ, read replica, ElastiCache replication group
├── cluster/     EKS, Karpenter, IRSA roles, EBS CSI
└── edge/        ALB controller prerequisites, ACM, WAF, CloudFront
```

Split by concern rather than by lifetime, unlike
[`infra/terraform/environments/`](../), where the split exists so the
expensive half can be destroyed on its own. Nothing here is ever created, so
there is nothing to destroy, and the useful grouping becomes the one that
reads best.
