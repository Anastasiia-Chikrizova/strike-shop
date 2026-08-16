locals {
  common_tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

module "network" {
  source = "../../modules/network"

  project     = var.project
  environment = var.environment
  tags        = local.common_tags
}

module "app_instance" {
  source = "../../modules/app-instance"

  project     = var.project
  environment = var.environment
  region      = var.region
  tags        = local.common_tags

  subnet_id         = module.network.subnet_id
  security_group_id = module.network.security_group_id
  availability_zone = module.network.availability_zone
}