# Commented out on purpose: the S3 bucket does not exist yet, and it cannot be
# created by a configuration that already requires it as its backend.
#
# Order of operations, once there is an AWS account:
#   1. apply once with local state — this creates the bucket
#   2. uncomment the block below
#   3. terraform init -migrate-state
#
# There is no DynamoDB table here. Since Terraform 1.11, `use_lockfile` locks
# state through S3 conditional writes; `dynamodb_table` is deprecated. One
# fewer resource to pay for and to forget about.

# terraform {
#   backend "s3" {
#     bucket       = "strike-shop-tfstate-<suffix>" # must be globally unique
#     key          = "environments/eks/terraform.tfstate"
#     region       = "eu-north-1"
#     encrypt      = true
#     use_lockfile = true
#   }
# }
