terraform {
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = "eu-north-1"
}

module "network" {
  source = "../.."

  project     = "strike-shop"
  environment = "prod"

  tags = {
    Environment = "prod"
    ManagedBy   = "terraform"
  }
}

output "vpc_id" {
  value = module.network.vpc_id
}

output "subnet_id" {
  value = module.network.subnet_id
}
