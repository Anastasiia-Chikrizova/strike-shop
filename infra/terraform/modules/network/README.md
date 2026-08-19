# network

VPC with a single public subnet, deliberately no NAT gateway (see
[README.md](../../../../README.md#design-decisions) at the repo root for why).
Also creates the app security group — no ingress rules, since everything in
this project dials out (SSM, Cloudflare Tunnel) rather than accepting inbound
connections — and locks down the VPC's default security group.

## Usage

See [`examples/basic`](examples/basic).

## Inputs

| Name | Description | Type | Default | Required |
| --- | --- | --- | --- | --- |
| `project` | Project name, used in resource names. | `string` | — | yes |
| `environment` | Environment name, used in resource names. Must be `prod`. | `string` | — | yes |
| `availability_zone` | AZ for the public subnet. `null` picks the first AZ in the region. | `string` | `null` | no |
| `subnet_cidr` | CIDR block for the public subnet. | `string` | `"10.0.1.0/24"` | no |
| `vpc_cidr` | CIDR block for the VPC. | `string` | `"10.0.0.0/16"` | no |
| `tags` | Extra tags merged into every resource's tags. | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
| --- | --- |
| `vpc_id` | ID of the VPC. |
| `subnet_id` | ID of the public subnet. |
| `security_group_id` | ID of the app security group (no ingress rules). |
| `availability_zone` | AZ the subnet lives in — anything with an EBS volume has to be placed in the same one. |
