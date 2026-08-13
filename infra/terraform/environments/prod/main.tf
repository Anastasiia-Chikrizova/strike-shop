module "network" {
  source = "../../modules/network"

  project     = var.project
  environment = var.environment
}

module "app_instance" {
  source = "../../modules/app-instance"

  project     = var.project
  environment = var.environment
  region      = var.region

  subnet_id         = module.network.subnet_id
  security_group_id = module.network.security_group_id
  availability_zone = module.network.availability_zone
}