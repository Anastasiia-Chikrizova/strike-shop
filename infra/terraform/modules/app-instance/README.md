# app-instance

The EC2 instance that runs the whole application stack in Docker Compose,
plus the EBS volume that holds the Postgres data directory. `user_data`
installs Docker, the compose plugin, a swapfile, and clones the repo — see
[`user_data.sh.tftpl`](user_data.sh.tftpl) for exactly what runs at boot.

Needs a subnet, security group and AZ from the [`network`](../network) module
— see [`examples/basic`](examples/basic) for how they connect.

## Usage

See [`examples/basic`](examples/basic).

## Inputs

| Name | Description | Type | Default | Required |
| --- | --- | --- | --- | --- |
| `project` | Project name, used in resource names. | `string` | — | yes |
| `environment` | Environment name, used in resource names. Must be `prod`. | `string` | — | yes |
| `region` | AWS region. Passed to the AWS CLI calls in `user_data`, which run before any profile or config exists on the instance. | `string` | — | yes |
| `subnet_id` | ID of the public subnet from the network module. | `string` | — | yes |
| `security_group_id` | ID of the security group from the network module. | `string` | — | yes |
| `availability_zone` | AZ to place the data volume in — must match the subnet's AZ, EBS cannot cross one. | `string` | — | yes |
| `instance_type` | EC2 instance type. Must be Graviton (`t4g.*`) — the container images are arm64-only. | `string` | `"t4g.small"` | no |
| `root_volume_size` | Root EBS volume size in GB (gp3). | `number` | `30` | no |
| `data_volume_size` | Size in GB of the EBS volume holding the Postgres data directory. | `number` | `10` | no |
| `swap_size_gb` | Swapfile size in GB. Not optional on 2 GB of RAM — absorbs the Medusa startup spike. | `number` | `4` | no |
| `repo_url` | Git repository cloned to `/opt/strike-shop` by `user_data`. | `string` | `"https://github.com/Anastasiia-Chikrizova/strike-shop.git"` | no |
| `ssm_parameter_prefix` | Path prefix of the SecureString parameters holding the env files. | `string` | `"/strike-shop/prod"` | no |
| `tags` | Extra tags merged into every resource's tags. | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
| --- | --- |
| `instance_id` | ID of the app instance. Use it with `aws ssm start-session --target <id>`. |
| `public_ip` | Public IPv4 of the app instance — needed for outbound traffic, not inbound: nothing listens. |
| `instance_role_name` | Name of the instance's IAM role, for attaching extra policies (e.g. ECR pull) from the root module. |
