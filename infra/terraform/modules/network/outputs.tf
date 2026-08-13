output "security_group_id" {
  description = "ID of the app security group (no ingress rules)."
  value       = aws_security_group.app.id
}

output "subnet_id" {
  description = "ID of the public subnet."
  value       = aws_subnet.public.id
}

output "vpc_id" {
  description = "ID of the VPC."
  value       = aws_vpc.main.id
}