module "network" {
  source = "../../modules/network"

  project     = var.project
  environment = var.environment
}

module "app_instance" {
  source = "../../modules/app-instance"

  project     = var.project
  environment = var.environment

  subnet_id         = module.network.subnet_id
  security_group_id = module.network.security_group_id
}