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
  source = "../../../network"

  project     = "strike-shop"
  environment = "prod"
}

module "app_instance" {
  source = "../.."

  project     = "strike-shop"
  environment = "prod"
  region      = "eu-north-1"

  subnet_id         = module.network.subnet_id
  security_group_id = module.network.security_group_id
  availability_zone = module.network.availability_zone
}

output "instance_id" {
  value = module.app_instance.instance_id
}

output "public_ip" {
  value = module.app_instance.public_ip
}
