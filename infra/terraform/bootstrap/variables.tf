variable "project" {
  description = "Project name, used for tagging and resource naming."
  type        = string
  default     = "strike-shop"
}

variable "region" {
  description = "AWS region."
  type        = string
  default     = "eu-north-1"
}