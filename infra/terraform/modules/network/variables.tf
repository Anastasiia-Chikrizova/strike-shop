variable "availability_zone" {
  description = "AZ for the public subnet. Null picks the first AZ in the region. A single AZ on purpose: cross-AZ traffic is billable."
  type        = string
  default     = null
}

variable "environment" {
  description = "Environment name, used in resource names."
  type        = string

  validation {
    condition     = contains(["prod", "eks"], var.environment)
    error_message = "Environment must be prod or eks."
  }
}

variable "project" {
  description = "Project name, used in resource names."
  type        = string
}

variable "tags" {
  description = "Extra tags merged into every resource's tags, e.g. for cost allocation."
  type        = map(string)
  default     = {}
}

variable "subnet_cidr" {
  description = "CIDR block for the public subnet."
  type        = string
  default     = "10.0.1.0/24"

  validation {
    condition     = can(cidrnetmask(var.subnet_cidr))
    error_message = "Subnet CIDR must be a valid IPv4 CIDR block."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrnetmask(var.vpc_cidr))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}