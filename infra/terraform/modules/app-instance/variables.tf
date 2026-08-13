variable "environment" {
  description = "Environment name, used in resource names."
  type        = string

  validation {
    condition     = contains(["prod", "eks"], var.environment)
    error_message = "Environment must be prod or eks."
  }
}

variable "instance_type" {
  description = "EC2 instance type. Must be Graviton (t4g.*): the container images are arm64-only."
  type        = string
  default     = "t4g.small"

  validation {
    condition     = startswith(var.instance_type, "t4g.")
    error_message = "Instance type must be a t4g.* Graviton type. An x86 instance cannot run arm64 images."
  }
}

variable "project" {
  description = "Project name, used in resource names."
  type        = string
}

variable "repo_url" {
  description = "Git repository cloned to /opt/strike-shop by user_data, for the compose file and deploy script."
  type        = string
  default     = "https://github.com/Anastasiia-Chikrizova/strike-shop.git"
}

variable "root_volume_size" {
  description = "Root EBS volume size in GB (gp3)."
  type        = number
  default     = 30

  validation {
    condition     = var.root_volume_size >= 8 && var.root_volume_size <= 100
    error_message = "Root volume must be between 8 and 100 GB. Larger volumes are a typo, not a plan."
  }
}

variable "security_group_id" {
  description = "ID of the security group from the network module."
  type        = string
}

variable "subnet_id" {
  description = "ID of the public subnet from the network module."
  type        = string
}

variable "swap_size_gb" {
  description = "Swapfile size in GB. Not optional on 2 GB of RAM: it absorbs the Medusa startup spike."
  type        = number
  default     = 4
}