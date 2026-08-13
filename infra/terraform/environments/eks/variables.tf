# Only the variables the provider itself needs. Everything the modules take —
# instance type, volume size, domains, tunnel token — goes here as you build
# them out.

variable "region" {
  description = "AWS region. eu-north-1 (Stockholm) is the cheapest EU region and is covered by the t4g free trial."
  type        = string
  default     = "eu-north-1"
}

variable "project" {
  description = "Project name, used for tagging and resource naming."
  type        = string
  default     = "strike-shop"
}

variable "environment" {
  description = "Environment name, used for tagging and resource naming."
  type        = string
  default     = "demo"
}
