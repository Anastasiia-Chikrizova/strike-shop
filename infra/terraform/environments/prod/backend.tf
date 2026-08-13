terraform {
  backend "s3" {
    bucket       = "strike-shop-tfstate-814454905474"
    key          = "environments/prod/terraform.tfstate"
    region       = "eu-north-1"
    encrypt      = true
    use_lockfile = true
  }
}