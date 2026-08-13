locals {
  name_prefix = "${var.project}-${var.environment}"

  availability_zone = coalesce(var.availability_zone, data.aws_availability_zones.available.names[0])
}